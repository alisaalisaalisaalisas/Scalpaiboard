package service

import (
	"database/sql"

	"github.com/scalpaiboard/backend/models"
)

type WatchlistService struct {
	db *sql.DB
}

func NewWatchlistService(db *sql.DB) *WatchlistService {
	return &WatchlistService{db: db}
}

// GetUserWatchlist returns user's watchlist items
func (s *WatchlistService) GetUserWatchlist(userID string) ([]models.WatchlistItem, error) {
	query := `
		SELECT w.id, w.user_id, w.coin_id, c.symbol, w.added_at
		FROM watchlists w
		JOIN coins c ON w.coin_id = c.id
		WHERE w.user_id = $1
		ORDER BY w.added_at DESC
	`
	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.WatchlistItem, 0)
	for rows.Next() {
		var item models.WatchlistItem
		if err := rows.Scan(&item.ID, &item.UserID, &item.CoinID, &item.Symbol, &item.AddedAt); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

// AddToWatchlist adds a coin to user's watchlist
func (s *WatchlistService) AddToWatchlist(userID string, coinID int, symbol string) error {
	// If coinID is 0, lookup by symbol
	if coinID == 0 && symbol != "" {
		err := s.db.QueryRow("SELECT id FROM coins WHERE symbol = $1", symbol).Scan(&coinID)
		if err != nil {
			return err
		}
	}

	query := `
		INSERT INTO watchlists (user_id, coin_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, coin_id) DO NOTHING
	`
	_, err := s.db.Exec(query, userID, coinID)
	return err
}

// RemoveFromWatchlist removes a coin from watchlist
func (s *WatchlistService) RemoveFromWatchlist(userID string, coinID int) error {
	query := "DELETE FROM watchlists WHERE user_id = $1 AND coin_id = $2"
	_, err := s.db.Exec(query, userID, coinID)
	return err
}
