import { AutomationSettings, AutomationLog, InsertAutomationLog } from "@shared/schema";

export interface EntrySignal {
  symbol: string;
  lastPrice: number;
  targetPrice: number;
  stopLoss: number;
}

export interface ExitSignal {
  symbol: string;
  reason: string;
  targetPrice?: number;
}

export function formatEntryMessage(signal: EntrySignal): string {
  return `enter sym=${signal.symbol} lp=${signal.lastPrice.toFixed(2)} tp=${signal.targetPrice.toFixed(2)} sl=${signal.stopLoss.toFixed(2)}`;
}

export function formatExitMessage(signal: ExitSignal): string {
  const parts = [`exit sym=${signal.symbol} reason="${signal.reason}"`];
  if (signal.targetPrice !== undefined) {
    parts[0] += ` tp=${signal.targetPrice.toFixed(2)}`;
  }
  return parts[0];
}

export async function sendWebhook(
  settings: AutomationSettings,
  message: string,
  apiKey?: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!settings.webhookUrl) {
    return { success: false, error: "Webhook URL not configured" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers,
      body: message,
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
        response: { status: response.status, body: responseText },
      };
    }

    return {
      success: true,
      response: { status: response.status, body: responseText },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendEntrySignal(
  settings: AutomationSettings,
  signal: EntrySignal,
  apiKey?: string
): Promise<{ success: boolean; message: string; response?: any; error?: string }> {
  if (!settings.isEnabled || !settings.autoEntryEnabled) {
    return { success: false, message: "", error: "Entry automation disabled" };
  }

  const message = formatEntryMessage(signal);
  console.log(`[AlgoPilotX] Sending entry signal: ${message}`);
  
  const result = await sendWebhook(settings, message, apiKey);
  
  return {
    ...result,
    message,
  };
}

export async function sendExitSignal(
  settings: AutomationSettings,
  signal: ExitSignal,
  apiKey?: string
): Promise<{ success: boolean; message: string; response?: any; error?: string }> {
  if (!settings.isEnabled || !settings.autoExitEnabled) {
    return { success: false, message: "", error: "Exit automation disabled" };
  }

  const message = formatExitMessage(signal);
  console.log(`[AlgoPilotX] Sending exit signal: ${message}`);
  
  const result = await sendWebhook(settings, message, apiKey);
  
  return {
    ...result,
    message,
  };
}

export function createAutomationLogEntry(
  userId: string,
  signalType: "entry" | "exit",
  symbol: string,
  message: string,
  result: { success: boolean; response?: any; error?: string }
): InsertAutomationLog {
  return {
    userId,
    signalType,
    symbol,
    message,
    webhookResponse: result.response || (result.error ? { error: result.error } : null),
    success: result.success,
  };
}
