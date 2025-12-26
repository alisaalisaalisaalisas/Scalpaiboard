package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// AlertEvaluator handles scheduled alert evaluation
type AlertEvaluator struct {
	db           *sql.DB
	notification *NotificationService
}

// NewAlertEvaluator creates a new alert evaluator
func NewAlertEvaluator(db *sql.DB, notification *NotificationService) *AlertEvaluator {
	return &AlertEvaluator{
		db:           db,
		notification: notification,
	}
}

// EvaluateAllAlerts checks all active alerts against current market prices
func (e *AlertEvaluator) EvaluateAllAlerts() {
	log.Println("🔍 Starting alert evaluation...")

	// Get all active alerts grouped by coin
	rows, err := e.db.Query(`
		SELECT a.id, a.user_id, a.coin_id, c.symbol, a.condition_type, a.condition_value, 
			   a.notification_type, a.last_triggered_at
		FROM alerts a
		JOIN coins c ON a.coin_id = c.id
		WHERE a.is_active = true
	`)
	if err != nil {
		log.Printf("❌ Failed to fetch alerts: %v", err)
		return
	}
	defer rows.Close()

	alertCount := 0
	triggeredCount := 0

	for rows.Next() {
		var (
			alertID          int
			userID           string
			coinID           int
			symbol           string
			conditionType    string
			conditionValue   float64
			notificationType string
			lastTriggeredAt  sql.NullTime
		)

		if err := rows.Scan(&alertID, &userID, &coinID, &symbol, &conditionType,
			&conditionValue, &notificationType, &lastTriggeredAt); err != nil {
			log.Printf("⚠️ Failed to scan alert: %v", err)
			continue
		}

		alertCount++

		// Check debounce (5 minutes)
		if lastTriggeredAt.Valid && time.Since(lastTriggeredAt.Time) < 5*time.Minute {
			continue
		}

		// Get current market data
		marketData, err := e.getMarketData(symbol)
		if err != nil {
			log.Printf("⚠️ Failed to get market data for %s: %v", symbol, err)
			continue
		}

		// Evaluate condition
		shouldTrigger := e.evaluateCondition(conditionType, conditionValue, marketData)

		if shouldTrigger {
			triggeredCount++
			e.processTriggeredAlert(alertID, userID, symbol, conditionType, conditionValue,
				notificationType, marketData.Price)
		}
	}

	log.Printf("✅ Evaluated %d alerts, triggered %d", alertCount, triggeredCount)
}

// AlertMarketData holds current market information for alert evaluation
type AlertMarketData struct {
	Price  float64
	Volume float64
}

// evaluateCondition checks if alert condition is met
func (e *AlertEvaluator) evaluateCondition(conditionType string, value float64, market *AlertMarketData) bool {
	switch conditionType {
	case "price_above":
		return market.Price >= value
	case "price_below":
		return market.Price <= value
	case "volume_above":
		return market.Volume >= value
	case "volume_below":
		return market.Volume <= value
	default:
		return false
	}
}

// getMarketData fetches current price from Binance
func (e *AlertEvaluator) getMarketData(symbol string) (*AlertMarketData, error) {
	url := fmt.Sprintf("https://api.binance.com/api/v3/ticker/24hr?symbol=%s", symbol)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("binance API error: %d", resp.StatusCode)
	}

	var result struct {
		LastPrice string `json:"lastPrice"`
		Volume    string `json:"volume"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	var price, volume float64
	fmt.Sscanf(result.LastPrice, "%f", &price)
	fmt.Sscanf(result.Volume, "%f", &volume)

	return &AlertMarketData{Price: price, Volume: volume}, nil
}

// processTriggeredAlert handles a triggered alert
func (e *AlertEvaluator) processTriggeredAlert(alertID int, userID, symbol, conditionType string,
	conditionValue float64, notificationType string, currentPrice float64) {

	log.Printf("🚨 Alert %d triggered for %s (price: $%.2f)", alertID, symbol, currentPrice)

	// Update alert in database
	_, err := e.db.Exec(`
		UPDATE alerts 
		SET triggered_count = triggered_count + 1, 
			last_triggered_at = NOW(),
			updated_at = NOW()
		WHERE id = $1
	`, alertID)
	if err != nil {
		log.Printf("❌ Failed to update alert %d: %v", alertID, err)
	}

	// Save to history
	var historyID int
	err = e.db.QueryRow(`
		INSERT INTO alert_history (alert_id, triggered_at, notification_status, notification_channel)
		VALUES ($1, NOW(), 'pending', $2)
		RETURNING id
	`, alertID, notificationType).Scan(&historyID)
	if err != nil {
		log.Printf("❌ Failed to save alert history: %v", err)
		return
	}

	// Send notification
	message := e.notification.FormatAlertMessage(symbol, conditionType, conditionValue, currentPrice)
	var notifyErr error

	switch notificationType {
	case "telegram":
		// Get user's telegram chat ID (would need to be stored in user profile)
		notifyErr = e.notification.SendTelegram(0, message) // TODO: Get real chat ID
	case "email":
		notifyErr = e.notification.SendEmail("", "Alert Triggered", message) // TODO: Get real email
	default:
		// in_app - just log it
		log.Printf("📱 In-app notification: %s", message)
	}

	// Update history status
	status := "sent"
	errMsg := ""
	if notifyErr != nil {
		status = "failed"
		errMsg = notifyErr.Error()
	}

	_, _ = e.db.Exec(`
		UPDATE alert_history 
		SET notification_status = $1, error_message = $2
		WHERE id = $3
	`, status, errMsg, historyID)
}
