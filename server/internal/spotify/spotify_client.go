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
	currentlyPlayingTTL = 30 * time.Second
	recentlyPlayedTTL   = 5 * time.Minute
	topTracksTTL        = 12 * time.Hour
	topArtistsTTL       = 24 * time.Hour
	recommendationsTTL  = 6 * time.Hour
	artistLookupTTL     = 7 * 24 * time.Hour
	trackLookupTTL      = 7 * 24 * time.Hour
)

type SpotifyClient struct {
	UserID      string
	AccessToken string
	HTTPClient  *http.Client
}

type Track struct {
	ID         string `json:"track_id,omitempty"`
	Name       string `json:"name"`
	Artist     string `json:"artist"`
	Album      string `json:"album"`
	AlbumArt   string `json:"album_art_url"`
	SpotifyURL string `json:"spotify_url,omitempty"`
	PreviewURL string `json:"preview_url,omitempty"`
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

type SpotifyArtistImage struct {
	Height int    `json:"height"`
	URL    string `json:"url"`
	Width  int    `json:"width"`
}

type SpotifyArtistFollowers struct {
	Href  *string `json:"href"`
	Total int     `json:"total"`
}

type SpotifyArtistItem struct {
	ExternalURLs map[string]string      `json:"external_urls"`
	Followers    SpotifyArtistFollowers `json:"followers"`
	Genres       []string               `json:"genres"`
	Href         string                 `json:"href"`
	ID           string                 `json:"id"`
	Images       []SpotifyArtistImage   `json:"images"`
	Name         string                 `json:"name"`
	Popularity   int                    `json:"popularity"`
	Type         string                 `json:"type"`
	URI          string                 `json:"uri"`
}

type SpotifyTopArtistsResponse struct {
	Items    []SpotifyArtistItem `json:"items"`
	Total    int                 `json:"total"`
	Limit    int                 `json:"limit"`
	Offset   int                 `json:"offset"`
	Href     string              `json:"href"`
	Next     *string             `json:"next"`
	Previous *string             `json:"previous"`
}

type SpotifyArtistsLookupResponse struct {
	Artists []SpotifyArtistItem `json:"artists"`
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
		ID           string `json:"id"`
		Name         string `json:"name"`
		PreviewURL   string `json:"preview_url"`
		ExternalURLs struct {
			Spotify string `json:"spotify"`
		} `json:"external_urls"`
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
			ID           string `json:"id"`
			Name         string `json:"name"`
			DurationMs   int    `json:"duration_ms"`
			PreviewURL   string `json:"preview_url"`
			ExternalURLs struct {
				Spotify string `json:"spotify"`
			} `json:"external_urls"`
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

type TrackDetailsResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	PreviewURL   string `json:"preview_url"`
	ExternalURLs struct {
		Spotify string `json:"spotify"`
	} `json:"external_urls"`
	Album struct {
		Name   string `json:"name"`
		Images []struct {
			URL string `json:"url"`
		} `json:"images"`
	} `json:"album"`
	Artists []struct {
		Name string `json:"name"`
	} `json:"artists"`
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

func globalResourceCacheKey(resource string) string {
	return "global:" + resource
}

func (sc *SpotifyClient) topArtistsCacheKey(timeRange string) string {
	return sc.cacheKey("top-artists:v2:" + timeRange)
}

func (sc *SpotifyClient) topArtistsRawCacheKey(timeRange string, limit int) string {
	return sc.cacheKey(fmt.Sprintf("top-artists-raw:v2:%s:%d", timeRange, limit))
}

func (sc *SpotifyClient) InvalidateTopArtistCaches(timeRange string, limits ...int) {
	if timeRange == "" {
		timeRange = "medium_term"
	}

	sharedSpotifyCache.Delete(sc.topArtistsCacheKey(timeRange))
	for _, limit := range limits {
		if limit <= 0 {
			continue
		}
		sharedSpotifyCache.Delete(sc.topArtistsRawCacheKey(timeRange, limit))
	}
}

func (sc *SpotifyClient) doRequest(endpoint, method, requestURL string, body io.Reader, headers map[string]string) ([]byte, int, error) {
	if err := sharedSpotifyGuard.waitTurn(); err != nil {
		return nil, 0, err
	}

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
		err := handleSpotifyAPIError(resp, endpoint)
		if rateLimitErr, ok := err.(*SpotifyRateLimitError); ok {
			sharedSpotifyGuard.markRateLimited(rateLimitErr.RetryAfter)
		}

		return responseBody, resp.StatusCode, err
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
				ID:         response.Item.ID,
				IsPlaying:  response.IsPlaying,
				ProgressMs: response.ProgressMs,
				PreviewURL: response.Item.PreviewURL,
				SpotifyURL: response.Item.ExternalURLs.Spotify,
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
					ID:         item.Track.ID,
					Name:       item.Track.Name,
					Album:      item.Track.Album.Name,
					Artist:     item.Track.Artists[0].Name,
					SpotifyURL: item.Track.ExternalURLs.Spotify,
					PreviewURL: item.Track.PreviewURL,
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
	_, _, err := sc.doRequest("token-check", http.MethodGet, "https://api.spotify.com/v1/me", nil, nil)
	if err == nil {
		return nil
	}

	if isTokenExpiredError(err) && refreshToken != "" {
		token, err := sc.RefreshToken(refreshToken)
		if err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}
		sc.AccessToken = token.AccessToken
		return nil
	}

	return err
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

	var token *TokenResponse
	err := retryWithBackoff(func() error {
		if err := sharedSpotifyGuard.waitTurn(); err != nil {
			return err
		}

		req, err := http.NewRequest(http.MethodPost, "https://accounts.spotify.com/api/token", bytes.NewBufferString(form.Encode()))
		if err != nil {
			return err
		}

		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetBasicAuth(clientID, clientSecret)

		resp, err := sc.HTTPClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			rateLimitErr := &SpotifyRateLimitError{RetryAfter: getRetryAfter(resp)}
			sharedSpotifyGuard.markRateLimited(rateLimitErr.RetryAfter)
			return rateLimitErr
		}

		if resp.StatusCode >= http.StatusInternalServerError {
			return &SpotifyError{
				StatusCode: resp.StatusCode,
				Message:    "Spotify token service temporarily unavailable",
				Endpoint:   "token-refresh",
			}
		}

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("token refresh failed: %d - %s", resp.StatusCode, string(body))
		}

		parsed := &TokenResponse{}
		if err := json.Unmarshal(body, parsed); err != nil {
			return err
		}

		token = parsed
		return nil
	})
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (sc *SpotifyClient) GetTopTracks(timeRange string) ([]TopTrack, error) {
	if timeRange == "" {
		timeRange = "medium_term"
	}

	return loadSharedResource(sharedSpotifyCache, sc.cacheKey("top-tracks:"+timeRange), topTracksTTL, func() ([]TopTrack, error) {
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

	cacheKey := sc.topArtistsCacheKey(timeRange)
	if cached, ok := sharedSpotifyCache.getFresh(cacheKey); ok {
		if artists, ok := cached.([]TopArtist); ok {
			if hasAnyGenres(artists) {
				return artists, nil
			}

			sharedSpotifyCache.Delete(cacheKey)
		}
	}

	return loadSharedResource(sharedSpotifyCache, cacheKey, topArtistsTTL, func() ([]TopArtist, error) {
		response, err := sc.GetTopArtistsRaw(timeRange, 50)
		if err != nil {
			return nil, err
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

		return result, nil
	})
}

func (sc *SpotifyClient) GetTopArtistsRaw(timeRange string, limit int) (*SpotifyTopArtistsResponse, error) {
	if timeRange == "" {
		timeRange = "medium_term"
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 50 {
		limit = 50
	}

	cacheKey := sc.topArtistsRawCacheKey(timeRange, limit)
	if cached, ok := sharedSpotifyCache.getFresh(cacheKey); ok {
		if response, ok := cached.(*SpotifyTopArtistsResponse); ok {
			if hasAnyGenresInTopArtistResponse(response) {
				return response, nil
			}

			sharedSpotifyCache.Delete(cacheKey)
		}
	}

	return loadSharedResource(sharedSpotifyCache, cacheKey, topArtistsTTL, func() (*SpotifyTopArtistsResponse, error) {
		var response *SpotifyTopArtistsResponse
		err := retryWithBackoff(func() error {
			requestURL := fmt.Sprintf("https://api.spotify.com/v1/me/top/artists?time_range=%s&limit=%d", timeRange, limit)
			body, _, err := sc.doRequest("top-artists-raw:"+timeRange, http.MethodGet, requestURL, nil, nil)
			if err != nil {
				return err
			}

			var parsed SpotifyTopArtistsResponse
			if err := json.Unmarshal(body, &parsed); err != nil {
				return err
			}

			sc.populateMissingGenresInTopArtistResponse(&parsed)
			response = &parsed
			return nil
		})
		if err != nil {
			return nil, err
		}

		return response, nil
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

	cacheKey := globalResourceCacheKey("artist-genres:" + normalized)
	if cached, ok := sharedSpotifyCache.getFresh(cacheKey); ok {
		if genres, ok := cached.([]string); ok {
			return genres, nil
		}
	}

	return loadSharedResource(sharedSpotifyCache, cacheKey, artistLookupTTL, func() ([]string, error) {
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

	cacheKey := globalResourceCacheKey("artist-genres-id:" + normalized)
	if cached, ok := sharedSpotifyCache.getFresh(cacheKey); ok {
		if genres, ok := cached.([]string); ok {
			return genres, nil
		}
	}

	return loadSharedResource(sharedSpotifyCache, cacheKey, artistLookupTTL, func() ([]string, error) {
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

func (sc *SpotifyClient) GetTrackDetails(trackID string) (*Track, error) {
	normalized := strings.TrimSpace(trackID)
	if normalized == "" {
		return nil, nil
	}

	return loadSharedResource(sharedSpotifyCache, globalResourceCacheKey("track-details:"+normalized), trackLookupTTL, func() (*Track, error) {
		requestURL := "https://api.spotify.com/v1/tracks/" + url.PathEscape(normalized)
		body, _, err := sc.doRequest("track-details", http.MethodGet, requestURL, nil, nil)
		if err != nil {
			return nil, err
		}

		var response TrackDetailsResponse
		if err := json.Unmarshal(body, &response); err != nil {
			return nil, err
		}

		track := &Track{
			ID:         response.ID,
			Name:       response.Name,
			Album:      response.Album.Name,
			PreviewURL: response.PreviewURL,
			SpotifyURL: response.ExternalURLs.Spotify,
		}
		if len(response.Artists) > 0 {
			track.Artist = response.Artists[0].Name
		}
		if len(response.Album.Images) > 0 {
			track.AlbumArt = response.Album.Images[0].URL
		}

		return track, nil
	})
}

func toStringValue(value any) string {
	if value == nil {
		return ""
	}

	if str, ok := value.(string); ok {
		return str
	}

	return fmt.Sprintf("%v", value)
}

func hasAnyGenres(artists []TopArtist) bool {
	limit := min(len(artists), 10)
	for _, artist := range artists[:limit] {
		if len(artist.Genres) > 0 {
			return true
		}
	}

	return false
}

func hasAnyGenresInTopArtistResponse(response *SpotifyTopArtistsResponse) bool {
	if response == nil {
		return false
	}

	limit := min(len(response.Items), 10)
	for _, artist := range response.Items[:limit] {
		if len(artist.Genres) > 0 {
			return true
		}
	}

	return false
}

func (sc *SpotifyClient) populateMissingGenresInTopArtistResponse(response *SpotifyTopArtistsResponse) {
	if response == nil {
		return
	}

	sc.populateMissingGenresFromBatchArtistLookup(response)

	for i := range response.Items {
		if len(response.Items[i].Genres) > 0 {
			continue
		}

		if response.Items[i].ID != "" {
			genres, err := sc.GetArtistGenresByID(response.Items[i].ID)
			if err == nil && len(genres) > 0 {
				response.Items[i].Genres = genres
				continue
			}
		}

		if response.Items[i].Name == "" {
			continue
		}

		genres, err := sc.GetArtistGenres(response.Items[i].Name)
		if err == nil && len(genres) > 0 {
			response.Items[i].Genres = genres
		}
	}
}

func (sc *SpotifyClient) populateMissingGenresFromBatchArtistLookup(response *SpotifyTopArtistsResponse) {
	if response == nil {
		return
	}

	missingIDs := make([]string, 0, len(response.Items))
	for _, item := range response.Items {
		if item.ID == "" || len(item.Genres) > 0 {
			continue
		}

		missingIDs = append(missingIDs, item.ID)
	}

	if len(missingIDs) == 0 {
		return
	}

	// Spotify accepts up to 50 IDs for the batch artists lookup.
	for start := 0; start < len(missingIDs); start += 50 {
		end := min(start+50, len(missingIDs))
		genresByID, err := sc.getArtistGenresBatch(missingIDs[start:end])
		if err != nil {
			continue
		}

		for i := range response.Items {
			if len(response.Items[i].Genres) > 0 || response.Items[i].ID == "" {
				continue
			}

			if genres := genresByID[response.Items[i].ID]; len(genres) > 0 {
				response.Items[i].Genres = genres
			}
		}
	}
}

func (sc *SpotifyClient) getArtistGenresBatch(artistIDs []string) (map[string][]string, error) {
	normalizedIDs := make([]string, 0, len(artistIDs))
	seen := make(map[string]struct{}, len(artistIDs))
	genresByID := make(map[string][]string, len(artistIDs))
	for _, artistID := range artistIDs {
		normalized := strings.TrimSpace(artistID)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}

		seen[normalized] = struct{}{}
		cacheKey := globalResourceCacheKey("artist-genres-id:" + normalized)
		if cached, ok := sharedSpotifyCache.getFresh(cacheKey); ok {
			if genres, ok := cached.([]string); ok {
				genresByID[normalized] = genres
				continue
			}
		}

		normalizedIDs = append(normalizedIDs, normalized)
	}

	if len(normalizedIDs) == 0 {
		return genresByID, nil
	}

	requestURL := "https://api.spotify.com/v1/artists?ids=" + strings.Join(normalizedIDs, ",")
	body, _, err := sc.doRequest("artist-details-batch", http.MethodGet, requestURL, nil, nil)
	if err != nil {
		return nil, err
	}

	var response SpotifyArtistsLookupResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	for _, artist := range response.Artists {
		if artist.ID == "" {
			continue
		}

		cacheKey := globalResourceCacheKey("artist-genres-id:" + artist.ID)
		sharedSpotifyCache.set(cacheKey, artist.Genres, artistLookupTTL)

		if len(artist.Genres) == 0 {
			continue
		}

		genresByID[artist.ID] = artist.Genres
	}

	return genresByID, nil
}
