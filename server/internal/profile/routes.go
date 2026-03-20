package profile

import (
	"chen/internal/auth"
	"chen/internal/spotify"
	"chen/pkg/supabase"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type ProfileStats struct {
	MinutesListened int    `json:"minutesListened"`
	ArtistsPlayed   int    `json:"artistsPlayed"`
	TopGenre        string `json:"topGenre"`
}

type ProfileTopArtist struct {
	Name      string `json:"name"`
	PlayCount int    `json:"playCount"`
	ImageURL  string `json:"imageUrl"`
}

type ProfileTopTrack struct {
	Name      string `json:"name"`
	Artist    string `json:"artist"`
	PlayCount int    `json:"playCount"`
	ImageURL  string `json:"imageUrl"`
}

func RegisterProfileRoutes(rg *gin.RouterGroup) {
	rg.GET("/stats", getStats)
	rg.GET("/top-artists", getTopArtists)
	rg.GET("/top-tracks", getTopTracks)
}

func getStats(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Get user's Spotify access token
	spotifyData, _, err := client.From("spotify_connections").
		Select("access_token", "", false).
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusOK, ProfileStats{
			MinutesListened: 0,
			ArtistsPlayed:   0,
			TopGenre:        "--",
		})
		return
	}

	var connections []map[string]interface{}
	if err := json.Unmarshal(spotifyData, &connections); err != nil || len(connections) == 0 {
		log.Printf("No Spotify connection found for user %s", userID)
		c.JSON(http.StatusOK, ProfileStats{
			MinutesListened: 0,
			ArtistsPlayed:   0,
			TopGenre:        "--",
		})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		log.Printf("Invalid access token for user %s", userID)
		c.JSON(http.StatusOK, ProfileStats{
			MinutesListened: 0,
			ArtistsPlayed:   0,
			TopGenre:        "--",
		})
		return
	}

	// Get data from Spotify API
	spotifyClient := spotify.NewSpotifyClient(accessToken)

	// Get top artists for genre analysis
	topArtists, err := spotifyClient.GetTopArtists("short_term")
	if err != nil {
		log.Printf("Error getting top artists for user %s: %v", userID, err)
		c.JSON(http.StatusOK, ProfileStats{
			MinutesListened: 0,
			ArtistsPlayed:   0,
			TopGenre:        "--",
		})
		return
	}

	// Calculate stats from Spotify data
	artistsPlayed := len(topArtists)
	minutesListened := 0 // We'll estimate based on recent tracks
	topGenre := "Various"

	// Count genres from top artists
	genreCounts := make(map[string]int)
	for _, artist := range topArtists {
		log.Printf("Artist: %s, Genres: %v", artist.Name, artist.Genres)
		for _, genre := range artist.Genres {
			if genre != "" {
				genreCounts[genre]++
			}
		}
	}

	// Find the most common genre
	maxCount := 0
	for genre, count := range genreCounts {
		if count > maxCount {
			maxCount = count
			topGenre = genre
		}
	}

	// Get recent tracks to estimate minutes listened
	recentTracks, err := spotifyClient.GetRecentlyPlayed()
	if err == nil && len(recentTracks) > 0 {
		// Estimate minutes from recent tracks (last 50 tracks)
		// Assuming average track length of 3.5 minutes
		minutesListened = len(recentTracks) * 3
	}

	stats := ProfileStats{
		MinutesListened: minutesListened,
		ArtistsPlayed:   artistsPlayed,
		TopGenre:        topGenre,
	}

	log.Printf("Returning stats for user %s: %+v", userID, stats)
	c.JSON(http.StatusOK, stats)
}

func getTopArtists(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Get user's Spotify access token
	spotifyData, _, err := client.From("spotify_connections").
		Select("access_token", "", false).
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusOK, []ProfileTopArtist{})
		return
	}

	var connections []map[string]interface{}
	if err := json.Unmarshal(spotifyData, &connections); err != nil || len(connections) == 0 {
		log.Printf("No Spotify connection found for user %s", userID)
		c.JSON(http.StatusOK, []ProfileTopArtist{})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		log.Printf("Invalid access token for user %s", userID)
		c.JSON(http.StatusOK, []ProfileTopArtist{})
		return
	}

	// Get top artists from Spotify API
	spotifyClient := spotify.NewSpotifyClient(accessToken)
	spotifyArtists, err := spotifyClient.GetTopArtists("short_term")
	if err != nil {
		log.Printf("Error getting top artists from Spotify for user %s: %v", userID, err)
		c.JSON(http.StatusOK, []ProfileTopArtist{})
		return
	}

	// Convert Spotify artists to our format
	var topArtists []ProfileTopArtist
	for i, artist := range spotifyArtists {
		if i >= 10 { // Limit to top 10
			break
		}

		topArtists = append(topArtists, ProfileTopArtist{
			Name:      artist.Name,
			PlayCount: artist.Rank, // Use rank as a proxy for play count
			ImageURL:  artist.ImageURL,
		})
	}

	log.Printf("Returning %d top artists for user %s", len(topArtists), userID)
	c.JSON(http.StatusOK, topArtists)
}

func getTopTracks(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get user's Spotify access token (same pattern as getTopArtists)
	client := supabase.GetClient()
	spotifyData, _, err := client.From("spotify_connections").
		Select("access_token", "", false).
		Eq("user_id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching Spotify connection: %v", err)
		c.JSON(http.StatusOK, []ProfileTopTrack{})
		return
	}

	var connections []map[string]interface{}
	if err := json.Unmarshal(spotifyData, &connections); err != nil || len(connections) == 0 {
		log.Printf("No Spotify connection found for user %s", userID)
		c.JSON(http.StatusOK, []ProfileTopTrack{})
		return
	}

	accessToken, ok := connections[0]["access_token"].(string)
	if !ok {
		log.Printf("Invalid access token for user %s", userID)
		c.JSON(http.StatusOK, []ProfileTopTrack{})
		return
	}

	// Get top tracks from Spotify API
	spotifyClient := spotify.NewSpotifyClient(accessToken)
	spotifyTracks, err := spotifyClient.GetTopTracks("medium_term")
	if err != nil {
		log.Printf("Error getting top tracks from Spotify for user %s: %v", userID, err)
		c.JSON(http.StatusOK, []ProfileTopTrack{})
		return
	}

	// Convert Spotify tracks to our format
	var topTracks []ProfileTopTrack
	for i, track := range spotifyTracks {
		if i >= 3 { // Limit to top 3
			break
		}

		topTracks = append(topTracks, ProfileTopTrack{
			Name:     track.Name,
			Artist:   track.Artist,
			ImageURL:  track.AlbumArt,
		})
	}

	log.Printf("Returning %d top tracks for user %s", len(topTracks), userID)
	c.JSON(http.StatusOK, topTracks)
}
