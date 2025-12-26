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
	hub  *Hub
	conn *websocket.Conn
	send chan []byte

	subMu         sync.RWMutex
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
				c.subMu.Lock()
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
				c.subMu.Unlock()
			} else if msg.Type == "unsubscribe" {
				c.subMu.Lock()
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
				c.subMu.Unlock()
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

// startMarketDataStream sends tickers only to subscribed clients.
func startMarketDataStream(hub *Hub) {
	// 250ms target update cadence (note: REST polling may rate-limit).
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	const workers = 10

	for range ticker.C {
		// Snapshot all clients and their subscriptions.
		hub.mu.RLock()
		clients := make([]*Client, 0, len(hub.clients))
		union := make(map[string]bool)
		for client := range hub.clients {
			clients = append(clients, client)

			client.subMu.RLock()
			for marketID := range client.subscriptions {
				union[marketID] = true
			}
			client.subMu.RUnlock()
		}
		hub.mu.RUnlock()

		if len(union) == 0 || len(clients) == 0 {
			continue
		}

		// Fetch each market ticker once (parallel).
		sem := make(chan struct{}, workers)
		resultsMu := sync.Mutex{}
		payloadByMarket := make(map[string][]byte, len(union))

		wg := sync.WaitGroup{}
		now := time.Now().Unix()

		for marketID := range union {
			marketID := marketID
			wg.Add(1)
			sem <- struct{}{}
			go func() {
				defer wg.Done()
				defer func() { <-sem }()

				exchange, marketType, symbol, ok := parseMarketID(marketID)
				if !ok {
					return
				}

				price, changePct, volume24h, err := fetchTicker(exchange, marketType, symbol)
				if err != nil {
					return
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
					"timestamp":  now,
				}

				payload, err := json.Marshal(msg)
				if err != nil {
					return
				}

				resultsMu.Lock()
				payloadByMarket[marketID] = payload
				resultsMu.Unlock()
			}()
		}

		wg.Wait()

		// Deliver only to clients that subscribed.
		hub.mu.RLock()
		for _, client := range clients {
			client.subMu.RLock()
			for marketID := range client.subscriptions {
				payload := payloadByMarket[marketID]
				if len(payload) == 0 {
					continue
				}

				select {
				case client.send <- payload:
				default:
					// Drop if client is slow.
				}
			}
			client.subMu.RUnlock()
		}
		hub.mu.RUnlock()
	}
}
