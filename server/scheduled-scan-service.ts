import cron from "node-cron";
import { storage } from "./storage";
import { ingestOpportunitiesFromScan } from "./opportunity-service";
import { fetchQuotesFromBroker, fetchHistoryFromBroker } from "./broker-service";
import { classifyVCPStage } from "./alert-engine";
import { StrategyType } from "@shared/schema";
import type { ScanResult } from "@shared/schema";

const DEFAULT_SCAN_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD", "INTC", "CRM",
  "NFLX", "ADBE", "PYPL", "SHOP", "SQ", "COIN", "ROKU", "ZM", "DOCU", "SNOW",
  "NET", "CRWD", "DDOG", "ZS", "OKTA", "MDB", "PLTR", "U", "RBLX", "ABNB",
  "UBER", "LYFT", "DASH", "PINS", "SNAP", "SPOT", "SE", "BABA", "JD", "PDD",
  "NIO", "XPEV", "LI", "RIVN", "LCID", "F", "GM", "TM", "RACE", "BA",
  "LMT", "RTX", "GD", "NOC", "CAT", "DE", "MMM", "HON", "GE", "JPM",
  "BAC", "WFC", "C", "GS", "MS", "V", "MA", "AXP", "SCHW", "XOM",
  "CVX", "COP", "SLB", "OXY", "MRO", "DVN", "EOG", "PXD", "FANG", "UNH",
  "JNJ", "PFE", "MRNA", "ABBV", "MRK", "LLY", "BMY", "AMGN", "GILD", "WMT",
  "COST", "TGT", "HD", "LOW", "SBUX", "MCD", "NKE", "DIS", "CMCSA", "T"
];

const US_MARKET_HOLIDAYS_2025_2026 = [
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
];

// Only scan strategies that the classifyVCPStage function can actually detect
// VCP-based strategies share similar classification logic
const VCP_BASED_STRATEGIES = [
  StrategyType.VCP,
  StrategyType.VCP_MULTIDAY,
];

function isTradingDay(date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  
  const dateStr = date.toISOString().split("T")[0];
  if (US_MARKET_HOLIDAYS_2025_2026.includes(dateStr)) return false;
  
  return true;
}

function quotesToScanResults(quotes: any[], strategy: string): ScanResult[] {
  const results: ScanResult[] = [];
  
  for (const quote of quotes) {
    const classification = classifyVCPStage(quote);
    
    if (classification.stage === "FORMING" || classification.stage === "READY" || classification.stage === "BREAKOUT") {
      results.push({
        id: crypto.randomUUID(),
        ticker: quote.symbol,
        name: quote.symbol,
        price: quote.last,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        avgVolume: quote.avgVolume || 0,
        rvol: classification.volumeRatio,
        stage: classification.stage,
        patternScore: Math.min(100, 60 + Math.floor(classification.volumeRatio * 10)),
        resistance: classification.resistance,
        stopLoss: classification.stopLoss,
        createdAt: new Date(),
        scanRunId: null,
        atr: null,
        ema9: null,
        ema21: null,
      });
    }
  }
  
  return results;
}

async function runScheduledScan(): Promise<void> {
  const now = new Date();
  console.log(`[ScheduledScan] Running scheduled scan at ${now.toISOString()}`);
  
  if (!isTradingDay(now)) {
    console.log("[ScheduledScan] Not a trading day, skipping scan");
    return;
  }
  
  try {
    const connection = await storage.getAnyActiveBrokerConnection();
    if (!connection) {
      console.log("[ScheduledScan] No active broker connection available, skipping scheduled scan");
      return;
    }
    
    const connectionWithToken = await storage.getBrokerConnectionWithToken(connection.userId);
    if (!connectionWithToken || !connectionWithToken.accessToken) {
      console.log("[ScheduledScan] Could not retrieve broker access token, skipping scan");
      return;
    }
    
    console.log(`[ScheduledScan] Using broker connection: ${connection.provider} (user: ${connection.userId})`);
    
    const BATCH_SIZE = 50;
    const allQuotes: any[] = [];
    
    for (let i = 0; i < DEFAULT_SCAN_UNIVERSE.length; i += BATCH_SIZE) {
      const batch = DEFAULT_SCAN_UNIVERSE.slice(i, i + BATCH_SIZE);
      try {
        const quotes = await fetchQuotesFromBroker(connectionWithToken, batch);
        allQuotes.push(...quotes);
        await new Promise(r => setTimeout(r, 200));
      } catch (error: any) {
        console.error(`[ScheduledScan] Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      }
    }
    
    console.log(`[ScheduledScan] Fetched ${allQuotes.length} quotes from ${DEFAULT_SCAN_UNIVERSE.length} symbols`);
    
    let totalIngested = 0;
    
    // Only run VCP-based strategies since classifyVCPStage is designed for VCP pattern detection
    // Other strategies (ORB, VWAP, Gap&Go, etc.) require different classification logic
    for (const strategy of VCP_BASED_STRATEGIES) {
      const results = quotesToScanResults(allQuotes, strategy);
      
      if (results.length > 0) {
        console.log(`[ScheduledScan] Strategy ${strategy}: ${results.length} qualifying opportunities`);
        
        try {
          const ingested = await ingestOpportunitiesFromScan(connection.userId, results, strategy, "1d");
          totalIngested += ingested;
        } catch (error: any) {
          console.error(`[ScheduledScan] Failed to ingest for strategy ${strategy}:`, error.message);
        }
      }
    }
    
    console.log(`[ScheduledScan] Completed: ingested ${totalIngested} total opportunities across all strategies and users`);
  } catch (error: any) {
    console.error("[ScheduledScan] Error running scheduled scan:", error.message);
  }
}

export function startScheduledScanService(): void {
  cron.schedule("45 9 * * 1-5", async () => {
    console.log("[ScheduledScan] 9:45 AM ET cron triggered");
    await runScheduledScan();
  }, {
    timezone: "America/New_York"
  });
  
  console.log("[ScheduledScan] Scheduled scan service started - runs at 9:45 AM ET on trading days (Mon-Fri)");
}

export async function runManualScheduledScan(): Promise<{ success: boolean; message: string; ingestedCount?: number }> {
  try {
    await runScheduledScan();
    return { success: true, message: "Scheduled scan completed successfully" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
