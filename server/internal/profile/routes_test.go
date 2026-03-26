package profile

import (
	"testing"
	"time"
)

func TestEstimateListeningDurationMsUsesSessionWindow(t *testing.T) {
	startedAt := time.Date(2026, time.March, 25, 10, 0, 0, 0, time.UTC)
	playedAt := startedAt.Add(3 * time.Minute)

	durationMs := estimateListeningDurationMs(map[string]any{
		"started_at":  startedAt.Format(time.RFC3339),
		"played_at":   playedAt.Format(time.RFC3339),
		"progress_ms": 90_000,
	})

	if durationMs != int((3 * time.Minute).Milliseconds()) {
		t.Fatalf("expected 3 minute session window, got %dms", durationMs)
	}
}

func TestEstimateListeningDurationMsFallsBackToProgressForImpossibleWindow(t *testing.T) {
	startedAt := time.Date(2026, time.March, 18, 10, 0, 0, 0, time.UTC)
	playedAt := startedAt.Add(72 * time.Hour)

	durationMs := estimateListeningDurationMs(map[string]any{
		"started_at":  startedAt.Format(time.RFC3339),
		"played_at":   playedAt.Format(time.RFC3339),
		"progress_ms": 240_000,
	})

	if durationMs != 240_000 {
		t.Fatalf("expected progress fallback, got %dms", durationMs)
	}
}

func TestEstimateListeningDurationMsRejectsUnreasonableProgressFallback(t *testing.T) {
	durationMs := estimateListeningDurationMs(map[string]any{
		"played_at":   time.Date(2026, time.March, 25, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"progress_ms": 9 * 60 * 60 * 1000,
	})

	if durationMs != 0 {
		t.Fatalf("expected unreasonable progress to be ignored, got %dms", durationMs)
	}
}
