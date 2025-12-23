# ⚡ Scalpaiboard Quick Reference Guide

> **Daily Development Cheat Sheet & Fast Lookup**

---

## 🚀 Quick Start

```bash
# Clone & setup (5 minutes)
git clone https://github.com/yourusername/scalpaiboard.git
cd scalpaiboard

# Configure
cp .env.example .env
# Edit .env with your API keys

# Launch
docker-compose up -d

# Access
# Dashboard: http://localhost:3000
# API: http://localhost:3001/api/docs
# Health: http://localhost:3001/api/health
```

---

## 📁 Project Structure at a Glance

```
scalpaiboard/
├── backend-go/          → REST API + WebSocket (Port 3001, 50051)
├── backend-csharp/      → Alert Engine + AI Brain (Port 3002, 50052)
├── frontend-react/      → Dashboard (Port 3000)
├── nginx/              → Reverse proxy (Port 80, 443)
├── docker-compose.yml   → Multi-service orchestration
└── migrations/          → Database schema
```

---

## 🔌 API Endpoints Quick Reference

### Health & Status
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Server health check |
| GET | `/api/version` | API version |
| GET | `/api/status` | System status |

### Coins & Market Data
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/coins` | List all coins (paginated) |
| GET | `/api/coins/:symbol` | Single coin data |
| GET | `/api/coins/:symbol/candles` | OHLCV data (1m-1d) |
| GET | `/api/coins/:symbol/orderbook` | Order book snapshot |
| GET | `/api/coins/:symbol/trades` | Recent trades |

### Watchlist
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/watchlist` | Get user watchlist |
| POST | `/api/watchlist` | Add coin to watchlist |
| DELETE | `/api/watchlist/:coinId` | Remove from watchlist |

### Alerts
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/alerts` | Get user alerts |
| POST | `/api/alerts` | Create new alert |
| PUT | `/api/alerts/:id` | Update alert |
| DELETE | `/api/alerts/:id` | Delete alert |
| GET | `/api/alerts/:id/history` | Alert trigger history |

### AI Chat
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/chat` | Send message (streaming) |
| GET | `/api/ai/conversations` | List conversations |
| GET | `/api/ai/conversations/:id` | Get conversation |
| DELETE | `/api/ai/conversations/:id` | Delete conversation |

### WebSocket
| Endpoint | Purpose |
|----------|---------|
| `ws://localhost:3001/ws` | Real-time market data |

---

## 💬 API Call Examples

### Get Top 10 Coins by Volume
```bash
curl "http://localhost:3001/api/coins?limit=10&sortBy=volume24h&sortOrder=desc"

# Response:
{
  "data": [
    {
      "id": 1,
      "symbol": "BTCUSDT",
      "price": 65432.10,
      "volume24h": 1200000000,
      "change24h": 5.2
    }
  ],
  "total": 512,
  "page": 1
}
```

### Create Price Alert
```bash
curl -X POST http://localhost:3001/api/alerts \
  -H "Authorization: Bearer {TOKEN}" \
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
  "condition": "price >= 65000",
  "status": "active"
}
```

### Chat with AI (Streaming)
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find coins with >$100M volume",
    "conversationId": "conv-123"
  }'

# Response (Server-Sent Events):
data: {"type": "content", "content": "Scanning..."}
data: {"type": "content", "content": "Found 23 coins..."}
```

---

## 🗄️ Database Quick Reference

### Key Tables
| Table | Purpose |
|-------|---------|
| `coins` | Cryptocurrency metadata |
| `candles` | OHLCV data (all timeframes) |
| `users` | User accounts |
| `alerts` | User alert definitions |
| `watchlists` | User watchlist items |
| `ai_conversations` | Chat conversation history |
| `alert_history` | Alert trigger records |

### Common Queries

#### Find coins with high volume
```sql
SELECT symbol, price, volume24h, change24h 
FROM coins 
WHERE volume24h > 100000000 
ORDER BY volume24h DESC 
LIMIT 10;
```

#### Get candles for chart
```sql
SELECT time, open, high, low, close, volume 
FROM candles 
WHERE coin_id = 1 AND timeframe = '1h' 
ORDER BY time DESC 
LIMIT 50;
```

#### Check active alerts for a user
```sql
SELECT a.id, c.symbol, a.condition_type, a.condition_value 
FROM alerts a 
JOIN coins c ON a.coin_id = c.id 
WHERE a.user_id = 'user-123' AND a.is_active = true;
```

#### Trigger history
```sql
SELECT a.id, c.symbol, ah.triggered_at 
FROM alert_history ah 
JOIN alerts a ON ah.alert_id = a.id 
JOIN coins c ON a.coin_id = c.id 
WHERE a.user_id = 'user-123' 
ORDER BY ah.triggered_at DESC 
LIMIT 20;
```

---

## 🔑 Environment Variables

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=scalpaiboard
DB_USER=scalpaiboard
DB_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://redis:6379

# APIs
BINANCE_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret
OPENAI_API_KEY=sk-your_openai_key
TELEGRAM_BOT_TOKEN=your_telegram_token

# Application
LOG_LEVEL=info
RATE_LIMIT=100/hour
JWT_SECRET=your_jwt_secret
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# gRPC
GRPC_SERVER_ADDR=backend-csharp:50052
```

---

## 🐛 Common Debugging

### Services Won't Start
```bash
# Check logs
docker-compose logs -f

# Check specific service
docker-compose logs backend-go

# View container status
docker ps

# Restart services
docker-compose restart

# Full reset
docker-compose down -v
docker-compose up -d
```

### API Not Responding
```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Check if port is in use
lsof -i :3001

# Test from inside container
docker exec scalpaiboard_backend-go-1 curl localhost:3001/api/health
```

### WebSocket Not Connecting
```bash
# Test in browser console
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.log('Error:', e);

# Check Nginx config
docker exec scalpaiboard_nginx-1 nginx -t
```

### Database Connection Issues
```bash
# Check PostgreSQL health
docker-compose exec postgres pg_isready

# Test connection
docker exec scalpaiboard_postgres-1 psql -U scalpaiboard -d scalpaiboard -c "SELECT 1;"

# Check Redis
docker-compose exec redis redis-cli ping
```

### AI Not Responding
```bash
# Check OpenAI API key
echo $OPENAI_API_KEY

# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check C# service logs
docker-compose logs backend-csharp
```

---

## 📊 Performance Commands

### Monitor System
```bash
# Docker stats
docker stats

# Go memory profiling
go tool pprof http://localhost:6060/debug/pprof/heap

# Database connections
psql -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Redis memory
redis-cli INFO memory
```

### Load Testing
```bash
# API load test (1000 requests, 100 concurrent)
ab -n 1000 -c 100 http://localhost:3001/api/coins

# WebSocket load test
# Use wscat or custom script

# Database load test
# Insert 50,000 rows, measure time
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database backups created
- [ ] SSL/TLS certificates ready
- [ ] Monitoring alerts configured
- [ ] Runbooks reviewed
- [ ] Team notified

### Deployment
- [ ] Build Docker images
- [ ] Push to registry
- [ ] Update Kubernetes/ECS manifests
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor metrics

### Post-Deployment
- [ ] Verify all services healthy
- [ ] Check API endpoints
- [ ] Test WebSocket connections
- [ ] Verify AI responses
- [ ] Monitor error rates
- [ ] Notify users
- [ ] Document changes

---

## 🎯 AI Tools Quick Reference

### 1. filter_coins
Find coins by criteria
```
User: "Find coins with >$100M volume and >5% change"
AI: Scans all coins, returns top matches with analysis
```

### 2. get_coin_analysis
Technical analysis on any coin
```
User: "Analyze BTC on 1h"
AI: RSI, MACD, Bollinger Bands, support/resistance
```

### 3. create_alert
Set up price/technical alerts
```
User: "Alert when ETH breaks $2,000"
AI: Creates alert, enables notifications
```

### 4. add_to_watchlist
Manage watchlist
```
User: "Add top 5 gainers to watchlist"
AI: Adds coins, confirms addition
```

### 5. analyze_pattern
Pattern recognition (ML-powered)
```
User: "What patterns on DOGE?"
AI: Detects bullish flags, head & shoulders, etc
```

### 6. export_results
Export data
```
User: "Export my watchlist as CSV"
AI: Generates file, provides download
```

### 7. get_portfolio
Portfolio overview
```
User: "Show my watchlist"
AI: Lists coins, performance, alerts
```

---

## 📈 Key Metrics to Monitor

```
API Performance:
- Response time: Target <200ms (95th %ile)
- Throughput: Target 100+ req/sec
- Error rate: Target <0.1%

WebSocket:
- Latency: Target <500ms
- Concurrent connections: Target 1000+
- Message throughput: Target 10,000/sec

Database:
- Query time: Target <100ms (95th %ile)
- Connection pool: Target <40/50
- Disk usage: Alert at 80%+

Application:
- Memory usage: Target <300MB
- CPU usage: Target <60%
- GC pauses: Target <100ms

AI:
- Response time: 2-5 seconds
- Tool success rate: >98%
- Token usage: <2000 per message

Alerts:
- Evaluation time: <100ms per coin
- Notification delivery: <5 seconds
- Accuracy: 100%
```

---

## 🔐 Security Checklist

```
Authentication:
- [ ] JWT tokens configured
- [ ] Token expiration set (24h)
- [ ] Refresh tokens implemented
- [ ] API key protection

API Security:
- [ ] CORS properly configured
- [ ] Rate limiting enabled (100 req/hour)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (ORM)

Infrastructure:
- [ ] HTTPS/TLS enabled
- [ ] Certificate renewal automated
- [ ] Firewall rules configured
- [ ] DDoS protection enabled

Database:
- [ ] Encryption at rest enabled
- [ ] Backups tested & automated
- [ ] Access logs enabled
- [ ] User permissions scoped

Data Privacy:
- [ ] API keys not logged
- [ ] User data encrypted
- [ ] Audit logging enabled
- [ ] GDPR compliance (if EU)

Secrets Management:
- [ ] API keys in env vars (not code)
- [ ] Rotate keys regularly
- [ ] Use HashiCorp Vault (production)
- [ ] Restrict secret access
```

---

## 📚 Documentation Links

| Document | Purpose |
|----------|---------|
| README.md | Project overview |
| QUICK_START.md | 5-minute setup |
| go_csharp_hybrid_plan.md | Technical architecture |
| ai_assistant_comprehensive.md | AI integration guide |
| COMPLETE_ROADMAP.md | 8-week implementation |
| QUICK_REFERENCE.md | This file |

---

## 🆘 Support & Help

### Getting Help
1. Check QUICK_START.md for setup issues
2. Review go_csharp_hybrid_plan.md for architecture questions
3. See ai_assistant_comprehensive.md for AI questions
4. Check logs: `docker-compose logs -f`
5. Review error message in runbooks

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port already in use | Change ports in docker-compose.yml |
| Docker not installed | Install Docker Desktop |
| API not responding | Check backend logs: `docker-compose logs backend-go` |
| Database connection error | Check PostgreSQL: `docker-compose logs postgres` |
| WebSocket not connecting | Check browser console for errors |
| AI not responding | Verify OpenAI API key in .env |
| Alerts not triggering | Check C# service: `docker-compose logs backend-csharp` |
| Memory usage high | Check for memory leaks: `docker stats` |

---

## 🎓 Learning Resources

### Go Backend
- Echo/Gin framework docs
- GORM ORM documentation
- WebSocket best practices
- gRPC service definitions

### C# Backend
- .NET 8 documentation
- Entity Framework Core
- Hangfire job scheduling
- SignalR for real-time

### React Frontend
- React 18 hooks
- TradingView Lightweight Charts
- AG-Grid data table
- Zustand state management

### DevOps
- Docker & Docker Compose
- Kubernetes deployment
- CI/CD pipelines
- Monitoring with Prometheus

---

## 📞 Quick Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a service
docker-compose restart backend-go

# View logs
docker-compose logs -f backend-go

# Connect to database
docker-compose exec postgres psql -U scalpaiboard

# Connect to Redis
docker-compose exec redis redis-cli

# Run database migrations
docker-compose exec backend-go migrate -path migrations -database "..." up

# Health check
curl http://localhost:3001/api/health

# API documentation
http://localhost:3001/api/docs

# Swagger UI
http://localhost:3001/swagger/index.html

# Hangfire dashboard
http://localhost:3002/hangfire

# View container stats
docker stats

# Update dependencies (Go)
cd backend-go && go get -u ./...

# Update dependencies (React)
cd frontend-react && npm update
```

---

## ✨ Pro Tips

1. **Keep logs open** while developing
   ```bash
   docker-compose logs -f
   ```

2. **Use browser DevTools** for frontend debugging
   - Network tab for API calls
   - Console for WebSocket issues
   - Performance tab for rendering

3. **Profile your code**
   - Use pprof for Go
   - Use dotnet profiler for C#
   - Use Chrome DevTools for React

4. **Test early, test often**
   - Unit tests first
   - Integration tests next
   - Load tests before production

5. **Monitor production closely**
   - Set up alerts for all critical metrics
   - Have runbooks for common issues
   - Respond to alerts immediately

6. **Document everything**
   - Architecture decisions
   - API changes
   - Deployment procedures
   - Troubleshooting steps

---

**Scalpaiboard - Professional Cryptocurrency Intelligence Platform**

*Last Updated: December 23, 2025*

Questions? Check the documentation files or review the runbooks! 🚀

