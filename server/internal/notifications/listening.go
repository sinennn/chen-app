package notifications

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"chen/pkg/supabase"

	"github.com/supabase-community/postgrest-go"
	supabaseapi "github.com/supabase-community/supabase-go"
)

type listeningActivityRow struct {
	TrackName  string
	ArtistName string
	PlayedAt   time.Time
}

type listeningInsight struct {
	NotificationType string
	Title            string
	Body             string
	Metadata         map[string]any
}

const (
	listeningInsightType = "listening_insight"
	listeningRoastType   = "listening_roast"
)

func GenerateListeningInsightForUser(userID string, now time.Time) (*NotificationItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, fmt.Errorf("user id required")
	}

	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	skip, err := hasRecentListeningNotification(client, userID, now.Add(-18*time.Hour))
	if err != nil {
		return nil, err
	}
	if skip {
		return nil, nil
	}

	activities, err := loadRecentListeningActivity(client, userID, now.AddDate(0, 0, -35), 500)
	if err != nil {
		return nil, err
	}
	if len(activities) == 0 {
		return nil, nil
	}

	insights := buildListeningInsights(client, userID, activities, now)
	if len(insights) == 0 {
		return nil, nil
	}

	pick := insights[rand.New(rand.NewSource(now.UnixNano())).Intn(len(insights))]
	if err := CreateNotification(userID, "", pick.NotificationType, pick.Title, pick.Body, "", pick.Metadata); err != nil {
		return nil, err
	}

	item := &NotificationItem{
		Type:     pick.NotificationType,
		Title:    pick.Title,
		Body:     pick.Body,
		Metadata: pick.Metadata,
	}

	_ = sendPushForUser(userID, pick.Title, pick.Body, pick.Metadata)
	return item, nil
}

func GenerateListeningInsightsForUsers(userIDs []string, now time.Time) {
	for _, userID := range userIDs {
		if strings.TrimSpace(userID) == "" {
			continue
		}
		_, _ = GenerateListeningInsightForUser(userID, now)
	}
}

func StartListeningInsightsScheduler() {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	for {
		now := time.Now().UTC()
		users, err := loadUsersWithPushTokens()
		if err == nil && len(users) > 0 {
			GenerateListeningInsightsForUsers(users, now)
		}
		<-ticker.C
	}
}

func buildListeningInsights(client *supabaseapi.Client, userID string, activities []listeningActivityRow, now time.Time) []listeningInsight {
	weekStart := now.AddDate(0, 0, -7)
	shortWindowStart := now.AddDate(0, 0, -3)
	monthWindowStart := now.AddDate(0, 0, -30)
	rng := rand.New(rand.NewSource(now.UnixNano()))

	artistCounts := map[string]int{}
	trackCounts := map[string]int{}
	uniqueArtists := map[string]struct{}{}
	artistDays := map[string]map[string]struct{}{}
	recentArtists := map[string]time.Time{}
	previousArtists := map[string]struct{}{}
	artistRecentAndPrevious := map[string][2]time.Time{}

	nightCount := 0
	morningCount := 0
	for _, activity := range activities {
		if activity.ArtistName == "" || activity.TrackName == "" {
			continue
		}
		artist := activity.ArtistName
		trackKey := fmt.Sprintf("%s — %s", activity.TrackName, activity.ArtistName)
		playedAt := activity.PlayedAt

		if !playedAt.IsZero() && playedAt.After(weekStart) {
			artistCounts[artist]++
			trackCounts[trackKey]++
			uniqueArtists[artist] = struct{}{}

			dayKey := playedAt.Format("2006-01-02")
			if _, ok := artistDays[artist]; !ok {
				artistDays[artist] = map[string]struct{}{}
			}
			artistDays[artist][dayKey] = struct{}{}

			hour := playedAt.In(time.Local).Hour()
			if hour >= 0 && hour < 5 {
				nightCount++
			} else if hour >= 5 && hour < 9 {
				morningCount++
			}
		}

		if !playedAt.IsZero() && playedAt.After(shortWindowStart) {
			if seenAt, ok := recentArtists[artist]; !ok || playedAt.After(seenAt) {
				recentArtists[artist] = playedAt
			}
		} else if !playedAt.IsZero() && playedAt.After(monthWindowStart) {
			previousArtists[artist] = struct{}{}
		}

		if playedAt.IsZero() {
			continue
		}
		if entry, ok := artistRecentAndPrevious[artist]; ok {
			if entry[0].IsZero() {
				entry[0] = playedAt
			} else if entry[1].IsZero() && playedAt.Before(entry[0]) {
				entry[1] = playedAt
			}
			artistRecentAndPrevious[artist] = entry
		} else {
			artistRecentAndPrevious[artist] = [2]time.Time{playedAt, time.Time{}}
		}
	}

	topArtist, topArtistCount := maxCount(artistCounts)
	topTrack, topTrackCount := maxCount(trackCounts)
	streakArtist, streakCount := longestArtistStreak(activities, 10)
	loyalArtist, loyalDays := maxArtistDays(artistDays)
	newArtist := pickNewArtist(rng, recentArtists, previousArtists)
	comebackArtist := pickComebackArtist(rng, recentArtists, artistRecentAndPrevious, shortWindowStart)

	insights := make([]listeningInsight, 0, 8)
	if topArtist != "" && topArtistCount >= 4 {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Top artist this week",
			Body:             fmt.Sprintf("%s led your soundtrack with %d plays lately.", topArtist, topArtistCount),
			Metadata: map[string]any{
				"artist": topArtist,
				"plays":  topArtistCount,
			},
		})
	}

	if topTrack != "" && topTrackCount >= 3 {
		parts := strings.Split(topTrack, " — ")
		trackName := parts[0]
		artistName := ""
		if len(parts) > 1 {
			artistName = parts[1]
		}
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "On repeat",
			Body:             fmt.Sprintf("You spun %s by %s %d times recently.", trackName, artistName, topTrackCount),
			Metadata: map[string]any{
				"track":  trackName,
				"artist": artistName,
				"plays":  topTrackCount,
			},
		})
	}

	if streakArtist != "" && streakCount >= 3 {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Locked in",
			Body:             fmt.Sprintf("%s showed up %d plays in a row. Commitment.", streakArtist, streakCount),
			Metadata: map[string]any{
				"artist": streakArtist,
				"streak": streakCount,
			},
		})
	}

	if nightCount >= 5 && topArtist != "" {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Night owl",
			Body:             fmt.Sprintf("Most of your listens hit after midnight. %s is your after-hours pick.", topArtist),
			Metadata: map[string]any{
				"artist": topArtist,
			},
		})
	}

	if morningCount >= 5 && topArtist != "" {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Early headphones",
			Body:             fmt.Sprintf("You were in your headphones early. %s set the tone.", topArtist),
			Metadata: map[string]any{
				"artist": topArtist,
			},
		})
	}

	if len(uniqueArtists) >= 12 {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Wide taste",
			Body:             fmt.Sprintf("You bounced across %d artists this week. Curious, in a good way.", len(uniqueArtists)),
			Metadata: map[string]any{
				"unique_artists": len(uniqueArtists),
			},
		})
	}

	if topArtist != "" {
		insights = append(insights, listeningInsight{
			NotificationType: listeningRoastType,
			Title:            "Roast mode",
			Body:             fmt.Sprintf("You played %s %d times. We get it.", topArtist, topArtistCount),
			Metadata: map[string]any{
				"artist": topArtist,
				"plays":  topArtistCount,
			},
		})
	}

	if loyalArtist != "" && loyalDays >= 4 {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Loyalty badge",
			Body:             fmt.Sprintf("%s showed up on %d different days this week.", loyalArtist, loyalDays),
			Metadata: map[string]any{
				"artist": loyalArtist,
				"days":   loyalDays,
			},
		})
	}

	if newArtist != "" {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "New taste unlocked",
			Body:             fmt.Sprintf("First time you've played %s in a while. Fresh era?", newArtist),
			Metadata: map[string]any{
				"artist": newArtist,
			},
		})
	}

	if comebackArtist != "" {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Comeback",
			Body:             fmt.Sprintf("%s just popped back into rotation.", comebackArtist),
			Metadata: map[string]any{
				"artist": comebackArtist,
			},
		})
	}

	if topArtist != "" && client != nil {
		if percentileInsight := buildTopPercentileInsight(client, userID, topArtist); percentileInsight != nil {
			insights = append(insights, *percentileInsight)
		}
	}

	if len(insights) == 0 && topArtist != "" {
		insights = append(insights, listeningInsight{
			NotificationType: listeningInsightType,
			Title:            "Music check-in",
			Body:             fmt.Sprintf("%s is popping up a lot lately. Want a fresh recommendation?", topArtist),
			Metadata: map[string]any{
				"artist": topArtist,
			},
		})
	}

	return insights
}

func loadRecentListeningActivity(client *supabaseapi.Client, userID string, since time.Time, limit int) ([]listeningActivityRow, error) {
	data, _, err := client.From("listening_activity").
		Select("track_name,artist_name,played_at", "", false).
		Eq("user_id", userID).
		Gte("played_at", since.UTC().Format(time.RFC3339)).
		Order("played_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(limit, "").
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	activities := make([]listeningActivityRow, 0, len(rows))
	for _, row := range rows {
		playedAtRaw := toString(row["played_at"])
		playedAt, _ := time.Parse(time.RFC3339, playedAtRaw)
		activities = append(activities, listeningActivityRow{
			TrackName:  toString(row["track_name"]),
			ArtistName: toString(row["artist_name"]),
			PlayedAt:   playedAt,
		})
	}
	return activities, nil
}

func hasRecentListeningNotification(client *supabaseapi.Client, userID string, since time.Time) (bool, error) {
	data, _, err := client.From("notifications").
		Select("id,created_at", "", false).
		Eq("user_id", userID).
		In("type", []string{listeningInsightType, listeningRoastType}).
		Gte("created_at", since.UTC().Format(time.RFC3339)).
		Limit(1, "").
		Execute()
	if err != nil {
		return false, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return false, err
	}

	return len(rows) > 0, nil
}

func maxCount(counts map[string]int) (string, int) {
	var maxKey string
	maxVal := 0
	for key, val := range counts {
		if val > maxVal {
			maxKey = key
			maxVal = val
		}
	}
	return maxKey, maxVal
}

func longestArtistStreak(activities []listeningActivityRow, limit int) (string, int) {
	if len(activities) == 0 {
		return "", 0
	}

	maxArtist := ""
	maxCount := 0
	currentArtist := ""
	currentCount := 0

	for i, activity := range activities {
		if i >= limit {
			break
		}
		if activity.ArtistName == "" {
			continue
		}
		if activity.ArtistName == currentArtist {
			currentCount++
		} else {
			currentArtist = activity.ArtistName
			currentCount = 1
		}
		if currentCount > maxCount {
			maxArtist = currentArtist
			maxCount = currentCount
		}
	}
	return maxArtist, maxCount
}

func maxArtistDays(artistDays map[string]map[string]struct{}) (string, int) {
	maxArtist := ""
	maxDays := 0
	for artist, days := range artistDays {
		count := len(days)
		if count > maxDays {
			maxArtist = artist
			maxDays = count
		}
	}
	return maxArtist, maxDays
}

func pickNewArtist(rng *rand.Rand, recent map[string]time.Time, previous map[string]struct{}) string {
	candidates := make([]string, 0)
	for artist := range recent {
		if _, exists := previous[artist]; !exists {
			candidates = append(candidates, artist)
		}
	}
	if len(candidates) == 0 {
		return ""
	}
	return candidates[rng.Intn(len(candidates))]
}

func pickComebackArtist(rng *rand.Rand, recent map[string]time.Time, history map[string][2]time.Time, recentCutoff time.Time) string {
	candidates := make([]string, 0)
	for artist, recentAt := range recent {
		if recentAt.Before(recentCutoff) {
			continue
		}
		if entry, ok := history[artist]; ok {
			previousAt := entry[1]
			if !previousAt.IsZero() && recentAt.Sub(previousAt) >= 14*24*time.Hour {
				candidates = append(candidates, artist)
			}
		}
	}
	if len(candidates) == 0 {
		return ""
	}
	return candidates[rng.Intn(len(candidates))]
}

type artistPercentileRow struct {
	Percentile      float64 `json:"percentile"`
	UserPlayCount   int     `json:"user_play_count"`
	ListenerCount   int     `json:"listener_count"`
	ArtistPlayCount int     `json:"artist_play_count"`
}

func buildTopPercentileInsight(client *supabaseapi.Client, userID, artist string) *listeningInsight {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(artist) == "" {
		return nil
	}

	payload := map[string]any{
		"user_uuid":  userID,
		"artist":     artist,
		"since_days": 30,
	}

	raw := client.Rpc("artist_listener_percentile", "", payload)
	if client.ClientError != nil || strings.TrimSpace(raw) == "" {
		return nil
	}

	var rows []artistPercentileRow
	if err := json.Unmarshal([]byte(raw), &rows); err != nil || len(rows) == 0 {
		return nil
	}

	row := rows[0]
	if row.UserPlayCount <= 0 || row.ListenerCount < 20 {
		return nil
	}

	if row.Percentile < 0 {
		return nil
	}

	topPercent := int((1 - row.Percentile) * 100)
	if topPercent <= 0 {
		topPercent = 1
	}

	if topPercent > 10 {
		return nil
	}

	return &listeningInsight{
		NotificationType: listeningInsightType,
		Title:            "Heavy rotation",
		Body:             fmt.Sprintf("You're in the top %d%% of %s listeners this month.", topPercent, artist),
		Metadata: map[string]any{
			"artist":            artist,
			"top_percent":       topPercent,
			"user_play_count":   row.UserPlayCount,
			"listener_count":    row.ListenerCount,
			"artist_play_count": row.ArtistPlayCount,
		},
	}
}

func loadUsersWithPushTokens() ([]string, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("user_push_tokens").
		Select("user_id,last_seen_at", "", false).
		Order("last_seen_at", &postgrest.OrderOpts{Ascending: false}).
		Limit(500, "").
		Execute()
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		id := toString(row["user_id"])
		if id != "" {
			ids = append(ids, id)
		}
	}
	return uniqueStrings(ids), nil
}
