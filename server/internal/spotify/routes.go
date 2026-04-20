package spotify

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/internal/referrals"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
)

type ConnectRequest struct {
	AccessToken  string `json:"access_token" binding:"required"`
	RefreshToken string `json:"refresh_token" binding:"required"`
	ExpiresIn    int    `json:"expires_in" binding:"required"`
}

type ExchangeCodeRequest struct {
	Code        string `json:"code" binding:"required"`
	RedirectURI string `json:"redirect_uri" binding:"required"`
	Username    string `json:"username"`
	AvatarID    string `json:"avatar_id"`
}

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
	IsPlaying   bool      `json:"is_playing"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/connect", handleConnect)
	rg.POST("/exchange-code", handleExchangeCode)
	rg.GET("/now-playing", handleNowPlaying)
	rg.GET("/recent", handleRecent)
	rg.GET("/top-tracks", handleTopTracks)
	rg.GET("/top-artists", handleTopArtists)
	rg.GET("/on-repeat", handleOnRepeat)
	rg.GET("/recommendations", handleRecommendations)
}

// @Summary Exchange Spotify Authorization Code
// @Description Exchanges a Spotify OAuth authorization code for tokens server-side (client secret never exposed to client)
// @Tags spotify
// @Accept json
// @Produce json
// @Param request body ExchangeCodeRequest true "Authorization code and redirect URI"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security Bearer
// @Router /spotify/exchange-code [post]
func handleExchangeCode(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req ExchangeCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tokens, err := ExchangeAuthorizationCode(req.Code, req.RedirectURI)
	if err != nil {
		log.Printf("spotify: code exchange failed for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange Spotify authorization code"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	expiresAt := time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
	_, _, err = client.From("spotify_connections").Upsert(map[string]any{
		"user_id":       userID,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"expires_at":    expiresAt.Format(time.RFC3339),
	}, "user_id", "", "").Execute()
	if err != nil {
		log.Printf("spotify: failed to store connection for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store Spotify connection"})
		return
	}

	// Update username and/or avatar_id on the users table if provided
	username := strings.TrimSpace(req.Username)
	avatarID := strings.TrimSpace(req.AvatarID)
	if username != "" || avatarID != "" {
		updateData := map[string]any{}
		if username != "" {
			updateData["username"] = username
		}
		if avatarID != "" {
			updateData["avatar_id"] = avatarID
		}
		if _, _, err := client.From("users").Update(updateData, "", "").Eq("id", userID).Execute(); err != nil {
			// Non-fatal: tokens are already stored. Log and continue.
			log.Printf("spotify: failed to update user profile for user %s during code exchange: %v", userID, err)
		}
	}

	// Kick off an immediate poll so the user's activity shows up without waiting
	// for the next poller tick.
	go func() {
		if err := PollUserActivityNow(userID); err != nil {
			log.Printf("spotify: immediate post-connect poll failed for user %s: %v", userID, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Spotify connected successfully"})
}

// @Summary Connect Spotify Account
// @Description Connect or refresh Spotify connection with access tokens
// @Tags spotify
// @Accept json
// @Produce json
// @Param request body ConnectRequest true "Spotify connection tokens"
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /spotify/connect [post]
func handleConnect(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	expiresAt := time.Now().Add(time.Duration(req.ExpiresIn) * time.Second)
	_, _, err := client.From("spotify_connections").Upsert(map[string]any{
		"user_id":       userID,
		"access_token":  req.AccessToken,
		"refresh_token": req.RefreshToken,
		"expires_at":    expiresAt.Format(time.RFC3339),
	}, "", "", "").Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store connection"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Spotify connected successfully"})
}

// @Summary Get Currently Playing Track
// @Description Fetch the currently playing track from user's Spotify
// @Tags spotify
// @Produce json
// @Success 200 {object} ActivityItem
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /spotify/now-playing [get]
func handleNowPlaying(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, nil)
			return
		}
		if IsRateLimitError(err) {
			c.JSON(http.StatusOK, nil)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, nil)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch currently playing track"})
		return
	}

	if track == nil || !track.IsPlaying || track.Name == "" {
		c.JSON(http.StatusOK, nil)
		return
	}

	c.JSON(http.StatusOK, ActivityItem{
		UserID:      userID,
		TrackID:     track.ID,
		TrackName:   track.Name,
		ArtistName:  track.Artist,
		AlbumName:   track.Album,
		AlbumArtURL: track.AlbumArt,
		SpotifyURL:  track.SpotifyURL,
		PreviewURL:  track.PreviewURL,
		Platform:    "spotify",
		StartedAt:   time.Now(),
		IsPlaying:   track.IsPlaying,
	})
}

// @Summary Get Recent Tracks
// @Description Fetch user's recently played tracks from Spotify
// @Tags spotify
// @Produce json
// @Success 200 {array} ActivityItem
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /spotify/recent [get]
func handleRecent(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []ActivityItem{})
			return
		}
		if IsRateLimitError(err) {
			c.JSON(http.StatusOK, []ActivityItem{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	tracks, err := spotifyClient.GetRecentlyPlayed()
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, []ActivityItem{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recent activity"})
		return
	}

	activities := make([]ActivityItem, 0, min(len(tracks), 10))
	for _, track := range tracks {
		if len(activities) == 10 {
			break
		}

		playedAt, _ := time.Parse(time.RFC3339, track.PlayedAt)
		activities = append(activities, ActivityItem{
			UserID:      userID,
			TrackID:     track.ID,
			TrackName:   track.Name,
			ArtistName:  track.Artist,
			AlbumName:   track.Album,
			AlbumArtURL: track.AlbumArt,
			SpotifyURL:  track.SpotifyURL,
			PreviewURL:  track.PreviewURL,
			Platform:    "spotify",
			StartedAt:   playedAt,
			IsPlaying:   false,
		})
	}

	c.JSON(http.StatusOK, activities)
}

// @Summary Get Top Tracks
// @Description Fetch user's top tracks from Spotify
// @Tags spotify
// @Produce json
// @Success 200 {array} ActivityItem
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /spotify/top-tracks [get]
func handleTopTracks(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []TopTrack{})
			return
		}
		if IsRateLimitError(err) {
			c.JSON(http.StatusOK, []TopTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	tracks, err := spotifyClient.GetTopTracks(validTimeRange(c.DefaultQuery("time_range", "medium_term")))
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, []TopTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch top tracks"})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

// @Summary Get Top Artists
// @Description Fetch user's top artists from Spotify
// @Tags spotify
// @Produce json
// @Success 200 {array} map[string]string
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /spotify/top-artists [get]
func handleTopArtists(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	limit, parseErr := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if parseErr != nil {
		limit = 50
	}
	timeRange := validTimeRange(c.DefaultQuery("time_range", "medium_term"))
	forceFresh := c.Query("fresh") == "true"

	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []TopArtist{})
			return
		}
		if IsRateLimitError(err) {
			c.JSON(http.StatusOK, SpotifyTopArtistsResponse{
				Items:  []SpotifyArtistItem{},
				Limit:  limit,
				Offset: 0,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	if forceFresh {
		spotifyClient.InvalidateTopArtistCaches(timeRange, limit, 50)
	}

	response, err := spotifyClient.GetTopArtistsRaw(timeRange, limit)
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, SpotifyTopArtistsResponse{
				Items:  []SpotifyArtistItem{},
				Limit:  limit,
				Offset: 0,
			})
			return
			// @Summary Get On Repeat Tracks
			// @Description Fetch user's currently repeating tracks from Spotify
			// @Tags spotify
			// @Produce json
			// @Success 200 {array} ActivityItem
			// @Failure 401 {object} map[string]string
			// @Security Bearer
			// @Router /spotify/on-repeat [get]
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch top artists"})
		return
	}

	allowedCount, unlockErr := referrals.AllowedTopArtistCount(userID)
	if unlockErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load artist unlocks"})
		return
	}
	if allowedCount < len(response.Items) {
		response.Items = response.Items[:allowedCount]
	}

	c.JSON(http.StatusOK, response)
}

func handleOnRepeat(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []PlaylistTrack{})
			return
		}
		if IsRateLimitError(err) {
			c.JSON(http.StatusOK, []PlaylistTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	tracks, err := spotifyClient.GetOnRepeatTracks()
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, []PlaylistTrack{})
			return
			// @Summary Get Recommendations
			// @Description Get music recommendations based on user's listening history
			// @Tags spotify
			// @Produce json
			// @Success 200 {array} ActivityItem
			// @Failure 401 {object} map[string]string
			// @Security Bearer
			// @Router /spotify/recommendations [get]
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch on repeat tracks"})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func handleRecommendations(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []PlaylistTrack{})
			return
		}
		if IsRateLimitError(err) {
			c.JSON(http.StatusOK, []PlaylistTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	tracks, err := spotifyClient.GetRecommendedTracks()
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, []PlaylistTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func validTimeRange(value string) string {
	switch value {
	case "short_term", "medium_term", "long_term":
		return value
	default:
		return "medium_term"
	}
}
