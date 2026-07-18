export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  cronSecret = process.env.CRON_SECRET
) {
  const configuredSecret = cronSecret?.trim();

  if (!configuredSecret) {
    return false;
  }

  return authorizationHeader === `Bearer ${configuredSecret}`;
}
