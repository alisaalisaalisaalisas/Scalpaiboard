package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/scalpaiboard/backend/service"
)

type CoinHandler struct {
	coinService     *service.CoinService
	exchangeService *service.ExchangeService
}

func NewCoinHandler(coinService *service.CoinService, exchangeService *service.ExchangeService) *CoinHandler {
	return &CoinHandler{
		coinService:     coinService,
		exchangeService: exchangeService,
	}
}

// ListCoins returns paginated list of coins with real-time prices
func (h *CoinHandler) ListCoins(c *gin.Context) {
	// Parse query parameters
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	sortBy := c.DefaultQuery("sortBy", "volume24h")
	sortOrder := c.DefaultQuery("sortOrder", "desc")
	exchange := c.DefaultQuery("exchange", "binance")

	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	// Get coins from database
	coins, total, err := h.coinService.GetCoins(limit, offset, sortBy, sortOrder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch coins"})
		return
	}

	// Enrich with real-time data from exchange
	enrichedCoins := h.exchangeService.EnrichWithMarketData(coins, exchange)

	c.JSON(http.StatusOK, gin.H{
		"data":     enrichedCoins,
		"total":    total,
		"page":     page,
		"pageSize": limit,
	})
}

// GetCoin returns single coin details with real-time data
func (h *CoinHandler) GetCoin(c *gin.Context) {
	symbol := c.Param("symbol")
	exchange := c.DefaultQuery("exchange", "binance")

	coin, err := h.coinService.GetCoinBySymbol(symbol)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Coin not found"})
		return
	}

	// Get real-time data
	marketData := h.exchangeService.GetMarketData(symbol, exchange)

	c.JSON(http.StatusOK, gin.H{
		"id":        coin.ID,
		"symbol":    coin.Symbol,
		"name":      coin.Name,
		"exchange":  coin.Exchange,
		"price":     marketData.Price,
		"change24h": marketData.Change24h,
		"volume24h": marketData.Volume24h,
		"high24h":   marketData.High24h,
		"low24h":    marketData.Low24h,
	})
}

// GetCandles returns OHLCV candlestick data from exchange
func (h *CoinHandler) GetCandles(c *gin.Context) {
	symbol := c.Param("symbol")
	interval := c.DefaultQuery("interval", "1h")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	exchange := c.DefaultQuery("exchange", "binance")

	if limit > 500 {
		limit = 500
	}

	var candles []map[string]interface{}
	var err error

	switch exchange {
	case "binance":
		candles, err = fetchBinanceCandles(symbol, interval, limit)
	case "bybit":
		candles, err = fetchBybitCandles(symbol, interval, limit)
	default:
		candles, err = fetchBinanceCandles(symbol, interval, limit)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch candles"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"symbol":   symbol,
		"interval": interval,
		"candles":  candles,
	})
}

// GetOrderbook returns current orderbook from exchange
func (h *CoinHandler) GetOrderbook(c *gin.Context) {
	symbol := c.Param("symbol")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	exchange := c.DefaultQuery("exchange", "binance")

	if limit > 100 {
		limit = 100
	}

	var orderbook map[string]interface{}
	var err error

	switch exchange {
	case "binance":
		orderbook, err = fetchBinanceOrderbook(symbol, limit)
	case "bybit":
		orderbook, err = fetchBybitOrderbook(symbol, limit)
	default:
		orderbook, err = fetchBinanceOrderbook(symbol, limit)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orderbook"})
		return
	}

	c.JSON(http.StatusOK, orderbook)
}

// ========== Binance Public API ==========

func fetchBinanceCandles(symbol, interval string, limit int) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.binance.com/api/v3/klines?symbol=%s&interval=%s&limit=%d",
		symbol, interval, limit)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rawCandles [][]interface{}
	if err := json.Unmarshal(body, &rawCandles); err != nil {
		return nil, err
	}

	// Transform to structured format
	candles := make([]map[string]interface{}, len(rawCandles))
	for i, raw := range rawCandles {
		candles[i] = map[string]interface{}{
			"time":   int64(raw[0].(float64)) / 1000, // Convert to seconds
			"open":   parseFloat(raw[1]),
			"high":   parseFloat(raw[2]),
			"low":    parseFloat(raw[3]),
			"close":  parseFloat(raw[4]),
			"volume": parseFloat(raw[5]),
		}
	}

	return candles, nil
}

func fetchBinanceOrderbook(symbol string, limit int) (map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.binance.com/api/v3/depth?symbol=%s&limit=%d", symbol, limit)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var orderbook map[string]interface{}
	if err := json.Unmarshal(body, &orderbook); err != nil {
		return nil, err
	}

	orderbook["symbol"] = symbol
	orderbook["timestamp"] = time.Now().Unix()
	return orderbook, nil
}

// ========== Bybit Public API ==========

func fetchBybitCandles(symbol, interval string, limit int) ([]map[string]interface{}, error) {
	// Convert interval format (1h -> 60)
	bybitInterval := convertToBybitInterval(interval)

	url := fmt.Sprintf("https://api.bybit.com/v5/market/kline?category=spot&symbol=%s&interval=%s&limit=%d",
		symbol, bybitInterval, limit)

	resp, err := http.Get(url)
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
			List [][]string `json:"list"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	// Transform to structured format
	candles := make([]map[string]interface{}, len(result.Result.List))
	for i, raw := range result.Result.List {
		if len(raw) >= 6 {
			timestamp, _ := strconv.ParseInt(raw[0], 10, 64)
			candles[i] = map[string]interface{}{
				"time":   timestamp / 1000,
				"open":   parseFloatString(raw[1]),
				"high":   parseFloatString(raw[2]),
				"low":    parseFloatString(raw[3]),
				"close":  parseFloatString(raw[4]),
				"volume": parseFloatString(raw[5]),
			}
		}
	}

	return candles, nil
}

func fetchBybitOrderbook(symbol string, limit int) (map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.bybit.com/v5/market/orderbook?category=spot&symbol=%s&limit=%d",
		symbol, limit)

	resp, err := http.Get(url)
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
			B [][]string `json:"b"` // Bids
			A [][]string `json:"a"` // Asks
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"symbol":    symbol,
		"bids":      result.Result.B,
		"asks":      result.Result.A,
		"timestamp": time.Now().Unix(),
	}, nil
}

// Helper functions
func parseFloat(v interface{}) float64 {
	if s, ok := v.(string); ok {
		f, _ := strconv.ParseFloat(s, 64)
		return f
	}
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}

func parseFloatString(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func convertToBybitInterval(interval string) string {
	switch interval {
	case "1m":
		return "1"
	case "5m":
		return "5"
	case "15m":
		return "15"
	case "30m":
		return "30"
	case "1h":
		return "60"
	case "4h":
		return "240"
	case "1d":
		return "D"
	case "1w":
		return "W"
	default:
		return "60"
	}
}
