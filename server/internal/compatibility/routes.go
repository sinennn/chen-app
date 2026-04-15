package compatibility

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", getCompatibility)
}

// @Summary Get Music Compatibility
// @Description Check music compatibility with another user (coming soon)
// @Tags compatibility
// @Produce json
// @Success 200 {object} map[string]string
// @Router /compatibility [get]
func getCompatibility(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Compatibility coming soon",
	})
}
