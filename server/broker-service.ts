import { BrokerConnection, ScanResult, PatternStage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface QuoteData {
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume?: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

export async function fetchTradierQuotes(
  accessToken: string,
  symbols: string[]
): Promise<QuoteData[]> {
  const symbolList = symbols.join(",");
  const response = await fetch(
    `https://api.tradier.com/v1/markets/quotes?symbols=${symbolList}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Tradier API error: ${response.status}`);
  }

  const data = await response.json();
  const quotes = data.quotes?.quote;
  
  if (!quotes) return [];
  
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  
  return quoteArray.map((q: any) => ({
    symbol: q.symbol,
    last: q.last || q.close || 0,
    change: q.change || 0,
    changePercent: q.change_percentage || 0,
    volume: q.volume || 0,
    avgVolume: q.average_volume || 0,
    high: q.high || 0,
    low: q.low || 0,
    open: q.open || 0,
    prevClose: q.prevclose || q.close || 0,
  }));
}

export async function fetchPolygonQuotes(
  accessToken: string,
  symbols: string[]
): Promise<QuoteData[]> {
  const results: QuoteData[] = [];
  
  for (const symbol of symbols) {
    try {
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${accessToken}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const result = data.results?.[0];
        if (result) {
          results.push({
            symbol,
            last: result.c,
            change: result.c - result.o,
            changePercent: ((result.c - result.o) / result.o) * 100,
            volume: result.v,
            high: result.h,
            low: result.l,
            open: result.o,
            prevClose: result.o,
          });
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${symbol} from Polygon:`, e);
    }
  }
  
  return results;
}

export async function fetchAlpacaQuotes(
  accessToken: string,
  secretKey: string | null,
  symbols: string[]
): Promise<QuoteData[]> {
  const symbolList = symbols.join(",");
  
  const headers: Record<string, string> = {
    "APCA-API-KEY-ID": accessToken,
  };
  
  if (secretKey) {
    headers["APCA-API-SECRET-KEY"] = secretKey;
  }

  const response = await fetch(
    `https://data.alpaca.markets/v2/stocks/bars/latest?symbols=${symbolList}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Alpaca API error: ${response.status}`);
  }

  const data = await response.json();
  const bars = data.bars || {};

  return Object.entries(bars).map(([symbol, bar]: [string, any]) => ({
    symbol,
    last: bar.c || 0,
    change: bar.c - bar.o,
    changePercent: bar.o ? ((bar.c - bar.o) / bar.o) * 100 : 0,
    volume: bar.v || 0,
    high: bar.h || 0,
    low: bar.l || 0,
    open: bar.o || 0,
    prevClose: bar.o || 0,
  }));
}

export async function fetchIBKRQuotes(
  accessToken: string,
  symbols: string[]
): Promise<QuoteData[]> {
  console.log("IBKR integration requires Client Portal API setup");
  throw new Error("Interactive Brokers integration requires additional setup. Please use Tradier, Alpaca, or Polygon for now.");
}

export async function fetchSchwabQuotes(
  accessToken: string,
  symbols: string[]
): Promise<QuoteData[]> {
  const symbolList = symbols.join(",");
  
  const response = await fetch(
    `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${symbolList}`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Schwab API error: ${response.status}`);
  }

  const data = await response.json();
  
  return Object.entries(data).map(([symbol, quote]: [string, any]) => {
    const q = quote.quote || quote;
    return {
      symbol,
      last: q.lastPrice || q.mark || 0,
      change: q.netChange || 0,
      changePercent: q.netPercentChangeInDouble || 0,
      volume: q.totalVolume || 0,
      avgVolume: q.averageVolume || 0,
      high: q.highPrice || q["52WkHigh"] || 0,
      low: q.lowPrice || q["52WkLow"] || 0,
      open: q.openPrice || 0,
      prevClose: q.closePrice || 0,
    };
  });
}

export async function fetchQuotesFromBroker(
  connection: BrokerConnection,
  symbols: string[]
): Promise<QuoteData[]> {
  if (!connection.accessToken) {
    throw new Error("No access token available");
  }

  switch (connection.provider) {
    case "tradier":
      return fetchTradierQuotes(connection.accessToken, symbols);
    case "polygon":
      return fetchPolygonQuotes(connection.accessToken, symbols);
    case "alpaca":
      return fetchAlpacaQuotes(connection.accessToken, connection.refreshToken, symbols);
    case "ibkr":
      return fetchIBKRQuotes(connection.accessToken, symbols);
    case "schwab":
      return fetchSchwabQuotes(connection.accessToken, symbols);
    default:
      throw new Error(`Provider ${connection.provider} not supported for market data`);
  }
}

function calculateVCPStage(quote: QuoteData): "FORMING" | "READY" | "BREAKOUT" {
  const priceFromHigh = ((quote.high - quote.last) / quote.high) * 100;
  
  if (quote.change > 0 && quote.changePercent > 2) {
    return PatternStage.BREAKOUT;
  } else if (priceFromHigh < 5 && quote.change > 0) {
    return PatternStage.READY;
  }
  return PatternStage.FORMING;
}

export function quotesToScanResults(quotes: QuoteData[]): ScanResult[] {
  return quotes.map((quote) => {
    const stage = calculateVCPStage(quote);
    const resistance = quote.high * 1.02;
    const stopLoss = quote.last * 0.93;
    const patternScore = Math.min(100, Math.max(50, 
      70 + (quote.changePercent > 0 ? 10 : -10) + 
      (quote.volume > (quote.avgVolume || quote.volume) ? 10 : 0)
    ));

    return {
      id: randomUUID(),
      scanRunId: null,
      ticker: quote.symbol,
      name: quote.symbol,
      price: Number(quote.last.toFixed(2)),
      change: Number(quote.change.toFixed(2)),
      changePercent: Number(quote.changePercent.toFixed(2)),
      volume: quote.volume,
      avgVolume: quote.avgVolume || null,
      rvol: quote.avgVolume ? Number((quote.volume / quote.avgVolume).toFixed(2)) : null,
      stage,
      resistance: Number(resistance.toFixed(2)),
      stopLoss: Number(stopLoss.toFixed(2)),
      patternScore,
      ema9: Number((quote.last * 0.99).toFixed(2)),
      ema21: Number((quote.last * 0.97).toFixed(2)),
      atr: Number((quote.last * 0.02).toFixed(2)),
      createdAt: new Date(),
    };
  });
}

export const DEFAULT_SCAN_SYMBOLS = [
  "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AMD",
  "CRM", "NFLX", "AVGO", "COST", "ADBE", "INTC", "ORCL", "CSCO",
];

export const DOW_30_SYMBOLS = [
  "AAPL", "AMGN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS", "DOW",
  "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM",
  "MRK", "MSFT", "NKE", "PG", "TRV", "UNH", "V", "VZ", "WBA", "WMT"
];

export const NASDAQ_100_TOP = [
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "GOOG", "AVGO", "TSLA", "COST",
  "PEP", "ADBE", "NFLX", "AMD", "CSCO", "TMUS", "INTC", "CMCSA", "AMGN", "INTU",
  "QCOM", "TXN", "HON", "AMAT", "BKNG", "ISRG", "SBUX", "VRTX", "ADP", "MDLZ"
];

export const SP500_TOP = [
  "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK.B", "UNH", "XOM",
  "JNJ", "JPM", "V", "PG", "MA", "HD", "CVX", "MRK", "ABBV", "LLY",
  "PEP", "KO", "COST", "AVGO", "WMT", "MCD", "CSCO", "TMO", "ACN", "ABT"
];

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function getDateRange(timeframe: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let startDate = new Date(now);
  
  switch (timeframe) {
    case "1D":
      startDate.setDate(startDate.getDate() - 1);
      break;
    case "1W":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "1M":
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case "3M":
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case "6M":
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case "1Y":
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 3);
  }
  
  return { start: startDate.toISOString().split('T')[0], end };
}

export async function fetchTradierHistory(
  accessToken: string,
  symbol: string,
  timeframe: string
): Promise<CandleData[]> {
  const { start, end } = getDateRange(timeframe);
  const interval = timeframe === "1D" ? "5min" : "daily";
  
  const response = await fetch(
    `https://api.tradier.com/v1/markets/history?symbol=${symbol}&interval=${interval}&start=${start}&end=${end}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Tradier history API error: ${response.status}`);
  }

  const data = await response.json();
  const history = data.history?.day;
  
  if (!history) return [];
  
  const historyArray = Array.isArray(history) ? history : [history];
  
  return historyArray.map((d: any) => ({
    time: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
  }));
}

export async function fetchPolygonHistory(
  accessToken: string,
  symbol: string,
  timeframe: string
): Promise<CandleData[]> {
  const { start, end } = getDateRange(timeframe);
  const multiplier = timeframe === "1D" ? 5 : 1;
  const span = timeframe === "1D" ? "minute" : "day";
  
  const response = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${span}/${start}/${end}?apiKey=${accessToken}&limit=5000`
  );

  if (!response.ok) {
    throw new Error(`Polygon history API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];
  
  return results.map((d: any) => ({
    time: new Date(d.t).toISOString().split('T')[0],
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: d.v,
  }));
}

export async function fetchAlpacaHistory(
  accessToken: string,
  secretKey: string | null,
  symbol: string,
  timeframe: string
): Promise<CandleData[]> {
  const { start, end } = getDateRange(timeframe);
  const tf = timeframe === "1D" ? "5Min" : "1Day";
  
  const headers: Record<string, string> = {
    "APCA-API-KEY-ID": accessToken,
  };
  if (secretKey) {
    headers["APCA-API-SECRET-KEY"] = secretKey;
  }

  const response = await fetch(
    `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=${tf}&start=${start}&end=${end}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Alpaca history API error: ${response.status}`);
  }

  const data = await response.json();
  const bars = data.bars || [];
  
  return bars.map((d: any) => ({
    time: d.t.split('T')[0],
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: d.v,
  }));
}

export async function fetchHistoryFromBroker(
  connection: BrokerConnection,
  symbol: string,
  timeframe: string
): Promise<CandleData[]> {
  if (!connection.accessToken) {
    throw new Error("No access token available");
  }

  switch (connection.provider) {
    case "tradier":
      return fetchTradierHistory(connection.accessToken, symbol, timeframe);
    case "polygon":
      return fetchPolygonHistory(connection.accessToken, symbol, timeframe);
    case "alpaca":
      return fetchAlpacaHistory(connection.accessToken, connection.refreshToken, symbol, timeframe);
    default:
      throw new Error(`Provider ${connection.provider} not supported for historical data`);
  }
}

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i];
    ema.push(sum / (i + 1));
  }
  
  for (let i = period; i < data.length; i++) {
    const value = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(value);
  }
  
  return ema;
}

export function processChartData(candles: CandleData[], ticker: string): {
  candles: CandleData[];
  ema9: number[];
  ema21: number[];
  ema50: number[];
  resistance: number;
  stopLoss: number;
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  atr: number;
  rvol: number;
  patternScore: number;
  stage: string;
  contractionZones: Array<{ start: string; end: string; highLevel: number; lowLevel: number }>;
  vcpAnnotations: Array<{ time: string; price: number; type: string; label?: string }>;
} {
  if (!candles.length) {
    return {
      candles: [],
      ema9: [],
      ema21: [],
      ema50: [],
      resistance: 100,
      stopLoss: 90,
      ticker,
      name: ticker,
      price: 100,
      change: 0,
      changePercent: 0,
      volume: 0,
      avgVolume: 0,
      atr: 2,
      rvol: 1,
      patternScore: 50,
      stage: "FORMING",
      contractionZones: [],
      vcpAnnotations: [],
    };
  }

  const closes = candles.map(c => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : last;
  
  const highestHigh = Math.max(...candles.slice(-20).map(c => c.high));
  const resistance = highestHigh * 1.02;
  const stopLoss = last.close * 0.93;
  
  const volumes = candles.map(c => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const rvol = avgVolume > 0 ? last.volume / avgVolume : 1;
  
  const ranges = candles.slice(-14).map(c => c.high - c.low);
  const atr = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  
  const change = last.close - prev.close;
  const changePercent = prev.close > 0 ? (change / prev.close) * 100 : 0;
  
  const priceFromHigh = ((highestHigh - last.close) / highestHigh) * 100;
  let stage = "FORMING";
  if (change > 0 && changePercent > 2) {
    stage = "BREAKOUT";
  } else if (priceFromHigh < 5 && change > 0) {
    stage = "READY";
  } else if (priceFromHigh < 2) {
    stage = "APPROACHING";
  }
  
  const patternScore = Math.min(100, Math.max(50,
    70 + (changePercent > 0 ? 10 : -10) + (rvol > 1.5 ? 10 : 0)
  ));

  const contractionZones: Array<{ start: string; end: string; highLevel: number; lowLevel: number }> = [];
  const vcpAnnotations: Array<{ time: string; price: number; type: string; label?: string }> = [];
  
  if (candles.length > 20) {
    const recentCandles = candles.slice(-30);
    let zoneStart = recentCandles[0].time;
    let zoneHigh = recentCandles[0].high;
    let zoneLow = recentCandles[0].low;
    
    for (let i = 1; i < recentCandles.length; i++) {
      const c = recentCandles[i];
      if (c.high > zoneHigh * 1.02 || c.low < zoneLow * 0.98) {
        if (i > 5) {
          contractionZones.push({
            start: zoneStart,
            end: recentCandles[i - 1].time,
            highLevel: zoneHigh,
            lowLevel: zoneLow,
          });
        }
        zoneStart = c.time;
        zoneHigh = c.high;
        zoneLow = c.low;
      } else {
        zoneHigh = Math.max(zoneHigh, c.high);
        zoneLow = Math.min(zoneLow, c.low);
      }
    }
    
    if (highestHigh === last.high) {
      vcpAnnotations.push({
        time: last.time,
        price: last.high,
        type: "pivot_high",
        label: "Pivot High",
      });
    }
  }

  return {
    candles,
    ema9,
    ema21,
    ema50,
    resistance: Number(resistance.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    ticker,
    name: ticker,
    price: Number(last.close.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    volume: last.volume,
    avgVolume: Math.round(avgVolume),
    atr: Number(atr.toFixed(2)),
    rvol: Number(rvol.toFixed(2)),
    patternScore,
    stage,
    contractionZones,
    vcpAnnotations,
  };
}
