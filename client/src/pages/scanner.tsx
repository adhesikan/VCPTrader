import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Loader2, RefreshCw, List, DollarSign, Info } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ScanResult, ScannerFilters, Watchlist } from "@shared/schema";
import { useBrokerStatus } from "@/hooks/use-broker-status";

const PRICE_PRESETS = [
  { id: "all", label: "All Prices", min: 0, max: Infinity },
  { id: "under10", label: "Under $10", min: 0, max: 10 },
  { id: "10to50", label: "$10 - $50", min: 10, max: 50 },
  { id: "50to100", label: "$50 - $100", min: 50, max: 100 },
  { id: "100to500", label: "$100 - $500", min: 100, max: 500 },
  { id: "over500", label: "Over $500", min: 500, max: Infinity },
];

const TOP_TECH_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"];

const VCP_STAGES = [
  { stage: "FORMING", description: "Pattern is in early stages - volatility is beginning to contract but not yet ready for entry." },
  { stage: "READY", description: "Pattern is mature - price is consolidating near resistance with tight range. Watch for breakout." },
  { stage: "APPROACHING", description: "Price is within 2% of resistance level - potential breakout imminent." },
  { stage: "BREAKOUT", description: "Price has broken above resistance with increased volume - potential entry signal." },
];

export default function Scanner() {
  const [filters, setFilters] = useState<ScannerFilters>(defaultFilters);
  const [liveResults, setLiveResults] = useState<ScanResult[] | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("default");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("all");
  const [showStageInfo, setShowStageInfo] = useState<boolean>(false);
  const { toast } = useToast();
  const { isConnected } = useBrokerStatus();

  const { data: storedResults, isLoading, refetch } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan/results"],
  });

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const rawResults = liveResults || storedResults;
  
  const pricePreset = PRICE_PRESETS.find(p => p.id === selectedPriceRange);
  const results = rawResults?.filter(r => {
    if (selectedWatchlist === "toptech" && !TOP_TECH_SYMBOLS.includes(r.ticker)) {
      return false;
    }
    if (!pricePreset) return true;
    const price = r.price || 0;
    return price >= pricePreset.min && price < pricePreset.max;
  });

  const runScanMutation = useMutation({
    mutationFn: async () => {
      let symbols: string[] | undefined;
      
      if (selectedWatchlist === "toptech") {
        symbols = TOP_TECH_SYMBOLS;
      } else if (selectedWatchlist !== "default" && watchlists) {
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
          <Select value={selectedWatchlist} onValueChange={setSelectedWatchlist}>
            <SelectTrigger className="w-[180px]" data-testid="select-watchlist">
              <List className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select watchlist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (16 stocks)</SelectItem>
              <SelectItem value="toptech">Top Tech 5</SelectItem>
              {watchlists && watchlists.map((wl) => (
                <SelectItem key={wl.id} value={wl.id}>
                  {wl.name} ({wl.symbols?.length || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
            <SelectTrigger className="w-[150px]" data-testid="select-price-range">
              <DollarSign className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Price range" />
            </SelectTrigger>
            <SelectContent>
              {PRICE_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <Collapsible open={showStageInfo} onOpenChange={setShowStageInfo}>
        <div className="flex items-center gap-3 flex-wrap">
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
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 ml-auto" data-testid="button-stage-info">
              <Info className="h-4 w-4" />
              {showStageInfo ? "Hide" : "What do these stages mean?"}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-4">
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">VCP Pattern Stages</p>
            <div className="grid gap-3 md:grid-cols-2">
              {VCP_STAGES.map((info) => (
                <div key={info.stage} className="flex gap-3">
                  <Badge 
                    variant={info.stage === "BREAKOUT" ? "default" : info.stage === "READY" ? "secondary" : "outline"}
                    className="h-fit shrink-0"
                  >
                    {info.stage}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ScannerTable results={results || []} isLoading={isLoading} />
    </div>
  );
}
