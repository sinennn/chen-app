package chen

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
)

type ChatRequest struct {
	Message string                 `json:"message"`
	History []map[string]interface{} `json:"history"`
}

type ChatResponse struct {
	Reply string `json:"reply"`
}

type ConversationMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/chat", handleChat)
}

func handleChat(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	// Get user's now playing
	nowPlayingQuery := `
		listening_activity.id,
		listening_activity.track_name,
		listening_activity.artist_name,
		users!inner(username)
	`
	nowPlayingData, _, err := client.From("listening_activity").
		Select(nowPlayingQuery, "", false).
		Eq("user_id", userIDStr).
		Eq("is_playing", "true").
		Order("started_at", nil).
		Limit(1, "").
		Execute()

	var nowPlaying string
	if err == nil && len(nowPlayingData) > 0 {
		var activity map[string]interface{}
		if err := json.Unmarshal(nowPlayingData, &activity); err == nil {
			if track, ok := activity["track_name"].(string); ok {
				if artist, ok := activity["artist_name"].(string); ok {
					nowPlaying = fmt.Sprintf("%s by %s", track, artist)
				}
			}
		}
	}
	if nowPlaying == "" {
		nowPlaying = "not playing anything right now"
	}

	// Get friends' now playing
	friendsQuery := `
		listening_activity.id,
		listening_activity.track_name,
		listening_activity.artist_name,
		listening_activity.user_id,
		users!inner(username)
	`
	friendsData, _, err := client.From("listening_activity").
		Select(friendsQuery, "", false).
		Eq("is_playing", "true").
		Order("started_at", nil).
		Limit(5, "").
		Execute()

	var friendsListening string
	if err == nil && len(friendsData) > 0 {
		var activities []map[string]interface{}
		if err := json.Unmarshal(friendsData, &activities); err == nil {
			for _, activity := range activities {
				if activityUserID, ok := activity["user_id"].(string); ok && activityUserID != userIDStr {
					if track, ok := activity["track_name"].(string); ok {
						if artist, ok := activity["artist_name"].(string); ok {
							if users, ok := activity["users"].(map[string]interface{}); ok {
								if username, ok := users["username"].(string); ok {
									if friendsListening != "" {
										friendsListening += ", "
									}
									friendsListening += fmt.Sprintf("%s: %s by %s", username, track, artist)
								}
							}
						}
					}
				}
			}
		}
	}
	if friendsListening == "" {
		friendsListening = "none"
	}

	// Get user's recent tracks
	recentQuery := `
		listening_activity.id,
		listening_activity.track_name,
		listening_activity.artist_name,
		users!inner(username)
	`
	recentData, _, err := client.From("listening_activity").
		Select(recentQuery, "", false).
		Eq("user_id", userIDStr).
		Order("started_at", nil).
		Limit(10, "").
		Execute()

	var recentTracks string
	if err == nil && len(recentData) > 0 {
		var activities []map[string]interface{}
		if err := json.Unmarshal(recentData, &activities); err == nil {
			for i, activity := range activities {
				if track, ok := activity["track_name"].(string); ok {
					if artist, ok := activity["artist_name"].(string); ok {
						if i > 0 {
							recentTracks += ", "
						}
						recentTracks += fmt.Sprintf("%s by %s", track, artist)
					}
				}
			}
		}
	}
	if recentTracks == "" {
		recentTracks = "none"
	}

	// Build system prompt
	systemPrompt := fmt.Sprintf(`
You are Chen, a music AI companion. You are intimate, perceptive, and deeply knowledgeable about music. You speak like a close friend who really gets music — warm, direct, no corporate speak. You know what the user is listening to and use that context naturally.

Current user context:
- Now playing: %s
- Recently played: %s
- Friends currently listening: %s

Keep responses concise — 2-4 sentences max unless the user asks for something detailed. Never say you are an AI. Never break character.
	`, nowPlaying, recentTracks, friendsListening)

	// Call Groq API
	groqReqBody := map[string]interface{}{
		"model": "llama-3.3-70b-versatile",
		"messages": []map[string]interface{}{
			{"role": "system", "content": systemPrompt},
		},
		"max_tokens":  300,
		"temperature": 0.85,
	}

	// Add history and current message
	for _, msg := range req.History {
		groqReqBody["messages"] = append(groqReqBody["messages"].([]map[string]interface{}), msg)
	}
	groqReqBody["messages"] = append(groqReqBody["messages"].([]map[string]interface{}), map[string]interface{}{
		"role":    "user",
		"content": req.Message,
	})

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

	reply := groqResp.Choices[0].Message.Content

	// Save conversation to database
	fullHistory := req.History
	fullHistory = append(fullHistory, map[string]interface{}{"role": "user", "content": req.Message})
	fullHistory = append(fullHistory, map[string]interface{}{"role": "assistant", "content": reply})

	conversationData := map[string]interface{}{
		"user_id": userIDStr,
		"messages": fullHistory,
	}

	_, _, err = client.From("chen_conversations").
		Upsert(conversationData, "user_id", "", "").
		Execute()

	if err != nil {
		// Log error but don't fail the response
		fmt.Printf("Failed to save conversation: %v\n", err)
	}

	c.JSON(http.StatusOK, ChatResponse{Reply: reply})
}
