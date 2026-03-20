package spotify

import (
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
	rg.POST("/connect", handleConnect)
	rg.GET("/now-playing", handleNowPlaying)
	rg.GET("/recent", handleRecent)
	rg.GET("/top-tracks", handleTopTracks)
	rg.GET("/top-artists", handleTopArtists)
	rg.GET("/on-repeat", handleOnRepeat)
}

func handleConnect(c *gin.Context) {
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
		"user_id":       userIDStr,
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
	})
}

func handleNowPlaying(c *gin.Context) {
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

	// Get access token and refresh token from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("access_token,refresh_token,expires_at", "", false).
		Eq("user_id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, nil)
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
		c.JSON(http.StatusOK, nil)
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid access token"})
		return
	}

	refreshToken, _ := connections[0]["refresh_token"].(string)

	var expiresAt time.Time
	if expiresAtStr, ok := connections[0]["expires_at"].(string); ok {
		expiresAt, _ = time.Parse(time.RFC3339, expiresAtStr)
	}

	// Check if token is expired or expiring soon, and refresh if needed
	if !expiresAt.IsZero() && time.Now().After(expiresAt.Add(-5*time.Minute)) {
		log.Printf("Token for user %s is expired or expiring soon, refreshing...", userIDStr)

		tempClient := NewSpotifyClient(accessToken)
		newToken, err := tempClient.RefreshToken(refreshToken)
		if err != nil {
			log.Printf("Error refreshing token for user %s: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh access token"})
			return
		}

		accessToken = newToken.AccessToken
		newExpiresAt := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)

		// Update the database with the new token
		updateData := map[string]interface{}{
			"access_token": newToken.AccessToken,
			"expires_at":   newExpiresAt.Format(time.RFC3339),
		}
		if newToken.RefreshToken != "" {
			updateData["refresh_token"] = newToken.RefreshToken
		}

		_, _, err = client.From("spotify_connections").
			Update(updateData, "", "").
			Eq("user_id", userIDStr).
			Execute()
		if err != nil {
			log.Printf("Warning: failed to persist refreshed token for user %s: %v", userIDStr, err)
		} else {
			log.Printf("Successfully refreshed token for user %s", userIDStr)
		}
	}

	// Get currently playing track from Spotify API (real-time)
	spotifyClient := NewSpotifyClient(accessToken)
	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		log.Printf("Error getting currently playing track: %v", err)
		c.JSON(http.StatusOK, nil)
		return
	}

	// Return current track state (don't store here, let poller handle storage)
	if track.IsPlaying && track.Name != "" {
		activityItem := ActivityItem{
			UserID:      userIDStr,
			TrackName:   track.Name,
			ArtistName:  track.Artist,
			AlbumName:   track.Album,
			AlbumArtURL: track.AlbumArt,
			Platform:    "spotify",
			StartedAt:   time.Now(),
			IsPlaying:   track.IsPlaying,
		}

		c.JSON(http.StatusOK, activityItem)
		return
	}

	c.JSON(http.StatusOK, nil)
}

func handleRecent(c *gin.Context) {
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

	// Get recent activity from database (stored by poller)
	client := supabase.GetClient()
	data, _, err := client.From("listening_activity").
		Select("track_name,artist_name,album_name,album_art_url,played_at,is_playing", "", false).
		Eq("user_id", userIDStr).
		Order("played_at", nil).
		Limit(20, "").
		Execute()

	if err != nil {
		log.Printf("Error fetching recent activity: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recent activity"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, []ActivityItem{})
		return
	}

	// Parse the JSON response
	var activities []map[string]interface{}
	if err := json.Unmarshal(data, &activities); err != nil {
		log.Printf("Error parsing recent activities: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse activities"})
		return
	}

	// Convert to ActivityItem format
	activityItems := make([]ActivityItem, len(activities))
	for i, activity := range activities {
		playedAtStr, _ := activity["played_at"].(string)
		playedAt, _ := time.Parse(time.RFC3339, playedAtStr)

		activityItems[i] = ActivityItem{
			UserID:      userIDStr,
			TrackName:   activity["track_name"].(string),
			ArtistName:  activity["artist_name"].(string),
			AlbumName:   activity["album_name"].(string),
			AlbumArtURL: activity["album_art_url"].(string),
			Platform:    "spotify",
			StartedAt:   playedAt,
			IsPlaying:   activity["is_playing"].(bool),
		}
	}

	c.JSON(http.StatusOK, activityItems)
}

func handleTopTracks(c *gin.Context) {
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

	// Get time range from query params (short_term, medium_term, long_term)
	timeRange := c.DefaultQuery("time_range", "medium_term")
	if timeRange != "short_term" && timeRange != "medium_term" && timeRange != "long_term" {
		timeRange = "medium_term"
	}

	// Get access token and refresh token from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("access_token,refresh_token,expires_at", "", false).
		Eq("user_id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, []TopTrack{})
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
		c.JSON(http.StatusOK, []TopTrack{})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid access token"})
		return
	}

	refreshToken, _ := connections[0]["refresh_token"].(string)

	var expiresAt time.Time
	if expiresAtStr, ok := connections[0]["expires_at"].(string); ok {
		expiresAt, _ = time.Parse(time.RFC3339, expiresAtStr)
	}

	// Check if token is expired or expiring soon, and refresh if needed
	if !expiresAt.IsZero() && time.Now().After(expiresAt.Add(-5*time.Minute)) {
		log.Printf("Token for user %s is expired or expiring soon, refreshing...", userIDStr)

		tempClient := NewSpotifyClient(accessToken)
		newToken, err := tempClient.RefreshToken(refreshToken)
		if err != nil {
			log.Printf("Error refreshing token for user %s: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh access token"})
			return
		}

		accessToken = newToken.AccessToken
		newExpiresAt := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)

		// Update the database with the new token
		updateData := map[string]interface{}{
			"access_token": newToken.AccessToken,
			"expires_at":   newExpiresAt.Format(time.RFC3339),
		}
		if newToken.RefreshToken != "" {
			updateData["refresh_token"] = newToken.RefreshToken
		}

		_, _, err = client.From("spotify_connections").
			Update(updateData, "", "").
			Eq("user_id", userIDStr).
			Execute()
		if err != nil {
			log.Printf("Warning: failed to persist refreshed token for user %s: %v", userIDStr, err)
		} else {
			log.Printf("Successfully refreshed token for user %s", userIDStr)
		}
	}

	// Get top tracks from Spotify API
	spotifyClient := NewSpotifyClient(accessToken)
	tracks, err := spotifyClient.GetTopTracks(timeRange)
	if err != nil {
		log.Printf("Error getting top tracks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top tracks"})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func handleTopArtists(c *gin.Context) {
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

	// Get time range from query params (short_term, medium_term, long_term)
	timeRange := c.DefaultQuery("time_range", "medium_term")
	if timeRange != "short_term" && timeRange != "medium_term" && timeRange != "long_term" {
		timeRange = "medium_term"
	}

	// Get access token and refresh token from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("access_token,refresh_token,expires_at", "", false).
		Eq("user_id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, []TopArtist{})
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
		c.JSON(http.StatusOK, []TopArtist{})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid access token"})
		return
	}

	refreshToken, _ := connections[0]["refresh_token"].(string)

	var expiresAt time.Time
	if expiresAtStr, ok := connections[0]["expires_at"].(string); ok {
		expiresAt, _ = time.Parse(time.RFC3339, expiresAtStr)
	}

	// Check if token is expired or expiring soon, and refresh if needed
	if !expiresAt.IsZero() && time.Now().After(expiresAt.Add(-5*time.Minute)) {
		log.Printf("Token for user %s is expired or expiring soon, refreshing...", userIDStr)

		tempClient := NewSpotifyClient(accessToken)
		newToken, err := tempClient.RefreshToken(refreshToken)
		if err != nil {
			log.Printf("Error refreshing token for user %s: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh access token"})
			return
		}

		accessToken = newToken.AccessToken
		newExpiresAt := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)

		// Update the database with the new token
		updateData := map[string]interface{}{
			"access_token": newToken.AccessToken,
			"expires_at":   newExpiresAt.Format(time.RFC3339),
		}
		if newToken.RefreshToken != "" {
			updateData["refresh_token"] = newToken.RefreshToken
		}

		_, _, err = client.From("spotify_connections").
			Update(updateData, "", "").
			Eq("user_id", userIDStr).
			Execute()
		if err != nil {
			log.Printf("Warning: failed to persist refreshed token for user %s: %v", userIDStr, err)
		} else {
			log.Printf("Successfully refreshed token for user %s", userIDStr)
		}
	}

	// Get top artists from Spotify API
	spotifyClient := NewSpotifyClient(accessToken)
	artists, err := spotifyClient.GetTopArtists(timeRange)
	if err != nil {
		log.Printf("Error getting top artists: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get top artists"})
		return
	}

	c.JSON(http.StatusOK, artists)
}

func handleOnRepeat(c *gin.Context) {
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

	// Get access token and refresh token from database
	client := supabase.GetClient()
	data, _, err := client.From("spotify_connections").
		Select("access_token,refresh_token,expires_at", "", false).
		Eq("user_id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch connection"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, []PlaylistTrack{})
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
		c.JSON(http.StatusOK, []PlaylistTrack{})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid access token"})
		return
	}

	refreshToken, _ := connections[0]["refresh_token"].(string)

	var expiresAt time.Time
	if expiresAtStr, ok := connections[0]["expires_at"].(string); ok {
		expiresAt, _ = time.Parse(time.RFC3339, expiresAtStr)
	}

	// Check if token is expired or expiring soon, and refresh if needed
	if !expiresAt.IsZero() && time.Now().After(expiresAt.Add(-5*time.Minute)) {
		log.Printf("Token for user %s is expired or expiring soon, refreshing...", userIDStr)

		tempClient := NewSpotifyClient(accessToken)
		newToken, err := tempClient.RefreshToken(refreshToken)
		if err != nil {
			log.Printf("Error refreshing token for user %s: %v", userIDStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh access token"})
			return
		}

		accessToken = newToken.AccessToken
		newExpiresAt := time.Now().Add(time.Duration(newToken.ExpiresIn) * time.Second)

		// Update the database with the new token
		updateData := map[string]interface{}{
			"access_token": newToken.AccessToken,
			"expires_at":   newExpiresAt.Format(time.RFC3339),
		}
		if newToken.RefreshToken != "" {
			updateData["refresh_token"] = newToken.RefreshToken
		}

		_, _, err = client.From("spotify_connections").
			Update(updateData, "", "").
			Eq("user_id", userIDStr).
			Execute()
		if err != nil {
			log.Printf("Warning: failed to persist refreshed token for user %s: %v", userIDStr, err)
		} else {
			log.Printf("Successfully refreshed token for user %s", userIDStr)
		}
	}

	// Get tracks from "On Repeat" playlist
	spotifyClient := NewSpotifyClient(accessToken)
	tracks, err := spotifyClient.GetOnRepeatTracks()
	if err != nil {
		log.Printf("Error getting on repeat tracks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get on repeat tracks"})
		return
	}

	c.JSON(http.StatusOK, tracks)
}
