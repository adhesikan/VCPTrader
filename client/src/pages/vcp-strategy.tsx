import { BookOpen, TrendingUp, Target, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function VCPStrategy() {
  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="vcp-strategy-page">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">VCP Strategy Guide</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Learn about volatility contraction setups and breakout conditions
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-vcp-overview">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              What is VCP?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              A <strong>volatility contraction pattern</strong> is a technical market structure where price ranges 
              tighten as a stock consolidates near resistance. This behavior can reflect decreasing selling pressure 
              while buyers remain active, and may precede a breakout when demand overwhelms supply.
            </p>
            <p>
              VCP Trader identifies these contraction phases using objective price, volume, and moving-average data 
              to help traders surface potential breakout conditions.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">Key Characteristics:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                  <span>Multiple contractions (T1, T2, T3...) with each smaller than the last</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                  <span>Volume typically decreases during consolidation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                  <span>Price stays above key moving averages (EMA 21, EMA 50)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                  <span>Clear resistance level forms (pivot point)</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-entry-strategy">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Entry Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              The ideal entry point is when price breaks above the resistance level 
              (pivot point) with <strong>increased volume</strong>.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="default" className="mt-0.5">1</Badge>
                <div>
                  <p className="font-medium">Identify the Pattern</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Look for stocks showing 2-4 contractions with decreasing range
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="default" className="mt-0.5">2</Badge>
                <div>
                  <p className="font-medium">Mark the Pivot</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Identify the resistance level from the highest point of the base
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="default" className="mt-0.5">3</Badge>
                <div>
                  <p className="font-medium">Wait for Breakout</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Enter when price breaks above pivot with volume 50%+ above average
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="default" className="mt-0.5">4</Badge>
                <div>
                  <p className="font-medium">Set Stop Loss</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Place stop below the last contraction low (typically 5-8% risk)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-risk-management">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Proper risk management is essential for long-term trading success. 
              Never risk more than you can afford to lose on any single trade.
            </p>
            <div className="grid gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Position Sizing</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Risk no more than 1-2% of your account on any single trade. 
                  Calculate position size based on your stop loss distance.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Stop Loss Placement</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Place stops below the low of the last contraction or below 
                  the EMA 21. Never move stops down.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Profit Taking</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Consider taking partial profits at 15-20% gain. Trail stops 
                  using EMA 21 or EMA 9 for remaining position.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pattern-stages">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pattern Stages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              VCP Trader automatically classifies patterns into stages to help you 
              identify the best opportunities.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-muted-foreground/30">
                <Badge variant="outline">FORMING</Badge>
                <div className="flex-1">
                  <p className="text-muted-foreground text-xs">
                    Early stage - volatility is starting to contract but pattern needs more time. 
                    Add to watchlist and monitor.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30">
                <Badge variant="secondary">READY</Badge>
                <div className="flex-1">
                  <p className="text-muted-foreground text-xs">
                    Pattern is mature with tight range near resistance. Watch closely 
                    for breakout trigger.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-chart-2/30">
                <Badge variant="default">BREAKOUT</Badge>
                <div className="flex-1">
                  <p className="text-muted-foreground text-xs">
                    Price has broken above resistance with volume confirmation. 
                    Potential entry signal.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-trading-checklist">
        <CardHeader>
          <CardTitle className="text-base font-medium">Checklist Before Trading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="font-medium text-sm">Stock Selection</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Price above EMA 50 and EMA 200
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  RS Rating above 80 (relative strength)
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Recent earnings growth or catalyst
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Industry group showing strength
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-sm">Pattern Quality</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  2-4 contractions visible
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Each contraction smaller than previous
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Volume declining during consolidation
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Clear resistance level identified
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-sm">Entry Confirmation</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Price breaks above pivot point
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Volume 50%+ above average
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Market conditions favorable
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Risk/reward ratio at least 2:1
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
          <strong>Disclaimer:</strong> This educational content is for informational purposes only 
          and does not constitute investment advice. Trading involves substantial risk of loss. 
          Past performance is not indicative of future results. Always do your own research and 
          consider consulting with a qualified financial advisor before making investment decisions.
        </p>
      </div>
    </div>
  );
}
