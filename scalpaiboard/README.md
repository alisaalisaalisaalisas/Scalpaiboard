# Scalpaiboard

Professional Cryptocurrency Intelligence Platform with AI Trading Assistant.

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start all services
docker-compose up -d

# 3. Open dashboard
# http://localhost:3000
```

## Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand
- **Go Backend**: REST API + WebSocket (Port 3001)
- **C# Backend**: Alert Engine + AI (Port 3002)
- **Database**: PostgreSQL 17 + Redis 7

## Features

- Real-time market data from Binance/Bybit (no API keys needed)
- Multi-chart dashboard with TradingView Lightweight Charts
- Smart alerts with Telegram/Email notifications
- AI Assistant with 10 provider support (user-configurable)
- Technical analysis (RSI, MACD, Bollinger Bands)
- Pattern recognition
