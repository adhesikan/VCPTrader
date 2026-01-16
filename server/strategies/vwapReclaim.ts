import { StrategyPlugin, StrategyId, ScanInput, ScanResultOutput, PatternStage, StrategyConfig, StrategyLevels, PatternStageType } from "./types";
import { calcEMA, calcVWAP, calcRVOL, CandleData } from "../engine/indicators";

const defaultParams: StrategyConfig = {
  rvolThreshold: 1.5,
  trendBars: 10,
  emaTrendRequired: true,
};

function findVWAPReclaim(candles: CandleData[], vwap: number[], lookback: number = 10): number {
  let barsBelowVwap = 0;
  let reclaimIdx = -1;
  
  for (let i = candles.length - lookback; i < candles.length; i++) {
    if (i < 0) continue;
    
    if (candles[i].close < vwap[i]) {
      barsBelowVwap++;
    } else if (barsBelowVwap >= 2 && candles[i].close > vwap[i] && 
               (i === 0 || candles[i - 1].close <= vwap[i - 1])) {
      reclaimIdx = i;
      break;
    }
  }
  return reclaimIdx;
}

export const vwapReclaimStrategy: StrategyPlugin = {
  id: StrategyId.VWAP_RECLAIM,
  name: "VWAP Reclaim",
  description: "Identifies stocks reclaiming VWAP after trading below it, with volume confirmation",
  category: "intraday",
  timeframesSupported: ["1m", "5m", "15m"],
  defaultParams,

  scan(input: ScanInput): ScanResultOutput | null {
    const { symbol, candles, params, quote } = input;
    const config = { ...defaultParams, ...params };
    
    if (candles.length < 20) return null;
    
    const closes = candles.map(c => c.close);
    const vwap = calcVWAP(candles);
    const ema21 = calcEMA(closes, 21);
    const rvol = calcRVOL(candles);
    
    const currentPrice = candles[candles.length - 1].close;
    const currentVwap = vwap[vwap.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    
    if (config.emaTrendRequired && currentPrice < currentEma21) {
      return null;
    }
    
    const reclaimIdx = findVWAPReclaim(candles, vwap);
    const isAboveVwap = currentPrice > currentVwap;
    const hasVolume = rvol >= (config.rvolThreshold || 1.5);
    
    let stage: PatternStageType = PatternStage.FORMING;
    let score = 30;
    
    if (reclaimIdx > 0 && isAboveVwap) {
      if (hasVolume) {
        stage = PatternStage.BREAKOUT;
        score = 75 + Math.min(25, (rvol - 1.5) * 10);
      } else {
        stage = PatternStage.READY;
        score = 55 + Math.min(20, rvol * 10);
      }
    } else if (currentPrice < currentVwap && currentPrice > currentVwap * 0.99) {
      stage = PatternStage.FORMING;
      score = 35;
    } else {
      return null;
    }
    
    const reclaimCandleLow = reclaimIdx >= 0 ? candles[reclaimIdx].low : currentVwap * 0.99;
    const stopLevel = Math.min(currentVwap * 0.995, reclaimCandleLow);
    
    return {
      symbol,
      name: quote?.symbol || symbol,
      price: currentPrice,
      strategyId: StrategyId.VWAP_RECLAIM,
      stage,
      score: Math.round(Math.min(100, score)),
      levels: {
        resistance: undefined,
        support: currentVwap,
        entryTrigger: currentVwap * 1.001,
        stopLevel,
        exitRule: "Close below VWAP or EMA21",
        vwap: currentVwap,
      },
      ema21: currentEma21,
      vwap: currentVwap,
      rvol,
      explanation: this.explain({
        symbol,
        price: currentPrice,
        strategyId: StrategyId.VWAP_RECLAIM,
        stage,
        score,
        levels: { entryTrigger: currentVwap, stopLevel, exitRule: "Close below VWAP" },
        rvol,
        explanation: "",
      }),
    };
  },

  classify(stage) {
    switch (stage) {
      case PatternStage.FORMING:
        return { label: "Forming", description: "Price below VWAP, watching for reclaim" };
      case PatternStage.READY:
        return { label: "Ready", description: "Price reclaimed VWAP, waiting for volume confirmation" };
      case PatternStage.BREAKOUT:
        return { label: "Breakout", description: "VWAP reclaim confirmed with volume expansion" };
      default:
        return { label: stage, description: "" };
    }
  },

  getDefaultLevels(): Partial<StrategyLevels> {
    return { exitRule: "Close below VWAP or EMA21" };
  },

  score(result, regimeAdjustment = 0) {
    return Math.max(0, Math.min(100, result.score + regimeAdjustment));
  },

  explain(result) {
    const rvol = result.rvol?.toFixed(1) || "N/A";
    return `VWAP Reclaim ${result.stage}: Price ${result.price.toFixed(2)} has reclaimed VWAP. ` +
      `RVOL: ${rvol}x. Stop: ${result.levels.stopLevel.toFixed(2)}. ` +
      `This alert is informational only and not investment advice.`;
  },
};
