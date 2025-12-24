using Scalpaiboard.Models;

namespace Scalpaiboard.Services;

public interface INotificationService
{
    Task SendAlertNotificationAsync(Alert alert, decimal currentPrice);
    Task SendTelegramMessageAsync(long chatId, string message);
    Task SendEmailAsync(string email, string subject, string body);
}

public class NotificationService : INotificationService
{
    private readonly ILogger<NotificationService> _logger;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public NotificationService(
        ILogger<NotificationService> logger,
        IConfiguration config,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _config = config;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task SendAlertNotificationAsync(Alert alert, decimal currentPrice)
    {
        var message = FormatAlertMessage(alert, currentPrice);

        switch (alert.NotificationType.ToLower())
        {
            case "telegram":
                // TODO: Get user's Telegram chat ID
                _logger.LogInformation("Would send Telegram: {Message}", message);
                break;

            case "email":
                // TODO: Get user's email
                _logger.LogInformation("Would send Email: {Message}", message);
                break;

            case "in_app":
            default:
                // In-app notifications are stored in alert_history
                _logger.LogInformation("In-app notification: {Message}", message);
                break;
        }
    }

    public async Task SendTelegramMessageAsync(long chatId, string message)
    {
        var botToken = _config["Telegram:BotToken"];
        if (string.IsNullOrEmpty(botToken))
        {
            _logger.LogWarning("Telegram bot token not configured");
            return;
        }

        try
        {
            var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["chat_id"] = chatId.ToString(),
                ["text"] = message,
                ["parse_mode"] = "Markdown"
            });

            var response = await _httpClient.PostAsync(url, content);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("Telegram message sent to {ChatId}", chatId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send Telegram message to {ChatId}", chatId);
            throw;
        }
    }

    public async Task SendEmailAsync(string email, string subject, string body)
    {
        // Placeholder for email sending (SendGrid, SMTP, etc.)
        _logger.LogInformation("Would send email to {Email}: {Subject}", email, subject);
        await Task.CompletedTask;
    }

    private string FormatAlertMessage(Alert alert, decimal currentPrice)
    {
        var symbol = alert.Coin?.Symbol ?? "Unknown";
        var conditionText = FormatCondition(alert.ConditionType, alert.ConditionValue);

        return $@"🚨 *Alert Triggered!*

*Coin:* {symbol}
*Condition:* {conditionText}
*Current Price:* ${currentPrice:N2}
*Time:* {DateTime.UtcNow:g} UTC

_Scalpaiboard Alert System_";
    }

    private string FormatCondition(string conditionType, decimal value)
    {
        return conditionType.ToLower() switch
        {
            "price_above" => $"Price above ${value:N2}",
            "price_below" => $"Price below ${value:N2}",
            "volume_above" => $"Volume above ${value:N0}",
            "volume_below" => $"Volume below ${value:N0}",
            _ => $"{conditionType}: {value}"
        };
    }
}
