import { ActivityAction, MobilePlatform, MobileSessionStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planEntitlements } from "@/lib/subscription";
import { createMobileOpaqueToken, hashMobileToken, isMobilePlatform, isMobileRedirectUri, isValidDeviceId, isValidMobileState, isValidPkceChallenge, MOBILE_SESSION_TTL_MS, pkceChallenge, secureHashMatch, signMobileAccessToken, verifyMobileAccessToken } from "@/modules/mobile/mobile-token";

export class MobileAuthError extends Error { constructor(message: string, public readonly status: number, public readonly code: string) { super(message); } }

export type MobileAuthorizationEligibility =
  | {
      eligible: true;
      user: { id: string };
      organization: {
        id: string;
        subscriptionPlan: keyof typeof planEntitlements;
        isDemo: boolean;
      };
    }
  | {
      eligible: false;
      title: string;
      detail: string;
    };

export async function getMobileAuthorizationEligibilityService(
  userId: string
): Promise<MobileAuthorizationEligibility> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      organization: {
        select: {
          id: true,
          status: true,
          isDemo: true,
          subscriptionPlan: true,
        },
      },
    },
  });

  if (!user?.isActive) {
    return {
      eligible: false,
      title: "Account unavailable",
      detail:
        "This account is inactive or no longer exists. Contact your Senzilytics administrator.",
    };
  }

  if (!user.organization) {
    return {
      eligible: false,
      title: "Tenant assignment required",
      detail:
        "Native mobile access is tenant-scoped. Ask a Senzilytics platform administrator to assign this user to an active Premium tenant.",
    };
  }

  if (user.organization.status !== OrganizationStatus.ACTIVE) {
    return {
      eligible: false,
      title: "Organization unavailable",
      detail:
        "Your organization is not active. Contact your Senzilytics administrator before signing in on mobile.",
    };
  }

  if (
    user.organization.isDemo ||
    !planEntitlements[user.organization.subscriptionPlan].MOBILE_APPS
  ) {
    return {
      eligible: false,
      title: "Premium mobile access required",
      detail:
        "Your organization does not currently include native iOS and Android access. Contact your Senzilytics administrator to enable the Premium plan.",
    };
  }

  return {
    eligible: true,
    user: { id: user.id },
    organization: user.organization,
  };
}

export async function createMobileChallengeService(input: { codeChallenge: string; state: string; redirectUri: string; requestFingerprint: string }) {
  if (!isValidPkceChallenge(input.codeChallenge)) throw new MobileAuthError("PKCE code challenge is invalid.", 400, "invalid_request");
  if (!isValidMobileState(input.state)) throw new MobileAuthError("Authentication state is invalid.", 400, "invalid_request");
  if (!isMobileRedirectUri(input.redirectUri)) throw new MobileAuthError("Mobile redirect URI is not registered.", 400, "invalid_redirect_uri");
  const requestFingerprintHash = hashMobileToken(input.requestFingerprint);
  const windowStartedAt = new Date(Date.now() - 10 * 60_000);
  const [recent, globalRecent] = await Promise.all([
    prisma.mobileAuthChallenge.count({ where: { requestFingerprintHash, createdAt: { gte: windowStartedAt } } }),
    prisma.mobileAuthChallenge.count({ where: { createdAt: { gte: windowStartedAt } } }),
  ]);
  if (recent >= 20) throw new MobileAuthError("Too many mobile authorization requests. Try again later.", 429, "rate_limit_exceeded");
  if (globalRecent >= 5_000) throw new MobileAuthError("Mobile authorization is temporarily busy. Try again later.", 503, "temporarily_unavailable");
  const raw = createMobileOpaqueToken("smc");
  await prisma.$transaction([prisma.mobileAuthChallenge.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } }), prisma.mobileAuthChallenge.create({ data: { tokenHash: hashMobileToken(raw), requestFingerprintHash, clientState: input.state, codeChallenge: input.codeChallenge, redirectUri: input.redirectUri, expiresAt: new Date(Date.now() + 10 * 60_000) } })]);
  return { challenge: raw, authorizeUrl: `/mobile/authorize?challenge=${encodeURIComponent(raw)}`, expiresIn: 600 };
}

export async function denyMobileChallengeService(raw: string) {
  const challenge = await prisma.mobileAuthChallenge.findUnique({ where: { tokenHash: hashMobileToken(raw) } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.usedAt) throw new MobileAuthError("Mobile authorization request is invalid or expired.", 400, "invalid_challenge");
  await prisma.mobileAuthChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
  return `${challenge.redirectUri}?error=access_denied&state=${encodeURIComponent(challenge.clientState)}`;
}

export async function getMobileChallengeService(raw: string) {
  if (!raw.startsWith("smc_")) return null;
  return prisma.mobileAuthChallenge.findUnique({ where: { tokenHash: hashMobileToken(raw) }, select: { id: true, clientState: true, redirectUri: true, expiresAt: true, authorizedAt: true, usedAt: true } });
}

export async function authorizeMobileChallengeService(input: { challenge: string; userId: string; organizationId: string; organizationPlan: keyof typeof planEntitlements; isDemo: boolean }) {
  if (input.isDemo || !planEntitlements[input.organizationPlan].MOBILE_APPS) throw new MobileAuthError("Native mobile access requires an active Premium subscription.", 403, "mobile_not_entitled");
  const challenge = await prisma.mobileAuthChallenge.findUnique({ where: { tokenHash: hashMobileToken(input.challenge) } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.usedAt || challenge.authorizedAt) throw new MobileAuthError("Mobile authorization request is invalid or expired.", 400, "invalid_challenge");
  const code = createMobileOpaqueToken("sma");
  const claimed = await prisma.mobileAuthChallenge.updateMany({ where: { id: challenge.id, authorizedAt: null, usedAt: null, expiresAt: { gt: new Date() } }, data: { organizationId: input.organizationId, authorizedById: input.userId, authorizationCodeHash: hashMobileToken(code), authorizedAt: new Date() } });
  if (!claimed.count) throw new MobileAuthError("Mobile authorization request has already been used.", 409, "challenge_used");
  await prisma.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.LOGIN, entityType: "MobileAuthorization", entityId: challenge.id, title: "Native mobile access authorized" } });
  return `${challenge.redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(challenge.clientState)}`;
}

export async function exchangeMobileAuthorizationCodeService(input: { code: string; codeVerifier: string; deviceId: string; deviceName: string; platform: string }) {
  validateDevice(input);
  const challenge = await prisma.mobileAuthChallenge.findUnique({ where: { authorizationCodeHash: hashMobileToken(input.code) }, include: { authorizedBy: true, organization: true } });
  if (!challenge?.authorizedBy || !challenge.organization || !challenge.authorizedAt || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.authorizedAt.getTime() < Date.now() - 2 * 60_000 || !secureHashMatch(input.code, challenge.authorizationCodeHash!)) throw new MobileAuthError("Authorization code is invalid or expired.", 401, "invalid_grant");
  if (pkceChallenge(input.codeVerifier) !== challenge.codeChallenge) throw new MobileAuthError("PKCE verification failed.", 401, "invalid_grant");
  assertMobileUser(challenge.authorizedBy, challenge.organization);
  const refreshToken = createMobileOpaqueToken("smr"), refreshTokenHash = hashMobileToken(refreshToken), expiresAt = new Date(Date.now() + MOBILE_SESSION_TTL_MS);
  const session = await prisma.$transaction(async (tx) => {
    const consumed = await tx.mobileAuthChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!consumed.count) throw new MobileAuthError("Authorization code has already been used.", 401, "invalid_grant");
    const record = await tx.mobileSession.upsert({ where: { userId_deviceId: { userId: challenge.authorizedBy!.id, deviceId: input.deviceId } }, update: { organizationId: challenge.organization!.id, deviceName: input.deviceName.trim().slice(0, 120), platform: input.platform as MobilePlatform, refreshTokenHash, refreshTokenLastFour: refreshToken.slice(-4), status: MobileSessionStatus.ACTIVE, userSessionVersion: challenge.authorizedBy!.sessionVersion, expiresAt, lastUsedAt: new Date(), revokedAt: null }, create: { organizationId: challenge.organization!.id, userId: challenge.authorizedBy!.id, deviceId: input.deviceId, deviceName: input.deviceName.trim().slice(0, 120), platform: input.platform as MobilePlatform, refreshTokenHash, refreshTokenLastFour: refreshToken.slice(-4), userSessionVersion: challenge.authorizedBy!.sessionVersion, expiresAt, lastUsedAt: new Date() } });
    await tx.activityLog.create({ data: { organizationId: challenge.organization!.id, userId: challenge.authorizedBy!.id, action: ActivityAction.LOGIN, entityType: "MobileSession", entityId: record.id, title: `Native ${input.platform.toLowerCase()} session created`, metadata: { deviceName: record.deviceName } } });
    return record;
  });
  return issueMobileTokens(session, challenge.authorizedBy, challenge.organization.name, refreshToken);
}

export async function refreshMobileSessionService(refreshToken: string) {
  if (!refreshToken.startsWith("smr_")) throw new MobileAuthError("Refresh token is invalid.", 401, "invalid_grant");
  const currentHash = hashMobileToken(refreshToken);
  const session = await prisma.mobileSession.findUnique({ where: { refreshTokenHash: currentHash }, include: { user: true, organization: true } });
  if (!session || !secureHashMatch(refreshToken, session.refreshTokenHash) || session.status !== MobileSessionStatus.ACTIVE || session.expiresAt <= new Date()) throw new MobileAuthError("Mobile session is invalid or expired.", 401, "invalid_grant");
  assertMobileUser(session.user, session.organization);
  if (session.userSessionVersion !== session.user.sessionVersion) throw new MobileAuthError("Mobile session has been revoked.", 401, "session_revoked");
  const nextRefreshToken = createMobileOpaqueToken("smr"), nextHash = hashMobileToken(nextRefreshToken), expiresAt = new Date(Date.now() + MOBILE_SESSION_TTL_MS);
  const rotated = await prisma.mobileSession.updateMany({ where: { id: session.id, refreshTokenHash: currentHash, status: MobileSessionStatus.ACTIVE }, data: { refreshTokenHash: nextHash, refreshTokenLastFour: nextRefreshToken.slice(-4), expiresAt, lastUsedAt: new Date() } });
  if (!rotated.count) throw new MobileAuthError("Refresh token has already been rotated.", 401, "invalid_grant");
  return issueMobileTokens(session, session.user, session.organization.name, nextRefreshToken);
}

export async function authenticateMobileRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const raw = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const payload = raw ? verifyMobileAccessToken(raw) : null;
  if (!payload) throw new MobileAuthError("A valid mobile access token is required.", 401, "unauthorized");
  const session = await prisma.mobileSession.findFirst({ where: { id: payload.sessionId, userId: payload.sub, organizationId: payload.organizationId, status: MobileSessionStatus.ACTIVE, expiresAt: { gt: new Date() } }, include: { user: true, organization: true } });
  if (!session || !session.user.isActive || session.user.sessionVersion !== payload.sessionVersion || session.userSessionVersion !== payload.sessionVersion || session.organization.status !== OrganizationStatus.ACTIVE || !planEntitlements[session.organization.subscriptionPlan].MOBILE_APPS) throw new MobileAuthError("Mobile session is no longer authorized.", 401, "session_revoked");
  return { session, user: session.user, organization: session.organization };
}

export async function revokeMobileSessionService(sessionId: string, userId: string, organizationId: string) {
  await prisma.$transaction([prisma.mobileSession.updateMany({ where: { id: sessionId, userId, organizationId }, data: { status: MobileSessionStatus.REVOKED, revokedAt: new Date() } }), prisma.mobilePushToken.updateMany({ where: { sessionId, userId, organizationId }, data: { enabled: false } }), prisma.activityLog.create({ data: { organizationId, userId, action: ActivityAction.LOGOUT, entityType: "MobileSession", entityId: sessionId, title: "Native mobile session revoked" } })]);
}

export async function revokeTenantMobileSessionService(input: { sessionId: string; organizationId: string; actorId: string }) {
  const session = await prisma.mobileSession.findFirst({ where: { id: input.sessionId, organizationId: input.organizationId, status: MobileSessionStatus.ACTIVE }, select: { id: true, userId: true, deviceName: true } });
  if (!session) throw new Error("The active mobile device session was not found.");
  await prisma.$transaction([
    prisma.mobileSession.update({ where: { id: session.id }, data: { status: MobileSessionStatus.REVOKED, revokedAt: new Date() } }),
    prisma.mobilePushToken.updateMany({ where: { sessionId: session.id, organizationId: input.organizationId }, data: { enabled: false } }),
    prisma.activityLog.create({ data: { organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.UPDATE, entityType: "MobileSession", entityId: session.id, title: "Tenant administrator revoked a native mobile session", metadata: { deviceName: session.deviceName, sessionUserId: session.userId } } }),
  ]);
}

function validateDevice(input: { codeVerifier: string; deviceId: string; deviceName: string; platform: string }) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier)) throw new MobileAuthError("PKCE code verifier is invalid.", 400, "invalid_request");
  if (!isValidDeviceId(input.deviceId) || !input.deviceName.trim() || input.deviceName.length > 120 || !isMobilePlatform(input.platform)) throw new MobileAuthError("Device registration is invalid.", 400, "invalid_request");
}

function assertMobileUser(user: { isActive: boolean; sessionVersion: number }, organization: { status: OrganizationStatus; subscriptionPlan: keyof typeof planEntitlements; isDemo: boolean }) {
  if (!user.isActive || organization.status !== OrganizationStatus.ACTIVE) throw new MobileAuthError("User or organization is inactive.", 401, "unauthorized");
  if (organization.isDemo || !planEntitlements[organization.subscriptionPlan].MOBILE_APPS) throw new MobileAuthError("Native mobile access requires an active Premium subscription.", 403, "mobile_not_entitled");
}

function issueMobileTokens(session: { id: string; organizationId: string; userId: string; userSessionVersion: number }, user: { id: string; name: string; email: string; role: UserRole; sessionVersion: number }, organizationName: string, refreshToken: string) {
  const access = signMobileAccessToken({ sub: user.id, organizationId: session.organizationId, sessionId: session.id, role: user.role, sessionVersion: user.sessionVersion });
  return { accessToken: access.token, tokenType: "Bearer", expiresIn: access.expiresIn, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }, organization: { id: session.organizationId, name: organizationName } };
}
