package referrals

import (
	"chen/pkg/supabase"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	gosupabase "github.com/supabase-community/supabase-go"

	"github.com/gin-gonic/gin"
)

const (
	PerkTopArtist3      = "top_artist_3"
	PerkTopArtist4      = "top_artist_4"
	PerkTopArtist5      = "top_artist_5"
	PerkVoiceNotes      = "voice_notes"
	PerkThemeLagosNight = "theme_lagos_night"
	PerkThemeHarmattan  = "theme_harmattan"
	PerkThemeMidnight   = "theme_midnight_afro"
	PerkThemeAtilola    = "theme_atilola_red"

	themeDefault       = "default"
	themeLagosNight    = "lagosNight"
	themeHarmattan     = "harmattan"
	themeMidnightAfro  = "midnightAfro"
	themeAtilolaRed    = "atilolaRed"
	referralCodeLength = 12
)

type perkDefinition struct {
	Key               string `json:"key"`
	Title             string `json:"title"`
	Description       string `json:"description"`
	RequiredReferrals int    `json:"required_referrals"`
	ThemeKey          string `json:"theme_key,omitempty"`
	ArtistRank        int    `json:"artist_rank,omitempty"`
}

type perkStatus struct {
	Key                string `json:"key"`
	Title              string `json:"title"`
	Description        string `json:"description"`
	RequiredReferrals  int    `json:"required_referrals"`
	CompletedReferrals int    `json:"completed_referrals"`
	Unlocked           bool   `json:"unlocked"`
	ThemeKey           string `json:"theme_key,omitempty"`
	ArtistRank         int    `json:"artist_rank,omitempty"`
}

type statusResponse struct {
	ReferralCode        string       `json:"referral_code"`
	ThemePreference     string       `json:"theme_preference"`
	OnboardingComplete  bool         `json:"onboarding_complete"`
	VoiceNotesUnlocked  bool         `json:"voice_notes_unlocked"`
	UnlockedThemeKeys   []string     `json:"unlocked_theme_keys"`
	UnlockedArtistRanks []int        `json:"unlocked_artist_ranks"`
	Perks               []perkStatus `json:"perks"`
}

type completeOnboardingRequest struct {
	ReferralCode string `json:"referral_code"`
	PerkKey      string `json:"perk_key"`
}

type completeOnboardingResponse struct {
	Applied bool           `json:"applied"`
	Status  statusResponse `json:"status"`
}

type userReferralProfile struct {
	Username              string
	AvatarID              string
	ThemePreference       string
	ReferralCode          string
	OnboardingCompletedAt string
	IsSuperUser           bool
}

var perkDefinitions = []perkDefinition{
	{
		Key:               PerkTopArtist3,
		Title:             "Top Artist #3",
		Description:       "Reveal your third top artist.",
		RequiredReferrals: 1,
		ArtistRank:        3,
	},
	{
		Key:               PerkTopArtist4,
		Title:             "Top Artist #4",
		Description:       "Reveal your fourth top artist.",
		RequiredReferrals: 1,
		ArtistRank:        4,
	},
	{
		Key:               PerkTopArtist5,
		Title:             "Top Artist #5",
		Description:       "Reveal your fifth top artist.",
		RequiredReferrals: 1,
		ArtistRank:        5,
	},
	{
		Key:               PerkVoiceNotes,
		Title:             "Voice Notes",
		Description:       "Unlock voice notes forever.",
		RequiredReferrals: 2,
	},
	{
		Key:               PerkThemeLagosNight,
		Title:             "Lagos Night Theme",
		Description:       "Unlock the Lagos Night theme.",
		RequiredReferrals: 1,
		ThemeKey:          themeLagosNight,
	},
	{
		Key:               PerkThemeHarmattan,
		Title:             "Harmattan Theme",
		Description:       "Unlock the Harmattan theme.",
		RequiredReferrals: 1,
		ThemeKey:          themeHarmattan,
	},
	{
		Key:               PerkThemeMidnight,
		Title:             "Midnight Afro Theme",
		Description:       "Unlock the Midnight Afro theme.",
		RequiredReferrals: 1,
		ThemeKey:          themeMidnightAfro,
	},
	{
		Key:               PerkThemeAtilola,
		Title:             "Atilola Red Theme",
		Description:       "Unlock the Atilola Red theme.",
		RequiredReferrals: 1,
		ThemeKey:          themeAtilolaRed,
	},
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", getStatus)
	rg.POST("/complete-onboarding", completeOnboarding)
}

func getStatus(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	status, err := BuildStatus(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load referrals"})
		return
	}

	c.JSON(http.StatusOK, status)
}

func completeOnboarding(c *gin.Context) {
	userID, exists := getUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req completeOnboardingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed"})
		return
	}

	profile, err := loadUserReferralProfile(client, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load referral profile"})
		return
	}

	if strings.TrimSpace(profile.Username) == "" || strings.TrimSpace(profile.AvatarID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Complete onboarding profile first"})
		return
	}

	applied, err := applyReferralCompletion(client, userID, strings.TrimSpace(req.ReferralCode), normalizePerkKey(req.PerkKey))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply referral"})
		return
	}

	if strings.TrimSpace(profile.OnboardingCompletedAt) == "" {
		if _, _, err := client.From("users").
			Update(map[string]any{
				"onboarding_completed_at": time.Now().UTC().Format(time.RFC3339),
			}, "", "").
			Eq("id", userID).
			Execute(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize onboarding"})
			return
		}
	}

	status, err := BuildStatus(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load referrals"})
		return
	}

	c.JSON(http.StatusOK, completeOnboardingResponse{
		Applied: applied,
		Status:  status,
	})
}

func BuildStatus(userID string) (statusResponse, error) {
	client := supabase.GetClient()
	if client == nil {
		return statusResponse{}, fmt.Errorf("database connection failed")
	}

	profile, err := loadUserReferralProfile(client, userID)
	if err != nil {
		return statusResponse{}, err
	}

	referralCode, err := ensureReferralCode(client, userID, profile.ReferralCode)
	if err != nil {
		return statusResponse{}, err
	}

	// Super-user override: all features unlocked, no referrals required.
	if profile.IsSuperUser {
		return buildSuperUserStatus(referralCode, profile), nil
	}

	counts, err := loadReferralCounts(client, userID)
	if err != nil {
		return statusResponse{}, err
	}

	status := statusResponse{
		ReferralCode:        referralCode,
		ThemePreference:     normalizeThemeKey(profile.ThemePreference),
		OnboardingComplete:  strings.TrimSpace(profile.OnboardingCompletedAt) != "",
		UnlockedThemeKeys:   []string{themeDefault},
		UnlockedArtistRanks: []int{1, 2},
		Perks:               make([]perkStatus, 0, len(perkDefinitions)),
	}

	for _, definition := range perkDefinitions {
		completed := counts[definition.Key]
		unlocked := completed >= definition.RequiredReferrals
		status.Perks = append(status.Perks, perkStatus{
			Key:                definition.Key,
			Title:              definition.Title,
			Description:        definition.Description,
			RequiredReferrals:  definition.RequiredReferrals,
			CompletedReferrals: completed,
			Unlocked:           unlocked,
			ThemeKey:           definition.ThemeKey,
			ArtistRank:         definition.ArtistRank,
		})

		if !unlocked {
			continue
		}

		if definition.Key == PerkVoiceNotes {
			status.VoiceNotesUnlocked = true
		}
		if definition.ThemeKey != "" {
			status.UnlockedThemeKeys = append(status.UnlockedThemeKeys, definition.ThemeKey)
		}
		if definition.ArtistRank > 0 {
			status.UnlockedArtistRanks = append(status.UnlockedArtistRanks, definition.ArtistRank)
		}
	}

	return status, nil
}

// buildSuperUserStatus returns a fully-unlocked statusResponse for users with
// the is_super_user flag set. Every perk is shown as earned (completed ==
// required) so the UI renders them identically to legitimately-unlocked perks.
func buildSuperUserStatus(referralCode string, profile userReferralProfile) statusResponse {
	allThemeKeys := []string{
		themeDefault, themeLagosNight, themeHarmattan, themeMidnightAfro, themeAtilolaRed,
	}
	allArtistRanks := []int{1, 2, 3, 4, 5}

	perks := make([]perkStatus, 0, len(perkDefinitions))
	for _, def := range perkDefinitions {
		perks = append(perks, perkStatus{
			Key:                def.Key,
			Title:              def.Title,
			Description:        def.Description,
			RequiredReferrals:  def.RequiredReferrals,
			CompletedReferrals: def.RequiredReferrals, // show as fully earned
			Unlocked:           true,
			ThemeKey:           def.ThemeKey,
			ArtistRank:         def.ArtistRank,
		})
	}

	return statusResponse{
		ReferralCode:        referralCode,
		ThemePreference:     normalizeThemeKey(profile.ThemePreference),
		OnboardingComplete:  strings.TrimSpace(profile.OnboardingCompletedAt) != "",
		VoiceNotesUnlocked:  true,
		UnlockedThemeKeys:   allThemeKeys,
		UnlockedArtistRanks: allArtistRanks,
		Perks:               perks,
	}
}

func HasPerkUnlocked(userID string, perkKey string) (bool, error) {
	client := supabase.GetClient()
	if client == nil {
		return false, fmt.Errorf("database connection failed")
	}

	// Super-user override: every perk is unlocked.
	profile, err := loadUserReferralProfile(client, userID)
	if err == nil && profile.IsSuperUser {
		return true, nil
	}

	counts, err := loadReferralCounts(client, userID)
	if err != nil {
		return false, err
	}

	definition, ok := perkDefinitionByKey(normalizePerkKey(perkKey))
	if !ok {
		return false, nil
	}

	return counts[definition.Key] >= definition.RequiredReferrals, nil
}

func AllowedTopArtistCount(userID string) (int, error) {
	client := supabase.GetClient()
	if client == nil {
		return 0, fmt.Errorf("database connection failed")
	}

	// Super-user override: all 5 artist slots are always visible.
	profile, err := loadUserReferralProfile(client, userID)
	if err == nil && profile.IsSuperUser {
		return 5, nil
	}

	counts, err := loadReferralCounts(client, userID)
	if err != nil {
		return 0, err
	}

	allowed := 2
	for _, perkKey := range []string{PerkTopArtist3, PerkTopArtist4, PerkTopArtist5} {
		definition, ok := perkDefinitionByKey(perkKey)
		if ok && counts[definition.Key] >= definition.RequiredReferrals {
			allowed++
		}
	}

	return allowed, nil
}

func ThemeAccessible(userID string, themeKey string) (bool, error) {
	normalizedTheme := normalizeThemeKey(themeKey)
	if normalizedTheme == themeDefault {
		return true, nil
	}

	definition, ok := perkDefinitionForTheme(normalizedTheme)
	if !ok {
		return false, nil
	}

	return HasPerkUnlocked(userID, definition.Key)
}

func normalizeThemeKey(themeKey string) string {
	switch strings.TrimSpace(themeKey) {
	case themeLagosNight:
		return themeLagosNight
	case themeHarmattan:
		return themeHarmattan
	case themeMidnightAfro:
		return themeMidnightAfro
	case themeAtilolaRed:
		return themeAtilolaRed
	default:
		return themeDefault
	}
}

func normalizePerkKey(perkKey string) string {
	switch strings.TrimSpace(strings.ToLower(perkKey)) {
	case PerkTopArtist3:
		return PerkTopArtist3
	case PerkTopArtist4:
		return PerkTopArtist4
	case PerkTopArtist5:
		return PerkTopArtist5
	case PerkVoiceNotes:
		return PerkVoiceNotes
	case PerkThemeLagosNight:
		return PerkThemeLagosNight
	case PerkThemeHarmattan:
		return PerkThemeHarmattan
	case PerkThemeMidnight:
		return PerkThemeMidnight
	case PerkThemeAtilola:
		return PerkThemeAtilola
	default:
		return ""
	}
}

func loadUserReferralProfile(client *gosupabase.Client, userID string) (userReferralProfile, error) {
	// Try the full column list including is_super_user first.
	data, _, err := client.From("users").
		Select("username,avatar_id,theme_preference,referral_code,onboarding_completed_at,is_super_user", "", false).
		Eq("id", userID).
		Limit(1, "").
		Execute()

	isSuperUserAvailable := true
	if err != nil {
		if isMissingColumnError(err, "is_super_user") {
			// Migration not yet applied — fall back without the column.
			isSuperUserAvailable = false
			data, _, err = client.From("users").
				Select("username,avatar_id,theme_preference,referral_code,onboarding_completed_at", "", false).
				Eq("id", userID).
				Limit(1, "").
				Execute()
		}
		if err != nil {
			return userReferralProfile{}, err
		}
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return userReferralProfile{}, err
	}
	if len(rows) == 0 {
		return userReferralProfile{}, fmt.Errorf("user not found")
	}

	profile := userReferralProfile{
		Username:              toString(rows[0]["username"]),
		AvatarID:              toString(rows[0]["avatar_id"]),
		ThemePreference:       toString(rows[0]["theme_preference"]),
		ReferralCode:          strings.ToLower(strings.TrimSpace(toString(rows[0]["referral_code"]))),
		OnboardingCompletedAt: toString(rows[0]["onboarding_completed_at"]),
	}
	if isSuperUserAvailable {
		if v, ok := rows[0]["is_super_user"].(bool); ok {
			profile.IsSuperUser = v
		}
	}
	return profile, nil
}

// isMissingColumnError returns true when err is a PostgreSQL "column does not
// exist" error (code 42703) for the named column.
func isMissingColumnError(err error, column string) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, strings.ToLower(column)) &&
		(strings.Contains(msg, "42703") ||
			strings.Contains(msg, "does not exist") ||
			strings.Contains(msg, "column"))
}

func ensureReferralCode(client *gosupabase.Client, userID string, existing string) (string, error) {
	if existing != "" {
		return existing, nil
	}

	for attempt := 0; attempt < 5; attempt++ {
		code, err := randomReferralCode()
		if err != nil {
			return "", err
		}

		_, _, err = client.From("users").
			Update(map[string]any{"referral_code": code}, "", "").
			Eq("id", userID).
			Execute()
		if err == nil {
			return code, nil
		}
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate") && !strings.Contains(strings.ToLower(err.Error()), "unique") {
			return "", err
		}
	}

	return "", fmt.Errorf("failed to assign referral code")
}

func randomReferralCode() (string, error) {
	bytes := make([]byte, referralCodeLength/2)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func loadReferralCounts(client *gosupabase.Client, userID string) (map[string]int, error) {
	data, _, err := client.From("referral_completions").
		Select("perk_key", "", false).
		Eq("referrer_user_id", userID).
		Limit(500, "").
		Execute()
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "relation") && strings.Contains(strings.ToLower(err.Error()), "does not exist") {
			return map[string]int{}, nil
		}
		return nil, err
	}

	var rows []map[string]any
	if len(data) > 0 {
		if err := json.Unmarshal(data, &rows); err != nil {
			return nil, err
		}
	}

	counts := make(map[string]int, len(rows))
	for _, row := range rows {
		perkKey := normalizePerkKey(toString(row["perk_key"]))
		if perkKey == "" {
			continue
		}
		counts[perkKey]++
	}

	return counts, nil
}

func applyReferralCompletion(client *gosupabase.Client, referredUserID string, referralCode string, perkKey string) (bool, error) {
	if referralCode == "" || perkKey == "" {
		return false, nil
	}

	existingReferral, err := loadExistingReferralForUser(client, referredUserID)
	if err != nil {
		return false, err
	}
	if existingReferral {
		return false, nil
	}

	referrerUserID, err := lookupUserIDByReferralCode(client, referralCode)
	if err != nil {
		return false, err
	}
	if referrerUserID == "" || referrerUserID == referredUserID {
		return false, nil
	}

	_, _, err = client.From("referral_completions").
		Insert(map[string]any{
			"referrer_user_id": referrerUserID,
			"referred_user_id": referredUserID,
			"referral_code":    referralCode,
			"perk_key":         perkKey,
			"completed_at":     time.Now().UTC().Format(time.RFC3339),
		}, false, "", "", "").
		Execute()
	if err != nil {
		lowerErr := strings.ToLower(err.Error())
		if strings.Contains(lowerErr, "duplicate") || strings.Contains(lowerErr, "unique") {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func loadExistingReferralForUser(client *gosupabase.Client, referredUserID string) (bool, error) {
	data, _, err := client.From("referral_completions").
		Select("id", "", false).
		Eq("referred_user_id", referredUserID).
		Limit(1, "").
		Execute()
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "relation") && strings.Contains(strings.ToLower(err.Error()), "does not exist") {
			return false, nil
		}
		return false, err
	}

	var rows []map[string]any
	if len(data) > 0 {
		if err := json.Unmarshal(data, &rows); err != nil {
			return false, err
		}
	}

	return len(rows) > 0, nil
}

func lookupUserIDByReferralCode(client *gosupabase.Client, referralCode string) (string, error) {
	data, _, err := client.From("users").
		Select("id", "", false).
		Eq("referral_code", strings.ToLower(strings.TrimSpace(referralCode))).
		Limit(1, "").
		Execute()
	if err != nil {
		return "", err
	}

	var rows []map[string]any
	if len(data) > 0 {
		if err := json.Unmarshal(data, &rows); err != nil {
			return "", err
		}
	}
	if len(rows) == 0 {
		return "", nil
	}

	return toString(rows[0]["id"]), nil
}

func perkDefinitionByKey(perkKey string) (perkDefinition, bool) {
	for _, definition := range perkDefinitions {
		if definition.Key == perkKey {
			return definition, true
		}
	}
	return perkDefinition{}, false
}

func perkDefinitionForTheme(themeKey string) (perkDefinition, bool) {
	for _, definition := range perkDefinitions {
		if definition.ThemeKey == themeKey {
			return definition, true
		}
	}
	return perkDefinition{}, false
}

func toString(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprintf("%v", value)
}

func getUserIDFromContext(c *gin.Context) (string, bool) {
	value, exists := c.Get("user_id")
	if !exists {
		return "", false
	}

	userID, ok := value.(string)
	if !ok {
		return "", false
	}

	return userID, true
}
