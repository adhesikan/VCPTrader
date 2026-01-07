import { randomUUID } from "crypto";
import { encryptCredentials, decryptCredentials, hasEncryptionKey, encryptToken, decryptToken } from "./crypto";
import { db } from "./db";
import { brokerConnections, watchlists as watchlistsTable, opportunityDefaults as opportunityDefaultsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type {
  User,
  InsertUser,
  Symbol,
  InsertSymbol,
  ScanResult,
  InsertScanResult,
  Alert,
  InsertAlert,
  AlertRule,
  InsertAlertRule,
  AlertEvent,
  InsertAlertEvent,
  Watchlist,
  InsertWatchlist,
  BrokerConnection,
  InsertBrokerConnection,
  PushSubscription,
  InsertPushSubscription,
  MarketStats,
  PatternStageType,
  BacktestResult,
  InsertBacktestResult,
  AutomationSettings,
  InsertAutomationSettings,
  AutomationLog,
  InsertAutomationLog,
  AutomationProfile,
  InsertAutomationProfile,
  UserAutomationSettings,
  InsertUserAutomationSettings,
  AutomationEvent,
  InsertAutomationEvent,
  OpportunityDefaults,
  InsertOpportunityDefaults,
} from "@shared/schema";

const ALERT_DISCLAIMER = "This alert is informational only and not investment advice.";

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

  getWatchlists(userId: string): Promise<Watchlist[]>;
  getWatchlist(id: string, userId: string): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  updateWatchlist(id: string, userId: string, data: Partial<Watchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: string, userId: string): Promise<void>;
  addSymbolToWatchlist(watchlistId: string, userId: string, symbol: string): Promise<Watchlist | undefined>;
  removeSymbolFromWatchlist(watchlistId: string, userId: string, symbol: string): Promise<Watchlist | undefined>;

  getBrokerConnection(userId: string): Promise<BrokerConnection | null>;
  getBrokerConnectionWithToken(userId: string): Promise<(BrokerConnection & { accessToken?: string; refreshToken?: string }) | null>;
  setBrokerConnection(userId: string, connection: Omit<InsertBrokerConnection, 'userId'>): Promise<BrokerConnection>;
  setBrokerConnectionWithTokens(userId: string, provider: string, accessToken: string, refreshToken?: string, expiresAt?: Date): Promise<BrokerConnection>;
  updateBrokerConnectionStatus(userId: string, isConnected: boolean): Promise<void>;
  clearBrokerConnection(userId: string): Promise<void>;

  getPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;

  getMarketStats(): Promise<MarketStats>;

  getBacktestResults(userId: string): Promise<BacktestResult[]>;
  getBacktestResult(id: string): Promise<BacktestResult | undefined>;
  createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;
  deleteBacktestResult(id: string): Promise<void>;

  getAlertRules(userId?: string): Promise<AlertRule[]>;
  getAlertRule(id: string): Promise<AlertRule | undefined>;
  getEnabledAlertRules(): Promise<AlertRule[]>;
  createAlertRule(rule: InsertAlertRule): Promise<AlertRule>;
  updateAlertRule(id: string, data: Partial<AlertRule>): Promise<AlertRule | undefined>;
  deleteAlertRule(id: string): Promise<void>;

  getAlertEvents(userId?: string, ruleId?: string): Promise<AlertEvent[]>;
  getAlertEvent(id: string): Promise<AlertEvent | undefined>;
  getAlertEventByKey(eventKey: string): Promise<AlertEvent | undefined>;
  createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent>;
  updateAlertEvent(id: string, data: Partial<AlertEvent>): Promise<AlertEvent | undefined>;
  markAlertEventRead(id: string): Promise<AlertEvent | undefined>;
  markAllAlertEventsRead(userId: string): Promise<void>;

  getAutomationSettings(userId: string): Promise<AutomationSettings | null>;
  getAutomationSettingsWithApiKey(userId: string): Promise<(AutomationSettings & { apiKey?: string }) | null>;
  setAutomationSettings(userId: string, settings: Partial<InsertAutomationSettings>): Promise<AutomationSettings>;
  setAutomationSettingsWithApiKey(userId: string, settings: Partial<InsertAutomationSettings>, apiKey?: string): Promise<AutomationSettings>;
  getAutomationLogs(userId: string, limit?: number): Promise<AutomationLog[]>;
  createAutomationLog(log: InsertAutomationLog): Promise<AutomationLog>;

  getAutomationProfiles(userId: string): Promise<AutomationProfile[]>;
  getAutomationProfile(id: string): Promise<AutomationProfile | null>;
  getAutomationProfileWithApiKey(id: string): Promise<(AutomationProfile & { apiKey?: string }) | null>;
  createAutomationProfile(profile: InsertAutomationProfile, apiKey?: string): Promise<AutomationProfile>;
  updateAutomationProfile(id: string, profile: Partial<InsertAutomationProfile>, apiKey?: string): Promise<AutomationProfile | null>;
  deleteAutomationProfile(id: string): Promise<void>;
  updateProfileTestResult(id: string, status: number, response: string): Promise<void>;

  getUserAutomationSettings(userId: string): Promise<UserAutomationSettings | null>;
  setUserAutomationSettings(userId: string, settings: Partial<InsertUserAutomationSettings>): Promise<UserAutomationSettings>;

  getAutomationEvents(userId: string, limit?: number): Promise<AutomationEvent[]>;
  getAutomationEventsByProfile(profileId: string, limit?: number): Promise<AutomationEvent[]>;
  getPendingAutomationEvents(userId: string): Promise<AutomationEvent[]>;
  getAutomationEventByIdempotencyKey(key: string): Promise<AutomationEvent | null>;
  createAutomationEvent(event: InsertAutomationEvent): Promise<AutomationEvent>;
  updateAutomationEvent(id: string, data: Partial<AutomationEvent>): Promise<AutomationEvent | null>;
  countTodayAutomationEventsByProfile(profileId: string): Promise<number>;
  getLastSentEventForSymbol(profileId: string, symbol: string): Promise<AutomationEvent | null>;

  getOpportunityDefaults(userId: string): Promise<OpportunityDefaults | null>;
  setOpportunityDefaults(userId: string, defaults: Partial<InsertOpportunityDefaults>): Promise<OpportunityDefaults>;
  deleteOpportunityDefaults(userId: string): Promise<void>;
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

function calculateATR(candles: Array<{ high: number; low: number; close: number }>, period: number = 14): number[] {
  const atr: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
    } else {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      trueRanges.push(tr);
    }

    if (i < period - 1) {
      atr.push(0);
    } else if (i === period - 1) {
      const sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    } else {
      atr.push((atr[i - 1] * (period - 1) + trueRanges[i]) / period);
    }
  }

  return atr.map(v => Number(v.toFixed(2)));
}

function findPivotPoints(candles: Array<{ time: string; high: number; low: number }>, lookback: number = 5) {
  const pivotHighs: Array<{ time: string; price: number; type: "pivot_high" }> = [];
  const pivotLows: Array<{ time: string; price: number; type: "pivot_low" }> = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isLow = false;
      }
    }

    if (isHigh) {
      pivotHighs.push({ time: candles[i].time, price: candles[i].high, type: "pivot_high" });
    }
    if (isLow) {
      pivotLows.push({ time: candles[i].time, price: candles[i].low, type: "pivot_low" });
    }
  }

  return { pivotHighs, pivotLows };
}

function generateContractionZones(candles: Array<{ time: string; high: number; low: number }>) {
  const zones: Array<{ start: string; end: string; highLevel: number; lowLevel: number }> = [];
  const windowSize = 15;

  for (let i = 30; i < candles.length - windowSize; i += windowSize) {
    const window = candles.slice(i, i + windowSize);
    const highLevel = Math.max(...window.map(c => c.high));
    const lowLevel = Math.min(...window.map(c => c.low));
    const range = highLevel - lowLevel;
    
    const prevWindow = candles.slice(i - windowSize, i);
    const prevRange = Math.max(...prevWindow.map(c => c.high)) - Math.min(...prevWindow.map(c => c.low));

    if (range < prevRange * 0.8) {
      zones.push({
        start: window[0].time,
        end: window[window.length - 1].time,
        highLevel,
        lowLevel,
      });
    }
  }

  return zones;
}

function generateChartData(ticker: string) {
  const candles = [];
  const now = new Date();
  let price = 100 + Math.random() * 300;
  const baseVolume = 800000 + Math.random() * 1500000;

  for (let i = 120; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const volatilityBase = 0.018;
    const volatilityMod = i > 60 ? 1.2 : (i > 30 ? 0.9 : 0.7);
    const volatility = volatilityBase * volatilityMod;
    
    const trendBias = 0.001;
    const change = (Math.random() - 0.48 + trendBias) * volatility * price;
    const open = price;
    const close = price + change;
    const range = Math.abs(change) * (1 + Math.random() * 0.5);
    const high = Math.max(open, close) + range * Math.random();
    const low = Math.min(open, close) - range * Math.random();
    
    const volumeMultiplier = 0.8 + Math.random() * 0.6;
    const volume = Math.floor(baseVolume * volumeMultiplier);
    
    candles.push({
      time: date.toISOString().split("T")[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
    
    price = close;
  }

  const closes = candles.map(c => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const atrValues = calculateATR(candles);
  const lastPrice = candles[candles.length - 1].close;
  const prevPrice = candles[candles.length - 2].close;
  const lastVolume = candles[candles.length - 1].volume;
  const avgVolume = Math.floor(candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20);
  const lastATR = atrValues[atrValues.length - 1];

  const { pivotHighs, pivotLows } = findPivotPoints(candles);
  const contractionZones = generateContractionZones(candles);

  const vcpAnnotations: Array<{ time: string; price: number; type: "pivot_high" | "pivot_low" | "contraction_start" | "breakout"; label?: string }> = [];
  
  pivotHighs.slice(-3).forEach((ph, i) => {
    vcpAnnotations.push({ ...ph, label: `H${i + 1}` });
  });
  pivotLows.slice(-3).forEach((pl, i) => {
    vcpAnnotations.push({ ...pl, label: `L${i + 1}` });
  });

  const resistance = pivotHighs.length > 0 
    ? Math.max(...pivotHighs.slice(-3).map(p => p.price))
    : lastPrice * 1.05;
  const stopLoss = pivotLows.length > 0 
    ? Math.min(...pivotLows.slice(-2).map(p => p.price))
    : lastPrice * 0.93;

  const stages = ["FORMING", "READY", "BREAKOUT"];
  const stage = stages[Math.floor(Math.random() * 3)];
  const patternScore = Math.floor(65 + Math.random() * 35);

  return {
    ticker,
    name: `${ticker} Inc`,
    price: Number(lastPrice.toFixed(2)),
    change: Number((lastPrice - prevPrice).toFixed(2)),
    changePercent: Number(((lastPrice - prevPrice) / prevPrice * 100).toFixed(2)),
    volume: lastVolume,
    avgVolume,
    rvol: Number((lastVolume / avgVolume).toFixed(2)),
    atr: lastATR,
    patternScore,
    stage,
    candles,
    ema9,
    ema21,
    ema50,
    resistance: Number(resistance.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    contractionZones,
    vcpAnnotations,
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
  private pushSubscriptions: Map<string, PushSubscription>;
  private chartDataCache: Map<string, ReturnType<typeof generateChartData>>;

  constructor() {
    this.users = new Map();
    this.symbols = new Map();
    this.scanResults = new Map();
    this.alerts = new Map();
    this.watchlists = new Map();
    this.pushSubscriptions = new Map();
    this.chartDataCache = new Map();

    this.initializeMockData();
  }

  private initializeMockData() {
    // No longer initialize mock scan results or alerts
    // Data comes from live broker connections only

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
    const messageWithDisclaimer = alert.message 
      ? `${alert.message} ${ALERT_DISCLAIMER}`
      : ALERT_DISCLAIMER;
    const newAlert: Alert = { 
      ...alert, 
      id, 
      message: messageWithDisclaimer,
      triggeredAt: new Date() 
    };
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

  async getWatchlists(userId: string): Promise<Watchlist[]> {
    return db
      .select()
      .from(watchlistsTable)
      .where(eq(watchlistsTable.userId, userId));
  }

  async getWatchlist(id: string, userId: string): Promise<Watchlist | undefined> {
    const [watchlist] = await db
      .select()
      .from(watchlistsTable)
      .where(and(eq(watchlistsTable.id, id), eq(watchlistsTable.userId, userId)))
      .limit(1);
    return watchlist;
  }

  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const [created] = await db
      .insert(watchlistsTable)
      .values(watchlist)
      .returning();
    return created;
  }

  async updateWatchlist(id: string, userId: string, data: Partial<Watchlist>): Promise<Watchlist | undefined> {
    const [updated] = await db
      .update(watchlistsTable)
      .set(data)
      .where(and(eq(watchlistsTable.id, id), eq(watchlistsTable.userId, userId)))
      .returning();
    return updated;
  }

  async deleteWatchlist(id: string, userId: string): Promise<void> {
    await db
      .delete(watchlistsTable)
      .where(and(eq(watchlistsTable.id, id), eq(watchlistsTable.userId, userId)));
  }

  async addSymbolToWatchlist(watchlistId: string, userId: string, symbol: string): Promise<Watchlist | undefined> {
    const watchlist = await this.getWatchlist(watchlistId, userId);
    if (!watchlist) return undefined;
    const symbols = watchlist.symbols || [];
    if (!symbols.includes(symbol)) {
      symbols.push(symbol);
    }
    return this.updateWatchlist(watchlistId, userId, { symbols });
  }

  async removeSymbolFromWatchlist(watchlistId: string, userId: string, symbol: string): Promise<Watchlist | undefined> {
    const watchlist = await this.getWatchlist(watchlistId, userId);
    if (!watchlist) return undefined;
    const symbols = (watchlist.symbols || []).filter(s => s !== symbol);
    return this.updateWatchlist(watchlistId, userId, { symbols });
  }

  async getBrokerConnection(userId: string): Promise<BrokerConnection | null> {
    const [connection] = await db
      .select()
      .from(brokerConnections)
      .where(eq(brokerConnections.userId, userId))
      .limit(1);
    return connection || null;
  }

  async getBrokerConnectionWithToken(userId: string): Promise<(BrokerConnection & { accessToken?: string; refreshToken?: string }) | null> {
    const connection = await this.getBrokerConnection(userId);
    if (!connection) return null;
    
    if (connection.encryptedCredentials && connection.credentialsIv && connection.credentialsAuthTag) {
      try {
        const credentials = decryptCredentials({
          ciphertext: connection.encryptedCredentials,
          iv: connection.credentialsIv,
          authTag: connection.credentialsAuthTag,
        });
        return {
          ...connection,
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
        };
      } catch (error) {
        console.error("Failed to decrypt broker credentials:", error);
        return connection;
      }
    }
    
    return connection;
  }

  async setBrokerConnection(userId: string, connection: Omit<InsertBrokerConnection, 'userId'>): Promise<BrokerConnection> {
    if (connection.encryptedCredentials && !connection.credentialsIv) {
      throw new Error("Invalid broker connection: credentials appear to be unencrypted. Use setBrokerConnectionWithTokens() to store tokens securely.");
    }
    
    const existing = await this.getBrokerConnection(userId);
    const now = new Date();
    
    if (existing) {
      const [updated] = await db
        .update(brokerConnections)
        .set({
          provider: connection.provider,
          encryptedCredentials: connection.encryptedCredentials ?? null,
          credentialsIv: connection.credentialsIv ?? null,
          credentialsAuthTag: connection.credentialsAuthTag ?? null,
          accessTokenExpiresAt: connection.accessTokenExpiresAt ?? null,
          isConnected: connection.isConnected ?? null,
          lastSync: connection.lastSync ?? null,
          permissions: connection.permissions ?? null,
          updatedAt: now,
        })
        .where(eq(brokerConnections.userId, userId))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(brokerConnections)
      .values({
        userId,
        provider: connection.provider,
        encryptedCredentials: connection.encryptedCredentials ?? null,
        credentialsIv: connection.credentialsIv ?? null,
        credentialsAuthTag: connection.credentialsAuthTag ?? null,
        accessTokenExpiresAt: connection.accessTokenExpiresAt ?? null,
        isConnected: connection.isConnected ?? null,
        lastSync: connection.lastSync ?? null,
        permissions: connection.permissions ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }

  async setBrokerConnectionWithTokens(
    userId: string, 
    provider: string, 
    accessToken: string, 
    refreshToken?: string, 
    expiresAt?: Date
  ): Promise<BrokerConnection> {
    if (!hasEncryptionKey()) {
      throw new Error("Encryption key not configured. Cannot store broker credentials securely.");
    }

    const encrypted = encryptCredentials({
      accessToken,
      refreshToken,
      expiresAt: expiresAt?.toISOString(),
    });

    return this.setBrokerConnection(userId, {
      provider,
      encryptedCredentials: encrypted.ciphertext,
      credentialsIv: encrypted.iv,
      credentialsAuthTag: encrypted.authTag,
      accessTokenExpiresAt: expiresAt ?? null,
      isConnected: true,
      lastSync: new Date(),
    });
  }

  async updateBrokerConnectionStatus(userId: string, isConnected: boolean): Promise<void> {
    const now = new Date();
    await db
      .update(brokerConnections)
      .set({
        isConnected,
        lastSync: isConnected ? now : undefined,
        updatedAt: now,
      })
      .where(eq(brokerConnections.userId, userId));
  }

  async clearBrokerConnection(userId: string): Promise<void> {
    await db
      .delete(brokerConnections)
      .where(eq(brokerConnections.userId, userId));
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

  private backtestResults: Map<string, BacktestResult> = new Map();

  async getBacktestResults(userId: string): Promise<BacktestResult[]> {
    return Array.from(this.backtestResults.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getBacktestResult(id: string): Promise<BacktestResult | undefined> {
    return this.backtestResults.get(id);
  }

  async createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    const newResult: BacktestResult = {
      ...result,
      id: randomUUID(),
      createdAt: new Date(),
      sharpeRatio: result.sharpeRatio ?? null,
      trades: result.trades ?? null,
    };
    this.backtestResults.set(newResult.id, newResult);
    return newResult;
  }

  async deleteBacktestResult(id: string): Promise<void> {
    this.backtestResults.delete(id);
  }

  private alertRules: Map<string, AlertRule> = new Map();
  private alertEvents: Map<string, AlertEvent> = new Map();

  async getAlertRules(userId?: string): Promise<AlertRule[]> {
    const rules = Array.from(this.alertRules.values());
    if (userId) {
      return rules.filter(r => r.userId === userId).sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }
    return rules.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getAlertRule(id: string): Promise<AlertRule | undefined> {
    return this.alertRules.get(id);
  }

  async getEnabledAlertRules(): Promise<AlertRule[]> {
    return Array.from(this.alertRules.values()).filter(r => r.isEnabled);
  }

  async createAlertRule(rule: InsertAlertRule): Promise<AlertRule> {
    const now = new Date();
    const newRule: AlertRule = {
      ...rule,
      id: randomUUID(),
      strategy: rule.strategy || "VCP",
      timeframe: rule.timeframe || "1d",
      isEnabled: rule.isEnabled ?? true,
      conditionPayload: rule.conditionPayload ?? null,
      createdAt: now,
      updatedAt: now,
      lastEvaluatedAt: null,
      lastState: null,
    };
    this.alertRules.set(newRule.id, newRule);
    return newRule;
  }

  async updateAlertRule(id: string, data: Partial<AlertRule>): Promise<AlertRule | undefined> {
    const rule = this.alertRules.get(id);
    if (!rule) return undefined;
    const updated = { ...rule, ...data, updatedAt: new Date() };
    this.alertRules.set(id, updated);
    return updated;
  }

  async deleteAlertRule(id: string): Promise<void> {
    this.alertRules.delete(id);
  }

  async getAlertEvents(userId?: string, ruleId?: string): Promise<AlertEvent[]> {
    let events = Array.from(this.alertEvents.values());
    if (userId) {
      events = events.filter(e => e.userId === userId);
    }
    if (ruleId) {
      events = events.filter(e => e.ruleId === ruleId);
    }
    return events.sort((a, b) => 
      new Date(b.triggeredAt || 0).getTime() - new Date(a.triggeredAt || 0).getTime()
    );
  }

  async getAlertEvent(id: string): Promise<AlertEvent | undefined> {
    return this.alertEvents.get(id);
  }

  async getAlertEventByKey(eventKey: string): Promise<AlertEvent | undefined> {
    return Array.from(this.alertEvents.values()).find(e => e.eventKey === eventKey);
  }

  async createAlertEvent(event: InsertAlertEvent): Promise<AlertEvent> {
    const newEvent: AlertEvent = {
      ...event,
      id: randomUUID(),
      triggeredAt: new Date(),
      fromState: event.fromState ?? null,
      price: event.price ?? null,
      payload: event.payload ?? null,
      deliveryStatus: event.deliveryStatus ?? null,
      isRead: event.isRead ?? false,
    };
    this.alertEvents.set(newEvent.id, newEvent);
    return newEvent;
  }

  async updateAlertEvent(id: string, data: Partial<AlertEvent>): Promise<AlertEvent | undefined> {
    const event = this.alertEvents.get(id);
    if (!event) return undefined;
    const updated = { ...event, ...data };
    this.alertEvents.set(id, updated);
    return updated;
  }

  async markAlertEventRead(id: string): Promise<AlertEvent | undefined> {
    return this.updateAlertEvent(id, { isRead: true });
  }

  async markAllAlertEventsRead(userId: string): Promise<void> {
    this.alertEvents.forEach((event, id) => {
      if (event.userId === userId) {
        this.alertEvents.set(id, { ...event, isRead: true });
      }
    });
  }

  private automationSettings = new Map<string, AutomationSettings>();
  private automationLogs = new Map<string, AutomationLog>();

  async getAutomationSettings(userId: string): Promise<AutomationSettings | null> {
    return this.automationSettings.get(userId) || null;
  }

  async getAutomationSettingsWithApiKey(userId: string): Promise<(AutomationSettings & { apiKey?: string }) | null> {
    const settings = this.automationSettings.get(userId);
    if (!settings) return null;

    if (settings.encryptedApiKey && settings.apiKeyIv && settings.apiKeyAuthTag && hasEncryptionKey()) {
      try {
        const decrypted = decryptToken({
          ciphertext: settings.encryptedApiKey,
          iv: settings.apiKeyIv,
          authTag: settings.apiKeyAuthTag,
        });
        const parsed = JSON.parse(decrypted);
        return { ...settings, apiKey: parsed.apiKey };
      } catch (error) {
        console.error("[Storage] Failed to decrypt API key:", error);
      }
    }
    return settings;
  }

  async setAutomationSettings(userId: string, settings: Partial<InsertAutomationSettings>): Promise<AutomationSettings> {
    if (settings.encryptedApiKey && !settings.apiKeyIv) {
      throw new Error("Invalid automation settings: API key appears to be unencrypted. Use setAutomationSettingsWithApiKey() to store API key securely.");
    }

    const existing = this.automationSettings.get(userId);
    const now = new Date();

    if (existing) {
      const updated: AutomationSettings = {
        ...existing,
        ...settings,
        updatedAt: now,
      };
      this.automationSettings.set(userId, updated);
      return updated;
    }

    const newSettings: AutomationSettings = {
      id: randomUUID(),
      userId,
      isEnabled: settings.isEnabled ?? false,
      webhookUrl: settings.webhookUrl ?? null,
      encryptedApiKey: settings.encryptedApiKey ?? null,
      apiKeyIv: settings.apiKeyIv ?? null,
      apiKeyAuthTag: settings.apiKeyAuthTag ?? null,
      autoEntryEnabled: settings.autoEntryEnabled ?? true,
      autoExitEnabled: settings.autoExitEnabled ?? true,
      minScore: settings.minScore ?? 70,
      maxPositions: settings.maxPositions ?? 5,
      defaultPositionSize: settings.defaultPositionSize ?? 1000,
      createdAt: now,
      updatedAt: now,
    };
    this.automationSettings.set(userId, newSettings);
    return newSettings;
  }

  async setAutomationSettingsWithApiKey(
    userId: string,
    settings: Partial<InsertAutomationSettings>,
    apiKey?: string
  ): Promise<AutomationSettings> {
    let encryptedData: { encryptedApiKey?: string; apiKeyIv?: string; apiKeyAuthTag?: string } = {};

    if (apiKey && hasEncryptionKey()) {
      const encrypted = encryptToken(JSON.stringify({ apiKey }));
      encryptedData = {
        encryptedApiKey: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
      };
    }

    return this.setAutomationSettings(userId, {
      ...settings,
      ...encryptedData,
    });
  }

  async getAutomationLogs(userId: string, limit: number = 50): Promise<AutomationLog[]> {
    const logs = Array.from(this.automationLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return logs.slice(0, limit);
  }

  async createAutomationLog(log: InsertAutomationLog): Promise<AutomationLog> {
    const newLog: AutomationLog = {
      ...log,
      id: randomUUID(),
      webhookResponse: log.webhookResponse ?? null,
      success: log.success ?? false,
      createdAt: new Date(),
    };
    this.automationLogs.set(newLog.id, newLog);
    return newLog;
  }

  private automationProfilesMap = new Map<string, AutomationProfile>();
  private userAutomationSettingsMap = new Map<string, UserAutomationSettings>();
  private automationEventsMap = new Map<string, AutomationEvent>();

  async getAutomationProfiles(userId: string): Promise<AutomationProfile[]> {
    return Array.from(this.automationProfilesMap.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getAutomationProfile(id: string): Promise<AutomationProfile | null> {
    return this.automationProfilesMap.get(id) || null;
  }

  async getAutomationProfileWithApiKey(id: string): Promise<(AutomationProfile & { apiKey?: string }) | null> {
    const profile = this.automationProfilesMap.get(id);
    if (!profile) return null;

    if (profile.encryptedApiKey && profile.apiKeyIv && profile.apiKeyAuthTag && hasEncryptionKey()) {
      try {
        const decrypted = decryptToken({
          ciphertext: profile.encryptedApiKey,
          iv: profile.apiKeyIv,
          authTag: profile.apiKeyAuthTag,
        });
        const parsed = JSON.parse(decrypted);
        return { ...profile, apiKey: parsed.apiKey };
      } catch (e) {
        console.error("Failed to decrypt profile API key:", e);
      }
    }
    return profile;
  }

  async createAutomationProfile(profile: InsertAutomationProfile, apiKey?: string): Promise<AutomationProfile> {
    let encryptedData: { encryptedApiKey?: string; apiKeyIv?: string; apiKeyAuthTag?: string } = {};

    if (apiKey && hasEncryptionKey()) {
      const encrypted = encryptToken(JSON.stringify({ apiKey }));
      encryptedData = {
        encryptedApiKey: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
      };
    }

    const now = new Date();
    const newProfile: AutomationProfile = {
      id: randomUUID(),
      userId: profile.userId,
      name: profile.name,
      webhookUrl: profile.webhookUrl,
      encryptedApiKey: encryptedData.encryptedApiKey ?? null,
      apiKeyIv: encryptedData.apiKeyIv ?? null,
      apiKeyAuthTag: encryptedData.apiKeyAuthTag ?? null,
      isEnabled: profile.isEnabled ?? true,
      mode: profile.mode ?? "NOTIFY_ONLY",
      guardrails: profile.guardrails ?? null,
      lastTestStatus: null,
      lastTestAt: null,
      lastTestResponse: null,
      createdAt: now,
      updatedAt: now,
    };
    this.automationProfilesMap.set(newProfile.id, newProfile);
    return newProfile;
  }

  async updateAutomationProfile(id: string, profile: Partial<InsertAutomationProfile>, apiKey?: string): Promise<AutomationProfile | null> {
    const existing = this.automationProfilesMap.get(id);
    if (!existing) return null;

    let encryptedData: { encryptedApiKey?: string; apiKeyIv?: string; apiKeyAuthTag?: string } = {};

    if (apiKey !== undefined && hasEncryptionKey()) {
      if (apiKey) {
        const encrypted = encryptToken(JSON.stringify({ apiKey }));
        encryptedData = {
          encryptedApiKey: encrypted.ciphertext,
          apiKeyIv: encrypted.iv,
          apiKeyAuthTag: encrypted.authTag,
        };
      } else {
        encryptedData = {
          encryptedApiKey: undefined,
          apiKeyIv: undefined,
          apiKeyAuthTag: undefined,
        };
      }
    }

    const updated: AutomationProfile = {
      ...existing,
      ...profile,
      ...encryptedData,
      updatedAt: new Date(),
    };
    this.automationProfilesMap.set(id, updated);
    return updated;
  }

  async deleteAutomationProfile(id: string): Promise<void> {
    this.automationProfilesMap.delete(id);
  }

  async updateProfileTestResult(id: string, status: number, response: string): Promise<void> {
    const profile = this.automationProfilesMap.get(id);
    if (profile) {
      profile.lastTestStatus = status;
      profile.lastTestAt = new Date();
      profile.lastTestResponse = response.substring(0, 500);
      this.automationProfilesMap.set(id, profile);
    }
  }

  async getUserAutomationSettings(userId: string): Promise<UserAutomationSettings | null> {
    return this.userAutomationSettingsMap.get(userId) || null;
  }

  async setUserAutomationSettings(userId: string, settings: Partial<InsertUserAutomationSettings>): Promise<UserAutomationSettings> {
    const existing = this.userAutomationSettingsMap.get(userId);
    const now = new Date();

    if (existing) {
      const updated: UserAutomationSettings = {
        ...existing,
        ...settings,
        updatedAt: now,
      };
      this.userAutomationSettingsMap.set(userId, updated);
      return updated;
    }

    const newSettings: UserAutomationSettings = {
      userId,
      globalDefaultProfileId: settings.globalDefaultProfileId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.userAutomationSettingsMap.set(userId, newSettings);
    return newSettings;
  }

  async getAutomationEvents(userId: string, limit: number = 50): Promise<AutomationEvent[]> {
    return Array.from(this.automationEventsMap.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);
  }

  async getAutomationEventsByProfile(profileId: string, limit: number = 50): Promise<AutomationEvent[]> {
    return Array.from(this.automationEventsMap.values())
      .filter(e => e.profileId === profileId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);
  }

  async getPendingAutomationEvents(userId: string): Promise<AutomationEvent[]> {
    return Array.from(this.automationEventsMap.values())
      .filter(e => e.userId === userId && e.action === "QUEUED")
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getAutomationEventByIdempotencyKey(key: string): Promise<AutomationEvent | null> {
    return Array.from(this.automationEventsMap.values()).find(e => e.idempotencyKey === key) || null;
  }

  async createAutomationEvent(event: InsertAutomationEvent): Promise<AutomationEvent> {
    const newEvent: AutomationEvent = {
      ...event,
      id: randomUUID(),
      reason: event.reason ?? null,
      payload: event.payload ?? null,
      responseStatus: event.responseStatus ?? null,
      responseBody: event.responseBody ?? null,
      createdAt: new Date(),
    };
    this.automationEventsMap.set(newEvent.id, newEvent);
    return newEvent;
  }

  async updateAutomationEvent(id: string, data: Partial<AutomationEvent>): Promise<AutomationEvent | null> {
    const existing = this.automationEventsMap.get(id);
    if (!existing) return null;

    const updated: AutomationEvent = {
      ...existing,
      ...data,
    };
    this.automationEventsMap.set(id, updated);
    return updated;
  }

  async countTodayAutomationEventsByProfile(profileId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from(this.automationEventsMap.values())
      .filter(e => 
        e.profileId === profileId && 
        e.action === "SENT" && 
        e.createdAt && new Date(e.createdAt) >= today
      ).length;
  }

  async getLastSentEventForSymbol(profileId: string, symbol: string): Promise<AutomationEvent | null> {
    const events = Array.from(this.automationEventsMap.values())
      .filter(e => e.profileId === profileId && e.symbol === symbol && e.action === "SENT")
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    return events[0] || null;
  }

  async getOpportunityDefaults(userId: string): Promise<OpportunityDefaults | null> {
    const [defaults] = await db
      .select()
      .from(opportunityDefaultsTable)
      .where(eq(opportunityDefaultsTable.userId, userId))
      .limit(1);
    return defaults || null;
  }

  async setOpportunityDefaults(userId: string, defaults: Partial<InsertOpportunityDefaults>): Promise<OpportunityDefaults> {
    const existing = await this.getOpportunityDefaults(userId);
    
    if (existing) {
      const [updated] = await db
        .update(opportunityDefaultsTable)
        .set({ ...defaults, updatedAt: new Date() })
        .where(eq(opportunityDefaultsTable.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(opportunityDefaultsTable)
        .values({ userId, ...defaults })
        .returning();
      return created;
    }
  }

  async deleteOpportunityDefaults(userId: string): Promise<void> {
    await db
      .delete(opportunityDefaultsTable)
      .where(eq(opportunityDefaultsTable.userId, userId));
  }
}

export const storage = new MemStorage();
