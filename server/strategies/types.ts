import { QuoteData } from "../broker-service";
import { CandleData } from "../engine/indicators";

export const StrategyId = {
  VCP: "VCP",
  VCP_MULTIDAY: "VCP_MULTIDAY",
  CLASSIC_PULLBACK: "CLASSIC_PULLBACK",
  VWAP_RECLAIM: "VWAP_RECLAIM",
  ORB5: "ORB5",
  ORB15: "ORB15",
  HIGH_RVOL: "HIGH_RVOL",
  GAP_AND_GO: "GAP_AND_GO",
  TREND_CONTINUATION: "TREND_CONTINUATION",
  VOLATILITY_SQUEEZE: "VOLATILITY_SQUEEZE",
} as const;

export type StrategyIdType = typeof StrategyId[keyof typeof StrategyId];

export const PatternStage = {
  FORMING: "FORMING",
  READY: "READY",
  BREAKOUT: "BREAKOUT",
  TRIGGERED: "TRIGGERED",
} as const;

export type PatternStageType = typeof PatternStage[keyof typeof PatternStage];

export const PullbackStage = {
  FORMING: "FORMING",
  READY: "READY",
  TRIGGERED: "TRIGGERED",
} as const;

export type PullbackStageType = typeof PullbackStage[keyof typeof PullbackStage];

export interface StrategyLevels {
  resistance?: number;
  support?: number;
  entryTrigger: number;
  stopLevel: number;
  exitRule: string;
  vwap?: number;
  openingRangeHigh?: number;
  openingRangeLow?: number;
}

export interface StrategyClassification {
  stage: string;
  levels: StrategyLevels;
  score: number;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  vwap?: number;
  rvol?: number;
  atr?: number;
  explanation: string;
}

export interface StrategyConfig {
  trendBars?: number;
  pullbackBarsMin?: number;
  pullbackBarsMax?: number;
  pullbackDepthPercent?: number;
  impulseMinMovePercent?: number;
  impulseLookback?: number;
  volumeMultiplier?: number;
  rvolThreshold?: number;
  openingRangeMinutes?: number;
  gapMinPercent?: number;
  squeezeBars?: number;
  consolidationBars?: number;
  emaTrendRequired?: boolean;
}

export const DEFAULT_PULLBACK_CONFIG: Required<Pick<StrategyConfig, 
  'trendBars' | 'pullbackBarsMin' | 'pullbackBarsMax' | 'pullbackDepthPercent' | 
  'impulseMinMovePercent' | 'impulseLookback' | 'volumeMultiplier'
>> = {
  trendBars: 20,
  pullbackBarsMin: 8,
  pullbackBarsMax: 20,
  pullbackDepthPercent: 2.5,
  impulseMinMovePercent: 3,
  impulseLookback: 60,
  volumeMultiplier: 1.5,
};

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

export interface ScanInput {
  symbol: string;
  candles: CandleData[];
  timeframe: string;
  params: StrategyConfig;
  quote?: QuoteData;
}

export interface ScanResultOutput {
  symbol: string;
  name?: string;
  price: number;
  strategyId: StrategyIdType;
  stage: PatternStageType;
  score: number;
  levels: StrategyLevels;
  ema9?: number;
  ema21?: number;
  vwap?: number;
  rvol?: number;
  atr?: number;
  explanation: string;
}

export interface StrategyPlugin {
  id: StrategyIdType;
  name: string;
  description: string;
  category: "intraday" | "swing" | "breakout";
  timeframesSupported: string[];
  defaultParams: StrategyConfig;
  
  scan(input: ScanInput): ScanResultOutput | null;
  
  classify(stage: PatternStageType): { label: string; description: string };
  
  getDefaultLevels(): Partial<StrategyLevels>;
  
  score(result: ScanResultOutput, regimeAdjustment?: number): number;
  
  explain(result: ScanResultOutput): string;
}

export interface ScanRequest {
  strategyId: StrategyIdType;
  symbols: string[];
  timeframe: string;
  config?: StrategyConfig;
}

export interface ScanResultItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number | null;
  rvol: number | null;
  stage: string;
  strategyId?: StrategyIdType;
  resistance: number;
  stopLevel: number;
  entryTrigger?: number;
  exitRule?: string;
  score: number;
  ema9: number;
  ema21: number;
  vwap?: number;
  explanation?: string;
  timeframe?: string;
}

export interface Strategy {
  id: StrategyIdType;
  name: string;
  description: string;
  
  classify(quote: QuoteData, candles?: Candle[], config?: StrategyConfig): StrategyClassification;
  
  computeLevels(quote: QuoteData, candles?: Candle[]): StrategyLevels;
  
  explain(classification: StrategyClassification): string;
}
