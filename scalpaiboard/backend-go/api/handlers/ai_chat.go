package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type AIChatHandler struct {
	db *sql.DB
}

func NewAIChatHandler(db *sql.DB) *AIChatHandler {
	return &AIChatHandler{db: db}
}

// AI Provider API endpoints
var providerEndpoints = map[string]string{
	"openai":     "https://api.openai.com/v1/chat/completions",
	"anthropic":  "https://api.anthropic.com/v1/messages",
	"google":     "https://generativelanguage.googleapis.com/v1beta/models",
	"xai":        "https://api.x.ai/v1/chat/completions",
	"deepseek":   "https://api.deepseek.com/chat/completions",
	"mistral":    "https://api.mistral.ai/v1/chat/completions",
	"groq":       "https://api.groq.com/openai/v1/chat/completions",
	"together":   "https://api.together.xyz/v1/chat/completions",
	"openrouter": "https://openrouter.ai/api/v1/chat/completions",
}

// HandleChat processes AI chat requests
func (h *AIChatHandler) HandleChat(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Message        string `json:"message" binding:"required"`
		ProviderId     *int   `json:"providerId"`
		ConversationId string `json:"conversationId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
		return
	}

	// Get provider (either specified or default)
	var providerType, apiKey, modelName string
	var maxTokens int
	var temperature float64

	var query string
	var args []interface{}

	if req.ProviderId != nil {
		query = `SELECT provider_type, api_key_encrypted, model_name, max_tokens, temperature 
				 FROM ai_providers WHERE id = $1 AND user_id = $2 AND is_active = true`
		args = []interface{}{*req.ProviderId, userID}
	} else {
		query = `SELECT provider_type, api_key_encrypted, model_name, max_tokens, temperature 
				 FROM ai_providers WHERE user_id = $1 AND is_default = true AND is_active = true`
		args = []interface{}{userID}
	}

	err := h.db.QueryRow(query, args...).Scan(&providerType, &apiKey, &modelName, &maxTokens, &temperature)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{
			"response": `To use the AI assistant, please configure an AI provider in Settings:
1. Go to Settings → AI Providers
2. Add your API key (OpenAI, Anthropic, etc.)
3. Set it as default

Once configured, I'll be able to:
• Search and filter coins for you
• Provide technical analysis
• Create alerts automatically
• Add coins to your watchlist`,
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get provider"})
		return
	}

	// Call the appropriate AI provider
	response, err := h.callAI(providerType, apiKey, modelName, req.Message, maxTokens, temperature)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI call failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response": response,
		"provider": providerType,
		"model":    modelName,
	})
}

// callAI routes to the appropriate provider
func (h *AIChatHandler) callAI(providerType, apiKey, model, message string, maxTokens int, temperature float64) (string, error) {
	switch providerType {
	case "anthropic":
		return h.callAnthropic(apiKey, model, message, maxTokens, temperature)
	case "google":
		return h.callGoogle(apiKey, model, message, maxTokens, temperature)
	default:
		// OpenAI-compatible (openai, xai, deepseek, mistral, groq, together, openrouter)
		return h.callOpenAICompatible(providerType, apiKey, model, message, maxTokens, temperature)
	}
}

// OpenAI-compatible API (works for OpenAI, Grok, DeepSeek, Mistral, Groq, Together, OpenRouter)
func (h *AIChatHandler) callOpenAICompatible(providerType, apiKey, model, message string, maxTokens int, temperature float64) (string, error) {
	endpoint := providerEndpoints[providerType]
	if endpoint == "" {
		endpoint = providerEndpoints["openai"]
	}

	// System prompt for crypto assistant
	systemPrompt := `You are Scalpaiboard AI, a helpful cryptocurrency trading assistant. You can:
- Analyze market trends and provide insights
- Explain technical indicators (RSI, MACD, Bollinger Bands)
- Help users understand crypto concepts
- Suggest trading strategies (not financial advice)
Keep responses concise and actionable. Focus on crypto and trading topics.`

	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": message},
		},
		"max_tokens":  maxTokens,
		"temperature": temperature,
	}

	jsonBody, _ := json.Marshal(reqBody)
	fmt.Printf("🤖 Calling AI Provider: %s\n", providerType)
	fmt.Printf("📍 Endpoint: %s\n", endpoint)
	fmt.Printf("🔑 Key length: %d\n", len(apiKey))

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// Special headers for some providers
	if providerType == "openrouter" {
		req.Header.Set("HTTP-Referer", "https://scalpaiboard.com")
		req.Header.Set("X-Title", "Scalpaiboard")
	}

	// Custom client to bypass any local proxies (like Supabase/PostgREST that might be in env)
	client := &http.Client{
		Transport: &http.Transport{
			Proxy: nil,
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		fmt.Printf("❌ API Error Status: %d\n", resp.StatusCode)
		fmt.Printf("❌ API Headers: %v\n", resp.Header)
		fmt.Printf("❌ API Body: %s\n", string(body))
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse error: %v", err)
	}

	if result.Error.Message != "" {
		return "", fmt.Errorf("API error: %s", result.Error.Message)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return result.Choices[0].Message.Content, nil
}

// Anthropic Claude API
func (h *AIChatHandler) callAnthropic(apiKey, model, message string, maxTokens int, temperature float64) (string, error) {
	systemPrompt := `You are Scalpaiboard AI, a helpful cryptocurrency trading assistant.`

	reqBody := map[string]interface{}{
		"model":      model,
		"max_tokens": maxTokens,
		"system":     systemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": message},
		},
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", providerEndpoints["anthropic"], bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse error: %v", err)
	}

	if result.Error.Message != "" {
		return "", fmt.Errorf("API error: %s", result.Error.Message)
	}

	if len(result.Content) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return result.Content[0].Text, nil
}

// Google Gemini API
func (h *AIChatHandler) callGoogle(apiKey, model, message string, maxTokens int, temperature float64) (string, error) {
	// Gemini uses a different URL structure
	endpoint := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{
					{"text": message},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"maxOutputTokens": maxTokens,
			"temperature":     temperature,
		},
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse error: %v", err)
	}

	if result.Error.Message != "" {
		return "", fmt.Errorf("API error: %s", result.Error.Message)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	// Combine all parts
	var parts []string
	for _, part := range result.Candidates[0].Content.Parts {
		parts = append(parts, part.Text)
	}

	return strings.Join(parts, ""), nil
}
