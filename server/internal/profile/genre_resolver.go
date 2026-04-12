package profile

import (
	"chen/internal/lastfm"
	"sort"
	"strings"
)

type weightedArtist struct {
	Name  string
	Plays int
}

func deriveTopGenreFromLastFM(client *lastfm.Client, artistCounts map[string]int) string {
	if client == nil || len(artistCounts) == 0 {
		return ""
	}

	rankedArtists := rankArtistsByPlayCount(artistCounts)
	if len(rankedArtists) == 0 {
		return ""
	}

	genreScores := make(map[string]int)

	for _, artist := range rankedArtists[:min(len(rankedArtists), 10)] {
		tags, err := client.GetArtistTopTags(artist.Name)
		if err != nil {
			continue
		}

		addResolvedGenreScores(genreScores, artist.Plays, tags)
	}

	return highestScoringGenre(genreScores)
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

func addResolvedGenreScores(genreScores map[string]int, plays int, tags []string) {
	seenGenres := make(map[string]struct{})
	reward := 5

	for _, tag := range tags {
		genre := normalizeLastFMGenreTag(tag)
		if genre == "" {
			continue
		}
		if _, exists := seenGenres[genre]; exists {
			continue
		}

		seenGenres[genre] = struct{}{}
		genreScores[genre] += plays * reward
		if reward > 1 {
			reward--
		}
	}
}

func highestScoringGenre(genreScores map[string]int) string {
	topGenre := ""
	topScore := 0
	for genre, score := range genreScores {
		if score > topScore {
			topScore = score
			topGenre = genre
		}
	}
	return topGenre
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
