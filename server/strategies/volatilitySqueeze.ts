import { StrategyPlugin, StrategyId, ScanInput, ScanResultOutput, PatternStage, StrategyConfig, StrategyLevels, PatternStageType } from "./types";
import { calcEMA, calcBollingerBands, calcKeltnerChannels, detectSqueeze, calcRVOL, findConsolidationRange, CandleData } from "../engine/indicators";

const defaultParams: StrategyConfig = {
  squeezeBars: 5,
  rvolThreshold: 1.3,
};

export const volatilitySqueezeStrategy: StrategyPlugin = {
  id: StrategyId.VOLATILITY_SQUEEZE,
  name: "Volatility Squeeze",
  description: "Identifies TTM Squeeze-style setups where Bollinger Bands are inside Keltner Channels",
  category: "breakout",
  timeframesSupported: ["5m", "15m", "1h", "1d"],
  defaultParams,

  scan(input: ScanInput): ScanResultOutput | null {
    const { symbol, candles, params, quote } = input;
    const config = { ...defaultParams, ...params };
    
    if (candles.length < 30) return null;
    
    const closes = candles.map(c => c.close);
    const ema21 = calcEMA(closes, 21);
    const bb = calcBollingerBands(closes, 20, 2);
    const kc = calcKeltnerChannels(candles, 20, 1.5);
    const rvol = calcRVOL(candles);
    
    const squeeze = detectSqueeze(bb, kc, config.squeezeBars || 5);
    const consolidation = findConsolidationRange(candles, 10);
    
    const currentCandle = candles[candles.length - 1];
    const currentPrice = currentCandle.close;
    const currentEma21 = ema21[ema21.length - 1];
    const currentBBUpper = bb.upper[bb.upper.length - 1];
    const currentBBLower = bb.lower[bb.lower.length - 1];
    
    const hasVolume = rvol >= (config.rvolThreshold || 1.3);
    
    if (!squeeze.squeezeOn && squeeze.squeezeCount < 3) {
      return null;
    }
    
    const squeezeRangeHigh = consolidation?.high || currentBBUpper;
    const squeezeRangeLow = consolidation?.low || currentBBLower;
    
    const breakoutAboveBB = currentPrice > currentBBUpper;
    const breakoutAboveRange = currentPrice > squeezeRangeHigh;
    const nearBreakout = currentPrice > squeezeRangeHigh * 0.99;
    
    let stage: PatternStageType = PatternStage.FORMING;
    let score = 30;
    
    if ((breakoutAboveBB || breakoutAboveRange) && hasVolume) {
      stage = PatternStage.BREAKOUT;
      score = 70 + Math.min(30, squeeze.squeezeCount * 3 + (rvol - 1.3) * 10);
    } else if (breakoutAboveBB || breakoutAboveRange) {
      stage = PatternStage.READY;
      score = 55 + Math.min(15, squeeze.squeezeCount * 2);
    } else if (squeeze.squeezeOn && nearBreakout) {
      stage = PatternStage.READY;
      score = 50 + Math.min(20, squeeze.squeezeCount * 2 + rvol * 3);
    } else if (squeeze.squeezeOn) {
      stage = PatternStage.FORMING;
      score = 35 + Math.min(15, squeeze.squeezeCount * 2);
    } else {
      return null;
    }
    
    const stopLevel = Math.min(squeezeRangeLow, currentEma21 * 0.99);
    
    return {
      symbol,
      name: quote?.symbol || symbol,
      price: currentPrice,
      strategyId: StrategyId.VOLATILITY_SQUEEZE,
      stage,
      score: Math.round(Math.min(100, score)),
      levels: {
        resistance: squeezeRangeHigh,
        support: squeezeRangeLow,
        entryTrigger: squeezeRangeHigh,
        stopLevel,
        exitRule: "Close back inside range or below EMA21",
      },
      ema21: currentEma21,
      rvol,
      explanation: this.explain({
        symbol,
        price: currentPrice,
        strategyId: StrategyId.VOLATILITY_SQUEEZE,
        stage,
        score,
        levels: { entryTrigger: squeezeRangeHigh, stopLevel, exitRule: "" },
        rvol,
        explanation: "",
      }),
    };
  },

  classify(stage) {
    switch (stage) {
      case PatternStage.FORMING:
        return { label: "Squeeze On", description: "Bollinger Bands inside Keltner Channels - volatility contracting" };
      case PatternStage.READY:
        return { label: "Squeeze Firing", description: "Near breakout level, squeeze about to fire" };
      case PatternStage.BREAKOUT:
        return { label: "Breakout", description: "Breakout from squeeze with volume expansion" };
      default:
        return { label: stage, description: "" };
    }
  },

  getDefaultLevels(): Partial<StrategyLevels> {
    return { exitRule: "Close back inside range or below EMA21" };
  },

  score(result, regimeAdjustment = 0) {
    return Math.max(0, Math.min(100, result.score + regimeAdjustment));
  },

  explain(result) {
    const rvol = result.rvol?.toFixed(1) || "N/A";
    return `Volatility Squeeze ${result.stage}: Price ${result.price.toFixed(2)}. ` +
      `Entry: ${result.levels.entryTrigger.toFixed(2)}, Stop: ${result.levels.stopLevel.toFixed(2)}. ` +
      `RVOL: ${rvol}x. This alert is informational only and not investment advice.`;
  },
};
