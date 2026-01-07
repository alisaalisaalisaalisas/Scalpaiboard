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
	"github.com/scalpaiboard/backend/service"
)

type AIChatHandler struct {
	db           *sql.DB
	toolsHandler *AIToolsHandler
}

func NewAIChatHandler(db *sql.DB) *AIChatHandler {
	alertService := service.NewAlertService(db)
	watchlistService := service.NewWatchlistService(db)
	toolsHandler := NewAIToolsHandler(db, alertService, watchlistService)

	return &AIChatHandler{
		db:           db,
		toolsHandler: toolsHandler,
	}
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

// Providers that support function calling / tools
var providersWithToolSupport = map[string]bool{
	"openai":    true,
	"anthropic": true,
	"google":    true,
	"mistral":   true,
	"groq":      true,
	// "xai":       false, // Grok may support it in future
	// "deepseek":  false, // May support in future
	// "together":  false, // Limited support
	// "openrouter": depends on underlying model
}

// supportsTools checks if a provider supports function calling
func supportsTools(providerType string) bool {
	return providersWithToolSupport[providerType]
}

// System prompt for the AI assistant with tool usage instructions
const systemPrompt = `You are Scalpaiboard AI, a powerful cryptocurrency trading assistant. You have access to real-time market data and can perform actions for the user.

**Your Capabilities:**
1. **filter_coins** - Search coins by volume, price change, etc. Example: "Find coins with >$100M volume"
2. **get_coin_analysis** - Get technical analysis (RSI, MACD, Bollinger, support/resistance) for any coin
3. **create_alert** - Create price alerts. Example: "Alert me when BTC goes above $50000"
4. **add_to_watchlist** - Add coins to user's watchlist
5. **analyze_pattern** - Detect chart patterns (double top/bottom, triangles, etc.)
6. **export_results** - Export watchlist or alerts to CSV/JSON
7. **get_portfolio** - Show user's watchlist with current prices

**Guidelines:**
- Use tools proactively when the user's request can benefit from real data
- Always use USDT pairs (e.g., BTCUSDT, ETHUSDT) for symbols
- Provide concise, actionable insights based on tool results
- Format numbers nicely (e.g., $1.23M instead of 1234567)
- Never give financial advice, just data and analysis
- If a tool fails, explain what happened and suggest alternatives`

// HandleChat processes AI chat requests with function calling
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

	// Call the appropriate AI provider with function calling support
	response, toolResults, err := h.callAIWithTools(userID, providerType, apiKey, modelName, req.Message, maxTokens, temperature)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI call failed: " + err.Error()})
		return
	}

	result := gin.H{
		"response": response,
		"provider": providerType,
		"model":    modelName,
	}

	// Include tool results if any tools were called
	if len(toolResults) > 0 {
		result["tool_results"] = toolResults
	}

	c.JSON(http.StatusOK, result)
}

// callAIWithTools routes to the appropriate provider with function calling
func (h *AIChatHandler) callAIWithTools(userID, providerType, apiKey, model, message string, maxTokens int, temperature float64) (string, []ToolResult, error) {
	// Check if provider supports function calling
	if !supportsTools(providerType) {
		// Fall back to simple mode without tools
		response, err := h.callOpenAISimple(providerType, apiKey, model, message, maxTokens, temperature)
		return response, nil, err
	}

	switch providerType {
	case "anthropic":
		return h.callAnthropicWithTools(userID, apiKey, model, message, maxTokens, temperature)
	case "google":
		return h.callGoogleWithTools(userID, apiKey, model, message, maxTokens, temperature)
	default:
		// OpenAI-compatible with tools (openai, mistral, groq)
		return h.callOpenAIWithTools(userID, providerType, apiKey, model, message, maxTokens, temperature)
	}
}

// callOpenAISimple calls OpenAI-compatible API without tools (for providers that don't support function calling)
func (h *AIChatHandler) callOpenAISimple(providerType, apiKey, model, message string, maxTokens int, temperature float64) (string, error) {
	endpoint := providerEndpoints[providerType]
	if endpoint == "" {
		endpoint = providerEndpoints["openai"]
	}

	// Simpler system prompt for non-tool providers
	simplePrompt := `You are Scalpaiboard AI, a helpful cryptocurrency trading assistant. You can:
- Analyze market trends and provide insights
- Explain technical indicators (RSI, MACD, Bollinger Bands)
- Help users understand crypto concepts
- Suggest trading strategies (not financial advice)
Keep responses concise and actionable. Focus on crypto and trading topics.`

	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": simplePrompt},
			{"role": "user", "content": message},
		},
		"max_tokens":  maxTokens,
		"temperature": temperature,
	}

	jsonBody, _ := json.Marshal(reqBody)
	fmt.Printf("🤖 Calling AI Provider (simple mode): %s\n", providerType)

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	if providerType == "openrouter" {
		req.Header.Set("HTTP-Referer", "https://scalpaiboard.com")
		req.Header.Set("X-Title", "Scalpaiboard")
	}

	client := &http.Client{
		Transport: &http.Transport{Proxy: nil},
	}
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

// callOpenAIWithTools calls OpenAI-compatible API with function calling
func (h *AIChatHandler) callOpenAIWithTools(userID, providerType, apiKey, model, message string, maxTokens int, temperature float64) (string, []ToolResult, error) {
	endpoint := providerEndpoints[providerType]
	if endpoint == "" {
		endpoint = providerEndpoints["openai"]
	}

	messages := []map[string]interface{}{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": message},
	}

	var allToolResults []ToolResult

	// Loop for multi-turn tool calling (max 5 iterations to prevent infinite loops)
	for iteration := 0; iteration < 5; iteration++ {
		reqBody := map[string]interface{}{
			"model":       model,
			"messages":    messages,
			"max_tokens":  maxTokens,
			"temperature": temperature,
			"tools":       GetOpenAITools(),
		}

		jsonBody, _ := json.Marshal(reqBody)
		fmt.Printf("🤖 Calling AI Provider: %s (iteration %d)\n", providerType, iteration+1)

		req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+apiKey)

		if providerType == "openrouter" {
			req.Header.Set("HTTP-Referer", "https://scalpaiboard.com")
			req.Header.Set("X-Title", "Scalpaiboard")
		}

		client := &http.Client{
			Transport: &http.Transport{Proxy: nil},
		}
		resp, err := client.Do(req)
		if err != nil {
			return "", nil, fmt.Errorf("request failed: %v", err)
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != 200 {
			return "", nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
		}

		var result struct {
			Choices []struct {
				Message struct {
					Content   string `json:"content"`
					ToolCalls []struct {
						ID       string `json:"id"`
						Type     string `json:"type"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"message"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := json.Unmarshal(body, &result); err != nil {
			return "", nil, fmt.Errorf("parse error: %v", err)
		}

		if result.Error.Message != "" {
			return "", nil, fmt.Errorf("API error: %s", result.Error.Message)
		}

		if len(result.Choices) == 0 {
			return "", nil, fmt.Errorf("no response from AI")
		}

		choice := result.Choices[0]

		// Check if the response includes tool calls
		if len(choice.Message.ToolCalls) > 0 {
			// Add assistant's message with tool calls to conversation
			messages = append(messages, map[string]interface{}{
				"role":       "assistant",
				"content":    choice.Message.Content,
				"tool_calls": choice.Message.ToolCalls,
			})

			// Execute each tool and add results
			for _, tc := range choice.Message.ToolCalls {
				var args map[string]interface{}
				json.Unmarshal([]byte(tc.Function.Arguments), &args)

				toolCall := ToolCall{
					ID:        tc.ID,
					Name:      tc.Function.Name,
					Arguments: args,
				}

				fmt.Printf("🔧 Executing tool: %s\n", tc.Function.Name)
				toolResult := h.toolsHandler.ExecuteTool(userID, toolCall)
				allToolResults = append(allToolResults, toolResult)

				// Add tool result to messages
				messages = append(messages, map[string]interface{}{
					"role":         "tool",
					"tool_call_id": tc.ID,
					"content":      toolResult.Content,
				})
			}

			// Continue the loop to get the final response
			continue
		}

		// No tool calls, return the final response
		return choice.Message.Content, allToolResults, nil
	}

	return "I apologize, but I encountered an issue processing your request. Please try again.", allToolResults, nil
}

// callAnthropicWithTools calls Anthropic API with tool use
func (h *AIChatHandler) callAnthropicWithTools(userID, apiKey, model, message string, maxTokens int, temperature float64) (string, []ToolResult, error) {
	messages := []map[string]interface{}{
		{"role": "user", "content": message},
	}

	var allToolResults []ToolResult

	for iteration := 0; iteration < 5; iteration++ {
		reqBody := map[string]interface{}{
			"model":      model,
			"max_tokens": maxTokens,
			"system":     systemPrompt,
			"messages":   messages,
			"tools":      GetAnthropicTools(),
		}

		jsonBody, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest("POST", providerEndpoints["anthropic"], bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			return "", nil, fmt.Errorf("request failed: %v", err)
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != 200 {
			return "", nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
		}

		var result struct {
			Content []struct {
				Type  string                 `json:"type"`
				Text  string                 `json:"text,omitempty"`
				ID    string                 `json:"id,omitempty"`
				Name  string                 `json:"name,omitempty"`
				Input map[string]interface{} `json:"input,omitempty"`
			} `json:"content"`
			StopReason string `json:"stop_reason"`
			Error      struct {
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := json.Unmarshal(body, &result); err != nil {
			return "", nil, fmt.Errorf("parse error: %v", err)
		}

		if result.Error.Message != "" {
			return "", nil, fmt.Errorf("API error: %s", result.Error.Message)
		}

		// Check for tool use
		var toolUseBlocks []map[string]interface{}
		var textContent string

		for _, block := range result.Content {
			if block.Type == "text" {
				textContent += block.Text
			} else if block.Type == "tool_use" {
				toolUseBlocks = append(toolUseBlocks, map[string]interface{}{
					"type":  "tool_use",
					"id":    block.ID,
					"name":  block.Name,
					"input": block.Input,
				})
			}
		}

		if len(toolUseBlocks) > 0 {
			// Add assistant message with tool use
			messages = append(messages, map[string]interface{}{
				"role":    "assistant",
				"content": result.Content,
			})

			// Execute tools and collect results
			toolResultBlocks := []map[string]interface{}{}
			for _, block := range toolUseBlocks {
				toolCall := ToolCall{
					ID:        block["id"].(string),
					Name:      block["name"].(string),
					Arguments: block["input"].(map[string]interface{}),
				}

				fmt.Printf("🔧 Executing tool: %s\n", toolCall.Name)
				toolResult := h.toolsHandler.ExecuteTool(userID, toolCall)
				allToolResults = append(allToolResults, toolResult)

				toolResultBlocks = append(toolResultBlocks, map[string]interface{}{
					"type":        "tool_result",
					"tool_use_id": toolCall.ID,
					"content":     toolResult.Content,
				})
			}

			// Add tool results message
			messages = append(messages, map[string]interface{}{
				"role":    "user",
				"content": toolResultBlocks,
			})

			continue
		}

		// No tool use, return text content
		if textContent == "" && len(result.Content) > 0 {
			textContent = result.Content[0].Text
		}
		return textContent, allToolResults, nil
	}

	return "I apologize, but I encountered an issue processing your request.", allToolResults, nil
}

// callGoogleWithTools calls Google Gemini API with function calling
func (h *AIChatHandler) callGoogleWithTools(userID, apiKey, model, message string, maxTokens int, temperature float64) (string, []ToolResult, error) {
	endpoint := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	contents := []map[string]interface{}{
		{
			"role": "user",
			"parts": []map[string]interface{}{
				{"text": systemPrompt + "\n\nUser: " + message},
			},
		},
	}

	var allToolResults []ToolResult

	for iteration := 0; iteration < 5; iteration++ {
		reqBody := map[string]interface{}{
			"contents": contents,
			"tools":    GetGoogleTools(),
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
			return "", nil, fmt.Errorf("request failed: %v", err)
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != 200 {
			return "", nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
		}

		var result struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text         string `json:"text,omitempty"`
						FunctionCall *struct {
							Name string                 `json:"name"`
							Args map[string]interface{} `json:"args"`
						} `json:"functionCall,omitempty"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := json.Unmarshal(body, &result); err != nil {
			return "", nil, fmt.Errorf("parse error: %v", err)
		}

		if result.Error.Message != "" {
			return "", nil, fmt.Errorf("API error: %s", result.Error.Message)
		}

		if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
			return "", nil, fmt.Errorf("no response from AI")
		}

		// Check for function calls
		var functionCalls []struct {
			Name string
			Args map[string]interface{}
		}
		var textParts []string

		for _, part := range result.Candidates[0].Content.Parts {
			if part.FunctionCall != nil {
				functionCalls = append(functionCalls, struct {
					Name string
					Args map[string]interface{}
				}{
					Name: part.FunctionCall.Name,
					Args: part.FunctionCall.Args,
				})
			}
			if part.Text != "" {
				textParts = append(textParts, part.Text)
			}
		}

		if len(functionCalls) > 0 {
			// Add model response to contents
			contents = append(contents, map[string]interface{}{
				"role":  "model",
				"parts": result.Candidates[0].Content.Parts,
			})

			// Execute functions and add results
			var functionResponses []map[string]interface{}
			for _, fc := range functionCalls {
				toolCall := ToolCall{
					ID:        fc.Name,
					Name:      fc.Name,
					Arguments: fc.Args,
				}

				fmt.Printf("🔧 Executing tool: %s\n", fc.Name)
				toolResult := h.toolsHandler.ExecuteTool(userID, toolCall)
				allToolResults = append(allToolResults, toolResult)

				functionResponses = append(functionResponses, map[string]interface{}{
					"functionResponse": map[string]interface{}{
						"name": fc.Name,
						"response": map[string]interface{}{
							"result": toolResult.Content,
						},
					},
				})
			}

			contents = append(contents, map[string]interface{}{
				"role":  "function",
				"parts": functionResponses,
			})

			continue
		}

		// No function calls, return text
		return strings.Join(textParts, ""), allToolResults, nil
	}

	return "I apologize, but I encountered an issue processing your request.", allToolResults, nil
}

// ListConversations returns user's AI conversation history
func ListConversations(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// TODO: Implement conversation history storage
	c.JSON(http.StatusOK, []interface{}{})
}
