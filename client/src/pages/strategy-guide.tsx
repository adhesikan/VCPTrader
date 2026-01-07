import { BookOpen, TrendingUp, Target, Shield, AlertTriangle, CheckCircle2, Zap, Activity, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STRATEGY_CONFIGS, FUSION_ENGINE_CONFIG, type StrategyConfig } from "@shared/strategies";

function StrategyCard({ strategy }: { strategy: StrategyConfig }) {
  return (
    <Card data-testid={`card-strategy-${strategy.guideSlug}`}>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          {strategy.displayName}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{strategy.shortDescription}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">What It Looks For</p>
          <p className="text-muted-foreground">{strategy.whatItLooksFor}</p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="font-medium">Core Conditions:</p>
          <ul className="space-y-1 text-muted-foreground">
            {strategy.coreConditions.map((condition, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Trigger Alerts</p>
          <ul className="space-y-1 text-muted-foreground">
            {strategy.triggerAlerts.map((trigger, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span>{trigger}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Risk / Exit Reference</p>
          <ul className="space-y-1 text-muted-foreground text-xs">
            {strategy.riskExitReference.map((ref, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span>{ref}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

const momentumStrategies = STRATEGY_CONFIGS.filter(s => s.category === "Momentum Engine");
const trendStrategies = STRATEGY_CONFIGS.filter(s => s.category === "Trend Engine");
const volatilityStrategies = STRATEGY_CONFIGS.filter(s => s.category === "Volatility Engine");

export default function StrategyGuide() {
  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="strategy-guide-page">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Strategy Guide</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Learn about our supported trading strategies organized by category
        </p>
      </div>

      <Tabs defaultValue="momentum" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="momentum" data-testid="tab-momentum" className="gap-1">
            <Zap className="h-3 w-3" />
            Momentum
          </TabsTrigger>
          <TabsTrigger value="trend" data-testid="tab-trend" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            Trend
          </TabsTrigger>
          <TabsTrigger value="volatility" data-testid="tab-volatility" className="gap-1">
            <Activity className="h-3 w-3" />
            Volatility
          </TabsTrigger>
          <TabsTrigger value="fusion" data-testid="tab-fusion" className="gap-1">
            <Layers className="h-3 w-3" />
            Fusion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="momentum" className="space-y-6 mt-6">
          <Card data-testid="card-momentum-intro">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Momentum Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Momentum Engine strategies focus on <strong>breakout setups</strong> where volatility 
                expansion is expected. These strategies look for consolidation patterns, volume surges, 
                and directional momentum to identify potential entry points.
              </p>
              <div className="flex flex-wrap gap-2">
                {momentumStrategies.map(s => (
                  <Badge key={s.id} variant="secondary">{s.displayName}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {momentumStrategies.map(strategy => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>

          <Card data-testid="card-momentum-stages">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Momentum Pattern Stages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                VCP Trader classifies momentum patterns into stages to help identify the best opportunities.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-muted-foreground/30">
                  <Badge variant="outline">FORMING</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Early stage - pattern is developing but needs more time. Add to watchlist and monitor.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30">
                  <Badge variant="secondary">READY</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Pattern is mature with tight range near resistance. Watch closely for breakout trigger.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-chart-2/30">
                  <Badge variant="default">BREAKOUT</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Price has broken above resistance with volume confirmation. Potential entry signal.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend" className="space-y-6 mt-6">
          <Card data-testid="card-trend-intro">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trend Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Trend Engine strategies focus on <strong>pullback entries</strong> within established 
                uptrends. These strategies identify when trending stocks pull back to support levels, 
                offering potentially lower-risk entry points before the trend resumes.
              </p>
              <div className="flex flex-wrap gap-2">
                {trendStrategies.map(s => (
                  <Badge key={s.id} variant="secondary">{s.displayName}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {trendStrategies.map(strategy => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>

          <Card data-testid="card-trend-stages">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Trend Pattern Stages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Trend-following strategies use the TRIGGERED stage to indicate a potential entry.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-muted-foreground/30">
                  <Badge variant="outline">FORMING</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Stock is in an uptrend and starting to pull back. Too early for entry.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30">
                  <Badge variant="secondary">READY</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Pullback has reached support zone. Watch for bounce confirmation.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-chart-2/30">
                  <Badge variant="default">TRIGGERED</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Price has bounced with volume confirmation. Potential entry signal.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volatility" className="space-y-6 mt-6">
          <Card data-testid="card-volatility-intro">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Volatility Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Volatility Engine strategies focus on <strong>compression and expansion</strong> patterns. 
                These strategies identify when volatility contracts to extreme levels, often preceding 
                significant price moves when the compression releases.
              </p>
              <div className="flex flex-wrap gap-2">
                {volatilityStrategies.map(s => (
                  <Badge key={s.id} variant="secondary">{s.displayName}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {volatilityStrategies.map(strategy => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>

          <Card data-testid="card-volatility-stages">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Volatility Squeeze Stages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-muted-foreground/30">
                  <Badge variant="outline">FORMING</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Squeeze on - Bollinger Bands inside Keltner Channels. Volatility compressing.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30">
                  <Badge variant="secondary">READY</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Squeeze about to fire, near breakout level. Watch for directional signal.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-chart-2/30">
                  <Badge variant="default">TRIGGERED</Badge>
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs">
                      Squeeze fired - breakout with volume expansion. Potential entry signal.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fusion" className="space-y-6 mt-6">
          <Card data-testid="card-fusion-intro">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {FUSION_ENGINE_CONFIG.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                {FUSION_ENGINE_CONFIG.description}
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium">How It Works:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                    <span>Scans all active strategies simultaneously</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                    <span>Ranks symbols by number of matching strategies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                    <span>Applies market regime adjustments to scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                    <span>Higher confluence = higher confidence setup</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card data-testid="card-fusion-scoring">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Confluence Scoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>
                  Each strategy that triggers on a symbol adds to its confluence score. 
                  The score is then adjusted based on the current market regime.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge variant="default" className="mt-0.5">1</Badge>
                    <div>
                      <p className="font-medium">Base Score (0-100)</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Average of individual strategy scores
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge variant="default" className="mt-0.5">2</Badge>
                    <div>
                      <p className="font-medium">Confluence Bonus</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        +10 points per additional matching strategy
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge variant="default" className="mt-0.5">3</Badge>
                    <div>
                      <p className="font-medium">Regime Adjustment</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Trending market boosts scores; Risk-Off market reduces them
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-fusion-strategies">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Included Strategies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  The Fusion Engine combines signals from all available strategies:
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-xs mb-2 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Momentum Engine
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {momentumStrategies.map(s => (
                        <Badge key={s.id} variant="outline" className="text-xs">{s.displayName}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-xs mb-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Trend Engine
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {trendStrategies.map(s => (
                        <Badge key={s.id} variant="outline" className="text-xs">{s.displayName}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-xs mb-2 flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Volatility Engine
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {volatilityStrategies.map(s => (
                        <Badge key={s.id} variant="outline" className="text-xs">{s.displayName}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card data-testid="card-risk-management">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Management (All Strategies)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Proper risk management is essential for long-term trading success. 
            Never risk more than you can afford to lose on any single trade.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
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
                Place stops at logical support levels - below pattern lows 
                or key moving averages. Never move stops down.
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
