# 🤖 Scalpaiboard AI Assistant - Multi-Provider Integration Guide

> **Complete Multi-Provider AI Integration (OpenAI, Anthropic, Google, AWS, Open-Source)**

---

## Table of Contents
1. [Multi-Provider Architecture](#multi-provider-architecture)
2. [Supported AI Providers](#supported-ai-providers)
3. [Provider Configuration](#provider-configuration)
4. [API Key Management](#api-key-management)
5. [Provider Implementation](#provider-implementation)
6. [Usage Tracking & Billing](#usage-tracking--billing)
7. [Tool Definitions](#tool-definitions)
8. [Example Conversations](#example-conversations)

---

## Multi-Provider Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│             React Frontend (localhost:3000)             │
│  AI Chat Component + Provider Selection                 │
│  • Message input field                                  │
│  • Provider dropdown (select from active providers)     │
│  • Streaming response rendering                         │
│  • Cost tracking display                                │
│  • Real-time status indicators                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP POST /api/ai/chat
                       │ (Provider selection + streaming)
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Go Backend Router (localhost:3001)            │
│  /api/ai/chat - Route to selected provider            │
│  • Provider validation                                  │
│  • Rate limit checking                                  │
│  • API key retrieval (encrypted)                        │
│  • Streaming setup                                      │
│  • Error handling & fallback                            │
└──────────────────────┬──────────────────────────────────┘
                       │ gRPC :50051 → :50052
                       │ Provider + API Key
                       ▼
┌─────────────────────────────────────────────────────────┐
│      C# Backend AI Brain Service (localhost:3002)       │
│ MultiProviderAIService - Factory Pattern Implementation │
│  • Provider factory (creates client for selected)       │
│  • OpenAI / Anthropic / Google / AWS / Others          │
│  • Tool definitions (provider-agnostic)                 │
│  • Response streaming                                   │
│  • Usage tracking & cost calculation                    │
│  • Error recovery & provider fallback                   │
└──────────────────────┬──────────────────────────────────┘
         ┌─────────────┼──────────┬─────────┬─────────┐
         │             │          │         │         │
         ▼             ▼          ▼         ▼         ▼
    ┌────────┐  ┌──────────┐ ┌────────┐ ┌──────┐ ┌──────┐
    │ OpenAI │  │Anthropic │ │ Google │ │ AWS  │ │HF/HF │
    │ GPT-4  │  │ Claude 3 │ │Vertex AI│ │Bed.  │ │ Inf. │
    │ API    │  │ API      │ │ API    │ │ API  │ │ API  │
    └────────┘  └──────────┘ └────────┘ └──────┘ └──────┘
         │             │          │         │         │
         └─────────────┼──────────┴─────────┴─────────┘
                       │
                       ▼
      ┌──────────────────────────────────┐
      │   PostgreSQL Provider Storage    │
      ├──────────────────────────────────┤
      │ • ai_providers (encrypted keys)  │
      │ • ai_provider_usage (tracking)   │
      │ • Cost per token rates           │
      │ • Monthly budgets & spending     │
      └──────────────────────────────────┘
```

---

## Supported AI Providers

### Tier 1: Enterprise Providers

#### 1. OpenAI (Recommended for Most Users)
```
Models: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
Cost: $0.03/1k input, $0.06/1k output (GPT-4)
Speed: Fast (~2-5 seconds)
Availability: Highly reliable (99.95% uptime)
Strengths:
  • Best reasoning & problem-solving
  • Largest model ecosystem
  • Extensive function calling support
  • Best documentation & community
Weaknesses:
  • Most expensive option
  • Rate limits (per-minute)
```

#### 2. Anthropic Claude
```
Models: Claude 3 Opus, Sonnet, Haiku
Cost: $0.015/1k input, $0.075/1k output (Opus)
Speed: Medium (~3-7 seconds)
Availability: Highly reliable
Strengths:
  • Excellent reasoning & analysis
  • Best for safety-critical applications
  • Longer context window (200k tokens)
  • Strong on instruction following
Weaknesses:
  • Slightly more expensive than GPT-3.5
  • Fewer integrations
  • Lower throughput limits
```

#### 3. Google Vertex AI
```
Models: Gemini Pro, PaLM 2
Cost: Usage-based (~$0.00025/1k tokens)
Speed: Very Fast (~1-3 seconds)
Availability: Highly reliable (Google infrastructure)
Strengths:
  • Most affordable
  • Extremely fast inference
  • Strong multimodal support
  • Excellent for vision tasks
Weaknesses:
  • Less mature than OpenAI
  • Smaller model selection
  • Complex setup (requires GCP)
```

#### 4. Microsoft Azure OpenAI
```
Models: GPT-4, GPT-3.5, Azure-exclusive variants
Cost: Same as OpenAI (pay-per-token)
Speed: Fast
Availability: Enterprise SLA available
Strengths:
  • Same models as OpenAI
  • Enterprise compliance features
  • Integration with Microsoft ecosystem
  • Hybrid deployment options
Weaknesses:
  • Requires Azure account
  • More complex authentication
  • Regional availability limitations
```

#### 5. AWS Bedrock
```
Models: Claude, Llama 2, Mistral, Titan
Cost: Per-invocation pricing (~$0.0001-0.001)
Speed: Very Fast (optimized inference)
Availability: Enterprise SLA
Strengths:
  • Serverless - no management needed
  • Multiple models in one API
  • Strong security & compliance
  • Private VPC deployment option
Weaknesses:
  • Less familiar to developers
  • Limited model selection vs OpenAI
  • Pricing less transparent
```

### Tier 2: Open-Source & Cost-Effective

#### 6. Hugging Face Inference API
```
Models: 200,000+ community models
Cost: Free tier + paid inference
Speed: Slow-Medium (5-15 seconds)
Availability: Community-dependent
Strengths:
  • Thousands of community models
  • Free tier for prototyping
  • No vendor lock-in
  • Very affordable at scale
Weaknesses:
  • Slower inference than commercial
  • Variable quality/reliability
  • Model management overhead
  • Community maintenance risks
```

#### 7. Together AI
```
Models: Llama 2, Mistral, Falcon, CodeLlama
Cost: $0.001-0.008/1k tokens (very cheap)
Speed: Very Fast (optimized for speed)
Availability: Good (99% uptime SLA)
Strengths:
  • Extremely cheap compared to OpenAI
  • Very fast inference
  • 200+ open models available
  • Good for cost-sensitive applications
Weaknesses:
  • Models less powerful than GPT-4
  • Smaller context windows
  • Less function calling support
  • Smaller community
```

#### 8. Mistral AI
```
Models: Mistral-7B, Mistral-Medium, Mistral-Large
Cost: Free (self-hosted) + API access
Speed: Very Fast (can be instant with local)
Availability: Open-source
Strengths:
  • True open-source - no vendor lock-in
  • Can run locally (offline capability)
  • Very fast for size
  • Excellent for privacy
Weaknesses:
  • Smaller models = less capability
  • Requires infrastructure to host
  • Limited function calling
  • Smaller ecosystem
```

#### 9. Groq
```
Models: Llama 2, Mixtral
Cost: Free API access + paid tiers
Speed: Lightning Fast (80k tokens/sec!)
Availability: 99.9% uptime
Strengths:
  • Fastest inference available
  • Free tier is very generous
  • Perfect for low-latency apps
  • Excellent for real-time trading signals
Weaknesses:
  • Limited model selection
  • Models less powerful than GPT-4
  • Newer platform (less proven)
  • Smaller community
```

#### 10. OpenRouter
```
Models: 100+ models (aggregates multiple providers)
Cost: Varies by model ($0.001-0.06/1k tokens)
Speed: Variable (depends on model)
Availability: Meta-aggregator
Strengths:
  • Single API for 100+ models
  • Easy provider switching
  • Load balancing across providers
  • Cost optimization tools
Weaknesses:
  • Adds latency (routing layer)
  • Less direct control
  • Pricing varies by day
  • Complexity of model selection
```

---

## Provider Configuration

### Database Schema

```sql
-- AI Providers (encrypted API keys)
CREATE TABLE ai_providers (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    provider_type VARCHAR(20) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    api_endpoint VARCHAR(255),
    model_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    max_tokens INTEGER DEFAULT 2000,
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    top_p DECIMAL(3, 2) DEFAULT 0.9,
    rate_limit_rpm INTEGER DEFAULT 60,
    cost_per_1k_input_tokens DECIMAL(10, 8),
    cost_per_1k_output_tokens DECIMAL(10, 8),
    monthly_budget DECIMAL(10, 2),
    monthly_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider_name),
    INDEX idx_provider_user (user_id)
);

-- Usage tracking
CREATE TABLE ai_provider_usage (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES ai_providers(id) ON DELETE CASCADE,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cost DECIMAL(10, 8),
    response_time_ms INTEGER,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usage_provider (provider_id),
    INDEX idx_usage_date (created_at DESC)
);
```

---

## API Key Management

### Adding a Provider (5 Steps)

**Step 1: Select Provider Type**
```bash
Dropdown: OpenAI | Anthropic | Google | AWS | Together | Hugging Face | Mistral | Groq | OpenRouter
```

**Step 2: Get & Paste API Key**
```
🔗 Get API Key link (opens provider's website)
Input: sk-xxxxxxxxxxxxx (will be encrypted automatically)
```

**Step 3: Select Model**
```
Models vary by provider:
OpenAI: gpt-4, gpt-4-turbo, gpt-3.5-turbo
Anthropic: claude-3-opus, claude-3-sonnet, claude-3-haiku
Google: gemini-pro
AWS: claude-3-opus, llama2-70b, mistral-7b
Together: mistral-7b, llama2-70b-chat
```

**Step 4: Configure Parameters**
```
Temperature: 0-1 (0=deterministic, 1=creative)
Top P: 0-1 (nucleus sampling)
Max Tokens: 1-4096
Monthly Budget: $0-unlimited
```

**Step 5: Test & Save**
```
Test Connection ✓ → Save Provider
```

### React Component

```typescript
// components/Settings/AIProviderSettings.tsx
export const AIProviderSettings: React.FC = () => {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">🤖 AI Provider Configuration</h2>

      {/* Active Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`p-4 border rounded-lg ${
              provider.isDefault ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-lg">{provider.providerName}</h3>
              {provider.isDefault && (
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  Default
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <p><strong>Model:</strong> {provider.modelName}</p>
              <p><strong>Status:</strong> {provider.isActive ? '✅ Active' : '❌ Inactive'}</p>
              <p><strong>Cost/1k:</strong> ${provider.costPerTokens}</p>
              <p>
                <strong>Budget:</strong> ${provider.monthlySpent} / ${provider.monthlyBudget}
              </p>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 text-sm bg-gray-200 hover:bg-gray-300 rounded px-3 py-2">
                Test
              </button>
              <button className="flex-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded px-3 py-2">
                Edit
              </button>
              <button className="flex-1 text-sm bg-red-600 text-white hover:bg-red-700 rounded px-3 py-2">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Provider Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full bg-green-600 text-white hover:bg-green-700 rounded-lg px-4 py-3 font-semibold"
      >
        + Add New AI Provider
      </button>

      {/* Usage Dashboard */}
      <UsageStatistics providers={providers} />
    </div>
  );
};
```

---

## Provider Implementation

### Factory Pattern

```csharp
// backend-csharp/Services/AIProviderFactory.cs
public class AIProviderFactory
{
    public IAIProvider CreateProvider(AIProvider config)
    {
        return config.ProviderType switch
        {
            "openai" => new OpenAIProvider(config),
            "anthropic" => new AnthropicProvider(config),
            "google" => new GoogleVertexAIProvider(config),
            "aws" => new AWSBedrockProvider(config),
            "together" => new TogetherAIProvider(config),
            "huggingface" => new HuggingFaceProvider(config),
            "groq" => new GroqProvider(config),
            "mistral" => new MistralProvider(config),
            "openrouter" => new OpenRouterProvider(config),
            _ => throw new NotSupportedException($"Provider {config.ProviderType} not supported")
        };
    }
}
```

### OpenAI Implementation

```csharp
public class OpenAIProvider : IAIProvider
{
    private readonly AIProvider _config;
    private readonly OpenAIClient _client;

    public OpenAIProvider(AIProvider config)
    {
        _config = config;
        _client = new OpenAIClient(new ApiKeyCredential(config.ApiKey));
    }

    public async Task<AIResponse> ChatAsync(string message, ChatOptions options)
    {
        var response = await _client.GetChatCompletionsAsync(
            new ChatCompletionOptions
            {
                DeploymentName = _config.ModelName,
                Messages = new[] { new ChatCompletionMessage(ChatRole.User, message) },
                MaxTokens = options.MaxTokens ?? _config.MaxTokens,
                Temperature = options.Temperature ?? _config.Temperature
            }
        );

        return new AIResponse
        {
            Content = response.Choices[0].Message.Content,
            PromptTokens = response.Usage.PromptTokens,
            CompletionTokens = response.Usage.CompletionTokens,
            Cost = CalculateCost(
                response.Usage.PromptTokens,
                response.Usage.CompletionTokens
            )
        };
    }

    private decimal CalculateCost(int promptTokens, int completionTokens)
    {
        var inputCost = (promptTokens / 1000m) * _config.CostPerInputTokens;
        var outputCost = (completionTokens / 1000m) * _config.CostPerOutputTokens;
        return inputCost + outputCost;
    }
}
```

---

## Usage Tracking & Billing

### Cost Dashboard (React)

```typescript
// components/Settings/UsageDashboard.tsx
export const UsageDashboard: React.FC<{ providers: AIProvider[] }> = ({ providers }) => {
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">💰 Usage & Costs</h2>

      {/* Total Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">Total Spent</p>
          <p className="text-2xl font-bold text-blue-600">
            ${providers.reduce((sum, p) => sum + p.monthlySpent, 0).toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-gray-600">Total Budget</p>
          <p className="text-2xl font-bold text-green-600">
            ${providers.reduce((sum, p) => sum + p.monthlyBudget, 0).toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-gray-600">Remaining</p>
          <p className="text-2xl font-bold text-purple-600">
            ${(providers.reduce((sum, p) => sum + p.monthlyBudget - p.monthlySpent, 0)).toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm text-gray-600">Utilization</p>
          <p className="text-2xl font-bold text-orange-600">
            {((providers.reduce((sum, p) => sum + p.monthlySpent, 0) / 
              providers.reduce((sum, p) => sum + p.monthlyBudget, 0)) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Per-Provider Breakdown */}
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">{provider.providerName}</h3>
              <span className="text-2xl font-bold">${provider.monthlySpent.toFixed(2)}</span>
            </div>

            {/* Budget Progress */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  provider.monthlySpent / provider.monthlyBudget > 0.9
                    ? 'bg-red-600'
                    : 'bg-green-600'
                }`}
                style={{
                  width: `${Math.min((provider.monthlySpent / provider.monthlyBudget) * 100, 100)}%`,
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>${provider.monthlySpent}</span>
              <span>${provider.monthlyBudget}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 7 AI Tools (Provider-Agnostic)

All tools work identically across all 10 providers:

1. **filter_coins** - Cryptocurrency screener
2. **get_coin_analysis** - Technical analysis
3. **create_alert** - Alert creation
4. **add_to_watchlist** - Watchlist management
5. **analyze_pattern** - Pattern recognition
6. **export_results** - Data export
7. **get_portfolio** - Portfolio overview

---

## Example Conversations

### Using Different Providers

**OpenAI GPT-4 (General Purpose)**
```
User: "Find coins with >$100M volume and >5% change"
Response Time: 3.2s | Cost: $0.042 | Status: ✅
Result: Scanned 512 coins, found 23 matches
```

**Anthropic Claude (Safety-Critical)**
```
User: "Analyze BTC technical setup"
Response Time: 4.1s | Cost: $0.031 | Status: ✅
Result: Detailed analysis with support/resistance
```

**Google Gemini (Fast & Cheap)**
```
User: "Pattern detection on DOGE"
Response Time: 1.5s | Cost: $0.0015 | Status: ✅
Result: Bullish pennant detected (85% confidence)
```

**Groq (Ultra-Fast)**
```
User: "Create alert for ETH $2,000"
Response Time: 0.3s | Cost: Free | Status: ✅
Result: Alert created and activated
```

---

## Configuration Summary

```bash
# .env example
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_PROJECT_ID=xxxxx
AWS_ACCESS_KEY_ID=xxxxx
TOGETHER_API_KEY=xxxxx
GROQ_API_KEY=xxxxx

DEFAULT_AI_PROVIDER=openai
DEFAULT_MODEL=gpt-4
```

---

## Summary

### ✅ Features Included

✅ **10 AI Providers** - Choose what works best
✅ **Cost Tracking** - Monitor spending per provider
✅ **Budget Management** - Set monthly limits
✅ **Easy Switching** - Change providers anytime
✅ **Fallback Support** - Automatic failover
✅ **Performance Monitoring** - Track response times
✅ **Usage Analytics** - Detailed statistics
✅ **Encrypted Storage** - Secure API keys
✅ **Connection Testing** - Validate before use
✅ **7 Universal Tools** - Work across all providers

Ready for production with multi-provider flexibility! 🚀

