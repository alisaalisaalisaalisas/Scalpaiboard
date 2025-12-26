package service

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// NotificationService handles sending notifications
type NotificationService struct {
	telegramToken string
	httpClient    *http.Client
}

// NewNotificationService creates a new notification service
func NewNotificationService() *NotificationService {
	return &NotificationService{
		telegramToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// FormatAlertMessage creates a formatted notification message
func (n *NotificationService) FormatAlertMessage(symbol, conditionType string, conditionValue, currentPrice float64) string {
	condition := n.formatCondition(conditionType, conditionValue)

	return fmt.Sprintf(`🚨 *Alert Triggered!*

*Coin:* %s
*Condition:* %s
*Current Price:* $%.2f
*Time:* %s UTC

_Scalpaiboard Alert System_`,
		symbol,
		condition,
		currentPrice,
		time.Now().UTC().Format("2006-01-02 15:04"),
	)
}

func (n *NotificationService) formatCondition(conditionType string, value float64) string {
	switch strings.ToLower(conditionType) {
	case "price_above":
		return fmt.Sprintf("Price above $%.2f", value)
	case "price_below":
		return fmt.Sprintf("Price below $%.2f", value)
	case "volume_above":
		return fmt.Sprintf("Volume above %.0f", value)
	case "volume_below":
		return fmt.Sprintf("Volume below %.0f", value)
	default:
		return fmt.Sprintf("%s: %.2f", conditionType, value)
	}
}

// SendTelegram sends a message via Telegram bot
func (n *NotificationService) SendTelegram(chatID int64, message string) error {
	if n.telegramToken == "" {
		log.Println("⚠️ Telegram bot token not configured")
		return nil
	}

	if chatID == 0 {
		log.Println("⚠️ No Telegram chat ID provided")
		return nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", n.telegramToken)

	data := url.Values{}
	data.Set("chat_id", fmt.Sprintf("%d", chatID))
	data.Set("text", message)
	data.Set("parse_mode", "Markdown")

	resp, err := n.httpClient.PostForm(apiURL, data)
	if err != nil {
		return fmt.Errorf("telegram request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("telegram API error: %d", resp.StatusCode)
	}

	log.Printf("✅ Telegram message sent to chat %d", chatID)
	return nil
}

// SendEmail sends an email notification (placeholder for SendGrid/SMTP)
func (n *NotificationService) SendEmail(to, subject, body string) error {
	if to == "" {
		log.Println("⚠️ No email address provided")
		return nil
	}

	// TODO: Implement actual email sending with SendGrid or SMTP
	log.Printf("📧 Would send email to %s: %s", to, subject)
	return nil
}
