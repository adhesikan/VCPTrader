import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAlertSchema, insertAlertRuleSchema, insertWatchlistSchema, insertAutomationSettingsSchema, scannerFilters, UserRole, RuleConditionType, PatternStage, StrategyType } from "@shared/schema";
import { sendEntrySignal, sendExitSignal, createAutomationLogEntry, type EntrySignal, type ExitSignal } from "./algopilotx";
import { getStrategyList, classifyQuote, StrategyId, PullbackStage, runAllPluginScans, STRATEGY_PRESETS, getAllStrategyIds, StrategyIdType } from "./strategies";
import { classifyMarketRegime, getRegimeAdjustment } from "./engine/regime";
import { aggregateConfluence, rankByConfluence, filterByMinMatches, ConfluenceResult } from "./engine/confluence";
import { CandleData } from "./engine/indicators";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";
import { 
  fetchQuotesFromBroker, 
  quotesToScanResults, 
  fetchHistoryFromBroker,
  fetchHistoryWithDateRange,
  processChartData,
  DEFAULT_SCAN_SYMBOLS,
  DOW_30_SYMBOLS,
  NASDAQ_100_TOP,
  SP500_TOP,
  LARGE_CAP_UNIVERSE
} from "./broker-service";
import { isPromoActive, PROMO_CONFIG, PROMO_CODE } from "@shared/promo";

const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await authStorage.getUser(req.session.userId);
  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/promo/status", (req, res) => {
    const active = isPromoActive();
    res.json({
      active,
      code: active ? PROMO_CODE : null,
      config: active ? PROMO_CONFIG : null,
    });
  });

  app.get("/api/strategies", (req, res) => {
    const strategies = getStrategyList().map(s => ({
      ...s,
      stages: s.id === StrategyId.VCP 
        ? [PatternStage.FORMING, PatternStage.READY, PatternStage.BREAKOUT]
        : [PullbackStage.FORMING, PullbackStage.READY, PullbackStage.TRIGGERED],
    }));
    res.json(strategies);
  });

  app.get("/api/strategies/presets", (req, res) => {
    res.json({
      BREAKOUTS: STRATEGY_PRESETS.BREAKOUTS,
      INTRADAY: STRATEGY_PRESETS.INTRADAY,
      SWING: STRATEGY_PRESETS.SWING,
      ALL: STRATEGY_PRESETS.ALL,
    });
  });

  app.get("/api/universes", (req, res) => {
    res.json({
      dow30: { symbols: DOW_30_SYMBOLS, count: DOW_30_SYMBOLS.length },
      nasdaq100: { symbols: NASDAQ_100_TOP, count: NASDAQ_100_TOP.length },
      sp500: { symbols: SP500_TOP, count: SP500_TOP.length },
      all: { symbols: LARGE_CAP_UNIVERSE, count: LARGE_CAP_UNIVERSE.length },
    });
  });

  app.get("/api/market/regime", async (req, res) => {
    try {
      const userId = req.session?.userId;
      let candles: CandleData[] = [];
      
      if (userId) {
        const connection = await storage.getBrokerConnectionWithToken(userId);
        if (connection?.accessToken && connection?.isConnected) {
          try {
            const history = await fetchHistoryFromBroker(connection, "SPY", "3M");
            candles = history.map(c => ({
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
              time: c.time,
            }));
          } catch (e) {
            console.error("Failed to fetch SPY for regime:", e);
          }
        }
      }
      
      if (candles.length < 30) {
        return res.json({
          regime: "CHOPPY",
          strength: 0,
          ema21Slope: 0,
          priceVsEma21: 0,
          description: "Insufficient market data for regime classification",
        });
      }
      
      const regime = classifyMarketRegime(candles);
      res.json(regime);
    } catch (error) {
      console.error("Regime classification error:", error);
      res.status(500).json({ error: "Failed to classify market regime" });
    }
  });

  app.post("/api/scan/multi-strategy", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnectionWithToken(userId);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({ 
          error: "No broker connection. Please connect a brokerage in Settings first." 
        });
      }

      const { symbols = DEFAULT_SCAN_SYMBOLS, strategyIds, timeframe = "1d" } = req.body;
      const selectedStrategies: StrategyIdType[] = strategyIds || getAllStrategyIds();
      
      const quotes = await fetchQuotesFromBroker(connection, symbols);
      const allResults: any[] = [];
      
      for (const quote of quotes) {
        try {
          const history = await fetchHistoryFromBroker(connection, quote.symbol, "3M");
          const candles: CandleData[] = history.map(c => ({
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            time: c.time,
          }));
          
          if (candles.length < 20) continue;
          
          const pluginResults = runAllPluginScans(
            quote.symbol,
            candles,
            timeframe,
            selectedStrategies.filter(id => 
              id !== StrategyId.VCP && 
              id !== StrategyId.VCP_MULTIDAY && 
              id !== StrategyId.CLASSIC_PULLBACK
            ) as StrategyIdType[],
            quote
          );
          
          allResults.push(...pluginResults);
        } catch (e) {
          console.error(`Failed to scan ${quote.symbol}:`, e);
        }
      }
      
      res.json(allResults);
    } catch (error: any) {
      console.error("Multi-strategy scan error:", error);
      res.status(500).json({ error: error.message || "Failed to run multi-strategy scan" });
    }
  });

  app.get("/api/market/regime", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnectionWithToken(userId);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({ 
          error: "No broker connection. Please connect a brokerage in Settings first." 
        });
      }

      const spyHistory = await fetchHistoryFromBroker(connection, "SPY", "3M");
      const spyCandles: CandleData[] = spyHistory.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        time: c.time,
      }));
      
      const regime = classifyMarketRegime(spyCandles);
      res.json(regime);
    } catch (error: any) {
      console.error("Market regime error:", error);
      res.status(500).json({ error: error.message || "Failed to get market regime" });
    }
  });

  app.post("/api/scan/confluence", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnectionWithToken(userId);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({ 
          error: "No broker connection. Please connect a brokerage in Settings first." 
        });
      }

      const { 
        symbols = DEFAULT_SCAN_SYMBOLS, 
        minMatches = 2, 
        timeframe = "1d",
        strategies,
        minPrice,
        maxPrice,
        minVolume
      } = req.body;
      
      let marketRegime;
      try {
        const spyHistory = await fetchHistoryFromBroker(connection, "SPY", "3M");
        const spyCandles: CandleData[] = spyHistory.map(c => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          time: c.time,
        }));
        marketRegime = classifyMarketRegime(spyCandles);
      } catch (e) {
        console.error("Failed to get market regime, using default:", e);
      }
      
      const quotes = await fetchQuotesFromBroker(connection, symbols);
      const confluenceResults: ConfluenceResult[] = [];
      
      for (const quote of quotes) {
        try {
          if (minPrice && quote.last < minPrice) continue;
          if (maxPrice && quote.last > maxPrice) continue;
          if (minVolume && quote.volume < minVolume) continue;
          
          const history = await fetchHistoryFromBroker(connection, quote.symbol, "3M");
          const candles: CandleData[] = history.map(c => ({
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            time: c.time,
          }));
          
          if (candles.length < 20) continue;
          
          const pluginResults = runAllPluginScans(
            quote.symbol,
            candles,
            timeframe,
            strategies,
            quote
          );
          
          if (pluginResults.length > 0) {
            const confluence = aggregateConfluence(
              quote.symbol, 
              pluginResults, 
              10, 
              marketRegime?.regime
            );
            if (confluence) {
              confluenceResults.push(confluence);
            }
          }
        } catch (e) {
          console.error(`Failed to confluence scan ${quote.symbol}:`, e);
        }
      }
      
      const filtered = filterByMinMatches(confluenceResults, minMatches);
      const ranked = rankByConfluence(filtered);
      
      res.json({ results: ranked, marketRegime });
    } catch (error: any) {
      console.error("Confluence scan error:", error);
      res.status(500).json({ error: error.message || "Failed to run confluence scan" });
    }
  });

  app.get("/api/market/stats", async (req, res) => {
    try {
      const stats = await storage.getMarketStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get market stats" });
    }
  });

  app.get("/api/scan/results", async (req, res) => {
    try {
      const userId = req.session?.userId;
      const includeMeta = req.query.meta === "true";
      
      if (userId) {
        const connection = await storage.getBrokerConnectionWithToken(userId);
        if (connection?.accessToken && connection?.isConnected) {
          try {
            const quotes = await fetchQuotesFromBroker(connection, DEFAULT_SCAN_SYMBOLS);
            const liveResults = quotesToScanResults(quotes);
            if (includeMeta) {
              return res.json({ data: liveResults, isLive: true, provider: connection.provider });
            }
            return res.json(liveResults);
          } catch (brokerError: any) {
            console.error("Broker fetch failed, falling back to stored results:", brokerError.message);
            const storedResults = await storage.getScanResults();
            if (includeMeta) {
              return res.json({ data: storedResults, isLive: false, error: brokerError.message });
            }
            return res.json(storedResults);
          }
        }
      }
      
      const storedResults = await storage.getScanResults();
      if (includeMeta) {
        return res.json({ data: storedResults, isLive: false, requiresBroker: !storedResults.length });
      }
      res.json(storedResults);
    } catch (error) {
      res.status(500).json({ error: "Failed to get scan results" });
    }
  });

  app.get("/api/scan/result/:ticker", async (req, res) => {
    try {
      const result = await storage.getScanResult(req.params.ticker);
      res.json(result || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get scan result" });
    }
  });

  app.post("/api/scan/run", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const filters = scannerFilters.parse(req.body);
      const results = await storage.runScan();
      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to run scan" });
      }
    }
  });

  app.post("/api/scan/live", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnectionWithToken(userId);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({ 
          error: "No broker connection. Please connect a brokerage in Settings first." 
        });
      }

      const requestedSymbols = req.body.symbols || DEFAULT_SCAN_SYMBOLS;
      const strategy = req.body.strategy || StrategyType.VCP;
      const startTime = Date.now();
      const BATCH_SIZE = 200;
      
      let allQuotes: any[] = [];
      const totalSymbols = requestedSymbols.length;
      
      if (totalSymbols > BATCH_SIZE) {
        for (let i = 0; i < totalSymbols; i += BATCH_SIZE) {
          const batch = requestedSymbols.slice(i, i + BATCH_SIZE);
          try {
            const batchQuotes = await fetchQuotesFromBroker(connection, batch);
            allQuotes = allQuotes.concat(batchQuotes);
          } catch (batchError: any) {
            console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, batchError.message);
          }
          
          if (i + BATCH_SIZE < totalSymbols) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        allQuotes = await fetchQuotesFromBroker(connection, requestedSymbols);
      }
      
      const results = quotesToScanResults(allQuotes, strategy);
      const scanTime = Date.now() - startTime;
      
      res.json({
        results,
        metadata: {
          isLive: true,
          provider: connection.provider,
          symbolsRequested: totalSymbols,
          symbolsReturned: allQuotes.length,
          batchCount: Math.ceil(totalSymbols / BATCH_SIZE),
          scanTimeMs: scanTime,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error: any) {
      console.error("Live scan error:", error);
      res.status(500).json({ error: error.message || "Failed to run live scan" });
    }
  });

  app.get("/api/charts/:ticker/:timeframe?", async (req, res) => {
    try {
      const { ticker, timeframe = "3M" } = req.params;
      const userId = req.session?.userId;
      
      if (userId) {
        const connection = await storage.getBrokerConnectionWithToken(userId);
        if (connection?.accessToken && connection?.isConnected) {
          try {
            const candles = await fetchHistoryFromBroker(connection, ticker.toUpperCase(), timeframe);
            const chartData = processChartData(candles, ticker.toUpperCase());
            return res.json({ ...chartData, isLive: true });
          } catch (brokerError: any) {
            console.error("Chart broker fetch failed, using stored data:", brokerError.message);
            const storedData = storage.getChartData(ticker.toUpperCase());
            return res.json({ ...storedData, isLive: false, error: brokerError.message });
          }
        }
      }
      
      const storedData = storage.getChartData(ticker.toUpperCase());
      res.json({ ...storedData, isLive: false, requiresBroker: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to get chart data" });
    }
  });

  app.get("/api/alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alerts" });
    }
  });

  app.post("/api/alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const alertData = insertAlertSchema.parse(req.body);
      const alert = await storage.createAlert(alertData);
      res.json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create alert" });
      }
    }
  });

  app.patch("/api/alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const alert = await storage.updateAlert(req.params.id, req.body);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteAlert(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  app.delete("/api/alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteAllAlerts();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alerts" });
    }
  });

  app.post("/api/alerts/mark-all-read", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.markAllAlertsRead();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark alerts as read" });
    }
  });

  app.get("/api/alert-rules", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const rules = await storage.getAlertRules(userId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alert rules" });
    }
  });

  app.get("/api/alert-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const rule = await storage.getAlertRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Alert rule not found" });
      }
      if (rule.userId !== req.session.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alert rule" });
    }
  });

  app.post("/api/alert-rules", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const ruleData = insertAlertRuleSchema.parse({
        ...req.body,
        userId,
      });
      
      const rule = await storage.createAlertRule(ruleData);
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create alert rule" });
      }
    }
  });

  app.patch("/api/alert-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const rule = await storage.getAlertRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Alert rule not found" });
      }
      if (rule.userId !== req.session.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const updated = await storage.updateAlertRule(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert rule" });
    }
  });

  app.delete("/api/alert-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const rule = await storage.getAlertRule(req.params.id);
      if (!rule) {
        return res.status(404).json({ error: "Alert rule not found" });
      }
      if (rule.userId !== req.session.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      await storage.deleteAlertRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alert rule" });
    }
  });

  app.get("/api/alert-events", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const ruleId = req.query.ruleId as string | undefined;
      const events = await storage.getAlertEvents(userId, ruleId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alert events" });
    }
  });

  app.get("/api/alert-events/:id", isAuthenticated, async (req, res) => {
    try {
      const event = await storage.getAlertEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Alert event not found" });
      }
      if (event.userId !== req.session.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alert event" });
    }
  });

  app.patch("/api/alert-events/:id/read", isAuthenticated, async (req, res) => {
    try {
      const event = await storage.getAlertEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Alert event not found" });
      }
      if (event.userId !== req.session.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const updated = await storage.markAlertEventRead(req.params.id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark event as read" });
    }
  });

  app.post("/api/alert-events/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.markAllAlertEventsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark events as read" });
    }
  });

  app.get("/api/watchlists", isAuthenticated, async (req, res) => {
    try {
      const watchlists = await storage.getWatchlists();
      res.json(watchlists);
    } catch (error) {
      res.status(500).json({ error: "Failed to get watchlists" });
    }
  });

  app.get("/api/watchlists/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const watchlist = await storage.getWatchlist(req.params.id);
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      res.status(500).json({ error: "Failed to get watchlist" });
    }
  });

  app.get("/api/watchlists/:id/results", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const results = await storage.getWatchlistResults(req.params.id);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to get watchlist results" });
    }
  });

  app.post("/api/watchlists", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const watchlistData = insertWatchlistSchema.parse(req.body);
      const watchlist = await storage.createWatchlist(watchlistData);
      res.json(watchlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create watchlist" });
      }
    }
  });

  app.delete("/api/watchlists/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteWatchlist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete watchlist" });
    }
  });

  app.post("/api/watchlists/:id/symbols", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }
      const watchlist = await storage.addSymbolToWatchlist(req.params.id, symbol);
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      res.status(500).json({ error: "Failed to add symbol" });
    }
  });

  app.delete("/api/watchlists/:id/symbols/:symbol", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const watchlist = await storage.removeSymbolFromWatchlist(
        req.params.id,
        req.params.symbol
      );
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }
      res.json(watchlist);
    } catch (error) {
      res.status(500).json({ error: "Failed to remove symbol" });
    }
  });

  app.get("/api/broker/status", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnection(userId);
      if (!connection) {
        return res.json(null);
      }
      const sanitizedConnection = {
        id: connection.id,
        userId: connection.userId,
        provider: connection.provider,
        isConnected: connection.isConnected,
        lastSync: connection.lastSync,
      };
      res.json(sanitizedConnection);
    } catch (error) {
      res.status(500).json({ error: "Failed to get broker status" });
    }
  });

  app.post("/api/broker/connect", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { provider, accessToken, secretKey } = req.body;
      if (!provider) {
        return res.status(400).json({ error: "Provider is required" });
      }
      if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
        return res.status(400).json({ error: "Access token is required" });
      }
      const connection = await storage.setBrokerConnectionWithTokens(
        userId,
        provider,
        accessToken.trim(),
        secretKey?.trim() || undefined
      );
      const sanitizedConnection = {
        id: connection.id,
        userId: connection.userId,
        provider: connection.provider,
        isConnected: connection.isConnected,
        lastSync: connection.lastSync,
      };
      res.json(sanitizedConnection);
    } catch (error: any) {
      console.error("Failed to connect broker:", error.message);
      res.status(500).json({ error: error.message || "Failed to connect broker" });
    }
  });

  app.post("/api/broker/disconnect", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.clearBrokerConnection(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to disconnect broker" });
    }
  });

  // Auto-connect endpoint - checks stored credentials and establishes connection
  app.post("/api/broker/auto-connect", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnectionWithToken(userId);
      
      if (!connection || !connection.accessToken) {
        return res.json({ connected: false, reason: "no_credentials" });
      }

      // Test the stored credentials
      let isValid = false;
      
      if (connection.provider === "tradier") {
        const response = await fetch("https://api.tradier.com/v1/markets/quotes?symbols=AAPL", {
          headers: {
            "Authorization": `Bearer ${connection.accessToken}`,
            "Accept": "application/json",
          },
        });
        isValid = response.ok;
      } else if (connection.provider === "alpaca") {
        const headers: Record<string, string> = {
          "APCA-API-KEY-ID": connection.accessToken,
        };
        if (connection.refreshToken) {
          headers["APCA-API-SECRET-KEY"] = connection.refreshToken;
        }
        const response = await fetch("https://paper-api.alpaca.markets/v2/account", { headers });
        isValid = response.ok;
      } else if (connection.provider === "polygon") {
        const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=${connection.accessToken}`);
        isValid = response.ok;
      }

      if (isValid) {
        // Update connection status to connected
        await storage.updateBrokerConnectionStatus(userId, true);
        res.json({ 
          connected: true, 
          provider: connection.provider,
          message: "Auto-connected successfully" 
        });
      } else {
        // Mark as disconnected if credentials are invalid
        await storage.updateBrokerConnectionStatus(userId, false);
        res.json({ connected: false, reason: "invalid_credentials" });
      }
    } catch (error: any) {
      console.error("Auto-connect error:", error.message);
      res.json({ connected: false, reason: "error", error: error.message });
    }
  });

  app.post("/api/broker/test", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const connection = await storage.getBrokerConnectionWithToken(userId);
      
      if (!connection || !connection.accessToken) {
        return res.status(400).json({ success: false, error: "No broker connection found" });
      }

      let testResult: { success: boolean; message: string; data?: any };

      if (connection.provider === "tradier") {
        const response = await fetch("https://api.tradier.com/v1/markets/quotes?symbols=AAPL", {
          headers: {
            "Authorization": `Bearer ${connection.accessToken}`,
            "Accept": "application/json",
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const quote = data.quotes?.quote;
          testResult = {
            success: true,
            message: "Connection successful",
            data: quote ? {
              symbol: quote.symbol,
              last: quote.last,
              change: quote.change,
              volume: quote.volume,
            } : null,
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          testResult = {
            success: false,
            message: errorData.fault?.faultstring || `API error: ${response.status}`,
          };
        }
      } else if (connection.provider === "alpaca") {
        const headers: Record<string, string> = {
          "APCA-API-KEY-ID": connection.accessToken,
        };
        if (connection.refreshToken) {
          headers["APCA-API-SECRET-KEY"] = connection.refreshToken;
        }
        const response = await fetch("https://data.alpaca.markets/v2/stocks/bars/latest?symbols=AAPL", {
          headers,
        });
        
        if (response.ok) {
          const data = await response.json();
          const bar = data.bars?.AAPL;
          testResult = {
            success: true,
            message: "Connection successful",
            data: bar ? { symbol: "AAPL", last: bar.c, volume: bar.v } : null,
          };
        } else {
          const errorText = await response.text().catch(() => "");
          testResult = { success: false, message: `API error: ${response.status} ${errorText}` };
        }
      } else if (connection.provider === "polygon") {
        const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=${connection.accessToken}`);
        
        if (response.ok) {
          const data = await response.json();
          const result = data.results?.[0];
          testResult = {
            success: true,
            message: "Connection successful",
            data: result ? { symbol: "AAPL", close: result.c, volume: result.v } : null,
          };
        } else {
          testResult = { success: false, message: `API error: ${response.status}` };
        }
      } else if (connection.provider === "schwab") {
        const response = await fetch("https://api.schwabapi.com/marketdata/v1/quotes?symbols=AAPL", {
          headers: {
            "Authorization": `Bearer ${connection.accessToken}`,
            "Accept": "application/json",
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const quote = data.AAPL?.quote || data.AAPL;
          testResult = {
            success: true,
            message: "Connection successful",
            data: quote ? { symbol: "AAPL", last: quote.lastPrice || quote.mark, volume: quote.totalVolume } : null,
          };
        } else {
          testResult = { success: false, message: `API error: ${response.status}` };
        }
      } else if (connection.provider === "ibkr") {
        testResult = { 
          success: false, 
          message: "Interactive Brokers requires Client Portal API setup. Please use Tradier, Alpaca, or Polygon instead." 
        };
      } else {
        testResult = { success: true, message: "Connection stored (API test not available for this provider)" };
      }

      res.json(testResult);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || "Failed to test broker connection" });
    }
  });

  app.post("/api/push/subscribe", isAuthenticated, async (req, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription data" });
      }
      const subscription = await storage.createPushSubscription({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.get("/api/backtest/results", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const results = await storage.getBacktestResults(userId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to get backtest results" });
    }
  });

  app.post("/api/backtest/run", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { ticker, startDate, endDate, initialCapital, positionSize, stopLossPercent, strategy = StrategyType.VCP } = req.body;
      
      if (!ticker) {
        return res.status(400).json({ error: "Ticker symbol is required" });
      }

      const connection = await storage.getBrokerConnectionWithToken(userId);
      let candles: any[] = [];
      
      const warmupStart = new Date(startDate);
      warmupStart.setDate(warmupStart.getDate() - 100);
      const warmupStartStr = warmupStart.toISOString().split('T')[0];
      
      if (connection?.accessToken && connection?.isConnected) {
        try {
          candles = await fetchHistoryWithDateRange(connection, ticker.toUpperCase(), warmupStartStr, endDate);
        } catch (brokerError: any) {
          console.error("Broker fetch failed for backtest:", brokerError.message);
        }
      }

      if (candles.length === 0) {
        return res.status(400).json({ error: "No historical data available. Connect a broker to run backtests." });
      }

      if (candles.length < 60) {
        return res.status(400).json({ error: "Not enough data available. Need at least 60 trading days for accurate analysis." });
      }
      
      const startIdx = candles.findIndex(c => c.time >= startDate);
      if (startIdx < 0) {
        return res.status(400).json({ error: "No data available in the requested date range. Try a different date range." });
      }
      
      const lastCandleDate = candles[candles.length - 1].time;
      if (lastCandleDate < startDate) {
        return res.status(400).json({ error: "Available data ends before the requested start date. Try an earlier date range." });
      }
      
      const ema50WarmupIdx = 55;
      const actualStartIdx = Math.max(startIdx, ema50WarmupIdx);
      
      if (actualStartIdx >= candles.length) {
        return res.status(400).json({ error: "Not enough warm-up data before the requested start date. Try a later start date." });
      }

      const trades: any[] = [];
      let inPosition = false;
      let entryPrice = 0;
      let entryDate = "";
      let stopPrice = 0;
      let holdingDays = 0;
      const maxHoldingDays = 60;

      const calcEMA = (data: number[], period: number): number[] => {
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
      };

      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);
      const ema9 = calcEMA(closes, 9);
      const ema21 = calcEMA(closes, 21);
      const ema50 = calcEMA(closes, 50);

      for (let i = actualStartIdx; i < candles.length; i++) {
        const candle = candles[i];
        const avgVol20 = volumes.slice(i - 20, i).reduce((s, v) => s + v, 0) / 20;
        
        if (!inPosition) {
          let shouldEnter = false;
          
          if (strategy === StrategyType.CLASSIC_PULLBACK) {
            const inUptrend = ema9[i] > ema21[i] && ema21[i] > ema50[i];
            const priceAboveEMAs = candle.close > ema9[i];
            const hadPullback = candles.slice(i - 10, i).some(c => c.low <= ema21[i - 5] * 1.02);
            const volumeSpike = candle.volume > avgVol20 * 1.3;
            const bullishCandle = candle.close > candle.open;
            shouldEnter = inUptrend && priceAboveEMAs && hadPullback && volumeSpike && bullishCandle;
          } else if (strategy === StrategyType.VCP_MULTIDAY) {
            const lookback = Math.min(30, i);
            const recentHighs = highs.slice(i - lookback, i);
            const recentLows = lows.slice(i - lookback, i);
            const pivotHigh = Math.max(...recentHighs);
            const consolidationLow = Math.min(...recentLows);
            
            const range1 = Math.max(...highs.slice(i - lookback, i - Math.floor(lookback * 0.66))) - 
                          Math.min(...lows.slice(i - lookback, i - Math.floor(lookback * 0.66)));
            const range2 = Math.max(...highs.slice(i - Math.floor(lookback * 0.66), i - Math.floor(lookback * 0.33))) - 
                          Math.min(...lows.slice(i - Math.floor(lookback * 0.66), i - Math.floor(lookback * 0.33)));
            const range3 = Math.max(...highs.slice(i - Math.floor(lookback * 0.33), i)) - 
                          Math.min(...lows.slice(i - Math.floor(lookback * 0.33), i));
            
            const volatilityContracting = range1 > range2 && range2 > range3;
            const breakingOut = candle.close > pivotHigh * 0.99;
            const volumeConfirm = candle.volume > avgVol20 * 1.5;
            const inUptrend = ema21[i] > ema50[i];
            
            shouldEnter = volatilityContracting && breakingOut && volumeConfirm && inUptrend;
          } else {
            const lookback = 20;
            const recentHigh = Math.max(...highs.slice(i - lookback, i));
            const recentRange = highs.slice(i - 10, i).map((h, idx) => h - lows.slice(i - 10, i)[idx]);
            const avgRange = recentRange.reduce((s, r) => s + r, 0) / 10;
            const currentRange = candle.high - candle.low;
            
            const tightConsolidation = currentRange < avgRange * 0.8;
            const breakingOut = candle.close > recentHigh;
            const volumeConfirm = candle.volume > avgVol20 * 1.2;
            const inUptrend = ema9[i] > ema21[i];
            
            shouldEnter = tightConsolidation && breakingOut && volumeConfirm && inUptrend;
          }
          
          if (shouldEnter) {
            inPosition = true;
            entryPrice = candle.close;
            entryDate = candle.time.split('T')[0];
            stopPrice = entryPrice * (1 - stopLossPercent / 100);
            holdingDays = 0;
          }
        } else {
          holdingDays++;
          const currentReturn = ((candle.close - entryPrice) / entryPrice) * 100;
          
          if (candle.low <= stopPrice) {
            trades.push({
              ticker,
              entryDate,
              exitDate: candle.time.split('T')[0],
              entryPrice: Number(entryPrice.toFixed(2)),
              exitPrice: Number(stopPrice.toFixed(2)),
              returnPercent: Number((((stopPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
              exitReason: "Stop Loss",
            });
            inPosition = false;
          } else if (currentReturn >= 10) {
            trades.push({
              ticker,
              entryDate,
              exitDate: candle.time.split('T')[0],
              entryPrice: Number(entryPrice.toFixed(2)),
              exitPrice: Number(candle.close.toFixed(2)),
              returnPercent: Number(currentReturn.toFixed(2)),
              exitReason: "Target",
            });
            inPosition = false;
          } else if (holdingDays >= maxHoldingDays) {
            trades.push({
              ticker,
              entryDate,
              exitDate: candle.time.split('T')[0],
              entryPrice: Number(entryPrice.toFixed(2)),
              exitPrice: Number(candle.close.toFixed(2)),
              returnPercent: Number(currentReturn.toFixed(2)),
              exitReason: "Time Exit",
            });
            inPosition = false;
          } else if (currentReturn >= 5 && candle.close < ema9[i]) {
            trades.push({
              ticker,
              entryDate,
              exitDate: candle.time.split('T')[0],
              entryPrice: Number(entryPrice.toFixed(2)),
              exitPrice: Number(candle.close.toFixed(2)),
              returnPercent: Number(currentReturn.toFixed(2)),
              exitReason: "Trailing Stop",
            });
            inPosition = false;
          }
        }
      }

      if (inPosition && candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const currentReturn = ((lastCandle.close - entryPrice) / entryPrice) * 100;
        trades.push({
          ticker,
          entryDate,
          exitDate: lastCandle.time.split('T')[0],
          entryPrice: Number(entryPrice.toFixed(2)),
          exitPrice: Number(lastCandle.close.toFixed(2)),
          returnPercent: Number(currentReturn.toFixed(2)),
          exitReason: "Open Position",
        });
      }

      const wins = trades.filter(t => t.returnPercent > 0).length;
      const avgReturn = trades.length > 0 ? trades.reduce((sum, t) => sum + t.returnPercent, 0) / trades.length : 0;
      const totalReturn = trades.reduce((sum, t) => sum + t.returnPercent, 0);
      const returns = trades.map(t => t.returnPercent);
      const maxDrawdown = returns.length > 0 ? Math.abs(Math.min(...returns, 0)) : 0;
      const stdDev = returns.length > 1 
        ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
        : 0;
      const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252 / Math.max(1, trades.length)) : 0;

      const result = await storage.createBacktestResult({
        userId,
        ticker: ticker.toUpperCase(),
        startDate,
        endDate,
        initialCapital,
        positionSize,
        stopLossPercent,
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        avgReturn,
        maxDrawdown,
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        totalReturn,
        trades,
      });

      res.json(result);
    } catch (error) {
      console.error("Backtest error:", error);
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  app.delete("/api/backtest/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteBacktestResult(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete backtest" });
    }
  });

  app.get("/api/automation/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const settings = await storage.getAutomationSettings(userId);
      if (!settings) {
        return res.json({
          isEnabled: false,
          webhookUrl: null,
          hasApiKey: false,
          autoEntryEnabled: true,
          autoExitEnabled: true,
          minScore: 70,
          maxPositions: 5,
          defaultPositionSize: 1000,
        });
      }
      res.json({
        isEnabled: settings.isEnabled,
        webhookUrl: settings.webhookUrl,
        hasApiKey: !!settings.encryptedApiKey,
        autoEntryEnabled: settings.autoEntryEnabled,
        autoExitEnabled: settings.autoExitEnabled,
        minScore: settings.minScore,
        maxPositions: settings.maxPositions,
        defaultPositionSize: settings.defaultPositionSize,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get automation settings" });
    }
  });

  app.post("/api/automation/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { apiKey, ...settingsData } = req.body;
      
      const settings = await storage.setAutomationSettingsWithApiKey(
        userId,
        {
          ...settingsData,
          userId,
        },
        apiKey
      );
      
      res.json({
        isEnabled: settings.isEnabled,
        webhookUrl: settings.webhookUrl,
        hasApiKey: !!settings.encryptedApiKey,
        autoEntryEnabled: settings.autoEntryEnabled,
        autoExitEnabled: settings.autoExitEnabled,
        minScore: settings.minScore,
        maxPositions: settings.maxPositions,
        defaultPositionSize: settings.defaultPositionSize,
      });
    } catch (error) {
      console.error("Failed to save automation settings:", error);
      res.status(500).json({ error: "Failed to save automation settings" });
    }
  });

  app.get("/api/automation/logs", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAutomationLogs(userId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get automation logs" });
    }
  });

  app.post("/api/automation/test", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const settingsWithKey = await storage.getAutomationSettingsWithApiKey(userId);
      if (!settingsWithKey) {
        return res.status(400).json({ error: "Please configure automation settings first" });
      }
      
      if (!settingsWithKey.webhookUrl) {
        return res.status(400).json({ error: "Please enter a webhook URL before testing" });
      }
      
      if (!settingsWithKey.apiKey) {
        return res.status(400).json({ error: "Please enter an API key before testing" });
      }
      
      const testSignal: EntrySignal = {
        symbol: "TEST",
        lastPrice: 100.00,
        targetPrice: 110.00,
        stopLoss: 95.00,
      };
      
      const result = await sendEntrySignal(
        { ...settingsWithKey, isEnabled: true, autoEntryEnabled: true },
        testSignal,
        settingsWithKey.apiKey
      );
      
      const logEntry = createAutomationLogEntry(
        userId,
        "entry",
        "TEST",
        result.message,
        result
      );
      await storage.createAutomationLog(logEntry);
      
      res.json({
        success: result.success,
        message: result.message,
        error: result.error ? "Webhook request failed. Please check your URL and API key." : undefined,
      });
    } catch (error) {
      console.error("Automation test failed:", error);
      res.status(500).json({ error: "Test failed. Please check your settings and try again." });
    }
  });

  app.post("/api/automation/send-signal", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { type, symbol, lastPrice, targetPrice, stopLoss, reason } = req.body;
      
      const settingsWithKey = await storage.getAutomationSettingsWithApiKey(userId);
      if (!settingsWithKey || !settingsWithKey.isEnabled) {
        return res.status(400).json({ error: "Automation not enabled" });
      }
      
      let result;
      if (type === "entry") {
        const signal: EntrySignal = { symbol, lastPrice, targetPrice, stopLoss };
        result = await sendEntrySignal(settingsWithKey, signal, settingsWithKey.apiKey);
      } else if (type === "exit") {
        const signal: ExitSignal = { symbol, reason, targetPrice };
        result = await sendExitSignal(settingsWithKey, signal, settingsWithKey.apiKey);
      } else {
        return res.status(400).json({ error: "Invalid signal type" });
      }
      
      const logEntry = createAutomationLogEntry(userId, type, symbol, result.message, result);
      await storage.createAutomationLog(logEntry);
      
      res.json({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      console.error("Failed to send signal:", error);
      res.status(500).json({ error: "Failed to send signal" });
    }
  });

  app.get("/api/automation-profiles", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const profiles = await storage.getAutomationProfiles(userId);
      const sanitizedProfiles = profiles.map(p => ({
        ...p,
        encryptedApiKey: undefined,
        apiKeyIv: undefined,
        apiKeyAuthTag: undefined,
        hasApiKey: !!p.encryptedApiKey,
      }));
      
      res.json(sanitizedProfiles);
    } catch (error) {
      console.error("Failed to get automation profiles:", error);
      res.status(500).json({ error: "Failed to get automation profiles" });
    }
  });

  app.post("/api/automation-profiles", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { name, webhookUrl, apiKey, mode, isEnabled, guardrails } = req.body;
      
      if (!name || !webhookUrl) {
        return res.status(400).json({ error: "Name and webhook URL are required" });
      }
      
      const existingProfiles = await storage.getAutomationProfiles(userId);
      if (existingProfiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ error: "A profile with this name already exists" });
      }
      
      const profile = await storage.createAutomationProfile({
        userId,
        name,
        webhookUrl,
        mode: mode || "NOTIFY_ONLY",
        isEnabled: isEnabled ?? true,
        guardrails: guardrails || null,
      }, apiKey);
      
      res.json({
        ...profile,
        encryptedApiKey: undefined,
        apiKeyIv: undefined,
        apiKeyAuthTag: undefined,
        hasApiKey: !!apiKey,
      });
    } catch (error) {
      console.error("Failed to create automation profile:", error);
      res.status(500).json({ error: "Failed to create automation profile" });
    }
  });

  app.put("/api/automation-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { id } = req.params;
      const { name, webhookUrl, apiKey, mode, isEnabled, guardrails } = req.body;
      
      const existingProfile = await storage.getAutomationProfile(id);
      if (!existingProfile || existingProfile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      if (name) {
        const existingProfiles = await storage.getAutomationProfiles(userId);
        if (existingProfiles.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
          return res.status(400).json({ error: "A profile with this name already exists" });
        }
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
      if (mode !== undefined) updateData.mode = mode;
      if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
      if (guardrails !== undefined) updateData.guardrails = guardrails;
      
      const updated = await storage.updateAutomationProfile(id, updateData, apiKey);
      
      res.json({
        ...updated,
        encryptedApiKey: undefined,
        apiKeyIv: undefined,
        apiKeyAuthTag: undefined,
        hasApiKey: !!(updated?.encryptedApiKey || apiKey),
      });
    } catch (error) {
      console.error("Failed to update automation profile:", error);
      res.status(500).json({ error: "Failed to update automation profile" });
    }
  });

  app.delete("/api/automation-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { id } = req.params;
      
      const existingProfile = await storage.getAutomationProfile(id);
      if (!existingProfile || existingProfile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      await storage.deleteAutomationProfile(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete automation profile:", error);
      res.status(500).json({ error: "Failed to delete automation profile" });
    }
  });

  app.post("/api/automation-profiles/:id/test", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { id } = req.params;
      
      const profileWithKey = await storage.getAutomationProfileWithApiKey(id);
      if (!profileWithKey || profileWithKey.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      if (!profileWithKey.webhookUrl) {
        return res.status(400).json({ error: "Profile has no webhook URL configured" });
      }
      
      const testSignal: EntrySignal = {
        symbol: "TEST",
        lastPrice: 100.00,
        targetPrice: 110.00,
        stopLoss: 95.00,
      };
      
      const testSettings = {
        ...profileWithKey,
        id: profileWithKey.id,
        userId: profileWithKey.userId,
        isEnabled: true,
        autoEntryEnabled: true,
        autoExitEnabled: true,
        minScore: 0,
        maxPositions: 5,
        defaultPositionSize: 1000,
        createdAt: profileWithKey.createdAt,
        updatedAt: profileWithKey.updatedAt,
      };
      
      const result = await sendEntrySignal(testSettings, testSignal, profileWithKey.apiKey);
      
      await storage.updateProfileTestResult(id, result.success ? 200 : 500, result.message);
      
      res.json({
        success: result.success,
        message: result.message,
        error: result.error,
      });
    } catch (error) {
      console.error("Failed to test automation profile:", error);
      res.status(500).json({ error: "Failed to test automation profile" });
    }
  });

  app.get("/api/user-automation-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const settings = await storage.getUserAutomationSettings(userId);
      res.json(settings || { userId, globalDefaultProfileId: null });
    } catch (error) {
      console.error("Failed to get user automation settings:", error);
      res.status(500).json({ error: "Failed to get user automation settings" });
    }
  });

  app.put("/api/user-automation-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { globalDefaultProfileId } = req.body;
      
      if (globalDefaultProfileId) {
        const profile = await storage.getAutomationProfile(globalDefaultProfileId);
        if (!profile || profile.userId !== userId) {
          return res.status(400).json({ error: "Invalid profile ID" });
        }
      }
      
      const settings = await storage.setUserAutomationSettings(userId, { 
        userId,
        globalDefaultProfileId: globalDefaultProfileId || null,
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Failed to update user automation settings:", error);
      res.status(500).json({ error: "Failed to update user automation settings" });
    }
  });

  app.get("/api/automation-events", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getAutomationEvents(userId, limit);
      res.json(events);
    } catch (error) {
      console.error("Failed to get automation events:", error);
      res.status(500).json({ error: "Failed to get automation events" });
    }
  });

  app.get("/api/automation-events/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const events = await storage.getPendingAutomationEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Failed to get pending automation events:", error);
      res.status(500).json({ error: "Failed to get pending events" });
    }
  });

  app.post("/api/automation-events/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { id } = req.params;
      const events = await storage.getAutomationEvents(userId, 1000);
      const event = events.find(e => e.id === id);
      
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      if (event.action !== "QUEUED") {
        return res.status(400).json({ error: "Event is not pending approval" });
      }
      
      const profileWithKey = await storage.getAutomationProfileWithApiKey(event.profileId);
      if (!profileWithKey) {
        return res.status(400).json({ error: "Profile not found" });
      }
      
      const payload = event.payload as any;
      const testSettings = {
        ...profileWithKey,
        id: profileWithKey.id,
        userId: profileWithKey.userId,
        isEnabled: true,
        autoEntryEnabled: true,
        autoExitEnabled: true,
        minScore: 0,
        maxPositions: 5,
        defaultPositionSize: 1000,
        createdAt: profileWithKey.createdAt,
        updatedAt: profileWithKey.updatedAt,
      };
      
      const signal: EntrySignal = {
        symbol: event.symbol,
        lastPrice: payload?.lastPrice || 0,
        targetPrice: payload?.targetPrice || 0,
        stopLoss: payload?.stopLoss || 0,
      };
      
      const result = await sendEntrySignal(testSettings, signal, profileWithKey.apiKey);
      
      await storage.updateAutomationEvent(id, {
        action: result.success ? "APPROVED" : "BLOCKED",
        responseStatus: result.success ? 200 : 500,
        responseBody: result.message,
      });
      
      res.json({ success: result.success, message: result.message });
    } catch (error) {
      console.error("Failed to approve automation event:", error);
      res.status(500).json({ error: "Failed to approve event" });
    }
  });

  app.post("/api/automation-events/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { id } = req.params;
      const events = await storage.getAutomationEvents(userId, 1000);
      const event = events.find(e => e.id === id);
      
      if (!event || event.userId !== userId) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      if (event.action !== "QUEUED") {
        return res.status(400).json({ error: "Event is not pending approval" });
      }
      
      await storage.updateAutomationEvent(id, {
        action: "REJECTED",
        reason: "Manually rejected by user",
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to reject automation event:", error);
      res.status(500).json({ error: "Failed to reject event" });
    }
  });

  return httpServer;
}
