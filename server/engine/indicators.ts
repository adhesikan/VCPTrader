export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
}

export function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = new Array(data.length).fill(0);
  
  if (data.length < period) {
    return emaArray;
  }
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
    emaArray[i] = sum / (i + 1);
  }
  emaArray[period - 1] = sum / period;
  
  for (let i = period; i < data.length; i++) {
    emaArray[i] = data[i] * k + emaArray[i - 1] * (1 - k);
  }
  return emaArray;
}

export function calcSMA(data: number[], period: number): number[] {
  const smaArray: number[] = new Array(data.length).fill(0);
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    smaArray[i] = sum / period;
  }
  return smaArray;
}

export function calcVWAP(candles: CandleData[]): number[] {
  const vwapArray: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
    vwapArray.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : candle.close);
  }
  return vwapArray;
}

export function calcATR(candles: CandleData[], period: number = 14): number[] {
  const atrArray: number[] = new Array(candles.length).fill(0);
  const trueRanges: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    let tr: number;
    
    if (i === 0) {
      tr = candle.high - candle.low;
    } else {
      const prevClose = candles[i - 1].close;
      tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose)
      );
    }
    trueRanges.push(tr);
    
    if (i >= period - 1) {
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += trueRanges[j];
        }
        atrArray[i] = sum / period;
      } else {
        atrArray[i] = (atrArray[i - 1] * (period - 1) + tr) / period;
      }
    }
  }
  return atrArray;
}

export function calcRVOL(candles: CandleData[], period: number = 20): number {
  if (candles.length < period + 1) return 1;
  
  const currentVolume = candles[candles.length - 1].volume;
  let avgVolume = 0;
  
  for (let i = candles.length - period - 1; i < candles.length - 1; i++) {
    avgVolume += candles[i].volume;
  }
  avgVolume /= period;
  
  return avgVolume > 0 ? currentVolume / avgVolume : 1;
}

export function calcBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const middle = calcSMA(closes, period);
  const upper: number[] = new Array(closes.length).fill(0);
  const lower: number[] = new Array(closes.length).fill(0);
  
  for (let i = period - 1; i < closes.length; i++) {
    let sumSquaredDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - middle[i];
      sumSquaredDiff += diff * diff;
    }
    const std = Math.sqrt(sumSquaredDiff / period);
    upper[i] = middle[i] + stdDev * std;
    lower[i] = middle[i] - stdDev * std;
  }
  
  return { upper, middle, lower };
}

export function calcKeltnerChannels(candles: CandleData[], period: number = 20, atrMultiplier: number = 1.5): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const closes = candles.map(c => c.close);
  const middle = calcEMA(closes, period);
  const atr = calcATR(candles, period);
  
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    upper.push(middle[i] + atrMultiplier * atr[i]);
    lower.push(middle[i] - atrMultiplier * atr[i]);
  }
  
  return { upper, middle, lower };
}

export function detectSqueeze(
  bollingerBands: { upper: number[]; lower: number[] },
  keltnerChannels: { upper: number[]; lower: number[] },
  minBars: number = 5
): { squeezeOn: boolean; squeezeCount: number; squeezeStartIdx: number } {
  let squeezeCount = 0;
  let squeezeStartIdx = -1;
  
  for (let i = bollingerBands.upper.length - 1; i >= 0; i--) {
    const bbUpper = bollingerBands.upper[i];
    const bbLower = bollingerBands.lower[i];
    const kcUpper = keltnerChannels.upper[i];
    const kcLower = keltnerChannels.lower[i];
    
    if (bbUpper <= kcUpper && bbLower >= kcLower) {
      squeezeCount++;
      squeezeStartIdx = i;
    } else {
      break;
    }
  }
  
  return {
    squeezeOn: squeezeCount >= minBars,
    squeezeCount,
    squeezeStartIdx,
  };
}

export function detectOpeningRange(candles: CandleData[], minutesAfterOpen: number = 5): {
  high: number;
  low: number;
  rangeIdx: number;
} | null {
  if (candles.length === 0) return null;
  
  const barsNeeded = Math.ceil(minutesAfterOpen / 5);
  if (candles.length < barsNeeded) {
    return {
      high: Math.max(...candles.map(c => c.high)),
      low: Math.min(...candles.map(c => c.low)),
      rangeIdx: candles.length - 1,
    };
  }
  
  let high = 0;
  let low = Infinity;
  
  for (let i = 0; i < barsNeeded; i++) {
    high = Math.max(high, candles[i].high);
    low = Math.min(low, candles[i].low);
  }
  
  return { high, low, rangeIdx: barsNeeded - 1 };
}

export function calcGapPercent(currentOpen: number, previousClose: number): number {
  if (previousClose === 0) return 0;
  return ((currentOpen - previousClose) / previousClose) * 100;
}

export function findConsolidationRange(candles: CandleData[], lookback: number = 10): {
  high: number;
  low: number;
  rangePercent: number;
} | null {
  if (candles.length < lookback) return null;
  
  const recentCandles = candles.slice(-lookback);
  const high = Math.max(...recentCandles.map(c => c.high));
  const low = Math.min(...recentCandles.map(c => c.low));
  const midPrice = (high + low) / 2;
  const rangePercent = ((high - low) / midPrice) * 100;
  
  return { high, low, rangePercent };
}

export function calcEMASlope(ema: number[], bars: number = 5): number {
  if (ema.length < bars + 1) return 0;
  
  const current = ema[ema.length - 1];
  const previous = ema[ema.length - bars - 1];
  
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function isTrending(
  closes: number[],
  ema21: number[],
  minBarsAbove: number = 5
): boolean {
  if (closes.length < minBarsAbove) return false;
  
  for (let i = closes.length - minBarsAbove; i < closes.length; i++) {
    if (closes[i] < ema21[i]) return false;
  }
  return true;
}
