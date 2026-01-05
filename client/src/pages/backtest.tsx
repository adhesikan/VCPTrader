import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FlaskConical, Play, Trash2, Clock, Plug, Settings } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBrokerStatus } from "@/hooks/use-broker-status";
import type { BacktestResult } from "@shared/schema";

interface BacktestConfig {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  positionSize: number;
  stopLossPercent: number;
}

export default function Backtest() {
  const [config, setConfig] = useState<BacktestConfig>({
    ticker: "",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    initialCapital: 100000,
    positionSize: 5,
    stopLossPercent: 7,
  });
  const { toast } = useToast();
  const { isConnected } = useBrokerStatus();

  const { data: results, isLoading } = useQuery<BacktestResult[]>({
    queryKey: ["/api/backtest/results"],
  });

  const runBacktestMutation = useMutation({
    mutationFn: async (config: BacktestConfig) => {
      const response = await apiRequest("POST", "/api/backtest/run", config);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtest/results"] });
      toast({
        title: "Backtest Complete",
        description: "Results saved automatically",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Backtest Failed",
        description: error.message || "Failed to run backtest",
        variant: "destructive",
      });
    },
  });

  const deleteBacktestMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/backtest/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtest/results"] });
      toast({
        title: "Deleted",
        description: "Backtest result removed",
      });
    },
  });

  const updateConfig = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const latestResult = results && results.length > 0 ? results[0] : null;

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="backtest-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Backtest</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test VCP strategy on a single stock using broker historical data
          </p>
        </div>

        <Button
          onClick={() => runBacktestMutation.mutate(config)}
          disabled={runBacktestMutation.isPending || !config.ticker || !isConnected}
          className="gap-2"
          data-testid="button-run-backtest"
        >
          {runBacktestMutation.isPending ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Backtest
            </>
          )}
        </Button>
      </div>

      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <Plug className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Broker Connection Required
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Connect a broker to access historical data for backtesting
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-1">
              <Settings className="h-3 w-3" />
              Connect
            </Button>
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticker" className="text-xs uppercase tracking-wide text-muted-foreground">
                Stock Symbol
              </Label>
              <Input
                id="ticker"
                placeholder="AAPL, NVDA, MSFT..."
                value={config.ticker}
                onChange={(e) => updateConfig("ticker", e.target.value.toUpperCase())}
                className="font-mono"
                data-testid="input-ticker"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={config.startDate}
                  onChange={(e) => updateConfig("startDate", e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-xs uppercase tracking-wide text-muted-foreground">
                  End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={config.endDate}
                  onChange={(e) => updateConfig("endDate", e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital" className="text-xs uppercase tracking-wide text-muted-foreground">
                Initial Capital
              </Label>
              <Input
                id="capital"
                type="number"
                value={config.initialCapital}
                onChange={(e) => updateConfig("initialCapital", Number(e.target.value))}
                className="font-mono"
                data-testid="input-capital"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="posSize" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Position Size %
                </Label>
                <Input
                  id="posSize"
                  type="number"
                  value={config.positionSize}
                  onChange={(e) => updateConfig("positionSize", Number(e.target.value))}
                  className="font-mono"
                  data-testid="input-position-size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stopLoss" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Stop Loss %
                </Label>
                <Input
                  id="stopLoss"
                  type="number"
                  value={config.stopLossPercent}
                  onChange={(e) => updateConfig("stopLossPercent", Number(e.target.value))}
                  className="font-mono"
                  data-testid="input-stop-loss"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">Latest Result</CardTitle>
            {latestResult && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {latestResult.createdAt && format(new Date(latestResult.createdAt), "MMM d, h:mm a")}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {latestResult ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="font-mono text-sm">
                    {latestResult.ticker}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {latestResult.startDate} to {latestResult.endDate}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Return</p>
                    <p className={`text-2xl font-bold font-mono ${latestResult.totalReturn >= 0 ? "text-chart-2" : "text-destructive"}`}>
                      {latestResult.totalReturn >= 0 ? "+" : ""}{latestResult.totalReturn.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Win Rate</p>
                    <p className="text-2xl font-bold font-mono">{latestResult.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Sharpe Ratio</p>
                    <p className="text-2xl font-bold font-mono">{(latestResult.sharpeRatio || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Trades</p>
                    <p className="text-2xl font-bold font-mono">{latestResult.totalTrades}</p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Avg Return</p>
                    <p className={`text-2xl font-bold font-mono ${latestResult.avgReturn >= 0 ? "text-chart-2" : "text-destructive"}`}>
                      {latestResult.avgReturn >= 0 ? "+" : ""}{latestResult.avgReturn.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Max Drawdown</p>
                    <p className="text-2xl font-bold font-mono text-destructive">
                      -{latestResult.maxDrawdown.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {latestResult.trades && Array.isArray(latestResult.trades) && latestResult.trades.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Trade History</h3>
                    <div className="rounded-md border max-h-64 overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Entry</TableHead>
                            <TableHead>Exit</TableHead>
                            <TableHead className="text-right">Entry $</TableHead>
                            <TableHead className="text-right">Exit $</TableHead>
                            <TableHead className="text-right">Return</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(latestResult.trades as any[]).map((trade: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-muted-foreground text-sm">
                                {trade.entryDate}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {trade.exitDate}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${trade.entryPrice}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${trade.exitPrice}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${trade.returnPercent >= 0 ? "text-chart-2" : "text-destructive"}`}>
                                {trade.returnPercent >= 0 ? "+" : ""}{trade.returnPercent}%
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {trade.exitReason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FlaskConical className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No backtest results</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter a stock symbol and run a backtest to see results
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {results && results.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Saved Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead>Run Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice(1).map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-mono font-semibold">{result.ticker}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {result.startDate} to {result.endDate}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${result.totalReturn >= 0 ? "text-chart-2" : "text-destructive"}`}>
                        {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.winRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.totalTrades}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {result.createdAt && format(new Date(result.createdAt), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBacktestMutation.mutate(result.id)}
                          data-testid={`button-delete-${result.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
