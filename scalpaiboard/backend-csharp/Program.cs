using Grpc.Core;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Scalpaiboard.Data;
using Scalpaiboard.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();

// Database (Entity Framework Core)
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgOptions => npgOptions.CommandTimeout(30)
    )
);

// Redis connection
var redisConnection = builder.Configuration["Redis:Connection"] ?? "localhost:6379";
var redis = ConnectionMultiplexer.Connect(redisConnection);
builder.Services.AddSingleton<IConnectionMultiplexer>(redis);

// Hangfire for background jobs
builder.Services.AddHangfire(config =>
    config.UsePostgreSqlStorage(options =>
        options.UseNpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection"))
    )
);
builder.Services.AddHangfireServer();

// Application services
builder.Services.AddScoped<IAlertEvaluationService, AlertEvaluationService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IMultiProviderAIService, MultiProviderAIService>();

// Health checks
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!)
    .AddRedis(redisConnection);

var app = builder.Build();

// Configure endpoints
if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}

app.MapGrpcService<AlertGrpcService>();
app.MapGrpcService<AIGrpcService>();
app.MapControllers();
app.MapHangfireDashboard("/hangfire");
app.MapHealthChecks("/health");

// Schedule recurring jobs
RecurringJob.AddOrUpdate<AlertEvaluationService>(
    "evaluate-alerts",
    service => service.EvaluateAllActiveAlertsAsync(),
    Cron.Minutely
);

Console.WriteLine("🚀 Scalpaiboard C# backend starting on :3002 (HTTP) and :50052 (gRPC)");
app.Run();
