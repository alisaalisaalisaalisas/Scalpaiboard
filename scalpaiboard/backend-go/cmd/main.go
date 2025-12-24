package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"github.com/scalpaiboard/backend/api/handlers"
	"github.com/scalpaiboard/backend/api/middleware"
	"github.com/scalpaiboard/backend/service"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database connection
	db, err := initDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis
	rdb := initRedis()

	// Initialize services
	coinService := service.NewCoinService(db, rdb)
	alertService := service.NewAlertService(db)
	watchlistService := service.NewWatchlistService(db)
	exchangeService := service.NewExchangeService(rdb)

	// Initialize handlers
	coinHandler := handlers.NewCoinHandler(coinService, exchangeService)
	alertHandler := handlers.NewAlertHandler(alertService)
	watchlistHandler := handlers.NewWatchlistHandler(watchlistService)
	wsHandler := handlers.NewWebSocketHandler(exchangeService)

	// Setup Gin router
	if os.Getenv("LOG_LEVEL") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.Default()

	// CORS configuration
	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:3000,http://localhost:5173"
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// Health check
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "scalpaiboard-go",
		})
	})

	// Public routes
	router.GET("/api/coins", coinHandler.ListCoins)
	router.GET("/api/coins/:symbol", coinHandler.GetCoin)
	router.GET("/api/coins/:symbol/candles", coinHandler.GetCandles)
	router.GET("/api/coins/:symbol/orderbook", coinHandler.GetOrderbook)

	// WebSocket
	router.GET("/ws", wsHandler.HandleConnection)

	// Protected routes (require authentication)
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	{
		// Watchlist
		protected.GET("/watchlist", watchlistHandler.GetWatchlist)
		protected.POST("/watchlist", watchlistHandler.AddToWatchlist)
		protected.DELETE("/watchlist/:coinId", watchlistHandler.RemoveFromWatchlist)

		// Alerts
		protected.GET("/alerts", alertHandler.ListAlerts)
		protected.POST("/alerts", alertHandler.CreateAlert)
		protected.PUT("/alerts/:id", alertHandler.UpdateAlert)
		protected.DELETE("/alerts/:id", alertHandler.DeleteAlert)
		protected.GET("/alerts/:id/history", alertHandler.GetAlertHistory)

		// AI Chat (routes to C# backend via gRPC)
		protected.POST("/ai/chat", handlers.HandleAIChat)
		protected.GET("/ai/conversations", handlers.ListConversations)
		protected.GET("/ai/providers", handlers.ListAIProviders)
		protected.POST("/ai/providers", handlers.AddAIProvider)
		protected.PUT("/ai/providers/:id", handlers.UpdateAIProvider)
		protected.DELETE("/ai/providers/:id", handlers.DeleteAIProvider)
		protected.POST("/ai/providers/:id/test", handlers.TestAIProvider)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	log.Printf("🚀 Scalpaiboard Go backend starting on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func initDB() (*sql.DB, error) {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "scalpaiboard")
	password := getEnv("DB_PASSWORD", "scalpaiboard_dev")
	dbname := getEnv("DB_NAME", "scalpaiboard")

	connStr := "host=" + host + " port=" + port + " user=" + user +
		" password=" + password + " dbname=" + dbname + " sslmode=disable"

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	// Connection pool settings
	db.SetMaxOpenConns(50)
	db.SetMaxIdleConns(10)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, err
	}

	log.Println("✅ Connected to PostgreSQL")
	return db, nil
}

func initRedis() *redis.Client {
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379")
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("⚠️ Failed to parse Redis URL, using defaults: %v", err)
		opt = &redis.Options{
			Addr: "localhost:6379",
		}
	}

	rdb := redis.NewClient(opt)
	log.Println("✅ Connected to Redis")
	return rdb
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
