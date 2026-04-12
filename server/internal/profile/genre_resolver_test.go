package profile

import "testing"

func TestNormalizeLastFMGenreTagMapsAlte(t *testing.T) {
	if genre := normalizeLastFMGenreTag("alté"); genre != "Alté" {
		t.Fatalf("expected Alté, got %q", genre)
	}
}

func TestNormalizeLastFMGenreTagDropsNoise(t *testing.T) {
	if genre := normalizeLastFMGenreTag("seen live"); genre != "" {
		t.Fatalf("expected empty genre for noise tag, got %q", genre)
	}
}

func TestAddResolvedGenreScoresPrefersHigherWeightedCluster(t *testing.T) {
	scores := map[string]int{}
	addResolvedGenreScores(scores, 6, []string{"alté", "afrobeats", "afropop"})
	addResolvedGenreScores(scores, 3, []string{"alté"})
	addResolvedGenreScores(scores, 2, []string{"dream pop"})

	if genre := highestScoringGenre(scores); genre != "Alté" {
		t.Fatalf("expected Alté, got %q", genre)
	}
}
