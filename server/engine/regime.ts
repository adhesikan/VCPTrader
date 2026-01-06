import { CandleData, calcEMA, calcEMASlope } from "./indicators";

export const MarketRegime = {
  TRENDING: "TRENDING",
  CHOPPY: "CHOPPY",
  RISK_OFF: "RISK_OFF",
} as const;

export type MarketRegimeType = typeof MarketRegime[keyof typeof MarketRegime];

export interface RegimeAnalysis {
  regime: MarketRegimeType;
  strength: number;
  ema21Slope: number;
  priceVsEma21: number;
  description: string;
}

export function classifyMarketRegime(candles: CandleData[]): RegimeAnalysis {
  if (candles.length < 30) {
    return {
      regime: MarketRegime.CHOPPY,
      strength: 0,
      ema21Slope: 0,
      priceVsEma21: 0,
      description: "Insufficient data for regime classification",
    };
  }

  const closes = candles.map(c => c.close);
  const ema21 = calcEMA(closes, 21);
  const currentPrice = closes[closes.length - 1];
  const currentEma21 = ema21[ema21.length - 1];
  const slope = calcEMASlope(ema21, 5);
  
  const priceVsEma21 = ((currentPrice - currentEma21) / currentEma21) * 100;
  
  let crossCount = 0;
  const lookback = Math.min(20, candles.length);
  for (let i = closes.length - lookback; i < closes.length - 1; i++) {
    const prevAbove = closes[i] > ema21[i];
    const currAbove = closes[i + 1] > ema21[i + 1];
    if (prevAbove !== currAbove) crossCount++;
  }

  let regime: MarketRegimeType;
  let strength: number;
  let description: string;

  if (priceVsEma21 > 0.5 && slope > 0.1 && crossCount <= 3) {
    regime = MarketRegime.TRENDING;
    strength = Math.min(100, Math.abs(slope) * 20 + Math.abs(priceVsEma21) * 10);
    description = "Bullish trend: Price above EMA21 with upward slope";
  } else if (priceVsEma21 < -0.5 && slope < -0.1 && crossCount <= 3) {
    regime = MarketRegime.RISK_OFF;
    strength = Math.min(100, Math.abs(slope) * 20 + Math.abs(priceVsEma21) * 10);
    description = "Risk-off: Price below EMA21 with downward slope";
  } else {
    regime = MarketRegime.CHOPPY;
    strength = Math.min(100, crossCount * 15);
    description = "Choppy: Frequent crosses around EMA21, low directional conviction";
  }

  return {
    regime,
    strength: Math.round(strength),
    ema21Slope: Number(slope.toFixed(2)),
    priceVsEma21: Number(priceVsEma21.toFixed(2)),
    description,
  };
}

export function getRegimeAdjustment(regime: MarketRegimeType, strategyType: string): number {
  switch (regime) {
    case MarketRegime.TRENDING:
      if (["VCP", "VCP_MULTIDAY", "TREND_CONTINUATION", "GAP_AND_GO"].includes(strategyType)) {
        return 10;
      }
      return 0;
    case MarketRegime.CHOPPY:
      if (["VCP", "VCP_MULTIDAY", "ORB5", "ORB15", "HIGH_RVOL"].includes(strategyType)) {
        return -15;
      }
      return -5;
    case MarketRegime.RISK_OFF:
      return -20;
    default:
      return 0;
  }
}
