import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface BrokerStatus {
  id: string;
  userId: string;
  provider: string;
  isConnected: boolean;
  lastSync: string | null;
}

interface DataStatus {
  isLive: boolean;
  provider?: string;
  error?: string;
}

interface BrokerStatusContextValue {
  status: BrokerStatus | null;
  isConnected: boolean;
  isLoading: boolean;
  providerName: string | null;
  dataStatus: DataStatus | null;
}

const BrokerStatusContext = createContext<BrokerStatusContextValue | null>(null);

const providerNames: Record<string, string> = {
  tradier: "Tradier",
  alpaca: "Alpaca",
  polygon: "Polygon.io",
  schwab: "Charles Schwab",
  ibkr: "Interactive Brokers",
};

export function BrokerStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);

  const { data: status, isLoading } = useQuery<BrokerStatus | null>({
    queryKey: ["/api/broker/status"],
    enabled: !!user,
    refetchInterval: 60000,
  });

  const { data: scanMeta } = useQuery<{ data: any[]; isLive: boolean; provider?: string; error?: string }>({
    queryKey: ["/api/scan/results", "meta"],
    queryFn: async () => {
      const res = await fetch("/api/scan/results?meta=true");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (scanMeta) {
      setDataStatus({
        isLive: scanMeta.isLive,
        provider: scanMeta.provider,
        error: scanMeta.error,
      });
    }
  }, [scanMeta]);

  const isConnected = !!status?.isConnected;
  const providerName = status?.provider ? providerNames[status.provider] || status.provider : null;

  return (
    <BrokerStatusContext.Provider value={{ status, isConnected, isLoading, providerName, dataStatus }}>
      {children}
    </BrokerStatusContext.Provider>
  );
}

export function useBrokerStatus() {
  const context = useContext(BrokerStatusContext);
  if (!context) {
    return { status: null, isConnected: false, isLoading: false, providerName: null, dataStatus: null };
  }
  return context;
}
