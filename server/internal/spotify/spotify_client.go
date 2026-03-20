package spotify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"
)

// cacheTTL defines how long each endpoint's response is cached.
var cacheTTL = map[string]time.Duration{
	"recently-played": 30 * time.Second,
}

const topDataTTL = 24 * time.Hour

type cacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

type SpotifyClient struct {
	AccessToken string
	HTTPClient  *http.Client
	cache       map[string]cacheEntry
	cacheMu     sync.RWMutex
}

type Track struct {
	Name       string `json:"name"`
	Artist     string `json:"artist"`
	Album      string `json:"album"`
	AlbumArt   string `json:"album_art_url"`
	IsPlaying  bool   `json:"is_playing"`
	ProgressMs int    `json:"progress_ms,omitempty"`
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

// SpotifyRateLimitError is returned when Spotify responds with 429.
// RetryAfter tells the caller how long to wait before retrying.
type SpotifyRateLimitError struct {
	RetryAfter time.Duration
}

func (e *SpotifyRateLimitError) Error() string {
	return fmt.Sprintf("Rate limit exceeded — retry after %s", e.RetryAfter.Round(time.Second))
}

// SpotifyAPIError is returned for all non-429 non-2xx Spotify responses.
type SpotifyAPIError struct {
	StatusCode int
	Endpoint   string
	Message    string
}

func (e *SpotifyAPIError) Error() string {
	return fmt.Sprintf("Spotify API error [%d] at %s: %s", e.StatusCode, e.Endpoint, e.Message)
}

type UserPlaylistsResponse struct {
	Items []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"items"`
}

type PlaylistTracksResponse struct {
	Items []struct {
		Track struct {
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
		} `json:"track"`
	} `json:"items"`
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
		} `json:"track"`
		PlayedAt string `json:"played_at"`
	} `json:"items"`
}

type TopTracksResponse struct {
	Items []struct {
		Name       string `json:"name"`
		DurationMs int    `json:"duration_ms"`
		Album      struct {
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

func NewSpotifyClient(accessToken string) *SpotifyClient {
	return &SpotifyClient{
		AccessToken: accessToken,
		HTTPClient:  &http.Client{Timeout: 10 * time.Second},
		cache:       make(map[string]cacheEntry),
	}
}

func (sc *SpotifyClient) cacheGet(key string) (interface{}, bool) {
	sc.cacheMu.RLock()
	defer sc.cacheMu.RUnlock()
	entry, ok := sc.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func (sc *SpotifyClient) cacheSet(key string, data interface{}, ttl time.Duration) {
	sc.cacheMu.Lock()
	defer sc.cacheMu.Unlock()
	sc.cache[key] = cacheEntry{
		data:      data,
		expiresAt: time.Now().Add(ttl),
	}
}

func (sc *SpotifyClient) GetCurrentlyPlaying() (*Track, error) {
	req, err := http.NewRequest("GET", "https://api.spotify.com/v1/me/player/currently-playing", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+sc.AccessToken)

	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 204 {
		return &Track{IsPlaying: false}, nil
	}

	if resp.StatusCode != 200 {
		return nil, handleSpotifyAPIError(resp, "currently-playing")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var spotifyResp CurrentlyPlayingResponse
	if err := json.Unmarshal(body, &spotifyResp); err != nil {
		return nil, err
	}

	track := &Track{
		IsPlaying:  spotifyResp.IsPlaying,
		ProgressMs: spotifyResp.ProgressMs,
	}

	if spotifyResp.Item.Name != "" {
		track.Name = spotifyResp.Item.Name
		track.Album = spotifyResp.Item.Album.Name

		if len(spotifyResp.Item.Artists) > 0 {
			track.Artist = spotifyResp.Item.Artists[0].Name
		}

		if len(spotifyResp.Item.Album.Images) > 0 {
			track.AlbumArt = spotifyResp.Item.Album.Images[0].URL
		}
	}

	return track, nil
}

func (sc *SpotifyClient) GetRecentlyPlayed() ([]Track, error) {
	const cacheKey = "recently-played"

	if cached, ok := sc.cacheGet(cacheKey); ok {
		return cached.([]Track), nil
	}

	req, err := http.NewRequest("GET", "https://api.spotify.com/v1/me/player/recently-played?limit=50", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+sc.AccessToken)

	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, handleSpotifyAPIError(resp, "recently-played")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var spotifyResp RecentlyPlayedResponse
	if err := json.Unmarshal(body, &spotifyResp); err != nil {
		return nil, err
	}

	tracks := make([]Track, 0, len(spotifyResp.Items))
	for _, item := range spotifyResp.Items {
		if item.Track.Name == "" || len(item.Track.Artists) == 0 {
			continue
		}

		track := Track{
			Name:     item.Track.Name,
			Album:    item.Track.Album.Name,
			Artist:   item.Track.Artists[0].Name,
			PlayedAt: item.PlayedAt,
		}

		if len(item.Track.Album.Images) > 0 {
			track.AlbumArt = item.Track.Album.Images[0].URL
		}

		tracks = append(tracks, track)
	}

	sc.cacheSet(cacheKey, tracks, cacheTTL["recently-played"])
	return tracks, nil
}

func (sc *SpotifyClient) RefreshToken(refreshToken string) (*TokenResponse, error) {
	clientID := os.Getenv("SPOTIFY_CLIENT_ID")
	clientSecret := os.Getenv("SPOTIFY_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("spotify client credentials not configured")
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequest("POST", "https://accounts.spotify.com/api/token", bytes.NewBufferString(data.Encode()))
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

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		// Parse error response if available
		var errorResp struct {
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		json.Unmarshal(body, &errorResp)

		errorMsg := string(body)
		if errorResp.Error != "" {
			errorMsg = fmt.Sprintf("%s: %s", errorResp.Error, errorResp.ErrorDescription)
		}

		return nil, fmt.Errorf("token refresh failed: %d - %s", resp.StatusCode, errorMsg)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

func (sc *SpotifyClient) GetTopTracks(timeRange string) ([]TopTrack, error) {
	if timeRange == "" {
		timeRange = "long_term"
	}

	cacheKey := "top-tracks-" + timeRange

	if cached, ok := sc.cacheGet(cacheKey); ok {
		return cached.([]TopTrack), nil
	}

	apiURL := fmt.Sprintf("https://api.spotify.com/v1/me/top/tracks?time_range=%s&limit=50", timeRange)
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+sc.AccessToken)

	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, handleSpotifyAPIError(resp, "top-tracks")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var spotifyResp TopTracksResponse
	if err := json.Unmarshal(body, &spotifyResp); err != nil {
		return nil, err
	}

	topArtists, err := sc.GetTopArtists(timeRange)
	if err != nil {
		topArtists = []TopArtist{}
	}

	artistGenres := make(map[string][]string, len(topArtists))
	for _, a := range topArtists {
		artistGenres[a.Name] = a.Genres
	}

	tracks := make([]TopTrack, 0, len(spotifyResp.Items))
	for i, item := range spotifyResp.Items {
		if item.Name == "" || len(item.Artists) == 0 {
			continue
		}

		artistName := item.Artists[0].Name
		track := TopTrack{
			Name:   item.Name,
			Album:  item.Album.Name,
			Artist: artistName,
			Rank:   i + 1,
			Genres: artistGenres[artistName],
		}

		if len(item.Album.Images) > 0 {
			track.AlbumArt = item.Album.Images[0].URL
		}

		tracks = append(tracks, track)
	}

	sc.cacheSet(cacheKey, tracks, topDataTTL)
	return tracks, nil
}

func (sc *SpotifyClient) GetTopArtists(timeRange string) ([]TopArtist, error) {
	if timeRange == "" {
		timeRange = "long_term"
	}

	cacheKey := "top-artists-" + timeRange

	if cached, ok := sc.cacheGet(cacheKey); ok {
		return cached.([]TopArtist), nil
	}

	apiURL := fmt.Sprintf("https://api.spotify.com/v1/me/top/artists?time_range=%s&limit=50", timeRange)
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+sc.AccessToken)

	resp, err := sc.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, handleSpotifyAPIError(resp, "top-artists")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var spotifyResp TopArtistsResponse
	if err := json.Unmarshal(body, &spotifyResp); err != nil {
		return nil, err
	}

	artists := make([]TopArtist, 0, len(spotifyResp.Items))
	for i, item := range spotifyResp.Items {
		if item.Name == "" {
			continue
		}

		artist := TopArtist{
			Name:   item.Name,
			Rank:   i + 1,
			Genres: item.Genres,
		}

		if len(item.Images) > 0 {
			artist.ImageURL = item.Images[0].URL
		}

		artists = append(artists, artist)
	}

	sc.cacheSet(cacheKey, artists, topDataTTL)
	return artists, nil
}

func (sc *SpotifyClient) GetOnRepeatTracks() ([]PlaylistTrack, error) {
	topTracks, err := sc.GetTopTracks("long_term")
	if err != nil {
		return nil, err
	}

	tracks := make([]PlaylistTrack, 0, len(topTracks))
	for _, t := range topTracks {
		tracks = append(tracks, PlaylistTrack{
			Name:     t.Name,
			Artist:   t.Artist,
			Album:    t.Album,
			AlbumArt: t.AlbumArt,
			Rank:     t.Rank,
		})
	}

	return tracks, nil
}
