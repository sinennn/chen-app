package spotify

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"chen/pkg/supabase"
)

var ErrNoSpotifyConnection = errors.New("spotify connection not found")

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

	if !conn.ExpiresAt.IsZero() && time.Now().After(conn.ExpiresAt.Add(-5*time.Minute)) {
		client := NewSpotifyClient(userID, conn.AccessToken)
		refreshed, refreshErr := client.RefreshToken(conn.RefreshToken)
		if refreshErr != nil {
			return nil, nil, refreshErr
		}

		conn.AccessToken = refreshed.AccessToken
		conn.ExpiresAt = time.Now().Add(time.Duration(refreshed.ExpiresIn) * time.Second)
		if refreshed.RefreshToken != "" {
			conn.RefreshToken = refreshed.RefreshToken
		}

		if err := saveConnection(conn); err != nil {
			return nil, nil, err
		}
	}

	return NewSpotifyClient(conn.UserID, conn.AccessToken), conn, nil
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
