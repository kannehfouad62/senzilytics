const requiredProductionVariables = ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET", "APP_URL", "MOBILE_TOKEN_SECRET"] as const;

export function inspectProductionEnvironment(environment: Record<string, string | undefined> = process.env) {
  const missing = requiredProductionVariables.filter((key) => !environment[key]?.trim());
  const warnings: string[] = [];
  const appUrl = environment.APP_URL?.trim();
  if (appUrl && !appUrl.startsWith("https://")) warnings.push("APP_URL should use HTTPS in production.");
  if ((environment.AUTH_SECRET?.trim().length ?? 0) < 32) warnings.push("AUTH_SECRET should contain at least 32 characters.");
  if ((environment.CRON_SECRET?.trim().length ?? 0) < 32) warnings.push("CRON_SECRET should contain at least 32 characters.");
  if ((environment.MOBILE_TOKEN_SECRET?.trim().length ?? 0) < 32) warnings.push("MOBILE_TOKEN_SECRET should contain at least 32 characters.");
  const integrationKey = environment.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!integrationKey) warnings.push("INTEGRATION_ENCRYPTION_KEY is required before creating webhook endpoints.");
  else {
    const decodedLength = /^[a-f0-9]{64}$/i.test(integrationKey) ? 32 : Buffer.from(integrationKey, "base64").length;
    if (decodedLength !== 32) warnings.push("INTEGRATION_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.");
  }
  return { valid: missing.length === 0 && warnings.length === 0, missing, warnings };
}
