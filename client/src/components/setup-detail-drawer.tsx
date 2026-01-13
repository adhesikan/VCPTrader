import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Target, TrendingUp, AlertTriangle, ExternalLink, Bell, Zap, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScanResult } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SetupDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result: ScanResult | null;
  strategyName?: string;
  onCreateAlert?: () => void;
}

interface AlgoPilotxConnection {
  connected: boolean;
  connectionType?: string;
  webhookUrl?: string;
}

export function SetupDetailDrawer({ 
  isOpen, 
  onClose, 
  result, 
  strategyName = "VCP",
  onCreateAlert 
}: SetupDetailDrawerProps) {
  const { toast } = useToast();
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);

  const { data: algoPilotxConnection } = useQuery<AlgoPilotxConnection>({
    queryKey: ["/api/algo-pilotx/connection"],
    enabled: isOpen,
  });

  const sendSetupMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No result selected");
      const response = await apiRequest("POST", "/api/execution/send", {
        symbol: result.ticker,
        strategyId: strategyName,
        timeframe: "1D",
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Setup Sent",
        description: "Opening AlgoPilotX InstaTrade™...",
      });
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/execution-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send setup to AlgoPilotX",
        variant: "destructive",
      });
    },
  });

  const handleOpenInAlgoPilotX = () => {
    if (!algoPilotxConnection?.connected) {
      setShowConnectPrompt(true);
      return;
    }
    sendSetupMutation.mutate();
  };

  if (!result) return null;

  const priceChange = result.changePercent || 0;
  const isPositive = priceChange >= 0;
  const riskReward = result.resistance && result.stopLoss && result.price
    ? ((result.resistance - result.price) / (result.price - result.stopLoss)).toFixed(2)
    : null;

  const stageColor = {
    "FORMING": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    "READY": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "BREAKOUT": "bg-green-500/10 text-green-600 dark:text-green-400",
    "TRIGGERED": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }[result.stage?.toUpperCase() || "FORMING"] || "bg-muted text-muted-foreground";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-2xl font-bold">{result.ticker}</SheetTitle>
              <Badge className={cn("text-xs", stageColor)}>
                {result.stage}
              </Badge>
            </div>
            {result.patternScore && (
              <Badge variant="secondary" className="text-sm">
                {result.patternScore}% Score
              </Badge>
            )}
          </div>
          <SheetDescription className="text-base">{result.name || result.ticker}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">${result.price?.toFixed(2)}</p>
              <p className={cn(
                "text-sm flex items-center gap-1",
                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {isPositive ? "+" : ""}{priceChange.toFixed(2)}%
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {strategyName}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Key Levels
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {result.resistance && (
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">Resistance (Entry)</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      ${result.resistance.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              )}
              {result.stopLoss && (
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">Stop Loss</p>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                      ${result.stopLoss.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              )}
              {result.rvol && (
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">RVOL</p>
                    <p className={cn(
                      "text-lg font-semibold",
                      result.rvol >= 1.5 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}>
                      {result.rvol.toFixed(2)}x
                    </p>
                  </CardContent>
                </Card>
              )}
              {riskReward && (
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">Risk/Reward</p>
                    <p className="text-lg font-semibold">
                      1:{riskReward}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {(result.ema9 || result.ema21) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Technical Indicators
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {result.ema9 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">9 EMA:</span>{" "}
                      <span className="font-medium">${result.ema9.toFixed(2)}</span>
                    </div>
                  )}
                  {result.ema21 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">21 EMA:</span>{" "}
                      <span className="font-medium">${result.ema21.toFixed(2)}</span>
                    </div>
                  )}
                  {result.atr && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">ATR:</span>{" "}
                      <span className="font-medium">${result.atr.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Info className="h-4 w-4" />
              Setup Explanation
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.stage === "BREAKOUT" || result.stage === "TRIGGERED"
                ? `${result.ticker} has broken above resistance${result.resistance ? ` at $${result.resistance.toFixed(2)}` : ""} with ${result.rvol && result.rvol >= 1.5 ? "strong" : "moderate"} volume confirmation.${result.stopLoss ? ` Consider entries with stop at $${result.stopLoss.toFixed(2)}.` : ""}`
                : result.stage === "READY"
                ? `${result.ticker} is approaching resistance${result.resistance ? ` at $${result.resistance.toFixed(2)}` : ""}. Watch for a breakout with volume above 1.5x average.`
                : `${result.ticker} is forming a ${strategyName} pattern. Volatility is contracting as the stock consolidates${result.price ? ` near $${result.price.toFixed(2)}` : ""}.`
              }
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={onCreateAlert}
                data-testid="button-create-alert"
              >
                <Bell className="h-4 w-4" />
                Create Alert
              </Button>
              <Button 
                className="flex-1 gap-2"
                onClick={handleOpenInAlgoPilotX}
                disabled={sendSetupMutation.isPending}
                data-testid="button-open-algopilotx"
              >
                <ExternalLink className="h-4 w-4" />
                {sendSetupMutation.isPending ? "Sending..." : "Open in AlgoPilotX"}
              </Button>
            </div>

            {showConnectPrompt && !algoPilotxConnection?.connected && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Connect AlgoPilotX</p>
                      <p className="text-sm text-muted-foreground">
                        Execute this setup with InstaTrade™ and automated risk controls.
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    className="w-full gap-2"
                    onClick={() => window.location.href = "/automation"}
                    data-testid="button-connect-algopilotx"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Connect AlgoPilotX
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Educational & informational only. Not investment advice.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
