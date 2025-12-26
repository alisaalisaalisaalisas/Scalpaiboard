# 📊 Scalpaiboard - Professional AI-Powered Cryptocurrency Screener

![alt text](Screenshot_1.png)

## 🎯 Project Overview

**Scalpaiboard** is a professional-grade cryptocurrency screener platform combining real-time market data analysis with an advanced multi-provider AI trading assistant.

### What It Does
- **Real-time Multi-Chart Dashboard**: Monitor multiple cryptocurrency pairs simultaneously
- **Advanced Screener**: Filter coins using technical criteria
- **Order Book Heatmap**: Visualize buy/sell pressure in real-time
- **Automated Alerts**: Price, volume, and technical indicator alerts
- **AI Trading Assistant**: Natural language interface supporting 10+ AI providers for market analysis

---

## 🏗️ Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│           Frontend (Vite 5 + React 18 + TailwindCSS)        │
│       Dashboard + AI Chat | Responsive Design               │
└──────────────────────┬──────────────────────────────────────┘
                       │
              NGINX Reverse Proxy (80/443)
                       │
              ┌────────▼────────┐
              │   Go Backend    │
              │   Port: 3001    │
              │                 │
              │ • REST API      │
              │ • WebSocket     │
              │ • AI Chat (10+  │
              │   providers)    │
              │ • Alert Cron    │
              │ • Exchange Data │
              └────────┬────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   ┌───▼──┐      ┌─────▼─────┐   ┌─────▼────┐
   │Redis │      │PostgreSQL │   │ Exchange │
   │Cache │      │ Database  │   │   APIs   │
   └──────┘      └───────────┘   └──────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Vite 5 + React 18 + TypeScript + TailwindCSS | Interactive dashboard |
| **Charts** | lightweight-charts | TradingView-style charts |
| **State** | Zustand | Client state management |
| **Backend** | Go 1.24 + Gin | REST API + WebSocket + AI Chat + Alert Cron |
| **AI Chat** | Multi-provider (10+ APIs) | OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral, Groq, etc. |
| **Scheduler** | robfig/cron | Background alert evaluation |
| **Database** | PostgreSQL 17 | Data persistence |
| **Cache** | Redis 7 | Real-time caching |
| **Deployment** | Docker Compose | Containerization |

---

## 🚀 Features

### Screener Platform
- ✅ Real-time multi-chart display
- ✅ Advanced filtering by technical criteria
- ✅ Order book heatmap visualization
- ✅ Technical indicators (RSI, MACD, Bollinger Bands)
- ✅ Watchlist management
- ✅ Price/volume alerts
- ✅ Mobile responsive

### AI Trading Assistant
Supports **10+ AI Providers** with BYOK (Bring Your Own Key):
- **OpenAI**: GPT-5.2, GPT-4o, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic**: Claude Opus 4.5, Claude Sonnet 4.5, Claude 3 family
- **Google**: Gemini 3 Pro, Gemini 2.5 Pro/Flash
- **xAI**: Grok 4.1, Grok 2
- **DeepSeek**: V3.2, V3-0324, Coder
- **Mistral**: Devstral 2, Large, Medium, Codestral
- **Groq**: Llama 3.3-70B, Mixtral (fast inference)
- **Together AI**: Llama, Mixtral, Qwen models
- **OpenRouter**: Aggregator for 100+ models
- **Xiaomi**: Mimo-v2-flash
- **Kwaipilot**: Kat-coder-pro

### Real-Time Features
- ✅ WebSocket streaming
- ✅ Live price updates
- ✅ Order book snapshots
- ✅ Alert notifications (Telegram, Email, In-app)
- ✅ AI streaming responses

---

## 📊 Project Structure

```
scalpaiboard/
├── frontend-react/     # Vite + React + TailwindCSS
├── backend-go/         # Go + Gin (REST API, WebSocket, AI, Alerts)
├── migrations/         # Database migrations
├── nginx/              # Reverse proxy config
└── docker-compose.yml  # Container orchestration
```

## 🔐 Security Features

✅ JWT Authentication  
✅ CORS Protection  
✅ Rate Limiting  
✅ Input Validation  
✅ SQL Injection Prevention (ORM)  

## 🎓 Use Cases

**For Day Traders**
- Identify momentum coins in real-time
- Set automated alerts for entry/exit points
- Analyze multiple timeframes simultaneously

**For Technical Analysts**
- Advanced filtering by technical criteria
- Order book pressure analysis
- AI-powered pattern recognition

**For Portfolio Managers**
- Monitor holdings across exchanges
- Automated rebalancing alerts
- Market condition analysis

## 📄 License

MIT License - Free for personal & commercial use

---

**Scalpaiboard - AI-Powered Cryptocurrency Intelligence Platform**

*Version: 1.0*

