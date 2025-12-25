package grpc

import (
	"context"
	"log"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// CSharpClient handles gRPC communication with the C# backend
type CSharpClient struct {
	conn        *grpc.ClientConn
	alertClient AlertServiceClient
	aiClient    AIServiceClient
}

var client *CSharpClient

// NewCSharpClient creates a new connection to the C# backend
func NewCSharpClient() (*CSharpClient, error) {
	address := os.Getenv("CSHARP_GRPC_URL")
	if address == "" {
		address = "localhost:50052"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		log.Printf("⚠️ Could not connect to C# backend at %s: %v", address, err)
		return nil, err
	}

	log.Printf("✅ Connected to C# backend at %s", address)

	return &CSharpClient{
		conn:        conn,
		alertClient: NewAlertServiceClient(conn),
		aiClient:    NewAIServiceClient(conn),
	}, nil
}

// GetClient returns the singleton gRPC client
func GetClient() *CSharpClient {
	return client
}

// Initialize sets up the global client
func Initialize() error {
	var err error
	client, err = NewCSharpClient()
	return err
}

// Close closes the gRPC connection
func (c *CSharpClient) Close() {
	if c.conn != nil {
		c.conn.Close()
	}
}

// ========== Alert Methods ==========

// EvaluateAlert checks if an alert should trigger
func (c *CSharpClient) EvaluateAlert(ctx context.Context, userID string, alertID int32, symbol string, price, volume float64) (bool, error) {
	if c == nil || c.alertClient == nil {
		// Fallback to local evaluation if C# backend is not available
		return false, nil
	}

	resp, err := c.alertClient.EvaluateAlert(ctx, &EvaluateAlertRequest{
		UserId:        userID,
		AlertId:       alertID,
		Symbol:        symbol,
		CurrentPrice:  price,
		CurrentVolume: volume,
	})
	if err != nil {
		return false, err
	}

	return resp.Triggered, nil
}

// ========== AI Methods ==========

// Chat sends a message to the AI and returns a streaming response
func (c *CSharpClient) Chat(ctx context.Context, userID, message string, conversationID *string, providerID *int32) (AIService_ChatClient, error) {
	if c == nil || c.aiClient == nil {
		return nil, nil
	}

	req := &ChatRequest{
		UserId:  userID,
		Message: message,
	}
	if conversationID != nil {
		req.ConversationId = conversationID
	}
	if providerID != nil {
		req.ProviderId = providerID
	}

	return c.aiClient.Chat(ctx, req)
}

// Placeholder interfaces - these will be generated from proto
type AlertServiceClient interface {
	EvaluateAlert(ctx context.Context, in *EvaluateAlertRequest, opts ...grpc.CallOption) (*EvaluateAlertResponse, error)
}

type AIServiceClient interface {
	Chat(ctx context.Context, in *ChatRequest, opts ...grpc.CallOption) (AIService_ChatClient, error)
}

type AIService_ChatClient interface {
	Recv() (*ChatResponse, error)
}

// Placeholder message types
type EvaluateAlertRequest struct {
	UserId        string
	AlertId       int32
	Symbol        string
	CurrentPrice  float64
	CurrentVolume float64
}

type EvaluateAlertResponse struct {
	Triggered   bool
	Condition   string
	Threshold   float64
	ActualValue float64
}

type ChatRequest struct {
	UserId         string
	Message        string
	ConversationId *string
	ProviderId     *int32
}

type ChatResponse struct {
	Content    string
	IsComplete bool
	ToolCall   *string
	ToolResult *string
	TokensUsed *int32
	Cost       *float64
}

// Temporary stubs for client creation until proto is compiled
func NewAlertServiceClient(cc grpc.ClientConnInterface) AlertServiceClient {
	return nil
}

func NewAIServiceClient(cc grpc.ClientConnInterface) AIServiceClient {
	return nil
}
