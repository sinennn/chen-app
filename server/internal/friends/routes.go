package friends

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Friend struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	Compatibility int   `json:"compatibility"`
	Online       bool   `json:"online"`
}

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", func(c *gin.Context) {
		mock := []Friend{
			{ID: "1", Username: "wale", Compatibility: 88, Online: true},
			{ID: "2", Username: "amina", Compatibility: 76, Online: false},
			{ID: "3", Username: "chidi", Compatibility: 64, Online: true},
		}

		c.JSON(http.StatusOK, gin.H{
			"data": mock,
		})
	})
}
