import { storage } from "./storage";

export async function migrateExistingWebhookToProfile(userId: string): Promise<boolean> {
  try {
    const existingProfiles = await storage.getAutomationProfiles(userId);
    if (existingProfiles.length > 0) {
      return false;
    }

    const legacySettings = await storage.getAutomationSettingsWithApiKey(userId);
    if (!legacySettings || !legacySettings.webhookUrl) {
      return false;
    }

    console.log(`[Migration] Creating default profile from legacy settings for user ${userId}`);

    const guardrails = legacySettings.minScore && legacySettings.minScore > 0 
      ? { minScore: legacySettings.minScore }
      : null;

    const mode = legacySettings.isEnabled && legacySettings.autoEntryEnabled 
      ? "AUTO" 
      : legacySettings.isEnabled 
        ? "NOTIFY_ONLY" 
        : "OFF";

    const profile = await storage.createAutomationProfile({
      userId,
      name: "Default (Migrated)",
      webhookUrl: legacySettings.webhookUrl,
      mode,
      isEnabled: true,
      guardrails,
    }, legacySettings.apiKey);

    await storage.setUserAutomationSettings(userId, {
      userId,
      globalDefaultProfileId: profile.id,
    });

    console.log(`[Migration] Successfully created default profile ${profile.id} for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`[Migration] Failed to migrate webhook to profile for user ${userId}:`, error);
    return false;
  }
}

export async function runUserMigrationIfNeeded(userId: string): Promise<void> {
  await migrateExistingWebhookToProfile(userId);
}
