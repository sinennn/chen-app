package main

import (
	"chen/internal/activity"
	"chen/internal/auth"
	"chen/internal/chen"
	"chen/internal/compatibility"
	"chen/internal/friends"
	"chen/internal/messages"
	"chen/internal/notifications"
	"chen/internal/payments"
	"chen/internal/profile"
	"chen/internal/reactions"
	"chen/internal/spotify"
	"chen/pkg/supabase"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Initialize Supabase client
	if err := supabase.InitClient(); err != nil {
		log.Printf("Warning: Failed to initialize Supabase client: %v", err)
	} else {
		log.Println("Supabase client initialized successfully")
	}

	// Start Spotify polling service
	go spotify.StartPoller()

	// Get PORT from environment variable, default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Create Gin router with default middleware
	router := gin.Default()

	// Add CORS middleware for development
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Chen is alive",
		})
	})

	v1 := router.Group("/api/v1")
	{
		// Public auth routes (no JWT required)
		auth.RegisterPublicRoutes(v1.Group("/auth"))

		protected := v1.Group("")
		protected.Use(auth.JWTMiddleware())
		{
			// Protected auth routes (JWT required)
			auth.RegisterProtectedRoutes(protected.Group("/auth"))

			spotify.RegisterRoutes(protected.Group("/spotify"))
			friends.RegisterRoutes(protected.Group("/friends"))
			activity.RegisterRoutes(protected.Group("/activity"))
			profile.RegisterProfileRoutes(protected.Group("/profile"))
			compatibility.RegisterRoutes(protected.Group("/compatibility"))
			chen.RegisterRoutes(protected.Group("/chen"))
			payments.RegisterRoutes(protected.Group("/payments"))
			notifications.RegisterRoutes(protected.Group("/notifications"))
			messages.RegisterRoutes(protected.Group("/messages"))
			reactions.RegisterRoutes(protected.Group("/reactions"))
		}
	}

	// Start server
	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
