import { StrategyPlugin, StrategyId, ScanInput, ScanResultOutput, PatternStage, StrategyConfig, StrategyLevels, PatternStageType } from "./types";
import { calcVWAP, calcRVOL, calcGapPercent, detectOpeningRange, CandleData } from "../engine/indicators";

const defaultParams: StrategyConfig = {
  gapMinPercent: 2,
  rvolThreshold: 1.5,
  openingRangeMinutes: 15,
};

export const gapAndGoStrategy: StrategyPlugin = {
  id: StrategyId.GAP_AND_GO,
  name: "Gap & Go",
  description: "Identifies gap ups that hold above VWAP and break the opening range",
  category: "intraday",
  timeframesSupported: ["1m", "5m"],
  defaultParams,

  scan(input: ScanInput): ScanResultOutput | null {
    const { symbol, candles, params, quote } = input;
    const config = { ...defaultParams, ...params };
    
    if (candles.length < 10) return null;
    
    const vwap = calcVWAP(candles);
    const rvol = calcRVOL(candles);
    
    const openingRange = detectOpeningRange(candles, config.openingRangeMinutes || 15);
    if (!openingRange) return null;
    
    const firstCandle = candles[0];
    const currentCandle = candles[candles.length - 1];
    const currentPrice = currentCandle.close;
    const currentVwap = vwap[vwap.length - 1];
    
    let gapPercent = 0;
    if (quote && quote.prevClose) {
      gapPercent = calcGapPercent(firstCandle.open, quote.prevClose);
    } else if (candles.length > 1) {
      gapPercent = ((firstCandle.open - currentVwap * 0.98) / (currentVwap * 0.98)) * 100;
    }
    
    const hasGap = gapPercent >= (config.gapMinPercent || 2);
    if (!hasGap) return null;
    
    const holdsAboveVwap = currentPrice > currentVwap;
    const hasVolume = rvol >= (config.rvolThreshold || 1.5);
    const breakoutAboveOR = currentPrice > openingRange.high;
    
    let stage: PatternStageType = PatternStage.FORMING;
    let score = 30;
    
    if (breakoutAboveOR && holdsAboveVwap && hasVolume) {
      stage = PatternStage.TRIGGERED;
      score = 70 + Math.min(30, gapPercent * 3 + (rvol - 1.5) * 10);
    } else if (breakoutAboveOR && holdsAboveVwap) {
      stage = PatternStage.READY;
      score = 55 + Math.min(15, gapPercent * 2);
    } else if (holdsAboveVwap && hasVolume) {
      stage = PatternStage.READY;
      score = 50 + Math.min(20, gapPercent * 2 + rvol * 3);
    } else if (holdsAboveVwap) {
      stage = PatternStage.FORMING;
      score = 35 + Math.min(15, gapPercent * 2);
    } else {
      return null;
    }
    
    const stopLevel = Math.min(currentVwap * 0.995, openingRange.low);
    
    return {
      symbol,
      name: quote?.symbol || symbol,
      price: currentPrice,
      strategyId: StrategyId.GAP_AND_GO,
      stage,
      score: Math.round(Math.min(100, score)),
      levels: {
        resistance: openingRange.high,
        support: currentVwap,
        entryTrigger: openingRange.high,
        stopLevel,
        exitRule: "Close below VWAP",
        vwap: currentVwap,
        openingRangeHigh: openingRange.high,
        openingRangeLow: openingRange.low,
      },
      vwap: currentVwap,
      rvol,
      explanation: this.explain({
        symbol,
        price: currentPrice,
        strategyId: StrategyId.GAP_AND_GO,
        stage,
        score,
        levels: { entryTrigger: openingRange.high, stopLevel, exitRule: "", vwap: currentVwap },
        rvol,
        explanation: "",
      }),
    };
  },

  classify(stage) {
    switch (stage) {
      case PatternStage.FORMING:
        return { label: "Forming", description: "Gap up detected, holding above VWAP" };
      case PatternStage.READY:
        return { label: "Ready", description: "Holding above VWAP, near opening range breakout" };
      case PatternStage.TRIGGERED:
        return { label: "Triggered", description: "Gap & Go confirmed: OR breakout with volume" };
      default:
        return { label: stage, description: "" };
    }
  },

  getDefaultLevels(): Partial<StrategyLevels> {
    return { exitRule: "Close below VWAP or premarket low" };
  },

  score(result, regimeAdjustment = 0) {
    return Math.max(0, Math.min(100, result.score + regimeAdjustment));
  },

  explain(result) {
    const rvol = result.rvol?.toFixed(1) || "N/A";
    return `Gap & Go ${result.stage}: Price ${result.price.toFixed(2)} gapped up. ` +
      `VWAP: ${result.levels.vwap?.toFixed(2) || "N/A"}, RVOL: ${rvol}x. ` +
      `This alert is informational only and not investment advice.`;
  },
};
