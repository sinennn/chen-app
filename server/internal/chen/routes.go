package chen

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"chen/internal/auth"
	"chen/internal/friends"
	"chen/internal/spotify"
	"chen/pkg/supabase"

	gosupabase "github.com/supabase-community/supabase-go"

	"github.com/gin-gonic/gin"
)

type ChatRequest struct {
	Message string                `json:"message"`
	History []ConversationMessage `json:"history"`
}

type ChatResponse struct {
	Reply string `json:"reply"`
}

type ConversationResponse struct {
	Messages []ConversationMessage `json:"messages"`
}

type ConversationMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type musicContext struct {
	Username          string
	NowPlaying        string
	RecentTracks      string
	FriendsListening  string
	TopArtists        string
	TopTracks         string
	HasNowPlaying     bool
	HasRecentTracks   bool
	HasFriendActivity bool
	HasTasteProfile   bool
}

var conversationMessageColumnCandidates = []string{
	"messages",
	"history",
	"conversation",
	"chat_history",
	"conversation_history",
	"payload",
	"data",
	"transcript",
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/conversation", getConversation)
	rg.POST("/chat", handleChat)
}

// @Summary Get Conversation History
// @Description Fetch the Chen AI chat conversation history with music context
// @Tags chen
// @Produce json
// @Success 200 {object} ConversationResponse
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /chen/conversation [get]
func getConversation(c *gin.Context) {
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

	messages, err := loadConversationMessages(client, userID)
	if err != nil {
		fmt.Printf("Chen conversation load failed for user %s: %v\n", userID, err)
		messages = []ConversationMessage{}
	}

	if len(messages) == 0 {
		context, err := buildMusicContext(client, userID)
		if err != nil {
			fmt.Printf("Chen intro context load failed for user %s: %v\n", userID, err)
			context = defaultMusicContext()
		}

		messages = []ConversationMessage{
			{
				Role:    "assistant",
				Content: buildIntroMessage(userID, context),
			},
		}
	}

	c.JSON(http.StatusOK, ConversationResponse{Messages: messages})
}

// @Summary Chat with Chen AI
// @Description Send a message to Chen AI and get a music-aware response
// @Tags chen
// @Accept json
// @Produce json
// @Param request body ChatRequest true "User message and conversation history"
// @Success 200 {object} ChatResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /chen/chat [post]
func handleChat(c *gin.Context) {
	userID, exists := auth.GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	message := strings.TrimSpace(req.Message)
	if message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	context, err := buildMusicContext(client, userID)
	if err != nil {
		fmt.Println("User: ", userID)
		fmt.Printf("Chen context build failed for user %s: %v\n", userID, err)
		context = defaultMusicContext()
	}

	history := sanitizeConversationMessages(req.History)
	if len(history) == 0 {
		history, err = loadConversationMessages(client, userID)
		if err != nil {
			fmt.Printf("Chen history load failed for user %s: %v\n", userID, err)
			history = []ConversationMessage{}
		}
	}

	if len(history) == 0 {
		history = []ConversationMessage{
			{
				Role:    "assistant",
				Content: buildIntroMessage(userID, context),
			},
		}
	}

	systemPrompt := buildSystemPrompt(context)
	groqMessages := []map[string]interface{}{
		{"role": "system", "content": systemPrompt},
	}

	for _, msg := range history {
		groqMessages = append(groqMessages, map[string]interface{}{
			"role":    normalizeModelRole(msg.Role),
			"content": msg.Content,
		})
	}

	groqMessages = append(groqMessages, map[string]interface{}{
		"role":    "user",
		"content": message,
	})

	groqReqBody := map[string]interface{}{
		"model":       "llama-3.3-70b-versatile",
		"messages":    groqMessages,
		"max_tokens":  300,
		"temperature": 0.85,
	}

	reqBodyBytes, err := json.Marshal(groqReqBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal request"})
		return
	}

	groqAPIKey := os.Getenv("GROQ_API_KEY")
	if groqAPIKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Groq API key not configured"})
		return
	}

	httpReq, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(reqBodyBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	httpReq.Header.Set("Authorization", "Bearer "+groqAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call Groq API"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Groq API error"})
		return
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse Groq response"})
		return
	}

	if len(groqResp.Choices) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No response from Groq"})
		return
	}

	reply := strings.TrimSpace(groqResp.Choices[0].Message.Content)
	if reply == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No response from Groq"})
		return
	}

	updatedHistory := append([]ConversationMessage{}, history...)
	updatedHistory = append(updatedHistory,
		ConversationMessage{Role: "user", Content: message},
		ConversationMessage{Role: "assistant", Content: reply},
	)

	if err := saveConversationMessages(client, userID, updatedHistory); err != nil {
		fmt.Printf("Failed to save conversation: %v\n", err)
	}

	c.JSON(http.StatusOK, ChatResponse{Reply: reply})
}

func defaultMusicContext() musicContext {
	return musicContext{
		Username:          "you",
		NowPlaying:        "not playing anything right now",
		RecentTracks:      "none",
		FriendsListening:  "none",
		TopArtists:        "unavailable",
		TopTracks:         "unavailable",
		HasNowPlaying:     false,
		HasRecentTracks:   false,
		HasFriendActivity: false,
		HasTasteProfile:   false,
	}
}

func buildMusicContext(client *gosupabase.Client, userID string) (musicContext, error) {
	context := defaultMusicContext()

	userData, _, err := client.From("users").
		Select("username", "", false).
		Eq("id", userID).
		Limit(1, "").
		Execute()
	if err == nil {
		var rows []map[string]interface{}
		if json.Unmarshal(userData, &rows) == nil && len(rows) > 0 {
			if username := toString(rows[0]["username"]); username != "" {
				context.Username = username
			}
		}
	}

	nowPlayingQuery := `
		listening_activity.id,
		listening_activity.track_name,
		listening_activity.artist_name
	`
	nowPlayingData, _, err := client.From("listening_activity").
		Select(nowPlayingQuery, "", false).
		Eq("user_id", userID).
		Eq("is_playing", "true").
		Order("started_at", nil).
		Limit(1, "").
		Execute()
	if err == nil {
		var activities []map[string]interface{}
		if json.Unmarshal(nowPlayingData, &activities) == nil && len(activities) > 0 {
			track := toString(activities[0]["track_name"])
			artist := toString(activities[0]["artist_name"])
			if track != "" && artist != "" {
				context.NowPlaying = fmt.Sprintf("%s by %s", track, artist)
				context.HasNowPlaying = true
			}
		}
	}

	recentQuery := `
		listening_activity.id,
		listening_activity.track_name,
		listening_activity.artist_name
	`
	recentData, _, err := client.From("listening_activity").
		Select(recentQuery, "", false).
		Eq("user_id", userID).
		Order("started_at", nil).
		Limit(10, "").
		Execute()
	if err == nil {
		var activities []map[string]interface{}
		if json.Unmarshal(recentData, &activities) == nil && len(activities) > 0 {
			recentTracks := make([]string, 0, len(activities))
			for _, activity := range activities {
				track := toString(activity["track_name"])
				artist := toString(activity["artist_name"])
				if track == "" || artist == "" {
					continue
				}
				recentTracks = append(recentTracks, fmt.Sprintf("%s by %s", track, artist))
			}
			if len(recentTracks) > 0 {
				context.RecentTracks = strings.Join(recentTracks, ", ")
				context.HasRecentTracks = true
			}
		}
	}

	friendIDs, friendErr := friends.GetAcceptedFriendIDs(userID)
	if friendErr == nil && len(friendIDs) > 0 {
		friendsQuery := `
			listening_activity.id,
			listening_activity.track_name,
			listening_activity.artist_name,
			listening_activity.user_id
		`
		friendsData, _, err := client.From("listening_activity").
			Select(friendsQuery, "", false).
			In("user_id", friendIDs).
			Eq("is_playing", "true").
			Order("started_at", nil).
			Limit(5, "").
			Execute()
		if err == nil {
			var activities []map[string]interface{}
			if json.Unmarshal(friendsData, &activities) == nil && len(activities) > 0 {
				usernamesByID, usernameErr := loadUsernamesByID(client, friendIDs)
				if usernameErr != nil {
					fmt.Printf("Chen friend username lookup failed for user %s: %v\n", userID, usernameErr)
				}

				friendsListening := make([]string, 0, len(activities))
				for _, activity := range activities {
					track := toString(activity["track_name"])
					artist := toString(activity["artist_name"])
					if track == "" || artist == "" {
						continue
					}

					username := usernamesByID[toString(activity["user_id"])]
					if username == "" {
						continue
					}

					friendsListening = append(friendsListening, fmt.Sprintf("%s: %s by %s", username, track, artist))
				}

				if len(friendsListening) > 0 {
					context.FriendsListening = strings.Join(friendsListening, ", ")
					context.HasFriendActivity = true
				}
			}
		} else {
			fmt.Printf("Chen friend activity lookup failed for user %s: %v\n", userID, err)
		}
	} else if friendErr != nil {
		fmt.Printf("Chen friend lookup failed for user %s: %v\n", userID, friendErr)
	}

	spotifyClient, _, spotifyErr := spotify.GetAuthorizedClient(userID)
	if spotifyErr == nil {
		topArtists, artistsErr := spotifyClient.GetTopArtists("short_term")
		if artistsErr == nil {
			if summary := summarizeTopArtists(topArtists, 3); summary != "" {
				context.TopArtists = summary
				context.HasTasteProfile = true
			}
		} else {
			fmt.Printf("Chen top artists lookup failed for user %s: %v\n", userID, artistsErr)
		}

		topTracks, tracksErr := spotifyClient.GetTopTracks("short_term")
		if tracksErr == nil {
			if summary := summarizeTopTracks(topTracks, 3); summary != "" {
				context.TopTracks = summary
				context.HasTasteProfile = true
			}
		} else {
			fmt.Printf("Chen top tracks lookup failed for user %s: %v\n", userID, tracksErr)
		}
	} else if spotifyErr != nil && !errors.Is(spotifyErr, spotify.ErrNoSpotifyConnection) && !spotify.IsRateLimitError(spotifyErr) {
		fmt.Printf("Chen Spotify context skipped for user %s: %v\n", userID, spotifyErr)
	}

	return context, nil
}

func buildSystemPrompt(context musicContext) string {
	return fmt.Sprintf(`
You are Chen, a music AI companion. You are intimate, perceptive, and deeply knowledgeable about music. You speak like a close friend who really gets music — warm, direct, no corporate speak. You know what the user is listening to and use that context naturally.
Use only facts supported by the context below. If the context is thin or missing, say so naturally and ask a question instead of inventing patterns, habits, or friend activity.

Current user context:
- Username: %s
- Now playing: %s
- Recently played: %s
- Accepted friends currently listening: %s
- Top artists from Spotify: %s
- Top tracks from Spotify: %s
- Context confidence: now_playing=%t, recent_history=%t, friend_activity=%t, spotify_taste=%t

Keep responses concise — 2-4 sentences max unless the user asks for something detailed. Never say you are an AI. Never break character.
	`, context.Username, context.NowPlaying, context.RecentTracks, context.FriendsListening, context.TopArtists, context.TopTracks, context.HasNowPlaying, context.HasRecentTracks, context.HasFriendActivity, context.HasTasteProfile)
}

func buildIntroMessage(userID string, context musicContext) string {
	intros := []string{
		"hey %s. i'm tuned into your side of chen. what are we unpacking tonight?",
		"%s, i'm here and listening. want to talk about what you're playing or chase a new mood?",
		"good to see you, %s. bring me the feeling and i'll bring the soundtrack.",
		"%s, your room already has a sound to it. tell me what you want more of.",
	}

	index := deterministicIndex(userID, len(intros))
	base := fmt.Sprintf(intros[index], context.Username)

	switch {
	case context.NowPlaying != "not playing anything right now":
		return fmt.Sprintf("%s you started with %s, which already tells me a lot.", base, context.NowPlaying)
	case context.RecentTracks != "none":
		recent := context.RecentTracks
		if len(recent) > 80 {
			recent = recent[:80] + "..."
		}
		return fmt.Sprintf("%s your recent trail is %s.", base, recent)
	default:
		return fmt.Sprintf("%s we can start anywhere: a song, a mood, or a person you can't stop replaying.", base)
	}
}

func deterministicIndex(seed string, size int) int {
	if size <= 0 {
		return 0
	}

	total := 0
	for _, char := range seed {
		total = (total*31 + int(char)) % 100000
	}

	if total < 0 {
		total *= -1
	}

	return total % size
}

func summarizeTopArtists(artists []spotify.TopArtist, limit int) string {
	if len(artists) == 0 || limit <= 0 {
		return ""
	}

	parts := make([]string, 0, min(limit, len(artists)))
	for _, artist := range artists[:min(limit, len(artists))] {
		if strings.TrimSpace(artist.Name) == "" {
			continue
		}

		if len(artist.Genres) > 0 && strings.TrimSpace(artist.Genres[0]) != "" {
			parts = append(parts, fmt.Sprintf("%s (%s)", artist.Name, artist.Genres[0]))
			continue
		}

		parts = append(parts, artist.Name)
	}

	return strings.Join(parts, ", ")
}

func summarizeTopTracks(tracks []spotify.TopTrack, limit int) string {
	if len(tracks) == 0 || limit <= 0 {
		return ""
	}

	parts := make([]string, 0, min(limit, len(tracks)))
	for _, track := range tracks[:min(limit, len(tracks))] {
		if strings.TrimSpace(track.Name) == "" || strings.TrimSpace(track.Artist) == "" {
			continue
		}

		parts = append(parts, fmt.Sprintf("%s by %s", track.Name, track.Artist))
	}

	return strings.Join(parts, ", ")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func loadConversationMessages(client *gosupabase.Client, userID string) ([]ConversationMessage, error) {
	data, _, err := client.From("chen_conversations").
		Select("messages", "", false).
		Eq("user_id", userID).
		Limit(1, "").
		Execute()
	if err != nil {
		if isMissingConversationColumnError(err, "messages") {
			return loadConversationMessagesFromAnyColumn(client, userID)
		}
		return nil, err
	}
	if len(data) == 0 || strings.TrimSpace(string(data)) == "null" {
		return []ConversationMessage{}, nil
	}

	var rows []map[string]interface{}
	if err := json.Unmarshal(data, &rows); err != nil {
		var row map[string]interface{}
		if singleErr := json.Unmarshal(data, &row); singleErr != nil {
			return nil, err
		}
		return normalizeStoredMessages(row["messages"]), nil
	}

	if len(rows) == 0 {
		return []ConversationMessage{}, nil
	}

	return normalizeStoredMessages(rows[0]["messages"]), nil
}

func saveConversationMessages(client *gosupabase.Client, userID string, messages []ConversationMessage) error {
	err := upsertConversationMessagesWithColumn(client, userID, "messages", messages, true)
	if err == nil || !isMissingConversationColumnError(err, "messages") {
		return err
	}

	var lastErr error = err
	for _, column := range conversationMessageColumnCandidates {
		if column == "messages" {
			continue
		}

		if upsertErr := upsertConversationMessagesWithColumn(client, userID, column, messages, true); upsertErr == nil {
			return nil
		} else if isMissingConversationColumnError(upsertErr, column) || isMissingConversationColumnError(upsertErr, "updated_at") {
			if retryErr := upsertConversationMessagesWithColumn(client, userID, column, messages, false); retryErr == nil {
				return nil
			} else if isMissingConversationColumnError(retryErr, column) || isMissingConversationColumnError(retryErr, "updated_at") {
				lastErr = retryErr
				continue
			} else {
				return retryErr
			}
		} else {
			return upsertErr
		}
	}

	return lastErr
}

func loadConversationMessagesFromAnyColumn(client *gosupabase.Client, userID string) ([]ConversationMessage, error) {
	data, _, err := client.From("chen_conversations").
		Select("*", "", false).
		Eq("user_id", userID).
		Limit(1, "").
		Execute()
	if err != nil {
		return nil, err
	}
	if len(data) == 0 || strings.TrimSpace(string(data)) == "null" {
		return []ConversationMessage{}, nil
	}

	var rows []map[string]interface{}
	if err := json.Unmarshal(data, &rows); err != nil {
		var row map[string]interface{}
		if singleErr := json.Unmarshal(data, &row); singleErr != nil {
			return nil, err
		}
		return normalizeStoredMessagesFromRow(row), nil
	}

	if len(rows) == 0 {
		return []ConversationMessage{}, nil
	}

	return normalizeStoredMessagesFromRow(rows[0]), nil
}

func normalizeStoredMessagesFromRow(row map[string]interface{}) []ConversationMessage {
	for _, column := range conversationMessageColumnCandidates {
		if value, ok := row[column]; ok {
			messages := normalizeStoredMessages(value)
			if len(messages) > 0 {
				return messages
			}
		}
	}

	return []ConversationMessage{}
}

func upsertConversationMessagesWithColumn(client *gosupabase.Client, userID, column string, messages []ConversationMessage, includeUpdatedAt bool) error {
	conversationData := map[string]interface{}{
		"user_id": userID,
		column:    messages,
	}
	if includeUpdatedAt {
		conversationData["updated_at"] = time.Now().UTC()
	}

	_, _, err := client.From("chen_conversations").
		Upsert(conversationData, "user_id", "", "").
		Execute()
	return err
}

func isMissingConversationColumnError(err error, column string) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	column = strings.ToLower(strings.TrimSpace(column))
	if column == "" {
		return false
	}

	return strings.Contains(message, "(42703)") &&
		strings.Contains(message, "chen_conversations") &&
		strings.Contains(message, "."+column) &&
		strings.Contains(message, "does not exist")
}

func sanitizeConversationMessages(messages []ConversationMessage) []ConversationMessage {
	sanitized := make([]ConversationMessage, 0, len(messages))
	for _, msg := range messages {
		content := strings.TrimSpace(msg.Content)
		if content == "" {
			continue
		}

		role := normalizeConversationRole(msg.Role)
		if role == "" {
			continue
		}

		sanitized = append(sanitized, ConversationMessage{
			Role:    role,
			Content: content,
		})
	}

	return sanitized
}

func loadUsernamesByID(client *gosupabase.Client, userIDs []string) (map[string]string, error) {
	if len(userIDs) == 0 {
		return map[string]string{}, nil
	}

	data, _, err := client.From("users").
		Select("id,username", "", false).
		In("id", userIDs).
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	usernamesByID := make(map[string]string, len(rows))
	for _, row := range rows {
		id := strings.TrimSpace(toString(row["id"]))
		username := strings.TrimSpace(toString(row["username"]))
		if id == "" || username == "" {
			continue
		}
		usernamesByID[id] = username
	}

	return usernamesByID, nil
}

func normalizeStoredMessages(raw interface{}) []ConversationMessage {
	switch typed := raw.(type) {
	case string:
		var decoded interface{}
		if err := json.Unmarshal([]byte(typed), &decoded); err != nil {
			return []ConversationMessage{}
		}
		return normalizeStoredMessages(decoded)
	case []byte:
		var decoded interface{}
		if err := json.Unmarshal(typed, &decoded); err != nil {
			return []ConversationMessage{}
		}
		return normalizeStoredMessages(decoded)
	}

	rawMessages, ok := raw.([]interface{})
	if !ok {
		return []ConversationMessage{}
	}

	messages := make([]ConversationMessage, 0, len(rawMessages))
	for _, entry := range rawMessages {
		payload, ok := entry.(map[string]interface{})
		if !ok {
			continue
		}

		content := strings.TrimSpace(toString(payload["content"]))
		if content == "" {
			continue
		}

		role := normalizeConversationRole(toString(payload["role"]))
		if role == "" {
			continue
		}

		messages = append(messages, ConversationMessage{
			Role:    role,
			Content: content,
		})
	}

	return messages
}

func normalizeConversationRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "user":
		return "user"
	case "assistant", "chen":
		return "assistant"
	default:
		return ""
	}
}

func normalizeModelRole(role string) string {
	if normalizeConversationRole(role) == "user" {
		return "user"
	}
	return "assistant"
}

func toString(value interface{}) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}
