import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Loader2, RefreshCw, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScannerTable } from "@/components/scanner-table";
import { ScannerFiltersPanel, defaultFilters } from "@/components/scanner-filters";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScanResult, ScannerFilters, Watchlist } from "@shared/schema";
import { useBrokerStatus } from "@/hooks/use-broker-status";

export default function Scanner() {
  const [filters, setFilters] = useState<ScannerFilters>(defaultFilters);
  const [liveResults, setLiveResults] = useState<ScanResult[] | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("default");
  const { toast } = useToast();
  const { isConnected } = useBrokerStatus();

  const { data: storedResults, isLoading, refetch } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan/results"],
  });

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const results = liveResults || storedResults;

  const runScanMutation = useMutation({
    mutationFn: async () => {
      let symbols: string[] | undefined;
      
      if (selectedWatchlist !== "default" && watchlists) {
        const watchlist = watchlists.find(w => w.id === selectedWatchlist);
        if (watchlist?.symbols && watchlist.symbols.length > 0) {
          symbols = watchlist.symbols;
        }
      }
      
      const response = await apiRequest("POST", "/api/scan/live", { symbols });
      return response.json();
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        setLiveResults(data);
        toast({
          title: "Live Scan Complete",
          description: `Fetched ${data.length} stocks from your broker`,
        });
      } else {
        toast({
          title: "Scan Failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const breakoutCount = results?.filter(r => r.stage === "BREAKOUT").length || 0;
  const readyCount = results?.filter(r => r.stage === "READY").length || 0;
  const formingCount = results?.filter(r => r.stage === "FORMING").length || 0;

  return (
    <div className="p-6 space-y-6" data-testid="scanner-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">VCP Scanner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan for Volatility Contraction Pattern setups
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {watchlists && watchlists.length > 0 && (
            <Select value={selectedWatchlist} onValueChange={setSelectedWatchlist}>
              <SelectTrigger className="w-[180px]" data-testid="select-watchlist">
                <List className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select watchlist" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (16 stocks)</SelectItem>
                {watchlists.map((wl) => (
                  <SelectItem key={wl.id} value={wl.id}>
                    {wl.name} ({wl.symbols?.length || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => runScanMutation.mutate()}
            disabled={runScanMutation.isPending || !isConnected}
            className="gap-2"
            data-testid="button-run-scan"
          >
            {runScanMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {runScanMutation.isPending ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </div>

      <ScannerFiltersPanel
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      <div className="flex items-center gap-3">
        <Badge variant="default" className="gap-1">
          Breakout <span className="font-mono">{breakoutCount}</span>
        </Badge>
        <Badge variant="secondary" className="gap-1">
          Ready <span className="font-mono">{readyCount}</span>
        </Badge>
        <Badge variant="outline" className="gap-1">
          Forming <span className="font-mono">{formingCount}</span>
        </Badge>
        <span className="text-sm text-muted-foreground ml-2">
          Total: <span className="font-mono">{results?.length || 0}</span> results
        </span>
      </div>

      <ScannerTable results={results || []} isLoading={isLoading} />
    </div>
  );
}
