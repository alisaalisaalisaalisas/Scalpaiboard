package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/scalpaiboard/backend/service"
)

type AlertHandler struct {
	alertService *service.AlertService
}

func NewAlertHandler(alertService *service.AlertService) *AlertHandler {
	return &AlertHandler{alertService: alertService}
}

// ListAlerts returns all alerts for current user
func (h *AlertHandler) ListAlerts(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	alerts, err := h.alertService.GetUserAlerts(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch alerts"})
		return
	}

	c.JSON(http.StatusOK, alerts)
}

// CreateAlert creates a new alert
func (h *AlertHandler) CreateAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		CoinID           int     `json:"coinId" binding:"required"`
		ConditionType    string  `json:"conditionType" binding:"required"`
		ConditionValue   float64 `json:"conditionValue" binding:"required"`
		NotificationType string  `json:"notificationType"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.NotificationType == "" {
		req.NotificationType = "in_app"
	}

	alert, err := h.alertService.CreateAlert(userID, req.CoinID, req.ConditionType, req.ConditionValue, req.NotificationType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create alert"})
		return
	}

	c.JSON(http.StatusCreated, alert)
}

// UpdateAlert updates an existing alert
func (h *AlertHandler) UpdateAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	alertID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	var req struct {
		IsActive         *bool    `json:"isActive"`
		ConditionValue   *float64 `json:"conditionValue"`
		NotificationType *string  `json:"notificationType"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	alert, err := h.alertService.UpdateAlert(userID, alertID, req.IsActive, req.ConditionValue, req.NotificationType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update alert"})
		return
	}

	c.JSON(http.StatusOK, alert)
}

// DeleteAlert deletes an alert
func (h *AlertHandler) DeleteAlert(c *gin.Context) {
	userID := c.GetString("user_id")
	alertID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	if err := h.alertService.DeleteAlert(userID, alertID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete alert"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// GetAlertHistory returns trigger history for an alert
func (h *AlertHandler) GetAlertHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	alertID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID"})
		return
	}

	history, err := h.alertService.GetAlertHistory(userID, alertID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch alert history"})
		return
	}

	c.JSON(http.StatusOK, history)
}
