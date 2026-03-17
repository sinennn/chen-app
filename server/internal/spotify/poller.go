package spotify

import (
	"chen/pkg/supabase"
	"encoding/json"
	"log"
	"time"
)

func StartPoller() {
	log.Println("Starting Spotify polling service...")

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			pollAllUsers()
		}
	}
}

func pollAllUsers() {
	client := supabase.GetClient()

	// Get all users with valid (non-expired) Spotify tokens
	data, _, err := client.From("spotify_connections").
		Select("user_id,access_token,refresh_token,expires_at", "", false).
		Gt("expires_at", time.Now().Format(time.RFC3339)).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connections: %v", err)
		return
	}

	// Parse the JSON response
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

		// Poll this user's currently playing track
		if err := pollUserActivity(userID, accessToken); err != nil {
			log.Printf("Error polling user %s: %v", userID, err)
			continue
		}
	}
}

func pollUserActivity(userID, accessToken string) error {
	spotifyClient := NewSpotifyClient(accessToken)

	// Get currently playing track
	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		return err
	}

	// If nothing is playing or no track info, skip
	if !track.IsPlaying || track.Name == "" {
		return nil
	}

	// Check if this is different from the last activity
	client := supabase.GetClient()
	data, _, err := client.From("listening_activity").
		Select("track_name,artist_name", "", false).
		Eq("user_id", userID).
		Order("started_at", nil).
		Limit(1, "").
		Execute()

	if err != nil {
		log.Printf("Error fetching last activity for user %s: %v", userID, err)
		// Continue anyway, we'll just insert the new activity
	}

	// Parse the JSON response
	var lastActivities []map[string]interface{}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &lastActivities); err != nil {
			log.Printf("Error parsing last activity for user %s: %v", userID, err)
		}
	}

	// Check if this track is different from the last one
	shouldInsert := true
	if len(lastActivities) > 0 {
		lastTrack, trackOk := lastActivities[0]["track_name"].(string)
		lastArtist, artistOk := lastActivities[0]["artist_name"].(string)

		if trackOk && artistOk && lastTrack == track.Name && lastArtist == track.Artist {
			shouldInsert = false
		}
	}

	if shouldInsert {
		// Insert new listening activity
		_, _, err = client.From("listening_activity").Insert(map[string]interface{}{
			"user_id":       userID,
			"track_name":    track.Name,
			"artist_name":   track.Artist,
			"album_name":    track.Album,
			"album_art_url": track.AlbumArt,
			"platform":      "spotify",
			"started_at":    time.Now().Format(time.RFC3339),
		}, false, "", "", "").Execute()

		if err != nil {
			return err
		}

		log.Printf("Recorded new activity for user %s: %s - %s", userID, track.Artist, track.Name)
	}

	return nil
}
