import { StrategyPlugin, StrategyId, ScanInput, ScanResultOutput, PatternStage, StrategyConfig, StrategyLevels, PatternStageType } from "./types";
import { calcEMA, calcRVOL, isTrending, CandleData } from "../engine/indicators";

const defaultParams: StrategyConfig = {
  rvolThreshold: 1.3,
  trendBars: 10,
  pullbackBarsMin: 3,
  pullbackBarsMax: 10,
};

function findPullbackToEMA(
  candles: CandleData[],
  ema9: number[],
  ema21: number[],
  lookback: number = 10
): { pullbackLow: number; pullbackHigh: number; barsInPullback: number } | null {
  if (candles.length < lookback) return null;
  
  let pullbackLow = Infinity;
  let pullbackHigh = 0;
  let barsInPullback = 0;
  let foundPullback = false;
  
  for (let i = candles.length - lookback; i < candles.length; i++) {
    if (i < 0) continue;
    const candle = candles[i];
    const e9 = ema9[i];
    const e21 = ema21[i];
    
    const touchedEmaZone = candle.low <= e9 * 1.01 && candle.low >= e21 * 0.99;
    const closedAboveEma21 = candle.close > e21;
    
    if (touchedEmaZone && closedAboveEma21) {
      foundPullback = true;
      barsInPullback++;
      pullbackLow = Math.min(pullbackLow, candle.low);
      pullbackHigh = Math.max(pullbackHigh, candle.high);
    }
  }
  
  if (!foundPullback) return null;
  
  return { pullbackLow, pullbackHigh, barsInPullback };
}

export const trendContinuationStrategy: StrategyPlugin = {
  id: StrategyId.TREND_CONTINUATION,
  name: "Trend Continuation",
  description: "Identifies pullbacks to EMA9/EMA21 zone in an established uptrend",
  category: "swing",
  timeframesSupported: ["15m", "1h", "1d"],
  defaultParams,

  scan(input: ScanInput): ScanResultOutput | null {
    const { symbol, candles, params, quote } = input;
    const config = { ...defaultParams, ...params };
    
    if (candles.length < 30) return null;
    
    const closes = candles.map(c => c.close);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);
    const rvol = calcRVOL(candles);
    
    const currentPrice = candles[candles.length - 1].close;
    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    const currentEma50 = ema50[ema50.length - 1];
    
    const inUptrend = currentPrice > currentEma21 && currentEma21 > currentEma50;
    if (!inUptrend) return null;
    
    const pullback = findPullbackToEMA(candles, ema9, ema21, config.pullbackBarsMax || 10);
    if (!pullback) return null;
    
    const { pullbackLow, pullbackHigh, barsInPullback } = pullback;
    
    if (barsInPullback < (config.pullbackBarsMin || 3)) return null;
    
    const currentCandle = candles[candles.length - 1];
    const breakoutAbovePullback = currentPrice > pullbackHigh;
    const hasVolume = rvol >= (config.rvolThreshold || 1.3);
    
    let stage: PatternStageType = PatternStage.FORMING;
    let score = 30;
    
    if (breakoutAbovePullback && hasVolume) {
      stage = PatternStage.TRIGGERED;
      score = 70 + Math.min(30, (rvol - 1.3) * 15 + barsInPullback * 2);
    } else if (breakoutAbovePullback) {
      stage = PatternStage.READY;
      score = 55 + Math.min(15, rvol * 5);
    } else if (currentPrice >= pullbackHigh * 0.99) {
      stage = PatternStage.READY;
      score = 50 + Math.min(20, barsInPullback * 2);
    } else {
      stage = PatternStage.FORMING;
      score = 35 + Math.min(15, barsInPullback * 2);
    }
    
    const stopLevel = Math.max(pullbackLow, currentEma21 * 0.99);
    
    return {
      symbol,
      name: quote?.symbol || symbol,
      price: currentPrice,
      strategyId: StrategyId.TREND_CONTINUATION,
      stage,
      score: Math.round(Math.min(100, score)),
      levels: {
        resistance: pullbackHigh,
        support: pullbackLow,
        entryTrigger: pullbackHigh,
        stopLevel,
        exitRule: "Close below EMA21",
      },
      ema9: currentEma9,
      ema21: currentEma21,
      rvol,
      explanation: this.explain({
        symbol,
        price: currentPrice,
        strategyId: StrategyId.TREND_CONTINUATION,
        stage,
        score,
        levels: { entryTrigger: pullbackHigh, stopLevel, exitRule: "" },
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: "",
      }),
    };
  },

  classify(stage) {
    switch (stage) {
      case PatternStage.FORMING:
        return { label: "Forming", description: "In uptrend, pulling back to EMA zone" };
      case PatternStage.READY:
        return { label: "Ready", description: "Pullback complete, near breakout level" };
      case PatternStage.TRIGGERED:
        return { label: "Triggered", description: "Trend continuation confirmed with volume" };
      default:
        return { label: stage, description: "" };
    }
  },

  getDefaultLevels(): Partial<StrategyLevels> {
    return { exitRule: "Close below EMA21" };
  },

  score(result, regimeAdjustment = 0) {
    return Math.max(0, Math.min(100, result.score + regimeAdjustment));
  },

  explain(result) {
    const rvol = result.rvol?.toFixed(1) || "N/A";
    return `Trend Continuation ${result.stage}: Price ${result.price.toFixed(2)} in uptrend. ` +
      `EMA9: ${result.ema9?.toFixed(2) || "N/A"}, EMA21: ${result.ema21?.toFixed(2) || "N/A"}. ` +
      `RVOL: ${rvol}x. This alert is informational only and not investment advice.`;
  },
};
