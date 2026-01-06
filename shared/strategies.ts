import { StrategyType, type StrategyTypeValue } from "./schema";

export type StrategyCategory = "Momentum Engine" | "Trend Engine" | "Volatility Engine" | "Fusion Engine";

export interface StrategyConfig {
  id: StrategyTypeValue;
  legacyName: string;
  displayName: string;
  shortDescription: string;
  category: StrategyCategory;
  guideSlug: string;
  whatItLooksFor: string;
  coreConditions: string[];
  triggerAlerts: string[];
  riskExitReference: string[];
}

export const STRATEGY_CONFIGS: StrategyConfig[] = [
  {
    id: StrategyType.VCP,
    legacyName: "Intraday VCP",
    displayName: "Momentum Breakout",
    shortDescription: "Intraday contraction breakouts with trend and volume confirmation.",
    category: "Momentum Engine",
    guideSlug: "momentum-breakout",
    whatItLooksFor: "Same-day volatility contraction patterns with momentum breakout potential.",
    coreConditions: [
      "Price trading above EMA 9 and EMA 21",
      "Volatility contraction detected (ATR decreasing)",
      "Volume declining during consolidation phase",
      "Clear resistance level forming near recent highs",
    ],
    triggerAlerts: [
      "Price breaks above intraday resistance level",
      "Volume surge of 50%+ above average on breakout",
      "Pattern stage changes from READY to BREAKOUT",
    ],
    riskExitReference: [
      "Stop level reference: Below the last consolidation low",
      "Exit reference: When price closes below EMA 9",
      "Typical risk range: 3-5% from entry",
    ],
  },
  {
    id: StrategyType.VCP_MULTIDAY,
    legacyName: "Multi-timeframe VCP",
    displayName: "Power Breakout",
    shortDescription: "Multi-timeframe contraction breakouts for swing and position traders.",
    category: "Momentum Engine",
    guideSlug: "power-breakout",
    whatItLooksFor: "Multi-day volatility contraction patterns (T1, T2, T3 bases) developing over weeks.",
    coreConditions: [
      "Historical analysis over 30+ trading days",
      "Multiple contracting bases with each tighter than the previous",
      "EMA 9 above EMA 21 confirming uptrend",
      "Pivot point established at the high of the last contraction",
    ],
    triggerAlerts: [
      "Price closes above pivot level",
      "Volume expansion of 1.5x+ average on breakout day",
      "Pattern confirmation with 1%+ daily gain",
    ],
    riskExitReference: [
      "Stop level reference: Below the last contraction low",
      "Exit reference: When price closes below EMA 21 on daily chart",
      "Typical risk range: 5-10% from entry",
    ],
  },
  {
    id: StrategyType.ORB5,
    legacyName: "ORB 5m",
    displayName: "Open Drive (5m)",
    shortDescription: "Five-minute opening range breakouts with volume expansion.",
    category: "Momentum Engine",
    guideSlug: "open-drive-5m",
    whatItLooksFor: "Breakouts from the first 5 minutes of trading with momentum confirmation.",
    coreConditions: [
      "Opening range established in first 5 minutes",
      "Price consolidating near the high or low of opening range",
      "Above-average pre-market or opening volume",
      "Clear directional bias from opening action",
    ],
    triggerAlerts: [
      "Price breaks above the 5-minute opening range high",
      "Volume confirms breakout with 1.5x+ expansion",
      "Breakout holds for 1+ minute after trigger",
    ],
    riskExitReference: [
      "Stop level reference: Below the 5-minute range low",
      "Exit reference: First sign of momentum failure or VWAP break",
      "Typical risk range: 1-2% from entry",
    ],
  },
  {
    id: StrategyType.ORB15,
    legacyName: "ORB 15m",
    displayName: "Open Drive (15m)",
    shortDescription: "Fifteen-minute opening range breakouts with volume expansion.",
    category: "Momentum Engine",
    guideSlug: "open-drive-15m",
    whatItLooksFor: "Breakouts from the first 15 minutes of trading with stronger confirmation.",
    coreConditions: [
      "Opening range established in first 15 minutes",
      "More reliable range compared to 5-minute ORB",
      "Volume accumulation during opening period",
      "Trend alignment with daily chart direction",
    ],
    triggerAlerts: [
      "Price breaks above the 15-minute opening range high",
      "Volume confirms breakout with sustained expansion",
      "Price maintains above breakout level for confirmation",
    ],
    riskExitReference: [
      "Stop level reference: Below the 15-minute range low or midpoint",
      "Exit reference: Break below VWAP or opening range midpoint",
      "Typical risk range: 1-3% from entry",
    ],
  },
  {
    id: StrategyType.HIGH_RVOL,
    legacyName: "High RVOL Breakout",
    displayName: "Volume Surge",
    shortDescription: "High relative-volume breakouts from tight consolidations.",
    category: "Momentum Engine",
    guideSlug: "volume-surge",
    whatItLooksFor: "Stocks with unusual volume activity breaking out of consolidation ranges.",
    coreConditions: [
      "Relative volume (RVOL) at 2x+ normal levels",
      "Price in tight consolidation before volume surge",
      "No negative news catalyst (earnings miss, etc.)",
      "Sector or market conditions supportive",
    ],
    triggerAlerts: [
      "RVOL exceeds threshold with price breakout",
      "Price breaks above consolidation resistance",
      "Volume acceleration continues post-breakout",
    ],
    riskExitReference: [
      "Stop level reference: Below consolidation range low",
      "Exit reference: Volume declining with price stalling",
      "Typical risk range: 3-5% from entry",
    ],
  },
  {
    id: StrategyType.GAP_AND_GO,
    legacyName: "Gap & Go",
    displayName: "Gap Force",
    shortDescription: "Gap-up momentum conditions with continuation triggers.",
    category: "Momentum Engine",
    guideSlug: "gap-force",
    whatItLooksFor: "Stocks gapping up with strong pre-market action and continuation potential.",
    coreConditions: [
      "Gap up of 3%+ from previous close",
      "High pre-market volume indicating interest",
      "Positive catalyst (earnings, news, sector momentum)",
      "Price holding above VWAP in early trading",
    ],
    triggerAlerts: [
      "Gap holds and price breaks above pre-market high",
      "First pullback to VWAP followed by bounce",
      "Volume remains elevated above average",
    ],
    riskExitReference: [
      "Stop level reference: Below VWAP or gap fill level",
      "Exit reference: Failed breakout attempt or VWAP break",
      "Typical risk range: 2-4% from entry",
    ],
  },
  {
    id: StrategyType.CLASSIC_PULLBACK,
    legacyName: "Classic Pullback",
    displayName: "Precision Pullback",
    shortDescription: "Shallow pullback/flag setups in an uptrend with breakout triggers and tight risk.",
    category: "Trend Engine",
    guideSlug: "precision-pullback",
    whatItLooksFor: "Stocks in uptrends that have pulled back to moving average support levels.",
    coreConditions: [
      "Strong uptrend with EMA 9 above EMA 21",
      "Price pulls back to or near EMA 9 or EMA 21 support",
      "Pullback is shallow (typically under 10% from recent high)",
      "Volume declines during pullback phase",
    ],
    triggerAlerts: [
      "Price bounces off EMA support with volume confirmation",
      "Breakout above short-term consolidation during pullback",
      "Momentum indicators turning positive",
    ],
    riskExitReference: [
      "Stop level reference: Below the pullback low or EMA 21",
      "Exit reference: When trend structure breaks (EMA 9 crosses below EMA 21)",
      "Typical risk range: 3-6% from entry",
    ],
  },
  {
    id: StrategyType.TREND_CONTINUATION,
    legacyName: "Trend Continuation",
    displayName: "Trend Pilot",
    shortDescription: "Trend continuation pullbacks using moving-average structure.",
    category: "Trend Engine",
    guideSlug: "trend-pilot",
    whatItLooksFor: "Established trends with orderly pullbacks to moving average structure.",
    coreConditions: [
      "Clear uptrend on multiple timeframes",
      "Moving averages stacked in bullish order (EMA 9 > 21 > 50)",
      "Recent pullback to 21 or 50 EMA support",
      "RSI not overbought at entry point",
    ],
    triggerAlerts: [
      "Price reclaims short-term moving average after test",
      "Higher low formed during pullback",
      "Volume pickup on resumption candle",
    ],
    riskExitReference: [
      "Stop level reference: Below the 50 EMA or recent swing low",
      "Exit reference: Trend line break or moving average crossover",
      "Typical risk range: 4-8% from entry",
    ],
  },
  {
    id: StrategyType.VWAP_RECLAIM,
    legacyName: "VWAP Reclaim",
    displayName: "Institutional Reclaim",
    shortDescription: "VWAP reclaim conditions that can signal professional accumulation intraday.",
    category: "Trend Engine",
    guideSlug: "institutional-reclaim",
    whatItLooksFor: "Intraday VWAP reclaims that often indicate institutional buying interest.",
    coreConditions: [
      "Price trading below VWAP earlier in the session",
      "Strong reversal candle reclaiming VWAP",
      "Volume increasing on the reclaim move",
      "Daily chart in uptrend or at support",
    ],
    triggerAlerts: [
      "Price closes above VWAP after being below",
      "VWAP acts as support on retest",
      "Continuation above VWAP with sustained volume",
    ],
    riskExitReference: [
      "Stop level reference: Below the low of the reclaim candle",
      "Exit reference: Price loses VWAP again with volume",
      "Typical risk range: 1-3% from entry",
    ],
  },
  {
    id: StrategyType.VOLATILITY_SQUEEZE,
    legacyName: "Volatility Squeeze",
    displayName: "Pressure Break",
    shortDescription: "Volatility compression setups designed to catch expansion moves.",
    category: "Volatility Engine",
    guideSlug: "pressure-break",
    whatItLooksFor: "Extreme volatility compression (Bollinger Band squeeze) preceding expansion.",
    coreConditions: [
      "Bollinger Bands narrowing to multi-period low",
      "Keltner Channel inside Bollinger Bands (squeeze signal)",
      "Decreasing ATR indicating compression",
      "Price coiling near a key level",
    ],
    triggerAlerts: [
      "Squeeze fires with directional breakout",
      "Price breaks above/below compression range",
      "Volume expansion confirms breakout direction",
    ],
    riskExitReference: [
      "Stop level reference: Opposite side of the compression range",
      "Exit reference: When volatility contracts again or trend fails",
      "Typical risk range: 2-5% from entry",
    ],
  },
];

export const FUSION_ENGINE_CONFIG = {
  displayName: "Fusion Engine",
  shortDescription: "Ranks symbols where multiple strategy conditions align at the same time.",
  description: "The Fusion Engine identifies confluence opportunities where two or more strategies trigger simultaneously on the same symbol. Higher confluence scores indicate stronger setups with multiple confirming signals.",
};

export const STRATEGY_CATEGORIES: { name: StrategyCategory; description: string; strategies: StrategyTypeValue[] }[] = [
  {
    name: "Momentum Engine",
    description: "Breakout-focused strategies that capitalize on volatility expansion and momentum.",
    strategies: [
      StrategyType.VCP,
      StrategyType.VCP_MULTIDAY,
      StrategyType.ORB5,
      StrategyType.ORB15,
      StrategyType.HIGH_RVOL,
      StrategyType.GAP_AND_GO,
    ],
  },
  {
    name: "Trend Engine",
    description: "Trend-following strategies that identify pullback entries in established trends.",
    strategies: [
      StrategyType.CLASSIC_PULLBACK,
      StrategyType.TREND_CONTINUATION,
      StrategyType.VWAP_RECLAIM,
    ],
  },
  {
    name: "Volatility Engine",
    description: "Strategies that detect volatility compression and expansion patterns.",
    strategies: [
      StrategyType.VOLATILITY_SQUEEZE,
    ],
  },
];

export function getStrategyConfig(strategyId: StrategyTypeValue): StrategyConfig | undefined {
  return STRATEGY_CONFIGS.find((s) => s.id === strategyId);
}

export function getStrategyDisplayName(strategyId: StrategyTypeValue | string): string {
  const config = STRATEGY_CONFIGS.find((s) => s.id === strategyId);
  return config?.displayName || strategyId;
}

export function getStrategyShortDescription(strategyId: StrategyTypeValue | string): string {
  const config = STRATEGY_CONFIGS.find((s) => s.id === strategyId);
  return config?.shortDescription || "";
}

export function getStrategyCategory(strategyId: StrategyTypeValue | string): StrategyCategory | undefined {
  const config = STRATEGY_CONFIGS.find((s) => s.id === strategyId);
  return config?.category;
}

export function getStrategiesByCategory(category: StrategyCategory): StrategyConfig[] {
  return STRATEGY_CONFIGS.filter((s) => s.category === category);
}

export const ALERT_DISCLAIMER = "This alert is informational only and not investment advice.";
