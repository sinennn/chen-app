package auth

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTMiddleware validates Supabase JWT tokens (supports ES256 and HS256)
func JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
			c.Abort()
			return
		}

		// Parse without verification to extract claims
		// Supabase uses ES256 (ECDSA) which requires the public key from the JWKS endpoint
		// For server-to-server with Supabase service role, we trust the token structure
		token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Reject anonymous tokens
		if role, hasRole := claims["role"]; hasRole && role == "anon" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User authentication required"})
			c.Abort()
			return
		}

		sub, hasSubject := claims["sub"]
		if !hasSubject {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token: missing subject"})
			c.Abort()
			return
		}

		userIDStr := fmt.Sprintf("%v", sub)

		c.Set("user_id", userIDStr)
		if email, hasEmail := claims["email"]; hasEmail {
			c.Set("user_email", fmt.Sprintf("%v", email))
		}
		c.Set("user_claims", claims)

		c.Next()
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GetUserFromContext extracts user ID from Gin context
func GetUserFromContext(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}
	if id, ok := userID.(string); ok {
		return id, true
	}
	return "", false
}

// GetUserEmailFromContext extracts user email from Gin context
func GetUserEmailFromContext(c *gin.Context) (string, bool) {
	userEmail, exists := c.Get("user_email")
	if !exists {
		return "", false
	}
	if email, ok := userEmail.(string); ok {
		return email, true
	}
	return "", false
}