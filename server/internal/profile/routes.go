package profile

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/internal/spotify"

	"github.com/gin-gonic/gin"
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

	stats := ProfileStats{TopGenre: "--"}

	spotifyClient, _, err := spotify.GetAuthorizedClient(userID)
	if err == nil {
		if recentlyPlayed, recentErr := spotifyClient.GetRecentlyPlayed(); recentErr == nil {
			weekAgo := time.Now().Add(-7 * 24 * time.Hour)
			artistsSeen := make(map[string]struct{})
			totalDurationMs := 0
			for _, track := range recentlyPlayed {
				if track.PlayedAt == "" {
					continue
				}

				playedAt, parseErr := time.Parse(time.RFC3339, track.PlayedAt)
				if parseErr != nil || playedAt.Before(weekAgo) {
					continue
				}

				if track.Artist != "" {
					artistsSeen[track.Artist] = struct{}{}
				}
				totalDurationMs += track.DurationMs
			}

			stats.MinutesListened = totalDurationMs / 60000
			stats.ArtistsPlayed = len(artistsSeen)
		}

		topGenre := deriveTopGenre(spotifyClient)
		if topGenre != "" {
			stats.TopGenre = topGenre
		}
	} else if !errors.Is(err, spotify.ErrNoSpotifyConnection) && !spotify.IsRateLimitError(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load Spotify connection"})
		return
	}

	c.JSON(http.StatusOK, stats)
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
