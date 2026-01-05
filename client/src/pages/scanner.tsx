import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Loader2, RefreshCw, List, DollarSign, Info, Plug, Settings, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

const DOW_30_SYMBOLS = [
  "AAPL", "AMGN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS", "DOW",
  "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM",
  "MRK", "MSFT", "NKE", "PG", "TRV", "UNH", "V", "VZ", "WBA", "WMT"
];

const NASDAQ_100_TOP = [
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "GOOG", "AVGO", "TSLA", "COST",
  "PEP", "ADBE", "NFLX", "AMD", "CSCO", "TMUS", "INTC", "CMCSA", "AMGN", "INTU",
  "QCOM", "TXN", "HON", "AMAT", "BKNG", "ISRG", "SBUX", "VRTX", "ADP", "MDLZ"
];

const SP500_TOP = [
  "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "UNH", "XOM",
  "JNJ", "JPM", "V", "PG", "MA", "HD", "CVX", "MRK", "ABBV", "LLY",
  "PEP", "KO", "COST", "AVGO", "WMT", "MCD", "CSCO", "TMO", "ACN", "ABT"
];

const VCP_STAGES = [
  { stage: "FORMING", description: "Pattern is in early stages - volatility is beginning to contract but not yet ready for entry." },
  { stage: "READY", description: "Pattern is mature - price is consolidating near resistance with tight range. Watch for breakout." },
  { stage: "APPROACHING", description: "Price is within 2% of resistance level - potential breakout imminent." },
  { stage: "BREAKOUT", description: "Price has broken above resistance with increased volume - potential entry signal." },
];

export default function Scanner() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<ScannerFilters>(defaultFilters);
  const [liveResults, setLiveResults] = useState<ScanResult[] | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("default");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("all");
  const [showStageInfo, setShowStageInfo] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const { isConnected } = useBrokerStatus();

  const handleRowClick = (result: ScanResult) => {
    navigate(`/charts/${result.ticker}`);
  };

  const { data: storedResults, isLoading, refetch, dataUpdatedAt } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan/results"],
  });

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  useEffect(() => {
    if (dataUpdatedAt && storedResults && storedResults.length > 0 && !liveResults) {
      setLastScanTime(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt, storedResults, liveResults]);

  const rawResults = liveResults || storedResults;
  const isLiveData = !!liveResults;
  
  const getSymbolsForPreset = (preset: string): string[] | null => {
    switch (preset) {
      case "toptech": return TOP_TECH_SYMBOLS;
      case "dow30": return DOW_30_SYMBOLS;
      case "nasdaq100": return NASDAQ_100_TOP;
      case "sp500": return SP500_TOP;
      default: return null;
    }
  };
  
  const pricePreset = PRICE_PRESETS.find(p => p.id === selectedPriceRange);
  const presetSymbols = getSymbolsForPreset(selectedWatchlist);
  const results = rawResults?.filter(r => {
    if (isLiveData && presetSymbols && !presetSymbols.includes(r.ticker)) {
      return false;
    }
    if (!pricePreset) return true;
    const price = r.price || 0;
    return price >= pricePreset.min && price < pricePreset.max;
  });

  const runScanMutation = useMutation({
    mutationFn: async () => {
      let symbols: string[] | undefined;
      
      const presetSymbolsList = getSymbolsForPreset(selectedWatchlist);
      if (presetSymbolsList) {
        symbols = presetSymbolsList;
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
        setLastScanTime(new Date());
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
              <SelectItem value="dow30">Dow 30</SelectItem>
              <SelectItem value="nasdaq100">NASDAQ 100 Top 30</SelectItem>
              <SelectItem value="sp500">S&P 500 Top 30</SelectItem>
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

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ticker or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
            data-testid="input-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {lastScanTime && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {isLiveData ? "Live scan" : "Loaded"}: {format(lastScanTime, "MMM d, h:mm:ss a")}
            </span>
          </div>
        )}
      </div>

      {!isLoading && (!results || results.length === 0) && !isConnected ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Plug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium">No broker connected</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              Connect your brokerage account to scan for VCP patterns
            </p>
            <Link href="/settings">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Connect Broker
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ScannerTable results={results || []} isLoading={isLoading} onRowClick={handleRowClick} searchQuery={searchQuery} />
      )}
    </div>
  );
}
