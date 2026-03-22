package auth

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func JWTMiddleware() gin.HandlerFunc {
	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	isProduction := strings.EqualFold(os.Getenv("APP_ENV"), "production")
	verifyInDevelopment := strings.EqualFold(os.Getenv("VERIFY_SUPABASE_JWT"), "true")

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

		var (
			token *jwt.Token
			err   error
		)

		shouldVerifySignature := isProduction || verifyInDevelopment

		if shouldVerifySignature {
			if jwtSecret == "" {
				if isProduction {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "SUPABASE_JWT_SECRET is required in production"})
					c.Abort()
					return
				}

				log.Println("auth: VERIFY_SUPABASE_JWT enabled but SUPABASE_JWT_SECRET is empty, falling back to unverified parsing")
				token, _, err = new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
			} else {
				token, err = jwt.Parse(tokenString, func(parsed *jwt.Token) (any, error) {
					if _, ok := parsed.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, fmt.Errorf("unexpected signing method: %s", parsed.Method.Alg())
					}
					return []byte(jwtSecret), nil
				})
			}
		} else {
			token, _, err = new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
		}

		if err != nil || token == nil || (shouldVerifySignature && !token.Valid) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
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
