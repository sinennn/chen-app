package profile

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/internal/friends"
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

func RegisterProfileRoutes(rg *gin.RouterGroup) {
	rg.GET("/stats", getStats)
	rg.GET("/top-artists", getTopArtists)
	rg.GET("/top-tracks", getTopTracks)
	rg.GET("/users/:userID", getPublicProfile)
}

func getStats(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	stats, err := deriveStatsFromListeningActivity(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch profile stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func deriveStatsFromListeningActivity(userID string) (ProfileStats, error) {
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

	spotifyClient, _, spotifyErr := spotify.GetAuthorizedClient(userID)
	if spotifyErr == nil {
		if topGenre := deriveTopGenreFromArtistCounts(spotifyClient, artistCounts); topGenre != "" {
			stats.TopGenre = topGenre
		}
	} else if !errors.Is(spotifyErr, spotify.ErrNoSpotifyConnection) && !spotify.IsRateLimitError(spotifyErr) {
		return stats, fmt.Errorf("failed to load spotify connection for genre lookup: %w", spotifyErr)
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

func deriveTopGenreFromArtistCounts(client *spotify.SpotifyClient, artistCounts map[string]int) string {
	type rankedArtist struct {
		Name  string
		Plays int
	}

	rankedArtists := make([]rankedArtist, 0, len(artistCounts))
	for name, plays := range artistCounts {
		if strings.TrimSpace(name) == "" || plays <= 0 {
			continue
		}
		rankedArtists = append(rankedArtists, rankedArtist{Name: name, Plays: plays})
	}

	sort.SliceStable(rankedArtists, func(i, j int) bool {
		if rankedArtists[i].Plays != rankedArtists[j].Plays {
			return rankedArtists[i].Plays > rankedArtists[j].Plays
		}
		return rankedArtists[i].Name < rankedArtists[j].Name
	})

	genreCounts := make(map[string]int)
	topGenre := ""
	topCount := 0

	for _, artist := range rankedArtists[:min(len(rankedArtists), 10)] {
		genres, err := client.GetArtistGenres(artist.Name)
		if err != nil {
			log.Printf("profile stats genre lookup failed artist=%q plays=%d err=%v", artist.Name, artist.Plays, err)
			continue
		}
		log.Printf("profile stats genre lookup artist=%q plays=%d genres=%v", artist.Name, artist.Plays, genres)

		for _, genre := range genres {
			normalized := strings.ToLower(strings.TrimSpace(genre))
			if normalized == "" {
				continue
			}

			genreCounts[normalized] += artist.Plays
			if genreCounts[normalized] > topCount {
				topCount = genreCounts[normalized]
				topGenre = normalized
			}
		}
	}

	if topGenre == "" {
		log.Printf("profile stats genre unresolved artistCounts=%v", artistCounts)
		return ""
	}

	return formatGenre(topGenre)
}

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

func deriveTopGenre(client *spotify.SpotifyClient) string {
	for _, timeRange := range []string{"short_term", "medium_term", "long_term"} {
		response, err := client.GetTopArtistsRaw(timeRange, 10)
		if err != nil {
			continue
		}

		genreCounts := make(map[string]int)
		topGenre := ""
		topCount := 0
		for _, artist := range response.Items[:min(len(response.Items), 10)] {
			genres := artist.Genres
			if len(genres) == 0 && artist.ID != "" {
				fallbackGenres, genreErr := client.GetArtistGenresByID(artist.ID)
				if genreErr == nil && len(fallbackGenres) > 0 {
					genres = fallbackGenres
				}
			}

			log.Printf("profile stats top artist [%s]: %s id=%s genres=%v", timeRange, artist.Name, artist.ID, genres)
			for _, genre := range genres {
				normalized := strings.ToLower(strings.TrimSpace(genre))
				if normalized == "" {
					continue
				}

				genreCounts[normalized]++
				if genreCounts[normalized] > topCount {
					topCount = genreCounts[normalized]
					topGenre = normalized
				}
			}
		}

		if topGenre != "" {
			return formatGenre(topGenre)
		}
	}

	return ""
}

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

	stats, err := deriveStatsFromListeningActivity(targetUserID)
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
