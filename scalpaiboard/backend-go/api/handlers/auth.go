package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token     string       `json:"token"`
	ExpiresAt int64        `json:"expiresAt"`
	User      UserResponse `json:"user"`
}

type UserResponse struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
}

// Register creates a new user account
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Check if email already exists
	var exists bool
	err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Check if username already exists
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", req.Username).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Insert user
	var userID string
	err = h.db.QueryRow(`
		INSERT INTO users (email, username, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id
	`, req.Email, req.Username, string(hashedPassword)).Scan(&userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate JWT token
	token, expiresAt, err := generateJWT(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: UserResponse{
			ID:       userID,
			Email:    req.Email,
			Username: req.Username,
		},
	})
}

// Login authenticates a user and returns a JWT token
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get user by email
	var userID, email, username, passwordHash string
	err := h.db.QueryRow(`
		SELECT id, email, username, password_hash 
		FROM users 
		WHERE email = $1 AND is_active = true
	`, req.Email).Scan(&userID, &email, &username, &passwordHash)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT token
	token, expiresAt, err := generateJWT(userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: UserResponse{
			ID:       userID,
			Email:    email,
			Username: username,
		},
	})
}

// GetMe returns the current authenticated user
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var email, username string
	err := h.db.QueryRow(`
		SELECT email, username FROM users WHERE id = $1
	`, userID).Scan(&email, &username)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		ID:       userID,
		Email:    email,
		Username: username,
	})
}

// RefreshToken generates a new token for an authenticated user
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	userID := c.GetString("user_id")
	email := c.GetString("email")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	token, expiresAt, err := generateJWT(userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":     token,
		"expiresAt": expiresAt,
	})
}

// generateJWT creates a new JWT token
func generateJWT(userID, email string) (string, int64, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev_jwt_secret"
	}

	// Token expires in 24 hours
	expiresAt := time.Now().Add(24 * time.Hour).Unix()

	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"exp":     expiresAt,
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", 0, err
	}

	return signedToken, expiresAt, nil
}
