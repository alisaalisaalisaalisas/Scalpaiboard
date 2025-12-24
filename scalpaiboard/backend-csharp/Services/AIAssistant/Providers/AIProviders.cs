namespace Scalpaiboard.Services.AIAssistant.Providers;

public interface IAIProvider
{
    Task<ProviderResponse> ChatAsync(string message, ChatOptions options);
}

public class ProviderResponse
{
    public string Content { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public decimal Cost { get; set; }
}

// ========== OpenAI Provider ==========
public class OpenAIProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;
    private readonly HttpClient _http;

    public OpenAIProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        var request = new
        {
            model = _model,
            messages = new[] { new { role = "user", content = message } },
            max_tokens = options.MaxTokens ?? 2000,
            temperature = options.Temperature ?? 0.7f
        };

        var response = await _http.PostAsJsonAsync("https://api.openai.com/v1/chat/completions", request);
        var result = await response.Content.ReadFromJsonAsync<OpenAIResponse>();

        if (result?.Choices?.Length > 0)
        {
            var promptTokens = result.Usage?.PromptTokens ?? 0;
            var completionTokens = result.Usage?.CompletionTokens ?? 0;

            return new ProviderResponse
            {
                Content = result.Choices[0].Message?.Content ?? "",
                PromptTokens = promptTokens,
                CompletionTokens = completionTokens,
                Cost = CalculateCost(promptTokens, completionTokens, _model)
            };
        }

        return new ProviderResponse { Content = "No response from OpenAI" };
    }

    private decimal CalculateCost(int promptTokens, int completionTokens, string model)
    {
        // GPT-4 pricing (approximate)
        decimal inputCost = model.Contains("gpt-4") ? 0.03m : 0.0015m;
        decimal outputCost = model.Contains("gpt-4") ? 0.06m : 0.002m;

        return (promptTokens / 1000m * inputCost) + (completionTokens / 1000m * outputCost);
    }

    private class OpenAIResponse
    {
        public Choice[]? Choices { get; set; }
        public Usage? Usage { get; set; }
    }
    private class Choice { public Message? Message { get; set; } }
    private class Message { public string? Content { get; set; } }
    private class Usage { public int PromptTokens { get; set; } public int CompletionTokens { get; set; } }
}

// ========== Anthropic Provider ==========
public class AnthropicProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;
    private readonly HttpClient _http;

    public AnthropicProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("x-api-key", apiKey);
        _http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        var request = new
        {
            model = _model,
            messages = new[] { new { role = "user", content = message } },
            max_tokens = options.MaxTokens ?? 2000
        };

        var response = await _http.PostAsJsonAsync("https://api.anthropic.com/v1/messages", request);
        var result = await response.Content.ReadFromJsonAsync<AnthropicResponse>();

        if (result?.Content?.Length > 0)
        {
            return new ProviderResponse
            {
                Content = result.Content[0].Text ?? "",
                PromptTokens = result.Usage?.InputTokens ?? 0,
                CompletionTokens = result.Usage?.OutputTokens ?? 0,
                Cost = 0 // TODO: Calculate Anthropic pricing
            };
        }

        return new ProviderResponse { Content = "No response from Anthropic" };
    }

    private class AnthropicResponse
    {
        public ContentBlock[]? Content { get; set; }
        public AnthropicUsage? Usage { get; set; }
    }
    private class ContentBlock { public string? Text { get; set; } }
    private class AnthropicUsage { public int InputTokens { get; set; } public int OutputTokens { get; set; } }
}

// ========== Google Vertex AI Provider ==========
public class GoogleVertexProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;

    public GoogleVertexProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        // TODO: Implement Google Vertex AI / Gemini API
        return new ProviderResponse
        {
            Content = "Google Vertex AI integration coming soon. Configure your GCP project and API key."
        };
    }
}

// ========== Together AI Provider ==========
public class TogetherAIProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;
    private readonly HttpClient _http;

    public TogetherAIProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        var request = new
        {
            model = _model,
            messages = new[] { new { role = "user", content = message } },
            max_tokens = options.MaxTokens ?? 2000
        };

        var response = await _http.PostAsJsonAsync("https://api.together.xyz/v1/chat/completions", request);
        var result = await response.Content.ReadFromJsonAsync<OpenAIResponse>();

        return new ProviderResponse
        {
            Content = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response",
            PromptTokens = result?.Usage?.PromptTokens ?? 0,
            CompletionTokens = result?.Usage?.CompletionTokens ?? 0,
            Cost = 0.001m * ((result?.Usage?.PromptTokens ?? 0) + (result?.Usage?.CompletionTokens ?? 0)) / 1000
        };
    }

    private class OpenAIResponse { public Choice[]? Choices { get; set; } public Usage? Usage { get; set; } }
    private class Choice { public Message? Message { get; set; } }
    private class Message { public string? Content { get; set; } }
    private class Usage { public int PromptTokens { get; set; } public int CompletionTokens { get; set; } }
}

// ========== Groq Provider ==========
public class GroqProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;
    private readonly HttpClient _http;

    public GroqProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        var request = new
        {
            model = _model,
            messages = new[] { new { role = "user", content = message } },
            max_tokens = options.MaxTokens ?? 2000
        };

        var response = await _http.PostAsJsonAsync("https://api.groq.com/openai/v1/chat/completions", request);
        var result = await response.Content.ReadFromJsonAsync<GroqResponse>();

        return new ProviderResponse
        {
            Content = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response",
            PromptTokens = result?.Usage?.PromptTokens ?? 0,
            CompletionTokens = result?.Usage?.CompletionTokens ?? 0,
            Cost = 0 // Groq has free tier
        };
    }

    private class GroqResponse { public Choice[]? Choices { get; set; } public Usage? Usage { get; set; } }
    private class Choice { public Message? Message { get; set; } }
    private class Message { public string? Content { get; set; } }
    private class Usage { public int PromptTokens { get; set; } public int CompletionTokens { get; set; } }
}

// ========== Mistral Provider ==========
public class MistralProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;
    private readonly HttpClient _http;

    public MistralProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        var request = new
        {
            model = _model,
            messages = new[] { new { role = "user", content = message } },
            max_tokens = options.MaxTokens ?? 2000
        };

        var response = await _http.PostAsJsonAsync("https://api.mistral.ai/v1/chat/completions", request);
        var result = await response.Content.ReadFromJsonAsync<MistralResponse>();

        return new ProviderResponse
        {
            Content = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response",
            PromptTokens = result?.Usage?.PromptTokens ?? 0,
            CompletionTokens = result?.Usage?.CompletionTokens ?? 0,
            Cost = 0.002m * ((result?.Usage?.PromptTokens ?? 0) + (result?.Usage?.CompletionTokens ?? 0)) / 1000
        };
    }

    private class MistralResponse { public Choice[]? Choices { get; set; } public Usage? Usage { get; set; } }
    private class Choice { public Message? Message { get; set; } }
    private class Message { public string? Content { get; set; } }
    private class Usage { public int PromptTokens { get; set; } public int CompletionTokens { get; set; } }
}

// ========== OpenRouter Provider ==========
public class OpenRouterProvider : IAIProvider
{
    private readonly string _apiKey;
    private readonly string _model;
    private readonly HttpClient _http;

    public OpenRouterProvider(string apiKey, string model)
    {
        _apiKey = apiKey;
        _model = model;
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
    }

    public async Task<ProviderResponse> ChatAsync(string message, ChatOptions options)
    {
        var request = new
        {
            model = _model,
            messages = new[] { new { role = "user", content = message } },
            max_tokens = options.MaxTokens ?? 2000
        };

        var response = await _http.PostAsJsonAsync("https://openrouter.ai/api/v1/chat/completions", request);
        var result = await response.Content.ReadFromJsonAsync<OpenRouterResponse>();

        return new ProviderResponse
        {
            Content = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response",
            PromptTokens = result?.Usage?.PromptTokens ?? 0,
            CompletionTokens = result?.Usage?.CompletionTokens ?? 0,
            Cost = 0 // Variable pricing
        };
    }

    private class OpenRouterResponse { public Choice[]? Choices { get; set; } public Usage? Usage { get; set; } }
    private class Choice { public Message? Message { get; set; } }
    private class Message { public string? Content { get; set; } }
    private class Usage { public int PromptTokens { get; set; } public int CompletionTokens { get; set; } }
}
