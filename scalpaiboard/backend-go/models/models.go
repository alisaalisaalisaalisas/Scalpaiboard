package models

import "time"

// Coin represents a cryptocurrency trading pair
type Coin struct {
	ID        int       `json:"id"`
	Symbol    string    `json:"symbol"`
	Exchange  string    `json:"exchange"`
	Name      string    `json:"name"`
	LogoURL   string    `json:"logoUrl"`
	Decimals  int       `json:"decimals"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CoinWithMarketData includes real-time market data
type CoinWithMarketData struct {
	Coin
	Price     float64 `json:"price"`
	Change24h float64 `json:"change24h"`
	Volume24h float64 `json:"volume24h"`
	High24h   float64 `json:"high24h"`
	Low24h    float64 `json:"low24h"`
	MarketCap float64 `json:"marketCap,omitempty"`
}

// Candle represents OHLCV data
type Candle struct {
	ID        int       `json:"id"`
	CoinID    int       `json:"coinId"`
	Timeframe string    `json:"timeframe"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    float64   `json:"volume"`
	Timestamp time.Time `json:"timestamp"`
}

// Alert represents a user alert
type Alert struct {
	ID               int        `json:"id"`
	UserID           string     `json:"userId"`
	CoinID           int        `json:"coinId"`
	CoinSymbol       string     `json:"coinSymbol,omitempty"`
	ConditionType    string     `json:"conditionType"`
	ConditionValue   float64    `json:"conditionValue"`
	NotificationType string     `json:"notificationType"`
	IsActive         bool       `json:"isActive"`
	TriggeredCount   int        `json:"triggeredCount"`
	LastTriggeredAt  *time.Time `json:"lastTriggeredAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

// AlertHistory represents a triggered alert record
type AlertHistory struct {
	ID                  int       `json:"id"`
	AlertID             int       `json:"alertId"`
	TriggeredAt         time.Time `json:"triggeredAt"`
	NotificationStatus  string    `json:"notificationStatus"`
	NotificationChannel string    `json:"notificationChannel"`
	ErrorMessage        string    `json:"errorMessage,omitempty"`
}

// WatchlistItem represents a coin in user's watchlist
type WatchlistItem struct {
	ID      int       `json:"id"`
	UserID  string    `json:"userId"`
	CoinID  int       `json:"coinId"`
	Symbol  string    `json:"symbol"`
	AddedAt time.Time `json:"addedAt"`
	// Enriched data
	Price     float64 `json:"price,omitempty"`
	Change24h float64 `json:"change24h,omitempty"`
	Volume24h float64 `json:"volume24h,omitempty"`
}

// User represents a platform user
type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Username       string    `json:"username"`
	PasswordHash   string    `json:"-"`
	TelegramChatID *int64    `json:"telegramChatId,omitempty"`
	IsActive       bool      `json:"isActive"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// AIProvider represents a user-configured AI provider
type AIProvider struct {
	ID                    int       `json:"id"`
	UserID                string    `json:"userId"`
	ProviderName          string    `json:"providerName"`
	ProviderType          string    `json:"providerType"`
	APIKeyEncrypted       string    `json:"-"`
	APIEndpoint           string    `json:"apiEndpoint,omitempty"`
	ModelName             string    `json:"modelName"`
	IsActive              bool      `json:"isActive"`
	IsDefault             bool      `json:"isDefault"`
	MaxTokens             int       `json:"maxTokens"`
	Temperature           float64   `json:"temperature"`
	RateLimitRPM          int       `json:"rateLimitRpm"`
	CostPer1kInputTokens  float64   `json:"costPer1kInputTokens,omitempty"`
	CostPer1kOutputTokens float64   `json:"costPer1kOutputTokens,omitempty"`
	MonthlyBudget         float64   `json:"monthlyBudget,omitempty"`
	MonthlySpent          float64   `json:"monthlySpent"`
	CreatedAt             time.Time `json:"createdAt"`
}

// AIConversation represents a chat conversation
type AIConversation struct {
	ID         string    `json:"id"`
	UserID     string    `json:"userId"`
	ProviderID *int      `json:"providerId,omitempty"`
	Title      string    `json:"title"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// AIMessage represents a message in a conversation
type AIMessage struct {
	ID             int       `json:"id"`
	ConversationID string    `json:"conversationId"`
	Role           string    `json:"role"` // user, assistant, system
	Content        string    `json:"content"`
	TokensUsed     int       `json:"tokensUsed,omitempty"`
	Cost           float64   `json:"cost,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}
