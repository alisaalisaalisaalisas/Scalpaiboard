package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/scalpaiboard/backend/service"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

type WebSocketHandler struct {
	exchangeService *service.ExchangeService
	hub             *Hub
}

// Hub manages all active WebSocket connections
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// Client represents a single WebSocket connection
type Client struct {
	hub           *Hub
	conn          *websocket.Conn
	send          chan []byte
	subscriptions map[string]bool
}

func NewWebSocketHandler(exchangeService *service.ExchangeService) *WebSocketHandler {
	hub := &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}

	go hub.run()
	go startMarketDataStream(hub)

	return &WebSocketHandler{
		exchangeService: exchangeService,
		hub:             hub,
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("Client connected. Total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected. Total: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *WebSocketHandler) HandleConnection(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:           h.hub,
		conn:          conn,
		send:          make(chan []byte, 256),
		subscriptions: make(map[string]bool),
	}

	h.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		// Handle subscription messages
		var msg struct {
			Type    string   `json:"type"`
			Symbols []string `json:"symbols"`
		}
		if err := json.Unmarshal(message, &msg); err == nil {
			if msg.Type == "subscribe" {
				for _, symbol := range msg.Symbols {
					c.subscriptions[symbol] = true
				}
			} else if msg.Type == "unsubscribe" {
				for _, symbol := range msg.Symbols {
					delete(c.subscriptions, symbol)
				}
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.WriteMessage(websocket.TextMessage, message)

		case <-ticker.C:
			// Send ping to keep connection alive
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// startMarketDataStream fetches market data and broadcasts to clients
func startMarketDataStream(hub *Hub) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	symbols := []string{"BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "XRPUSDT",
		"DOGEUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT", "ARBUSDT"}

	for range ticker.C {
		for _, symbol := range symbols {
			data := fetchPriceUpdate(symbol)
			if data != nil {
				message, _ := json.Marshal(data)
				hub.broadcast <- message
			}
		}
	}
}

func fetchPriceUpdate(symbol string) map[string]interface{} {
	resp, err := http.Get("https://api.binance.com/api/v3/ticker/24hr?symbol=" + symbol)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var ticker struct {
		Symbol             string `json:"symbol"`
		LastPrice          string `json:"lastPrice"`
		PriceChange        string `json:"priceChange"`
		PriceChangePercent string `json:"priceChangePercent"`
		Volume             string `json:"volume"`
		HighPrice          string `json:"highPrice"`
		LowPrice           string `json:"lowPrice"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&ticker); err != nil {
		return nil
	}

	return map[string]interface{}{
		"type":      "ticker",
		"symbol":    ticker.Symbol,
		"price":     ticker.LastPrice,
		"change24h": ticker.PriceChangePercent,
		"volume24h": ticker.Volume,
		"high24h":   ticker.HighPrice,
		"low24h":    ticker.LowPrice,
		"timestamp": time.Now().Unix(),
	}
}
