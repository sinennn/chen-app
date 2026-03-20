package friends

import (
	"chen/pkg/supabase"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Friend struct {
	ID            string        `json:"id"`
	Username      string        `json:"username"`
	AvatarID      string        `json:"avatar_id"`
	Compatibility int           `json:"compatibility"`
	IsOnline      bool          `json:"is_online"`
	CurrentTrack  *ActivityItem `json:"current_track,omitempty"`
}

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

type AddFriendRequest struct {
	Username string `json:"username" binding:"required"`
}

type FriendshipActionRequest struct {
	FriendshipID string `json:"friendship_id" binding:"required"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", getFriends)
	rg.POST("/add", addFriend)
	rg.POST("/accept", acceptFriend)
	rg.POST("/decline", declineFriend)
}

func getFriends(c *gin.Context) {
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

	// For now, return empty friends list since tables don't exist yet
	// TODO: Create database tables and implement proper friends logic
	fmt.Printf("Friends requested for user: %s\n", userIDStr)

	friends := []Friend{}
	c.JSON(http.StatusOK, friends)
}

func addFriend(c *gin.Context) {
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

	var req AddFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Find user by username
	userData, _, err := client.From("users").
		Select("id", "", false).
		Eq("username", req.Username).
		Execute()

	if err != nil {
		log.Printf("Error finding user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find user"})
		return
	}

	var users []map[string]interface{}
	if err := json.Unmarshal(userData, &users); err != nil || len(users) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	friendID, _ := users[0]["id"].(string)

	// Check if friendship already exists
	existingData, _, _ := client.From("friendships").
		Select("id", "", false).
		Or(fmt.Sprintf("and(requester_id.eq.%s,addressee_id.eq.%s),and(requester_id.eq.%s,addressee_id.eq.%s)",
			userIDStr, friendID, friendID, userIDStr), "").
		Execute()

	var existing []map[string]interface{}
	if json.Unmarshal(existingData, &existing) == nil && len(existing) > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Friendship already exists"})
		return
	}

	// Insert friendship request using correct column names
	_, _, err = client.From("friendships").Insert(map[string]interface{}{
		"requester_id": userIDStr,
		"addressee_id": friendID,
		"status":       "pending",
	}, false, "", "", "").Execute()

	if err != nil {
		log.Printf("Error creating friendship: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send friend request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request sent successfully"})
}

func acceptFriend(c *gin.Context) {
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

	var req FriendshipActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	_, _, err := client.From("friendships").
		Update(map[string]interface{}{"status": "accepted"}, "", "").
		Eq("id", req.FriendshipID).
		Eq("addressee_id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error accepting friendship: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept friend request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request accepted"})
}

func declineFriend(c *gin.Context) {
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

	var req FriendshipActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	_, _, err := client.From("friendships").
		Delete("", "").
		Eq("id", req.FriendshipID).
		Eq("addressee_id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error declining friendship: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decline friend request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request declined"})
}
