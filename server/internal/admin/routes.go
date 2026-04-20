package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"chen/pkg/supabase"

	"github.com/gin-gonic/gin"
)

// AdminMiddleware guards all /admin routes with a static secret key.
// Set ADMIN_SECRET in the server environment. If the env var is empty,
// every request is rejected with 503 so the endpoints are never accidentally
// open on a deploy that forgot to configure the secret.
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := strings.TrimSpace(os.Getenv("ADMIN_SECRET"))
		if secret == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "Admin endpoints are not configured on this server (ADMIN_SECRET not set)",
			})
			c.Abort()
			return
		}

		provided := strings.TrimSpace(c.GetHeader("X-Admin-Secret"))
		if provided == "" || provided != secret {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RegisterRoutes wires the admin endpoints onto the given router group.
// The group must already have AdminMiddleware applied.
func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/users/:userId/super-user", handleGetSuperUser)
	rg.PUT("/users/:userId/super-user", handleSetSuperUser)
}

// setSuperUserRequest is the request body for PUT /admin/users/:userId/super-user.
type setSuperUserRequest struct {
	Enabled bool `json:"enabled"`
}

// superUserResponse is returned by both GET and PUT endpoints.
type superUserResponse struct {
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	IsSuperUser bool   `json:"is_super_user"`
	Message     string `json:"message,omitempty"`
}

// handleGetSuperUser returns the current super-user flag value for a user.
//
//	GET /admin/users/:userId/super-user
//	Header: X-Admin-Secret: <ADMIN_SECRET>
//
//	200: { "user_id": "...", "email": "...", "username": "...", "is_super_user": false }
//	404: user not found
func handleGetSuperUser(c *gin.Context) {
	userID := strings.TrimSpace(c.Param("userId"))
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	row, err := fetchUserRow(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}
	if row == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, superUserResponse{
		UserID:      strVal(row["id"]),
		Email:       strVal(row["email"]),
		Username:    strVal(row["username"]),
		IsSuperUser: boolVal(row["is_super_user"]),
	})
}

// handleSetSuperUser enables or disables the super-user flag for a user.
//
//	PUT /admin/users/:userId/super-user
//	Header: X-Admin-Secret: <ADMIN_SECRET>
//	Body:   { "enabled": true }
//
//	200: { "user_id": "...", "email": "...", "username": "...", "is_super_user": true, "message": "..." }
//	404: user not found
func handleSetSuperUser(c *gin.Context) {
	userID := strings.TrimSpace(c.Param("userId"))
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	var req setSuperUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": `invalid body — expected {"enabled": true}`})
		return
	}

	client := supabase.GetClient()
	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	// Verify the user exists before updating.
	row, err := fetchUserRow(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
		return
	}
	if row == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	_, _, err = client.From("users").
		Update(map[string]any{"is_super_user": req.Enabled}, "", "").
		Eq("id", userID).
		Execute()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to update user: %v", err),
		})
		return
	}

	action := "disabled"
	if req.Enabled {
		action = "enabled"
	}

	c.JSON(http.StatusOK, superUserResponse{
		UserID:      strVal(row["id"]),
		Email:       strVal(row["email"]),
		Username:    strVal(row["username"]),
		IsSuperUser: req.Enabled,
		Message:     fmt.Sprintf("super-user flag %s for %s", action, userID),
	})
}

// fetchUserRow loads id, email, username, and is_super_user for the given user.
// Returns (nil, nil) when the user does not exist.
// Falls back to a query without is_super_user if the migration has not been run yet.
func fetchUserRow(userID string) (map[string]any, error) {
	client := supabase.GetClient()
	if client == nil {
		return nil, fmt.Errorf("database connection failed")
	}

	data, _, err := client.From("users").
		Select("id,email,username,is_super_user", "", false).
		Eq("id", userID).
		Limit(1, "").
		Execute()

	if err != nil && isMissingColumnErr(err, "is_super_user") {
		// Migration not yet applied — fall back to a query without the column.
		data, _, err = client.From("users").
			Select("id,email,username", "", false).
			Eq("id", userID).
			Limit(1, "").
			Execute()
	}
	if err != nil {
		return nil, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0], nil
}

// isMissingColumnErr reports whether err is a PostgreSQL "column does not exist"
// error (code 42703) for the named column.
func isMissingColumnErr(err error, column string) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, strings.ToLower(column)) &&
		(strings.Contains(msg, "42703") ||
			strings.Contains(msg, "does not exist") ||
			strings.Contains(msg, "column"))
}

// strVal safely converts any JSON-unmarshalled value to a string.
func strVal(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

// boolVal safely converts any JSON-unmarshalled value to a bool.
func boolVal(v any) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}
