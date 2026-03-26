package friends

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/pkg/supabase"

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

type SearchResult struct {
	ID                 string `json:"id"`
	Username           string `json:"username"`
	UserTag            string `json:"user_tag,omitempty"`
	AvatarID           string `json:"avatar_id"`
	RelationshipStatus string `json:"relationship_status"`
}

type Recommendation struct {
	ID            string        `json:"id"`
	Username      string        `json:"username"`
	UserTag       string        `json:"user_tag,omitempty"`
	AvatarID      string        `json:"avatar_id"`
	Compatibility int           `json:"compatibility"`
	IsOnline      bool          `json:"is_online"`
	CurrentTrack  *ActivityItem `json:"current_track,omitempty"`
}

type AddFriendRequest struct {
	Username string `json:"username" binding:"required"`
}

type FriendshipActionRequest struct {
	FriendshipID string `json:"friendship_id" binding:"required"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", getFriends)
	rg.GET("/search", searchUsers)
	rg.GET("/recommendations", getRecommendations)
	rg.POST("/add", addFriend)
	rg.POST("/accept", acceptFriend)
	rg.POST("/decline", declineFriend)
}

func getFriends(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	friendIDs, err := GetAcceptedFriendIDs(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch friendships"})
		return
	}
	if len(friendIDs) == 0 {
		c.JSON(http.StatusOK, []Friend{})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	usersData, _, err := client.From("users").
		Select("id,username,avatar_id", "", false).
		In("id", friendIDs).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch friends"})
		return
	}

	var userRows []map[string]any
	if err := json.Unmarshal(usersData, &userRows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse friends"})
		return
	}

	compatibilityByFriend, _ := getCompatibilityScores(userID)
	latestActivityByFriend, _ := getLatestActivity(friendIDs)

	friendsList := make([]Friend, 0, len(userRows))
	for _, row := range userRows {
		friendID := toString(row["id"])
		activity := latestActivityByFriend[friendID]

		friendsList = append(friendsList, Friend{
			ID:            friendID,
			Username:      toString(row["username"]),
			AvatarID:      toString(row["avatar_id"]),
			Compatibility: compatibilityByFriend[friendID],
			IsOnline:      activity != nil && activity.IsPlaying,
			CurrentTrack:  activity,
		})
	}

	sort.SliceStable(friendsList, func(i, j int) bool {
		if friendsList[i].IsOnline != friendsList[j].IsOnline {
			return friendsList[i].IsOnline
		}
		return friendsList[i].Compatibility > friendsList[j].Compatibility
	})

	c.JSON(http.StatusOK, friendsList)
}

func searchUsers(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	query := strings.TrimSpace(strings.ToLower(c.Query("q")))
	if len(query) < 2 {
		c.JSON(http.StatusOK, []SearchResult{})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	data, _, err := client.From("users").
		Select("id,username,user_tag,avatar_id", "", false).
		Neq("id", userID).
		Or(
			fmt.Sprintf("username.ilike.%s%%,user_tag.ilike.%s%%", query, query),
			"",
		).
		Limit(25, "").
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search users"})
		return
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse search results"})
		return
	}

	results := make([]SearchResult, 0, len(rows))
	for _, row := range rows {
		candidateID := toString(row["id"])

		relationship, err := GetRelationship(userID, candidateID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve relationship state"})
			return
		}

		results = append(results, SearchResult{
			ID:                 candidateID,
			Username:           toString(row["username"]),
			UserTag:            toString(row["user_tag"]),
			AvatarID:           toString(row["avatar_id"]),
			RelationshipStatus: relationship.Status,
		})

		if len(results) == 10 {
			break
		}
	}

	c.JSON(http.StatusOK, results)
}

func getRecommendations(c *gin.Context) {
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

	compatibilityByUser, err := getCompatibilityScores(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch compatibility scores"})
		return
	}

	relationshipUserIDs, err := getRelationshipUserIDs(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve existing relationships"})
		return
	}

	excludedUserIDs := make(map[string]struct{}, len(relationshipUserIDs)+1)
	excludedUserIDs[userID] = struct{}{}
	for _, relatedUserID := range relationshipUserIDs {
		excludedUserIDs[relatedUserID] = struct{}{}
	}

	candidateIDs := make([]string, 0, len(compatibilityByUser))
	for candidateID, score := range compatibilityByUser {
		if score <= 0 {
			continue
		}
		if _, excluded := excludedUserIDs[candidateID]; excluded {
			continue
		}

		candidateIDs = append(candidateIDs, candidateID)
	}

	if len(candidateIDs) == 0 {
		c.JSON(http.StatusOK, []Recommendation{})
		return
	}

	sort.SliceStable(candidateIDs, func(i, j int) bool {
		if compatibilityByUser[candidateIDs[i]] != compatibilityByUser[candidateIDs[j]] {
			return compatibilityByUser[candidateIDs[i]] > compatibilityByUser[candidateIDs[j]]
		}
		return candidateIDs[i] < candidateIDs[j]
	})

	if len(candidateIDs) > 12 {
		candidateIDs = candidateIDs[:12]
	}

	usersData, _, err := client.From("users").
		Select("id,username,user_tag,avatar_id", "", false).
		In("id", candidateIDs).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommended users"})
		return
	}

	var userRows []map[string]any
	if err := json.Unmarshal(usersData, &userRows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse recommended users"})
		return
	}

	latestActivityByUser, _ := getLatestActivity(candidateIDs)
	userRowsByID := make(map[string]map[string]any, len(userRows))
	for _, row := range userRows {
		userRowsByID[toString(row["id"])] = row
	}

	recommendations := make([]Recommendation, 0, len(candidateIDs))
	for _, candidateID := range candidateIDs {
		row, ok := userRowsByID[candidateID]
		if !ok {
			continue
		}

		activity := latestActivityByUser[candidateID]
		recommendations = append(recommendations, Recommendation{
			ID:            candidateID,
			Username:      toString(row["username"]),
			UserTag:       toString(row["user_tag"]),
			AvatarID:      toString(row["avatar_id"]),
			Compatibility: compatibilityByUser[candidateID],
			IsOnline:      activity != nil && activity.IsPlaying,
			CurrentTrack:  activity,
		})
	}

	c.JSON(http.StatusOK, recommendations)
}

func addFriend(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req AddFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	username := strings.TrimSpace(strings.ToLower(req.Username))
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	userData, _, err := client.From("users").
		Select("id", "", false).
		Eq("username", username).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find user"})
		return
	}

	var users []map[string]any
	if err := json.Unmarshal(userData, &users); err != nil || len(users) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	friendID := toString(users[0]["id"])
	if friendID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot add yourself"})
		return
	}

	existingData, _, err := client.From("friendships").
		Select("id,status", "", false).
		Or(
			fmt.Sprintf(
				"and(requester_id.eq.%s,addressee_id.eq.%s),and(requester_id.eq.%s,addressee_id.eq.%s)",
				userID,
				friendID,
				friendID,
				userID,
			),
			"",
		).
		Execute()
	if err == nil {
		var existing []map[string]any
		if json.Unmarshal(existingData, &existing) == nil && len(existing) > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Friendship already exists"})
			return
		}
	}

	_, _, err = client.From("friendships").Insert(map[string]any{
		"requester_id": userID,
		"addressee_id": friendID,
		"status":       "pending",
	}, false, "", "", "").Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send friend request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request sent successfully"})
}

func acceptFriend(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
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
		Update(map[string]any{"status": "accepted"}, "", "").
		Eq("id", req.FriendshipID).
		Eq("addressee_id", userID).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept friend request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request accepted"})
}

func declineFriend(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
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
		Eq("addressee_id", userID).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decline friend request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Friend request declined"})
}

func getCompatibilityScores(userID string) (map[string]int, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("compatibility_scores").
		Select("user_id_1,user_id_2,score", "", false).
		Or(
			fmt.Sprintf("user_id_1.eq.%s,user_id_2.eq.%s", userID, userID),
			"",
		).
		Execute()
	if err != nil {
		return map[string]int{}, nil
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return map[string]int{}, nil
	}

	scores := make(map[string]int, len(rows))
	for _, row := range rows {
		user1 := toString(row["user_id_1"])
		user2 := toString(row["user_id_2"])
		score, _ := row["score"].(float64)

		if user1 == userID {
			scores[user2] = int(score)
		} else if user2 == userID {
			scores[user1] = int(score)
		}
	}

	return scores, nil
}

func getRelationshipUserIDs(userID string) ([]string, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("friendships").
		Select("requester_id,addressee_id", "", false).
		Or(
			fmt.Sprintf("requester_id.eq.%s,addressee_id.eq.%s", userID, userID),
			"",
		).
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	relatedUserIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		requesterID := toString(row["requester_id"])
		addresseeID := toString(row["addressee_id"])

		switch {
		case requesterID == userID && addresseeID != "":
			relatedUserIDs = append(relatedUserIDs, addresseeID)
		case addresseeID == userID && requesterID != "":
			relatedUserIDs = append(relatedUserIDs, requesterID)
		}
	}

	return relatedUserIDs, nil
}

func getLatestActivity(friendIDs []string) (map[string]*ActivityItem, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("listening_activity").
		Select("id,user_id,track_name,artist_name,album_name,album_art_url,platform,played_at,is_playing", "", false).
		In("user_id", friendIDs).
		Order("played_at", nil).
		Limit(100, "").
		Execute()
	if err != nil {
		return map[string]*ActivityItem{}, nil
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return map[string]*ActivityItem{}, nil
	}

	activities := make(map[string]*ActivityItem)
	for _, row := range rows {
		friendID := toString(row["user_id"])
		if _, exists := activities[friendID]; exists {
			continue
		}

		playedAt, _ := time.Parse(time.RFC3339, toString(row["played_at"]))
		activities[friendID] = &ActivityItem{
			ID:          toString(row["id"]),
			UserID:      friendID,
			TrackName:   toString(row["track_name"]),
			ArtistName:  toString(row["artist_name"]),
			AlbumName:   toString(row["album_name"]),
			AlbumArtURL: toString(row["album_art_url"]),
			Platform:    toString(row["platform"]),
			StartedAt:   playedAt,
			IsPlaying:   toBool(row["is_playing"]),
		}
	}

	return activities, nil
}

func toBool(value any) bool {
	result, ok := value.(bool)
	return ok && result
}
