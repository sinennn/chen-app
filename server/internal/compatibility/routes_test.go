package compatibility

import "testing"

func TestIdenticalTasteProfilesScoreAtOneHundredDespiteDisplayLimits(t *testing.T) {
	yours := tasteProfile{
		Artists: make([]ArtistMatch, 20),
		Tracks:  make([]TrackMatch, 20),
	}
	theirs := tasteProfile{
		Artists: make([]ArtistMatch, 20),
		Tracks:  make([]TrackMatch, 20),
	}

	for i := 0; i < 20; i++ {
		yours.Artists[i] = ArtistMatch{Name: "Artist " + string(rune('A'+i))}
		theirs.Artists[i] = yours.Artists[i]
		yours.Tracks[i] = TrackMatch{Name: "Track " + string(rune('A'+i)), Artist: "Artist " + string(rune('A'+i))}
		theirs.Tracks[i] = yours.Tracks[i]
	}

	displayArtists, _, _ := compareArtists(yours.Artists, theirs.Artists, 10)
	displayTracks := compareTracks(yours.Tracks, theirs.Tracks, 8)
	if len(displayArtists) != 10 {
		t.Fatalf("expected display artist matches to stay limited to 10, got %d", len(displayArtists))
	}
	if len(displayTracks) != 8 {
		t.Fatalf("expected display track matches to stay limited to 8, got %d", len(displayTracks))
	}

	score := calculateScore(
		yours,
		theirs,
		countSharedArtists(yours.Artists, theirs.Artists),
		countSharedTracks(yours.Tracks, theirs.Tracks),
	)
	if score != 100 {
		t.Fatalf("expected identical profiles to score 100, got %d", score)
	}
}
