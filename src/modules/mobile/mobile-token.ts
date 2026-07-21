import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { MobilePlatform, UserRole } from "@prisma/client";

export const MOBILE_ACCESS_TTL_SECONDS = 15 * 60;
export const MOBILE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type MobileAccessPayload = {
  iss: "senzilytics";
  aud: "senzilytics-mobile";
  sub: string;
  organizationId: string;
  sessionId: string;
  role: UserRole;
  sessionVersion: number;
  iat: number;
  exp: number;
  jti: string;
};

export function hashMobileToken(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function createMobileOpaqueToken(prefix: "smc" | "sma" | "smr") { return `${prefix}_${randomBytes(32).toString("base64url")}`; }
export function pkceChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }
export function isValidPkceChallenge(value: string) { return /^[A-Za-z0-9_-]{43,128}$/.test(value); }
export function isValidMobileState(value: string) { return /^[A-Za-z0-9._~-]{16,128}$/.test(value); }
export function isValidDeviceId(value: string) { return /^[A-Za-z0-9._:-]{8,160}$/.test(value); }
export function isMobileRedirectUri(value: string) { return value === "senzilytics://auth"; }
export function isMobilePlatform(value: string): value is MobilePlatform { return value === MobilePlatform.IOS || value === MobilePlatform.ANDROID; }

function secret(value = process.env.MOBILE_TOKEN_SECRET) {
  const configured = value?.trim();
  if (!configured || configured.length < 32) throw new Error("MOBILE_TOKEN_SECRET must contain at least 32 characters.");
  return configured;
}

export function signMobileAccessToken(input: Omit<MobileAccessPayload, "iss" | "aud" | "iat" | "exp" | "jti">, signingSecret?: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: MobileAccessPayload = { ...input, iss: "senzilytics", aud: "senzilytics-mobile", iat: now, exp: now + MOBILE_ACCESS_TTL_SECONDS, jti: randomUUID() };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret(signingSecret)).update(`${header}.${body}`).digest("base64url");
  return { token: `${header}.${body}.${signature}`, expiresIn: MOBILE_ACCESS_TTL_SECONDS };
}

export function verifyMobileAccessToken(token: string, signingSecret?: string, nowSeconds = Math.floor(Date.now() / 1000)): MobileAccessPayload | null {
  const [header, body, signature, extra] = token.split(".");
  if (!header || !body || !signature || extra) return null;
  const expected = createHmac("sha256", secret(signingSecret)).update(`${header}.${body}`).digest("base64url");
  const actualBytes = Buffer.from(signature), expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<MobileAccessPayload>;
    const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: unknown; typ?: unknown };
    if (decodedHeader.alg !== "HS256" || decodedHeader.typ !== "JWT" || parsed.iss !== "senzilytics" || parsed.aud !== "senzilytics-mobile" || typeof parsed.sub !== "string" || typeof parsed.organizationId !== "string" || typeof parsed.sessionId !== "string" || typeof parsed.sessionVersion !== "number" || typeof parsed.exp !== "number" || typeof parsed.iat !== "number" || typeof parsed.jti !== "string" || !Object.values(UserRole).includes(parsed.role as UserRole) || parsed.exp <= nowSeconds || parsed.iat > nowSeconds + 60) return null;
    return parsed as MobileAccessPayload;
  } catch { return null; }
}

export function secureHashMatch(value: string, expectedHash: string) {
  const actual = Buffer.from(hashMobileToken(value), "hex"), expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
