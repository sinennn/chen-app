package spotify

import (
	"chen/pkg/supabase"
	"encoding/json"
	"log"
	"sync"
	"time"
)

type UserTrackCache struct {
	TrackName  string
	ArtistName string
	AlbumName  string
	IsPlaying  bool
	LastUpdate time.Time
}

var (
	userCache  = make(map[string]*UserTrackCache)
	cacheMutex sync.RWMutex
)

func StartPoller() {
	log.Println("Starting Spotify real-time polling service...")

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		pollAllUsers()
	}
}

func pollAllUsers() {
	client := supabase.GetClient()

	// FIX: Removed the Gt("expires_at", ...) filter.
	// Previously, expired tokens were silently excluded — meaning once a token
	// expired it would never be refreshed and the user would never be polled again.
	// Now we fetch ALL connections and handle refresh inside pollUserActivity.
	data, _, err := client.From("spotify_connections").
		Select("user_id,access_token,refresh_token,expires_at", "", false).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connections: %v", err)
		return
	}

	var connections []map[string]interface{}
	if err := json.Unmarshal(data, &connections); err != nil {
		log.Printf("Error parsing Spotify connections: %v", err)
		return
	}

	log.Printf("Polling %d Spotify connections", len(connections))

	for _, conn := range connections {
		userID, ok := conn["user_id"].(string)
		if !ok {
			log.Printf("Invalid user_id in connection: %v", conn)
			continue
		}

		accessToken, ok := conn["access_token"].(string)
		if !ok {
			log.Printf("Invalid access_token for user %s", userID)
			continue
		}

		refreshToken, _ := conn["refresh_token"].(string)

		// Parse expires_at so we can proactively refresh before it hits 401
		var expiresAt time.Time
		if expiresAtStr, ok := conn["expires_at"].(string); ok {
			expiresAt, _ = time.Parse(time.RFC3339, expiresAtStr)
		}

		if err := pollUserActivity(userID, accessToken, refreshToken, expiresAt); err != nil {
			log.Printf("Error polling user %s: %v", userID, err)
			continue
		}
	}
}

// pollUserActivity polls a single user's currently playing track.
// FIX: Now accepts refreshToken + expiresAt so it can refresh expired tokens
// inline rather than skipping the user entirely.
func pollUserActivity(userID, accessToken, refreshToken string, expiresAt time.Time) error {
	// Proactively refresh if token is expired or within 5 minutes of expiring.
	// This prevents the 401 "Access token expired" errors seen in the logs.
	if !expiresAt.IsZero() && time.Now().After(expiresAt.Add(-5*time.Minute)) {
		log.Printf("Token for user %s is expired or expiring soon, refreshing...", userID)

		spotifyClient := NewSpotifyClient(accessToken)
		newToken, err := spotifyClient.RefreshToken(refreshToken)
		if err != nil {
			return err
		}

		accessToken = newToken.AccessToken
		newExpiresAt := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)

		// Persist the refreshed token back to the database
		updateData := map[string]interface{}{
			"access_token": newToken.AccessToken,
			"expires_at":   newExpiresAt.Format(time.RFC3339),
		}
		// Only update refresh_token if Spotify returned a new one
		if newToken.RefreshToken != "" {
			updateData["refresh_token"] = newToken.RefreshToken
		}

		_, _, err = supabase.GetClient().From("spotify_connections").
			Update(updateData, "", "").
			Eq("user_id", userID).
			Execute()
		if err != nil {
			// Non-fatal: we still have the new access token in memory, log and continue
			log.Printf("Warning: failed to persist refreshed token for user %s: %v", userID, err)
		} else {
			log.Printf("Successfully refreshed token for user %s", userID)
		}
	}

	spotifyClient := NewSpotifyClient(accessToken)

	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		return err
	}

	cacheMutex.RLock()
	lastTrack, exists := userCache[userID]
	cacheMutex.RUnlock()

	shouldInsert := false

	if !exists {
		shouldInsert = track.IsPlaying && track.Name != ""
	} else {
		trackChanged := lastTrack.TrackName != track.Name ||
			lastTrack.ArtistName != track.Artist ||
			lastTrack.AlbumName != track.Album

		playbackStateChanged := lastTrack.IsPlaying != track.IsPlaying

		shouldInsert = trackChanged || (playbackStateChanged && track.IsPlaying && track.Name != "")
	}

	cacheMutex.Lock()
	userCache[userID] = &UserTrackCache{
		TrackName:  track.Name,
		ArtistName: track.Artist,
		AlbumName:  track.Album,
		IsPlaying:  track.IsPlaying,
		LastUpdate: time.Now(),
	}
	cacheMutex.Unlock()

	if shouldInsert {
		client := supabase.GetClient()

		activityData := map[string]interface{}{
			"user_id":       userID,
			"track_name":    track.Name,
			"artist_name":   track.Artist,
			"album_name":    track.Album,
			"album_art_url": track.AlbumArt,
			"is_playing":    track.IsPlaying,
			"progress_ms":   track.ProgressMs,
			"played_at":     time.Now().Format(time.RFC3339),
			"platform":      "spotify",
		}

		_, _, err = client.From("listening_activity").Insert(activityData, false, "", "", "").Execute()
		if err != nil {
			return err
		}

		log.Printf("Recorded activity for user %s: %s - %s (playing: %v)",
			userID, track.Artist, track.Name, track.IsPlaying)
	}

	return nil
}

// StoreRecentlyPlayed fetches and stores recently played tracks to avoid duplicates.
func StoreRecentlyPlayed(userID, accessToken string) error {
	spotifyClient := NewSpotifyClient(accessToken)

	tracks, err := spotifyClient.GetRecentlyPlayed()
	if err != nil {
		return err
	}

	client := supabase.GetClient()

	for _, track := range tracks {
		data, _, err := client.From("listening_activity").
			Select("id", "", false).
			Eq("user_id", userID).
			Eq("track_name", track.Name).
			Eq("artist_name", track.Artist).
			Eq("played_at", track.PlayedAt).
			Execute()

		if err != nil {
			log.Printf("Error checking for duplicate: %v", err)
			continue
		}

		if len(data) > 0 {
			continue
		}

		activityData := map[string]interface{}{
			"user_id":       userID,
			"track_name":    track.Name,
			"artist_name":   track.Artist,
			"album_name":    track.Album,
			"album_art_url": track.AlbumArt,
			"is_playing":    false,
			"played_at":     track.PlayedAt,
			"platform":      "spotify",
		}

		_, _, err = client.From("listening_activity").Insert(activityData, false, "", "", "").Execute()
		if err != nil {
			log.Printf("Error storing recent track: %v", err)
			continue
		}
	}

	return nil
}