import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import type { MobileBootstrap, MobileTokens } from "./types";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://www.senzilytics.cloud").replace(/\/$/, "");
const REFRESH_TOKEN_KEY = "senzilytics.mobile.refresh-token";
const DEVICE_ID_KEY = "senzilytics.mobile.device-id";
let accessToken: string | null = null;

export class MobileApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
}

function randomHex(bytes: number) {
  return Array.from(Crypto.getRandomBytes(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function getDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `${Platform.OS}:${randomHex(24)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { errorDescription?: string; error?: string };
  if (!response.ok) throw new MobileApiError(body.errorDescription || body.error || "The request could not be completed.", response.status, body.error);
  return body as T;
}

export async function beginMobileSignIn() {
  const verifier = randomHex(48);
  const state = randomHex(24);
  const encoded = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
  const codeChallenge = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const redirectUri = "senzilytics://auth";
  const challengeResponse = await fetch(`${API_URL}/api/mobile/auth/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ codeChallenge, state, redirectUri }),
  });
  const challenge = await parseJson<{ authorizeUrl: string }>(challengeResponse);
  const result = await WebBrowser.openAuthSessionAsync(challenge.authorizeUrl, redirectUri);
  if (result.type !== "success" || !result.url) throw new MobileApiError(result.type === "cancel" ? "Sign-in was cancelled." : "Sign-in did not complete.", 400, "authorization_cancelled");
  const parsed = Linking.parse(result.url);
  const returnedState = firstQueryValue(parsed.queryParams?.state);
  const code = firstQueryValue(parsed.queryParams?.code);
  const error = firstQueryValue(parsed.queryParams?.error);
  if (returnedState !== state) throw new MobileApiError("The authorization response could not be verified.", 401, "invalid_state");
  if (error) throw new MobileApiError(error === "access_denied" ? "Mobile access was denied." : "Mobile authorization failed.", 403, error);
  if (!code) throw new MobileApiError("The authorization code is missing.", 401, "invalid_grant");
  const tokenResponse = await fetch(`${API_URL}/api/mobile/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code,
      codeVerifier: verifier,
      deviceId: await getDeviceId(),
      deviceName: Device.deviceName || Device.modelName || `${Platform.OS} device`,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
    }),
  });
  return storeTokens(await parseJson<MobileTokens>(tokenResponse));
}

export async function restoreMobileSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try { return await refreshMobileSession(refreshToken); }
  catch { await clearMobileSession(); return null; }
}

async function refreshMobileSession(refreshToken?: string) {
  const stored = refreshToken || await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!stored) throw new MobileApiError("Sign in is required.", 401, "unauthorized");
  const response = await fetch(`${API_URL}/api/mobile/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grantType: "refresh_token", refreshToken: stored }),
  });
  return storeTokens(await parseJson<MobileTokens>(response));
}

async function storeTokens(tokens: MobileTokens) {
  accessToken = tokens.accessToken;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return tokens;
}

export async function clearMobileSession() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function mobileApi<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!accessToken) await refreshMobileSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers, authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401 && retry) {
    await refreshMobileSession();
    return mobileApi<T>(path, init, false);
  }
  return parseJson<T>(response);
}

export function loadMobileWorkspace() { return mobileApi<MobileBootstrap>("/api/mobile/bootstrap"); }

export async function logoutMobileSession() {
  try { await mobileApi("/api/mobile/auth/logout", { method: "POST" }, false); }
  finally { await clearMobileSession(); }
}

function firstQueryValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
