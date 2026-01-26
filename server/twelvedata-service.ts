import { QuoteData } from "./broker-service";

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY;
const BASE_URL = "https://api.twelvedata.com";

export function isTwelveDataConfigured(): boolean {
  return !!TWELVEDATA_API_KEY;
}

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
  average_volume: string;
  is_market_open: boolean;
}

interface TwelveDataBatchResponse {
  [symbol: string]: TwelveDataQuote | { code: number; message: string; status: string };
}

export async function fetchTwelveDataQuotes(symbols: string[]): Promise<QuoteData[]> {
  if (!TWELVEDATA_API_KEY) {
    throw new Error("Twelve Data API key not configured");
  }

  const results: QuoteData[] = [];
  
  // Twelve Data allows up to 8 symbols per request on free tier, 120 on paid
  // Free tier: 8 API calls/minute, 800/day
  const BATCH_SIZE = 8;
  const RATE_LIMIT_DELAY_MS = 8000; // 8 seconds between batches to stay within 8 req/min
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const symbolsParam = batch.join(",");
    
    try {
      const url = `${BASE_URL}/quote?symbol=${symbolsParam}&apikey=${TWELVEDATA_API_KEY}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.warn(`[TwelveData] Rate limited, waiting before retry`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
        continue;
      }
      
      if (!response.ok) {
        console.error(`[TwelveData] API error: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Handle single symbol response (not wrapped in object)
      if (batch.length === 1 && data.symbol) {
        const quote = data as TwelveDataQuote;
        if (!quote.close || quote.close === "0") continue;
        
        results.push({
          symbol: quote.symbol,
          last: parseFloat(quote.close) || 0,
          change: parseFloat(quote.change) || 0,
          changePercent: parseFloat(quote.percent_change) || 0,
          volume: parseInt(quote.volume) || 0,
          avgVolume: parseInt(quote.average_volume) || 0,
          high: parseFloat(quote.high) || 0,
          low: parseFloat(quote.low) || 0,
          open: parseFloat(quote.open) || 0,
          prevClose: parseFloat(quote.previous_close) || 0,
        });
      } else {
        // Handle batch response
        const batchData = data as TwelveDataBatchResponse;
        for (const symbol of batch) {
          const quote = batchData[symbol];
          if (!quote || "code" in quote || !("close" in quote)) continue;
          if (!quote.close || quote.close === "0") continue;
          
          results.push({
            symbol: quote.symbol,
            last: parseFloat(quote.close) || 0,
            change: parseFloat(quote.change) || 0,
            changePercent: parseFloat(quote.percent_change) || 0,
            volume: parseInt(quote.volume) || 0,
            avgVolume: parseInt(quote.average_volume) || 0,
            high: parseFloat(quote.high) || 0,
            low: parseFloat(quote.low) || 0,
            open: parseFloat(quote.open) || 0,
            prevClose: parseFloat(quote.previous_close) || 0,
          });
        }
      }
      
      // Rate limiting: Twelve Data free tier is 8 requests/minute
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    } catch (error) {
      console.error(`[TwelveData] Error fetching batch:`, error);
    }
  }
  
  return results;
}

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TwelveDataTimeSeriesResponse {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    type: string;
  };
  values: TwelveDataCandle[];
  status: string;
}

export async function fetchTwelveDataHistory(
  symbol: string,
  interval: string = "1day",
  outputsize: number = 252
): Promise<{ open: number; high: number; low: number; close: number; volume: number; date: string }[]> {
  if (!TWELVEDATA_API_KEY) {
    throw new Error("Twelve Data API key not configured");
  }
  
  try {
    const url = `${BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVEDATA_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`);
    }
    
    const data: TwelveDataTimeSeriesResponse = await response.json();
    
    if (!data.values || !Array.isArray(data.values)) {
      return [];
    }
    
    // Twelve Data returns newest first, reverse for chronological order
    return data.values.reverse().map(candle => ({
      open: parseFloat(candle.open) || 0,
      high: parseFloat(candle.high) || 0,
      low: parseFloat(candle.low) || 0,
      close: parseFloat(candle.close) || 0,
      volume: parseInt(candle.volume) || 0,
      date: candle.datetime,
    }));
  } catch (error) {
    console.error(`[TwelveData] Error fetching history for ${symbol}:`, error);
    throw error;
  }
}

export function getDataSourceStatus(): { configured: boolean; provider: string } {
  return {
    configured: isTwelveDataConfigured(),
    provider: "twelvedata",
  };
}

import { randomUUID } from "crypto";
import { vcpMultidayStrategy } from "./strategies/vcpMultiday";
import { StrategyType, type ScanResult } from "@shared/schema";
import type { Candle } from "./strategies/types";

// Rate-limited multiday scan using Twelve Data
// Note: Free tier is 8 req/min, so we process sequentially with delays
export async function runTwelveDataMultidayScan(quotes: QuoteData[]): Promise<ScanResult[]> {
  if (!isTwelveDataConfigured()) {
    console.log("[TwelveData] Not configured, skipping multiday scan");
    return [];
  }
  
  const results: ScanResult[] = [];
  const DELAY_MS = 8000; // 8 seconds between requests to respect rate limit (8 req/min)
  
  // Process top 5 symbols to respect rate limits on free tier
  const symbolsToProcess = quotes.slice(0, 5);
  
  for (let i = 0; i < symbolsToProcess.length; i++) {
    const quote = symbolsToProcess[i];
    
    try {
      // Add delay between requests (except for first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
      
      const candles = await fetchTwelveDataHistory(quote.symbol, "1day", 90);
      
      const strategyCandles: Candle[] = candles.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        timestamp: new Date(c.date),
      }));
      
      const classification = vcpMultidayStrategy.classify(quote, strategyCandles);
      
      results.push({
        id: randomUUID(),
        scanRunId: null,
        ticker: quote.symbol,
        name: quote.symbol,
        price: Number(quote.last.toFixed(2)),
        change: Number(quote.change.toFixed(2)),
        changePercent: Number(quote.changePercent.toFixed(2)),
        volume: quote.volume,
        avgVolume: quote.avgVolume !== undefined ? quote.avgVolume : null,
        rvol: classification.rvol != null ? Number(classification.rvol.toFixed(2)) : null,
        stage: classification.stage,
        resistance: classification.levels.resistance ?? null,
        stopLoss: classification.levels.stopLevel ?? null,
        patternScore: classification.score,
        ema9: classification.ema9 ? Number(classification.ema9.toFixed(2)) : Number((quote.last * 0.99).toFixed(2)),
        ema21: classification.ema21 ? Number(classification.ema21.toFixed(2)) : Number((quote.last * 0.97).toFixed(2)),
        atr: Number((quote.last * 0.02).toFixed(2)),
        createdAt: new Date(),
        strategy: StrategyType.VCP_MULTIDAY,
      });
    } catch (error) {
      console.error(`[TwelveData] Failed multiday scan for ${quote.symbol}:`, error);
    }
  }
  
  return results;
}
