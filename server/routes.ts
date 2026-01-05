import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAlertSchema, insertWatchlistSchema, scannerFilters, UserRole } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";
import { fetchQuotesFromBroker, quotesToScanResults, DEFAULT_SCAN_SYMBOLS } from "./broker-service";

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
      const results = await storage.getScanResults();
      res.json(results);
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

      const symbols = req.body.symbols || DEFAULT_SCAN_SYMBOLS;
      const quotes = await fetchQuotesFromBroker(connection, symbols);
      const results = quotesToScanResults(quotes);
      
      res.json(results);
    } catch (error: any) {
      console.error("Live scan error:", error);
      res.status(500).json({ error: error.message || "Failed to run live scan" });
    }
  });

  app.get("/api/charts/:ticker/:timeframe?", async (req, res) => {
    try {
      const { ticker } = req.params;
      const chartData = storage.getChartData(ticker.toUpperCase());
      res.json(chartData);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chart data" });
    }
  });

  app.get("/api/alerts", async (req, res) => {
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

  app.get("/api/watchlists", isAuthenticated, isAdmin, async (req, res) => {
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
      const connection = await storage.setBrokerConnection(userId, {
        provider,
        accessToken: accessToken.trim(),
        refreshToken: secretKey?.trim() || null,
        isConnected: true,
        lastSync: new Date(),
      });
      const sanitizedConnection = {
        id: connection.id,
        userId: connection.userId,
        provider: connection.provider,
        isConnected: connection.isConnected,
        lastSync: connection.lastSync,
      };
      res.json(sanitizedConnection);
    } catch (error) {
      res.status(500).json({ error: "Failed to connect broker" });
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

  app.get("/api/backtest/latest", isAuthenticated, isAdmin, async (req, res) => {
    try {
      res.json(null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get backtest results" });
    }
  });

  app.post("/api/backtest/run", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await storage.runBacktest();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  return httpServer;
}
