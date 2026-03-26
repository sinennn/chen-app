package reactions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
)

type ReactionType string

const (
	reactionLove       ReactionType = "love"
	reactionFire       ReactionType = "fire"
	reactionHeadphones ReactionType = "headphones"
)

type toggleReactionRequest struct {
	ActivityID   string       `json:"activity_id" binding:"required"`
	ReactionType ReactionType `json:"reaction_type" binding:"required"`
}

type createCommentRequest struct {
	ActivityID      string `json:"activity_id" binding:"required"`
	Content         string `json:"content" binding:"required"`
	ParentCommentID string `json:"parent_comment_id"`
}

type commentResponse struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Username        string    `json:"username"`
	AvatarID        string    `json:"avatar_id"`
	Content         string    `json:"content"`
	ParentCommentID *string   `json:"parent_comment_id"`
	CreatedAt       time.Time `json:"created_at"`
}

type engagementResponse struct {
	CommentCount  int             `json:"commentCount"`
	Reactions     map[string]int  `json:"reactions"`
	UserReactions map[string]bool `json:"userReactions"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/engagement", getEngagement)
	rg.GET("/comments/:activityID", getComments)
	rg.POST("/comments", createComment)
	rg.POST("/toggle", toggleReaction)
}

func getEngagement(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	activityIDs := parseCSVList(c.Query("activity_ids"))
	if len(activityIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	commentsData, _, commentsErr := client.From("activity_comments").
		Select("activity_id", "", false).
		In("activity_id", activityIDs).
		Execute()
	if commentsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	reactionsData, _, reactionsErr := client.From("activity_reactions").
		Select("activity_id,reaction_type,user_id", "", false).
		In("activity_id", activityIDs).
		Execute()
	if reactionsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	result := make(map[string]engagementResponse, len(activityIDs))
	for _, activityID := range activityIDs {
		result[activityID] = newEngagementResponse()
	}

	var commentRows []map[string]any
	if len(commentsData) > 0 && json.Unmarshal(commentsData, &commentRows) == nil {
		for _, row := range commentRows {
			activityID := toString(row["activity_id"])
			entry, ok := result[activityID]
			if !ok {
				continue
			}

			entry.CommentCount++
			result[activityID] = entry
		}
	}

	var reactionRows []map[string]any
	if len(reactionsData) > 0 && json.Unmarshal(reactionsData, &reactionRows) == nil {
		for _, row := range reactionRows {
			activityID := toString(row["activity_id"])
			entry, ok := result[activityID]
			if !ok {
				continue
			}

			reactionType := strings.TrimSpace(toString(row["reaction_type"]))
			if _, exists := entry.Reactions[reactionType]; !exists {
				continue
			}

			entry.Reactions[reactionType]++
			if toString(row["user_id"]) == userID {
				entry.UserReactions[reactionType] = true
			}
			result[activityID] = entry
		}
	}

	c.JSON(http.StatusOK, result)
}

func getComments(c *gin.Context) {
	_, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	activityID := strings.TrimSpace(c.Param("activityID"))
	if activityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Activity ID is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	commentsData, _, commentsErr := client.From("activity_comments").
		Select("id,user_id,content,parent_comment_id,created_at", "", false).
		Eq("activity_id", activityID).
		Order("created_at", nil).
		Execute()
	if commentsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	var commentRows []map[string]any
	if len(commentsData) > 0 {
		if err := json.Unmarshal(commentsData, &commentRows); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse comments"})
			return
		}
	}

	userIDs := make([]string, 0, len(commentRows))
	seenUserIDs := make(map[string]struct{}, len(commentRows))
	for _, row := range commentRows {
		userID := toString(row["user_id"])
		if userID == "" {
			continue
		}
		if _, ok := seenUserIDs[userID]; ok {
			continue
		}

		seenUserIDs[userID] = struct{}{}
		userIDs = append(userIDs, userID)
	}

	userMap := make(map[string]map[string]any)
	if len(userIDs) > 0 {
		userData, _, userErr := client.From("users").
			Select("id,username,avatar_id", "", false).
			In("id", userIDs).
			Execute()
		if userErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comment users"})
			return
		}

		var userRows []map[string]any
		if len(userData) > 0 {
			if err := json.Unmarshal(userData, &userRows); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse comment users"})
				return
			}
			for _, row := range userRows {
				userMap[toString(row["id"])] = row
			}
		}
	}

	response := make([]commentResponse, 0, len(commentRows))
	for _, row := range commentRows {
		userInfo := userMap[toString(row["user_id"])]
		createdAt, _ := time.Parse(time.RFC3339, toString(row["created_at"]))

		var parentCommentID *string
		if value := strings.TrimSpace(toString(row["parent_comment_id"])); value != "" {
			parentCommentID = &value
		}

		response = append(response, commentResponse{
			ID:              toString(row["id"]),
			UserID:          toString(row["user_id"]),
			Username:        toString(userInfo["username"]),
			AvatarID:        toString(userInfo["avatar_id"]),
			Content:         toString(row["content"]),
			ParentCommentID: parentCommentID,
			CreatedAt:       createdAt,
		})
	}

	c.JSON(http.StatusOK, response)
}

func createComment(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req createCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment content is required"})
		return
	}

	payload := map[string]any{
		"activity_id": req.ActivityID,
		"user_id":     userID,
		"content":     content,
	}
	if strings.TrimSpace(req.ParentCommentID) != "" {
		payload["parent_comment_id"] = strings.TrimSpace(req.ParentCommentID)
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	if _, _, err := client.From("activity_comments").Insert(payload, false, "", "", "").Execute(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to post comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func toggleReaction(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req toggleReactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reactionType := strings.TrimSpace(string(req.ReactionType))
	if reactionType != string(reactionLove) && reactionType != string(reactionFire) && reactionType != string(reactionHeadphones) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reaction type"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	existingData, _, existingErr := client.From("activity_reactions").
		Select("id", "", false).
		Eq("activity_id", req.ActivityID).
		Eq("user_id", userID).
		Eq("reaction_type", reactionType).
		Limit(1, "").
		Execute()
	if existingErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check reaction"})
		return
	}

	var existingRows []map[string]any
	if len(existingData) > 0 {
		if err := json.Unmarshal(existingData, &existingRows); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse reaction state"})
			return
		}
	}

	if len(existingRows) > 0 {
		if _, _, err := client.From("activity_reactions").
			Delete("", "").
			Eq("activity_id", req.ActivityID).
			Eq("user_id", userID).
			Eq("reaction_type", reactionType).
			Execute(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove reaction"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"active": false})
		return
	}

	if _, _, err := client.From("activity_reactions").Insert(map[string]any{
		"activity_id":   req.ActivityID,
		"user_id":       userID,
		"reaction_type": reactionType,
	}, false, "", "", "").Execute(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add reaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"active": true})
}

func newEngagementResponse() engagementResponse {
	return engagementResponse{
		CommentCount: 0,
		Reactions: map[string]int{
			string(reactionLove):       0,
			string(reactionFire):       0,
			string(reactionHeadphones): 0,
		},
		UserReactions: map[string]bool{
			string(reactionLove):       false,
			string(reactionFire):       false,
			string(reactionHeadphones): false,
		},
	}
}

func parseCSVList(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func toString(value any) string {
	if value == nil {
		return ""
	}

	return strings.TrimSpace(fmt.Sprintf("%v", value))
}
