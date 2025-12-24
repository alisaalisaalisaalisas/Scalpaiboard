using Microsoft.EntityFrameworkCore;
using Scalpaiboard.Data;
using Scalpaiboard.Models;
using System.Net.Http.Json;

namespace Scalpaiboard.Services;

public interface IAlertEvaluationService
{
    Task EvaluateAllActiveAlertsAsync();
    Task<List<AlertTriggered>> EvaluateAlertsForCoinAsync(int coinId, decimal currentPrice, decimal currentVolume);
}

public class AlertTriggered
{
    public int AlertId { get; set; }
    public string Condition { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public DateTime TriggeredAt { get; set; } = DateTime.UtcNow;
}

public class AlertEvaluationService : IAlertEvaluationService
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AlertEvaluationService> _logger;
    private readonly HttpClient _httpClient;

    public AlertEvaluationService(
        ApplicationDbContext db,
        INotificationService notificationService,
        ILogger<AlertEvaluationService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _notificationService = notificationService;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task EvaluateAllActiveAlertsAsync()
    {
        try
        {
            // Get all active alerts grouped by coin
            var activeAlerts = await _db.Alerts
                .Where(a => a.IsActive)
                .Include(a => a.Coin)
                .GroupBy(a => a.CoinId)
                .ToListAsync();

            _logger.LogInformation("Evaluating {Count} coin groups with active alerts", activeAlerts.Count);

            foreach (var coinGroup in activeAlerts)
            {
                var coinId = coinGroup.Key;
                var symbol = coinGroup.First().Coin?.Symbol;

                if (string.IsNullOrEmpty(symbol)) continue;

                // Fetch current price from Binance
                var marketData = await GetMarketDataAsync(symbol);
                if (marketData == null) continue;

                // Evaluate alerts for this coin
                var triggeredAlerts = await EvaluateAlertsForCoinAsync(
                    coinId,
                    marketData.Price,
                    marketData.Volume
                );

                // Process triggered alerts
                foreach (var triggered in triggeredAlerts)
                {
                    await ProcessTriggeredAlertAsync(triggered, symbol, marketData.Price);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error evaluating alerts");
        }
    }

    public async Task<List<AlertTriggered>> EvaluateAlertsForCoinAsync(int coinId, decimal currentPrice, decimal currentVolume)
    {
        var triggered = new List<AlertTriggered>();

        var alerts = await _db.Alerts
            .Where(a => a.CoinId == coinId && a.IsActive)
            .ToListAsync();

        foreach (var alert in alerts)
        {
            bool shouldTrigger = EvaluateCondition(alert, currentPrice, currentVolume);

            if (shouldTrigger && !WasTriggeredRecently(alert))
            {
                triggered.Add(new AlertTriggered
                {
                    AlertId = alert.Id,
                    Condition = alert.ConditionType,
                    Value = alert.ConditionValue,
                    TriggeredAt = DateTime.UtcNow
                });

                // Update alert
                alert.TriggeredCount++;
                alert.LastTriggeredAt = DateTime.UtcNow;
            }
        }

        if (triggered.Count > 0)
        {
            await _db.SaveChangesAsync();
        }

        return triggered;
    }

    private bool EvaluateCondition(Alert alert, decimal currentPrice, decimal currentVolume)
    {
        return alert.ConditionType.ToLower() switch
        {
            "price_above" => currentPrice >= alert.ConditionValue,
            "price_below" => currentPrice <= alert.ConditionValue,
            "volume_above" => currentVolume >= alert.ConditionValue,
            "volume_below" => currentVolume <= alert.ConditionValue,
            "price_change_above" => false, // TODO: Implement with historical data
            "price_change_below" => false,
            _ => false
        };
    }

    private bool WasTriggeredRecently(Alert alert)
    {
        // Prevent duplicate triggers within 5 minutes
        if (alert.LastTriggeredAt == null) return false;
        return (DateTime.UtcNow - alert.LastTriggeredAt.Value).TotalMinutes < 5;
    }

    private async Task ProcessTriggeredAlertAsync(AlertTriggered triggered, string symbol, decimal currentPrice)
    {
        // Save to history
        var history = new AlertHistory
        {
            AlertId = triggered.AlertId,
            TriggeredAt = triggered.TriggeredAt,
            NotificationStatus = "pending",
            NotificationChannel = "in_app"
        };

        _db.AlertHistory.Add(history);
        await _db.SaveChangesAsync();

        // Send notification
        var alert = await _db.Alerts
            .Include(a => a.Coin)
            .FirstOrDefaultAsync(a => a.Id == triggered.AlertId);

        if (alert != null)
        {
            try
            {
                await _notificationService.SendAlertNotificationAsync(alert, currentPrice);
                history.NotificationStatus = "sent";
            }
            catch (Exception ex)
            {
                history.NotificationStatus = "failed";
                history.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Failed to send notification for alert {AlertId}", triggered.AlertId);
            }

            await _db.SaveChangesAsync();
        }
    }

    private async Task<MarketData?> GetMarketDataAsync(string symbol)
    {
        try
        {
            var response = await _httpClient.GetFromJsonAsync<BinanceTickerResponse>(
                $"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}"
            );

            if (response != null)
            {
                return new MarketData
                {
                    Price = decimal.Parse(response.LastPrice),
                    Volume = decimal.Parse(response.Volume)
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch market data for {Symbol}", symbol);
        }

        return null;
    }

    private class MarketData
    {
        public decimal Price { get; set; }
        public decimal Volume { get; set; }
    }

    private class BinanceTickerResponse
    {
        public string LastPrice { get; set; } = "0";
        public string Volume { get; set; } = "0";
    }
}
