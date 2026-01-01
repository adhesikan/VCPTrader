import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriceChart, ChartPlaceholder } from "@/components/price-chart";
import type { ScanResult } from "@shared/schema";

interface ChartData {
  candles: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  ema9?: number[];
  ema21?: number[];
  resistance?: number;
  stopLoss?: number;
  ticker: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
}

const timeframes = [
  { value: "1D", label: "1 Day" },
  { value: "1W", label: "1 Week" },
  { value: "1M", label: "1 Month" },
  { value: "3M", label: "3 Months" },
  { value: "1Y", label: "1 Year" },
];

export default function Charts() {
  const [, params] = useRoute("/charts/:ticker");
  const initialTicker = params?.ticker || "";
  
  const [searchInput, setSearchInput] = useState(initialTicker);
  const [selectedTicker, setSelectedTicker] = useState(initialTicker);
  const [timeframe, setTimeframe] = useState("3M");

  useEffect(() => {
    if (params?.ticker) {
      setSelectedTicker(params.ticker);
      setSearchInput(params.ticker);
    }
  }, [params?.ticker]);

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartData>({
    queryKey: ["/api/charts", selectedTicker, timeframe],
    enabled: !!selectedTicker,
  });

  const { data: scanResult } = useQuery<ScanResult | null>({
    queryKey: ["/api/scan/result", selectedTicker],
    enabled: !!selectedTicker,
  });

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSelectedTicker(searchInput.trim().toUpperCase());
    }
  };

  const formatVolume = (vol: number | undefined) => {
    if (!vol) return "-";
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
    return vol.toFixed(0);
  };

  return (
    <div className="p-6 space-y-6" data-testid="charts-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Technical analysis with VCP overlays
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Input
              placeholder="Enter symbol..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="font-mono pr-10"
              data-testid="input-ticker-search"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={handleSearch}
              data-testid="button-search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32" data-testid="select-timeframe">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeframes.map((tf) => (
                <SelectItem key={tf.value} value={tf.value}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedTicker && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono">{selectedTicker}</span>
            {chartData?.name && (
              <span className="text-muted-foreground">{chartData.name}</span>
            )}
          </div>

          {chartData?.price && (
            <div className="flex items-center gap-2">
              <span className="text-xl font-mono font-semibold">
                ${chartData.price.toFixed(2)}
              </span>
              {chartData.changePercent !== undefined && (
                <Badge
                  variant={chartData.changePercent >= 0 ? "default" : "destructive"}
                  className="font-mono"
                >
                  {chartData.changePercent >= 0 ? "+" : ""}
                  {chartData.changePercent.toFixed(2)}%
                </Badge>
              )}
            </div>
          )}

          {scanResult?.stage && (
            <Badge 
              variant={
                scanResult.stage === "BREAKOUT" ? "default" :
                scanResult.stage === "READY" ? "secondary" : "outline"
              }
            >
              {scanResult.stage}
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {chartLoading ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          ) : chartData?.candles && chartData.candles.length > 0 ? (
            <PriceChart
              data={chartData.candles}
              ema9={chartData.ema9}
              ema21={chartData.ema21}
              resistanceLevel={chartData.resistance}
              stopLevel={chartData.stopLoss}
              ticker={selectedTicker}
              className="h-[500px]"
            />
          ) : (
            <ChartPlaceholder />
          )}
        </CardContent>
      </Card>

      {scanResult && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resistance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-lg font-mono font-semibold text-chart-2">
                ${scanResult.resistance?.toFixed(2) || "-"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Stop Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-lg font-mono font-semibold text-destructive">
                ${scanResult.stopLoss?.toFixed(2) || "-"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                RVOL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-lg font-mono font-semibold">
                {scanResult.rvol?.toFixed(2) || "-"}x
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pattern Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, scanResult.patternScore ?? 0)}%` }}
                  />
                </div>
                <span className="text-lg font-mono font-semibold w-8">
                  {scanResult.patternScore ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
