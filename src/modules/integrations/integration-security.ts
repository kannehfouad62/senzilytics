import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TOKEN_PATTERN = /^sz_live_([a-f0-9]{12})_([A-Za-z0-9_-]{43})$/;

export function generateApiCredential() {
  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const token = `sz_live_${prefix}_${secret}`;
  return { token, prefix, lastFour: secret.slice(-4), hash: hashApiToken(token) };
}

export function parseApiCredential(token: string) {
  const match = TOKEN_PATTERN.exec(token.trim());
  return match ? { prefix: match[1], token: match[0] } : null;
}

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function secureTokenMatch(token: string, expectedHash: string) {
  const actual = Buffer.from(hashApiToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

function encryptionKey(value = process.env.INTEGRATION_ENCRYPTION_KEY) {
  const configured = value?.trim();
  if (!configured) throw new Error("INTEGRATION_ENCRYPTION_KEY is required to manage or deliver webhooks.");
  const decoded = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  if (decoded.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.");
  return decoded;
}

export function encryptWebhookSecret(secret: string, key?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptWebhookSecret(value: string, key?: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Webhook secret ciphertext is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function signWebhookPayload(secret: string, timestamp: string, body: string) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, timestamp: string, body: string, signature: string) {
  const actual = Buffer.from(signWebhookPayload(secret, timestamp, body));
  const expected = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return !(
      normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("ff") || normalized.startsWith("::ffff:") || normalized.startsWith("64:ff9b:") ||
      normalized.startsWith("2001:db8:") || normalized.startsWith("2002:")
    );
  }
  return false;
}

type HostResolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;

export async function validateWebhookUrl(value: string, resolver: HostResolver = lookup) {
  if (value.length > 2048) throw new Error("Webhook URL is too long.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid webhook URL."); }
  if (url.protocol !== "https:") throw new Error("Webhook URL must use HTTPS.");
  if (url.username || url.password || url.hash) throw new Error("Webhook URL cannot contain credentials or a fragment.");
  if (url.port && url.port !== "443") throw new Error("Webhook URL must use the standard HTTPS port.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Webhook URL must use a public host.");
  const results = await resolver(hostname, { all: true, verbatim: true });
  if (!results.length || results.some((result) => !isPublicAddress(result.address))) throw new Error("Webhook URL resolves to a private or reserved address.");
  return url.toString();
}
