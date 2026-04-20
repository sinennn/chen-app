package messages

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/internal/friends"
	"chen/internal/notifications"
	"chen/internal/referrals"
	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
	"github.com/supabase-community/postgrest-go"
)

type SendMessageRequest struct {
	Content         string         `json:"content"`
	MessageType     string         `json:"message_type"`
	AudioURL        string         `json:"audio_url"`
	AudioDurationMs int            `json:"audio_duration_ms"`
	TrackMetadata   *TrackMetadata `json:"track_metadata"`
}

type MessageFriend struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	AvatarID string `json:"avatar_id"`
}

type TrackMetadata struct {
	ActivityID  string `json:"activity_id,omitempty"`
	TrackID     string `json:"track_id,omitempty"`
	TrackName   string `json:"track_name"`
	ArtistName  string `json:"artist_name"`
	AlbumName   string `json:"album_name,omitempty"`
	AlbumArtURL string `json:"album_art_url,omitempty"`
	SpotifyURL  string `json:"spotify_url,omitempty"`
}

type MessageItem struct {
	ID              string         `json:"id"`
	SenderID        string         `json:"sender_id"`
	RecipientID     string         `json:"recipient_id"`
	Content         string         `json:"content"`
	MessageType     string         `json:"message_type"`
	AudioURL        string         `json:"audio_url,omitempty"`
	AudioDurationMs int            `json:"audio_duration_ms,omitempty"`
	TrackMetadata   *TrackMetadata `json:"track_metadata,omitempty"`
	CreatedAt       string         `json:"created_at"`
	ReadAt          string         `json:"read_at,omitempty"`
	IsMine          bool           `json:"is_mine"`
}

type ThreadSummary struct {
	Friend      MessageFriend `json:"friend"`
	LastMessage *MessageItem  `json:"lastMessage,omitempty"`
	UnreadCount int           `json:"unreadCount"`
}

type ThreadResponse struct {
	Friend   MessageFriend `json:"friend"`
	Messages []MessageItem `json:"messages"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/threads", listThreads)
	rg.GET("/:friendID", getThread)
	rg.POST("/:friendID", sendMessage)
	rg.POST("/:friendID/read", markThreadRead)
}

// @Summary List Message Threads
// @Description Fetch all active message threads for the current user
// @Tags messages
// @Produce json
// @Success 200 {array} ThreadSummary
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /messages/threads [get]
func listThreads(c *gin.Context) {
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

	data, _, err := client.From("direct_messages").
		Select("id,sender_id,recipient_id,content,message_type,audio_url,audio_duration_ms,track_metadata,created_at,read_at", "", false).
		Or(fmt.Sprintf("sender_id.eq.%s,recipient_id.eq.%s", userID, userID), "").
		Order("created_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(200, "").
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": describeMessageDBError(err, "Failed to load message threads")})
		return
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse message threads"})
		return
	}

	friendIDs := make([]string, 0, len(rows))
	threadsByFriend := make(map[string]*ThreadSummary)
	for _, row := range rows {
		senderID := toString(row["sender_id"])
		recipientID := toString(row["recipient_id"])
		friendID := senderID
		if senderID == userID {
			friendID = recipientID
		}
		if friendID == "" {
			continue
		}

		thread, exists := threadsByFriend[friendID]
		if !exists {
			friendIDs = append(friendIDs, friendID)
			thread = &ThreadSummary{}
			threadsByFriend[friendID] = thread
		}

		message := &MessageItem{
			ID:              toString(row["id"]),
			SenderID:        senderID,
			RecipientID:     recipientID,
			Content:         toString(row["content"]),
			MessageType:     normalizeMessageType(toString(row["message_type"])),
			AudioURL:        toString(row["audio_url"]),
			AudioDurationMs: toInt(row["audio_duration_ms"]),
			TrackMetadata:   parseTrackMetadata(row["track_metadata"]),
			CreatedAt:       toString(row["created_at"]),
			ReadAt:          toString(row["read_at"]),
			IsMine:          senderID == userID,
		}

		if thread.LastMessage == nil {
			thread.LastMessage = message
		}
		if recipientID == userID && strings.TrimSpace(message.ReadAt) == "" {
			thread.UnreadCount++
		}
	}

	friendsByID, err := loadMessageUsers(friendIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load message participants"})
		return
	}

	threads := make([]ThreadSummary, 0, len(friendIDs))
	for _, friendID := range friendIDs {
		thread := threadsByFriend[friendID]
		friend, ok := friendsByID[friendID]
		if !ok {
			continue
		}
		thread.Friend = friend
		threads = append(threads, *thread)
	}

	c.JSON(http.StatusOK, threads)
}

// @Summary Get Message Thread
// @Description Fetch all messages in a conversation with a specific friend
// @Tags messages
// @Produce json
// @Param friendID path string true "Friend's user ID"
// @Success 200 {object} ThreadResponse
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /messages/{friendID} [get]
func getThread(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	friendID := strings.TrimSpace(c.Param("friendID"))
	if friendID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Friend ID is required"})
		return
	}

	if err := ensureMessagingAllowed(userID, friendID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	friend, err := loadSingleMessageUser(friendID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load conversation"})
		return
	}

	messages, err := loadThreadMessages(userID, friendID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": describeMessageDBError(err, "Failed to load conversation")})
		// @Summary Send Message
		// @Description Send a message to a friend (text, audio, or track share)
		// @Tags messages
		// @Accept json
		// @Produce json
		// @Param friendID path string true "Friend's user ID"
		// @Param request body SendMessageRequest true "Message content"
		// @Success 200 {object} MessageItem
		// @Failure 400 {object} map[string]string
		// @Failure 401 {object} map[string]string
		// @Security Bearer
		// @Router /messages/{friendID} [post]
		return
	}

	c.JSON(http.StatusOK, ThreadResponse{
		Friend:   friend,
		Messages: messages,
	})
}

func sendMessage(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	friendID := strings.TrimSpace(c.Param("friendID"))
	if friendID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Friend ID is required"})
		return
	}

	if err := ensureMessagingAllowed(userID, friendID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	messageType := normalizeMessageType(req.MessageType)
	content := strings.TrimSpace(req.Content)
	audioURL := strings.TrimSpace(req.AudioURL)
	audioDurationMs := req.AudioDurationMs
	trackMetadata := normalizeTrackMetadata(req.TrackMetadata)

	if messageType == "voice" {
		voiceNotesUnlocked, unlockErr := referrals.HasPerkUnlocked(userID, referrals.PerkVoiceNotes)
		if unlockErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate voice note access"})
			return
		}
		if !voiceNotesUnlocked {
			c.JSON(http.StatusForbidden, gin.H{"error": "Voice notes unlock after 2 successful referrals"})
			return
		}
		if audioURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Voice notes require an audio URL"})
			return
		}
		if content == "" {
			content = "Voice note"
		}
	} else if messageType == "track_reply" {
		if trackMetadata == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Track replies require track metadata"})
			return
		}
		if content == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Track replies require a message"})
			return
		}
	} else if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message content is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	data, _, err := client.From("direct_messages").Insert(map[string]any{
		"sender_id":         userID,
		"recipient_id":      friendID,
		"content":           content,
		"message_type":      messageType,
		"audio_url":         audioURL,
		"audio_duration_ms": audioDurationMs,
		"track_metadata":    trackMetadata,
		"created_at":        now,
	}, false, "", "", "").Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": describeMessageDBError(err, "Failed to send message")})
		return
	}

	message := MessageItem{
		SenderID:        userID,
		RecipientID:     friendID,
		Content:         content,
		MessageType:     messageType,
		AudioURL:        audioURL,
		AudioDurationMs: audioDurationMs,
		TrackMetadata:   trackMetadata,
		CreatedAt:       now,
		IsMine:          true,
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err == nil && len(rows) > 0 {
		message.ID = toString(rows[0]["id"])
		message.CreatedAt = toString(rows[0]["created_at"])
	}
	if message.ID == "" {
		message.ID = fmt.Sprintf("message-%d", time.Now().UnixNano())
	}

	sender, err := loadSingleMessageUser(userID)
	if err == nil {
		preview := content
		if messageType == "voice" {
			preview = "Sent you a voice note"
		} else if messageType == "track_reply" {
			trackName := trackNameFromMetadata(trackMetadata)
			if trackName != "" {
				preview = fmt.Sprintf("Replied to %s: %s", trackName, content)
			}
		}
		if len(preview) > 88 {
			preview = preview[:85] + "..."
		}
		_ = notifications.CreateAndDispatchNotification(
			friendID,
			userID,
			"message",
			fmt.Sprintf("%s sent you a message", sender.Username),
			preview,
			message.ID,
			map[string]any{
				// @Summary Mark Thread as Read
				// @Description Mark all messages in a thread as read
				// @Tags messages
				// @Produce json
				// @Param friendID path string true "Friend's user ID"
				// @Success 200 {object} map[string]string
				// @Failure 401 {object} map[string]string
				// @Security Bearer
				// @Router /messages/{friendID}/read [post]
				"friendId":    userID,
				"messageId":   message.ID,
				"messageType": messageType,
				"trackName":   trackNameFromMetadata(trackMetadata),
			},
			true,
		)
	}

	c.JSON(http.StatusOK, message)
}

func markThreadRead(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	friendID := strings.TrimSpace(c.Param("friendID"))
	if friendID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Friend ID is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	_, _, err := client.From("direct_messages").
		Update(map[string]any{"read_at": time.Now().UTC().Format(time.RFC3339)}, "", "").
		Eq("sender_id", friendID).
		Eq("recipient_id", userID).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark thread as read"})
		return
	}

	_ = notifications.MarkMessageNotificationsRead(userID, friendID)

	c.JSON(http.StatusOK, gin.H{"message": "Thread marked as read"})
}

func ensureMessagingAllowed(userID, friendID string) error {
	relationship, err := friends.GetRelationship(userID, friendID)
	if err != nil {
		return fmt.Errorf("failed to resolve friendship")
	}
	if relationship.Status != friends.RelationshipStatusFriends {
		return fmt.Errorf("messaging unlocks once you are accepted friends")
	}
	return nil
}

func loadThreadMessages(userID, friendID string) ([]MessageItem, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("direct_messages").
		Select("id,sender_id,recipient_id,content,message_type,audio_url,audio_duration_ms,track_metadata,created_at,read_at", "", false).
		Or(
			fmt.Sprintf(
				"and(sender_id.eq.%s,recipient_id.eq.%s),and(sender_id.eq.%s,recipient_id.eq.%s)",
				userID,
				friendID,
				friendID,
				userID,
			),
			"",
		).
		Order("created_at", &postgrest.OrderOpts{Ascending: true}).
		Limit(150, "").
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	messages := make([]MessageItem, 0, len(rows))
	for _, row := range rows {
		senderID := toString(row["sender_id"])
		messages = append(messages, MessageItem{
			ID:              toString(row["id"]),
			SenderID:        senderID,
			RecipientID:     toString(row["recipient_id"]),
			Content:         toString(row["content"]),
			MessageType:     normalizeMessageType(toString(row["message_type"])),
			AudioURL:        toString(row["audio_url"]),
			AudioDurationMs: toInt(row["audio_duration_ms"]),
			TrackMetadata:   parseTrackMetadata(row["track_metadata"]),
			CreatedAt:       toString(row["created_at"]),
			ReadAt:          toString(row["read_at"]),
			IsMine:          senderID == userID,
		})
	}

	return messages, nil
}

func loadSingleMessageUser(userID string) (MessageFriend, error) {
	usersByID, err := loadMessageUsers([]string{userID})
	if err != nil {
		return MessageFriend{}, err
	}

	friend, ok := usersByID[userID]
	if !ok {
		return MessageFriend{}, fmt.Errorf("user not found")
	}

	return friend, nil
}

func loadMessageUsers(userIDs []string) (map[string]MessageFriend, error) {
	uniqueIDs := uniqueStrings(userIDs)
	if len(uniqueIDs) == 0 {
		return map[string]MessageFriend{}, nil
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

	result := make(map[string]MessageFriend, len(rows))
	for _, row := range rows {
		id := toString(row["id"])
		if id == "" {
			continue
		}
		result[id] = MessageFriend{
			ID:       id,
			Username: toString(row["username"]),
			AvatarID: toString(row["avatar_id"]),
		}
	}

	return result, nil
}

func uniqueStrings(values []string) []string {
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

func normalizeMessageType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "voice":
		return "voice"
	case "track_reply":
		return "track_reply"
	default:
		return "text"
	}
}

func normalizeTrackMetadata(track *TrackMetadata) *TrackMetadata {
	if track == nil {
		return nil
	}

	normalized := &TrackMetadata{
		ActivityID:  strings.TrimSpace(track.ActivityID),
		TrackID:     strings.TrimSpace(track.TrackID),
		TrackName:   strings.TrimSpace(track.TrackName),
		ArtistName:  strings.TrimSpace(track.ArtistName),
		AlbumName:   strings.TrimSpace(track.AlbumName),
		AlbumArtURL: strings.TrimSpace(track.AlbumArtURL),
		SpotifyURL:  strings.TrimSpace(track.SpotifyURL),
	}

	if normalized.TrackName == "" || normalized.ArtistName == "" {
		return nil
	}

	return normalized
}

func parseTrackMetadata(value any) *TrackMetadata {
	if value == nil {
		return nil
	}

	bytes, err := json.Marshal(value)
	if err != nil {
		return nil
	}

	var track TrackMetadata
	if err := json.Unmarshal(bytes, &track); err != nil {
		return nil
	}

	return normalizeTrackMetadata(&track)
}

func trackNameFromMetadata(track *TrackMetadata) string {
	if track == nil {
		return ""
	}

	return strings.TrimSpace(track.TrackName)
}

func describeMessageDBError(err error, fallback string) string {
	if err == nil {
		return fallback
	}

	message := strings.ToLower(strings.TrimSpace(err.Error()))
	if strings.Contains(message, "track_metadata") && strings.Contains(message, "column") {
		return "Message DB is missing the track reply migration. Run server/migrations/add_track_replies_to_direct_messages.sql"
	}

	return fallback
}
