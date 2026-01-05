import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { useBrokerStatus } from "@/hooks/use-broker-status";

const providerNames: Record<string, string> = {
  tradier: "Tradier",
  alpaca: "Alpaca",
  polygon: "Polygon.io",
  schwab: "Charles Schwab",
  ibkr: "Interactive Brokers",
};

export function StatusBanner() {
  const { isConnected, providerName, isLoading, dataStatus } = useBrokerStatus();

  if (isLoading) {
    return null;
  }

  if (dataStatus?.isLive && dataStatus.provider) {
    const displayName = providerNames[dataStatus.provider] || dataStatus.provider;
    return (
      <div 
        className="bg-green-500/10 border-b border-green-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
        data-testid="banner-live-data"
      >
        <Wifi className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs text-green-600 dark:text-green-400">
          Connected to live data via {displayName}
        </span>
      </div>
    );
  }

  if (isConnected && dataStatus?.error) {
    return (
      <div 
        className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
        data-testid="banner-broker-error"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs text-orange-600 dark:text-orange-400">
          Broker connected but data fetch failed - showing mock data
        </span>
      </div>
    );
  }

  return (
    <div 
      className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-1.5 flex items-center justify-center gap-2"
      data-testid="banner-mock-data"
    >
      <WifiOff className="h-3.5 w-3.5 text-yellow-500" />
      <span className="text-xs text-yellow-600 dark:text-yellow-400">
        Showing mock data - connect a broker in Settings for live market data
      </span>
    </div>
  );
}
