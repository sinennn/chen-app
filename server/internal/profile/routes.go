package profile

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/internal/friends"
	"chen/internal/lastfm"
	"chen/internal/spotify"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
	"github.com/supabase-community/postgrest-go"
)

type ProfileStats struct {
	MinutesListened int    `json:"minutesListened"`
	ArtistsPlayed   int    `json:"artistsPlayed"`
	TopGenre        string `json:"topGenre"`
}

type ProfileTopArtist struct {
	Name      string   `json:"name"`
	PlayCount int      `json:"playCount"`
	ImageURL  string   `json:"imageUrl"`
	Genres    []string `json:"genres"`
}

type ProfileTopTrack struct {
	Name      string `json:"name"`
	Artist    string `json:"artist"`
	PlayCount int    `json:"playCount"`
	ImageURL  string `json:"imageUrl"`
}

type PublicProfileUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	UserTag  string `json:"user_tag,omitempty"`
	AvatarID string `json:"avatar_id"`
}

type PublicProfileStats = ProfileStats

type PublicProfileRelationship struct {
	FriendshipID string `json:"friendshipId,omitempty"`
	Status       string `json:"status"`
	CanMessage   bool   `json:"canMessage"`
}

type PublicProfileTrack struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	TrackID     string    `json:"track_id,omitempty"`
	TrackName   string    `json:"track_name"`
	ArtistName  string    `json:"artist_name"`
	AlbumName   string    `json:"album_name"`
	AlbumArtURL string    `json:"album_art_url"`
	SpotifyURL  string    `json:"spotify_url,omitempty"`
	PreviewURL  string    `json:"preview_url,omitempty"`
	Platform    string    `json:"platform"`
	PlayedAt    time.Time `json:"played_at"`
	IsPlaying   bool      `json:"is_playing"`
}

type PublicProfileResponse struct {
	User         PublicProfileUser         `json:"user"`
	Stats        PublicProfileStats        `json:"stats"`
	Relationship PublicProfileRelationship `json:"relationship"`
	NowPlaying   *PublicProfileTrack       `json:"nowPlaying"`
	RecentTracks []PublicProfileTrack      `json:"recentTracks"`
	TopTracks    []ProfileTopTrack         `json:"topTracks"`
	TopArtists   []ProfileTopArtist        `json:"topArtists"`
}

const maxReasonableListeningDurationMs = 2 * 60 * 60 * 1000
const spotifyRecentStatsPageLimit = 6

func RegisterProfileRoutes(rg *gin.RouterGroup) {
	rg.GET("/stats", getStats)
	rg.GET("/top-artists", getTopArtists)
	rg.GET("/top-tracks", getTopTracks)
	rg.GET("/users/:userID", getPublicProfile)
}

// @Summary Get Profile Stats
// @Description Fetch listening statistics for the current user (minutes listened, artists, top genre)
// @Tags profile
// @Produce json
// @Success 200 {object} ProfileStats
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /profile/stats [get]
func getStats(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	stats, err := deriveProfileStats(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch profile stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func deriveProfileStats(ctx context.Context, userID string) (ProfileStats, error) {
	stats, err := deriveStatsFromSpotifyRecentHistory(ctx, userID)
	if err == nil {
		return stats, nil
	}

	if !errors.Is(err, spotify.ErrNoSpotifyConnection) && !spotify.IsRateLimitError(err) {
		log.Printf("profile stats: spotify recent history failed for user %s, falling back to listening_activity: %v", userID, err)
	}

	return deriveStatsFromListeningActivity(ctx, userID)
}

func deriveStatsFromSpotifyRecentHistory(ctx context.Context, userID string) (ProfileStats, error) {
	stats := ProfileStats{TopGenre: "--"}

	spotifyClient, _, err := spotify.GetAuthorizedClient(userID)
	if err != nil {
		return stats, err
	}

	weekAgo := time.Now().Add(-7 * 24 * time.Hour)
	tracks, err := spotifyClient.GetRecentlyPlayedSince(weekAgo, spotifyRecentStatsPageLimit)
	if err != nil {
		return stats, err
	}

	return buildProfileStatsFromSpotifyTracks(ctx, tracks, weekAgo)
}

func buildProfileStatsFromSpotifyTracks(ctx context.Context, tracks []spotify.Track, weekAgo time.Time) (ProfileStats, error) {
	stats := ProfileStats{TopGenre: "--"}
	artistCounts := make(map[string]int)
	totalDurationMs := 0
	for _, track := range tracks {
		playedAt, err := time.Parse(time.RFC3339, track.PlayedAt)
		if err != nil || playedAt.Before(weekAgo) {
			continue
		}

		artistName := strings.TrimSpace(track.Artist)
		if artistName != "" {
			artistCounts[artistName]++
		}

		if track.DurationMs > 0 && track.DurationMs <= maxReasonableListeningDurationMs {
			totalDurationMs += track.DurationMs
		}
	}

	stats.MinutesListened = totalDurationMs / 60000
	stats.ArtistsPlayed = len(artistCounts)

	lastfmClient, lastfmErr := lastfm.NewClientFromEnv()
	if lastfmErr == nil {
		if topGenre := deriveTopGenreFromLastFM(ctx, lastfmClient, artistCounts); topGenre != "" {
			stats.TopGenre = topGenre
		}
	} else if !errors.Is(lastfmErr, lastfm.ErrNotConfigured) {
		return stats, fmt.Errorf("failed to resolve top genre from last.fm: %w", lastfmErr)
	}

	return stats, nil
}

func deriveStatsFromListeningActivity(ctx context.Context, userID string) (ProfileStats, error) {
	stats := ProfileStats{TopGenre: "--"}

	client := supabase.GetClient()
	if client == nil {
		return stats, fmt.Errorf("database connection failed")
	}

	weekAgo := time.Now().Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	data, _, err := client.From("listening_activity").
		Select("artist_name,started_at,played_at,progress_ms", "", false).
		Eq("user_id", userID).
		Gte("played_at", weekAgo).
		Order("played_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(500, "").
		Execute()
	if err != nil {
		return stats, err
	}

	var rows []map[string]any
	if len(data) > 0 {
		if err := json.Unmarshal(data, &rows); err != nil {
			return stats, err
		}
	}

	artistCounts := make(map[string]int)
	totalDurationMs := 0
	for _, row := range rows {
		artistName := strings.TrimSpace(profileToString(row["artist_name"]))
		if artistName != "" {
			artistCounts[artistName]++
		}

		totalDurationMs += estimateListeningDurationMs(row)
	}

	stats.MinutesListened = totalDurationMs / 60000
	stats.ArtistsPlayed = len(artistCounts)

	lastfmClient, lastfmErr := lastfm.NewClientFromEnv()
	if lastfmErr == nil {
		if topGenre := deriveTopGenreFromLastFM(ctx, lastfmClient, artistCounts); topGenre != "" {
			stats.TopGenre = topGenre
		}
	} else if !errors.Is(lastfmErr, lastfm.ErrNotConfigured) {
		return stats, fmt.Errorf("failed to resolve top genre from last.fm: %w", lastfmErr)
	}

	return stats, nil
}

func estimateListeningDurationMs(row map[string]any) int {
	progressMs := toIntValue(row["progress_ms"])
	if progressMs < 0 {
		progressMs = 0
	}

	startedAt, startedErr := time.Parse(time.RFC3339, profileToString(row["started_at"]))
	playedAt, playedErr := time.Parse(time.RFC3339, profileToString(row["played_at"]))

	if startedErr == nil && playedErr == nil && playedAt.After(startedAt) {
		durationMs := int(playedAt.Sub(startedAt).Milliseconds())
		if durationMs > 0 && durationMs <= maxReasonableListeningDurationMs {
			return durationMs
		}
	}

	if progressMs > 0 && progressMs <= maxReasonableListeningDurationMs {
		return progressMs
	}

	return 0
}

// @Summary Get Top Artists
// @Description Fetch the user's most played artists
// @Tags profile
// @Produce json
// @Success 200 {array} ProfileTopArtist
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /profile/top-artists [get]
func getTopArtists(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := spotify.GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, spotify.ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []ProfileTopArtist{})
			return
		}
		if spotify.IsRateLimitError(err) {
			c.JSON(http.StatusOK, []ProfileTopArtist{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	response, err := spotifyClient.GetTopArtistsRaw("short_term", 10)
	if err != nil {
		if _, ok := err.(*spotify.SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, []ProfileTopArtist{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch top artists"})
		return
	}

	result := make([]ProfileTopArtist, 0, min(len(response.Items), 10))
	for i, artist := range response.Items {
		if len(result) == 10 {
			break
		}

		imageURL := ""
		if len(artist.Images) > 0 {
			imageURL = artist.Images[0].URL
		}

		result = append(result, ProfileTopArtist{
			Name:      artist.Name,
			PlayCount: i + 1,
			ImageURL:  imageURL,
			Genres:    artist.Genres,
		})
	}

	c.JSON(http.StatusOK, result)
}

// @Summary Get Top Tracks
// @Description Fetch the user's most played tracks
// @Tags profile
// @Produce json
// @Success 200 {array} ProfileTopTrack
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /profile/top-tracks [get]
func getTopTracks(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	spotifyClient, _, err := spotify.GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, spotify.ErrNoSpotifyConnection) {
			c.JSON(http.StatusOK, []ProfileTopTrack{})
			return
		}
		if spotify.IsRateLimitError(err) {
			c.JSON(http.StatusOK, []ProfileTopTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	tracks, err := spotifyClient.GetTopTracks("short_term")
	if err != nil {
		if _, ok := err.(*spotify.SpotifyRateLimitError); ok {
			c.JSON(http.StatusOK, []ProfileTopTrack{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch top tracks"})
		return
	}

	result := make([]ProfileTopTrack, 0, min(len(tracks), 3))
	for _, track := range tracks {
		if len(result) == 3 {
			break
		}
		result = append(result, ProfileTopTrack{
			Name:      track.Name,
			Artist:    track.Artist,
			PlayCount: track.Rank,
			ImageURL:  track.AlbumArt,
		})
	}

	c.JSON(http.StatusOK, result)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func formatGenre(value string) string {
	parts := strings.Fields(value)
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

// @Summary Get Public User Profile
// @Description Fetch a user's public profile with their stats, recent activity, and relationship status
// @Tags profile
// @Produce json
// @Param userID path string true "User ID"
// @Success 200 {object} PublicProfileResponse
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Security Bearer
// @Router /profile/users/{userID} [get]
func getPublicProfile(c *gin.Context) {
	requestUserID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	targetUserID := strings.TrimSpace(c.Param("userID"))
	forceFresh := c.Query("fresh") == "true"
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	userData, _, err := client.From("users").
		Select("id,username,user_tag,avatar_id", "", false).
		Eq("id", targetUserID).
		Limit(1, "").
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}

	var users []map[string]any
	if err := json.Unmarshal(userData, &users); err != nil || len(users) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	stats, err := deriveStatsFromListeningActivity(c.Request.Context(), targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch profile stats"})
		return
	}

	nowPlaying, recentTracks, topTracks, topArtists := loadPublicSpotifyProfileSections(targetUserID, forceFresh)

	relationship, err := friends.GetRelationship(requestUserID, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve friendship state"})
		return
	}

	c.JSON(http.StatusOK, PublicProfileResponse{
		User: PublicProfileUser{
			ID:       profileToString(users[0]["id"]),
			Username: profileToString(users[0]["username"]),
			UserTag:  profileToString(users[0]["user_tag"]),
			AvatarID: profileToString(users[0]["avatar_id"]),
		},
		Stats: stats,
		Relationship: PublicProfileRelationship{
			FriendshipID: relationship.FriendshipID,
			Status:       relationship.Status,
			CanMessage:   relationship.Status == friends.RelationshipStatusFriends,
		},
		NowPlaying:   nowPlaying,
		RecentTracks: recentTracks,
		TopTracks:    topTracks,
		TopArtists:   topArtists,
	})
}

func loadPublicSpotifyProfileSections(userID string, forceFresh bool) (*PublicProfileTrack, []PublicProfileTrack, []ProfileTopTrack, []ProfileTopArtist) {
	spotifyClient, _, err := spotify.GetAuthorizedClient(userID)
	if err != nil {
		if errors.Is(err, spotify.ErrNoSpotifyConnection) || spotify.IsRateLimitError(err) {
			return nil, []PublicProfileTrack{}, []ProfileTopTrack{}, []ProfileTopArtist{}
		}

		log.Printf("public profile spotify client load failed user=%s err=%v", userID, err)
		return nil, []PublicProfileTrack{}, []ProfileTopTrack{}, []ProfileTopArtist{}
	}

	if forceFresh {
		spotifyClient.InvalidateTopArtistCaches("short_term", 5, 10, 50)
	}

	return loadPublicNowPlaying(spotifyClient, userID),
		loadPublicRecentTracks(spotifyClient, userID),
		loadPublicTopTracks(spotifyClient),
		loadPublicTopArtists(spotifyClient)
}

func loadPublicNowPlaying(spotifyClient *spotify.SpotifyClient, userID string) *PublicProfileTrack {
	if spotifyClient == nil {
		return nil
	}

	track, err := spotifyClient.GetCurrentlyPlaying()
	if err != nil {
		log.Printf("public profile now playing failed user=%s err=%v", userID, err)
		return nil
	}

	if track == nil || !track.IsPlaying || strings.TrimSpace(track.Name) == "" {
		return nil
	}

	return &PublicProfileTrack{
		UserID:      userID,
		TrackID:     track.ID,
		TrackName:   track.Name,
		ArtistName:  track.Artist,
		AlbumName:   track.Album,
		AlbumArtURL: track.AlbumArt,
		SpotifyURL:  track.SpotifyURL,
		PreviewURL:  track.PreviewURL,
		Platform:    "spotify",
		PlayedAt:    time.Now(),
		IsPlaying:   true,
	}
}

func loadPublicRecentTracks(spotifyClient *spotify.SpotifyClient, userID string) []PublicProfileTrack {
	if spotifyClient == nil {
		return []PublicProfileTrack{}
	}

	tracks, err := spotifyClient.GetRecentlyPlayed()
	if err != nil {
		log.Printf("public profile recent tracks failed user=%s err=%v", userID, err)
		return []PublicProfileTrack{}
	}

	result := make([]PublicProfileTrack, 0, min(len(tracks), 10))
	for _, track := range tracks {
		if len(result) == 10 {
			break
		}

		playedAt, _ := time.Parse(time.RFC3339, track.PlayedAt)
		result = append(result, PublicProfileTrack{
			UserID:      userID,
			TrackID:     track.ID,
			TrackName:   track.Name,
			ArtistName:  track.Artist,
			AlbumName:   track.Album,
			AlbumArtURL: track.AlbumArt,
			SpotifyURL:  track.SpotifyURL,
			PreviewURL:  track.PreviewURL,
			Platform:    "spotify",
			PlayedAt:    playedAt,
			IsPlaying:   false,
		})
	}

	return result
}

func loadPublicTopTracks(spotifyClient *spotify.SpotifyClient) []ProfileTopTrack {
	if spotifyClient == nil {
		return []ProfileTopTrack{}
	}

	tracks, err := spotifyClient.GetTopTracks("short_term")
	if err != nil {
		log.Printf("public profile top tracks failed user=%s err=%v", spotifyClient.UserID, err)
		return []ProfileTopTrack{}
	}

	result := make([]ProfileTopTrack, 0, min(len(tracks), 3))
	for _, track := range tracks {
		if len(result) == 3 {
			break
		}

		result = append(result, ProfileTopTrack{
			Name:      track.Name,
			Artist:    track.Artist,
			PlayCount: track.Rank,
			ImageURL:  track.AlbumArt,
		})
	}

	return result
}

func loadPublicTopArtists(spotifyClient *spotify.SpotifyClient) []ProfileTopArtist {
	if spotifyClient == nil {
		return []ProfileTopArtist{}
	}

	response, err := spotifyClient.GetTopArtistsRaw("short_term", 5)
	if err != nil {
		log.Printf("public profile top artists failed user=%s err=%v", spotifyClient.UserID, err)
		return []ProfileTopArtist{}
	}

	result := make([]ProfileTopArtist, 0, min(len(response.Items), 5))
	for i, artist := range response.Items {
		if len(result) == 5 {
			break
		}

		imageURL := ""
		if len(artist.Images) > 0 {
			imageURL = artist.Images[0].URL
		}

		result = append(result, ProfileTopArtist{
			Name:      artist.Name,
			PlayCount: i + 1,
			ImageURL:  imageURL,
			Genres:    artist.Genres,
		})
	}

	return result
}

func toBoolValue(value any) bool {
	result, ok := value.(bool)
	return ok && result
}

func profileToString(value any) string {
	if value == nil {
		return ""
	}

	return fmt.Sprintf("%v", value)
}

func toIntValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float32:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}
