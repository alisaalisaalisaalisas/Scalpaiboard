package service

import (
	"database/sql"

	"github.com/scalpaiboard/backend/models"
)

type AlertService struct {
	db *sql.DB
}

func NewAlertService(db *sql.DB) *AlertService {
	return &AlertService{db: db}
}

// GetUserAlerts returns all alerts for a user
func (s *AlertService) GetUserAlerts(userID string) ([]models.Alert, error) {
	query := `
		SELECT a.id, a.user_id, a.coin_id, c.symbol, a.condition_type, a.condition_value, 
			   a.notification_type, a.is_active, a.triggered_count, a.last_triggered_at, 
			   a.created_at, a.updated_at
		FROM alerts a
		JOIN coins c ON a.coin_id = c.id
		WHERE a.user_id = $1
		ORDER BY a.created_at DESC
	`
	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	alerts := make([]models.Alert, 0)
	for rows.Next() {
		var a models.Alert
		if err := rows.Scan(&a.ID, &a.UserID, &a.CoinID, &a.CoinSymbol, &a.ConditionType,
			&a.ConditionValue, &a.NotificationType, &a.IsActive, &a.TriggeredCount,
			&a.LastTriggeredAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			continue
		}
		alerts = append(alerts, a)
	}
	return alerts, nil
}

// CreateAlert creates a new alert
func (s *AlertService) CreateAlert(userID string, coinID int, conditionType string, conditionValue float64, notificationType string) (*models.Alert, error) {
	query := `
		INSERT INTO alerts (user_id, coin_id, condition_type, condition_value, notification_type)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	var alert models.Alert
	alert.UserID = userID
	alert.CoinID = coinID
	alert.ConditionType = conditionType
	alert.ConditionValue = conditionValue
	alert.NotificationType = notificationType
	alert.IsActive = true

	err := s.db.QueryRow(query, userID, coinID, conditionType, conditionValue, notificationType).
		Scan(&alert.ID, &alert.CreatedAt, &alert.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &alert, nil
}

// UpdateAlert updates an alert
func (s *AlertService) UpdateAlert(userID string, alertID int, isActive *bool, conditionValue *float64, notificationType *string) (*models.Alert, error) {
	// Build dynamic update query
	query := `UPDATE alerts SET updated_at = NOW()`
	args := []interface{}{}
	argIndex := 1

	if isActive != nil {
		query += ", is_active = $" + string(rune('0'+argIndex))
		args = append(args, *isActive)
		argIndex++
	}
	if conditionValue != nil {
		query += ", condition_value = $" + string(rune('0'+argIndex))
		args = append(args, *conditionValue)
		argIndex++
	}
	if notificationType != nil {
		query += ", notification_type = $" + string(rune('0'+argIndex))
		args = append(args, *notificationType)
		argIndex++
	}

	query += " WHERE id = $" + string(rune('0'+argIndex)) + " AND user_id = $" + string(rune('0'+argIndex+1))
	args = append(args, alertID, userID)

	_, err := s.db.Exec(query, args...)
	if err != nil {
		return nil, err
	}

	// Return updated alert
	return &models.Alert{ID: alertID}, nil
}

// DeleteAlert removes an alert
func (s *AlertService) DeleteAlert(userID string, alertID int) error {
	query := "DELETE FROM alerts WHERE id = $1 AND user_id = $2"
	_, err := s.db.Exec(query, alertID, userID)
	return err
}

// GetAlertHistory returns trigger history for an alert
func (s *AlertService) GetAlertHistory(userID string, alertID int) ([]models.AlertHistory, error) {
	query := `
		SELECT ah.id, ah.alert_id, ah.triggered_at, ah.notification_status, ah.notification_channel, COALESCE(ah.error_message, '')
		FROM alert_history ah
		JOIN alerts a ON ah.alert_id = a.id
		WHERE ah.alert_id = $1 AND a.user_id = $2
		ORDER BY ah.triggered_at DESC
		LIMIT 100
	`
	rows, err := s.db.Query(query, alertID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	history := make([]models.AlertHistory, 0)
	for rows.Next() {
		var h models.AlertHistory
		if err := rows.Scan(&h.ID, &h.AlertID, &h.TriggeredAt, &h.NotificationStatus, &h.NotificationChannel, &h.ErrorMessage); err != nil {
			continue
		}
		history = append(history, h)
	}
	return history, nil
}
