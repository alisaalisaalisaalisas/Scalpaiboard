using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Scalpaiboard.Models;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("username")]
    public string Username { get; set; } = string.Empty;

    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("telegram_chat_id")]
    public long? TelegramChatId { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("coins")]
public class Coin
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("symbol")]
    public string Symbol { get; set; } = string.Empty;

    [Column("exchange")]
    public string Exchange { get; set; } = "binance";

    [Column("name")]
    public string? Name { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;
}

[Table("alerts")]
public class Alert
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("coin_id")]
    public int CoinId { get; set; }

    [Column("condition_type")]
    public string ConditionType { get; set; } = string.Empty;

    [Column("condition_value")]
    public decimal ConditionValue { get; set; }

    [Column("notification_type")]
    public string NotificationType { get; set; } = "in_app";

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("triggered_count")]
    public int TriggeredCount { get; set; } = 0;

    [Column("last_triggered_at")]
    public DateTime? LastTriggeredAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("CoinId")]
    public virtual Coin? Coin { get; set; }
}

[Table("alert_history")]
public class AlertHistory
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("alert_id")]
    public int AlertId { get; set; }

    [Column("triggered_at")]
    public DateTime TriggeredAt { get; set; } = DateTime.UtcNow;

    [Column("notification_status")]
    public string? NotificationStatus { get; set; }

    [Column("notification_channel")]
    public string? NotificationChannel { get; set; }

    [Column("error_message")]
    public string? ErrorMessage { get; set; }
}

[Table("watchlists")]
public class Watchlist
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("coin_id")]
    public int CoinId { get; set; }

    [Column("added_at")]
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

[Table("ai_providers")]
public class AIProvider
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("provider_name")]
    public string ProviderName { get; set; } = string.Empty;

    [Column("provider_type")]
    public string ProviderType { get; set; } = string.Empty;

    [Column("api_key_encrypted")]
    public string ApiKeyEncrypted { get; set; } = string.Empty;

    [Column("model_name")]
    public string ModelName { get; set; } = string.Empty;

    [Column("is_active")]
    public bool IsActive { get; set; } = false;

    [Column("is_default")]
    public bool IsDefault { get; set; } = false;

    [Column("max_tokens")]
    public int MaxTokens { get; set; } = 2000;

    [Column("temperature")]
    public decimal Temperature { get; set; } = 0.7m;

    [Column("cost_per_1k_input_tokens")]
    public decimal? CostPer1kInputTokens { get; set; }

    [Column("cost_per_1k_output_tokens")]
    public decimal? CostPer1kOutputTokens { get; set; }

    [Column("monthly_budget")]
    public decimal? MonthlyBudget { get; set; }

    [Column("monthly_spent")]
    public decimal MonthlySpent { get; set; } = 0;
}

[Table("ai_provider_usage")]
public class AIProviderUsage
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("provider_id")]
    public int ProviderId { get; set; }

    [Column("prompt_tokens")]
    public int? PromptTokens { get; set; }

    [Column("completion_tokens")]
    public int? CompletionTokens { get; set; }

    [Column("cost")]
    public decimal? Cost { get; set; }

    [Column("response_time_ms")]
    public int? ResponseTimeMs { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("ai_conversations")]
public class AIConversation
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("provider_id")]
    public int? ProviderId { get; set; }

    [Column("title")]
    public string? Title { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("ai_messages")]
public class AIMessage
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("conversation_id")]
    public Guid ConversationId { get; set; }

    [Column("role")]
    public string Role { get; set; } = string.Empty;

    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Column("tokens_used")]
    public int? TokensUsed { get; set; }

    [Column("cost")]
    public decimal? Cost { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
