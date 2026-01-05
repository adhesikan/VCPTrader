import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const symbols = pgTable("symbols", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: text("ticker").notNull().unique(),
  name: text("name").notNull(),
  exchange: text("exchange"),
  sector: text("sector"),
  industry: text("industry"),
  marketCap: real("market_cap"),
  avgVolume: real("avg_volume"),
  isActive: boolean("is_active").default(true),
});

export const insertSymbolSchema = createInsertSchema(symbols).omit({ id: true });
export type InsertSymbol = z.infer<typeof insertSymbolSchema>;
export type Symbol = typeof symbols.$inferSelect;

export const candles = pgTable("candles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbolId: varchar("symbol_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: real("volume").notNull(),
  timeframe: text("timeframe").notNull(),
});

export const insertCandleSchema = createInsertSchema(candles).omit({ id: true });
export type InsertCandle = z.infer<typeof insertCandleSchema>;
export type Candle = typeof candles.$inferSelect;

export const PatternStage = {
  FORMING: "FORMING",
  READY: "READY",
  BREAKOUT: "BREAKOUT",
} as const;

export type PatternStageType = typeof PatternStage[keyof typeof PatternStage];

export const scanResults = pgTable("scan_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanRunId: varchar("scan_run_id"),
  ticker: text("ticker").notNull(),
  name: text("name"),
  price: real("price").notNull(),
  change: real("change"),
  changePercent: real("change_percent"),
  volume: real("volume"),
  avgVolume: real("avg_volume"),
  rvol: real("rvol"),
  stage: text("stage").notNull(),
  resistance: real("resistance"),
  stopLoss: real("stop_loss"),
  patternScore: integer("pattern_score"),
  ema9: real("ema9"),
  ema21: real("ema21"),
  atr: real("atr"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScanResultSchema = createInsertSchema(scanResults).omit({ id: true, createdAt: true });
export type InsertScanResult = z.infer<typeof insertScanResultSchema>;
export type ScanResult = typeof scanResults.$inferSelect;

export const AlertType = {
  BREAKOUT: "BREAKOUT",
  STOP_HIT: "STOP_HIT",
  EMA_EXIT: "EMA_EXIT",
  APPROACHING: "APPROACHING",
} as const;

export type AlertTypeValue = typeof AlertType[keyof typeof AlertType];

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticker: text("ticker").notNull(),
  type: text("type").notNull(),
  price: real("price"),
  targetPrice: real("target_price"),
  stopPrice: real("stop_price"),
  message: text("message"),
  isRead: boolean("is_read").default(false),
  isTriggered: boolean("is_triggered").default(false),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, triggeredAt: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export const RuleConditionType = {
  STAGE_ENTERED: "STAGE_ENTERED",
  PRICE_ABOVE: "PRICE_ABOVE",
  PRICE_BELOW: "PRICE_BELOW",
  VOLUME_SPIKE: "VOLUME_SPIKE",
} as const;

export type RuleConditionTypeValue = typeof RuleConditionType[keyof typeof RuleConditionType];

export const AlertTimeframe = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "1d": "1d",
} as const;

export type AlertTimeframeValue = typeof AlertTimeframe[keyof typeof AlertTimeframe];

export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull().default("VCP"),
  timeframe: text("timeframe").notNull().default("1d"),
  conditionType: text("condition_type").notNull(),
  conditionPayload: jsonb("condition_payload"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  lastState: jsonb("last_state"),
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  lastEvaluatedAt: true,
  lastState: true 
});
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

export const alertEvents = pgTable("alert_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").notNull(),
  userId: varchar("user_id").notNull(),
  symbol: text("symbol").notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  eventKey: text("event_key").notNull().unique(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  price: real("price"),
  payload: jsonb("payload"),
  deliveryStatus: jsonb("delivery_status"),
  isRead: boolean("is_read").default(false),
});

export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({ 
  id: true, 
  triggeredAt: true 
});
export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;
export type AlertEvent = typeof alertEvents.$inferSelect;

export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  symbols: text("symbols").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({ id: true, createdAt: true });
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;

export const BrokerProvider = {
  TRADIER: "tradier",
  IBKR: "ibkr",
  ALPACA: "alpaca",
  SCHWAB: "schwab",
  POLYGON: "polygon",
  TASTYTRADE: "tastytrade",
  TRADESTATION: "tradestation",
} as const;

export type BrokerProviderType = typeof BrokerProvider[keyof typeof BrokerProvider];

export const brokerConnections = pgTable("broker_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  isConnected: boolean("is_connected").default(false),
  lastSync: timestamp("last_sync"),
  permissions: jsonb("permissions"),
});

export const insertBrokerConnectionSchema = createInsertSchema(brokerConnections).omit({ id: true });
export type InsertBrokerConnection = z.infer<typeof insertBrokerConnectionSchema>;
export type BrokerConnection = typeof brokerConnections.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const backtestResults = pgTable("backtest_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  ticker: text("ticker").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  initialCapital: real("initial_capital").notNull(),
  positionSize: real("position_size").notNull(),
  stopLossPercent: real("stop_loss_percent").notNull(),
  totalTrades: integer("total_trades").notNull(),
  winRate: real("win_rate").notNull(),
  avgReturn: real("avg_return").notNull(),
  maxDrawdown: real("max_drawdown").notNull(),
  sharpeRatio: real("sharpe_ratio"),
  totalReturn: real("total_return").notNull(),
  trades: jsonb("trades"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({ id: true, createdAt: true });
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResults.$inferSelect;

export const scannerFilters = z.object({
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minVolume: z.number().min(0).optional(),
  minDollarVolume: z.number().min(0).optional(),
  minRvol: z.number().min(0).optional(),
  maxSpread: z.number().min(0).optional(),
  excludeEtfs: z.boolean().optional(),
  excludeOtc: z.boolean().optional(),
  universe: z.enum(["all", "sp500", "nasdaq100", "watchlist"]).optional(),
});

export type ScannerFilters = z.infer<typeof scannerFilters>;

export const marketStats = z.object({
  advancers: z.number(),
  decliners: z.number(),
  unchanged: z.number(),
  totalVolume: z.number(),
  marketStatus: z.enum(["open", "closed", "pre", "after"]),
});

export type MarketStats = z.infer<typeof marketStats>;
