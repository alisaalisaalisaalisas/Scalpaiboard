package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
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
			Markets []string `json:"markets"`
		}
		if err := json.Unmarshal(message, &msg); err == nil {
			items := msg.Markets
			if len(items) == 0 {
				items = msg.Symbols
			}

			if msg.Type == "subscribe" {
				for _, item := range items {
					key := strings.TrimSpace(item)
					if key == "" {
						continue
					}
					// Backwards compatible: if client sends a plain symbol, assume BI:SPOT.
					if !strings.Contains(key, ":") {
						key = "BI:SPOT:" + strings.ToUpper(key)
					}
					c.subscriptions[key] = true
				}
			} else if msg.Type == "unsubscribe" {
				for _, item := range items {
					key := strings.TrimSpace(item)
					if key == "" {
						continue
					}
					if !strings.Contains(key, ":") {
						key = "BI:SPOT:" + strings.ToUpper(key)
					}
					delete(c.subscriptions, key)
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

// startMarketDataStream broadcasts tickers for subscribed markets.
func startMarketDataStream(hub *Hub) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Build a unique set of marketIds subscribed by any client.
		hub.mu.RLock()
		subs := make(map[string]bool)
		for client := range hub.clients {
			for marketID := range client.subscriptions {
				subs[marketID] = true
			}
		}
		hub.mu.RUnlock()

		if len(subs) == 0 {
			continue
		}

		for marketID := range subs {
			exchange, marketType, symbol, ok := parseMarketID(marketID)
			if !ok {
				continue
			}

			price, changePct, volume24h, err := fetchTicker(exchange, marketType, symbol)
			if err != nil {
				continue
			}

			msg := map[string]interface{}{
				"type":       "ticker",
				"marketId":   marketID,
				"symbol":     symbol,
				"exchange":   exchange,
				"marketType": marketType,
				"price":      price,
				"change24h":  changePct,
				"volume24h":  volume24h,
				"timestamp":  time.Now().Unix(),
			}

			if payload, err := json.Marshal(msg); err == nil {
				hub.broadcast <- payload
			}
		}
	}
}
