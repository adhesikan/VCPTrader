import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FlaskConical, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface BacktestConfig {
  startDate: string;
  endDate: string;
  universe: string;
  initialCapital: number;
  positionSize: number;
  stopLossPercent: number;
}

interface BacktestResult {
  id: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  trades: Array<{
    ticker: string;
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    returnPercent: number;
    exitReason: string;
  }>;
}

export default function Backtest() {
  const [config, setConfig] = useState<BacktestConfig>({
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    universe: "sp500",
    initialCapital: 100000,
    positionSize: 5,
    stopLossPercent: 7,
  });
  const { toast } = useToast();

  const { data: result, isLoading } = useQuery<BacktestResult | null>({
    queryKey: ["/api/backtest/latest"],
  });

  const runBacktestMutation = useMutation({
    mutationFn: async (config: BacktestConfig) => {
      const response = await apiRequest("POST", "/api/backtest/run", config);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtest/latest"] });
      toast({
        title: "Backtest Complete",
        description: "Results are ready for review",
      });
    },
    onError: (error) => {
      toast({
        title: "Backtest Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateConfig = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6" data-testid="backtest-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backtest</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test VCP strategy on historical data
          </p>
        </div>

        <Button
          onClick={() => runBacktestMutation.mutate(config)}
          disabled={runBacktestMutation.isPending}
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="universe" className="text-xs uppercase tracking-wide text-muted-foreground">
                Universe
              </Label>
              <Select value={config.universe} onValueChange={(v) => updateConfig("universe", v)}>
                <SelectTrigger id="universe" data-testid="select-universe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All US Stocks</SelectItem>
                  <SelectItem value="sp500">S&P 500</SelectItem>
                  <SelectItem value="nasdaq100">Nasdaq 100</SelectItem>
                </SelectContent>
              </Select>
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
            <CardTitle className="text-base font-medium">Results</CardTitle>
            {result && (
              <Button variant="outline" size="sm" className="gap-1">
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Return</p>
                    <p className={`text-2xl font-bold font-mono ${result.totalReturn >= 0 ? "text-chart-2" : "text-destructive"}`}>
                      {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Win Rate</p>
                    <p className="text-2xl font-bold font-mono">{result.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Sharpe Ratio</p>
                    <p className="text-2xl font-bold font-mono">{result.sharpeRatio.toFixed(2)}</p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Trades</p>
                    <p className="text-2xl font-bold font-mono">{result.totalTrades}</p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Avg Return</p>
                    <p className={`text-2xl font-bold font-mono ${result.avgReturn >= 0 ? "text-chart-2" : "text-destructive"}`}>
                      {result.avgReturn >= 0 ? "+" : ""}{result.avgReturn.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-md bg-muted/50">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Max Drawdown</p>
                    <p className="text-2xl font-bold font-mono text-destructive">
                      -{result.maxDrawdown.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {result.trades && result.trades.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Recent Trades</h3>
                    <div className="rounded-md border max-h-64 overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Entry</TableHead>
                            <TableHead>Exit</TableHead>
                            <TableHead className="text-right">Return</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.trades.slice(0, 10).map((trade, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono font-semibold">{trade.ticker}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {trade.entryDate}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {trade.exitDate}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${trade.returnPercent >= 0 ? "text-chart-2" : "text-destructive"}`}>
                                {trade.returnPercent >= 0 ? "+" : ""}{trade.returnPercent.toFixed(1)}%
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
                  Configure parameters and run a backtest to see results
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
