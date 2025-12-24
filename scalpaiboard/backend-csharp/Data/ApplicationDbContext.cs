using Microsoft.EntityFrameworkCore;
using Scalpaiboard.Models;

namespace Scalpaiboard.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Coin> Coins { get; set; }
    public DbSet<Alert> Alerts { get; set; }
    public DbSet<AlertHistory> AlertHistory { get; set; }
    public DbSet<Watchlist> Watchlists { get; set; }
    public DbSet<AIProvider> AIProviders { get; set; }
    public DbSet<AIProviderUsage> AIProviderUsage { get; set; }
    public DbSet<AIConversation> AIConversations { get; set; }
    public DbSet<AIMessage> AIMessages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Unique constraints
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Coin>()
            .HasIndex(c => c.Symbol)
            .IsUnique();

        modelBuilder.Entity<Watchlist>()
            .HasIndex(w => new { w.UserId, w.CoinId })
            .IsUnique();

        modelBuilder.Entity<AIProvider>()
            .HasIndex(p => new { p.UserId, p.ProviderName })
            .IsUnique();
    }
}
