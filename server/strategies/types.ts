import { QuoteData } from "../broker-service";

export const StrategyId = {
  VCP: "VCP",
  CLASSIC_PULLBACK: "CLASSIC_PULLBACK",
} as const;

export type StrategyIdType = typeof StrategyId[keyof typeof StrategyId];

export const PullbackStage = {
  FORMING: "FORMING",
  READY: "READY",
  TRIGGERED: "TRIGGERED",
} as const;

export type PullbackStageType = typeof PullbackStage[keyof typeof PullbackStage];

export interface StrategyLevels {
  resistance: number;
  entryTrigger: number;
  stopLevel: number;
  exitRule: string;
}

export interface StrategyClassification {
  stage: string;
  levels: StrategyLevels;
  score: number;
  ema9?: number;
  ema21?: number;
  rvol?: number;
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
}

export const DEFAULT_PULLBACK_CONFIG: Required<StrategyConfig> = {
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
  resistance: number;
  stopLevel: number;
  entryTrigger?: number;
  exitRule?: string;
  score: number;
  ema9: number;
  ema21: number;
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
