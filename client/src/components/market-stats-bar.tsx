import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import type { MarketStats } from "@shared/schema";

interface MarketStatsBarProps {
  stats?: MarketStats | null;
  isLoading?: boolean;
}

export function MarketStatsBar({ stats, isLoading }: MarketStatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-6 text-sm">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const marketStatus = stats?.marketStatus || "closed";
  const statusColors: Record<string, string> = {
    open: "text-status-online",
    pre: "text-status-away",
    after: "text-status-away",
    closed: "text-status-offline",
  };

  const statusLabels: Record<string, string> = {
    open: "Market Open",
    pre: "Pre-Market",
    after: "After Hours",
    closed: "Market Closed",
  };

  return (
    <div className="flex items-center gap-6 text-sm" data-testid="market-stats-bar">
      <div className="flex items-center gap-1.5">
        <Activity className={`h-3.5 w-3.5 ${statusColors[marketStatus]}`} />
        <span className={statusColors[marketStatus]}>
          {statusLabels[marketStatus]}
        </span>
      </div>
      
      {stats && (
        <>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-chart-2" />
            <span className="font-mono">{stats.advancers.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            <span className="font-mono">{stats.decliners.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Minus className="h-3.5 w-3.5" />
            <span className="font-mono">{stats.unchanged.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}
