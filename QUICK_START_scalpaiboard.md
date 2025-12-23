# 🚀 Scalpaiboard - Quick Start Guide

**Get Scalpaiboard running in 5 minutes**

---

## ✅ Prerequisites

```bash
# Verify installation:
docker --version          # Docker 20.10+
docker-compose --version  # Docker Compose 2.0+
git --version             # Git 2.30+
node --version            # Node.js 18+
```

**Missing Docker?** → [Install Docker Desktop](https://www.docker.com/products/docker-desktop)

---

## 📥 Installation (3 Steps)

### Step 1: Clone Repository
```bash
git clone https://github.com/yourusername/scalpaiboard.git
cd scalpaiboard
```

### Step 2: Configure Environment
```bash
cp .env.example .env

# Edit .env with your API keys:
BINANCE_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret
OPENAI_API_KEY=sk-your_openai_key
TELEGRAM_BOT_TOKEN=your_telegram_token
SENDGRID_API_KEY=your_sendgrid_key
```

### Step 3: Launch Services
```bash
docker-compose up -d

# Wait 30 seconds for services to initialize
# Check status:
docker-compose ps
```

---

## 🎯 Access Scalpaiboard

**Frontend Dashboard**
```
http://localhost:3000
```
Features:
- Multi-chart screener (12+ coins)
- Real-time AI chat sidebar
- Alert management
- Watchlist manager
- Order book heatmap

**API Documentation**
```
http://localhost:3001/api/docs
```

**Health Checks**
```
Go Backend:    http://localhost:3001/api/health
C# Backend:    http://localhost:3002/health
Hangfire Jobs: http://localhost:3002/hangfire
```

---

## 💬 Using the AI Assistant

The AI chat is in the right sidebar (30% of dashboard). Try these:

### Example 1: Market Scanning
```
You: "Find coins with >$100M volume and >5% volatility"

AI Response:
✅ Scanned 512 coins
Found 23 opportunities:

1. SOLUSDT - 8.3% volatility, $1.2B volume
   RSI: 28 (Oversold) → BUY signal
   
2. ADAUSDT - 6.7% volatility, $320M volume
   RSI: 35 (Oversold) → BUY signal
   
3. LINKUSDT - 5.2% volatility, $180M volume
   MACD: Bullish crossover → WATCH

Would you like me to create alerts on these?
```

### Example 2: Technical Analysis
```
You: "Analyze BTC on 1h timeframe"

AI Response:
📊 BTCUSDT 1h Analysis

Technical Setup:
• Price: $65,432 (tested support)
• RSI(14): 32 (Oversold condition)
• MACD: Bullish crossover signal
• Bollinger Bands: Price at lower band

Key Levels:
• Resistance: $66,500
• Support: $64,800
• Target: $67,200

Signal: 🟢 STRONG BUY
Confidence: 85%
Risk/Reward: 1:2.5
```

### Example 3: Create Alerts
```
You: "Alert when ETH breaks $2,000"

AI Response:
✅ Alert Created!
Coin: ETHUSDT
Condition: Price ≥ $2,000
Notifications: Telegram + Email
Status: ACTIVE ✓

You'll be notified when triggered
```

### Example 4: Manage Watchlist
```
You: "Add top 5 gainers to watchlist"

AI Response:
✅ Added to watchlist:
• SOLUSDT (SOL) - +23.5%
• ADAUSDT (ADA) - +18.2%
• XRPUSDT (XRP) - +15.3%
• LINKUSDT (LINK) - +12.8%
• AVAXUSDT (AVAX) - +11.2%

Total watchlist items: 18
```

---

## 📊 Dashboard Features

### Multi-Chart Grid
- View 12 coins simultaneously
- 1-hour candles with volume
- Color-coded (green = up, red = down)
- Click for detailed analysis
- Real-time updates (<500ms)

### Screener Table
- Sort by 50+ criteria:
  - Price, volume, change %
  - Market cap, 24h high/low
  - RSI, MACD, Bollinger Bands
- Filter by conditions
- Export results
- Pagination

### Order Book Heatmap
- Buy orders (left, green)
- Sell orders (right, red)
- Volume intensity visualization
- Support/resistance levels
- Interactive zoom

### Alert Management
- Create price alerts
- Volume thresholds
- Technical indicator alerts
- Manage notifications
- Alert history

---

## 🔧 Troubleshooting

### Services Won't Start
```bash
# Check Docker daemon
docker ps

# View startup logs
docker-compose logs -f

# Restart everything
docker-compose restart

# Full reset
docker-compose down -v
docker-compose up -d
```

### Can't Access Dashboard
```bash
# Check if Go backend is running
curl http://localhost:3001/api/health

# Check if port 3000 is available
lsof -i :3000

# Check logs
docker-compose logs backend-go
```

### Database Connection Failed
```bash
# Check PostgreSQL
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready

# Reset database
docker volume rm scalpaiboard_postgres_data
docker-compose up -d postgres
```

### WebSocket Not Connecting
```bash
# Test in browser console
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.log('Error:', e);

# Check Nginx
docker-compose logs nginx
```

### AI Not Responding
```bash
# Check OpenAI API key in .env
cat .env | grep OPENAI

# Check C# service logs
docker-compose logs backend-csharp

# Verify API key is valid
# Try simple test: curl -H "Authorization: Bearer {KEY}" https://api.openai.com/v1/models
```

---

## 🔑 API Examples

### Get Coins List
```bash
curl "http://localhost:3001/api/coins?limit=10&page=1"

# Response:
{
  "data": [
    {
      "id": 1,
      "symbol": "BTCUSDT",
      "price": 65432.10,
      "volume24h": 1.2e9,
      "change24h": 5.2,
      "marketCap": 1.28e12,
      "high24h": 66000,
      "low24h": 64500
    }
  ],
  "total": 512,
  "page": 1,
  "pageSize": 10
}
```

### Get Candles
```bash
curl "http://localhost:3001/api/coins/BTCUSDT/candles?timeframe=1h&limit=50"

# Response:
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "candles": [
    {
      "time": 1703362800,
      "open": 65200.00,
      "high": 65800.00,
      "low": 65100.00,
      "close": 65500.00,
      "volume": 1200000
    }
  ]
}
```

### Create Alert
```bash
curl -X POST http://localhost:3001/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "coinId": 1,
    "conditionType": "price_above",
    "conditionValue": 65000,
    "notificationType": "telegram"
  }'

# Response:
{
  "id": 123,
  "coinId": 1,
  "condition": "price_above $65,000",
  "status": "active",
  "notifications": ["telegram"]
}
```

### Chat with AI
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find coins with >$100M volume",
    "conversationId": "conv-123"
  }'

# Response (streaming):
{
  "type": "content",
  "content": "Scanning 512 coins...\n\nFound 23 opportunities...",
  "conversationId": "conv-123"
}
```

---

## 📁 Project Structure

```
scalpaiboard/
├── backend-go/              # Go REST API + WebSocket
│   ├── cmd/server/
│   ├── internal/
│   │   ├── api/            # REST endpoints
│   │   ├── exchange/       # CCXT integration
│   │   ├── websocket/      # Real-time hub
│   │   ├── alert/          # Alert logic
│   │   ├── db/             # Database
│   │   ├── cache/          # Redis
│   │   ├── ai/             # AI router
│   │   └── logger/
│   ├── migrations/         # Database migrations
│   └── Dockerfile
│
├── backend-csharp/         # C# Alert Engine + GPT-4
│   ├── Services/
│   ├── Models/
│   ├── Data/
│   ├── BackgroundJobs/
│   ├── Controllers/
│   └── Dockerfile
│
├── frontend-react/         # React Dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/        # Zustand state
│   │   ├── api/           # API clients
│   │   └── pages/
│   ├── vite.config.ts
│   └── Dockerfile
│
├── docker-compose.yml      # Multi-service setup
├── .env.example            # Configuration template
└── README.md              # Main documentation
```

---

## 🧪 Testing Your Setup

### Test 1: Frontend Loads
```bash
# Open browser
http://localhost:3000

# You should see:
✓ Screener panel with coin table
✓ AI chat sidebar (right)
✓ Multi-chart grid
✓ Alert panel
```

### Test 2: API Working
```bash
# Test health
curl http://localhost:3001/api/health
# Response: {"status":"ok"}

# Test coins endpoint
curl http://localhost:3001/api/coins?limit=5
# Response: JSON array of coins
```

### Test 3: WebSocket Connected
```bash
# Open browser console (F12)
# Type:
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onopen = () => alert('Connected!');

# You should see: Connected! alert
```

### Test 4: AI Responding
```bash
# In chat sidebar, type:
"What is BTC current price?"

# AI should respond within 2-3 seconds
```

---

## 💡 Pro Tips

1. **Keep API keys secure** - Never commit .env to Git
2. **Monitor logs** - `docker-compose logs -f` while developing
3. **Use Postman** - Test API endpoints before integrating
4. **Test WebSocket** - Use browser DevTools Network tab
5. **Rate limiting** - APIs have rate limits (configured in .env)
6. **Backup database** - Regular backups of PostgreSQL
7. **Monitor performance** - Watch CPU/Memory in Docker Desktop

---

## 🚀 Next Steps

1. ✅ Dashboard loaded at localhost:3000
2. ✅ Try AI chat examples
3. ✅ Create a test alert
4. ✅ Add coins to watchlist
5. 📖 Read: **go_csharp_hybrid_plan.md** (architecture)
6. 📋 Follow: **SCALPBOARD_COMPLETE_ROADMAP.md** (8-week plan)

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| Docker not installed | See Prerequisites section |
| Port already in use | Change ports in docker-compose.yml |
| API not responding | Check logs: `docker-compose logs backend-go` |
| Database error | Reset: `docker volume rm scalpaiboard_postgres_data` |
| AI not working | Check OpenAI API key in .env |
| WebSocket failing | Check browser console for errors |

---

## ✨ You're Ready!

Scalpaiboard is now running on your machine.

**Dashboard**: http://localhost:3000  
**API**: http://localhost:3001  
**Chat**: Use the sidebar in dashboard  

Happy trading! 🚀

---

**Scalpaiboard - AI-Powered Cryptocurrency Intelligence**

*Last Updated: December 23, 2025*

