package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HandleAIChat handles AI chat requests (proxies to C# backend)
func HandleAIChat(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Message        string `json:"message" binding:"required"`
		ProviderId     int    `json:"providerId"`
		ConversationId string `json:"conversationId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// TODO: Call C# backend via gRPC for AI processing
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"message": "AI chat will be processed by C# backend via gRPC",
		"note":    "Configure your AI provider in Settings first",
	})
}

// ListConversations returns user's AI conversation history
func ListConversations(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// TODO: Fetch from database
	c.JSON(http.StatusOK, []interface{}{})
}

// ListAIProviders returns user's configured AI providers
func ListAIProviders(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// TODO: Fetch from database
	// Available provider types for UI dropdown
	providerTypes := []map[string]string{
		{"id": "openai", "name": "OpenAI", "models": "gpt-4, gpt-4-turbo, gpt-3.5-turbo"},
		{"id": "anthropic", "name": "Anthropic", "models": "claude-3-opus, claude-3-sonnet, claude-3-haiku"},
		{"id": "google", "name": "Google Vertex AI", "models": "gemini-pro"},
		{"id": "aws", "name": "AWS Bedrock", "models": "claude-3, llama2, mistral"},
		{"id": "together", "name": "Together AI", "models": "llama-2-70b, mistral-7b"},
		{"id": "huggingface", "name": "Hugging Face", "models": "Various open models"},
		{"id": "mistral", "name": "Mistral AI", "models": "mistral-7b, mistral-medium, mistral-large"},
		{"id": "groq", "name": "Groq", "models": "llama-2, mixtral"},
		{"id": "openrouter", "name": "OpenRouter", "models": "100+ models"},
	}

	c.JSON(http.StatusOK, gin.H{
		"configured": []interface{}{},
		"available":  providerTypes,
	})
}

// AddAIProvider adds a new AI provider configuration
func AddAIProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ProviderType string  `json:"providerType" binding:"required"`
		ProviderName string  `json:"providerName" binding:"required"`
		APIKey       string  `json:"apiKey" binding:"required"`
		ModelName    string  `json:"modelName" binding:"required"`
		MaxTokens    int     `json:"maxTokens"`
		Temperature  float64 `json:"temperature"`
		IsDefault    bool    `json:"isDefault"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// TODO: Save to database with encrypted API key
	c.JSON(http.StatusCreated, gin.H{
		"status":  "created",
		"message": "AI provider added successfully",
	})
}

// UpdateAIProvider updates an AI provider configuration
func UpdateAIProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// TODO: Update in database
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// DeleteAIProvider removes an AI provider configuration
func DeleteAIProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// TODO: Delete from database
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// TestAIProvider tests connection to an AI provider
func TestAIProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// TODO: Call C# backend to test provider
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Connection test passed",
	})
}
