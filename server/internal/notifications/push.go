package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chen/pkg/supabase"

	"github.com/supabase-community/postgrest-go"
	supabaseapi "github.com/supabase-community/supabase-go"
)

type pushTokenPayload struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform"`
	DeviceID string `json:"device_id"`
}

type expoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title,omitempty"`
	Body  string         `json:"body,omitempty"`
	Sound string         `json:"sound,omitempty"`
	Data  map[string]any `json:"data,omitempty"`
}

type expoPushResponseItem struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

type expoPushResponse struct {
	Data []expoPushResponseItem `json:"data"`
}

func registerPushToken(userID string, payload pushTokenPayload) error {
	client := supabase.GetClient()
	if client == nil {
		return fmt.Errorf("database connection failed")
	}

	token := strings.TrimSpace(payload.Token)
	if token == "" {
		return fmt.Errorf("push token required")
	}

	record := map[string]any{
		"user_id":        userID,
		"expo_push_token": token,
		"platform":       strings.TrimSpace(payload.Platform),
		"device_id":      strings.TrimSpace(payload.DeviceID),
		"last_seen_at":   time.Now().UTC().Format(time.RFC3339),
		"updated_at":     time.Now().UTC().Format(time.RFC3339),
	}

	_, _, err := client.From("user_push_tokens").
		Upsert(record, "expo_push_token", "minimal", "").
		Execute()
	return err
}

func sendPushForUser(userID, title, body string, data map[string]any) error {
	client := supabase.GetClient()
	if client == nil {
		return fmt.Errorf("database connection failed")
	}

	tokens, err := loadUserPushTokens(client, userID)
	if err != nil || len(tokens) == 0 {
		return err
	}

	messages := make([]expoPushMessage, 0, len(tokens))
	for _, token := range tokens {
		if !isValidExpoPushToken(token) {
			continue
		}
		messages = append(messages, expoPushMessage{
			To:    token,
			Title: title,
			Body:  body,
			Sound: "default",
			Data:  data,
		})
	}

	if len(messages) == 0 {
		return nil
	}

	invalidTokens, err := sendExpoPush(messages)
	if err != nil {
		return err
	}

	if len(invalidTokens) > 0 {
		_ = deletePushTokens(client, invalidTokens)
	}

	return nil
}

func loadUserPushTokens(client *supabaseapi.Client, userID string) ([]string, error) {
	data, _, err := client.From("user_push_tokens").
		Select("expo_push_token,last_seen_at", "", false).
		Eq("user_id", userID).
		Order("last_seen_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(5, "").
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	tokens := make([]string, 0, len(rows))
	for _, row := range rows {
		token := toString(row["expo_push_token"])
		if token != "" {
			tokens = append(tokens, token)
		}
	}
	return tokens, nil
}

func deletePushTokens(client *supabaseapi.Client, tokens []string) error {
	if len(tokens) == 0 {
		return nil
	}

	_, _, err := client.From("user_push_tokens").
		Delete("minimal", "").
		In("expo_push_token", tokens).
		Execute()
	return err
}

func isValidExpoPushToken(token string) bool {
	return strings.HasPrefix(token, "ExpoPushToken[") || strings.HasPrefix(token, "ExponentPushToken[")
}

func sendExpoPush(messages []expoPushMessage) ([]string, error) {
	body, err := json.Marshal(messages)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", "https://exp.host/--/api/v2/push/send", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("expo push failed with status %d", resp.StatusCode)
	}

	var response expoPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	invalid := make([]string, 0)
	for i, result := range response.Data {
		if result.Status == "error" && i < len(messages) {
			if result.Details.Error == "DeviceNotRegistered" {
				invalid = append(invalid, messages[i].To)
			}
		}
	}

	return invalid, nil
}
