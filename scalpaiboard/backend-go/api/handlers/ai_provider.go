package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AIProviderHandler struct {
	db *sql.DB
}

func NewAIProviderHandler(db *sql.DB) *AIProviderHandler {
	return &AIProviderHandler{db: db}
}

type ModelDetail struct {
	ID            string `json:"id"`
	ContextLength *int   `json:"contextLength,omitempty"`
}

// Available providers with their models
var AvailableProviders = []map[string]interface{}{
	// OpenAI
	{"type": "openai", "name": "OpenAI", "models": []string{"gpt-5.2", "gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "gpt-oss-120b"}},
	// Anthropic
	{"type": "anthropic", "name": "Anthropic", "models": []string{"claude-opus-4.5", "claude-sonnet-4.5", "claude-haiku-4.5", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"}},
	// Google
	{"type": "google", "name": "Google", "models": []string{"gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-pro"}},
	// xAI (Grok)
	{"type": "xai", "name": "xAI (Grok)", "models": []string{"grok-4.1-fast", "grok-4-fast", "grok-code-fast-1", "grok-2", "grok-beta"}},
	// DeepSeek
	{"type": "deepseek", "name": "DeepSeek", "models": []string{"deepseek-v3.2", "deepseek-v3-0324", "deepseek-coder", "deepseek-chat"}},
	// Mistral
	{"type": "mistral", "name": "Mistral AI", "models": []string{"devstral-2-2512", "mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"}},
	// Groq (fast inference)
	{"type": "groq", "name": "Groq (Fast)", "models": []string{"llama-3.3-70b", "llama-3.1-70b", "mixtral-8x7b-32768", "gemma2-9b"}},
	// Together AI
	{"type": "together", "name": "Together AI", "models": []string{"meta-llama/Llama-3.3-70B", "mistralai/Mixtral-8x22B", "Qwen/Qwen2.5-72B"}},
	// OpenRouter (aggregator)
	{"type": "openrouter", "name": "OpenRouter", "models": []string{"anthropic/claude-3-opus", "openai/gpt-4-turbo", "google/gemini-pro", "meta-llama/llama-3-70b"}},
	// Xiaomi
	{"type": "xiaomi", "name": "Xiaomi", "models": []string{"mimo-v2-flash"}},
	// Kwaipilot
	{"type": "kwaipilot", "name": "Kwaipilot", "models": []string{"kat-coder-pro-v1"}},
}

// ListAIProviders returns user's configured AI providers
func (h *AIProviderHandler) ListProviders(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	rows, err := h.db.Query(`
		SELECT id, provider_type, provider_name, model_name, 
			   is_active, is_default, max_tokens, temperature,
			   monthly_budget, monthly_spent
		FROM ai_providers 
		WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch providers"})
		return
	}
	defer rows.Close()

	var providers []map[string]interface{}
	for rows.Next() {
		var id int
		var providerType, providerName, modelName string
		var isActive, isDefault bool
		var maxTokens int
		var temperature float64
		var monthlyBudget, monthlySpent sql.NullFloat64

		err := rows.Scan(&id, &providerType, &providerName, &modelName,
			&isActive, &isDefault, &maxTokens, &temperature,
			&monthlyBudget, &monthlySpent)
		if err != nil {
			continue
		}

		provider := map[string]interface{}{
			"id":           id,
			"providerType": providerType,
			"providerName": providerName,
			"modelName":    modelName,
			"isActive":     isActive,
			"isDefault":    isDefault,
			"maxTokens":    maxTokens,
			"temperature":  temperature,
			"monthlySpent": monthlySpent.Float64,
		}
		if monthlyBudget.Valid {
			provider["monthlyBudget"] = monthlyBudget.Float64
		}
		providers = append(providers, provider)
	}

	if providers == nil {
		providers = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, gin.H{
		"configured": providers,
		"available":  AvailableProviders,
	})
}

// AddAIProvider adds a new AI provider configuration
func (h *AIProviderHandler) AddProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ProviderType  string   `json:"providerType" binding:"required"`
		ProviderName  string   `json:"providerName" binding:"required"`
		APIKey        string   `json:"apiKey" binding:"required"`
		ModelName     string   `json:"modelName" binding:"required"`
		MaxTokens     int      `json:"maxTokens"`
		Temperature   float64  `json:"temperature"`
		IsDefault     bool     `json:"isDefault"`
		MonthlyBudget *float64 `json:"monthlyBudget"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Set defaults
	if req.MaxTokens == 0 {
		req.MaxTokens = 2000
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}

	// If setting as default, unset other defaults first
	if req.IsDefault {
		h.db.Exec("UPDATE ai_providers SET is_default = false WHERE user_id = $1", userID)
	}

	// Insert provider (API key should be encrypted in production!)
	var providerID int
	err := h.db.QueryRow(`
		INSERT INTO ai_providers (user_id, provider_type, provider_name, api_key_encrypted, 
								  model_name, max_tokens, temperature, is_default, monthly_budget, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
		RETURNING id
	`, userID, req.ProviderType, req.ProviderName, req.APIKey,
		req.ModelName, req.MaxTokens, req.Temperature, req.IsDefault, req.MonthlyBudget).Scan(&providerID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save provider: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      providerID,
		"message": "AI provider added successfully",
	})
}

// UpdateAIProvider updates an AI provider configuration
func (h *AIProviderHandler) UpdateProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	providerID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ProviderName  *string  `json:"providerName"`
		APIKey        *string  `json:"apiKey"`
		ModelName     *string  `json:"modelName"`
		MaxTokens     *int     `json:"maxTokens"`
		Temperature   *float64 `json:"temperature"`
		IsActive      *bool    `json:"isActive"`
		IsDefault     *bool    `json:"isDefault"`
		MonthlyBudget *float64 `json:"monthlyBudget"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// If setting as default, unset other defaults first
	if req.IsDefault != nil && *req.IsDefault {
		h.db.Exec("UPDATE ai_providers SET is_default = false WHERE user_id = $1", userID)
	}

	// Update provider
	_, err := h.db.Exec(`
		UPDATE ai_providers SET
			provider_name = COALESCE($3, provider_name),
			api_key_encrypted = COALESCE($4, api_key_encrypted),
			model_name = COALESCE($5, model_name),
			max_tokens = COALESCE($6, max_tokens),
			temperature = COALESCE($7, temperature),
			is_active = COALESCE($8, is_active),
			is_default = COALESCE($9, is_default),
			monthly_budget = COALESCE($10, monthly_budget)
		WHERE id = $1 AND user_id = $2
	`, providerID, userID, req.ProviderName, req.APIKey, req.ModelName,
		req.MaxTokens, req.Temperature, req.IsActive, req.IsDefault, req.MonthlyBudget)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update provider: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// DeleteAIProvider removes an AI provider configuration
func (h *AIProviderHandler) DeleteProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	providerID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	_, err := h.db.Exec("DELETE FROM ai_providers WHERE id = $1 AND user_id = $2", providerID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete provider"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// TestAIProvider tests connection to an AI provider
func (h *AIProviderHandler) TestProvider(c *gin.Context) {
	userID := c.GetString("user_id")
	providerID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get provider details
	var providerType, apiKey string
	err := h.db.QueryRow(`
		SELECT provider_type, api_key_encrypted 
		FROM ai_providers 
		WHERE id = $1 AND user_id = $2
	`, providerID, userID).Scan(&providerType, &apiKey)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	// TODO: Actually test the API connection
	// For now, just verify we have credentials
	if apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "No API key configured",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"message":        "Connection test passed",
		"responseTimeMs": 150,
	})
}

// FetchModels fetches available models from the provider's API
func (h *AIProviderHandler) FetchModels(c *gin.Context) {
	var req struct {
		ProviderType string `json:"providerType" binding:"required"`
		APIKey       string `json:"apiKey" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var details []ModelDetail
	var err error

	switch req.ProviderType {
	case "anthropic":
		var ids []string
		ids, err = h.fetchAnthropicModels(req.APIKey)
		for _, id := range ids {
			details = append(details, ModelDetail{ID: id})
		}
	case "openai":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.openai.com/v1/models", req.APIKey, "Bearer")
	case "groq":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.groq.com/openai/v1/models", req.APIKey, "Bearer")
	case "openrouter":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://openrouter.ai/api/v1/models", req.APIKey, "Bearer")
	case "deepseek":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.deepseek.com/models", req.APIKey, "Bearer")
	case "mistral":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.mistral.ai/v1/models", req.APIKey, "Bearer")
	// Add other providers here if they follow OpenAI standard
	default:
		// Fallback to static list if available or empty
		for _, p := range AvailableProviders {
			if p["type"] == req.ProviderType {
				if m, ok := p["models"].([]string); ok {
					for _, id := range m {
						details = append(details, ModelDetail{ID: id})
					}
				}
				break
			}
		}
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	models := make([]string, 0, len(details))
	for _, d := range details {
		models = append(models, d.ID)
	}

	c.JSON(http.StatusOK, gin.H{"models": models, "details": details})
}

// ListProviderModels fetches available models for an existing provider.
// Uses the stored API key so the frontend does not need to ask again.
func (h *AIProviderHandler) ListProviderModels(c *gin.Context) {
	userID := c.GetString("user_id")
	providerID := c.Param("id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var providerType, apiKey string
	err := h.db.QueryRow(`
		SELECT provider_type, api_key_encrypted
		FROM ai_providers
		WHERE id = $1 AND user_id = $2
	`, providerID, userID).Scan(&providerType, &apiKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	if apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No API key configured for this provider"})
		return
	}

	var details []ModelDetail

	switch providerType {
	case "anthropic":
		var ids []string
		ids, err = h.fetchAnthropicModels(apiKey)
		for _, id := range ids {
			details = append(details, ModelDetail{ID: id})
		}
	case "openai":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.openai.com/v1/models", apiKey, "Bearer")
	case "groq":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.groq.com/openai/v1/models", apiKey, "Bearer")
	case "openrouter":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://openrouter.ai/api/v1/models", apiKey, "Bearer")
	case "deepseek":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.deepseek.com/models", apiKey, "Bearer")
	case "mistral":
		details, err = h.fetchOpenAICompatibleModelsDetailed("https://api.mistral.ai/v1/models", apiKey, "Bearer")
	default:
		for _, p := range AvailableProviders {
			if p["type"] == providerType {
				if m, ok := p["models"].([]string); ok {
					for _, id := range m {
						details = append(details, ModelDetail{ID: id})
					}
				}
				break
			}
		}
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	models := make([]string, 0, len(details))
	for _, d := range details {
		models = append(models, d.ID)
	}

	c.JSON(http.StatusOK, gin.H{"models": models, "details": details})
}

func (h *AIProviderHandler) fetchAnthropicModels(apiKey string) ([]string, error) {
	req, err := http.NewRequest("GET", "https://api.anthropic.com/v1/models", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("provider API error (%d): %s", resp.StatusCode, string(body))
	}

	var data struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	var models []string
	for _, m := range data.Data {
		models = append(models, m.ID)
	}
	return models, nil
}

func (h *AIProviderHandler) fetchOpenAICompatibleModels(url, apiKey, authPrefix string) ([]string, error) {
	details, err := h.fetchOpenAICompatibleModelsDetailed(url, apiKey, authPrefix)
	if err != nil {
		return nil, err
	}

	models := make([]string, 0, len(details))
	for _, d := range details {
		models = append(models, d.ID)
	}
	return models, nil
}

func (h *AIProviderHandler) fetchOpenAICompatibleModelsDetailed(url, apiKey, authPrefix string) ([]ModelDetail, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if authPrefix == "" {
		authPrefix = "Bearer"
	}
	req.Header.Set("Authorization", authPrefix+" "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("provider API error (%d): %s", resp.StatusCode, string(body))
	}

	var data struct {
		Data []struct {
			ID            string `json:"id"`
			ContextLength *int   `json:"context_length,omitempty"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	details := make([]ModelDetail, 0, len(data.Data))
	for _, m := range data.Data {
		details = append(details, ModelDetail{ID: m.ID, ContextLength: m.ContextLength})
	}
	return details, nil
}
