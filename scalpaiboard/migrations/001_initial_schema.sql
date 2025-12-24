-- Scalpaiboard Database Schema
-- PostgreSQL 17+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telegram_chat_id BIGINT UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coins/trading pairs
CREATE TABLE coins (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    exchange VARCHAR(20) NOT NULL DEFAULT 'binance',
    name VARCHAR(100),
    logo_url VARCHAR(255),
    decimals INT DEFAULT 8,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OHLCV candlestick data
CREATE TABLE candles (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins (id) ON DELETE CASCADE NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (coin_id, timeframe, timestamp)
);

-- User watchlists
CREATE TABLE watchlists (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users (id) ON DELETE CASCADE NOT NULL,
    coin_id INTEGER REFERENCES coins (id) ON DELETE CASCADE NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, coin_id)
);

-- Alerts
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users (id) ON DELETE CASCADE NOT NULL,
    coin_id INTEGER REFERENCES coins (id) ON DELETE CASCADE NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    condition_value DECIMAL(20, 8),
    notification_type VARCHAR(20) DEFAULT 'in_app',
    is_active BOOLEAN DEFAULT TRUE,
    triggered_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert trigger history
CREATE TABLE alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts (id) ON DELETE CASCADE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_status VARCHAR(20),
    notification_channel VARCHAR(20),
    error_message TEXT
);

-- AI providers (user-configurable)
CREATE TABLE ai_providers (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users (id) ON DELETE CASCADE NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    provider_type VARCHAR(20) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    api_endpoint VARCHAR(255),
    model_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    max_tokens INTEGER DEFAULT 2000,
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    rate_limit_rpm INTEGER DEFAULT 60,
    cost_per_1k_input_tokens DECIMAL(10, 8),
    cost_per_1k_output_tokens DECIMAL(10, 8),
    monthly_budget DECIMAL(10, 2),
    monthly_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, provider_name)
);

-- AI provider usage tracking
CREATE TABLE ai_provider_usage (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES ai_providers (id) ON DELETE CASCADE,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cost DECIMAL(10, 8),
    response_time_ms INTEGER,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI conversations
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES users (id) ON DELETE CASCADE NOT NULL,
    provider_id INTEGER REFERENCES ai_providers (id) ON DELETE SET NULL,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI messages within conversations
CREATE TABLE ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations (id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER,
    cost DECIMAL(10, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_candles_coin_tf_ts ON candles (
    coin_id,
    timeframe,
    timestamp DESC
);

CREATE INDEX idx_candles_timestamp ON candles (timestamp DESC);

CREATE INDEX idx_watchlists_user ON watchlists (user_id);

CREATE INDEX idx_alerts_user ON alerts (user_id);

CREATE INDEX idx_alerts_active ON alerts (is_active, coin_id);

CREATE INDEX idx_alert_history_alert ON alert_history (alert_id);

CREATE INDEX idx_alert_history_triggered ON alert_history (triggered_at DESC);

CREATE INDEX idx_ai_conversations_user ON ai_conversations (user_id);

CREATE INDEX idx_ai_messages_conversation ON ai_messages (conversation_id);

CREATE INDEX idx_ai_usage_provider ON ai_provider_usage (provider_id);

CREATE INDEX idx_ai_usage_date ON ai_provider_usage (created_at DESC);

CREATE INDEX idx_coins_symbol ON coins (symbol);

-- Insert sample coins (top 100 by market cap)
INSERT INTO
    coins (symbol, exchange, name)
VALUES (
        'BTCUSDT',
        'binance',
        'Bitcoin'
    ),
    (
        'ETHUSDT',
        'binance',
        'Ethereum'
    ),
    ('BNBUSDT', 'binance', 'BNB'),
    (
        'SOLUSDT',
        'binance',
        'Solana'
    ),
    ('XRPUSDT', 'binance', 'XRP'),
    (
        'ADAUSDT',
        'binance',
        'Cardano'
    ),
    (
        'DOGEUSDT',
        'binance',
        'Dogecoin'
    ),
    (
        'AVAXUSDT',
        'binance',
        'Avalanche'
    ),
    (
        'DOTUSDT',
        'binance',
        'Polkadot'
    ),
    (
        'LINKUSDT',
        'binance',
        'Chainlink'
    ),
    ('TRXUSDT', 'binance', 'TRON'),
    (
        'MATICUSDT',
        'binance',
        'Polygon'
    ),
    (
        'ATOMUSDT',
        'binance',
        'Cosmos'
    ),
    (
        'LTCUSDT',
        'binance',
        'Litecoin'
    ),
    (
        'NEARUSDT',
        'binance',
        'NEAR Protocol'
    ),
    (
        'UNIUSDT',
        'binance',
        'Uniswap'
    ),
    ('APTUSDT', 'binance', 'Aptos'),
    (
        'OPUSDT',
        'binance',
        'Optimism'
    ),
    (
        'ARBUSDT',
        'binance',
        'Arbitrum'
    ),
    (
        'FILUSDT',
        'binance',
        'Filecoin'
    ),
    (
        'VETUSDT',
        'binance',
        'VeChain'
    ),
    ('AAVEUSDT', 'binance', 'Aave'),
    (
        'ALGOUSDT',
        'binance',
        'Algorand'
    ),
    (
        'FTMUSDT',
        'binance',
        'Fantom'
    ),
    (
        'XLMUSDT',
        'binance',
        'Stellar'
    ),
    (
        'SANDUSDT',
        'binance',
        'The Sandbox'
    ),
    (
        'MANAUSDT',
        'binance',
        'Decentraland'
    ),
    (
        'AXSUSDT',
        'binance',
        'Axie Infinity'
    ),
    (
        'THETAUSDT',
        'binance',
        'Theta Network'
    ),
    ('EOSUSDT', 'binance', 'EOS'),
    ('XTZUSDT', 'binance', 'Tezos'),
    (
        'ICPUSDT',
        'binance',
        'Internet Computer'
    ),
    ('QNTUSDT', 'binance', 'Quant'),
    (
        'EGLDUSDT',
        'binance',
        'MultiversX'
    ),
    ('FLOWUSDT', 'binance', 'Flow'),
    (
        'IMXUSDT',
        'binance',
        'Immutable'
    ),
    (
        'CHZUSDT',
        'binance',
        'Chiliz'
    ),
    (
        'GRTUSDT',
        'binance',
        'The Graph'
    ),
    (
        'LDOUSDT',
        'binance',
        'Lido DAO'
    ),
    (
        'SNXUSDT',
        'binance',
        'Synthetix'
    ),
    ('MKRUSDT', 'binance', 'Maker'),
    (
        'RNDRUSDT',
        'binance',
        'Render'
    ),
    (
        'INJUSDT',
        'binance',
        'Injective'
    ),
    ('SUIUSDT', 'binance', 'Sui'),
    ('SEIUSDT', 'binance', 'Sei'),
    (
        'TIAUSDT',
        'binance',
        'Celestia'
    ),
    (
        'JUPUSDT',
        'binance',
        'Jupiter'
    ),
    (
        'WLDUSDT',
        'binance',
        'Worldcoin'
    ),
    (
        'FETUSDT',
        'binance',
        'Fetch.ai'
    ),
    (
        'AGIXUSDT',
        'binance',
        'SingularityNET'
    );

-- Create default demo user
INSERT INTO
    users (
        id,
        email,
        username,
        password_hash
    )
VALUES (
        '00000000-0000-0000-0000-000000000001',
        'demo@scalpaiboard.com',
        'demo',
        '$2a$10$demopasswordhashhere'
    );