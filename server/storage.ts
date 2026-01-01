import { randomUUID } from "crypto";
import type {
  User,
  InsertUser,
  Symbol,
  InsertSymbol,
  ScanResult,
  InsertScanResult,
  Alert,
  InsertAlert,
  Watchlist,
  InsertWatchlist,
  BrokerConnection,
  InsertBrokerConnection,
  PushSubscription,
  InsertPushSubscription,
  MarketStats,
  PatternStageType,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getSymbols(): Promise<Symbol[]>;
  getSymbol(ticker: string): Promise<Symbol | undefined>;
  createSymbol(symbol: InsertSymbol): Promise<Symbol>;

  getScanResults(): Promise<ScanResult[]>;
  getScanResult(ticker: string): Promise<ScanResult | undefined>;
  createScanResult(result: InsertScanResult): Promise<ScanResult>;
  clearScanResults(): Promise<void>;

  getAlerts(): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | undefined>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: string, data: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: string): Promise<void>;
  deleteAllAlerts(): Promise<void>;
  markAllAlertsRead(): Promise<void>;

  getWatchlists(): Promise<Watchlist[]>;
  getWatchlist(id: string): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  updateWatchlist(id: string, data: Partial<Watchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: string): Promise<void>;
  addSymbolToWatchlist(watchlistId: string, symbol: string): Promise<Watchlist | undefined>;
  removeSymbolFromWatchlist(watchlistId: string, symbol: string): Promise<Watchlist | undefined>;

  getBrokerConnection(): Promise<BrokerConnection | null>;
  setBrokerConnection(connection: InsertBrokerConnection): Promise<BrokerConnection>;
  clearBrokerConnection(): Promise<void>;

  getPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;

  getMarketStats(): Promise<MarketStats>;
}

function generateMockScanResults(): ScanResult[] {
  const tickers = [
    { ticker: "NVDA", name: "NVIDIA Corp" },
    { ticker: "AAPL", name: "Apple Inc" },
    { ticker: "MSFT", name: "Microsoft Corp" },
    { ticker: "GOOGL", name: "Alphabet Inc" },
    { ticker: "AMZN", name: "Amazon.com Inc" },
    { ticker: "META", name: "Meta Platforms" },
    { ticker: "TSLA", name: "Tesla Inc" },
    { ticker: "AMD", name: "Advanced Micro Devices" },
    { ticker: "CRM", name: "Salesforce Inc" },
    { ticker: "NFLX", name: "Netflix Inc" },
    { ticker: "AVGO", name: "Broadcom Inc" },
    { ticker: "COST", name: "Costco Wholesale" },
  ];

  const stages: PatternStageType[] = ["FORMING", "READY", "BREAKOUT"];

  return tickers.map((t, i) => {
    const basePrice = 100 + Math.random() * 400;
    const change = (Math.random() - 0.4) * 10;
    const stage = stages[i % 3];

    return {
      id: randomUUID(),
      scanRunId: null,
      ticker: t.ticker,
      name: t.name,
      price: Number(basePrice.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(((change / basePrice) * 100).toFixed(2)),
      volume: Math.floor(1000000 + Math.random() * 5000000),
      avgVolume: Math.floor(800000 + Math.random() * 3000000),
      rvol: Number((1 + Math.random() * 2).toFixed(2)),
      stage,
      resistance: Number((basePrice * 1.05).toFixed(2)),
      stopLoss: Number((basePrice * 0.93).toFixed(2)),
      patternScore: Math.floor(60 + Math.random() * 40),
      ema9: Number((basePrice * 0.99).toFixed(2)),
      ema21: Number((basePrice * 0.97).toFixed(2)),
      atr: Number((basePrice * 0.02).toFixed(2)),
      createdAt: new Date(),
    };
  });
}

function generateMockAlerts(): Alert[] {
  const alerts = [
    {
      ticker: "NVDA",
      type: "BREAKOUT",
      price: 512.40,
      message: "Broke resistance at $510.00 with high volume",
    },
    {
      ticker: "AMD",
      type: "APPROACHING",
      price: 178.50,
      message: "Within 2% of resistance level",
    },
    {
      ticker: "AAPL",
      type: "READY",
      price: 195.20,
      message: "VCP pattern ready for breakout",
    },
  ];

  return alerts.map((a, i) => ({
    id: randomUUID(),
    ...a,
    targetPrice: a.price * 1.1,
    stopPrice: a.price * 0.93,
    isRead: i > 0,
    triggeredAt: new Date(Date.now() - i * 3600000),
  }));
}

function generateChartData(ticker: string) {
  const candles = [];
  const now = new Date();
  let price = 100 + Math.random() * 300;

  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const volatility = 0.02;
    const change = (Math.random() - 0.5) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    candles.push({
      time: date.toISOString().split("T")[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(500000 + Math.random() * 2000000),
    });
    
    price = close;
  }

  const ema9 = calculateEMA(candles.map(c => c.close), 9);
  const ema21 = calculateEMA(candles.map(c => c.close), 21);
  const lastPrice = candles[candles.length - 1].close;

  return {
    ticker,
    name: `${ticker} Inc`,
    price: lastPrice,
    change: lastPrice - candles[candles.length - 2].close,
    changePercent: ((lastPrice - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100,
    volume: candles[candles.length - 1].volume,
    candles,
    ema9,
    ema21,
    resistance: lastPrice * 1.05,
    stopLoss: lastPrice * 0.93,
  };
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(0);
    } else if (i === period - 1) {
      const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
      ema.push(sum / period);
    } else {
      ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
  }

  return ema.map(v => Number(v.toFixed(2)));
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private symbols: Map<string, Symbol>;
  private scanResults: Map<string, ScanResult>;
  private alerts: Map<string, Alert>;
  private watchlists: Map<string, Watchlist>;
  private brokerConnection: BrokerConnection | null;
  private pushSubscriptions: Map<string, PushSubscription>;
  private chartDataCache: Map<string, ReturnType<typeof generateChartData>>;

  constructor() {
    this.users = new Map();
    this.symbols = new Map();
    this.scanResults = new Map();
    this.alerts = new Map();
    this.watchlists = new Map();
    this.brokerConnection = null;
    this.pushSubscriptions = new Map();
    this.chartDataCache = new Map();

    this.initializeMockData();
  }

  private initializeMockData() {
    const mockResults = generateMockScanResults();
    mockResults.forEach(r => this.scanResults.set(r.id, r));

    const mockAlerts = generateMockAlerts();
    mockAlerts.forEach(a => this.alerts.set(a.id, a));

    const defaultWatchlist: Watchlist = {
      id: randomUUID(),
      name: "Tech Leaders",
      symbols: ["AAPL", "MSFT", "GOOGL", "NVDA", "META"],
      createdAt: new Date(),
    };
    this.watchlists.set(defaultWatchlist.id, defaultWatchlist);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSymbols(): Promise<Symbol[]> {
    return Array.from(this.symbols.values());
  }

  async getSymbol(ticker: string): Promise<Symbol | undefined> {
    return Array.from(this.symbols.values()).find(s => s.ticker === ticker);
  }

  async createSymbol(symbol: InsertSymbol): Promise<Symbol> {
    const id = randomUUID();
    const newSymbol: Symbol = { ...symbol, id };
    this.symbols.set(id, newSymbol);
    return newSymbol;
  }

  async getScanResults(): Promise<ScanResult[]> {
    return Array.from(this.scanResults.values()).sort((a, b) => 
      (b.patternScore ?? 0) - (a.patternScore ?? 0)
    );
  }

  async getScanResult(ticker: string): Promise<ScanResult | undefined> {
    return Array.from(this.scanResults.values()).find(r => r.ticker === ticker);
  }

  async createScanResult(result: InsertScanResult): Promise<ScanResult> {
    const id = randomUUID();
    const newResult: ScanResult = { ...result, id, createdAt: new Date() };
    this.scanResults.set(id, newResult);
    return newResult;
  }

  async clearScanResults(): Promise<void> {
    this.scanResults.clear();
  }

  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).sort((a, b) => {
      const aTime = a.triggeredAt?.getTime() ?? 0;
      const bTime = b.triggeredAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  async getAlert(id: string): Promise<Alert | undefined> {
    return this.alerts.get(id);
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const newAlert: Alert = { ...alert, id, triggeredAt: new Date() };
    this.alerts.set(id, newAlert);
    return newAlert;
  }

  async updateAlert(id: string, data: Partial<Alert>): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;
    const updated = { ...alert, ...data };
    this.alerts.set(id, updated);
    return updated;
  }

  async deleteAlert(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  async deleteAllAlerts(): Promise<void> {
    this.alerts.clear();
  }

  async markAllAlertsRead(): Promise<void> {
    this.alerts.forEach((alert, id) => {
      this.alerts.set(id, { ...alert, isRead: true });
    });
  }

  async getWatchlists(): Promise<Watchlist[]> {
    return Array.from(this.watchlists.values());
  }

  async getWatchlist(id: string): Promise<Watchlist | undefined> {
    return this.watchlists.get(id);
  }

  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const id = randomUUID();
    const newWatchlist: Watchlist = { ...watchlist, id, createdAt: new Date() };
    this.watchlists.set(id, newWatchlist);
    return newWatchlist;
  }

  async updateWatchlist(id: string, data: Partial<Watchlist>): Promise<Watchlist | undefined> {
    const watchlist = this.watchlists.get(id);
    if (!watchlist) return undefined;
    const updated = { ...watchlist, ...data };
    this.watchlists.set(id, updated);
    return updated;
  }

  async deleteWatchlist(id: string): Promise<void> {
    this.watchlists.delete(id);
  }

  async addSymbolToWatchlist(watchlistId: string, symbol: string): Promise<Watchlist | undefined> {
    const watchlist = this.watchlists.get(watchlistId);
    if (!watchlist) return undefined;
    const symbols = watchlist.symbols || [];
    if (!symbols.includes(symbol)) {
      symbols.push(symbol);
    }
    const updated = { ...watchlist, symbols };
    this.watchlists.set(watchlistId, updated);
    return updated;
  }

  async removeSymbolFromWatchlist(watchlistId: string, symbol: string): Promise<Watchlist | undefined> {
    const watchlist = this.watchlists.get(watchlistId);
    if (!watchlist) return undefined;
    const symbols = (watchlist.symbols || []).filter(s => s !== symbol);
    const updated = { ...watchlist, symbols };
    this.watchlists.set(watchlistId, updated);
    return updated;
  }

  async getBrokerConnection(): Promise<BrokerConnection | null> {
    return this.brokerConnection;
  }

  async setBrokerConnection(connection: InsertBrokerConnection): Promise<BrokerConnection> {
    const id = randomUUID();
    this.brokerConnection = { ...connection, id };
    return this.brokerConnection;
  }

  async clearBrokerConnection(): Promise<void> {
    this.brokerConnection = null;
  }

  async getPushSubscriptions(): Promise<PushSubscription[]> {
    return Array.from(this.pushSubscriptions.values());
  }

  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const id = randomUUID();
    const newSubscription: PushSubscription = { ...subscription, id, createdAt: new Date() };
    this.pushSubscriptions.set(id, newSubscription);
    return newSubscription;
  }

  async getMarketStats(): Promise<MarketStats> {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    
    let marketStatus: "open" | "closed" | "pre" | "after" = "closed";
    if (day >= 1 && day <= 5) {
      if (hour >= 13 && hour < 20) {
        marketStatus = "open";
      } else if (hour >= 9 && hour < 13) {
        marketStatus = "pre";
      } else if (hour >= 20 && hour < 24) {
        marketStatus = "after";
      }
    }

    return {
      advancers: 1847,
      decliners: 1523,
      unchanged: 312,
      totalVolume: 4230000000,
      marketStatus,
    };
  }

  getChartData(ticker: string): ReturnType<typeof generateChartData> {
    if (!this.chartDataCache.has(ticker)) {
      this.chartDataCache.set(ticker, generateChartData(ticker));
    }
    return this.chartDataCache.get(ticker)!;
  }

  async runScan(): Promise<ScanResult[]> {
    this.scanResults.clear();
    const newResults = generateMockScanResults();
    newResults.forEach(r => this.scanResults.set(r.id, r));
    return newResults;
  }

  async getWatchlistResults(watchlistId: string): Promise<ScanResult[]> {
    const watchlist = this.watchlists.get(watchlistId);
    if (!watchlist || !watchlist.symbols) return [];

    const results: ScanResult[] = [];
    for (const symbol of watchlist.symbols) {
      const chartData = this.getChartData(symbol as string);
      results.push({
        id: randomUUID(),
        scanRunId: null,
        ticker: symbol as string,
        name: chartData.name,
        price: chartData.price,
        change: chartData.change,
        changePercent: chartData.changePercent,
        volume: chartData.volume,
        avgVolume: chartData.volume * 0.8,
        rvol: 1.2,
        stage: "FORMING",
        resistance: chartData.resistance,
        stopLoss: chartData.stopLoss,
        patternScore: Math.floor(60 + Math.random() * 30),
        ema9: chartData.ema9[chartData.ema9.length - 1],
        ema21: chartData.ema21[chartData.ema21.length - 1],
        atr: chartData.price * 0.02,
        createdAt: new Date(),
      });
    }
    return results;
  }

  async runBacktest(): Promise<{
    id: string;
    totalTrades: number;
    winRate: number;
    avgReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalReturn: number;
    trades: Array<{
      ticker: string;
      entryDate: string;
      exitDate: string;
      entryPrice: number;
      exitPrice: number;
      returnPercent: number;
      exitReason: string;
    }>;
  }> {
    const tickers = ["NVDA", "AAPL", "MSFT", "AMD", "GOOGL", "META"];
    const trades = tickers.map(ticker => {
      const entryPrice = 100 + Math.random() * 200;
      const returnPct = (Math.random() - 0.35) * 20;
      const exitPrice = entryPrice * (1 + returnPct / 100);
      return {
        ticker,
        entryDate: "2024-03-15",
        exitDate: "2024-04-02",
        entryPrice: Number(entryPrice.toFixed(2)),
        exitPrice: Number(exitPrice.toFixed(2)),
        returnPercent: Number(returnPct.toFixed(2)),
        exitReason: returnPct > 0 ? "Target" : "Stop",
      };
    });

    const wins = trades.filter(t => t.returnPercent > 0).length;
    const avgReturn = trades.reduce((sum, t) => sum + t.returnPercent, 0) / trades.length;

    return {
      id: randomUUID(),
      totalTrades: trades.length,
      winRate: (wins / trades.length) * 100,
      avgReturn,
      maxDrawdown: 12.5,
      sharpeRatio: 1.85,
      totalReturn: trades.reduce((sum, t) => sum + t.returnPercent, 0),
      trades,
    };
  }
}

export const storage = new MemStorage();
