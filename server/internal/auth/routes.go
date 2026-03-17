package auth

import (
	"chen/pkg/supabase"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/callback", handleAuthCallback)
	rg.GET("/user", handleGetUser)
	rg.POST("/signout", handleSignOut)
}

func handleAuthCallback(c *gin.Context) {
	// This will be called after successful OAuth
	// For now, just return success
	c.JSON(http.StatusOK, gin.H{
		"message": "Auth callback received",
		"status":  "success",
	})
}

func handleGetUser(c *gin.Context) {
	userID, exists := GetUserFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	// Query the users table in Supabase
	client := supabase.GetClient()
	data, _, err := client.From("users").
		Select("id,email,username,avatar_id,is_premium,created_at", "", false).
		Eq("id", userID).
		Execute()

	if err != nil {
		log.Printf("Error fetching user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Parse the JSON response
	var users []map[string]interface{}
	if err := json.Unmarshal(data, &users); err != nil {
		log.Printf("Error parsing user data: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user data"})
		return
	}

	if len(users) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": users[0],
	})
}

func handleSignOut(c *gin.Context) {
	// Handle sign out logic
	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully signed out",
	})
}
