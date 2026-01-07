import { storage } from "./storage";
import { fetchQuotesFromBroker, type QuoteData } from "./broker-service";
import type { AlertRule, AlertEvent, InsertAlertEvent, BrokerConnection, PatternStageType } from "@shared/schema";
import { PatternStage, RuleConditionType } from "@shared/schema";
import { sendEntrySignalToProfile, createAutomationLogEntry, type EntrySignal } from "./algopilotx";
import { resolveAutomationProfileForSignal, createAutomationEvent, type AutomationSignalContext } from "./automation-resolver";
import { ALERT_DISCLAIMER, getStrategyDisplayName } from "@shared/strategies";

export interface VCPClassification {
  stage: PatternStageType;
  priceFromHigh: number;
  volumeRatio: number;
  changePercent: number;
  resistance: number;
  stopLoss: number;
}

export function classifyVCPStage(quote: QuoteData): VCPClassification {
  const priceFromHigh = ((quote.high - quote.last) / quote.high) * 100;
  const volumeRatio = quote.avgVolume ? quote.volume / quote.avgVolume : 1;
  
  let stage: PatternStageType;
  
  if (quote.change > 0 && quote.changePercent > 2 && volumeRatio > 1.5) {
    stage = PatternStage.BREAKOUT;
  } else if (priceFromHigh < 5 && quote.change > 0) {
    stage = PatternStage.READY;
  } else {
    stage = PatternStage.FORMING;
  }
  
  return {
    stage,
    priceFromHigh,
    volumeRatio,
    changePercent: quote.changePercent,
    resistance: quote.high * 1.02,
    stopLoss: quote.last * 0.93,
  };
}

export function generateEventKey(ruleId: string, toState: string, date: Date): string {
  const dateStr = date.toISOString().split("T")[0];
  return `${ruleId}:${toState}:${dateStr}`;
}

export function generateAlertMessage(
  symbol: string, 
  fromState: string | null, 
  toState: string,
  price: number
): string {
  const transition = fromState 
    ? `${symbol} transitioned from ${fromState} to ${toState}`
    : `${symbol} entered ${toState} stage`;
  
  return `${transition} at $${price.toFixed(2)}. ${ALERT_DISCLAIMER}`;
}

interface EvaluationResult {
  rule: AlertRule;
  triggered: boolean;
  fromState: string | null;
  toState: string;
  price: number;
  quote: QuoteData;
  classification: VCPClassification;
}

export async function evaluateRule(
  rule: AlertRule,
  quote: QuoteData
): Promise<EvaluationResult | null> {
  const classification = classifyVCPStage(quote);
  const currentState = classification.stage;
  
  const lastState = rule.lastState as { stage?: string } | null;
  const previousStage = lastState?.stage || null;
  
  let triggered = false;
  
  switch (rule.conditionType) {
    case RuleConditionType.STAGE_ENTERED: {
      const payload = rule.conditionPayload as { targetStage: string } | null;
      const targetStage = payload?.targetStage || PatternStage.BREAKOUT;
      
      if (currentState === targetStage && previousStage !== targetStage) {
        triggered = true;
      }
      break;
    }
    
    case RuleConditionType.PRICE_ABOVE: {
      const payload = rule.conditionPayload as { threshold: number } | null;
      const threshold = payload?.threshold;
      const lastPrice = lastState as { price?: number } | null;
      
      if (threshold && quote.last > threshold) {
        if (!lastPrice?.price || lastPrice.price <= threshold) {
          triggered = true;
        }
      }
      break;
    }
    
    case RuleConditionType.PRICE_BELOW: {
      const payload = rule.conditionPayload as { threshold: number } | null;
      const threshold = payload?.threshold;
      const lastPrice = lastState as { price?: number } | null;
      
      if (threshold && quote.last < threshold) {
        if (!lastPrice?.price || lastPrice.price >= threshold) {
          triggered = true;
        }
      }
      break;
    }
    
    case RuleConditionType.VOLUME_SPIKE: {
      const payload = rule.conditionPayload as { multiplier?: number } | null;
      const multiplier = payload?.multiplier || 2.0;
      
      if (classification.volumeRatio >= multiplier) {
        const lastRatio = (lastState as { volumeRatio?: number } | null)?.volumeRatio;
        if (!lastRatio || lastRatio < multiplier) {
          triggered = true;
        }
      }
      break;
    }
  }
  
  if (triggered) {
    return {
      rule,
      triggered: true,
      fromState: previousStage,
      toState: currentState,
      price: quote.last,
      quote,
      classification,
    };
  }
  
  return null;
}

export async function processAlertRules(
  connection: BrokerConnection
): Promise<AlertEvent[]> {
  const enabledRules = await storage.getEnabledAlertRules();
  
  if (enabledRules.length === 0) {
    return [];
  }
  
  const symbols = Array.from(new Set(enabledRules.map(r => r.symbol)));
  
  let quotes: QuoteData[];
  try {
    quotes = await fetchQuotesFromBroker(connection, symbols);
  } catch (error) {
    console.error("[AlertEngine] Failed to fetch quotes:", error);
    return [];
  }
  
  const quoteMap = new Map(quotes.map(q => [q.symbol.toUpperCase(), q]));
  const createdEvents: AlertEvent[] = [];
  const now = new Date();
  
  for (const rule of enabledRules) {
    const quote = quoteMap.get(rule.symbol.toUpperCase());
    if (!quote) {
      continue;
    }
    
    try {
      const result = await evaluateRule(rule, quote);
      
      if (result && result.triggered) {
        const eventKey = generateEventKey(rule.id, result.toState, now);
        
        const existingEvent = await storage.getAlertEventByKey(eventKey);
        if (existingEvent) {
          continue;
        }
        
        const classification = result.classification;
        
        const eventData: InsertAlertEvent = {
          ruleId: rule.id,
          userId: rule.userId,
          symbol: rule.symbol,
          eventKey,
          fromState: result.fromState,
          toState: result.toState,
          price: result.price,
          payload: {
            resistance: classification.resistance,
            stopLoss: classification.stopLoss,
            volumeRatio: classification.volumeRatio,
            changePercent: classification.changePercent,
            message: generateAlertMessage(
              rule.symbol,
              result.fromState,
              result.toState,
              result.price
            ),
          },
          deliveryStatus: { push: false, email: false },
          isRead: false,
        };
        
        const event = await storage.createAlertEvent(eventData);
        createdEvents.push(event);
        
        await storage.updateAlertRule(rule.id, {
          lastEvaluatedAt: now,
          lastState: {
            stage: result.toState,
            price: result.price,
            volumeRatio: classification.volumeRatio,
            timestamp: now.toISOString(),
          },
        });
        
        console.log(`[AlertEngine] Event created: ${rule.symbol} ${result.fromState || "N/A"} -> ${result.toState}`);
        
        if (result.toState === PatternStage.BREAKOUT || result.toState === PatternStage.TRIGGERED) {
          try {
            const alertScore = (eventData.payload as any)?.score || 75;
            const targetPrice = classification.resistance * 1.03;
            
            const signalContext: AutomationSignalContext = {
              userId: rule.userId,
              symbol: rule.symbol,
              strategy: rule.strategy || "VCP",
              alertRuleId: rule.id,
              alertRuleProfileId: rule.automationProfileId || undefined,
              watchlistId: rule.watchlistId || undefined,
              lastPrice: result.price,
              targetPrice: Number(targetPrice.toFixed(2)),
              stopLoss: Number(classification.stopLoss.toFixed(2)),
              score: alertScore,
            };
            
            const decision = await resolveAutomationProfileForSignal(signalContext);
            console.log(`[AlertEngine] Automation decision for ${rule.symbol}: ${decision.action} - ${decision.reason}`);
            
            await createAutomationEvent(signalContext, decision);
            
            if (decision.action === "SEND" && decision.profile) {
              const entrySignal: EntrySignal = {
                symbol: rule.symbol,
                lastPrice: result.price,
                targetPrice: signalContext.targetPrice,
                stopLoss: signalContext.stopLoss,
              };
              
              const webhookResult = await sendEntrySignalToProfile(
                decision.profile.webhookUrl,
                entrySignal,
                decision.profile.apiKey
              );
              
              const logEntry = createAutomationLogEntry(
                rule.userId,
                "entry",
                rule.symbol,
                webhookResult.message,
                webhookResult
              );
              await storage.createAutomationLog(logEntry);
              
              if (webhookResult.success) {
                console.log(`[AlertEngine] Webhook sent for ${rule.symbol}: ${webhookResult.message}`);
              } else {
                console.error(`[AlertEngine] Webhook failed for ${rule.symbol}: ${webhookResult.error}`);
              }
            } else if (decision.action === "QUEUE") {
              console.log(`[AlertEngine] Signal queued for approval: ${rule.symbol}`);
            } else if (decision.action === "BLOCKED") {
              console.log(`[AlertEngine] Signal blocked: ${rule.symbol} - ${decision.blockedReason}`);
            }
          } catch (webhookError) {
            console.error(`[AlertEngine] Error in automation for ${rule.symbol}:`, webhookError);
          }
        }
      } else {
        await storage.updateAlertRule(rule.id, {
          lastEvaluatedAt: now,
          lastState: {
            stage: classifyVCPStage(quote).stage,
            price: quote.last,
            volumeRatio: quote.avgVolume ? quote.volume / quote.avgVolume : 1,
            timestamp: now.toISOString(),
          },
        });
      }
    } catch (error) {
      console.error(`[AlertEngine] Error evaluating rule ${rule.id}:`, error);
    }
  }
  
  return createdEvents;
}

let scheduledJob: ReturnType<typeof setInterval> | null = null;

export function startAlertEngine(
  getConnection: () => Promise<BrokerConnection | null>,
  intervalMs: number = 60000
): void {
  if (scheduledJob) {
    console.log("[AlertEngine] Already running, stopping previous instance");
    stopAlertEngine();
  }
  
  console.log(`[AlertEngine] Starting with ${intervalMs}ms interval`);
  
  scheduledJob = setInterval(async () => {
    try {
      const connection = await getConnection();
      if (!connection) {
        return;
      }
      
      const events = await processAlertRules(connection);
      if (events.length > 0) {
        console.log(`[AlertEngine] Created ${events.length} alert event(s)`);
      }
    } catch (error) {
      console.error("[AlertEngine] Error in scheduled evaluation:", error);
    }
  }, intervalMs);
  
  (async () => {
    try {
      const connection = await getConnection();
      if (connection) {
        await processAlertRules(connection);
      }
    } catch (error) {
      console.error("[AlertEngine] Error in initial evaluation:", error);
    }
  })();
}

export function stopAlertEngine(): void {
  if (scheduledJob) {
    clearInterval(scheduledJob);
    scheduledJob = null;
    console.log("[AlertEngine] Stopped");
  }
}

export function isAlertEngineRunning(): boolean {
  return scheduledJob !== null;
}
