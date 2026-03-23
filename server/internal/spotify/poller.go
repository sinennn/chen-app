package spotify

import (
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"chen/pkg/supabase"

	"github.com/supabase-community/postgrest-go"
)

type UserTrackCache struct {
	TrackName       string
	ArtistName      string
	AlbumName       string
	IsPlaying       bool
	LastUpdate      time.Time
	PollInterval    time.Duration
	NextPollAt      time.Time
	ConsecutiveIdle int
}

var (
	userCache  = make(map[string]*UserTrackCache)
	cacheMutex sync.RWMutex
)

func StartPoller() {
	log.Println("Starting Spotify real-time polling service...")

	ticker := time.NewTicker(pollerTickInterval)
	defer ticker.Stop()

	for range ticker.C {
		pollAllUsers()
	}
}

func pollAllUsers() {
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("user_id", "", false).
		Execute()
	if err != nil {
		log.Printf("Error fetching Spotify connections: %v", err)
		return
	}

	var connections []map[string]any
	if err := json.Unmarshal(data, &connections); err != nil {
		log.Printf("Error parsing Spotify connections: %v", err)
		return
	}

	for _, conn := range connections {
		userID := toString(conn["user_id"])
		if userID == "" {
			continue
		}
		if !shouldPollUser(userID, time.Now()) {
			continue
		}

		if err := pollUserActivity(userID); err != nil {
			log.Printf("Error polling user %s: %v", userID, err)
			continue
		}
	}
}

func pollUserActivity(userID string) error {
	now := time.Now()
	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			return nil
		}
		if IsRateLimitError(err) {
			recordRateLimitedPoll(userID, RetryAfter(err))
			return nil
		}
		return err
	}

	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		if IsRateLimitError(err) {
			recordRateLimitedPoll(userID, RetryAfter(err))
			return nil
		}
		return err
	}

	cacheMutex.Lock()
	state, exists := userCache[userID]
	if !exists || state == nil {
		state = &UserTrackCache{}
	}
	previousState := *state

	trackChanged := state.TrackName != track.Name ||
		state.ArtistName != track.Artist ||
		state.AlbumName != track.Album
	playbackStateChanged := state.IsPlaying != track.IsPlaying
	shouldInsert := (!exists && track.IsPlaying && track.Name != "") ||
		(trackChanged || (playbackStateChanged && track.IsPlaying && track.Name != ""))

	state.TrackName = track.Name
	state.ArtistName = track.Artist
	state.AlbumName = track.Album
	state.IsPlaying = track.IsPlaying
	state.LastUpdate = now
	if track.IsPlaying && track.Name != "" {
		state.ConsecutiveIdle = 0
		state.PollInterval = activePollInterval
	} else {
		state.ConsecutiveIdle++
		state.PollInterval = nextIdlePollInterval(state.ConsecutiveIdle)
	}
	state.NextPollAt = now.Add(state.PollInterval)
	userCache[userID] = state
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
	} else if exists && previousState.IsPlaying != track.IsPlaying {
		// Update the most recent activity for this user if playback state changed
		client := supabase.GetClient()

		updateData := map[string]interface{}{
			"is_playing": track.IsPlaying,
		}

		// If the song stopped playing, update the played_at to reflect when it stopped
		if !track.IsPlaying {
			updateData["played_at"] = time.Now().Format(time.RFC3339)
		}

		_, _, err := client.From("listening_activity").
			Update(updateData, "", "").
			Eq("user_id", userID).
			Order("played_at", &postgrest.OrderOpts{Ascending: false}).
			Limit(1, "").
			Execute()

		if err != nil {
			log.Printf("Error updating playback state for user %s: %v", userID, err)
		} else {
			log.Printf("Updated playback state for user %s: %s - %s (playing: %v)",
				userID, track.Artist, track.Name, track.IsPlaying)
		}
	}

	return nil
}

func shouldPollUser(userID string, now time.Time) bool {
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()

	state, ok := userCache[userID]
	if !ok || state == nil || state.NextPollAt.IsZero() {
		return true
	}

	return !state.NextPollAt.After(now)
}

func recordRateLimitedPoll(userID string, retryAfter time.Duration) {
	if retryAfter <= 0 {
		retryAfter = defaultSpotifyRateLimitCooldown
	}

	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	state, ok := userCache[userID]
	if !ok || state == nil {
		state = &UserTrackCache{}
	}

	nextInterval := retryAfter + spotifyRateLimitBuffer
	if nextInterval < rateLimitedPollFloor {
		nextInterval = rateLimitedPollFloor
	}
	if state.PollInterval > 0 && nextInterval < state.PollInterval*2 {
		nextInterval = state.PollInterval * 2
	}
	if nextInterval > rateLimitedPollCeiling {
		nextInterval = rateLimitedPollCeiling
	}

	state.PollInterval = nextInterval
	state.NextPollAt = time.Now().Add(nextInterval)
	state.LastUpdate = time.Now()
	userCache[userID] = state
}

func nextIdlePollInterval(consecutiveIdle int) time.Duration {
	if consecutiveIdle <= 0 {
		return idleBasePollInterval
	}

	interval := idleBasePollInterval
	for step := 1; step < consecutiveIdle; step++ {
		interval *= 2
		if interval >= idleMaxPollInterval {
			return idleMaxPollInterval
		}
	}

	if interval > idleMaxPollInterval {
		return idleMaxPollInterval
	}

	return interval
}

// StoreRecentlyPlayed fetches and stores recently played tracks to avoid duplicates.
func StoreRecentlyPlayed(userID, accessToken string) error {
	spotifyClient := NewSpotifyClient(userID, accessToken)

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
