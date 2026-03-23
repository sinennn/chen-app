package spotify

import (
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

type sharedCacheEntry struct {
	value     any
	expiresAt time.Time
}

type sharedCache struct {
	mu        sync.RWMutex
	entries   map[string]sharedCacheEntry
	cooldowns map[string]time.Time
	group     singleflight.Group
}

func newSharedCache() *sharedCache {
	return &sharedCache{
		entries:   make(map[string]sharedCacheEntry),
		cooldowns: make(map[string]time.Time),
	}
}

func (c *sharedCache) getFresh(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}

	return entry.value, true
}

func (c *sharedCache) getAny(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}

	return entry.value, true
}

func (c *sharedCache) set(key string, value any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = sharedCacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
}

func (c *sharedCache) cooldownRemaining(key string) time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()

	until, ok := c.cooldowns[key]
	if !ok || !until.After(time.Now()) {
		return 0
	}

	return time.Until(until)
}

func (c *sharedCache) setCooldown(key string, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 30 * time.Second
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	c.cooldowns[key] = time.Now().Add(ttl)
}

func (c *sharedCache) clearCooldown(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cooldowns, key)
}

func (c *sharedCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
	delete(c.cooldowns, key)
}

func loadSharedResource[T any](cache *sharedCache, key string, ttl time.Duration, fetch func() (T, error)) (T, error) {
	if cached, ok := cache.getFresh(key); ok {
		return cached.(T), nil
	}

	value, err, _ := cache.group.Do(key, func() (any, error) {
		if cached, ok := cache.getFresh(key); ok {
			return cached, nil
		}

		if retryAfter := cache.cooldownRemaining(key); retryAfter > 0 {
			if cached, ok := cache.getAny(key); ok {
				return cached, nil
			}

			var zero T
			return zero, &SpotifyRateLimitError{RetryAfter: retryAfter}
		}

		result, err := fetch()
		if err != nil {
			if rateLimitErr, ok := err.(*SpotifyRateLimitError); ok {
				cache.setCooldown(key, rateLimitErr.RetryAfter)
				if cached, hasCached := cache.getAny(key); hasCached {
					return cached, nil
				}
			}

			var zero T
			return zero, err
		}

		cache.clearCooldown(key)
		cache.set(key, result, ttl)
		return result, nil
	})
	if err != nil {
		var zero T
		return zero, err
	}

	return value.(T), nil
}
