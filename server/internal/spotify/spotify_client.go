package spotify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

var sharedSpotifyCache = newSharedCache()

const (
	currentlyPlayingTTL = 15 * time.Second
	recentlyPlayedTTL   = 5 * time.Minute
	topDataTTL          = 12 * time.Hour
	recommendationsTTL  = 6 * time.Hour
	artistLookupTTL     = 7 * 24 * time.Hour
)

type SpotifyClient struct {
	UserID      string
	AccessToken string
	HTTPClient  *http.Client
}

type Track struct {
	Name       string `json:"name"`
	Artist     string `json:"artist"`
	Album      string `json:"album"`
	AlbumArt   string `json:"album_art_url"`
	IsPlaying  bool   `json:"is_playing"`
	ProgressMs int    `json:"progress_ms,omitempty"`
	DurationMs int    `json:"duration_ms,omitempty"`
	PlayedAt   string `json:"played_at,omitempty"`
}

type TopTrack struct {
	Name     string   `json:"name"`
	Artist   string   `json:"artist"`
	Album    string   `json:"album"`
	AlbumArt string   `json:"album_art_url"`
	Genres   []string `json:"genres"`
	Rank     int      `json:"rank"`
}

type TopArtist struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	ImageURL string   `json:"image_url"`
	Genres   []string `json:"genres"`
	Rank     int      `json:"rank"`
}

type PlaylistTrack struct {
	Name     string `json:"name"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	AlbumArt string `json:"album_art"`
	Rank     int    `json:"rank"`
}

type SpotifyRateLimitError struct {
	RetryAfter time.Duration
}

func (e *SpotifyRateLimitError) Error() string {
	return fmt.Sprintf("rate limit exceeded; retry after %s", e.RetryAfter.Round(time.Second))
}

type SpotifyAPIError struct {
	StatusCode int
	Endpoint   string
	Message    string
}

func (e *SpotifyAPIError) Error() string {
	return fmt.Sprintf("spotify api error [%d] at %s: %s", e.StatusCode, e.Endpoint, e.Message)
}

type CurrentlyPlayingResponse struct {
	IsPlaying  bool `json:"is_playing"`
	ProgressMs int  `json:"progress_ms"`
	Item       struct {
		Name  string `json:"name"`
		Album struct {
			Name   string `json:"name"`
			Images []struct {
				URL string `json:"url"`
			} `json:"images"`
		} `json:"album"`
		Artists []struct {
			Name string `json:"name"`
		} `json:"artists"`
	} `json:"item"`
}

type RecentlyPlayedResponse struct {
	Items []struct {
		Track struct {
			Name       string `json:"name"`
			DurationMs int    `json:"duration_ms"`
			Album struct {
				Name   string `json:"name"`
				Images []struct {
					URL string `json:"url"`
				} `json:"images"`
			} `json:"album"`
			Artists []struct {
				Name string `json:"name"`
			} `json:"artists"`
		} `json:"track"`
		PlayedAt string `json:"played_at"`
	} `json:"items"`
}

type TopTracksResponse struct {
	Items []struct {
		Name  string `json:"name"`
		Album struct {
			Name   string `json:"name"`
			Images []struct {
				URL string `json:"url"`
			} `json:"images"`
		} `json:"album"`
		Artists []struct {
			Name string `json:"name"`
		} `json:"artists"`
	} `json:"items"`
}

type TopArtistsResponse struct {
	Items []struct {
		ID     string   `json:"id"`
		Name   string   `json:"name"`
		Genres []string `json:"genres"`
		Images []struct {
			URL string `json:"url"`
		} `json:"images"`
	} `json:"items"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type ArtistSearchResponse struct {
	Artists struct {
		Items []struct {
			Genres []string `json:"genres"`
		} `json:"items"`
	} `json:"artists"`
}

type ArtistDetailsResponse struct {
	Genres []string `json:"genres"`
}

func NewSpotifyClient(userID, accessToken string) *SpotifyClient {
	return &SpotifyClient{
		UserID:      userID,
		AccessToken: accessToken,
		HTTPClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (sc *SpotifyClient) cacheKey(endpoint string) string {
	return sc.UserID + ":" + endpoint
}

func (sc *SpotifyClient) doRequest(endpoint, method, requestURL string, body io.Reader, headers map[string]string) ([]byte, int, error) {
	req, err := http.NewRequest(method, requestURL, body)
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Authorization", "Bearer "+sc.AccessToken)
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	if resp.StatusCode == http.StatusNoContent {
		return nil, resp.StatusCode, nil
	}

	if resp.StatusCode != http.StatusOK {
		return responseBody, resp.StatusCode, handleSpotifyAPIError(resp, endpoint)
	}

	return responseBody, resp.StatusCode, nil
}

func (sc *SpotifyClient) GetCurrentlyPlaying() (*Track, error) {
	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("currently-playing"), currentlyPlayingTTL, func() (*Track, error) {
		var track *Track
		err := retryWithBackoff(func() error {
			body, status, err := sc.doRequest("currently-playing", http.MethodGet, "https://api.spotify.com/v1/me/player/currently-playing", nil, nil)
			if err != nil {
				return err
			}
			if status == http.StatusNoContent {
				track = &Track{IsPlaying: false}
				return nil
			}

			var response CurrentlyPlayingResponse
			if err := json.Unmarshal(body, &response); err != nil {
				return err
			}

			result := &Track{
				IsPlaying:  response.IsPlaying,
				ProgressMs: response.ProgressMs,
			}
			if response.Item.Name != "" {
				result.Name = response.Item.Name
				result.Album = response.Item.Album.Name
				if len(response.Item.Artists) > 0 {
					result.Artist = response.Item.Artists[0].Name
				}
				if len(response.Item.Album.Images) > 0 {
					result.AlbumArt = response.Item.Album.Images[0].URL
				}
			}

			track = result
			return nil
		})
		return track, err
	})
}

func (sc *SpotifyClient) GetRecentlyPlayed() ([]Track, error) {
	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("recently-played"), recentlyPlayedTTL, func() ([]Track, error) {
		var tracks []Track
		err := retryWithBackoff(func() error {
			body, _, err := sc.doRequest("recently-played", http.MethodGet, "https://api.spotify.com/v1/me/player/recently-played?limit=50", nil, nil)
			if err != nil {
				return err
			}

			var response RecentlyPlayedResponse
			if err := json.Unmarshal(body, &response); err != nil {
				return err
			}

			result := make([]Track, 0, len(response.Items))
			for _, item := range response.Items {
				if item.Track.Name == "" || len(item.Track.Artists) == 0 {
					continue
				}

				track := Track{
					Name:       item.Track.Name,
					Album:      item.Track.Album.Name,
					Artist:     item.Track.Artists[0].Name,
					DurationMs: item.Track.DurationMs,
					PlayedAt:   item.PlayedAt,
				}
				if len(item.Track.Album.Images) > 0 {
					track.AlbumArt = item.Track.Album.Images[0].URL
				}

				result = append(result, track)
			}

			tracks = result
			return nil
		})
		return tracks, err
	})
}

func (sc *SpotifyClient) RefreshTokenIfNeeded(refreshToken string) error {
	req, err := http.NewRequest(http.MethodGet, "https://api.spotify.com/v1/me", nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+sc.AccessToken)
	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}

	if resp.StatusCode == http.StatusUnauthorized && refreshToken != "" {
		token, err := sc.RefreshToken(refreshToken)
		if err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}
		sc.AccessToken = token.AccessToken
		return nil
	}

	return fmt.Errorf("token validation failed with status %d", resp.StatusCode)
}

func (sc *SpotifyClient) RefreshToken(refreshToken string) (*TokenResponse, error) {
	clientID := os.Getenv("SPOTIFY_CLIENT_ID")
	clientSecret := os.Getenv("SPOTIFY_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("spotify client credentials not configured")
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", refreshToken)

	req, err := http.NewRequest(http.MethodPost, "https://accounts.spotify.com/api/token", bytes.NewBufferString(form.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(clientID, clientSecret)

	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token refresh failed: %d - %s", resp.StatusCode, string(body))
	}

	var token TokenResponse
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, err
	}

	return &token, nil
}

func (sc *SpotifyClient) GetTopTracks(timeRange string) ([]TopTrack, error) {
	if timeRange == "" {
		timeRange = "medium_term"
	}

	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("top-tracks:"+timeRange), topDataTTL, func() ([]TopTrack, error) {
		var tracks []TopTrack
		err := retryWithBackoff(func() error {
			requestURL := fmt.Sprintf("https://api.spotify.com/v1/me/top/tracks?time_range=%s&limit=50", timeRange)
			body, _, err := sc.doRequest("top-tracks:"+timeRange, http.MethodGet, requestURL, nil, nil)
			if err != nil {
				return err
			}

			var response TopTracksResponse
			if err := json.Unmarshal(body, &response); err != nil {
				return err
			}

			result := make([]TopTrack, 0, len(response.Items))
			for i, item := range response.Items {
				if item.Name == "" || len(item.Artists) == 0 {
					continue
				}

				track := TopTrack{
					Name:   item.Name,
					Album:  item.Album.Name,
					Artist: item.Artists[0].Name,
					Rank:   i + 1,
				}
				if len(item.Album.Images) > 0 {
					track.AlbumArt = item.Album.Images[0].URL
				}

				result = append(result, track)
			}

			tracks = result
			return nil
		})
		return tracks, err
	})
}

func (sc *SpotifyClient) GetTopArtists(timeRange string) ([]TopArtist, error) {
	if timeRange == "" {
		timeRange = "medium_term"
	}

	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("top-artists:"+timeRange), topDataTTL, func() ([]TopArtist, error) {
		var artists []TopArtist
		err := retryWithBackoff(func() error {
			requestURL := fmt.Sprintf("https://api.spotify.com/v1/me/top/artists?time_range=%s&limit=50", timeRange)
			body, _, err := sc.doRequest("top-artists:"+timeRange, http.MethodGet, requestURL, nil, nil)
			if err != nil {
				return err
			}

			var response TopArtistsResponse
			if err := json.Unmarshal(body, &response); err != nil {
				return err
			}

			result := make([]TopArtist, 0, len(response.Items))
			for i, item := range response.Items {
				if item.Name == "" {
					continue
				}

				artist := TopArtist{
					ID:     item.ID,
					Name:   item.Name,
					Genres: item.Genres,
					Rank:   i + 1,
				}
				if len(item.Images) > 0 {
					artist.ImageURL = item.Images[0].URL
				}

				result = append(result, artist)
			}

			artists = result
			return nil
		})
		return artists, err
	})
}

func (sc *SpotifyClient) GetOnRepeatTracks() ([]PlaylistTrack, error) {
	topTracks, err := sc.GetTopTracks("long_term")
	if err != nil {
		return nil, err
	}

	tracks := make([]PlaylistTrack, 0, len(topTracks))
	for _, track := range topTracks {
		tracks = append(tracks, PlaylistTrack{
			Name:     track.Name,
			Artist:   track.Artist,
			Album:    track.Album,
			AlbumArt: track.AlbumArt,
			Rank:     track.Rank,
		})
	}

	return tracks, nil
}

func (sc *SpotifyClient) GetRecommendedTracks() ([]PlaylistTrack, error) {
	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("recommendations"), recommendationsTTL, func() ([]PlaylistTrack, error) {
		shortTermTracks, err := sc.GetTopTracks("short_term")
		if err != nil {
			return nil, err
		}

		mediumTermTracks, err := sc.GetTopTracks("short_term")
		if err != nil {
			return nil, err
		}

		longTermTracks, err := sc.GetTopTracks("long_term")
		if err != nil {
			return nil, err
		}

		recentlyPlayed, err := sc.GetRecentlyPlayed()
		if err != nil {
			return nil, err
		}

		recentSet := make(map[string]struct{}, len(recentlyPlayed))
		for _, track := range recentlyPlayed {
			recentSet[track.Name+"::"+track.Artist] = struct{}{}
		}

		candidates := append([]TopTrack{}, shortTermTracks...)
		candidates = append(candidates, mediumTermTracks...)
		candidates = append(candidates, longTermTracks...)

		recommendations := make([]PlaylistTrack, 0, 10)
		seen := make(map[string]struct{})
		for _, track := range candidates {
			if len(recommendations) == 10 {
				break
			}

			key := track.Name + "::" + track.Artist
			if _, exists := seen[key]; exists {
				continue
			}
			if _, recentlyPlayed := recentSet[key]; recentlyPlayed {
				continue
			}
			if track.Name == "" || track.Artist == "" {
				continue
			}

			seen[key] = struct{}{}
			recommendations = append(recommendations, PlaylistTrack{
				Name:     track.Name,
				Artist:   track.Artist,
				Album:    track.Album,
				AlbumArt: track.AlbumArt,
				Rank:     len(recommendations) + 1,
			})
		}

		return recommendations, nil
	})
}

func (sc *SpotifyClient) GetArtistGenres(name string) ([]string, error) {
	normalized := strings.ToLower(strings.TrimSpace(name))
	if normalized == "" {
		return nil, nil
	}

	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("artist-genres:"+normalized), artistLookupTTL, func() ([]string, error) {
		requestURL := "https://api.spotify.com/v1/search?type=artist&limit=1&q=" + url.QueryEscape(name)
		body, _, err := sc.doRequest("artist-search", http.MethodGet, requestURL, nil, nil)
		if err != nil {
			return nil, err
		}

		var response ArtistSearchResponse
		if err := json.Unmarshal(body, &response); err != nil {
			return nil, err
		}
		if len(response.Artists.Items) == 0 {
			return []string{}, nil
		}

		return response.Artists.Items[0].Genres, nil
	})
}

func (sc *SpotifyClient) GetArtistGenresByID(artistID string) ([]string, error) {
	normalized := strings.TrimSpace(artistID)
	if normalized == "" {
		return nil, nil
	}

	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("artist-genres-id:"+normalized), artistLookupTTL, func() ([]string, error) {
		requestURL := "https://api.spotify.com/v1/artists/" + url.PathEscape(normalized)
		body, _, err := sc.doRequest("artist-details", http.MethodGet, requestURL, nil, nil)
		if err != nil {
			return nil, err
		}

		var response ArtistDetailsResponse
		if err := json.Unmarshal(body, &response); err != nil {
			return nil, err
		}

		return response.Genres, nil
	})
}
