package notifications

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Notifications coming soon",
		})
	})
}
