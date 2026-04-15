package lastfm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

var ErrNotConfigured = errors.New("last.fm api key not configured")

const artistTagsTTL = 7 * 24 * time.Hour

type Client struct {
	APIKey     string
	HTTPClient *http.Client
	cache      *artistTagCache
	group      singleflight.Group
	logger     *log.Logger
}

type artistTagCache struct {
	mu      sync.RWMutex
	entries map[string]artistTagCacheEntry
}

type artistTagCacheEntry struct {
	tags      []string
	expiresAt time.Time
}

type artistTopTagsResponse struct {
	TopTags struct {
		Tags []struct {
			Name string `json:"name"`
		} `json:"tag"`
	} `json:"toptags"`
	Error   int    `json:"error"`
	Message string `json:"message"`
}

func NewClientFromEnv() (*Client, error) {
	apiKey := strings.TrimSpace(os.Getenv("LASTFM_API_KEY"))
	if apiKey == "" {
		return nil, ErrNotConfigured
	}

	return &Client{
		APIKey: apiKey,
		HTTPClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		cache: &artistTagCache{
			entries: make(map[string]artistTagCacheEntry),
		},
		logger: log.New(os.Stdout, "[lastfm] ", log.LstdFlags|log.Lmicroseconds),
	}, nil
}

func (c *Client) GetArtistTopTags(ctx context.Context, artistName string) ([]string, error) {
	if c == nil {
		return nil, fmt.Errorf("client is nil")
	}

	normalized := normalizeArtistCacheKey(artistName)
	if normalized == "" {
		return []string{}, nil
	}

	// CACHE HIT
	if tags, ok := c.cache.get(normalized); ok {
		c.logResult(artistName, tags, true)
		return tags, nil
	}

	//  SINGLEFLIGHT (kills stampede)
	result, err, _ := c.group.Do(normalized, func() (any, error) {

		// double-check cache inside lock window
		if tags, ok := c.cache.get(normalized); ok {
			return tags, nil
		}

		params := url.Values{}
		params.Set("method", "artist.getTopTags")
		params.Set("artist", artistName)
		params.Set("autocorrect", "1")
		params.Set("api_key", c.APIKey)
		params.Set("format", "json")

		reqURL := "https://ws.audioscrobbler.com/2.0/?" + params.Encode()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "Chen/1.0")

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("last.fm error [%d]: %s", resp.StatusCode, string(body))
		}

		var parsed artistTopTagsResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return nil, err
		}

		if parsed.Error != 0 {
			return nil, fmt.Errorf("last.fm api error [%d]: %s", parsed.Error, parsed.Message)
		}

		tags := make([]string, 0, len(parsed.TopTags.Tags))
		for _, t := range parsed.TopTags.Tags {
			name := strings.TrimSpace(t.Name)
			if name != "" {
				tags = append(tags, name)
			}
		}

		c.cache.set(normalized, tags, artistTagsTTL)
		return tags, nil
	})

	if err != nil {
		return nil, err
	}

	tags := result.([]string)

	c.logResult(artistName, tags, false)

	return tags, nil
}

func (c *Client) logResult(artist string, tags []string, cached bool) {
	if len(tags) == 0 {
		c.logger.Printf("artist=%s cached=%v genre=unknown", artist, cached)
		return
	}

	genre := tags[0] // crude but practical “dominant tag”

	c.logger.Printf(
		"artist=%s cached=%v genre=%s tags=%v",
		artist,
		cached,
		genre,
		tags,
	)
}

func normalizeArtistCacheKey(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

func (c *artistTagCache) get(key string) ([]string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}

	return entry.tags, true
}

func (c *artistTagCache) set(key string, tags []string, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = artistTagCacheEntry{
		tags:      append([]string(nil), tags...),
		expiresAt: time.Now().Add(ttl),
	}
}