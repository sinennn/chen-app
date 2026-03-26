package activity

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chen/internal/spotify"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
	"github.com/supabase-community/postgrest-go"
	supabaseapi "github.com/supabase-community/supabase-go"
)

type ActivityItem struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	AvatarID    string    `json:"avatar_id"`
	TrackID     string    `json:"track_id,omitempty"`
	TrackName   string    `json:"track_name"`
	ArtistName  string    `json:"artist_name"`
	AlbumName   string    `json:"album_name"`
	AlbumArtURL string    `json:"album_art_url"`
	SpotifyURL  string    `json:"spotify_url,omitempty"`
	PreviewURL  string    `json:"preview_url,omitempty"`
	Platform    string    `json:"platform"`
	StartedAt   time.Time `json:"started_at"`
	PlayedAt    time.Time `json:"played_at"`
	IsPlaying   bool      `json:"is_playing"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/feed", getFeed)
}

func getFeed(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	refreshFeedUsers([]string{userIDStr})
	activityQuery := `
		id,
		user_id,
		track_id,
		track_name,
		artist_name,
		album_name,
		album_art_url,
		spotify_url,
		preview_url,
		platform,
		played_at,
		is_playing
	`

	data, _, err := selectListeningActivity(client, activityQuery)

	if err != nil {
		fmt.Printf("Error fetching global feed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch feed"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, []ActivityItem{})
		return
	}

	// Parse the response
	var activities []map[string]interface{}
	if err := json.Unmarshal(data, &activities); err != nil {
		fmt.Printf("Error parsing feed data: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse feed data"})
		return
	}

	activityUserIDs := make([]string, 0, len(activities))
	for _, activity := range activities {
		activityUserID := toString(activity["user_id"])
		if activityUserID == "" {
			continue
		}
		activityUserIDs = append(activityUserIDs, activityUserID)
	}

	userData, _, err := client.From("users").
		Select("id, username, avatar_id", "", false).
		In("id", uniqueStrings(activityUserIDs)).
		Execute()
	if err != nil {
		fmt.Printf("Error fetching users for feed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch feed users"})
		return
	}

	var users []map[string]interface{}
	if err := json.Unmarshal(userData, &users); err != nil {
		fmt.Printf("Error parsing feed users: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse feed users"})
		return
	}

	userMap := make(map[string]map[string]interface{}, len(users))
	for _, user := range users {
		userMap[fmt.Sprintf("%v", user["id"])] = user
	}

	var feedItems []ActivityItem
	for _, activity := range activities {
		playedAtStr, _ := activity["played_at"].(string)
		playedAt, _ := time.Parse(time.RFC3339, playedAtStr)

		userInfo, ok := userMap[fmt.Sprintf("%v", activity["user_id"])]
		if !ok {
			continue
		}

		feedItem := ActivityItem{
			ID:          fmt.Sprintf("%v", activity["id"]),
			UserID:      fmt.Sprintf("%v", activity["user_id"]),
			Username:    toString(userInfo["username"]),
			AvatarID:    toString(userInfo["avatar_id"]),
			TrackID:     toString(activity["track_id"]),
			TrackName:   fmt.Sprintf("%v", activity["track_name"]),
			ArtistName:  fmt.Sprintf("%v", activity["artist_name"]),
			AlbumName:   fmt.Sprintf("%v", activity["album_name"]),
			AlbumArtURL: fmt.Sprintf("%v", activity["album_art_url"]),
			SpotifyURL:  toString(activity["spotify_url"]),
			PreviewURL:  toString(activity["preview_url"]),
			Platform:    fmt.Sprintf("%v", activity["platform"]),
			StartedAt:   playedAt,
			PlayedAt:    playedAt,
			IsPlaying:   toBool(activity["is_playing"]),
		}

		feedItems = append(feedItems, feedItem)
	}

	hydrateFeedTrackMetadata(feedItems)

	fmt.Printf("Returning %d global feed items for user: %s\n", len(feedItems), userIDStr)
	c.JSON(http.StatusOK, feedItems)
}

func refreshFeedUsers(userIDs []string) {
	for _, visibleUserID := range userIDs {
		if err := spotify.PollUserActivityNow(visibleUserID); err != nil && !spotify.IsRateLimitError(err) {
			fmt.Printf("Error refreshing feed activity for user %s: %v\n", visibleUserID, err)
		}
	}
}

func hydrateFeedTrackMetadata(feedItems []ActivityItem) {
	trackCache := make(map[string]*spotify.Track)
	clientCache := make(map[string]*spotify.SpotifyClient)
	clientAttempted := make(map[string]struct{})

	for i := range feedItems {
		if feedItems[i].TrackID == "" {
			continue
		}
		if feedItems[i].PreviewURL != "" && feedItems[i].SpotifyURL != "" {
			continue
		}

		details, seen := trackCache[feedItems[i].TrackID]
		if !seen {
			if _, attempted := clientAttempted[feedItems[i].UserID]; !attempted {
				clientAttempted[feedItems[i].UserID] = struct{}{}

				spotifyClient, _, err := spotify.GetAuthorizedClient(feedItems[i].UserID)
				if err == nil {
					clientCache[feedItems[i].UserID] = spotifyClient
				}
			}

			spotifyClient := clientCache[feedItems[i].UserID]
			if spotifyClient == nil {
				trackCache[feedItems[i].TrackID] = nil
				continue
			}

			lookup, err := spotifyClient.GetTrackDetails(feedItems[i].TrackID)
			if err != nil {
				trackCache[feedItems[i].TrackID] = nil
				continue
			}

			details = lookup
			trackCache[feedItems[i].TrackID] = details
		}

		if details == nil {
			continue
		}
		if feedItems[i].PreviewURL == "" {
			feedItems[i].PreviewURL = details.PreviewURL
		}
		if feedItems[i].SpotifyURL == "" {
			feedItems[i].SpotifyURL = details.SpotifyURL
		}
		if feedItems[i].AlbumArtURL == "" {
			feedItems[i].AlbumArtURL = details.AlbumArt
		}
	}
}

func selectListeningActivity(client *supabaseapi.Client, query string) ([]byte, int64, error) {
	data, count, err := client.From("listening_activity").
		Select(query, "", false).
		Order("played_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(50, "").
		Execute()
	if err == nil || !isMissingListeningActivityMetadataSelectError(err) {
		return data, count, err
	}

	legacyQuery := `
		id,
		user_id,
		track_name,
		artist_name,
		album_name,
		album_art_url,
		platform,
		played_at,
		is_playing
	`

	return client.From("listening_activity").
		Select(legacyQuery, "", false).
		Order("played_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(50, "").
		Execute()
}

func isMissingListeningActivityMetadataSelectError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	if !strings.Contains(message, "listening_activity") {
		return false
	}

	return strings.Contains(message, "preview_url") ||
		strings.Contains(message, "spotify_url") ||
		strings.Contains(message, "track_id")
}

func toBool(value any) bool {
	result, ok := value.(bool)
	return ok && result
}

func toString(value any) string {
	if value == nil {
		return ""
	}

	return fmt.Sprintf("%v", value)
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}

		seen[value] = struct{}{}
		result = append(result, value)
	}

	return result
}
