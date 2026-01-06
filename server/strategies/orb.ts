import { StrategyPlugin, StrategyId, ScanInput, ScanResultOutput, PatternStage, StrategyConfig, StrategyLevels, StrategyIdType, PatternStageType } from "./types";
import { calcRVOL, detectOpeningRange, CandleData } from "../engine/indicators";

function createORBStrategy(minutes: 5 | 15): StrategyPlugin {
  const strategyId: StrategyIdType = minutes === 5 ? StrategyId.ORB5 : StrategyId.ORB15;
  
  const defaultParams: StrategyConfig = {
    openingRangeMinutes: minutes,
    rvolThreshold: 1.5,
  };

  return {
    id: strategyId,
    name: `ORB ${minutes}m`,
    description: `Opening Range Breakout using first ${minutes} minutes of trading`,
    category: "intraday",
    timeframesSupported: ["1m", "5m"],
    defaultParams,

    scan(input: ScanInput): ScanResultOutput | null {
      const { symbol, candles, params, quote } = input;
      const config = { ...defaultParams, ...params };
      
      if (candles.length < 3) return null;
      
      const openingRange = detectOpeningRange(candles, config.openingRangeMinutes || minutes);
      if (!openingRange) return null;
      
      const { high: orHigh, low: orLow, rangeIdx } = openingRange;
      const currentCandle = candles[candles.length - 1];
      const currentPrice = currentCandle.close;
      const rvol = calcRVOL(candles);
      
      const rangePercent = ((orHigh - orLow) / orLow) * 100;
      if (rangePercent > 5) return null;
      
      const currentIdx = candles.length - 1;
      if (currentIdx <= rangeIdx) {
        return null;
      }
      
      let stage: PatternStageType = PatternStage.FORMING;
      let score = 30;
      const hasVolume = rvol >= (config.rvolThreshold || 1.5);
      
      const breakoutAbove = currentPrice > orHigh;
      const nearBreakout = currentPrice > orHigh * 0.995 && currentPrice <= orHigh;
      
      if (breakoutAbove && hasVolume) {
        stage = PatternStage.TRIGGERED;
        score = 70 + Math.min(30, (rvol - 1.5) * 15);
      } else if (breakoutAbove) {
        stage = PatternStage.READY;
        score = 55 + Math.min(15, rvol * 5);
      } else if (nearBreakout) {
        stage = PatternStage.FORMING;
        score = 40 + Math.min(15, ((currentPrice - orLow) / (orHigh - orLow)) * 15);
      } else {
        return null;
      }
      
      const stopLevel = Math.min(orLow, currentCandle.low);
      
      return {
        symbol,
        name: quote?.symbol || symbol,
        price: currentPrice,
        strategyId,
        stage,
        score: Math.round(Math.min(100, score)),
        levels: {
          resistance: orHigh,
          support: orLow,
          entryTrigger: orHigh,
          stopLevel,
          exitRule: `Close below OR low (${orLow.toFixed(2)})`,
          openingRangeHigh: orHigh,
          openingRangeLow: orLow,
        },
        rvol,
        explanation: `ORB${minutes} ${stage}: OR High: ${orHigh.toFixed(2)}, OR Low: ${orLow.toFixed(2)}. ` +
          `RVOL: ${rvol.toFixed(1)}x. This alert is informational only and not investment advice.`,
      };
    },

    classify(stage) {
      switch (stage) {
        case PatternStage.FORMING:
          return { label: "Forming", description: "Price within opening range, watching for breakout" };
        case PatternStage.READY:
          return { label: "Ready", description: "Price broke opening range, awaiting volume confirmation" };
        case PatternStage.TRIGGERED:
          return { label: "Triggered", description: "Opening range breakout confirmed with volume" };
        default:
          return { label: stage, description: "" };
      }
    },

    getDefaultLevels(): Partial<StrategyLevels> {
      return { exitRule: "Close below opening range low" };
    },

    score(result, regimeAdjustment = 0) {
      return Math.max(0, Math.min(100, result.score + regimeAdjustment));
    },

    explain(result) {
      const rvol = result.rvol?.toFixed(1) || "N/A";
      return `ORB${minutes} ${result.stage}: Price ${result.price.toFixed(2)}. ` +
        `Range: ${result.levels.openingRangeLow?.toFixed(2)} - ${result.levels.openingRangeHigh?.toFixed(2)}. ` +
        `RVOL: ${rvol}x. This alert is informational only and not investment advice.`;
    },
  };
}

export const orb5Strategy = createORBStrategy(5);
export const orb15Strategy = createORBStrategy(15);
