import { QuoteData } from "../broker-service";
import { 
  Strategy, 
  StrategyId, 
  StrategyClassification, 
  StrategyLevels,
  Candle,
  StrategyConfig,
  DEFAULT_PULLBACK_CONFIG,
  PullbackStage,
} from "./types";

function calculateEMA(candles: Candle[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  let sum = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {
    sum += candles[i].close;
  }
  ema[period - 1] = sum / period;
  
  for (let i = period; i < candles.length; i++) {
    ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

function findSwingHigh(candles: Candle[], lookback: number): { price: number; index: number } | null {
  if (candles.length < 3) return null;
  
  const startIdx = Math.max(0, candles.length - lookback);
  let highestPrice = -Infinity;
  let highestIdx = -1;
  
  for (let i = startIdx; i < candles.length; i++) {
    if (candles[i].high > highestPrice) {
      highestPrice = candles[i].high;
      highestIdx = i;
    }
  }
  
  return highestIdx >= 0 ? { price: highestPrice, index: highestIdx } : null;
}

function findSwingLow(candles: Candle[], startIdx: number, endIdx: number): { price: number; index: number } | null {
  let lowestPrice = Infinity;
  let lowestIdx = -1;
  
  for (let i = startIdx; i <= endIdx && i < candles.length; i++) {
    if (candles[i].low < lowestPrice) {
      lowestPrice = candles[i].low;
      lowestIdx = i;
    }
  }
  
  return lowestIdx >= 0 ? { price: lowestPrice, index: lowestIdx } : null;
}

function classifyFromQuote(quote: QuoteData, cfg: Required<StrategyConfig>): StrategyClassification {
  const ema9 = quote.last * 0.99;
  const ema21 = quote.last * 0.97;
  const rvol = quote.avgVolume ? quote.volume / quote.avgVolume : 1;
  
  const priceAboveEMAs = quote.last > ema9 && quote.last > ema21;
  const hasVolume = rvol >= cfg.volumeMultiplier;
  const isBreakingOut = quote.changePercent > 1 && hasVolume;
  
  let stage: string;
  let score: number;
  let explanation: string;
  
  if (priceAboveEMAs && isBreakingOut) {
    stage = PullbackStage.BREAKOUT;
    score = Math.min(100, 80 + Math.floor(rvol * 5));
    explanation = `Potential breakout with ${rvol.toFixed(1)}x relative volume.`;
  } else if (priceAboveEMAs && quote.changePercent > -1) {
    stage = PullbackStage.READY;
    score = 65;
    explanation = "Price above EMAs, watching for volume confirmation.";
  } else {
    stage = PullbackStage.FORMING;
    score = 40;
    explanation = "Pattern forming. Need price above EMAs in uptrend.";
  }
  
  const highPrice = quote.high && quote.high > 0 ? quote.high : quote.last;
  const lowPrice = quote.low && quote.low > 0 ? quote.low : quote.last;
  const resistance = highPrice;
  const stopLevel = lowPrice * 0.995;
  
  return {
    stage,
    levels: {
      resistance: Number(resistance.toFixed(2)),
      entryTrigger: Number(resistance.toFixed(2)),
      stopLevel: Number(stopLevel.toFixed(2)),
      exitRule: "Close below EMA 21",
    },
    score,
    ema9,
    ema21,
    rvol,
    explanation,
  };
}

export const classicPullbackStrategy: Strategy = {
  id: StrategyId.CLASSIC_PULLBACK,
  name: "Classic Pullback",
  description: "Identifies stocks in uptrends that pull back to support and set up for continuation.",

  classify(quote: QuoteData, candles?: Candle[], config?: StrategyConfig): StrategyClassification {
    const cfg = { ...DEFAULT_PULLBACK_CONFIG, ...config };
    
    if (!candles || candles.length < cfg.trendBars + cfg.pullbackBarsMax) {
      return classifyFromQuote(quote, cfg);
    }
    
    const ema9 = calculateEMA(candles, 9);
    const ema21 = calculateEMA(candles, 21);
    const lastIdx = candles.length - 1;
    const currentCandle = candles[lastIdx];
    const currentEma9 = ema9[lastIdx] || quote.last * 0.99;
    const currentEma21 = ema21[lastIdx] || quote.last * 0.97;
    
    let avgVolume = 0;
    const volLookback = Math.min(20, candles.length);
    for (let i = candles.length - volLookback; i < candles.length; i++) {
      avgVolume += candles[i].volume;
    }
    avgVolume /= volLookback;
    const rvol = avgVolume > 0 ? currentCandle.volume / avgVolume : 1;
    
    let trendValid = true;
    for (let i = Math.max(0, lastIdx - cfg.trendBars); i <= lastIdx; i++) {
      if (candles[i].close < ema9[i] || candles[i].close < ema21[i]) {
        trendValid = false;
        break;
      }
    }
    
    if (!trendValid || currentEma9 <= currentEma21) {
      return {
        stage: PullbackStage.FORMING,
        levels: this.computeLevels(quote, candles),
        score: 30,
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: "Trend filter not met. Price needs to be above both EMAs with EMA9 > EMA21.",
      };
    }
    
    const swingHigh = findSwingHigh(candles, cfg.impulseLookback);
    if (!swingHigh) {
      return {
        stage: PullbackStage.FORMING,
        levels: this.computeLevels(quote, candles),
        score: 35,
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: "No clear swing high found in lookback period.",
      };
    }
    
    const swingLow = findSwingLow(candles, Math.max(0, swingHigh.index - cfg.impulseLookback), swingHigh.index);
    if (!swingLow) {
      return {
        stage: PullbackStage.FORMING,
        levels: this.computeLevels(quote, candles),
        score: 35,
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: "No swing low found before swing high.",
      };
    }
    
    const impulseMove = ((swingHigh.price - swingLow.price) / swingLow.price) * 100;
    if (impulseMove < cfg.impulseMinMovePercent) {
      return {
        stage: PullbackStage.FORMING,
        levels: this.computeLevels(quote, candles),
        score: 40,
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: `Impulse move of ${impulseMove.toFixed(1)}% is below minimum ${cfg.impulseMinMovePercent}%.`,
      };
    }
    
    const pullbackDepth = ((swingHigh.price - currentCandle.close) / swingHigh.price) * 100;
    if (pullbackDepth > cfg.pullbackDepthPercent) {
      return {
        stage: PullbackStage.FORMING,
        levels: this.computeLevels(quote, candles),
        score: 45,
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: `Pullback depth of ${pullbackDepth.toFixed(1)}% exceeds maximum ${cfg.pullbackDepthPercent}%.`,
      };
    }
    
    const pullbackBars = lastIdx - swingHigh.index;
    if (pullbackBars < cfg.pullbackBarsMin || pullbackBars > cfg.pullbackBarsMax) {
      return {
        stage: PullbackStage.FORMING,
        levels: this.computeLevels(quote, candles),
        score: 50,
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: `Pullback duration of ${pullbackBars} bars outside range ${cfg.pullbackBarsMin}-${cfg.pullbackBarsMax}.`,
      };
    }
    
    let pullbackHigh = -Infinity;
    for (let i = swingHigh.index; i <= lastIdx; i++) {
      pullbackHigh = Math.max(pullbackHigh, candles[i].high);
    }
    const resistance = pullbackHigh;
    
    const isBreakout = currentCandle.close > resistance && rvol >= cfg.volumeMultiplier;
    const isHighBreak = currentCandle.high > resistance && rvol >= cfg.volumeMultiplier;
    
    if (isBreakout || isHighBreak) {
      const stopLevel = currentCandle.low * 0.995;
      return {
        stage: PullbackStage.BREAKOUT,
        levels: {
          resistance: Number(resistance.toFixed(2)),
          entryTrigger: Number(resistance.toFixed(2)),
          stopLevel: Number(stopLevel.toFixed(2)),
          exitRule: "Close below EMA 21",
        },
        score: Math.min(100, 85 + Math.floor(rvol * 3)),
        ema9: currentEma9,
        ema21: currentEma21,
        rvol,
        explanation: `Breakout triggered! Price crossed ${resistance.toFixed(2)} with ${rvol.toFixed(1)}x volume. Stop at ${stopLevel.toFixed(2)}.`,
      };
    }
    
    return {
      stage: PullbackStage.READY,
      levels: {
        resistance: Number(resistance.toFixed(2)),
        entryTrigger: Number(resistance.toFixed(2)),
        stopLevel: Number((currentCandle.low * 0.995).toFixed(2)),
        exitRule: "Close below EMA 21",
      },
      score: Math.min(90, 70 + Math.floor((cfg.pullbackDepthPercent - pullbackDepth) * 5)),
      ema9: currentEma9,
      ema21: currentEma21,
      rvol,
      explanation: `Pullback setup ready. Resistance at ${resistance.toFixed(2)}. Waiting for volume breakout (${cfg.volumeMultiplier}x avg).`,
    };
  },

  computeLevels(quote: QuoteData, _candles?: Candle[]): StrategyLevels {
    const highPrice = quote.high && quote.high > 0 ? quote.high : quote.last;
    const lowPrice = quote.low && quote.low > 0 ? quote.low : quote.last;
    const resistance = highPrice;
    const stopLevel = lowPrice * 0.995;
    
    return {
      resistance: Number(resistance.toFixed(2)),
      entryTrigger: Number(resistance.toFixed(2)),
      stopLevel: Number(stopLevel.toFixed(2)),
      exitRule: "Close below EMA 21",
    };
  },

  explain(classification: StrategyClassification): string {
    return classification.explanation;
  },
};
