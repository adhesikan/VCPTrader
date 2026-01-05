import { Strategy, StrategyId, StrategyIdType, ScanResultItem, StrategyConfig, Candle } from "./types";
import { vcpStrategy } from "./vcp";
import { vcpMultidayStrategy } from "./vcpMultiday";
import { classicPullbackStrategy } from "./classicPullback";
import { QuoteData } from "../broker-service";

export * from "./types";

const strategies: Map<StrategyIdType, Strategy> = new Map([
  [StrategyId.VCP, vcpStrategy],
  [StrategyId.VCP_MULTIDAY, vcpMultidayStrategy],
  [StrategyId.CLASSIC_PULLBACK, classicPullbackStrategy],
]);

export function getStrategy(id: StrategyIdType): Strategy | undefined {
  return strategies.get(id);
}

export function getAllStrategies(): Strategy[] {
  return Array.from(strategies.values());
}

export function getStrategyList(): { id: StrategyIdType; name: string; description: string }[] {
  return Array.from(strategies.values()).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }));
}

export function classifyQuote(
  strategyId: StrategyIdType,
  quote: QuoteData,
  candles?: Candle[],
  config?: StrategyConfig
): ScanResultItem | null {
  const strategy = strategies.get(strategyId);
  if (!strategy) return null;
  
  const classification = strategy.classify(quote, candles, config);
  
  return {
    symbol: quote.symbol,
    name: quote.symbol,
    price: Number(quote.last.toFixed(2)),
    change: Number(quote.change.toFixed(2)),
    changePercent: Number(quote.changePercent.toFixed(2)),
    volume: quote.volume,
    avgVolume: quote.avgVolume || null,
    rvol: classification.rvol ? Number(classification.rvol.toFixed(2)) : null,
    stage: classification.stage,
    resistance: classification.levels.resistance,
    stopLevel: classification.levels.stopLevel,
    entryTrigger: classification.levels.entryTrigger,
    exitRule: classification.levels.exitRule,
    score: classification.score,
    ema9: Number((classification.ema9 || quote.last * 0.99).toFixed(2)),
    ema21: Number((classification.ema21 || quote.last * 0.97).toFixed(2)),
    explanation: classification.explanation,
  };
}

export { vcpStrategy, vcpMultidayStrategy, classicPullbackStrategy };
