package spotify

import (
	"chen/internal/auth"
	"chen/pkg/supabase"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type ConnectRequest struct {
	AccessToken  string `json:"access_token" binding:"required"`
	RefreshToken string `json:"refresh_token" binding:"required"`
	ExpiresIn    int    `json:"expires_in" binding:"required"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/connect", handleConnect)
	rg.POST("/refresh", handleRefresh)
	rg.GET("/now-playing", handleNowPlaying)
	rg.GET("/recent", handleRecent)
}

func handleConnect(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	var req ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(time.Duration(req.ExpiresIn) * time.Second)

	// Store in Supabase
	client := supabase.GetClient()
	_, _, err := client.From("spotify_connections").Upsert(map[string]interface{}{
		"user_id":       userID,
		"access_token":  req.AccessToken,
		"refresh_token": req.RefreshToken,
		"expires_at":    expiresAt.Format(time.RFC3339),
	}, "", "", "").Execute()

	if err != nil {
		log.Printf("Error storing Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store connection"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Spotify connected successfully",
		"user_id": userID,
	})
}

func handleRefresh(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	// Get current connection from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("refresh_token", "", false).
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No Spotify connection found"})
		return
	}

	// Parse the JSON response
	var connections []map[string]interface{}
	if err := json.Unmarshal(data, &connections); err != nil {
		log.Printf("Error parsing Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse connection"})
		return
	}

	if len(connections) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No Spotify connection found"})
		return
	}

	refreshToken, ok := connections[0]["refresh_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid refresh token"})
		return
	}

	// Refresh the token
	spotifyClient := NewSpotifyClient("")
	tokenResp, err := spotifyClient.RefreshToken(refreshToken)
	if err != nil {
		log.Printf("Error refreshing Spotify token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh token"})
		return
	}

	// Update the database
	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	updateData := map[string]interface{}{
		"access_token": tokenResp.AccessToken,
		"expires_at":   expiresAt.Format(time.RFC3339),
	}

	// Update refresh token if provided
	if tokenResp.RefreshToken != "" {
		updateData["refresh_token"] = tokenResp.RefreshToken
	}

	_, _, err = client.From("spotify_connections").
		Update(updateData, "", "").
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error updating Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update connection"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Token refreshed successfully",
		"access_token": tokenResp.AccessToken,
		"expires_in":   tokenResp.ExpiresIn,
	})
}

func handleNowPlaying(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	// Get access token from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("access_token", "", false).
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No Spotify connection found"})
		return
	}

	// Parse the JSON response
	var connections []map[string]interface{}
	if err := json.Unmarshal(data, &connections); err != nil {
		log.Printf("Error parsing Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse connection"})
		return
	}

	if len(connections) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No Spotify connection found"})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid access token"})
		return
	}

	// Get currently playing track
	spotifyClient := NewSpotifyClient(accessToken)
	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		log.Printf("Error getting currently playing track: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get currently playing track"})
		return
	}

	// If a track is playing, store it in listening_activity
	if track.IsPlaying && track.Name != "" {
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
			log.Printf("Error storing listening activity: %v", err)
			// Don't return error, just log it
		}
	}

	c.JSON(http.StatusOK, track)
}

func handleRecent(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	// Get access token from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("access_token", "", false).
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No Spotify connection found"})
		return
	}

	// Parse the JSON response
	var connections []map[string]interface{}
	if err := json.Unmarshal(data, &connections); err != nil {
		log.Printf("Error parsing Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse connection"})
		return
	}

	if len(connections) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No Spotify connection found"})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid access token"})
		return
	}

	// Get recently played tracks
	spotifyClient := NewSpotifyClient(accessToken)
	tracks, err := spotifyClient.GetRecentlyPlayed()
	if err != nil {
		log.Printf("Error getting recently played tracks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recently played tracks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tracks": tracks,
	})
}
