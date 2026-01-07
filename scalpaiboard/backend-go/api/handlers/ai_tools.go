package handlers

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/scalpaiboard/backend/service"
)

// AIToolsHandler handles AI tool execution
type AIToolsHandler struct {
	db               *sql.DB
	alertService     *service.AlertService
	watchlistService *service.WatchlistService
}

// NewAIToolsHandler creates a new AI tools handler
func NewAIToolsHandler(db *sql.DB, alertService *service.AlertService, watchlistService *service.WatchlistService) *AIToolsHandler {
	return &AIToolsHandler{
		db:               db,
		alertService:     alertService,
		watchlistService: watchlistService,
	}
}

// ToolDefinition represents an AI tool definition
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ToolCall represents a tool call from AI
type ToolCall struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// ToolResult represents the result of a tool execution
type ToolResult struct {
	ToolCallID string      `json:"tool_call_id"`
	Name       string      `json:"name"`
	Content    string      `json:"content"`
	Data       interface{} `json:"data,omitempty"`
	Success    bool        `json:"success"`
	Error      string      `json:"error,omitempty"`
}

// GetToolDefinitions returns all available tool definitions
func GetToolDefinitions() []ToolDefinition {
	return []ToolDefinition{
		{
			Name:        "filter_coins",
			Description: "Search and filter cryptocurrencies by volume, price change, market cap. Use this when user wants to find coins matching certain criteria like 'find coins with high volume' or 'show me top gainers'.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"min_volume": map[string]interface{}{
						"type":        "number",
						"description": "Minimum 24h trading volume in USD (e.g., 1000000 for $1M)",
					},
					"max_volume": map[string]interface{}{
						"type":        "number",
						"description": "Maximum 24h trading volume in USD",
					},
					"min_change": map[string]interface{}{
						"type":        "number",
						"description": "Minimum 24h price change percentage (e.g., 5 for +5%)",
					},
					"max_change": map[string]interface{}{
						"type":        "number",
						"description": "Maximum 24h price change percentage",
					},
					"exchange": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"binance", "bybit"},
						"description": "Exchange to query (default: binance)",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum number of results (default: 10, max: 50)",
					},
					"sort_by": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"volume", "change", "price"},
						"description": "Sort results by this field (default: volume)",
					},
				},
			},
		},
		{
			Name:        "get_coin_analysis",
			Description: "Get detailed technical analysis for a specific cryptocurrency including RSI, MACD, Bollinger Bands, SMA/EMA, and support/resistance levels. Use this when user asks for analysis or wants to understand a coin's technical setup.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"symbol": map[string]interface{}{
						"type":        "string",
						"description": "Trading pair symbol (e.g., BTCUSDT, ETHUSDT). Must include the quote currency.",
					},
					"interval": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"1m", "5m", "15m", "1h", "4h", "1d"},
						"description": "Timeframe for analysis (default: 1h)",
					},
					"exchange": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"binance", "bybit"},
						"description": "Exchange to query (default: binance)",
					},
				},
				"required": []string{"symbol"},
			},
		},
		{
			Name:        "create_alert",
			Description: "Create a price alert for a cryptocurrency. The alert will notify the user when the specified condition is met. Use this when user wants to be notified about price movements.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"symbol": map[string]interface{}{
						"type":        "string",
						"description": "Trading pair symbol (e.g., BTCUSDT, ETHUSDT)",
					},
					"condition": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"above", "below"},
						"description": "Alert when price goes above or below the threshold",
					},
					"price": map[string]interface{}{
						"type":        "number",
						"description": "Price threshold for the alert",
					},
					"notification": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"email", "push", "both"},
						"description": "Notification type (default: push)",
					},
				},
				"required": []string{"symbol", "condition", "price"},
			},
		},
		{
			Name:        "add_to_watchlist",
			Description: "Add one or more cryptocurrencies to the user's watchlist for tracking. Use this when user wants to save coins to watch later.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"symbols": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "string",
						},
						"description": "List of trading pair symbols to add (e.g., ['BTCUSDT', 'ETHUSDT'])",
					},
				},
				"required": []string{"symbols"},
			},
		},
		{
			Name:        "analyze_pattern",
			Description: "Detect chart patterns on a cryptocurrency including triangles, wedges, head & shoulders, double tops/bottoms, and flags. Use this when user asks about patterns or chart formations.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"symbol": map[string]interface{}{
						"type":        "string",
						"description": "Trading pair symbol (e.g., BTCUSDT)",
					},
					"interval": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"15m", "1h", "4h", "1d"},
						"description": "Timeframe for pattern detection (default: 1h)",
					},
				},
				"required": []string{"symbol"},
			},
		},
		{
			Name:        "export_results",
			Description: "Export cryptocurrency data or analysis results to a downloadable format (CSV or JSON). Use this when user wants to download or export data.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"data_type": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"watchlist", "alerts", "screener", "analysis"},
						"description": "Type of data to export",
					},
					"format": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"csv", "json"},
						"description": "Export format (default: csv)",
					},
					"symbol": map[string]interface{}{
						"type":        "string",
						"description": "Optional symbol for analysis export",
					},
				},
				"required": []string{"data_type"},
			},
		},
		{
			Name:        "get_portfolio",
			Description: "Get an overview of the user's watchlist with current prices, 24h changes, volumes, and performance metrics. Use this when user asks about their portfolio or watchlist status.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"sort_by": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"symbol", "price", "change24h", "volume"},
						"description": "Sort watchlist by this field (default: symbol)",
					},
					"include_alerts": map[string]interface{}{
						"type":        "boolean",
						"description": "Include active alerts for each coin (default: true)",
					},
				},
			},
		},
	}
}

// GetOpenAITools returns tools in OpenAI format
func GetOpenAITools() []map[string]interface{} {
	definitions := GetToolDefinitions()
	tools := make([]map[string]interface{}, len(definitions))

	for i, def := range definitions {
		tools[i] = map[string]interface{}{
			"type": "function",
			"function": map[string]interface{}{
				"name":        def.Name,
				"description": def.Description,
				"parameters":  def.Parameters,
			},
		}
	}

	return tools
}

// GetAnthropicTools returns tools in Anthropic format
func GetAnthropicTools() []map[string]interface{} {
	definitions := GetToolDefinitions()
	tools := make([]map[string]interface{}, len(definitions))

	for i, def := range definitions {
		tools[i] = map[string]interface{}{
			"name":         def.Name,
			"description":  def.Description,
			"input_schema": def.Parameters,
		}
	}

	return tools
}

// GetGoogleTools returns tools in Google Gemini format
func GetGoogleTools() []map[string]interface{} {
	definitions := GetToolDefinitions()
	declarations := make([]map[string]interface{}, len(definitions))

	for i, def := range definitions {
		declarations[i] = map[string]interface{}{
			"name":        def.Name,
			"description": def.Description,
			"parameters":  def.Parameters,
		}
	}

	return []map[string]interface{}{
		{
			"functionDeclarations": declarations,
		},
	}
}

// ExecuteTool executes a tool and returns the result
func (h *AIToolsHandler) ExecuteTool(userID string, toolCall ToolCall) ToolResult {
	result := ToolResult{
		ToolCallID: toolCall.ID,
		Name:       toolCall.Name,
	}

	var data interface{}
	var err error

	switch toolCall.Name {
	case "filter_coins":
		data, err = h.executeFilterCoins(toolCall.Arguments)
	case "get_coin_analysis":
		data, err = h.executeGetCoinAnalysis(toolCall.Arguments)
	case "create_alert":
		data, err = h.executeCreateAlert(userID, toolCall.Arguments)
	case "add_to_watchlist":
		data, err = h.executeAddToWatchlist(userID, toolCall.Arguments)
	case "analyze_pattern":
		data, err = h.executeAnalyzePattern(toolCall.Arguments)
	case "export_results":
		data, err = h.executeExportResults(userID, toolCall.Arguments)
	case "get_portfolio":
		data, err = h.executeGetPortfolio(userID, toolCall.Arguments)
	default:
		err = fmt.Errorf("unknown tool: %s", toolCall.Name)
	}

	if err != nil {
		result.Success = false
		result.Error = err.Error()
		result.Content = fmt.Sprintf("Error executing %s: %s", toolCall.Name, err.Error())
	} else {
		result.Success = true
		result.Data = data
		// Convert data to readable string for AI
		if jsonBytes, err := json.MarshalIndent(data, "", "  "); err == nil {
			result.Content = string(jsonBytes)
		} else {
			result.Content = fmt.Sprintf("%v", data)
		}
	}

	return result
}

// executeFilterCoins filters coins by volume, change, etc.
func (h *AIToolsHandler) executeFilterCoins(args map[string]interface{}) (interface{}, error) {
	exchange := getStringArg(args, "exchange", "binance")
	limit := getIntArg(args, "limit", 20)
	if limit > 50 {
		limit = 50
	}

	minVolume := getFloatArg(args, "min_volume", 0)
	maxVolume := getFloatArg(args, "max_volume", 0)
	minChange := getFloatArg(args, "min_change", -100)
	maxChange := getFloatArg(args, "max_change", 100)
	sortBy := getStringArg(args, "sort_by", "volume")

	// Fetch all tickers from exchange
	var tickers []map[string]interface{}
	var err error

	switch exchange {
	case "bybit":
		tickers, err = fetchBybitTickers()
	default:
		tickers, err = fetchBinanceTickers()
	}

	if err != nil {
		return nil, fmt.Errorf("failed to fetch tickers: %v", err)
	}

	// Filter tickers
	var filtered []map[string]interface{}
	for _, t := range tickers {
		symbol := t["symbol"].(string)
		// Only include USDT pairs
		if !strings.HasSuffix(symbol, "USDT") {
			continue
		}

		volume := t["volume"].(float64)
		change := t["change"].(float64)

		// Apply filters
		if minVolume > 0 && volume < minVolume {
			continue
		}
		if maxVolume > 0 && volume > maxVolume {
			continue
		}
		if change < minChange || change > maxChange {
			continue
		}

		filtered = append(filtered, t)
	}

	// Sort results
	switch sortBy {
	case "change":
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i]["change"].(float64) > filtered[j]["change"].(float64)
		})
	case "price":
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i]["price"].(float64) > filtered[j]["price"].(float64)
		})
	default: // volume
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i]["volume"].(float64) > filtered[j]["volume"].(float64)
		})
	}

	// Limit results
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return map[string]interface{}{
		"coins":    filtered,
		"count":    len(filtered),
		"exchange": exchange,
		"filters": map[string]interface{}{
			"min_volume": minVolume,
			"max_volume": maxVolume,
			"min_change": minChange,
			"max_change": maxChange,
		},
	}, nil
}

// executeGetCoinAnalysis gets technical analysis for a coin
func (h *AIToolsHandler) executeGetCoinAnalysis(args map[string]interface{}) (interface{}, error) {
	symbol := getStringArg(args, "symbol", "")
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	symbol = strings.ToUpper(symbol)

	interval := getStringArg(args, "interval", "1h")
	exchange := getStringArg(args, "exchange", "binance")

	// Fetch candles
	candles, err := fetchCandlesForAnalysis(symbol, interval, exchange, 250)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch candles: %v", err)
	}

	if len(candles) < 50 {
		return nil, fmt.Errorf("not enough data for analysis (got %d candles)", len(candles))
	}

	// Extract OHLCV data
	closes := make([]float64, len(candles))
	highs := make([]float64, len(candles))
	lows := make([]float64, len(candles))

	for i, c := range candles {
		closes[i] = c["close"].(float64)
		highs[i] = c["high"].(float64)
		lows[i] = c["low"].(float64)
	}

	// Compute technical analysis
	analysis, err := service.ComputeTechnicalAnalysis(symbol, interval, closes, highs, lows, len(candles))
	if err != nil {
		return nil, fmt.Errorf("failed to compute analysis: %v", err)
	}

	// Add interpretation
	interpretation := interpretAnalysis(analysis)

	return map[string]interface{}{
		"symbol":             symbol,
		"interval":           interval,
		"exchange":           exchange,
		"price":              analysis.LastClose,
		"rsi":                analysis.RSI,
		"macd":               analysis.MACD,
		"bollinger":          analysis.Bollinger,
		"sma":                analysis.SMA,
		"ema":                analysis.EMA,
		"support_resistance": analysis.SupportResistance,
		"interpretation":     interpretation,
		"timestamp":          time.Now().Unix(),
	}, nil
}

// executeCreateAlert creates a price alert
func (h *AIToolsHandler) executeCreateAlert(userID string, args map[string]interface{}) (interface{}, error) {
	symbol := strings.ToUpper(getStringArg(args, "symbol", ""))
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}

	condition := getStringArg(args, "condition", "")
	if condition != "above" && condition != "below" {
		return nil, fmt.Errorf("condition must be 'above' or 'below'")
	}

	price := getFloatArg(args, "price", 0)
	if price <= 0 {
		return nil, fmt.Errorf("price must be positive")
	}

	notification := getStringArg(args, "notification", "push")

	// Look up coin ID
	var coinID int
	err := h.db.QueryRow("SELECT id FROM coins WHERE symbol = $1", symbol).Scan(&coinID)
	if err != nil {
		// Create coin if it doesn't exist
		err = h.db.QueryRow(
			"INSERT INTO coins (symbol, exchange, is_active) VALUES ($1, 'binance', true) ON CONFLICT (symbol, exchange) DO UPDATE SET symbol = $1 RETURNING id",
			symbol,
		).Scan(&coinID)
		if err != nil {
			return nil, fmt.Errorf("failed to get/create coin: %v", err)
		}
	}

	// Create alert using service
	conditionType := "price_" + condition
	alert, err := h.alertService.CreateAlert(userID, coinID, conditionType, price, notification)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert: %v", err)
	}

	return map[string]interface{}{
		"success":      true,
		"alert_id":     alert.ID,
		"symbol":       symbol,
		"condition":    condition,
		"price":        price,
		"notification": notification,
		"message":      fmt.Sprintf("Alert created: Notify when %s goes %s $%.2f", symbol, condition, price),
	}, nil
}

// executeAddToWatchlist adds coins to watchlist
func (h *AIToolsHandler) executeAddToWatchlist(userID string, args map[string]interface{}) (interface{}, error) {
	symbolsRaw, ok := args["symbols"]
	if !ok {
		return nil, fmt.Errorf("symbols array is required")
	}

	var symbols []string
	switch v := symbolsRaw.(type) {
	case []interface{}:
		for _, s := range v {
			if str, ok := s.(string); ok {
				symbols = append(symbols, strings.ToUpper(str))
			}
		}
	case []string:
		for _, s := range v {
			symbols = append(symbols, strings.ToUpper(s))
		}
	default:
		return nil, fmt.Errorf("symbols must be an array of strings")
	}

	if len(symbols) == 0 {
		return nil, fmt.Errorf("at least one symbol is required")
	}

	added := []string{}
	failed := []string{}

	for _, symbol := range symbols {
		err := h.watchlistService.AddToWatchlist(userID, 0, symbol)
		if err != nil {
			failed = append(failed, symbol)
		} else {
			added = append(added, symbol)
		}
	}

	return map[string]interface{}{
		"success": len(failed) == 0,
		"added":   added,
		"failed":  failed,
		"message": fmt.Sprintf("Added %d coins to watchlist", len(added)),
	}, nil
}

// executeAnalyzePattern detects chart patterns
func (h *AIToolsHandler) executeAnalyzePattern(args map[string]interface{}) (interface{}, error) {
	symbol := strings.ToUpper(getStringArg(args, "symbol", ""))
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}

	interval := getStringArg(args, "interval", "1h")

	// Fetch candles for pattern analysis
	candles, err := fetchCandlesForAnalysis(symbol, interval, "binance", 100)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch candles: %v", err)
	}

	if len(candles) < 30 {
		return nil, fmt.Errorf("not enough data for pattern analysis")
	}

	// Detect patterns
	patterns := detectPatterns(candles)

	return map[string]interface{}{
		"symbol":       symbol,
		"interval":     interval,
		"patterns":     patterns,
		"candle_count": len(candles),
		"timestamp":    time.Now().Unix(),
	}, nil
}

// executeExportResults exports data
func (h *AIToolsHandler) executeExportResults(userID string, args map[string]interface{}) (interface{}, error) {
	dataType := getStringArg(args, "data_type", "")
	format := getStringArg(args, "format", "csv")

	var data interface{}

	switch dataType {
	case "watchlist":
		items, wErr := h.watchlistService.GetUserWatchlist(userID)
		if wErr != nil {
			return nil, wErr
		}
		data = items
	case "alerts":
		alerts, aErr := h.alertService.GetUserAlerts(userID)
		if aErr != nil {
			return nil, aErr
		}
		data = alerts
	default:
		return nil, fmt.Errorf("unsupported data_type: %s", dataType)
	}

	var content string
	switch format {
	case "json":
		jsonBytes, _ := json.MarshalIndent(data, "", "  ")
		content = string(jsonBytes)
	case "csv":
		content = convertToCSV(data)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	return map[string]interface{}{
		"data_type": dataType,
		"format":    format,
		"content":   content,
		"rows":      countRows(data),
	}, nil
}

// executeGetPortfolio gets watchlist with current prices
func (h *AIToolsHandler) executeGetPortfolio(userID string, args map[string]interface{}) (interface{}, error) {
	sortBy := getStringArg(args, "sort_by", "symbol")
	includeAlerts := getBoolArg(args, "include_alerts", true)

	// Get watchlist
	items, err := h.watchlistService.GetUserWatchlist(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get watchlist: %v", err)
	}

	if len(items) == 0 {
		return map[string]interface{}{
			"coins":   []interface{}{},
			"count":   0,
			"message": "Your watchlist is empty. Add some coins first!",
		}, nil
	}

	// Fetch current prices for all symbols
	tickers, _ := fetchBinanceTickers()
	tickerMap := make(map[string]map[string]interface{})
	for _, t := range tickers {
		if sym, ok := t["symbol"].(string); ok {
			tickerMap[sym] = t
		}
	}

	// Build portfolio data
	portfolio := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		entry := map[string]interface{}{
			"symbol":   item.Symbol,
			"added_at": item.AddedAt,
		}

		if ticker, ok := tickerMap[item.Symbol]; ok {
			entry["price"] = ticker["price"]
			entry["change24h"] = ticker["change"]
			entry["volume24h"] = ticker["volume"]
		}

		portfolio = append(portfolio, entry)
	}

	// Sort portfolio
	switch sortBy {
	case "price":
		sort.Slice(portfolio, func(i, j int) bool {
			pi, _ := portfolio[i]["price"].(float64)
			pj, _ := portfolio[j]["price"].(float64)
			return pi > pj
		})
	case "change24h":
		sort.Slice(portfolio, func(i, j int) bool {
			ci, _ := portfolio[i]["change24h"].(float64)
			cj, _ := portfolio[j]["change24h"].(float64)
			return ci > cj
		})
	case "volume":
		sort.Slice(portfolio, func(i, j int) bool {
			vi, _ := portfolio[i]["volume24h"].(float64)
			vj, _ := portfolio[j]["volume24h"].(float64)
			return vi > vj
		})
	default: // symbol
		sort.Slice(portfolio, func(i, j int) bool {
			si, _ := portfolio[i]["symbol"].(string)
			sj, _ := portfolio[j]["symbol"].(string)
			return si < sj
		})
	}

	// Add alerts if requested
	if includeAlerts {
		alerts, _ := h.alertService.GetUserAlerts(userID)
		alertMap := make(map[string][]map[string]interface{})
		for _, a := range alerts {
			if a.IsActive {
				alertMap[a.CoinSymbol] = append(alertMap[a.CoinSymbol], map[string]interface{}{
					"condition": a.ConditionType,
					"value":     a.ConditionValue,
				})
			}
		}

		for i := range portfolio {
			if sym, ok := portfolio[i]["symbol"].(string); ok {
				if als, ok := alertMap[sym]; ok {
					portfolio[i]["alerts"] = als
				}
			}
		}
	}

	return map[string]interface{}{
		"coins": portfolio,
		"count": len(portfolio),
	}, nil
}

// ============ Helper Functions ============

func getStringArg(args map[string]interface{}, key, defaultVal string) string {
	if v, ok := args[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return defaultVal
}

func getIntArg(args map[string]interface{}, key string, defaultVal int) int {
	if v, ok := args[key]; ok {
		switch n := v.(type) {
		case int:
			return n
		case float64:
			return int(n)
		case string:
			if i, err := strconv.Atoi(n); err == nil {
				return i
			}
		}
	}
	return defaultVal
}

func getFloatArg(args map[string]interface{}, key string, defaultVal float64) float64 {
	if v, ok := args[key]; ok {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		case string:
			if f, err := strconv.ParseFloat(n, 64); err == nil {
				return f
			}
		}
	}
	return defaultVal
}

func getBoolArg(args map[string]interface{}, key string, defaultVal bool) bool {
	if v, ok := args[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return defaultVal
}

// fetchBinanceTickers fetches all tickers from Binance
func fetchBinanceTickers() ([]map[string]interface{}, error) {
	resp, err := http.Get("https://api.binance.com/api/v3/ticker/24hr")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rawTickers []map[string]interface{}
	if err := json.Unmarshal(body, &rawTickers); err != nil {
		return nil, err
	}

	tickers := make([]map[string]interface{}, 0, len(rawTickers))
	for _, t := range rawTickers {
		symbol, _ := t["symbol"].(string)
		lastPrice, _ := strconv.ParseFloat(t["lastPrice"].(string), 64)
		priceChange, _ := strconv.ParseFloat(t["priceChangePercent"].(string), 64)
		volume, _ := strconv.ParseFloat(t["quoteVolume"].(string), 64)

		tickers = append(tickers, map[string]interface{}{
			"symbol": symbol,
			"price":  lastPrice,
			"change": priceChange,
			"volume": volume,
		})
	}

	return tickers, nil
}

// fetchBybitTickers fetches all tickers from Bybit
func fetchBybitTickers() ([]map[string]interface{}, error) {
	resp, err := http.Get("https://api.bybit.com/v5/market/tickers?category=spot")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Result struct {
			List []struct {
				Symbol       string `json:"symbol"`
				LastPrice    string `json:"lastPrice"`
				Price24hPcnt string `json:"price24hPcnt"`
				Turnover24h  string `json:"turnover24h"`
			} `json:"list"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	tickers := make([]map[string]interface{}, 0, len(result.Result.List))
	for _, t := range result.Result.List {
		price, _ := strconv.ParseFloat(t.LastPrice, 64)
		change, _ := strconv.ParseFloat(t.Price24hPcnt, 64)
		volume, _ := strconv.ParseFloat(t.Turnover24h, 64)

		tickers = append(tickers, map[string]interface{}{
			"symbol": t.Symbol,
			"price":  price,
			"change": change * 100,
			"volume": volume,
		})
	}

	return tickers, nil
}

// fetchCandlesForAnalysis fetches candles for technical analysis
func fetchCandlesForAnalysis(symbol, interval, exchange string, limit int) ([]map[string]interface{}, error) {
	var url string
	switch exchange {
	case "bybit":
		bybitInterval := map[string]string{
			"1m": "1", "5m": "5", "15m": "15", "30m": "30",
			"1h": "60", "4h": "240", "1d": "D",
		}[interval]
		if bybitInterval == "" {
			bybitInterval = "60"
		}
		url = fmt.Sprintf("https://api.bybit.com/v5/market/kline?category=spot&symbol=%s&interval=%s&limit=%d",
			symbol, bybitInterval, limit)
	default:
		url = fmt.Sprintf("https://api.binance.com/api/v3/klines?symbol=%s&interval=%s&limit=%d",
			symbol, interval, limit)
	}

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if exchange == "bybit" {
		var result struct {
			Result struct {
				List [][]string `json:"list"`
			} `json:"result"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return nil, err
		}

		candles := make([]map[string]interface{}, 0, len(result.Result.List))
		// Bybit returns newest first, reverse for chronological order
		for i := len(result.Result.List) - 1; i >= 0; i-- {
			raw := result.Result.List[i]
			if len(raw) >= 6 {
				open, _ := strconv.ParseFloat(raw[1], 64)
				high, _ := strconv.ParseFloat(raw[2], 64)
				low, _ := strconv.ParseFloat(raw[3], 64)
				close, _ := strconv.ParseFloat(raw[4], 64)
				volume, _ := strconv.ParseFloat(raw[5], 64)

				candles = append(candles, map[string]interface{}{
					"open": open, "high": high, "low": low, "close": close, "volume": volume,
				})
			}
		}
		return candles, nil
	}

	// Binance format
	var rawCandles [][]interface{}
	if err := json.Unmarshal(body, &rawCandles); err != nil {
		return nil, err
	}

	candles := make([]map[string]interface{}, 0, len(rawCandles))
	for _, raw := range rawCandles {
		if len(raw) >= 6 {
			open, _ := strconv.ParseFloat(raw[1].(string), 64)
			high, _ := strconv.ParseFloat(raw[2].(string), 64)
			low, _ := strconv.ParseFloat(raw[3].(string), 64)
			close, _ := strconv.ParseFloat(raw[4].(string), 64)
			volume, _ := strconv.ParseFloat(raw[5].(string), 64)

			candles = append(candles, map[string]interface{}{
				"open": open, "high": high, "low": low, "close": close, "volume": volume,
			})
		}
	}

	return candles, nil
}

// interpretAnalysis provides human-readable interpretation
func interpretAnalysis(analysis service.TechnicalAnalysis) map[string]interface{} {
	interpretation := map[string]interface{}{}

	// RSI interpretation
	rsi := analysis.RSI.Value
	if rsi > 70 {
		interpretation["rsi"] = "Overbought - potential sell signal"
	} else if rsi < 30 {
		interpretation["rsi"] = "Oversold - potential buy signal"
	} else {
		interpretation["rsi"] = "Neutral"
	}

	// MACD interpretation
	if analysis.MACD.Histogram > 0 {
		interpretation["macd"] = "Bullish momentum"
	} else {
		interpretation["macd"] = "Bearish momentum"
	}

	// Bollinger interpretation
	price := analysis.LastClose
	if price > analysis.Bollinger.Upper {
		interpretation["bollinger"] = "Price above upper band - overbought"
	} else if price < analysis.Bollinger.Lower {
		interpretation["bollinger"] = "Price below lower band - oversold"
	} else {
		width := (analysis.Bollinger.Upper - analysis.Bollinger.Lower) / analysis.Bollinger.Middle * 100
		if width < 5 {
			interpretation["bollinger"] = "Bands are tight - expect volatility"
		} else {
			interpretation["bollinger"] = "Price within bands - normal range"
		}
	}

	// Trend based on EMAs
	if ema9, ok := analysis.EMA["p9"]; ok {
		if ema21, ok := analysis.EMA["p21"]; ok {
			if ema9 > ema21 {
				interpretation["trend"] = "Short-term bullish (EMA9 > EMA21)"
			} else {
				interpretation["trend"] = "Short-term bearish (EMA9 < EMA21)"
			}
		}
	}

	return interpretation
}

// detectPatterns detects chart patterns
func detectPatterns(candles []map[string]interface{}) []map[string]interface{} {
	patterns := []map[string]interface{}{}

	if len(candles) < 20 {
		return patterns
	}

	// Extract close prices
	closes := make([]float64, len(candles))
	highs := make([]float64, len(candles))
	lows := make([]float64, len(candles))

	for i, c := range candles {
		closes[i] = c["close"].(float64)
		highs[i] = c["high"].(float64)
		lows[i] = c["low"].(float64)
	}

	// Detect Higher Highs / Lower Lows (trend)
	recentHighs := highs[len(highs)-20:]
	recentLows := lows[len(lows)-20:]

	hhCount := 0
	llCount := 0
	for i := 1; i < len(recentHighs); i++ {
		if recentHighs[i] > recentHighs[i-1] {
			hhCount++
		}
		if recentLows[i] < recentLows[i-1] {
			llCount++
		}
	}

	if hhCount > 12 {
		patterns = append(patterns, map[string]interface{}{
			"name":        "Higher Highs",
			"type":        "bullish",
			"confidence":  float64(hhCount) / 19.0 * 100,
			"description": "Price making higher highs - uptrend",
		})
	}

	if llCount > 12 {
		patterns = append(patterns, map[string]interface{}{
			"name":        "Lower Lows",
			"type":        "bearish",
			"confidence":  float64(llCount) / 19.0 * 100,
			"description": "Price making lower lows - downtrend",
		})
	}

	// Detect consolidation (low volatility)
	last20 := closes[len(closes)-20:]
	maxPrice := last20[0]
	minPrice := last20[0]
	for _, p := range last20 {
		if p > maxPrice {
			maxPrice = p
		}
		if p < minPrice {
			minPrice = p
		}
	}

	rangePercent := (maxPrice - minPrice) / minPrice * 100
	if rangePercent < 3 {
		patterns = append(patterns, map[string]interface{}{
			"name":        "Consolidation",
			"type":        "neutral",
			"confidence":  80.0,
			"description": fmt.Sprintf("Price consolidating in %.2f%% range - expect breakout", rangePercent),
		})
	}

	// Simple double bottom detection
	if len(lows) >= 30 {
		last30Lows := lows[len(lows)-30:]
		minIdx1, minIdx2 := -1, -1
		minVal := last30Lows[0]

		for i, l := range last30Lows {
			if l <= minVal {
				minVal = l
				minIdx1 = i
			}
		}

		// Find second lowest
		for i, l := range last30Lows {
			idxDiff := i - minIdx1
			if idxDiff < 0 {
				idxDiff = -idxDiff
			}
			if i != minIdx1 && idxDiff > 5 {
				if minIdx2 == -1 || l < last30Lows[minIdx2] {
					minIdx2 = i
				}
			}
		}

		if minIdx1 >= 0 && minIdx2 >= 0 {
			priceDiff := last30Lows[minIdx1] - last30Lows[minIdx2]
			if priceDiff < 0 {
				priceDiff = -priceDiff
			}
			diff := priceDiff / last30Lows[minIdx1] * 100
			if diff < 2 {
				patterns = append(patterns, map[string]interface{}{
					"name":        "Double Bottom",
					"type":        "bullish",
					"confidence":  100 - diff*10,
					"description": "Potential double bottom pattern - bullish reversal signal",
				})
			}
		}
	}

	if len(patterns) == 0 {
		patterns = append(patterns, map[string]interface{}{
			"name":        "No Clear Pattern",
			"type":        "neutral",
			"confidence":  0,
			"description": "No significant chart patterns detected in recent price action",
		})
	}

	return patterns
}

// convertToCSV converts data to CSV format
func convertToCSV(data interface{}) string {
	var buf strings.Builder
	writer := csv.NewWriter(&buf)

	switch v := data.(type) {
	case []map[string]interface{}:
		if len(v) == 0 {
			return ""
		}
		// Write header
		var headers []string
		for k := range v[0] {
			headers = append(headers, k)
		}
		sort.Strings(headers)
		writer.Write(headers)

		// Write rows
		for _, row := range v {
			var values []string
			for _, h := range headers {
				values = append(values, fmt.Sprintf("%v", row[h]))
			}
			writer.Write(values)
		}
	default:
		jsonBytes, _ := json.Marshal(data)
		return string(jsonBytes)
	}

	writer.Flush()
	return buf.String()
}

// countRows counts rows in data
func countRows(data interface{}) int {
	switch v := data.(type) {
	case []map[string]interface{}:
		return len(v)
	case []interface{}:
		return len(v)
	default:
		return 1
	}
}
