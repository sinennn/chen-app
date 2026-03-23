package spotify

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"chen/internal/auth"
	"chen/pkg/supabase"

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
	rg.GET("/recommendations", handleRecommendations)
}

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
		TrackName:   track.Name,
		ArtistName:  track.Artist,
		AlbumName:   track.Album,
		AlbumArtURL: track.AlbumArt,
		Platform:    "spotify",
		StartedAt:   time.Now(),
		IsPlaying:   track.IsPlaying,
	})
}

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
			TrackName:   track.Name,
			ArtistName:  track.Artist,
			AlbumName:   track.Album,
			AlbumArtURL: track.AlbumArt,
			Platform:    "spotify",
			StartedAt:   playedAt,
			IsPlaying:   false,
		})
	}

	c.JSON(http.StatusOK, activities)
}

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

	response, err := spotifyClient.GetTopArtistsRaw(timeRange, limit)
	if err != nil {
		if _, ok := err.(*SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, SpotifyTopArtistsResponse{
				Items:  []SpotifyArtistItem{},
				Limit:  limit,
				Offset: 0,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch top artists"})
		return
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
