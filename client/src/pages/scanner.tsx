import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Search, Loader2, RefreshCw, List, Info, ChevronDown, ChevronRight, 
  TrendingUp, Layers, Activity, Zap, Target, X, LayoutGrid, LayoutList,
  AlertTriangle, Clock, CheckCircle2, Flame
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { ScanResult, ScannerFilters, Watchlist, StrategyInfo, OpportunityDefaults } from "@shared/schema";
import { STRATEGY_CONFIGS, getStrategyDisplayName, FUSION_ENGINE_CONFIG } from "@shared/strategies";
import { useBrokerStatus } from "@/hooks/use-broker-status";
import { cn } from "@/lib/utils";
import { Save } from "lucide-react";

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

interface UniverseData {
  symbols: string[];
  count: number;
}

interface UniversesResponse {
  dow30: UniverseData;
  nasdaq100: UniverseData;
  sp500: UniverseData;
  all: UniverseData;
}

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
    const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [featuredViewMode, setFeaturedViewMode] = useState<"cards" | "list">("cards");
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
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [autoRunOnLoad, setAutoRunOnLoad] = useState(false);
  const [shouldAutoRun, setShouldAutoRun] = useState(false);
  const [initialScanDone, setInitialScanDone] = useState(false);

  const { data: strategies } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
  });

  const { data: userDefaults, isLoading: defaultsLoading } = useQuery<OpportunityDefaults | null>({
    queryKey: ["/api/user/opportunity-defaults"],
  });

  const { data: watchlists, isLoading: watchlistsLoading } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const { data: storedResults, isLoading, refetch, dataUpdatedAt } = useQuery<ScanResult[]>({
    queryKey: ["/api/scan/results"],
  });

  const { data: universes } = useQuery<UniversesResponse>({
    queryKey: ["/api/universes"],
  });

  const UNIVERSE_OPTIONS = [
    { value: "sp500", label: "S&P 500", count: universes?.sp500?.count || 500 },
    { value: "nasdaq100", label: "Nasdaq 100", count: universes?.nasdaq100?.count || 100 },
    { value: "dow30", label: "Dow 30", count: universes?.dow30?.count || 30 },
    { value: "all", label: "Large Cap Universe", count: universes?.all?.count || "150+" },
  ];

  useEffect(() => {
    if (dataUpdatedAt && storedResults && storedResults.length > 0 && !liveResults) {
      setLastScanTime(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt, storedResults, liveResults]);

  useEffect(() => {
    if (userDefaults && !defaultsApplied && !defaultsLoading && !watchlistsLoading) {
      if (userDefaults.defaultMode) {
        setEngineMode(userDefaults.defaultMode as EngineMode);
      }
      if (userDefaults.defaultStrategyId) {
        setSelectedStrategy(userDefaults.defaultStrategyId);
      }
      if (userDefaults.defaultScanScope) {
        setTargetType(userDefaults.defaultScanScope as TargetType);
      }
      if (userDefaults.defaultWatchlistId) {
        const watchlistExists = watchlists?.some(w => w.id === userDefaults.defaultWatchlistId);
        if (watchlistExists) {
          setSelectedWatchlist(userDefaults.defaultWatchlistId);
        } else if (userDefaults.defaultWatchlistId !== "default") {
          toast({
            title: "Saved watchlist not found",
            description: "Using Default Watchlist instead",
          });
        }
      }
      if (userDefaults.defaultSymbol) {
        setSymbolInput(userDefaults.defaultSymbol);
      }
      if (userDefaults.defaultMarketIndex) {
        setSelectedUniverse(userDefaults.defaultMarketIndex);
      }
      if (userDefaults.defaultFilterPreset) {
        applyPreset(userDefaults.defaultFilterPreset);
      }
      if (userDefaults.autoRunOnLoad) {
        setAutoRunOnLoad(true);
        setShouldAutoRun(true);
      }
      setDefaultsApplied(true);
    }
  }, [userDefaults, defaultsApplied, defaultsLoading, watchlistsLoading, watchlists]);

  useEffect(() => {
    if (shouldAutoRun && defaultsApplied && isConnected && !runScanMutation.isPending && !confluenceMutation.isPending) {
      setShouldAutoRun(false);
      if (engineMode === "fusion") {
        confluenceMutation.mutate();
      } else {
        runScanMutation.mutate();
      }
    }
  }, [shouldAutoRun, defaultsApplied, isConnected, engineMode]);

  // Auto-run scan on page load (with or without saved defaults)
  useEffect(() => {
    const shouldRun = !initialScanDone && 
                      isConnected && 
                      !defaultsLoading && 
                      !watchlistsLoading &&
                      !runScanMutation.isPending && 
                      !confluenceMutation.isPending;
    
    if (shouldRun) {
      // If user has saved defaults with autoRunOnLoad, that effect will handle it
      // Otherwise, run with current/default settings after a short delay
      const hasAutoRunDefaults = userDefaults?.autoRunOnLoad;
      if (!hasAutoRunDefaults) {
        setInitialScanDone(true);
        // Small delay to ensure UI is ready
        setTimeout(() => {
          if (engineMode === "fusion") {
            confluenceMutation.mutate();
          } else {
            runScanMutation.mutate();
          }
        }, 500);
      } else {
        setInitialScanDone(true);
      }
    }
  }, [initialScanDone, isConnected, defaultsLoading, watchlistsLoading, userDefaults, engineMode]);

  const saveDefaultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/user/opportunity-defaults", {
        defaultMode: engineMode,
        defaultStrategyId: selectedStrategy,
        defaultScanScope: targetType,
        defaultWatchlistId: targetType === "watchlist" ? selectedWatchlist : null,
        defaultSymbol: targetType === "symbol" ? symbolInput : null,
        defaultMarketIndex: targetType === "universe" ? selectedUniverse : null,
        defaultFilterPreset: selectedPreset,
        autoRunOnLoad,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/opportunity-defaults"] });
      toast({
        title: "Default scan saved",
        description: "Your settings will be applied when you return",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save defaults",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    if (targetType === "universe" && universes) {
      const universeKey = selectedUniverse as keyof UniversesResponse;
      return universes[universeKey]?.symbols || undefined;
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6" />
            Opportunity Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find trading setups that match your strategy
          </p>
        </div>
      </div>

      {/* Featured Opportunities - Breakout & Triggered Symbols */}
      {liveResults && liveResults.filter(r => r.stage === "BREAKOUT" || r.stage === "TRIGGERED").length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Active Opportunities</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {liveResults.filter(r => r.stage === "BREAKOUT" || r.stage === "TRIGGERED").length} signals
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={featuredViewMode === "cards" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setFeaturedViewMode("cards")}
                  data-testid="button-view-cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={featuredViewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setFeaturedViewMode("list")}
                  data-testid="button-view-list"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {featuredViewMode === "cards" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {liveResults
                  .filter(r => r.stage === "BREAKOUT" || r.stage === "TRIGGERED")
                  .sort((a, b) => (b.patternScore || 0) - (a.patternScore || 0))
                  .map((result) => (
                    <Card 
                      key={result.id} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => navigate(`/charts/${result.ticker}`)}
                      data-testid={`card-opportunity-${result.ticker}`}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-base truncate">{result.ticker}</span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "shrink-0 text-xs",
                                result.stage === "BREAKOUT" && "bg-green-500/10 text-green-600 dark:text-green-400",
                                result.stage === "TRIGGERED" && "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              )}
                            >
                              {result.stage}
                            </Badge>
                          </div>
                          {result.patternScore && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {result.patternScore}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{result.name || result.ticker}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">${result.price?.toFixed(2)}</span>
                          <span className={cn(
                            "text-xs",
                            (result.changePercent || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {(result.changePercent || 0) >= 0 ? "+" : ""}{result.changePercent?.toFixed(2)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <div>
                            <span className="block text-muted-foreground/70">Resistance</span>
                            <span className="font-medium text-foreground">${result.resistance?.toFixed(2) || "N/A"}</span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground/70">Stop</span>
                            <span className="font-medium text-foreground">${result.stopLoss?.toFixed(2) || "N/A"}</span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground/70">Vol</span>
                            <span className="font-medium text-foreground">{result.volume ? (result.volume / 1000000).toFixed(1) + "M" : "N/A"}</span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground/70">RVOL</span>
                            <span className={cn(
                              "font-medium",
                              (result.rvol || 0) >= 1.5 ? "text-green-600 dark:text-green-400" : "text-foreground"
                            )}>
                              {result.rvol?.toFixed(1) || "N/A"}x
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <div className="space-y-1">
                {liveResults
                  .filter(r => r.stage === "BREAKOUT" || r.stage === "TRIGGERED")
                  .sort((a, b) => (b.patternScore || 0) - (a.patternScore || 0))
                  .map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between gap-4 p-2 rounded-md hover-elevate cursor-pointer"
                      onClick={() => navigate(`/charts/${result.ticker}`)}
                      data-testid={`row-opportunity-${result.ticker}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "shrink-0 text-xs w-20 justify-center",
                            result.stage === "BREAKOUT" && "bg-green-500/10 text-green-600 dark:text-green-400",
                            result.stage === "TRIGGERED" && "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          )}
                        >
                          {result.stage}
                        </Badge>
                        <div className="min-w-0">
                          <span className="font-semibold">{result.ticker}</span>
                          <span className="text-muted-foreground text-sm ml-2 hidden sm:inline">{result.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm shrink-0">
                        <span className="font-medium w-16 text-right">${result.price?.toFixed(2)}</span>
                        <span className={cn(
                          "w-16 text-right",
                          (result.changePercent || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {(result.changePercent || 0) >= 0 ? "+" : ""}{result.changePercent?.toFixed(2)}%
                        </span>
                        <span className="hidden md:block w-16 text-right text-muted-foreground">
                          R: ${result.resistance?.toFixed(0) || "N/A"}
                        </span>
                        <span className="hidden md:block w-16 text-right text-muted-foreground">
                          S: ${result.stopLoss?.toFixed(0) || "N/A"}
                        </span>
                        <span className={cn(
                          "hidden lg:block w-12 text-right",
                          (result.rvol || 0) >= 1.5 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                        )}>
                          {result.rvol?.toFixed(1)}x
                        </span>
                        {result.patternScore && (
                          <Badge variant="secondary" className="w-12 justify-center">{result.patternScore}%</Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">Large scan notice</p>
                          <p className="text-muted-foreground mt-1">
                            Scanning {universes?.all?.count || "150+"} stocks may take longer and use more API calls. 
                            Consider using price/volume filters to narrow results, or select a smaller index like S&P 500 or Nasdaq 100.
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

            <Button
              variant="outline"
              onClick={() => saveDefaultsMutation.mutate()}
              disabled={saveDefaultsMutation.isPending}
              className="gap-2"
              data-testid="button-save-defaults"
            >
              {saveDefaultsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save as Default
            </Button>

            <div className="flex items-center gap-2 ml-2">
              <Switch
                id="autoRunOnLoad"
                checked={autoRunOnLoad}
                onCheckedChange={setAutoRunOnLoad}
                data-testid="switch-auto-run"
              />
              <Label htmlFor="autoRunOnLoad" className="text-sm cursor-pointer whitespace-nowrap">Auto-run on load</Label>
            </div>

            {userDefaults && defaultsApplied && (
              <span className="text-xs text-muted-foreground ml-2">Using saved defaults</span>
            )}

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
