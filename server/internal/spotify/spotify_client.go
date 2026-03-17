package spotify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type SpotifyClient struct {
	AccessToken string
	HTTPClient  *http.Client
}

type Track struct {
	Name      string `json:"name"`
	Artist    string `json:"artist"`
	Album     string `json:"album"`
	AlbumArt  string `json:"album_art_url"`
	IsPlaying bool   `json:"is_playing"`
}

type CurrentlyPlayingResponse struct {
	IsPlaying bool `json:"is_playing"`
	Item      struct {
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
		// No content - nothing is playing
		return &Track{IsPlaying: false}, nil
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("spotify API error: %d", resp.StatusCode)
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
		IsPlaying: spotifyResp.IsPlaying,
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
	req, err := http.NewRequest("GET", "https://api.spotify.com/v1/me/player/recently-played?limit=10", nil)
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
		return nil, fmt.Errorf("spotify API error: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var spotifyResp RecentlyPlayedResponse
	if err := json.Unmarshal(body, &spotifyResp); err != nil {
		return nil, err
	}

	tracks := make([]Track, len(spotifyResp.Items))
	for i, item := range spotifyResp.Items {
		tracks[i] = Track{
			Name:  item.Track.Name,
			Album: item.Track.Album.Name,
		}

		if len(item.Track.Artists) > 0 {
			tracks[i].Artist = item.Track.Artists[0].Name
		}

		if len(item.Track.Album.Images) > 0 {
			tracks[i].AlbumArt = item.Track.Album.Images[0].URL
		}
	}

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
		return nil, fmt.Errorf("token refresh failed: %d", resp.StatusCode)
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
