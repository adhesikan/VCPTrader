import { storage } from "./storage";
import { AutomationProfile, AutomationEvent, InsertAutomationEvent } from "@shared/schema";

export interface AutomationSignalContext {
  userId: string;
  symbol: string;
  strategy: string;
  watchlistId?: string;
  alertRuleId?: string;
  alertRuleProfileId?: string;
  lastPrice: number;
  targetPrice: number;
  stopLoss: number;
  score?: number;
}

export interface AutomationDecision {
  action: "SEND" | "QUEUE" | "SKIP" | "BLOCKED";
  profile?: AutomationProfile & { apiKey?: string };
  reason: string;
  blockedReason?: string;
}

interface ProfileGuardrails {
  maxPerDay?: number;
  cooldownMinutes?: number;
  allowedTimeWindow?: {
    start: string;
    end: string;
    timezone?: string;
  };
  allowedStrategies?: string[];
  allowedWatchlists?: string[];
  allowedSymbols?: string[];
  minScore?: number;
}

function parseTimeWindowHHMM(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

function isWithinTimeWindow(
  guardrails: ProfileGuardrails,
  now: Date = new Date()
): boolean {
  if (!guardrails.allowedTimeWindow) return true;

  const { start, end } = guardrails.allowedTimeWindow;
  if (!start || !end) return true;

  const startTime = parseTimeWindowHHMM(start);
  const endTime = parseTimeWindowHHMM(end);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startTime.hour * 60 + startTime.minute;
  const endMinutes = endTime.hour * 60 + endTime.minute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

async function checkGuardrails(
  profile: AutomationProfile,
  context: AutomationSignalContext
): Promise<{ allowed: boolean; reason?: string }> {
  const guardrails = profile.guardrails as ProfileGuardrails | null;
  if (!guardrails) return { allowed: true };

  if (guardrails.minScore !== undefined && context.score !== undefined) {
    if (context.score < guardrails.minScore) {
      return {
        allowed: false,
        reason: `Score ${context.score} below minimum ${guardrails.minScore}`,
      };
    }
  }

  if (guardrails.allowedStrategies && guardrails.allowedStrategies.length > 0) {
    const strategyLower = context.strategy.toLowerCase();
    const allowed = guardrails.allowedStrategies.some(
      (s) => s.toLowerCase() === strategyLower
    );
    if (!allowed) {
      return {
        allowed: false,
        reason: `Strategy ${context.strategy} not in allowed list`,
      };
    }
  }

  if (guardrails.allowedSymbols && guardrails.allowedSymbols.length > 0) {
    const symbolUpper = context.symbol.toUpperCase();
    const allowed = guardrails.allowedSymbols.some(
      (s) => s.toUpperCase() === symbolUpper
    );
    if (!allowed) {
      return {
        allowed: false,
        reason: `Symbol ${context.symbol} not in allowed list`,
      };
    }
  }

  if (
    guardrails.allowedWatchlists &&
    guardrails.allowedWatchlists.length > 0 &&
    context.watchlistId
  ) {
    const allowed = guardrails.allowedWatchlists.includes(context.watchlistId);
    if (!allowed) {
      return {
        allowed: false,
        reason: `Watchlist not in allowed list`,
      };
    }
  }

  if (!isWithinTimeWindow(guardrails)) {
    return {
      allowed: false,
      reason: `Outside allowed time window (${guardrails.allowedTimeWindow?.start}-${guardrails.allowedTimeWindow?.end})`,
    };
  }

  if (guardrails.maxPerDay !== undefined) {
    const todayCount = await storage.countTodayAutomationEventsByProfile(profile.id);
    if (todayCount >= guardrails.maxPerDay) {
      return {
        allowed: false,
        reason: `Daily limit reached (${todayCount}/${guardrails.maxPerDay})`,
      };
    }
  }

  if (guardrails.cooldownMinutes !== undefined) {
    const lastEvent = await storage.getLastSentEventForSymbol(
      profile.id,
      context.symbol
    );
    if (lastEvent && lastEvent.createdAt) {
      const cooldownMs = guardrails.cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - new Date(lastEvent.createdAt).getTime();
      if (elapsed < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - elapsed) / 60000);
        return {
          allowed: false,
          reason: `Symbol ${context.symbol} in cooldown (${remainingMinutes}min remaining)`,
        };
      }
    }
  }

  return { allowed: true };
}

export async function resolveAutomationProfileForSignal(
  context: AutomationSignalContext
): Promise<AutomationDecision> {
  let targetProfile: (AutomationProfile & { apiKey?: string }) | null = null;

  if (context.alertRuleProfileId) {
    const profile = await storage.getAutomationProfileWithApiKey(
      context.alertRuleProfileId
    );
    if (profile && profile.userId === context.userId && profile.isEnabled) {
      targetProfile = profile;
    }
  }

  if (!targetProfile) {
    const userSettings = await storage.getUserAutomationSettings(context.userId);
    if (userSettings?.globalDefaultProfileId) {
      const profile = await storage.getAutomationProfileWithApiKey(
        userSettings.globalDefaultProfileId
      );
      if (profile && profile.userId === context.userId && profile.isEnabled) {
        targetProfile = profile;
      }
    }
  }

  if (!targetProfile) {
    const profiles = await storage.getAutomationProfiles(context.userId);
    const enabledProfiles = profiles.filter((p) => p.isEnabled);
    if (enabledProfiles.length > 0) {
      const profileWithKey = await storage.getAutomationProfileWithApiKey(
        enabledProfiles[0].id
      );
      if (profileWithKey) {
        targetProfile = profileWithKey;
      }
    }
  }

  if (!targetProfile) {
    return {
      action: "SKIP",
      reason: "No automation profile configured or enabled",
    };
  }

  if (targetProfile.mode === "OFF") {
    return {
      action: "SKIP",
      profile: targetProfile,
      reason: "Profile is disabled (mode: OFF)",
    };
  }

  const guardrailResult = await checkGuardrails(targetProfile, context);
  if (!guardrailResult.allowed) {
    return {
      action: "BLOCKED",
      profile: targetProfile,
      reason: "Blocked by guardrails",
      blockedReason: guardrailResult.reason,
    };
  }

  if (targetProfile.mode === "NOTIFY_ONLY") {
    return {
      action: "SKIP",
      profile: targetProfile,
      reason: "Profile is in notify-only mode (no webhook sent)",
    };
  }

  if (targetProfile.mode === "CONFIRM") {
    return {
      action: "QUEUE",
      profile: targetProfile,
      reason: "Queued for manual approval",
    };
  }

  if (targetProfile.mode === "AUTO") {
    return {
      action: "SEND",
      profile: targetProfile,
      reason: "Auto-send enabled",
    };
  }

  return {
    action: "SKIP",
    profile: targetProfile,
    reason: "Unknown mode",
  };
}

export function generateIdempotencyKey(
  alertRuleId: string,
  symbol: string,
  strategy: string
): string {
  const today = new Date().toISOString().split("T")[0];
  return `${alertRuleId}-${symbol}-${strategy}-${today}`;
}

export async function createAutomationEvent(
  context: AutomationSignalContext,
  decision: AutomationDecision
): Promise<AutomationEvent | null> {
  if (!decision.profile) return null;

  const idempotencyKey = generateIdempotencyKey(
    context.alertRuleId || "manual",
    context.symbol,
    context.strategy
  );

  const existingEvent = await storage.getAutomationEventByIdempotencyKey(idempotencyKey);
  if (existingEvent) {
    console.log(`[Automation] Duplicate event skipped: ${idempotencyKey}`);
    return existingEvent;
  }

  const eventData: InsertAutomationEvent = {
    userId: context.userId,
    profileId: decision.profile.id,
    signalId: context.alertRuleId || "manual",
    symbol: context.symbol,
    action: decision.action === "SEND" ? "SENT" : decision.action === "QUEUE" ? "QUEUED" : decision.action === "BLOCKED" ? "BLOCKED" : "SKIPPED",
    reason: decision.blockedReason || decision.reason,
    payload: {
      lastPrice: context.lastPrice,
      targetPrice: context.targetPrice,
      stopLoss: context.stopLoss,
      strategy: context.strategy,
      score: context.score,
    },
    idempotencyKey,
  };

  return storage.createAutomationEvent(eventData);
}
