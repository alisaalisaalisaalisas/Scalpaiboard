package handlers

import (
	"net/http"
	"sort"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/scalpaiboard/backend/service"
)

type AnalysisHandler struct{}

func NewAnalysisHandler() *AnalysisHandler {
	return &AnalysisHandler{}
}

func (h *AnalysisHandler) GetAnalysis(c *gin.Context) {
	symbol := c.Param("symbol")
	interval := c.DefaultQuery("interval", "1h")
	exchange := c.DefaultQuery("exchange", "binance")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "250"))
	if limit <= 0 {
		limit = 250
	}
	if limit > 500 {
		limit = 500
	}

	endTimeSec, _ := strconv.ParseInt(c.DefaultQuery("endTime", "0"), 10, 64)

	var raw []map[string]interface{}
	var err error
	switch exchange {
	case "binance":
		raw, err = fetchBinanceCandles(symbol, interval, limit, endTimeSec)
	case "bybit":
		raw, err = fetchBybitCandles(symbol, interval, limit, endTimeSec)
	default:
		raw, err = fetchBinanceCandles(symbol, interval, limit, endTimeSec)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch candles"})
		return
	}

	type candle struct {
		Time   int64
		Open   float64
		High   float64
		Low    float64
		Close  float64
		Volume float64
	}

	candles := make([]candle, 0, len(raw))
	for _, m := range raw {
		t, _ := m["time"].(int64)
		open, _ := m["open"].(float64)
		high, _ := m["high"].(float64)
		low, _ := m["low"].(float64)
		close, _ := m["close"].(float64)
		vol, _ := m["volume"].(float64)
		candles = append(candles, candle{Time: t, Open: open, High: high, Low: low, Close: close, Volume: vol})
	}

	// Ensure ascending time order (some exchanges return newest-first)
	sort.Slice(candles, func(i, j int) bool { return candles[i].Time < candles[j].Time })

	closes := make([]float64, 0, len(candles))
	highs := make([]float64, 0, len(candles))
	lows := make([]float64, 0, len(candles))

	for _, cd := range candles {
		closes = append(closes, cd.Close)
		highs = append(highs, cd.High)
		lows = append(lows, cd.Low)
	}

	analysis, analysisErr := service.ComputeTechnicalAnalysis(symbol, interval, closes, highs, lows, limit)
	if analysisErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": analysisErr.Error()})
		return
	}

	c.JSON(http.StatusOK, analysis)
}
