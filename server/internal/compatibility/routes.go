package compatibility

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sort"
	"strings"

	"chen/internal/auth"
	"chen/internal/friends"
	"chen/internal/spotify"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
	"github.com/supabase-community/postgrest-go"
)

type UserSummary struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	AvatarID string `json:"avatar_id"`
}

type ArtistMatch struct {
	Name     string   `json:"name"`
	ImageURL string   `json:"imageUrl"`
	Genres   []string `json:"genres,omitempty"`
	Rank     int      `json:"rank,omitempty"`
}

type TrackMatch struct {
	Name     string `json:"name"`
	Artist   string `json:"artist"`
	Album    string `json:"album,omitempty"`
	ImageURL string `json:"imageUrl"`
	Rank     int    `json:"rank,omitempty"`
}

type CompatibilityResponse struct {
	You           UserSummary   `json:"you"`
	Them          UserSummary   `json:"them"`
	Relationship  string        `json:"relationship"`
	Score         int           `json:"score"`
	SharedArtists []ArtistMatch `json:"sharedArtists"`
	SharedTracks  []TrackMatch  `json:"sharedTracks"`
	YourArtists   []ArtistMatch `json:"yourUniqueArtists"`
	TheirArtists  []ArtistMatch `json:"theirUniqueArtists"`
	Insight       string        `json:"insight"`
}

type tasteProfile struct {
	Artists []ArtistMatch
	Tracks  []TrackMatch
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", getCompatibility)
	rg.GET("/:userID", getCompatibility)
}

// @Summary Get Music Compatibility
// @Description Check music compatibility with another user
// @Tags compatibility
// @Produce json
// @Param userID path string false "User ID to compare against"
// @Param user_id query string false "User ID to compare against"
// @Success 200 {object} CompatibilityResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Security Bearer
// @Router /compatibility/{userID} [get]
func getCompatibility(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		log.Printf("compatibility: unauthenticated request path=%s", c.Request.URL.String())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	targetUserID := strings.TrimSpace(c.Param("userID"))
	if targetUserID == "" {
		targetUserID = strings.TrimSpace(c.Query("user_id"))
	}
	if targetUserID == "" {
		log.Printf("compatibility: missing target user current_user=%s path=%s", userID, c.Request.URL.String())
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	log.Printf("compatibility: request current_user=%s target_user=%s path=%s", userID, targetUserID, c.Request.URL.String())

	client := supabase.GetClient()
	if client == nil {
		log.Printf("compatibility: database client unavailable current_user=%s target_user=%s", userID, targetUserID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	usersByID, err := loadUsers(client, []string{userID, targetUserID})
	if err != nil {
		log.Printf("compatibility: failed to load users current_user=%s target_user=%s error=%v", userID, targetUserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users"})
		return
	}

	you, ok := usersByID[userID]
	if !ok {
		log.Printf("compatibility: current user not found current_user=%s target_user=%s loaded_users=%d", userID, targetUserID, len(usersByID))
		c.JSON(http.StatusNotFound, gin.H{"error": "Current user not found"})
		return
	}
	them, ok := usersByID[targetUserID]
	if !ok {
		log.Printf("compatibility: target user not found current_user=%s target_user=%s loaded_users=%d", userID, targetUserID, len(usersByID))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	relationship, err := friends.GetRelationship(userID, targetUserID)
	if err != nil {
		log.Printf("compatibility: failed to resolve relationship current_user=%s target_user=%s error=%v", userID, targetUserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve relationship"})
		return
	}

	yourTaste := loadTasteProfile(userID)
	theirTaste := loadTasteProfile(targetUserID)

	sharedArtistCount := countSharedArtists(yourTaste.Artists, theirTaste.Artists)
	sharedTrackCount := countSharedTracks(yourTaste.Tracks, theirTaste.Tracks)
	sharedArtists, yourArtists, theirArtists := compareArtists(yourTaste.Artists, theirTaste.Artists, 10)
	sharedTracks := compareTracks(yourTaste.Tracks, theirTaste.Tracks, 8)

	calculatedScore := calculateScore(yourTaste, theirTaste, sharedArtistCount, sharedTrackCount)
	score := calculatedScore
	if score <= 0 {
		storedScore, err := loadStoredScore(client, userID, targetUserID)
		if err != nil {
			log.Printf("compatibility: no stored score current_user=%s target_user=%s error=%v", userID, targetUserID, err)
		}
		if storedScore > 0 {
			score = storedScore
		}
	}

	response := CompatibilityResponse{
		You:           you,
		Them:          them,
		Relationship:  relationship.Status,
		Score:         clampScore(score),
		SharedArtists: sharedArtists,
		SharedTracks:  sharedTracks,
		YourArtists:   limitArtists(yourArtists, 10),
		TheirArtists:  limitArtists(theirArtists, 10),
		Insight:       buildInsight(score, sharedArtists, sharedTracks, yourArtists, theirArtists),
	}

	logCompatibilityResponse(userID, targetUserID, yourTaste, theirTaste, response)
	c.JSON(http.StatusOK, response)
}

func logCompatibilityResponse(userID string, targetUserID string, yourTaste tasteProfile, theirTaste tasteProfile, response CompatibilityResponse) {
	responseJSON, err := json.Marshal(response)
	if err != nil {
		log.Printf("compatibility: response current_user=%s target_user=%s score=%d relationship=%s shared_artists=%d shared_tracks=%d your_artists=%d their_artists=%d marshal_error=%v",
			userID,
			targetUserID,
			response.Score,
			response.Relationship,
			len(response.SharedArtists),
			len(response.SharedTracks),
			len(response.YourArtists),
			len(response.TheirArtists),
			err,
		)
		return
	}

	log.Printf("compatibility: response current_user=%s target_user=%s score=%d relationship=%s taste_counts={your_artists:%d your_tracks:%d their_artists:%d their_tracks:%d} shared_artists=%d shared_tracks=%d data=%s",
		userID,
		targetUserID,
		response.Score,
		response.Relationship,
		len(yourTaste.Artists),
		len(yourTaste.Tracks),
		len(theirTaste.Artists),
		len(theirTaste.Tracks),
		len(response.SharedArtists),
		len(response.SharedTracks),
		string(responseJSON),
	)
}

func loadUsers(client any, userIDs []string) (map[string]UserSummary, error) {
	supabaseClient, ok := client.(interface {
		From(string) *postgrest.QueryBuilder
	})
	if !ok {
		return nil, fmt.Errorf("invalid database client")
	}

	ids := uniqueStrings(userIDs)
	if len(ids) == 0 {
		return map[string]UserSummary{}, nil
	}

	data, _, err := supabaseClient.From("users").
		Select("id,username,avatar_id", "", false).
		In("id", ids).
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	users := make(map[string]UserSummary, len(rows))
	for _, row := range rows {
		id := toString(row["id"])
		if id == "" {
			continue
		}
		users[id] = UserSummary{
			ID:       id,
			Username: toString(row["username"]),
			AvatarID: toString(row["avatar_id"]),
		}
	}

	return users, nil
}

func loadTasteProfile(userID string) tasteProfile {
	if profile, ok := loadSpotifyTasteProfile(userID); ok {
		return profile
	}
	return loadListeningActivityTasteProfile(userID)
}

func loadSpotifyTasteProfile(userID string) (tasteProfile, bool) {
	spotifyClient, _, err := spotify.GetAuthorizedClient(userID)
	if err != nil || spotifyClient == nil {
		return tasteProfile{}, false
	}

	profile := tasteProfile{}

	if artists, err := spotifyClient.GetTopArtists("short_term"); err == nil {
		for _, artist := range artists {
			if len(profile.Artists) == 20 {
				break
			}
			profile.Artists = append(profile.Artists, ArtistMatch{
				Name:     artist.Name,
				ImageURL: artist.ImageURL,
				Genres:   artist.Genres,
				Rank:     artist.Rank,
			})
		}
	}

	if tracks, err := spotifyClient.GetTopTracks("short_term"); err == nil {
		for _, track := range tracks {
			if len(profile.Tracks) == 20 {
				break
			}
			profile.Tracks = append(profile.Tracks, TrackMatch{
				Name:     track.Name,
				Artist:   track.Artist,
				Album:    track.Album,
				ImageURL: track.AlbumArt,
				Rank:     track.Rank,
			})
		}
	}

	return profile, len(profile.Artists) > 0 || len(profile.Tracks) > 0
}

func loadListeningActivityTasteProfile(userID string) tasteProfile {
	client := supabase.GetClient()
	if client == nil {
		return tasteProfile{}
	}

	data, _, err := client.From("listening_activity").
		Select("track_name,artist_name,album_name,album_art_url", "", false).
		Eq("user_id", userID).
		Order("played_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(250, "").
		Execute()
	if err != nil {
		return tasteProfile{}
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return tasteProfile{}
	}

	artistCounts := map[string]int{}
	artistImages := map[string]string{}
	trackCounts := map[string]int{}
	tracksByKey := map[string]TrackMatch{}

	for _, row := range rows {
		artist := strings.TrimSpace(toString(row["artist_name"]))
		track := strings.TrimSpace(toString(row["track_name"]))
		imageURL := toString(row["album_art_url"])
		if artist != "" {
			artistCounts[artist]++
			if artistImages[normalizeKey(artist)] == "" {
				artistImages[normalizeKey(artist)] = imageURL
			}
		}
		if track != "" && artist != "" {
			key := normalizeKey(track + "::" + artist)
			trackCounts[key]++
			if _, exists := tracksByKey[key]; !exists {
				tracksByKey[key] = TrackMatch{
					Name:     track,
					Artist:   artist,
					Album:    toString(row["album_name"]),
					ImageURL: imageURL,
				}
			}
		}
	}

	artistNames := make([]string, 0, len(artistCounts))
	for artist := range artistCounts {
		artistNames = append(artistNames, artist)
	}
	sort.SliceStable(artistNames, func(i, j int) bool {
		if artistCounts[artistNames[i]] != artistCounts[artistNames[j]] {
			return artistCounts[artistNames[i]] > artistCounts[artistNames[j]]
		}
		return artistNames[i] < artistNames[j]
	})

	trackKeys := make([]string, 0, len(trackCounts))
	for key := range trackCounts {
		trackKeys = append(trackKeys, key)
	}
	sort.SliceStable(trackKeys, func(i, j int) bool {
		if trackCounts[trackKeys[i]] != trackCounts[trackKeys[j]] {
			return trackCounts[trackKeys[i]] > trackCounts[trackKeys[j]]
		}
		return trackKeys[i] < trackKeys[j]
	})

	profile := tasteProfile{}
	for i, artist := range artistNames {
		if len(profile.Artists) == 20 {
			break
		}
		profile.Artists = append(profile.Artists, ArtistMatch{
			Name:     artist,
			ImageURL: artistImages[normalizeKey(artist)],
			Rank:     i + 1,
		})
	}
	for i, key := range trackKeys {
		if len(profile.Tracks) == 20 {
			break
		}
		track := tracksByKey[key]
		track.Rank = i + 1
		profile.Tracks = append(profile.Tracks, track)
	}

	return profile
}

func loadStoredScore(client any, userID string, targetUserID string) (int, error) {
	supabaseClient, ok := client.(interface {
		From(string) *postgrest.QueryBuilder
	})
	if !ok {
		return 0, fmt.Errorf("invalid database client")
	}

	data, _, err := supabaseClient.From("compatibility_scores").
		Select("score", "", false).
		Or(
			fmt.Sprintf(
				"and(user_id_1.eq.%s,user_id_2.eq.%s),and(user_id_1.eq.%s,user_id_2.eq.%s)",
				userID,
				targetUserID,
				targetUserID,
				userID,
			),
			"",
		).
		Limit(1, "").
		Execute()
	if err != nil {
		return 0, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil || len(rows) == 0 {
		return 0, err
	}

	return toInt(rows[0]["score"]), nil
}

func compareArtists(yours []ArtistMatch, theirs []ArtistMatch, limit int) ([]ArtistMatch, []ArtistMatch, []ArtistMatch) {
	theirsByKey := make(map[string]ArtistMatch, len(theirs))
	for _, artist := range theirs {
		theirsByKey[normalizeKey(artist.Name)] = artist
	}

	shared := []ArtistMatch{}
	yourUnique := []ArtistMatch{}
	seenShared := map[string]struct{}{}
	for _, artist := range yours {
		key := normalizeKey(artist.Name)
		if key == "" {
			continue
		}
		if match, ok := theirsByKey[key]; ok {
			seenShared[key] = struct{}{}
			shared = append(shared, mergeArtist(artist, match))
		} else {
			yourUnique = append(yourUnique, artist)
		}
	}

	yoursByKey := make(map[string]struct{}, len(yours))
	for _, artist := range yours {
		yoursByKey[normalizeKey(artist.Name)] = struct{}{}
	}

	theirUnique := []ArtistMatch{}
	for _, artist := range theirs {
		key := normalizeKey(artist.Name)
		if key == "" {
			continue
		}
		if _, ok := yoursByKey[key]; !ok {
			theirUnique = append(theirUnique, artist)
		}
		if _, ok := seenShared[key]; ok {
			continue
		}
	}

	return limitArtists(shared, limit), yourUnique, theirUnique
}

func compareTracks(yours []TrackMatch, theirs []TrackMatch, limit int) []TrackMatch {
	theirsByKey := make(map[string]TrackMatch, len(theirs))
	for _, track := range theirs {
		theirsByKey[trackKey(track)] = track
	}

	shared := []TrackMatch{}
	for _, track := range yours {
		if match, ok := theirsByKey[trackKey(track)]; ok {
			if track.ImageURL == "" {
				track.ImageURL = match.ImageURL
			}
			if track.Album == "" {
				track.Album = match.Album
			}
			shared = append(shared, track)
		}
		if len(shared) == limit {
			break
		}
	}

	return shared
}

func countSharedArtists(yours []ArtistMatch, theirs []ArtistMatch) int {
	theirsByKey := make(map[string]struct{}, len(theirs))
	for _, artist := range theirs {
		key := normalizeKey(artist.Name)
		if key != "" {
			theirsByKey[key] = struct{}{}
		}
	}

	count := 0
	seen := map[string]struct{}{}
	for _, artist := range yours {
		key := normalizeKey(artist.Name)
		if key == "" {
			continue
		}
		if _, alreadySeen := seen[key]; alreadySeen {
			continue
		}
		seen[key] = struct{}{}
		if _, ok := theirsByKey[key]; ok {
			count++
		}
	}

	return count
}

func countSharedTracks(yours []TrackMatch, theirs []TrackMatch) int {
	theirsByKey := make(map[string]struct{}, len(theirs))
	for _, track := range theirs {
		key := trackKey(track)
		if key != "" {
			theirsByKey[key] = struct{}{}
		}
	}

	count := 0
	seen := map[string]struct{}{}
	for _, track := range yours {
		key := trackKey(track)
		if key == "" {
			continue
		}
		if _, alreadySeen := seen[key]; alreadySeen {
			continue
		}
		seen[key] = struct{}{}
		if _, ok := theirsByKey[key]; ok {
			count++
		}
	}

	return count
}

func calculateScore(yours tasteProfile, theirs tasteProfile, sharedArtists int, sharedTracks int) int {
	if len(yours.Artists) == 0 && len(yours.Tracks) == 0 || len(theirs.Artists) == 0 && len(theirs.Tracks) == 0 {
		return 0
	}

	artistBase := math.Min(float64(len(yours.Artists)), float64(len(theirs.Artists)))
	trackBase := math.Min(float64(len(yours.Tracks)), float64(len(theirs.Tracks)))
	artistScore := 0.0
	trackScore := 0.0
	if artistBase > 0 {
		artistScore = float64(sharedArtists) / artistBase
	}
	if trackBase > 0 {
		trackScore = float64(sharedTracks) / trackBase
	}

	score := int(math.Round((artistScore*0.7 + trackScore*0.3) * 100))
	if score > 0 && score < 35 {
		score += 15
	}
	return clampScore(score)
}

func buildInsight(score int, sharedArtists []ArtistMatch, sharedTracks []TrackMatch, yourArtists []ArtistMatch, theirArtists []ArtistMatch) string {
	if len(sharedArtists) > 0 {
		return fmt.Sprintf("You both orbit %s. Start there, then trade one favorite each from your unique artists.", sharedArtists[0].Name)
	}
	if len(sharedTracks) > 0 {
		return fmt.Sprintf("%s by %s is the clearest overlap in your queues.", sharedTracks[0].Name, sharedTracks[0].Artist)
	}
	if len(yourArtists) > 0 && len(theirArtists) > 0 {
		return fmt.Sprintf("Your tastes split in interesting ways: try swapping %s for %s.", yourArtists[0].Name, theirArtists[0].Name)
	}
	if score >= 80 {
		return "Your listening patterns are closely aligned. A shared session should feel natural."
	}
	return "There is not enough listening history yet. Play more music on Chen to sharpen this match."
}

func mergeArtist(a ArtistMatch, b ArtistMatch) ArtistMatch {
	if a.ImageURL == "" {
		a.ImageURL = b.ImageURL
	}
	if len(a.Genres) == 0 {
		a.Genres = b.Genres
	}
	if a.Rank == 0 || b.Rank > 0 && b.Rank < a.Rank {
		a.Rank = b.Rank
	}
	return a
}

func limitArtists(artists []ArtistMatch, limit int) []ArtistMatch {
	if len(artists) <= limit {
		return artists
	}
	return artists[:limit]
}

func clampScore(score int) int {
	if score < 0 {
		return 0
	}
	if score > 100 {
		return 100
	}
	return score
}

func uniqueStrings(values []string) []string {
	result := []string{}
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeKey(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func trackKey(track TrackMatch) string {
	return normalizeKey(track.Name + "::" + track.Artist)
}

func toString(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}

func toInt(value any) int {
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
