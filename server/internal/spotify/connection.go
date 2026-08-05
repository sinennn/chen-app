package spotify

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"chen/pkg/supabase"
)

var ErrNoSpotifyConnection = errors.New("spotify connection not found")

func ExchangeAuthorizationCode(code, redirectURI string) (*TokenResponse, error) {
	clientID := os.Getenv("SPOTIFY_CLIENT_ID")
	clientSecret := os.Getenv("SPOTIFY_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("spotify client credentials not configured on server")
	}

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequest(http.MethodPost, "https://accounts.spotify.com/api/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to build spotify token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(clientID, clientSecret)

	httpClient := &http.Client{Timeout: 15 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("spotify token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read spotify token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var spotifyErr struct {
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		if jsonErr := json.Unmarshal(body, &spotifyErr); jsonErr == nil && spotifyErr.ErrorDescription != "" {
			return nil, fmt.Errorf("spotify token exchange: %s", spotifyErr.ErrorDescription)
		}
		return nil, fmt.Errorf("spotify token exchange failed with status %d", resp.StatusCode)
	}

	var token TokenResponse
	if err := json.Unmarshal(body, &token); err != nil {
		return nil, fmt.Errorf("failed to parse spotify token response: %w", err)
	}

	if token.AccessToken == "" {
		return nil, fmt.Errorf("spotify returned empty access token")
	}

	return &token, nil
}

type Connection struct {
	UserID       string
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

func GetAuthorizedClient(userID string) (*SpotifyClient, *Connection, error) {
	conn, err := getConnection(userID)
	if err != nil {
		return nil, nil, err
	}

	if shouldRefreshConnection(conn) {
		refreshedConn, refreshErr := refreshConnection(conn)
		if refreshErr != nil {
			if IsRateLimitError(refreshErr) && tokenStillUsable(conn) {
				return NewSpotifyClient(conn.UserID, conn.AccessToken), conn, nil
			}
			return nil, nil, refreshErr
		}

		conn = refreshedConn
	}

	return NewSpotifyClient(conn.UserID, conn.AccessToken), conn, nil
}

func shouldRefreshConnection(conn *Connection) bool {
	return conn != nil &&
		!conn.ExpiresAt.IsZero() &&
		time.Now().After(conn.ExpiresAt.Add(-5*time.Minute))
}

func tokenStillUsable(conn *Connection) bool {
	return conn != nil &&
		conn.AccessToken != "" &&
		(conn.ExpiresAt.IsZero() || time.Now().Before(conn.ExpiresAt))
}

func refreshConnection(conn *Connection) (*Connection, error) {
	value, err, _ := tokenRefreshGroup.Do(conn.UserID, func() (any, error) {
		latestConn, err := getConnection(conn.UserID)
		if err != nil {
			return nil, err
		}

		if !shouldRefreshConnection(latestConn) {
			return latestConn, nil
		}

		client := NewSpotifyClient(latestConn.UserID, latestConn.AccessToken)
		refreshed, err := client.RefreshToken(latestConn.RefreshToken)
		if err != nil {
			if IsRateLimitError(err) && tokenStillUsable(latestConn) {
				return latestConn, nil
			}
			return nil, err
		}

		latestConn.AccessToken = refreshed.AccessToken
		latestConn.ExpiresAt = time.Now().Add(time.Duration(refreshed.ExpiresIn) * time.Second)
		if refreshed.RefreshToken != "" {
			latestConn.RefreshToken = refreshed.RefreshToken
		}

		if err := saveConnection(latestConn); err != nil {
			return nil, err
		}

		return latestConn, nil
	})
	if err != nil {
		return nil, err
	}

	return value.(*Connection), nil
}

func getConnection(userID string) (*Connection, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, errors.New("database connection failed")
	}

	data, _, err := client.From("spotify_connections").
		Select("user_id,access_token,refresh_token,expires_at", "", false).
		Eq("user_id", userID).
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrNoSpotifyConnection
	}

	row := rows[0]
	conn := &Connection{
		UserID:       toString(row["user_id"]),
		AccessToken:  toString(row["access_token"]),
		RefreshToken: toString(row["refresh_token"]),
	}

	if expiresAt := toString(row["expires_at"]); expiresAt != "" {
		conn.ExpiresAt, _ = time.Parse(time.RFC3339, expiresAt)
	}

	if conn.AccessToken == "" {
		return nil, ErrNoSpotifyConnection
	}

	return conn, nil
}

func saveConnection(conn *Connection) error {
	client := supabase.GetClient()
	if client == nil {
		return errors.New("database connection failed")
	}

	update := map[string]any{
		"access_token": conn.AccessToken,
		"expires_at":   conn.ExpiresAt.Format(time.RFC3339),
	}
	if conn.RefreshToken != "" {
		update["refresh_token"] = conn.RefreshToken
	}

	_, _, err := client.From("spotify_connections").
		Update(update, "", "").
		Eq("user_id", conn.UserID).
		Execute()
	return err
}

func toString(value any) string {
	if value == nil {
		return ""
	}

	return fmt.Sprintf("%v", value)
}
