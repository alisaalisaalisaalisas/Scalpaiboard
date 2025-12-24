package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/scalpaiboard/backend/models"
	"golang.org/x/net/context"
)

type CoinService struct {
	db    *sql.DB
	redis *redis.Client
}

func NewCoinService(db *sql.DB, redis *redis.Client) *CoinService {
	return &CoinService{db: db, redis: redis}
}

// GetCoins returns paginated list of coins
func (s *CoinService) GetCoins(limit, offset int, sortBy, sortOrder string) ([]models.Coin, int, error) {
	// Validate sortBy and sortOrder to prevent SQL injection
	validSortColumns := map[string]bool{"symbol": true, "name": true, "created_at": true}
	if !validSortColumns[sortBy] {
		sortBy = "symbol"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "asc"
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM coins WHERE is_active = true"
	if err := s.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get coins
	query := fmt.Sprintf(`
		SELECT id, symbol, exchange, COALESCE(name, ''), COALESCE(logo_url, ''), decimals, is_active, created_at, updated_at
		FROM coins
		WHERE is_active = true
		ORDER BY %s %s
		LIMIT $1 OFFSET $2
	`, sortBy, sortOrder)

	rows, err := s.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	coins := make([]models.Coin, 0)
	for rows.Next() {
		var c models.Coin
		if err := rows.Scan(&c.ID, &c.Symbol, &c.Exchange, &c.Name, &c.LogoURL, &c.Decimals, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		coins = append(coins, c)
	}

	return coins, total, nil
}

// GetCoinBySymbol returns a single coin by symbol
func (s *CoinService) GetCoinBySymbol(symbol string) (*models.Coin, error) {
	query := `
		SELECT id, symbol, exchange, COALESCE(name, ''), COALESCE(logo_url, ''), decimals, is_active, created_at, updated_at
		FROM coins
		WHERE symbol = $1 AND is_active = true
	`
	var c models.Coin
	err := s.db.QueryRow(query, symbol).Scan(&c.ID, &c.Symbol, &c.Exchange, &c.Name, &c.LogoURL, &c.Decimals, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// ExchangeService handles real-time market data from exchanges
type ExchangeService struct {
	redis *redis.Client
}

func NewExchangeService(redis *redis.Client) *ExchangeService {
	return &ExchangeService{redis: redis}
}

// MarketData holds real-time price information
type MarketData struct {
	Price     float64 `json:"price"`
	Change24h float64 `json:"change24h"`
	Volume24h float64 `json:"volume24h"`
	High24h   float64 `json:"high24h"`
	Low24h    float64 `json:"low24h"`
}

// GetMarketData fetches real-time market data for a symbol
func (s *ExchangeService) GetMarketData(symbol, exchange string) MarketData {
	ctx := context.Background()
	cacheKey := fmt.Sprintf("market:%s:%s", exchange, symbol)

	// Try cache first (5 second TTL)
	if cached, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
		var data MarketData
		if json.Unmarshal([]byte(cached), &data) == nil {
			return data
		}
	}

	// Fetch from exchange
	var data MarketData
	switch exchange {
	case "binance":
		data = fetchBinanceTicker(symbol)
	case "bybit":
		data = fetchBybitTicker(symbol)
	default:
		data = fetchBinanceTicker(symbol)
	}

	// Cache the result
	if jsonData, err := json.Marshal(data); err == nil {
		s.redis.Set(ctx, cacheKey, jsonData, 5*time.Second)
	}

	return data
}

// EnrichWithMarketData adds real-time prices to coins
func (s *ExchangeService) EnrichWithMarketData(coins []models.Coin, exchange string) []models.CoinWithMarketData {
	enriched := make([]models.CoinWithMarketData, len(coins))

	for i, coin := range coins {
		marketData := s.GetMarketData(coin.Symbol, exchange)
		enriched[i] = models.CoinWithMarketData{
			Coin:      coin,
			Price:     marketData.Price,
			Change24h: marketData.Change24h,
			Volume24h: marketData.Volume24h,
			High24h:   marketData.High24h,
			Low24h:    marketData.Low24h,
		}
	}

	return enriched
}

func fetchBinanceTicker(symbol string) MarketData {
	resp, err := http.Get("https://api.binance.com/api/v3/ticker/24hr?symbol=" + symbol)
	if err != nil {
		return MarketData{}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var ticker struct {
		LastPrice          string `json:"lastPrice"`
		PriceChangePercent string `json:"priceChangePercent"`
		Volume             string `json:"volume"`
		HighPrice          string `json:"highPrice"`
		LowPrice           string `json:"lowPrice"`
	}
	json.Unmarshal(body, &ticker)

	price, _ := strconv.ParseFloat(ticker.LastPrice, 64)
	change, _ := strconv.ParseFloat(ticker.PriceChangePercent, 64)
	volume, _ := strconv.ParseFloat(ticker.Volume, 64)
	high, _ := strconv.ParseFloat(ticker.HighPrice, 64)
	low, _ := strconv.ParseFloat(ticker.LowPrice, 64)

	return MarketData{
		Price:     price,
		Change24h: change,
		Volume24h: volume,
		High24h:   high,
		Low24h:    low,
	}
}

func fetchBybitTicker(symbol string) MarketData {
	resp, err := http.Get("https://api.bybit.com/v5/market/tickers?category=spot&symbol=" + symbol)
	if err != nil {
		return MarketData{}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Result struct {
			List []struct {
				LastPrice    string `json:"lastPrice"`
				Price24hPcnt string `json:"price24hPcnt"`
				Volume24h    string `json:"volume24h"`
				HighPrice24h string `json:"highPrice24h"`
				LowPrice24h  string `json:"lowPrice24h"`
			} `json:"list"`
		} `json:"result"`
	}
	json.Unmarshal(body, &result)

	if len(result.Result.List) == 0 {
		return MarketData{}
	}

	t := result.Result.List[0]
	price, _ := strconv.ParseFloat(t.LastPrice, 64)
	change, _ := strconv.ParseFloat(t.Price24hPcnt, 64)
	volume, _ := strconv.ParseFloat(t.Volume24h, 64)
	high, _ := strconv.ParseFloat(t.HighPrice24h, 64)
	low, _ := strconv.ParseFloat(t.LowPrice24h, 64)

	return MarketData{
		Price:     price,
		Change24h: change * 100, // Convert to percentage
		Volume24h: volume,
		High24h:   high,
		Low24h:    low,
	}
}
