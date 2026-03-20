package spotify

import (
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type SpotifyError struct {
	StatusCode int
	Message    string
	Endpoint   string
}

func (e *SpotifyError) Error() string {
	return fmt.Sprintf("Spotify API error [%d] at %s: %s", e.StatusCode, e.Endpoint, e.Message)
}

func handleSpotifyAPIError(resp *http.Response, endpoint string) error {
	switch resp.StatusCode {
	case 401:
		return &SpotifyError{
			StatusCode: resp.StatusCode,
			Message:    "Access token expired or invalid",
			Endpoint:   endpoint,
		}
	case 403:
		return &SpotifyError{
			StatusCode: resp.StatusCode,
			Message:    "Insufficient permissions or rate limited",
			Endpoint:   endpoint,
		}
	case 429:
		return &SpotifyError{
			StatusCode: resp.StatusCode,
			Message:    "Rate limit exceeded",
			Endpoint:   endpoint,
		}
	case 500, 502, 503:
		return &SpotifyError{
			StatusCode: resp.StatusCode,
			Message:    "Spotify service temporarily unavailable",
			Endpoint:   endpoint,
		}
	default:
		return &SpotifyError{
			StatusCode: resp.StatusCode,
			Message:    "Unknown API error",
			Endpoint:   endpoint,
		}
	}
}

func isRetryableError(err error) bool {
	if spotifyErr, ok := err.(*SpotifyError); ok {
		// Retry on server errors and rate limits
		return spotifyErr.StatusCode >= 500 || spotifyErr.StatusCode == 429
	}
	return false
}

func getRetryAfter(resp *http.Response) time.Duration {
	if resp == nil {
		return 0
	}
	
	retryAfter := resp.Header.Get("Retry-After")
	if retryAfter != "" {
		if seconds, err := strconv.Atoi(retryAfter); err == nil {
			return time.Duration(seconds) * time.Second
		}
	}
	return 0
}

func retryWithBackoff(fn func() error) error {
	var lastErr error
	
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoffDuration := time.Duration(1<<uint(attempt-1)) * time.Second
			time.Sleep(backoffDuration)
		}
		
		if err := fn(); err != nil {
			lastErr = err
			
			if !isRetryableError(err) {
				// Not retryable, return immediately
				return err
			}
			
			// For 429 errors, check if we have a Retry-After header
			if spotifyErr, ok := err.(*SpotifyError); ok && spotifyErr.StatusCode == 429 {
				// This will be handled by the specific API call that has the response
				continue
			}
		} else {
			// Success
			return nil
		}
	}
	
	return lastErr
}
