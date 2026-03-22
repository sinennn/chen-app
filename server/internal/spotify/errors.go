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
		retryAfter := getRetryAfter(resp)
		return &SpotifyRateLimitError{
			RetryAfter: retryAfter,
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

func isTokenExpiredError(err error) bool {
	if spotifyErr, ok := err.(*SpotifyError); ok {
		return spotifyErr.StatusCode == 401
	}
	return false
}

func isRetryableError(err error) bool {
	if spotifyErr, ok := err.(*SpotifyError); ok {
		return spotifyErr.StatusCode >= 500
	}
	if _, ok := err.(*SpotifyRateLimitError); ok {
		return false
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
			backoffDuration := time.Duration(1<<uint(attempt-1)) * time.Second
			time.Sleep(backoffDuration)
		}

		if err := fn(); err != nil {
			lastErr = err

			if !isRetryableError(err) {
				return err
			}
		} else {
			return nil
		}
	}

	return lastErr
}
