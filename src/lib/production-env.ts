const requiredProductionVariables = ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET", "APP_URL"] as const;

export function inspectProductionEnvironment(environment: Record<string, string | undefined> = process.env) {
  const missing = requiredProductionVariables.filter((key) => !environment[key]?.trim());
  const warnings: string[] = [];
  const appUrl = environment.APP_URL?.trim();
  if (appUrl && !appUrl.startsWith("https://")) warnings.push("APP_URL should use HTTPS in production.");
  if ((environment.AUTH_SECRET?.trim().length ?? 0) < 32) warnings.push("AUTH_SECRET should contain at least 32 characters.");
  if ((environment.CRON_SECRET?.trim().length ?? 0) < 32) warnings.push("CRON_SECRET should contain at least 32 characters.");
  return { valid: missing.length === 0 && warnings.length === 0, missing, warnings };
}
