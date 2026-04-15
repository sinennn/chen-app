package auth

import (
	"chen/pkg/supabase"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type UserProfile struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Username  string `json:"username"`
	UserTag   string `json:"user_tag,omitempty"`
	AvatarID  string `json:"avatar_id"`
	IsPremium bool   `json:"is_premium"`
	CreatedAt string `json:"created_at"`
}

func RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.POST("/callback", handleAuthCallback)
	rg.POST("/signout", handleSignOut)
}

func RegisterProtectedRoutes(rg *gin.RouterGroup) {
	rg.GET("/user", handleGetUser)
	rg.POST("/user", handleUpdateUser)
}

// @Summary Auth Callback
// @Description OAuth callback endpoint for authentication providers
// @Tags auth
// @Produce json
// @Success 200 {object} map[string]string
// @Router /auth/callback [post]
func handleAuthCallback(c *gin.Context) {
	// This will be called after successful OAuth
	// For now, just return success
	c.JSON(http.StatusOK, gin.H{
		"message": "Auth callback received",
		"status":  "success",
	})
}

// @Summary Get Current User
// @Description Fetch the current authenticated user's profile
// @Tags auth
// @Produce json
// @Success 200 {object} UserProfile
// @Failure 401 {object} map[string]string
// @Security Bearer
// @Router /auth/user [get]
func handleGetUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	// Query the users table in Supabase
	client := supabase.GetClient()
	data, _, err := client.From("users").
		Select("id,email,username,user_tag,avatar_id,is_premium,created_at", "", false).
		Eq("id", userIDStr).
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
	var users []UserProfile
	if err := json.Unmarshal(data, &users); err != nil {
		log.Printf("Error parsing user data: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user data"})
		return
	}

	if len(users) == 0 {
		// @Summary Update Current User
		// @Description Update the current authenticated user's profile (username, avatar, etc.)
		// @Tags auth
		// @Accept json
		// @Produce json
		// @Param request body map[string]interface{} true "User profile updates"
		// @Success 200 {object} UserProfile
		// @Failure 400 {object} map[string]string
		// @Failure 401 {object} map[string]string
		// @Security Bearer
		// @Router /auth/user [post]
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Return user data directly (not wrapped in "user" key)
	c.JSON(http.StatusOK, users[0])
}

func handleUpdateUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	var updateData map[string]interface{}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client := supabase.GetClient()

	// If updating username, check for uniqueness
	if username, exists := updateData["username"]; exists && username != "" {
		usernameStr, ok := username.(string)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid username format"})
			return
		}

		// Check if username is already taken by another user
		data, _, err := client.From("users").
			Select("id", "", false).
			Eq("username", usernameStr).
			Neq("id", userIDStr).
			Execute()

		if err != nil {
			log.Printf("Error checking username uniqueness: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate username"})
			return
		}

		// Parse response to check if any users found
		var existingUsers []map[string]interface{}
		if len(data) > 0 {
			if err := json.Unmarshal(data, &existingUsers); err == nil && len(existingUsers) > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "Username is already taken"})
				return
			}
		}
	}

	// If updating user_tag, check for uniqueness
	if userTag, exists := updateData["user_tag"]; exists && userTag != "" {
		userTagStr, ok := userTag.(string)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_tag format"})
			return
		}

		// Check if user_tag is already taken by another user
		data, _, err := client.From("users").
			Select("id", "", false).
			Eq("user_tag", userTagStr).
			Neq("id", userIDStr).
			Execute()

		if err != nil {
			log.Printf("Error checking user_tag uniqueness: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate user_tag"})
			return
		}

		// Parse response to check if any users found
		var existingUsers []map[string]interface{}
		if len(data) > 0 {
			if err := json.Unmarshal(data, &existingUsers); err == nil && len(existingUsers) > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "User tag is already taken"})
				return
			}
		}
	}

	// Update user in Supabase
	_, _, err := client.From("users").
		Update(updateData, "", "").
		Eq("id", userIDStr).
		Execute()

	if err != nil {
		log.Printf("Error updating user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User updated successfully",
	})
}

// @Summary Sign Out
// @Description Sign out the current user
// @Tags auth
// @Produce json
// @Success 200 {object} map[string]string
// @Security Bearer
// @Router /auth/signout [post]
func handleSignOut(c *gin.Context) {
	// Handle sign out logic
	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully signed out",
	})
}
