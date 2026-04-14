package notifications

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
	"github.com/supabase-community/postgrest-go"
)

type NotificationActor struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	AvatarID string `json:"avatar_id"`
}

type NotificationItem struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	EntityID  string                 `json:"entity_id,omitempty"`
	Metadata  map[string]any         `json:"metadata"`
	ReadAt    string                 `json:"read_at,omitempty"`
	CreatedAt string                 `json:"created_at"`
	Actor     *NotificationActor     `json:"actor,omitempty"`
}

type NotificationListResponse struct {
	Items       []NotificationItem `json:"items"`
	UnreadCount int                `json:"unreadCount"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", listNotifications)
	rg.GET("/unread-count", getUnreadCount)
	rg.POST("/:id/read", markNotificationRead)
	rg.POST("/read-all", markAllNotificationsRead)
	rg.POST("/push-token", registerPushTokenRoute)
	rg.POST("/listening-insight", generateListeningInsightRoute)
}

func CreateNotification(userID, actorID, notificationType, title, body, entityID string, metadata map[string]any) error {
	client := supabase.GetClient()
	if client == nil {
		return fmt.Errorf("database connection failed")
	}

	payload := map[string]any{
		"user_id":  userID,
		"actor_id": actorID,
		"type":     notificationType,
		"title":    title,
		"body":     body,
		"metadata": metadata,
	}

	if metadata == nil {
		payload["metadata"] = map[string]any{}
	}
	if strings.TrimSpace(entityID) != "" {
		payload["entity_id"] = entityID
	}

	_, _, err := client.From("notifications").Insert(payload, false, "", "", "").Execute()
	return err
}

func listNotifications(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	items, unreadCount, err := loadNotifications(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load notifications"})
		return
	}

	c.JSON(http.StatusOK, NotificationListResponse{
		Items:       items,
		UnreadCount: unreadCount,
	})
}

func getUnreadCount(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	_, unreadCount, err := loadNotifications(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load unread notification count"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": unreadCount})
}

func markNotificationRead(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Notification ID is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	_, _, err := client.From("notifications").
		Update(map[string]any{"read_at": time.Now().UTC().Format(time.RFC3339)}, "", "").
		Eq("id", id).
		Eq("user_id", userID).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

func markAllNotificationsRead(c *gin.Context) {
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

	_, _, err := client.From("notifications").
		Update(map[string]any{"read_at": time.Now().UTC().Format(time.RFC3339)}, "", "").
		Eq("user_id", userID).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notifications marked as read"})
}

func registerPushTokenRoute(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var payload pushTokenPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid push token payload"})
		return
	}

	if err := registerPushToken(userID, payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register push token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Push token registered"})
}

func generateListeningInsightRoute(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	item, err := GenerateListeningInsightForUser(userID, time.Now().UTC())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate listening insight"})
		return
	}
	if item == nil {
		c.JSON(http.StatusOK, gin.H{"message": "No insight generated"})
		return
	}

	c.JSON(http.StatusOK, item)
}

func loadNotifications(userID string) ([]NotificationItem, int, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, 0, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("notifications").
		Select("id,actor_id,type,title,body,entity_id,metadata,read_at,created_at", "", false).
		Eq("user_id", userID).
		Order("created_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(50, "").
		Execute()
	if err != nil {
		return nil, 0, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, 0, err
	}

	actorIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		actorID := toString(row["actor_id"])
		if actorID != "" {
			actorIDs = append(actorIDs, actorID)
		}
	}

	actorsByID, err := loadNotificationActors(actorIDs)
	if err != nil {
		return nil, 0, err
	}

	items := make([]NotificationItem, 0, len(rows))
	unreadCount := 0
	for _, row := range rows {
		readAt := toString(row["read_at"])
		if strings.TrimSpace(readAt) == "" {
			unreadCount++
		}

		item := NotificationItem{
			ID:        toString(row["id"]),
			Type:      toString(row["type"]),
			Title:     toString(row["title"]),
			Body:      toString(row["body"]),
			EntityID:  toString(row["entity_id"]),
			Metadata:  toMap(row["metadata"]),
			ReadAt:    readAt,
			CreatedAt: toString(row["created_at"]),
			Actor:     actorsByID[toString(row["actor_id"])],
		}
		items = append(items, item)
	}

	return items, unreadCount, nil
}

func loadNotificationActors(userIDs []string) (map[string]*NotificationActor, error) {
	uniqueIDs := uniqueStrings(userIDs)
	if len(uniqueIDs) == 0 {
		return map[string]*NotificationActor{}, nil
	}

	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("users").
		Select("id,username,avatar_id", "", false).
		In("id", uniqueIDs).
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	result := make(map[string]*NotificationActor, len(rows))
	for _, row := range rows {
		id := toString(row["id"])
		if id == "" {
			continue
		}
		result[id] = &NotificationActor{
			ID:       id,
			Username: toString(row["username"]),
			AvatarID: toString(row["avatar_id"]),
		}
	}

	return result, nil
}

func toString(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}

func toMap(value any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return map[string]any{}
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}

	return result
}
