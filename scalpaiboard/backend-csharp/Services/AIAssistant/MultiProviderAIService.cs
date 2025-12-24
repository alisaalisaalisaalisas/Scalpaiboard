using Microsoft.EntityFrameworkCore;
using Scalpaiboard.Data;
using Scalpaiboard.Models;
using Scalpaiboard.Services.AIAssistant.Providers;

namespace Scalpaiboard.Services;

public interface IMultiProviderAIService
{
    Task<AIResponse> ChatAsync(Guid userId, string message, int? providerId = null, string? conversationId = null);
    IAIProvider? CreateProvider(AIProvider config);
}

public class AIResponse
{
    public string Content { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public decimal Cost { get; set; }
    public int ResponseTimeMs { get; set; }
}

public class MultiProviderAIService : IMultiProviderAIService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<MultiProviderAIService> _logger;

    public MultiProviderAIService(ApplicationDbContext db, ILogger<MultiProviderAIService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<AIResponse> ChatAsync(Guid userId, string message, int? providerId = null, string? conversationId = null)
    {
        var startTime = DateTime.UtcNow;

        // Get provider configuration
        AIProvider? providerConfig;
        if (providerId.HasValue)
        {
            providerConfig = await _db.AIProviders
                .FirstOrDefaultAsync(p => p.Id == providerId.Value && p.UserId == userId);
        }
        else
        {
            // Get default provider
            providerConfig = await _db.AIProviders
                .FirstOrDefaultAsync(p => p.UserId == userId && p.IsDefault && p.IsActive);
        }

        if (providerConfig == null)
        {
            return new AIResponse
            {
                Content = "No AI provider configured. Please add an AI provider in Settings:\n\n" +
                          "1. Go to Settings → AI Providers\n" +
                          "2. Click 'Add New AI Provider'\n" +
                          "3. Select your provider (OpenAI, Anthropic, etc.)\n" +
                          "4. Enter your API key\n" +
                          "5. Set it as default\n\n" +
                          "Supported providers: OpenAI, Anthropic, Google, AWS Bedrock, Together AI, Groq, Mistral, HuggingFace, OpenRouter"
            };
        }

        // Create provider instance
        var provider = CreateProvider(providerConfig);
        if (provider == null)
        {
            return new AIResponse
            {
                Content = $"Provider type '{providerConfig.ProviderType}' is not yet implemented."
            };
        }

        try
        {
            // Call the AI provider
            var response = await provider.ChatAsync(message, new ChatOptions
            {
                MaxTokens = providerConfig.MaxTokens,
                Temperature = (float)providerConfig.Temperature
            });

            var responseTimeMs = (int)(DateTime.UtcNow - startTime).TotalMilliseconds;

            // Track usage
            var usage = new AIProviderUsage
            {
                ProviderId = providerConfig.Id,
                PromptTokens = response.PromptTokens,
                CompletionTokens = response.CompletionTokens,
                Cost = response.Cost,
                ResponseTimeMs = responseTimeMs
            };
            _db.AIProviderUsage.Add(usage);

            // Update monthly spent
            providerConfig.MonthlySpent += response.Cost;

            await _db.SaveChangesAsync();

            return new AIResponse
            {
                Content = response.Content,
                PromptTokens = response.PromptTokens,
                CompletionTokens = response.CompletionTokens,
                Cost = response.Cost,
                ResponseTimeMs = responseTimeMs
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling AI provider {Provider}", providerConfig.ProviderType);
            return new AIResponse
            {
                Content = $"Error calling AI provider: {ex.Message}"
            };
        }
    }

    public IAIProvider? CreateProvider(AIProvider config)
    {
        // Decrypt API key (in production, use proper encryption)
        var apiKey = config.ApiKeyEncrypted; // TODO: Implement decryption

        return config.ProviderType.ToLower() switch
        {
            "openai" => new OpenAIProvider(apiKey, config.ModelName),
            "anthropic" => new AnthropicProvider(apiKey, config.ModelName),
            "google" => new GoogleVertexProvider(apiKey, config.ModelName),
            "together" => new TogetherAIProvider(apiKey, config.ModelName),
            "groq" => new GroqProvider(apiKey, config.ModelName),
            "mistral" => new MistralProvider(apiKey, config.ModelName),
            "openrouter" => new OpenRouterProvider(apiKey, config.ModelName),
            _ => null
        };
    }
}

public class ChatOptions
{
    public int? MaxTokens { get; set; }
    public float? Temperature { get; set; }
}
