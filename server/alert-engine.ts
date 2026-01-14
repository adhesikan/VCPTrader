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

async function sendWebhookToEndpoint(
  endpointId: string,
  symbol: string,
  price: number,
  targetPrice: number,
  stopLoss: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = await storage.getAutomationEndpointWithSecret(endpointId);
    if (!endpoint || !endpoint.webhookUrl) {
      return { success: false, error: "Endpoint not found" };
    }
    
    // AlgoPilotX format: enter sym=SYMBOL lp=limitPrice tp=takeProfit sl=stopLoss
    const webhookMessage = `enter sym=${symbol} lp=${price.toFixed(2)} tp=${targetPrice.toFixed(2)} sl=${stopLoss.toFixed(2)}`;
    
    const response = await fetch(endpoint.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: webhookMessage,
    });
    
    if (response.ok) {
      console.log(`[AlertEngine] Webhook sent to ${endpoint.name}: ${webhookMessage}`);
      return { success: true };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function processAlertRules(
  connection: BrokerConnection
): Promise<AlertEvent[]> {
  const enabledRules = await storage.getEnabledAlertRules();
  
  if (enabledRules.length === 0) {
    return [];
  }
  
  // Separate global rules from symbol-specific rules
  const globalRules = enabledRules.filter(r => r.isGlobal);
  const symbolRules = enabledRules.filter(r => !r.isGlobal && r.symbol);
  
  const createdEvents: AlertEvent[] = [];
  const now = new Date();
  
  // Process global rules against scan results
  if (globalRules.length > 0) {
    const scanResults = await storage.getScanResults();
    
    for (const rule of globalRules) {
      try {
        const payload = rule.conditionPayload as { targetStage?: string } | null;
        const targetStage = payload?.targetStage || PatternStage.BREAKOUT;
        
        // Get previously triggered symbols for this rule
        const previouslyTriggered = new Set(rule.triggeredSymbols || []);
        const newlyTriggered: string[] = [];
        
        // Find scan results that match the target stage
        const matchingResults = scanResults.filter(result => 
          result.stage === targetStage && !previouslyTriggered.has(result.ticker)
        );
        
        for (const result of matchingResults) {
          const eventKey = generateEventKey(rule.id, `${result.ticker}:${targetStage}`, now);
          
          const existingEvent = await storage.getAlertEventByKey(eventKey);
          if (existingEvent) {
            continue;
          }
          
          const eventData: InsertAlertEvent = {
            ruleId: rule.id,
            userId: rule.userId,
            symbol: result.ticker,
            eventKey,
            fromState: null,
            toState: targetStage,
            price: result.price,
            payload: {
              resistance: result.resistance,
              stopLoss: result.stopLoss,
              volumeRatio: result.rvol,
              changePercent: result.changePercent,
              patternScore: result.patternScore,
              message: generateAlertMessage(result.ticker, null, targetStage, result.price),
            },
            deliveryStatus: { push: false, webhook: false },
            isRead: false,
          };
          
          const event = await storage.createAlertEvent(eventData);
          createdEvents.push(event);
          newlyTriggered.push(result.ticker);
          
          // Send push notification if enabled
          if (rule.sendPushNotification !== false) {
            try {
              const { sendAlertPushNotification } = await import("./push-service");
              await sendAlertPushNotification(event);
              console.log(`[AlertEngine] Push sent for global alert: ${result.ticker} ${targetStage}`);
            } catch (pushError) {
              console.log(`[AlertEngine] Push notification error: ${pushError}`);
            }
          }
          
          // Send webhook if enabled and endpoint configured
          if (rule.sendWebhook && rule.automationEndpointId) {
            // For webhook: entry at current price, target based on risk (entry - stop)
            const entryPrice = result.price;
            const stopLoss = result.stopLoss || entryPrice * 0.93;
            const riskAmount = entryPrice - stopLoss;
            const targetPrice = entryPrice + (riskAmount * 2); // 2R target
            
            const webhookResult = await sendWebhookToEndpoint(
              rule.automationEndpointId,
              result.ticker,
              entryPrice,
              targetPrice,
              stopLoss
            );
            
            if (webhookResult.success) {
              console.log(`[AlertEngine] Webhook sent for ${result.ticker}`);
            } else {
              console.error(`[AlertEngine] Webhook failed for ${result.ticker}: ${webhookResult.error}`);
            }
          }
          
          console.log(`[AlertEngine] Global alert triggered: ${result.ticker} entered ${targetStage}`);
        }
        
        // Update rule with newly triggered symbols
        if (newlyTriggered.length > 0) {
          await storage.updateAlertRule(rule.id, {
            lastEvaluatedAt: now,
            triggeredSymbols: [...Array.from(previouslyTriggered), ...newlyTriggered],
          });
        }
      } catch (error) {
        console.error(`[AlertEngine] Error processing global rule ${rule.id}:`, error);
      }
    }
  }
  
  // Process symbol-specific rules
  if (symbolRules.length > 0) {
    const symbols = Array.from(new Set(symbolRules.map(r => r.symbol).filter((s): s is string => s !== null)));
    
    let quotes: QuoteData[] = [];
    if (symbols.length > 0) {
      try {
        quotes = await fetchQuotesFromBroker(connection, symbols);
      } catch (error) {
        console.error("[AlertEngine] Failed to fetch quotes:", error);
      }
    }
    
    const quoteMap = new Map(quotes.map(q => [q.symbol.toUpperCase(), q]));
    
    for (const rule of symbolRules) {
      if (!rule.symbol) continue;
      
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
          
          // Send push notification for the alert
          if (rule.sendPushNotification !== false) {
            try {
              const { sendAlertPushNotification } = await import("./push-service");
              await sendAlertPushNotification(event);
            } catch (pushError) {
              console.log(`[AlertEngine] Push notification error: ${pushError}`);
            }
          }
          
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
          
          // Send webhook if enabled and endpoint configured
          if (rule.sendWebhook && rule.automationEndpointId && rule.symbol) {
            // For webhook: entry at current price, target based on risk (entry - stop)
            const entryPrice = result.price;
            const stopLoss = classification.stopLoss || entryPrice * 0.93;
            const riskAmount = entryPrice - stopLoss;
            const targetPrice = entryPrice + (riskAmount * 2); // 2R target
            
            const webhookResult = await sendWebhookToEndpoint(
              rule.automationEndpointId,
              rule.symbol,
              entryPrice,
              targetPrice,
              stopLoss
            );
            
            if (webhookResult.success) {
              console.log(`[AlertEngine] Webhook sent for ${rule.symbol}`);
            } else {
              console.error(`[AlertEngine] Webhook failed for ${rule.symbol}: ${webhookResult.error}`);
            }
          }
          
          // Legacy automation profile handling
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
