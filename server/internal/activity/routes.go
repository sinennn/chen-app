package activity

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type ActivityItem struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Track     string    `json:"track"`
	Artist    string    `json:"artist"`
	Platform  string    `json:"platform"`
	StartedAt time.Time `json:"started_at"`
	IsPlaying bool      `json:"is_playing"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/feed", func(c *gin.Context) {
		now := time.Now().UTC()

		mock := []ActivityItem{
			{
				ID:        "1",
				Username:  "wale",
				Track:     "Unavailable",
				Artist:    "Davido ft. Musa Keys",
				Platform:  "spotify",
				StartedAt: now.Add(-2 * time.Minute),
				IsPlaying: true,
			},
			{
				ID:        "2",
				Username:  "amina",
				Track:     "Asylum",
				Artist:    "Bloody Civilian",
				Platform:  "spotify",
				StartedAt: now.Add(-8 * time.Minute),
				IsPlaying: false,
			},
		}

		c.JSON(http.StatusOK, gin.H{
			"data": mock,
		})
	})
}
