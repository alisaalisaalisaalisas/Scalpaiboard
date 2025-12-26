package handlers

import (
	"encoding/json"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/scalpaiboard/backend/service"
)

type MarketHandler struct {
	coinService *service.CoinService
}

type MarketItem struct {
	MarketID           string `json:"marketId"`
	CoinID             int    `json:"coinId"`
	Symbol             string `json:"symbol"`
	Base               string `json:"base"`
	Quote              string `json:"quote"`
	Exchange           string `json:"exchange"`
	ExchangeTag        string `json:"exchangeTag"`
	MarketType         string `json:"marketType"`
	ContractTag        string `json:"contractTag"`
	WSStreamID         string `json:"wsStreamId"`
	PricePrecision     int    `json:"pricePrecision"`
	QtyPrecision       int    `json:"qtyPrecision"`
	TickSize           string `json:"tickSize"`
	LotSize            string `json:"lotSize"`
	FundingIntervalSec *int   `json:"fundingIntervalSec"`
	IsActive           bool   `json:"isActive"`
}

type MarketMetrics struct {
	MarketID    string  `json:"marketId"`
	Price       float64 `json:"price"`
	ChangeToday float64 `json:"changeTodayPct"`
	Volume24h   float64 `json:"volume24h"`
	Natr5m14    float64 `json:"natr5m14"`
}

func NewMarketHandler(coinService *service.CoinService) *MarketHandler {
	return &MarketHandler{coinService: coinService}
}

func (h *MarketHandler) ListMarkets(c *gin.Context) {
	query := strings.ToUpper(strings.TrimSpace(c.DefaultQuery("query", "")))
	exchange := strings.ToLower(strings.TrimSpace(c.DefaultQuery("exchange", "")))
	marketType := strings.ToLower(strings.TrimSpace(c.DefaultQuery("type", "")))

	coins, _, err := h.coinService.GetCoins(2000, 0, "symbol", "asc")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch markets"})
		return
	}

	out := make([]MarketItem, 0, len(coins)*4)

	for _, coin := range coins {
		sym := strings.ToUpper(strings.TrimSpace(coin.Symbol))
		if sym == "" {
			continue
		}

		base, quote := splitBaseQuote(sym)

		if query != "" {
			q := query
			if !strings.Contains(sym, q) && !strings.Contains(base, q) {
				continue
			}
		}

		variants := []MarketItem{
			// Default-first ordering: Binance Perpetual (BI-F) for symbol-only search.
			buildMarketItem("BI", "binance", "PERP", "Perpetual", "BI-F", coin.ID, sym, base, quote, intPtr(8*60*60)),
			buildMarketItem("BI", "binance", "SPOT", "Spot", "BI-S", coin.ID, sym, base, quote, nil),
			buildMarketItem("BY", "bybit", "PERP", "Perpetual", "BY-F", coin.ID, sym, base, quote, intPtr(8*60*60)),
			buildMarketItem("BY", "bybit", "SPOT", "Spot", "BY-S", coin.ID, sym, base, quote, nil),
		}

		for _, m := range variants {
			if exchange != "" {
				if exchange != strings.ToLower(m.Exchange) && exchange != strings.ToLower(m.ExchangeTag) {
					continue
				}
			}

			if marketType != "" {
				switch marketType {
				case "spot":
					if strings.ToLower(m.MarketType) != "spot" {
						continue
					}
				case "perp", "perpetual", "futures":
					if strings.ToLower(m.MarketType) != "perpetual" {
						continue
					}
				default:
					// ignore unknown
				}
			}

			out = append(out, m)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

func (h *MarketHandler) GetMetrics(c *gin.Context) {
	marketID := c.Param("marketId")
	exchange, marketType, symbol, ok := parseMarketID(marketID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid marketId"})
		return
	}

	price, change, vol, err := fetchTicker(exchange, marketType, symbol)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to fetch ticker"})
		return
	}

	candles, err := fetchCandlesByMarket(exchange, marketType, symbol, "5m", 80, 0)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to fetch candles"})
		return
	}

	// candles are map[string]interface{}; ensure ascending.
	sort.Slice(candles, func(i, j int) bool {
		return anyToInt64(candles[i]["time"]) < anyToInt64(candles[j]["time"])
	})

	highs := make([]float64, 0, len(candles))
	lows := make([]float64, 0, len(candles))
	closes := make([]float64, 0, len(candles))
	for _, cd := range candles {
		highs = append(highs, anyToFloat64(cd["high"]))
		lows = append(lows, anyToFloat64(cd["low"]))
		closes = append(closes, anyToFloat64(cd["close"]))
	}

	natr := computeNatr14(highs, lows, closes)

	c.JSON(http.StatusOK, MarketMetrics{
		MarketID:    marketID,
		Price:       price,
		ChangeToday: change,
		Volume24h:   vol,
		Natr5m14:    natr,
	})
}

func buildMarketItem(exchangeTag, exchange, typeTag, marketType, contractTag string, coinID int, symbol, base, quote string, fundingIntervalSec *int) MarketItem {
	ws := strings.ToLower(exchange) + "." + strings.ToLower(marketType) + ".ticker." + strings.ToLower(symbol)
	marketID := exchangeTag + ":" + typeTag + ":" + symbol
	return MarketItem{
		MarketID:           marketID,
		CoinID:             coinID,
		Symbol:             symbol,
		Base:               base,
		Quote:              quote,
		Exchange:           exchange,
		ExchangeTag:        exchangeTag,
		MarketType:         marketType,
		ContractTag:        contractTag,
		WSStreamID:         ws,
		PricePrecision:     2,
		QtyPrecision:       2,
		TickSize:           "0.01",
		LotSize:            "0.01",
		FundingIntervalSec: fundingIntervalSec,
		IsActive:           true,
	}
}

func splitBaseQuote(symbol string) (string, string) {
	if strings.HasSuffix(symbol, "USDT") {
		return strings.TrimSuffix(symbol, "USDT"), "USDT"
	}
	if strings.HasSuffix(symbol, "USD") {
		return strings.TrimSuffix(symbol, "USD"), "USD"
	}
	return symbol, ""
}

func parseMarketID(marketID string) (exchange string, marketType string, symbol string, ok bool) {
	parts := strings.Split(marketID, ":")
	if len(parts) != 3 {
		return "", "", "", false
	}
	tag := strings.ToUpper(parts[0])
	typeTag := strings.ToUpper(parts[1])
	symbol = strings.ToUpper(parts[2])

	switch tag {
	case "BI":
		exchange = "binance"
	case "BY":
		exchange = "bybit"
	default:
		return "", "", "", false
	}

	switch typeTag {
	case "SPOT":
		marketType = "spot"
	case "PERP":
		marketType = "perp"
	default:
		return "", "", "", false
	}

	return exchange, marketType, symbol, true
}

func fetchCandlesByMarket(exchange, marketType, symbol, interval string, limit int, endTimeSec int64) ([]map[string]interface{}, error) {
	switch exchange {
	case "binance":
		if marketType == "perp" {
			return fetchBinanceFuturesCandles(symbol, interval, limit, endTimeSec)
		}
		return fetchBinanceCandles(symbol, interval, limit, endTimeSec)
	case "bybit":
		if marketType == "perp" {
			return fetchBybitLinearCandles(symbol, interval, limit, endTimeSec)
		}
		return fetchBybitCandles(symbol, interval, limit, endTimeSec)
	default:
		return fetchBinanceCandles(symbol, interval, limit, endTimeSec)
	}
}

func fetchTicker(exchange, marketType, symbol string) (price float64, changePct float64, volume24h float64, err error) {
	switch exchange {
	case "binance":
		if marketType == "perp" {
			return fetchBinanceFuturesTicker(symbol)
		}
		return fetchBinanceSpotTicker(symbol)
	case "bybit":
		if marketType == "perp" {
			return fetchBybitLinearTicker(symbol)
		}
		return fetchBybitSpotTicker(symbol)
	default:
		return fetchBinanceSpotTicker(symbol)
	}
}

func fetchBinanceSpotTicker(symbol string) (float64, float64, float64, error) {
	resp, err := http.Get("https://api.binance.com/api/v3/ticker/24hr?symbol=" + symbol)
	if err != nil {
		return 0, 0, 0, err
	}
	defer resp.Body.Close()

	var ticker struct {
		LastPrice          string `json:"lastPrice"`
		PriceChangePercent string `json:"priceChangePercent"`
		QuoteVolume        string `json:"quoteVolume"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ticker); err != nil {
		return 0, 0, 0, err
	}

	price, _ := strconv.ParseFloat(ticker.LastPrice, 64)
	change, _ := strconv.ParseFloat(ticker.PriceChangePercent, 64)
	vol, _ := strconv.ParseFloat(ticker.QuoteVolume, 64)
	return price, change, vol, nil
}

func fetchBinanceFuturesTicker(symbol string) (float64, float64, float64, error) {
	resp, err := http.Get("https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=" + symbol)
	if err != nil {
		return 0, 0, 0, err
	}
	defer resp.Body.Close()

	var ticker struct {
		LastPrice          string `json:"lastPrice"`
		PriceChangePercent string `json:"priceChangePercent"`
		QuoteVolume        string `json:"quoteVolume"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ticker); err != nil {
		return 0, 0, 0, err
	}

	price, _ := strconv.ParseFloat(ticker.LastPrice, 64)
	change, _ := strconv.ParseFloat(ticker.PriceChangePercent, 64)
	vol, _ := strconv.ParseFloat(ticker.QuoteVolume, 64)
	return price, change, vol, nil
}

func fetchBybitSpotTicker(symbol string) (float64, float64, float64, error) {
	resp, err := http.Get("https://api.bybit.com/v5/market/tickers?category=spot&symbol=" + symbol)
	if err != nil {
		return 0, 0, 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			List []struct {
				LastPrice    string `json:"lastPrice"`
				Price24hPcnt string `json:"price24hPcnt"`
				Turnover24h  string `json:"turnover24h"`
			} `json:"list"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, 0, err
	}
	if len(result.Result.List) == 0 {
		return 0, 0, 0, nil
	}

	t := result.Result.List[0]
	price, _ := strconv.ParseFloat(t.LastPrice, 64)
	change, _ := strconv.ParseFloat(t.Price24hPcnt, 64)
	turnover, _ := strconv.ParseFloat(t.Turnover24h, 64)
	return price, change * 100, turnover, nil
}

func fetchBybitLinearTicker(symbol string) (float64, float64, float64, error) {
	resp, err := http.Get("https://api.bybit.com/v5/market/tickers?category=linear&symbol=" + symbol)
	if err != nil {
		return 0, 0, 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			List []struct {
				LastPrice    string `json:"lastPrice"`
				Price24hPcnt string `json:"price24hPcnt"`
				Turnover24h  string `json:"turnover24h"`
			} `json:"list"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, 0, err
	}
	if len(result.Result.List) == 0 {
		return 0, 0, 0, nil
	}

	t := result.Result.List[0]
	price, _ := strconv.ParseFloat(t.LastPrice, 64)
	change, _ := strconv.ParseFloat(t.Price24hPcnt, 64)
	turnover, _ := strconv.ParseFloat(t.Turnover24h, 64)
	return price, change * 100, turnover, nil
}

func computeNatr14(highs, lows, closes []float64) float64 {
	if len(highs) < 15 || len(lows) < 15 || len(closes) < 15 {
		return 0
	}

	period := 14
	trs := make([]float64, 0, len(closes)-1)
	for i := 1; i < len(closes); i++ {
		hl := highs[i] - lows[i]
		hc := math.Abs(highs[i] - closes[i-1])
		lc := math.Abs(lows[i] - closes[i-1])
		tr := math.Max(hl, math.Max(hc, lc))
		trs = append(trs, tr)
	}

	if len(trs) < period {
		return 0
	}

	// Wilder ATR
	atr := 0.0
	for i := 0; i < period; i++ {
		atr += trs[i]
	}
	atr /= float64(period)

	for i := period; i < len(trs); i++ {
		atr = (atr*float64(period-1) + trs[i]) / float64(period)
	}

	lastClose := closes[len(closes)-1]
	if lastClose == 0 {
		return 0
	}

	return 100 * atr / lastClose
}

func anyToFloat64(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int64:
		return float64(t)
	case json.Number:
		f, _ := t.Float64()
		return f
	case string:
		f, _ := strconv.ParseFloat(t, 64)
		return f
	default:
		return 0
	}
}

func anyToInt64(v interface{}) int64 {
	switch t := v.(type) {
	case int64:
		return t
	case float64:
		return int64(t)
	case json.Number:
		i, _ := t.Int64()
		return i
	case string:
		i, _ := strconv.ParseInt(t, 10, 64)
		return i
	default:
		return 0
	}
}

func intPtr(v int) *int { return &v }
