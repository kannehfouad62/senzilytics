export const MOBILE_API_VERSION = "1";

export type MobileReleasePlatform = "ios" | "android";

export type MobileReleasePolicy = {
  platform: MobileReleasePlatform | null;
  clientVersion: string | null;
  apiVersion: string | null;
  minimumVersion: string;
  recommendedVersion: string;
  meetsMinimum: boolean;
  updateRequired: boolean;
  updateRecommended: boolean;
  enforcementEnabled: boolean;
  storeUrl: string | null;
  maintenance: boolean;
  message: string | null;
  checkedAt: string;
};

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseMobileVersion(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  const match = VERSION_PATTERN.exec(normalized);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

export function compareMobileVersions(left: string, right: string) {
  const leftParts = parseMobileVersion(left);
  const rightParts = parseMobileVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

export function readMobileReleasePolicy(
  request: Pick<Request, "headers">,
  environment: Record<string, string | undefined> = process.env,
  now = new Date()
): MobileReleasePolicy {
  const platform = normalizePlatform(
    request.headers.get("x-senzilytics-mobile-platform")
  );
  const rawClientVersion = request.headers
    .get("x-senzilytics-mobile-version")
    ?.trim();
  const clientVersion = parseMobileVersion(rawClientVersion)
    ? rawClientVersion!
    : null;
  const apiVersion =
    request.headers.get("x-senzilytics-mobile-api-version")?.trim() || null;
  const minimumVersion = configuredVersion(
    platform
      ? environment[
          platform === "ios"
            ? "MOBILE_MINIMUM_IOS_VERSION"
            : "MOBILE_MINIMUM_ANDROID_VERSION"
        ]
      : undefined
  );
  const recommendedVersion = configuredVersion(
    platform
      ? environment[
          platform === "ios"
            ? "MOBILE_RECOMMENDED_IOS_VERSION"
            : "MOBILE_RECOMMENDED_ANDROID_VERSION"
        ]
      : undefined
  );
  const storeUrl = platform
    ? safeStoreUrl(
        platform,
        environment[
          platform === "ios"
            ? "MOBILE_IOS_STORE_URL"
            : "MOBILE_ANDROID_STORE_URL"
        ]
      )
    : null;
  const enforcementEnabled =
    isMobileReleaseEnforcementReady(environment);
  const minimumComparison = clientVersion
    ? compareMobileVersions(clientVersion, minimumVersion)
    : -1;
  const recommendedComparison = clientVersion
    ? compareMobileVersions(clientVersion, recommendedVersion)
    : -1;
  const meetsMinimum = minimumComparison !== null && minimumComparison >= 0;
  const updateRequired =
    enforcementEnabled && Boolean(platform) && !meetsMinimum;
  const updateRecommended =
    !updateRequired &&
    recommendedVersion !== "0.0.0" &&
    recommendedComparison !== null &&
    recommendedComparison < 0;
  const maintenance =
    environment.MOBILE_MAINTENANCE_MODE?.trim().toLowerCase() === "true";
  const configuredMessage = environment.MOBILE_MAINTENANCE_MESSAGE?.trim();

  return {
    platform,
    clientVersion,
    apiVersion,
    minimumVersion,
    recommendedVersion,
    meetsMinimum,
    updateRequired,
    updateRecommended,
    enforcementEnabled,
    storeUrl,
    maintenance,
    message: maintenance
      ? (configuredMessage || "Mobile service is temporarily unavailable.")
          .slice(0, 240)
      : null,
    checkedAt: now.toISOString(),
  };
}

export function isMobileReleaseEnforcementReady(
  environment: Record<string, string | undefined> = process.env
) {
  return (
    environment.MOBILE_ENFORCE_MINIMUM_VERSION?.trim().toLowerCase() ===
      "true" &&
    Boolean(parseMobileVersion(environment.MOBILE_MINIMUM_IOS_VERSION)) &&
    Boolean(parseMobileVersion(environment.MOBILE_MINIMUM_ANDROID_VERSION)) &&
    Boolean(safeStoreUrl("ios", environment.MOBILE_IOS_STORE_URL)) &&
    Boolean(safeStoreUrl("android", environment.MOBILE_ANDROID_STORE_URL))
  );
}

export function safeStoreUrl(
  platform: MobileReleasePlatform,
  value: string | null | undefined
) {
  try {
    const url = new URL(value?.trim() || "");
    const permittedHost =
      platform === "ios" ? "apps.apple.com" : "play.google.com";
    if (
      url.protocol !== "https:" ||
      url.hostname !== permittedHost ||
      url.port ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function configuredVersion(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && parseMobileVersion(normalized) ? normalized : "0.0.0";
}

function normalizePlatform(
  value: string | null
): MobileReleasePlatform | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "ios" || normalized === "android" ? normalized : null;
}
