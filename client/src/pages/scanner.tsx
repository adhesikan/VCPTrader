import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Loader2, RefreshCw, List, DollarSign, Info, Plug, Settings, Clock, X, LayoutGrid, Target, AlertTriangle, ChevronRight, TrendingUp, Layers, Activity } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ScanResult, ScannerFilters, Watchlist, StrategyInfo } from "@shared/schema";

interface MarketRegime {
  regime: "TRENDING" | "CHOPPY" | "RISK_OFF";
  slope: number;
  priceAboveEMA: boolean;
  crossFrequency: number;
}

interface ConfluenceResult {
  symbol: string;
  name: string;
  price: number;
  matchedStrategies: string[];
  confluenceScore: number;
  adjustedScore: number;
  primaryStage: string;
  keyLevels: {
    resistance?: number;
    support?: number;
    stop?: number;
  };
  explanation: string;
}

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

const STRATEGY_STAGES: Record<string, { stage: string; description: string }[]> = {
  VCP: [
    { stage: "FORMING", description: "Pattern is in early stages - volatility is beginning to contract but not yet ready for entry." },
    { stage: "READY", description: "Pattern is mature - price is consolidating near resistance with tight range. Watch for breakout." },
    { stage: "BREAKOUT", description: "Price has broken above resistance with increased volume - potential entry signal." },
  ],
  VCP_MULTIDAY: [
    { stage: "FORMING", description: "Multi-day VCP pattern developing - volatility contracting over multiple sessions." },
    { stage: "READY", description: "Pattern mature - consolidating near resistance. Watch for daily breakout." },
    { stage: "BREAKOUT", description: "Daily breakout above resistance with volume - potential swing entry." },
  ],
  CLASSIC_PULLBACK: [
    { stage: "FORMING", description: "Looking for uptrending stock above EMA9/EMA21. Waiting for impulse move and pullback." },
    { stage: "READY", description: "Valid pullback detected - price has pulled back to support. Watching for volume breakout." },
    { stage: "TRIGGERED", description: "Breakout confirmed with increased volume - entry signal triggered." },
  ],
  VWAP_RECLAIM: [
    { stage: "FORMING", description: "Price below VWAP, watching for potential reclaim." },
    { stage: "READY", description: "Price reclaimed VWAP, waiting for volume confirmation." },
    { stage: "TRIGGERED", description: "VWAP reclaim confirmed with volume expansion." },
  ],
  ORB5: [
    { stage: "FORMING", description: "Building 5-minute opening range, price within range." },
    { stage: "READY", description: "Price broke 5m opening range, awaiting volume confirmation." },
    { stage: "TRIGGERED", description: "5-minute ORB confirmed with volume." },
  ],
  ORB15: [
    { stage: "FORMING", description: "Building 15-minute opening range, price within range." },
    { stage: "READY", description: "Price broke 15m opening range, awaiting volume confirmation." },
    { stage: "TRIGGERED", description: "15-minute ORB confirmed with volume." },
  ],
  HIGH_RVOL: [
    { stage: "FORMING", description: "Tight consolidation detected with building volume." },
    { stage: "READY", description: "High RVOL detected (>2x), near breakout level." },
    { stage: "TRIGGERED", description: "Breakout confirmed with RVOL >2x average." },
  ],
  GAP_AND_GO: [
    { stage: "FORMING", description: "Gap up detected, holding above VWAP." },
    { stage: "READY", description: "Holding above VWAP, near opening range breakout." },
    { stage: "TRIGGERED", description: "Gap & Go confirmed: OR breakout with volume." },
  ],
  TREND_CONTINUATION: [
    { stage: "FORMING", description: "In uptrend, pulling back to EMA9/EMA21 zone." },
    { stage: "READY", description: "Pullback complete, near breakout level." },
    { stage: "TRIGGERED", description: "Trend continuation confirmed with volume." },
  ],
  VOLATILITY_SQUEEZE: [
    { stage: "FORMING", description: "Squeeze on - Bollinger Bands inside Keltner Channels." },
    { stage: "READY", description: "Squeeze about to fire, near breakout level." },
    { stage: "TRIGGERED", description: "Squeeze fired - breakout with volume expansion." },
  ],
};

export default function Scanner() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<ScannerFilters>(defaultFilters);
  const [liveResults, setLiveResults] = useState<ScanResult[] | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("default");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("all");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("VCP");
  const [showStageInfo, setShowStageInfo] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [activeTab, setActiveTab] = useState<"scan" | "confluence">("scan");
  const { toast } = useToast();
  const { isConnected } = useBrokerStatus();

  const { data: confluenceData, isLoading: isConfluenceLoading } = useQuery<{
    results: ConfluenceResult[];
    marketRegime?: MarketRegime;
  }>({
    queryKey: ["/api/scan/confluence"],
    enabled: activeTab === "confluence" && isConnected,
    staleTime: 30000,
  });

  const confluenceResults = confluenceData?.results;
  const marketRegime = confluenceData?.marketRegime;

  const { data: strategies } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
  });

  const currentStrategy = strategies?.find(s => s.id === selectedStrategy);
  const currentStages = STRATEGY_STAGES[selectedStrategy] || STRATEGY_STAGES.VCP;

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
      
      const response = await apiRequest("POST", "/api/scan/live", { 
        symbols, 
        strategy: selectedStrategy 
      });
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

  const triggeredCount = results?.filter(r => r.stage === "BREAKOUT" || r.stage === "TRIGGERED").length || 0;
  const readyCount = results?.filter(r => r.stage === "READY").length || 0;
  const formingCount = results?.filter(r => r.stage === "FORMING").length || 0;

  const triggerLabel = selectedStrategy === "VCP" ? "Breakout" : "Triggered";

  const getRegimeColor = (regime?: string) => {
    switch (regime) {
      case "TRENDING": return "text-chart-2";
      case "CHOPPY": return "text-yellow-500";
      case "RISK_OFF": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getRegimeLabel = (regime?: string) => {
    switch (regime) {
      case "TRENDING": return "Trending";
      case "CHOPPY": return "Choppy";
      case "RISK_OFF": return "Risk-Off";
      default: return "Unknown";
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="scanner-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pattern Scanner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan for trading pattern setups across multiple strategies
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
            <SelectTrigger className="w-[200px]" data-testid="select-strategy">
              <TrendingUp className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              {strategies?.map((strategy) => (
                <SelectItem key={strategy.id} value={strategy.id}>
                  {strategy.name.replace(" (Volatility Contraction Pattern)", "")}
                </SelectItem>
              )) || (
                <>
                  <SelectItem value="VCP">VCP</SelectItem>
                  <SelectItem value="CLASSIC_PULLBACK">Classic Pullback</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "scan" | "confluence")} className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="scan" className="gap-2" data-testid="tab-scan">
              <Search className="h-4 w-4" />
              Single Strategy
            </TabsTrigger>
            <TabsTrigger value="confluence" className="gap-2" data-testid="tab-confluence">
              <Layers className="h-4 w-4" />
              Confluence
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "confluence" && marketRegime && (
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${getRegimeColor(marketRegime.regime)}`} />
              <span className="text-sm font-medium">Market Regime:</span>
              <Badge variant="outline" className={getRegimeColor(marketRegime.regime)}>
                {getRegimeLabel(marketRegime.regime)}
              </Badge>
            </div>
          )}
        </div>

        <TabsContent value="scan" className="space-y-4 mt-0">
          <ScannerFiltersPanel
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
          />

          <Collapsible open={showStageInfo} onOpenChange={setShowStageInfo}>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="default" className="gap-1">
                {triggerLabel} <span className="font-mono">{triggeredCount}</span>
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
                <p className="text-sm font-medium">{currentStrategy?.name || "Pattern"} Stages</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {currentStages.map((info) => (
                    <div key={info.stage} className="flex gap-3">
                      <Badge 
                        variant={info.stage === "BREAKOUT" || info.stage === "TRIGGERED" ? "default" : info.stage === "READY" ? "secondary" : "outline"}
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
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1"
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === "card" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="gap-1"
                data-testid="button-view-card"
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </Button>
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
          ) : viewMode === "list" ? (
            <ScannerTable results={results || []} isLoading={isLoading} onRowClick={handleRowClick} searchQuery={searchQuery} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(results || [])
                .filter(r => !searchQuery || r.ticker.toLowerCase().includes(searchQuery.toLowerCase()) || r.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((result) => (
                  <Card 
                    key={result.id}
                    className="hover-elevate active-elevate-2 cursor-pointer transition-all"
                    onClick={() => handleRowClick(result)}
                    data-testid={`scan-card-${result.ticker}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold font-mono">{result.ticker}</span>
                          <Badge 
                            variant={result.stage === "BREAKOUT" ? "default" : result.stage === "READY" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {result.stage}
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl font-bold font-mono">${result.price?.toFixed(2)}</span>
                        {result.changePercent != null && (
                          <Badge
                            variant={(result.changePercent ?? 0) >= 0 ? "default" : "destructive"}
                            className="font-mono text-xs"
                          >
                            {(result.changePercent ?? 0) >= 0 ? "+" : ""}{(result.changePercent ?? 0).toFixed(2)}%
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Target className="h-3 w-3 text-chart-2" />
                            Resistance
                          </p>
                          <p className="font-mono font-medium text-chart-2">${result.resistance?.toFixed(2) || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            Stop Loss
                          </p>
                          <p className="font-mono font-medium text-destructive">${result.stopLoss?.toFixed(2) || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">RVOL</p>
                          <p className={`font-mono font-medium ${(result.rvol || 0) >= 1.5 ? "text-chart-2" : ""}`}>
                            {result.rvol?.toFixed(2) || "-"}x
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Score</p>
                          <p className="font-mono font-medium">{result.patternScore || "-"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="confluence" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Multi-Strategy Confluence
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Stocks matching multiple strategies get higher scores. Results are adjusted based on current market regime.
              </p>
            </CardHeader>
            <CardContent>
              {!isConnected ? (
                <div className="text-center py-8">
                  <Plug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground font-medium">No broker connected</p>
                  <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                    Connect your brokerage to scan for confluence patterns
                  </p>
                  <Link href="/settings">
                    <Button variant="outline" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Connect Broker
                    </Button>
                  </Link>
                </div>
              ) : isConfluenceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : confluenceResults && confluenceResults.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {confluenceResults.map((item) => (
                    <Card 
                      key={item.symbol}
                      className="hover-elevate active-elevate-2 cursor-pointer"
                      onClick={() => navigate(`/charts/${item.symbol}`)}
                      data-testid={`confluence-card-${item.symbol}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <span className="text-lg font-bold font-mono">{item.symbol}</span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {item.primaryStage}
                            </Badge>
                          </div>
                          <Badge 
                            variant={item.adjustedScore >= 80 ? "default" : item.adjustedScore >= 60 ? "secondary" : "outline"}
                            className="font-mono"
                          >
                            {item.adjustedScore}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.matchedStrategies.map((strat) => (
                            <Badge key={strat} variant="outline" className="text-xs">
                              {strat.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Resistance</p>
                            <p className="font-mono font-medium text-chart-2">
                              ${item.keyLevels.resistance?.toFixed(2) || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Stop Loss</p>
                            <p className="font-mono font-medium text-destructive">
                              ${item.keyLevels.stop?.toFixed(2) || "-"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No confluence patterns found</p>
                  <p className="text-sm mt-1">Try running a scan or check back during market hours</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <p className="text-xs text-muted-foreground text-center">
            This alert is informational only and not investment advice. Always do your own research before trading.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
