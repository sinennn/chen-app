package activity

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
)

type ActivityItem struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	AvatarID    string    `json:"avatar_id"`
	TrackName   string    `json:"track_name"`
	ArtistName  string    `json:"artist_name"`
	AlbumName   string    `json:"album_name"`
	AlbumArtURL string    `json:"album_art_url"`
	Platform    string    `json:"platform"`
	StartedAt   time.Time `json:"started_at"`
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

	// Get global activity feed from all users
	// Use a more complex query to join with users table
	query := `
		listening_activity.id,
		listening_activity.user_id,
		listening_activity.track_name,
		listening_activity.artist_name,
		listening_activity.album_name,
		listening_activity.album_art_url,
		listening_activity.platform,
		listening_activity.played_at,
		listening_activity.is_playing,
		users!inner(username, avatar_id)
	`

	data, _, err := client.From("listening_activity").
		Select(query, "", false).
		Order("played_at", nil).
		Limit(50, "").
		Execute()

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

	// Convert to ActivityItem structs
	var feedItems []ActivityItem
	for _, activity := range activities {
		// Parse the timestamp
		playedAtStr, _ := activity["played_at"].(string)
		playedAt, _ := time.Parse(time.RFC3339, playedAtStr)

		// Extract user info from nested users object
		var username, avatarID string
		if users, ok := activity["users"].(map[string]interface{}); ok {
			username = fmt.Sprintf("%v", users["username"])
			avatarID = fmt.Sprintf("%v", users["avatar_id"])
		}

		feedItem := ActivityItem{
			ID:          fmt.Sprintf("%v", activity["id"]),
			UserID:      fmt.Sprintf("%v", activity["user_id"]),
			Username:    username,
			AvatarID:    avatarID,
			TrackName:   fmt.Sprintf("%v", activity["track_name"]),
			ArtistName:  fmt.Sprintf("%v", activity["artist_name"]),
			AlbumName:   fmt.Sprintf("%v", activity["album_name"]),
			AlbumArtURL: fmt.Sprintf("%v", activity["album_art_url"]),
			Platform:    fmt.Sprintf("%v", activity["platform"]),
			StartedAt:   playedAt,
			IsPlaying:   activity["is_playing"].(bool),
		}

		feedItems = append(feedItems, feedItem)
	}

	fmt.Printf("Returning %d global feed items for user: %s\n", len(feedItems), userIDStr)
	c.JSON(http.StatusOK, feedItems)
}
