package activity

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"chen/internal/friends"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
	"github.com/supabase-community/postgrest-go"
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

	friendIDs, err := friends.GetAcceptedFriendIDs(userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve friends"})
		return
	}

	visibleUserIDs := append(friendIDs, userIDStr)
	activityQuery := `
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

	data, _, err := client.From("listening_activity").
		Select(activityQuery, "", false).
		In("user_id", visibleUserIDs).
		Order("played_at", &postgrest.OrderOpts{Ascending: false}).
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

	userData, _, err := client.From("users").
		Select("id, username, avatar_id", "", false).
		In("id", visibleUserIDs).
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
			TrackName:   fmt.Sprintf("%v", activity["track_name"]),
			ArtistName:  fmt.Sprintf("%v", activity["artist_name"]),
			AlbumName:   fmt.Sprintf("%v", activity["album_name"]),
			AlbumArtURL: fmt.Sprintf("%v", activity["album_art_url"]),
			Platform:    fmt.Sprintf("%v", activity["platform"]),
			StartedAt:   playedAt,
			PlayedAt:    playedAt,
			IsPlaying:   toBool(activity["is_playing"]),
		}

		feedItems = append(feedItems, feedItem)
	}

	fmt.Printf("Returning %d global feed items for user: %s\n", len(feedItems), userIDStr)
	c.JSON(http.StatusOK, feedItems)
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
