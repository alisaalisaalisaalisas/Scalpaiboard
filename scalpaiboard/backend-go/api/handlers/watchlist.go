package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/scalpaiboard/backend/service"
)

type WatchlistHandler struct {
	watchlistService *service.WatchlistService
}

func NewWatchlistHandler(watchlistService *service.WatchlistService) *WatchlistHandler {
	return &WatchlistHandler{watchlistService: watchlistService}
}

// GetWatchlist returns user's watchlist
func (h *WatchlistHandler) GetWatchlist(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	watchlist, err := h.watchlistService.GetUserWatchlist(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch watchlist"})
		return
	}

	c.JSON(http.StatusOK, watchlist)
}

// AddToWatchlist adds a coin to user's watchlist
func (h *WatchlistHandler) AddToWatchlist(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		CoinID int    `json:"coinId"`
		Symbol string `json:"symbol"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.watchlistService.AddToWatchlist(userID, req.CoinID, req.Symbol); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to watchlist"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"status": "added"})
}

// RemoveFromWatchlist removes a coin from watchlist
func (h *WatchlistHandler) RemoveFromWatchlist(c *gin.Context) {
	userID := c.GetString("user_id")
	coinID, err := strconv.Atoi(c.Param("coinId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid coin ID"})
		return
	}

	if err := h.watchlistService.RemoveFromWatchlist(userID, coinID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from watchlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}
