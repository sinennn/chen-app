package profile

import (
	"chen/internal/lastfm"
	"context"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
)

type weightedArtist struct {
	Name  string
	Plays int
}

type genreScoreUpdate struct {
	Tag    string
	Genre  string
	Reward int
	Added  int
}

var genreResolverLogger = log.New(os.Stdout, "[profile.genre] ", log.LstdFlags|log.Lmicroseconds)

func deriveTopGenreFromLastFM(ctx context.Context, client *lastfm.Client, artistCounts map[string]int) string {
	if client == nil || len(artistCounts) == 0 {
		genreResolverLogger.Printf(
			"skip client_nil=%v artist_count=%d",
			client == nil,
			len(artistCounts),
		)
		return ""
	}

	rankedArtists := rankArtistsByPlayCount(artistCounts)
	if len(rankedArtists) == 0 {
		genreResolverLogger.Printf("skip reason=no_ranked_artists")
		return ""
	}

	selectedArtists := rankedArtists[:min(len(rankedArtists), 10)]
	genreScores := make(map[string]int)
	genreResolverLogger.Printf(
		"start ranked_artists=%d selected_artists=%d candidates=%s",
		len(rankedArtists),
		len(selectedArtists),
		formatWeightedArtistsForLog(selectedArtists),
	)

	for _, artist := range selectedArtists {
		genreResolverLogger.Printf("artist=%q plays=%d fetching_tags", artist.Name, artist.Plays)

		tags, err := client.GetArtistTopTags(ctx, artist.Name)
		if err != nil {
			genreResolverLogger.Printf("artist=%q plays=%d tag_fetch_error=%v", artist.Name, artist.Plays, err)
			continue
		}

		updates := addResolvedGenreScores(genreScores, artist.Plays, tags)
		topGenre, topScore := highestScoringGenreWithScore(genreScores)
		genreResolverLogger.Printf(
			"artist=%q plays=%d tags=%v resolved=%s current_top=%q current_score=%d",
			artist.Name,
			artist.Plays,
			tags,
			formatGenreScoreUpdatesForLog(updates),
			topGenre,
			topScore,
		)
	}

	topGenre, topScore := highestScoringGenreWithScore(genreScores)
	genreResolverLogger.Printf(
		"final genre=%q score=%d scores=%s",
		topGenre,
		topScore,
		formatGenreScoresForLog(genreScores),
	)

	return topGenre
}

func rankArtistsByPlayCount(artistCounts map[string]int) []weightedArtist {
	ranked := make([]weightedArtist, 0, len(artistCounts))
	for name, plays := range artistCounts {
		normalizedName := strings.TrimSpace(name)
		if normalizedName == "" || plays <= 0 {
			continue
		}
		ranked = append(ranked, weightedArtist{Name: normalizedName, Plays: plays})
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].Plays != ranked[j].Plays {
			return ranked[i].Plays > ranked[j].Plays
		}
		return ranked[i].Name < ranked[j].Name
	})

	return ranked
}

func normalizeLastFMGenreTag(value string) string {
	normalized := normalizeLastFMText(value)
	if normalized == "" || isNoiseLastFMTag(normalized) {
		return ""
	}

	if mapped := exactLastFMGenreAliases[normalized]; mapped != "" {
		return mapped
	}

	for keyword, genre := range containsLastFMGenreAliases {
		if strings.Contains(normalized, keyword) {
			return genre
		}
	}

	return ""
}

func addResolvedGenreScores(genreScores map[string]int, plays int, tags []string) []genreScoreUpdate {
	seenGenres := make(map[string]struct{})
	reward := 5
	updates := make([]genreScoreUpdate, 0, len(tags))

	for _, tag := range tags {
		genre := normalizeLastFMGenreTag(tag)
		if genre == "" {
			continue
		}
		if _, exists := seenGenres[genre]; exists {
			continue
		}

		seenGenres[genre] = struct{}{}
		added := plays * reward
		genreScores[genre] += added
		updates = append(updates, genreScoreUpdate{
			Tag:    tag,
			Genre:  genre,
			Reward: reward,
			Added:  added,
		})
		if reward > 1 {
			reward--
		}
	}

	return updates
}

func highestScoringGenre(genreScores map[string]int) string {
	topGenre, _ := highestScoringGenreWithScore(genreScores)
	return topGenre
}

func highestScoringGenreWithScore(genreScores map[string]int) (string, int) {
	topGenre := ""
	topScore := 0
	for genre, score := range genreScores {
		if score > topScore {
			topScore = score
			topGenre = genre
		}
	}
	return topGenre, topScore
}

func isNoiseLastFMTag(value string) bool {
	return strings.Contains(value, "seen live") ||
		strings.Contains(value, "favorites") ||
		strings.Contains(value, "favourites") ||
		strings.Contains(value, "under ") && strings.Contains(value, "listeners") ||
		strings.Contains(value, "myspotigrambot")
}

func normalizeLastFMText(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}

	replacer := strings.NewReplacer(
		"é", "e",
		"&", " and ",
		"-", " ",
		"_", " ",
		"/", " ",
		".", " ",
		",", " ",
		"'", "",
		"  ", " ",
	)

	value = replacer.Replace(value)
	return strings.Join(strings.Fields(value), " ")
}

func formatWeightedArtistsForLog(artists []weightedArtist) string {
	parts := make([]string, 0, len(artists))
	for _, artist := range artists {
		parts = append(parts, fmt.Sprintf("%s(%d)", artist.Name, artist.Plays))
	}

	return strings.Join(parts, ", ")
}

func formatGenreScoreUpdatesForLog(updates []genreScoreUpdate) string {
	if len(updates) == 0 {
		return "none"
	}

	parts := make([]string, 0, len(updates))
	for _, update := range updates {
		parts = append(
			parts,
			fmt.Sprintf("%s+=%d(tag=%q reward=%d)", update.Genre, update.Added, update.Tag, update.Reward),
		)
	}

	return strings.Join(parts, ", ")
}

func formatGenreScoresForLog(genreScores map[string]int) string {
	if len(genreScores) == 0 {
		return "none"
	}

	type genreScore struct {
		genre string
		score int
	}

	scores := make([]genreScore, 0, len(genreScores))
	for genre, score := range genreScores {
		scores = append(scores, genreScore{genre: genre, score: score})
	}

	sort.SliceStable(scores, func(i, j int) bool {
		if scores[i].score != scores[j].score {
			return scores[i].score > scores[j].score
		}
		return scores[i].genre < scores[j].genre
	})

	parts := make([]string, 0, len(scores))
	for _, score := range scores {
		parts = append(parts, fmt.Sprintf("%s=%d", score.genre, score.score))
	}

	return strings.Join(parts, ", ")
}

var exactLastFMGenreAliases = map[string]string{
	"alte":             "Alté",
	"afrobeats":        "Afrobeats",
	"afrobeat":         "Afrobeats",
	"afropop":          "Afrobeats",
	"afro fusion":      "Afrobeats",
	"afrofusion":       "Afrobeats",
	"afroswing":        "Afrobeats",
	"afro soul":        "Afrobeats",
	"afro and b":       "Afrobeats",
	"nigerian drill":   "Nigerian Drill",
	"rage rap":         "Rage Rap",
	"hip hop":          "Hip-Hop",
	"hiphop":           "Hip-Hop",
	"rap":              "Hip-Hop",
	"trap":             "Hip-Hop",
	"r and b":          "R&B",
	"rnb":              "R&B",
	"neo soul":         "R&B",
	"dream pop":        "Dream Pop",
	"shoegaze":         "Dream Pop",
	"indie pop":        "Indie Pop",
	"indie rock":       "Indie Rock",
	"alternative":      "Alternative",
	"alternative rock": "Alternative",
	"electronic":       "Electronic",
	"ambient":          "Ambient",
	"house":            "House",
	"deep house":       "House",
	"techno":           "Techno",
	"amapiano":         "Amapiano",
	"jazz":             "Jazz",
	"soul":             "Soul",
	"pop":              "Pop",
	"rock":             "Rock",
	"reggae":           "Reggae",
	"classical":        "Classical",
	"folk":             "Folk",
	"country":          "Country",
	"lo fi":            "Lo-Fi",
	"lofi":             "Lo-Fi",
	"drill":            "Drill",
}

var containsLastFMGenreAliases = map[string]string{
	"alte":        "Alté",
	"afrobeat":    "Afrobeats",
	"afropop":     "Afrobeats",
	"afrofusion":  "Afrobeats",
	"afro fusion": "Afrobeats",
	"afroswing":   "Afrobeats",
	"drill":       "Drill",
	"hip hop":     "Hip-Hop",
	"r and b":     "R&B",
	"dream pop":   "Dream Pop",
	"shoegaze":    "Dream Pop",
	"indie pop":   "Indie Pop",
	"indie rock":  "Indie Rock",
	"alternative": "Alternative",
	"electronic":  "Electronic",
	"ambient":     "Ambient",
	"house":       "House",
	"techno":      "Techno",
	"amapiano":    "Amapiano",
	"lo fi":       "Lo-Fi",
}
