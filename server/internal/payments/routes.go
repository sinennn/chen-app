package payments

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", getPayments)
}

// @Summary Get Payments Info
// @Description Payment system endpoint (coming soon)
// @Tags payments
// @Produce json
// @Success 200 {object} map[string]string
// @Router /payments [get]
func getPayments(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Payments coming soon",
	})
}
