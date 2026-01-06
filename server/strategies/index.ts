import { Strategy, StrategyPlugin, StrategyId, StrategyIdType, ScanResultItem, StrategyConfig, Candle, ScanInput, ScanResultOutput } from "./types";
import { vcpStrategy } from "./vcp";
import { vcpMultidayStrategy } from "./vcpMultiday";
import { classicPullbackStrategy } from "./classicPullback";
import { vwapReclaimStrategy } from "./vwapReclaim";
import { orb5Strategy, orb15Strategy } from "./orb";
import { highRvolStrategy } from "./highRvol";
import { gapAndGoStrategy } from "./gapAndGo";
import { trendContinuationStrategy } from "./trendContinuation";
import { volatilitySqueezeStrategy } from "./volatilitySqueeze";
import { QuoteData } from "../broker-service";
import { CandleData } from "../engine/indicators";

export * from "./types";

const strategies: Map<StrategyIdType, Strategy> = new Map([
  [StrategyId.VCP, vcpStrategy],
  [StrategyId.VCP_MULTIDAY, vcpMultidayStrategy],
  [StrategyId.CLASSIC_PULLBACK, classicPullbackStrategy],
]);

const strategyPlugins: Map<StrategyIdType, StrategyPlugin> = new Map([
  [StrategyId.VWAP_RECLAIM, vwapReclaimStrategy],
  [StrategyId.ORB5, orb5Strategy],
  [StrategyId.ORB15, orb15Strategy],
  [StrategyId.HIGH_RVOL, highRvolStrategy],
  [StrategyId.GAP_AND_GO, gapAndGoStrategy],
  [StrategyId.TREND_CONTINUATION, trendContinuationStrategy],
  [StrategyId.VOLATILITY_SQUEEZE, volatilitySqueezeStrategy],
]);

export function getStrategy(id: StrategyIdType): Strategy | undefined {
  return strategies.get(id);
}

export function getStrategyPlugin(id: StrategyIdType): StrategyPlugin | undefined {
  return strategyPlugins.get(id);
}

export function getAllStrategies(): Strategy[] {
  return Array.from(strategies.values());
}

export function getAllStrategyPlugins(): StrategyPlugin[] {
  return Array.from(strategyPlugins.values());
}

export function getAllStrategyIds(): StrategyIdType[] {
  return [
    ...Array.from(strategies.keys()),
    ...Array.from(strategyPlugins.keys()),
  ];
}

export function getStrategyList(): { id: StrategyIdType; name: string; description: string; category?: string }[] {
  const legacyList = Array.from(strategies.values()).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: "swing" as const,
  }));
  
  const pluginList = Array.from(strategyPlugins.values()).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
  }));
  
  return [...legacyList, ...pluginList];
}

export const STRATEGY_PRESETS = {
  BREAKOUTS: [StrategyId.VCP, StrategyId.VCP_MULTIDAY, StrategyId.HIGH_RVOL, StrategyId.VOLATILITY_SQUEEZE],
  INTRADAY: [StrategyId.VWAP_RECLAIM, StrategyId.ORB5, StrategyId.ORB15, StrategyId.GAP_AND_GO],
  SWING: [StrategyId.VCP_MULTIDAY, StrategyId.CLASSIC_PULLBACK, StrategyId.TREND_CONTINUATION],
  ALL: Object.values(StrategyId),
};

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
    strategyId,
    resistance: classification.levels.resistance || 0,
    stopLevel: classification.levels.stopLevel,
    entryTrigger: classification.levels.entryTrigger,
    exitRule: classification.levels.exitRule,
    score: classification.score,
    ema9: Number((classification.ema9 || quote.last * 0.99).toFixed(2)),
    ema21: Number((classification.ema21 || quote.last * 0.97).toFixed(2)),
    vwap: classification.vwap,
    explanation: classification.explanation,
  };
}

export function runPluginScan(
  strategyId: StrategyIdType,
  input: ScanInput
): ScanResultOutput | null {
  const plugin = strategyPlugins.get(strategyId);
  if (!plugin) return null;
  
  return plugin.scan(input);
}

export function runAllPluginScans(
  symbol: string,
  candles: CandleData[],
  timeframe: string,
  strategyIds?: StrategyIdType[],
  quote?: QuoteData
): ScanResultOutput[] {
  const results: ScanResultOutput[] = [];
  const idsToScan = strategyIds || Array.from(strategyPlugins.keys());
  
  for (const id of idsToScan) {
    const plugin = strategyPlugins.get(id);
    if (!plugin) continue;
    
    const result = plugin.scan({
      symbol,
      candles,
      timeframe,
      params: plugin.defaultParams,
      quote,
    });
    
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

export { 
  vcpStrategy, 
  vcpMultidayStrategy, 
  classicPullbackStrategy,
  vwapReclaimStrategy,
  orb5Strategy,
  orb15Strategy,
  highRvolStrategy,
  gapAndGoStrategy,
  trendContinuationStrategy,
  volatilitySqueezeStrategy,
};
