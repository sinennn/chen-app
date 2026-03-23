package spotify

import (
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

const (
	defaultSpotifyMinRequestSpacing = 350 * time.Millisecond
	defaultSpotifyRateLimitCooldown = 30 * time.Second
	spotifyRateLimitBuffer          = time.Second

	pollerTickInterval     = 30 * time.Second
	activePollInterval     = 30 * time.Second
	idleBasePollInterval   = 60 * time.Second
	idleMaxPollInterval    = 10 * time.Minute
	rateLimitedPollFloor   = 2 * time.Minute
	rateLimitedPollCeiling = 30 * time.Minute
)

type spotifyRequestGuard struct {
	mu            sync.Mutex
	nextRequest   time.Time
	cooldownUntil time.Time
	minSpacing    time.Duration
}

func newSpotifyRequestGuard(minSpacing time.Duration) *spotifyRequestGuard {
	if minSpacing <= 0 {
		minSpacing = defaultSpotifyMinRequestSpacing
	}

	return &spotifyRequestGuard{
		minSpacing: minSpacing,
	}
}

func (g *spotifyRequestGuard) waitTurn() error {
	for {
		g.mu.Lock()
		now := time.Now()

		if g.cooldownUntil.After(now) {
			retryAfter := time.Until(g.cooldownUntil)
			g.mu.Unlock()
			return &SpotifyRateLimitError{RetryAfter: retryAfter}
		}

		if !g.nextRequest.After(now) {
			g.nextRequest = now.Add(g.minSpacing)
			g.mu.Unlock()
			return nil
		}

		wait := time.Until(g.nextRequest)
		g.mu.Unlock()
		time.Sleep(wait)
	}
}

func (g *spotifyRequestGuard) markRateLimited(retryAfter time.Duration) {
	if retryAfter <= 0 {
		retryAfter = defaultSpotifyRateLimitCooldown
	}

	until := time.Now().Add(retryAfter + spotifyRateLimitBuffer)

	g.mu.Lock()
	defer g.mu.Unlock()

	if until.After(g.cooldownUntil) {
		g.cooldownUntil = until
	}
	if g.nextRequest.Before(g.cooldownUntil) {
		g.nextRequest = g.cooldownUntil.Add(g.minSpacing)
	}
}

var (
	sharedSpotifyGuard = newSpotifyRequestGuard(defaultSpotifyMinRequestSpacing)
	tokenRefreshGroup  singleflight.Group
)
