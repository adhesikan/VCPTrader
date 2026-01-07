import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Search, Loader2, RefreshCw, List, Info, HelpCircle, ChevronDown, ChevronRight, 
  TrendingUp, Layers, Activity, Zap, Target, BookOpen, X
} from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScannerTable } from "@/components/scanner-table";
import { StrategySelector } from "@/components/strategy-selector";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
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
import type { ScanResult, ScannerFilters, Watchlist, StrategyInfo } from "@shared/schema";
import { STRATEGY_CONFIGS, getStrategyDisplayName, FUSION_ENGINE_CONFIG } from "@shared/strategies";
import { useBrokerStatus } from "@/hooks/use-broker-status";
import { cn } from "@/lib/utils";

type EngineMode = "single" | "fusion";
type TargetType = "watchlist" | "symbol" | "universe";

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

const SCAN_PRESETS = [
  { id: "balanced", name: "Balanced", description: "Default settings for most traders" },
  { id: "conservative", name: "Conservative", description: "Higher liquidity, lower risk" },
  { id: "aggressive", name: "Aggressive", description: "More opportunities, higher risk" },
  { id: "scalp", name: "Scalp", description: "Quick trades, high volume" },
  { id: "swing", name: "Swing", description: "Multi-day holds" },
];

const PRESET_FILTERS: Record<string, Partial<ScannerFilters>> = {
  balanced: { minPrice: 5, maxPrice: 500, minVolume: 500000, minRvol: 1.2, excludeEtfs: true, excludeOtc: true },
  conservative: { minPrice: 10, maxPrice: 500, minVolume: 1000000, minRvol: 1.5, excludeEtfs: true, excludeOtc: true },
  aggressive: { minPrice: 2, maxPrice: 500, minVolume: 200000, minRvol: 1.0, excludeEtfs: true, excludeOtc: true },
  scalp: { minPrice: 5, maxPrice: 200, minVolume: 1000000, minRvol: 1.8, excludeEtfs: true, excludeOtc: true },
  swing: { minPrice: 10, maxPrice: 500, minVolume: 300000, minRvol: 1.0, excludeEtfs: true, excludeOtc: true },
};

const UNIVERSE_OPTIONS = [
  { value: "sp500", label: "S&P 500", count: 500 },
  { value: "nasdaq100", label: "Nasdaq 100", count: 100 },
  { value: "dow30", label: "Dow 30", count: 30 },
  { value: "all", label: "All US Stocks", count: "5000+" },
];

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

export default function Scanner() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isConnected } = useBrokerStatus();

  const [engineMode, setEngineMode] = useState<EngineMode>("single");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("VCP");
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(STRATEGY_CONFIGS.map(s => s.id));
  const [targetType, setTargetType] = useState<TargetType>("watchlist");
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("default");
  const [symbolInput, setSymbolInput] = useState<string>("");
  const [selectedUniverse, setSelectedUniverse] = useState<string>("sp500");
  const [selectedPreset, setSelectedPreset] = useState<string>("balanced");
  const [showGuide, setShowGuide] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filters, setFilters] = useState<ScannerFilters>({
    minPrice: 5,
    maxPrice: 500,
    minVolume: 500000,
    minRvol: 1.2,
    excludeEtfs: true,
    excludeOtc: true,
  });
  
  const [liveResults, setLiveResults] = useState<ScanResult[] | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [confluenceResults, setConfluenceResults] = useState<ConfluenceResult[] | null>(null);
  const [marketRegime, setMarketRegime] = useState<MarketRegime | null>(null);
  const [scanMetadata, setScanMetadata] = useState<{
    isLive: boolean;
    provider: string;
    symbolsRequested: number;
    symbolsReturned: number;
    scanTimeMs: number;
    batchCount?: number;
  } | null>(null);

  const { data: strategies } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
  });

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const { data: storedResults, isLoading, refetch, dataUpdatedAt } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan/results"],
  });

  useEffect(() => {
    if (dataUpdatedAt && storedResults && storedResults.length > 0 && !liveResults) {
      setLastScanTime(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt, storedResults, liveResults]);

  const handleRowClick = (result: ScanResult) => {
    navigate(`/charts/${result.ticker}`);
  };

  const getSymbolsForTarget = (): string[] | undefined => {
    if (targetType === "symbol" && symbolInput.trim()) {
      return symbolInput.toUpperCase().split(",").map(s => s.trim()).filter(Boolean);
    }
    if (targetType === "watchlist") {
      if (selectedWatchlist === "default") return undefined;
      const wl = watchlists?.find(w => w.id === selectedWatchlist);
      return wl?.symbols || undefined;
    }
    if (targetType === "universe") {
      switch (selectedUniverse) {
        case "dow30": return DOW_30_SYMBOLS;
        case "nasdaq100": return NASDAQ_100_TOP;
        case "sp500": return SP500_TOP;
        default: return undefined;
      }
    }
    return undefined;
  };

  const applyPreset = (presetId: string) => {
    const presetFilters = PRESET_FILTERS[presetId];
    if (presetFilters) {
      setFilters(prev => ({ ...prev, ...presetFilters }));
    }
    setSelectedPreset(presetId);
  };

  const runScanMutation = useMutation({
    mutationFn: async () => {
      const symbols = getSymbolsForTarget();
      
      const response = await apiRequest("POST", "/api/scan/live", { 
        symbols, 
        strategy: selectedStrategy,
        ...filters,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.results && Array.isArray(data.results)) {
        setLiveResults(data.results);
        setLastScanTime(new Date());
        setScanMetadata(data.metadata || null);
        toast({
          title: "Scan Complete",
          description: `Found ${data.results.length} opportunities from ${data.metadata?.provider || "broker"}`,
        });
      } else if (Array.isArray(data)) {
        setLiveResults(data);
        setLastScanTime(new Date());
        setScanMetadata(null);
        toast({
          title: "Scan Complete",
          description: `Found ${data.length} opportunities`,
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

  const confluenceMutation = useMutation({
    mutationFn: async () => {
      const symbols = getSymbolsForTarget();
      
      const response = await apiRequest("POST", "/api/scan/confluence", {
        strategies: selectedStrategies,
        symbols,
        minMatches: 2,
        ...filters,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setConfluenceResults(data.results);
      setMarketRegime(data.marketRegime);
      toast({
        title: "Fusion Scan Complete",
        description: `Found ${data.results?.length || 0} confluence opportunities`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fusion Scan Failed",
        description: error.message || "Failed to run multi-strategy scan",
        variant: "destructive",
      });
    },
  });

  const handleRunScan = () => {
    if (!isConnected) {
      toast({
        title: "Not Connected",
        description: "Please connect your brokerage in Settings first",
        variant: "destructive",
      });
      return;
    }

    if (engineMode === "single") {
      runScanMutation.mutate();
    } else {
      if (selectedStrategies.length < 2) {
        toast({
          title: "Select More Strategies",
          description: "Fusion Engine requires at least 2 strategies",
          variant: "destructive",
        });
        return;
      }
      confluenceMutation.mutate();
    }
  };

  const isScanning = runScanMutation.isPending || confluenceMutation.isPending;
  const rawResults = liveResults || storedResults;
  
  const filteredResults = rawResults?.filter(r => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return r.ticker.toLowerCase().includes(query) || 
           r.name?.toLowerCase().includes(query);
  });

  const triggeredCount = filteredResults?.filter(r => {
    const stage = r.stage?.toUpperCase();
    return stage === "BREAKOUT" || stage === "TRIGGERED";
  }).length || 0;
  const readyCount = filteredResults?.filter(r => r.stage?.toUpperCase() === "READY").length || 0;
  const formingCount = filteredResults?.filter(r => r.stage?.toUpperCase() === "FORMING").length || 0;

  const getRegimeColor = (regime?: string) => {
    switch (regime) {
      case "TRENDING": return "text-chart-2";
      case "CHOPPY": return "text-yellow-500";
      case "RISK_OFF": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const currentStrategyConfig = STRATEGY_CONFIGS.find(s => s.id === selectedStrategy);

  return (
    <div className="p-6 space-y-6" data-testid="scanner-page">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6" />
              Opportunity Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Find trading setups that match your strategy
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="gap-2"
            data-testid="button-toggle-guide"
          >
            <HelpCircle className="h-4 w-4" />
            How to use
            <ChevronDown className={cn("h-4 w-4 transition-transform", showGuide && "rotate-180")} />
          </Button>
        </div>

        <Collapsible open={showGuide} onOpenChange={setShowGuide}>
          <CollapsibleContent>
            <Card className="mt-4 bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="space-y-3">
                    <p className="font-medium">Quick Start Guide</p>
                    <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                      <li><strong>Choose your mode:</strong> Single Strategy scans for one pattern. Fusion Engine finds stocks matching multiple patterns.</li>
                      <li><strong>Select what to scan:</strong> Pick a watchlist, enter a stock symbol, or scan an entire market index.</li>
                      <li><strong>Pick a preset:</strong> Balanced works for most traders. Conservative filters for safer trades. Aggressive shows more opportunities.</li>
                      <li><strong>Run the scan:</strong> Click the button and review the results. Click any row to see the chart.</li>
                    </ol>
                    <div className="flex items-center gap-2 pt-2">
                      <Link href="/strategies">
                        <Button variant="outline" size="sm" className="gap-1" data-testid="link-strategy-guide">
                          <Info className="h-4 w-4" />
                          Strategy Guide
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Step 1: Choose Mode</Label>
            <RadioGroup 
              value={engineMode} 
              onValueChange={(v) => setEngineMode(v as EngineMode)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="mode-single" data-testid="radio-single" />
                <Label htmlFor="mode-single" className="flex items-center gap-2 cursor-pointer">
                  <TrendingUp className="h-4 w-4" />
                  Single Strategy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fusion" id="mode-fusion" data-testid="radio-fusion" />
                <Label htmlFor="mode-fusion" className="flex items-center gap-2 cursor-pointer">
                  <Layers className="h-4 w-4" />
                  Fusion Engine
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {engineMode === "single" 
                ? `Scan for ${currentStrategyConfig?.displayName || "patterns"} - ${currentStrategyConfig?.shortDescription || ""}`
                : FUSION_ENGINE_CONFIG.shortDescription
              }
            </p>
          </div>

          {engineMode === "single" ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Step 2: Select Strategy</Label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger className="w-full max-w-md" data-testid="select-strategy">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_CONFIGS.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      <div className="flex items-center gap-2">
                        <span>{strategy.displayName}</span>
                        <span className="text-xs text-muted-foreground">({strategy.category})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Step 2: Select Strategies</Label>
              <StrategySelector
                selectedStrategies={selectedStrategies}
                onChange={setSelectedStrategies}
                mode="multi"
              />
              <p className="text-xs text-muted-foreground">
                {selectedStrategies.length} strategies selected. Stocks matching 2+ strategies will be highlighted.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">Step 3: What to Scan</Label>
            <RadioGroup 
              value={targetType} 
              onValueChange={(v) => setTargetType(v as TargetType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="watchlist" id="target-watchlist" data-testid="radio-watchlist" />
                <Label htmlFor="target-watchlist" className="cursor-pointer">Watchlist</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="symbol" id="target-symbol" data-testid="radio-symbol" />
                <Label htmlFor="target-symbol" className="cursor-pointer">Single Stock</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="universe" id="target-universe" data-testid="radio-universe" />
                <Label htmlFor="target-universe" className="cursor-pointer">Market Index</Label>
              </div>
            </RadioGroup>

            <div className="max-w-md">
              {targetType === "watchlist" && (
                <Select value={selectedWatchlist} onValueChange={setSelectedWatchlist}>
                  <SelectTrigger data-testid="select-watchlist">
                    <SelectValue placeholder="Select watchlist" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Watchlist</SelectItem>
                    {watchlists?.map((wl) => (
                      <SelectItem key={wl.id} value={wl.id}>
                        {wl.name} ({wl.symbols?.length || 0} stocks)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {targetType === "symbol" && (
                <Input
                  placeholder="Enter symbol (e.g., AAPL) or multiple (AAPL, MSFT)"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                  className="font-mono"
                  data-testid="input-symbol"
                />
              )}

              {targetType === "universe" && (
                <>
                  <Select value={selectedUniverse} onValueChange={setSelectedUniverse}>
                    <SelectTrigger data-testid="select-universe">
                      <SelectValue placeholder="Select market" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIVERSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label} ({opt.count} stocks)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUniverse === "all" && (
                    <div className="mt-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">Large scan warning</p>
                          <p className="text-muted-foreground mt-1">
                            Scanning 5000+ stocks requires many API calls and may take several minutes. 
                            Consider using price/volume filters to reduce the number of stocks, or select a smaller index like S&P 500 or Nasdaq 100.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Step 4: Filter Preset</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs gap-1"
                data-testid="button-advanced-filters"
              >
                <Zap className="h-3 w-3" />
                Advanced
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
              </Button>
            </div>
            <Select value={selectedPreset} onValueChange={applyPreset}>
              <SelectTrigger className="w-full max-w-md" data-testid="select-preset">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {SCAN_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center gap-2">
                      <span>{preset.name}</span>
                      <span className="text-xs text-muted-foreground">- {preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleContent>
                <div className="space-y-4 pt-3 pb-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="minPrice" className="text-xs text-muted-foreground">Min Price</Label>
                      <Input
                        id="minPrice"
                        type="number"
                        placeholder="$5"
                        value={filters.minPrice ?? ""}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          minPrice: e.target.value ? Number(e.target.value) : PRESET_FILTERS[selectedPreset]?.minPrice 
                        }))}
                        className="font-mono h-8"
                        data-testid="input-min-price"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="maxPrice" className="text-xs text-muted-foreground">Max Price</Label>
                      <Input
                        id="maxPrice"
                        type="number"
                        placeholder="$500"
                        value={filters.maxPrice ?? ""}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          maxPrice: e.target.value ? Number(e.target.value) : PRESET_FILTERS[selectedPreset]?.maxPrice 
                        }))}
                        className="font-mono h-8"
                        data-testid="input-max-price"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="minVolume" className="text-xs text-muted-foreground">Min Volume</Label>
                      <Input
                        id="minVolume"
                        type="number"
                        placeholder="500K"
                        value={filters.minVolume ?? ""}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          minVolume: e.target.value ? Number(e.target.value) : PRESET_FILTERS[selectedPreset]?.minVolume 
                        }))}
                        className="font-mono h-8"
                        data-testid="input-min-volume"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="minRvol" className="text-xs text-muted-foreground">Min RVOL</Label>
                      <Input
                        id="minRvol"
                        type="number"
                        step="0.1"
                        placeholder="1.0x"
                        value={filters.minRvol ?? ""}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          minRvol: e.target.value ? Number(e.target.value) : PRESET_FILTERS[selectedPreset]?.minRvol 
                        }))}
                        className="font-mono h-8"
                        data-testid="input-min-rvol"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="excludeEtfs"
                        checked={filters.excludeEtfs ?? true}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, excludeEtfs: checked }))}
                        data-testid="switch-exclude-etfs"
                      />
                      <Label htmlFor="excludeEtfs" className="text-sm cursor-pointer">Exclude ETFs</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="excludeOtc"
                        checked={filters.excludeOtc ?? true}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, excludeOtc: checked }))}
                        data-testid="switch-exclude-otc"
                      />
                      <Label htmlFor="excludeOtc" className="text-sm cursor-pointer">Exclude OTC</Label>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Button
              onClick={handleRunScan}
              disabled={isScanning || !isConnected}
              size="lg"
              className="gap-2"
              data-testid="button-run-scan"
            >
              {isScanning ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : engineMode === "single" ? (
                <Search className="h-5 w-5" />
              ) : (
                <Layers className="h-5 w-5" />
              )}
              {isScanning 
                ? "Scanning..." 
                : engineMode === "single" 
                  ? "Run Scan" 
                  : "Run Fusion Scan"
              }
            </Button>

            {!isConnected && (
              <p className="text-sm text-muted-foreground">
                <Link href="/settings" className="text-primary underline">Connect your broker</Link> to run scans
              </p>
            )}

            {marketRegime && engineMode === "fusion" && (
              <div className="flex items-center gap-2 ml-auto">
                <Activity className={`h-4 w-4 ${getRegimeColor(marketRegime.regime)}`} />
                <span className="text-sm">Market:</span>
                <Badge variant="outline" className={getRegimeColor(marketRegime.regime)}>
                  {marketRegime.regime === "TRENDING" ? "Trending" : 
                   marketRegime.regime === "CHOPPY" ? "Choppy" : "Risk-Off"}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {lastScanTime && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <span>Last scan: {format(lastScanTime, "h:mm a")}</span>
            <span>({filteredResults?.length || 0} results)</span>
            {scanMetadata && (
              <>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Activity className="h-3 w-3" />
                  {scanMetadata.provider.toUpperCase()}
                </Badge>
                <span className="text-xs">
                  {scanMetadata.symbolsReturned}/{scanMetadata.symbolsRequested} symbols
                  {scanMetadata.batchCount && scanMetadata.batchCount > 1 && ` (${scanMetadata.batchCount} batches)`}
                  {" "}in {(scanMetadata.scanTimeMs / 1000).toFixed(1)}s
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter results..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9"
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      )}

      {engineMode === "single" && filteredResults && filteredResults.length > 0 && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="default" className="gap-1">
              Breakout <span className="font-mono">{triggeredCount}</span>
            </Badge>
            <Badge variant="secondary" className="gap-1">
              Ready <span className="font-mono">{readyCount}</span>
            </Badge>
            <Badge variant="outline" className="gap-1">
              Forming <span className="font-mono">{formingCount}</span>
            </Badge>
          </div>
          <ScannerTable
            results={filteredResults}
            onRowClick={handleRowClick}
            isLoading={isLoading}
          />
        </>
      )}

      {engineMode === "fusion" && confluenceResults && confluenceResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Confluence Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {confluenceResults.map((result) => (
                <div
                  key={result.symbol}
                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                  onClick={() => navigate(`/charts/${result.symbol}`)}
                  data-testid={`confluence-row-${result.symbol}`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{result.symbol}</p>
                      <p className="text-sm text-muted-foreground">{result.name}</p>
                    </div>
                    <Badge variant="outline">${result.price.toFixed(2)}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {result.matchedStrategies.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {getStrategyDisplayName(s)}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Score: {result.adjustedScore}/100
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {((engineMode === "single" && (!filteredResults || filteredResults.length === 0)) ||
        (engineMode === "fusion" && (!confluenceResults || confluenceResults.length === 0))) && 
        !isScanning && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="rounded-full bg-muted p-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <p className="text-lg font-medium">No results yet</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure your scan options above and click "Run Scan" to find trading opportunities.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
