package lastfm

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

var ErrNotConfigured = errors.New("last.fm api key not configured")

const artistTagsTTL = 7 * 24 * time.Hour

type Client struct {
	APIKey     string
	HTTPClient *http.Client
	cache      *artistTagCache
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

var sharedArtistTagCache = &artistTagCache{
	entries: make(map[string]artistTagCacheEntry),
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
		cache: sharedArtistTagCache,
	}, nil
}

func (c *Client) GetArtistTopTags(artistName string) ([]string, error) {
	if c == nil {
		return nil, fmt.Errorf("last.fm client is nil")
	}

	normalizedArtist := normalizeArtistCacheKey(artistName)
	if normalizedArtist == "" {
		return []string{}, nil
	}

	if tags, ok := c.cache.get(normalizedArtist); ok {
		return tags, nil
	}

	params := url.Values{}
	params.Set("method", "artist.getTopTags")
	params.Set("artist", artistName)
	params.Set("autocorrect", "1")
	params.Set("api_key", c.APIKey)
	params.Set("format", "json")

	requestURL := "https://ws.audioscrobbler.com/2.0/?" + params.Encode()
	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
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
		return nil, fmt.Errorf("last.fm artist.getTopTags failed [%d]: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed artistTopTagsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}

	if parsed.Error != 0 {
		return nil, fmt.Errorf("last.fm artist.getTopTags error [%d]: %s", parsed.Error, parsed.Message)
	}

	tags := make([]string, 0, len(parsed.TopTags.Tags))
	for _, tag := range parsed.TopTags.Tags {
		name := strings.TrimSpace(tag.Name)
		if name == "" {
			continue
		}
		tags = append(tags, name)
	}

	c.cache.set(normalizedArtist, tags, artistTagsTTL)
	return tags, nil
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
