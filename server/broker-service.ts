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
