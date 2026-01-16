import { StrategyPlugin, StrategyId, ScanInput, ScanResultOutput, PatternStage, StrategyConfig, StrategyLevels, PatternStageType } from "./types";
import { calcRVOL, findConsolidationRange, CandleData } from "../engine/indicators";

const defaultParams: StrategyConfig = {
  rvolThreshold: 2.0,
  consolidationBars: 10,
};

export const highRvolStrategy: StrategyPlugin = {
  id: StrategyId.HIGH_RVOL,
  name: "High RVOL Breakout",
  description: "Identifies breakouts from tight consolidation with high relative volume",
  category: "breakout",
  timeframesSupported: ["5m", "15m", "1d"],
  defaultParams,

  scan(input: ScanInput): ScanResultOutput | null {
    const { symbol, candles, params, quote } = input;
    const config = { ...defaultParams, ...params };
    
    if (candles.length < 20) return null;
    
    const rvol = calcRVOL(candles);
    const hasHighVolume = rvol >= (config.rvolThreshold || 2.0);
    
    if (!hasHighVolume && rvol < 1.5) return null;
    
    const consolidation = findConsolidationRange(candles, config.consolidationBars || 10);
    if (!consolidation) return null;
    
    const isTightRange = consolidation.rangePercent < 5;
    if (!isTightRange) return null;
    
    const currentCandle = candles[candles.length - 1];
    const currentPrice = currentCandle.close;
    
    const breakoutAbove = currentPrice > consolidation.high;
    const nearBreakout = currentPrice > consolidation.high * 0.99;
    
    let stage: PatternStageType = PatternStage.FORMING;
    let score = 30;
    
    if (breakoutAbove && hasHighVolume) {
      stage = PatternStage.BREAKOUT;
      score = 75 + Math.min(25, (rvol - 2) * 10);
    } else if (breakoutAbove) {
      stage = PatternStage.READY;
      score = 55 + Math.min(15, rvol * 5);
    } else if (nearBreakout && hasHighVolume) {
      stage = PatternStage.READY;
      score = 50 + Math.min(20, rvol * 5);
    } else if (isTightRange && rvol >= 1.5) {
      stage = PatternStage.FORMING;
      score = 35 + Math.min(15, (3 - consolidation.rangePercent) * 5);
    } else {
      return null;
    }
    
    const stopLevel = Math.min(consolidation.low, currentCandle.low);
    
    return {
      symbol,
      name: quote?.symbol || symbol,
      price: currentPrice,
      strategyId: StrategyId.HIGH_RVOL,
      stage,
      score: Math.round(Math.min(100, score)),
      levels: {
        resistance: consolidation.high,
        support: consolidation.low,
        entryTrigger: consolidation.high,
        stopLevel,
        exitRule: "Close below consolidation low",
      },
      rvol,
      explanation: this.explain({
        symbol,
        price: currentPrice,
        strategyId: StrategyId.HIGH_RVOL,
        stage,
        score,
        levels: { entryTrigger: consolidation.high, stopLevel, exitRule: "" },
        rvol,
        explanation: "",
      }),
    };
  },

  classify(stage) {
    switch (stage) {
      case PatternStage.FORMING:
        return { label: "Forming", description: "Tight consolidation detected with building volume" };
      case PatternStage.READY:
        return { label: "Ready", description: "High RVOL detected, near or at breakout level" };
      case PatternStage.BREAKOUT:
        return { label: "Breakout", description: "Breakout confirmed with RVOL > 2.0x" };
      default:
        return { label: stage, description: "" };
    }
  },

  getDefaultLevels(): Partial<StrategyLevels> {
    return { exitRule: "Close below consolidation low" };
  },

  score(result, regimeAdjustment = 0) {
    return Math.max(0, Math.min(100, result.score + regimeAdjustment));
  },

  explain(result) {
    const rvol = result.rvol?.toFixed(1) || "N/A";
    return `High RVOL ${result.stage}: Price ${result.price.toFixed(2)} with RVOL ${rvol}x. ` +
      `Entry: ${result.levels.entryTrigger.toFixed(2)}, Stop: ${result.levels.stopLevel.toFixed(2)}. ` +
      `This alert is informational only and not investment advice.`;
  },
};
