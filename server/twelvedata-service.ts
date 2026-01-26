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
