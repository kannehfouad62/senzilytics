import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { mobileApi } from "./api";
import {
  decodeOfflineEnvelope,
  type OfflineRecordPayload,
  type OfflineRecordType,
} from "./offline-envelope";
import { isMobileWorkspaceCacheFresh } from "./session-lifecycle";
import type {
  IncidentPayload,
  InspectionResponsePayload,
  MobileBootstrap,
  ObservationPayload,
} from "./types";

type QueueRow = { id: string; payload: string; captured_at: string };
let database: Promise<SQLite.SQLiteDatabase> | null = null;
const DATABASE_KEY = "senzilytics.mobile.database-key";

async function db() {
  if (!database) database = openEncryptedDatabase();
  return database;
}

async function openEncryptedDatabase() {
  let key = await SecureStore.getItemAsync(DATABASE_KEY);
  if (!key) {
    key = Array.from(Crypto.getRandomBytes(32), (value) => value.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(DATABASE_KEY, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("The encrypted offline store key is invalid.");
  const encrypted = await SQLite.openDatabaseAsync("senzilytics-mobile.db");
  await encrypted.execAsync(`PRAGMA key = '${key}'`);
  return encrypted;
}

export async function initializeOfflineStore() {
  const database = await db();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mobile_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      owner_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS mobile_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

async function queueOfflineItem(
  ownerKey: string,
  type: OfflineRecordType,
  payload: OfflineRecordPayload
) {
  const database = await db();
  const id = Crypto.randomUUID();
  const capturedAt = new Date().toISOString();
  await database.runAsync(
    "INSERT INTO mobile_outbox (id, owner_key, payload, captured_at) VALUES (?, ?, ?, ?)",
    id,
    ownerKey,
    JSON.stringify({ type, payload }),
    capturedAt
  );
  return id;
}

export async function queueObservation(ownerKey: string, payload: ObservationPayload) {
  return queueOfflineItem(ownerKey, "SAFETY_OBSERVATION", payload);
}

export async function queueIncident(ownerKey: string, payload: IncidentPayload) {
  return queueOfflineItem(ownerKey, "INCIDENT", payload);
}

export async function queueInspectionResponse(ownerKey: string, payload: InspectionResponsePayload) {
  return queueOfflineItem(ownerKey, "INSPECTION_RESPONSE", payload);
}

export async function pendingOfflineCount(ownerKey: string) {
  const database = await db();
  const row = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM mobile_outbox WHERE owner_key = ?", ownerKey);
  return row?.count ?? 0;
}

export async function synchronizeOfflineItems(ownerKey: string) {
  const database = await db();
  const rows = await database.getAllAsync<QueueRow>("SELECT id, payload, captured_at FROM mobile_outbox WHERE owner_key = ? ORDER BY captured_at ASC LIMIT 50", ownerKey);
  if (!rows.length) return { synchronized: 0, failed: 0 };
  const items = rows.map((row) => {
    const envelope = decodeOfflineEnvelope(JSON.parse(row.payload));
    return {
      id: row.id,
      type: envelope.type,
      capturedAt: row.captured_at,
      payload: envelope.payload,
    };
  });
  const response = await mobileApi<{ results: Array<{ id: string; status: string; error?: string }> }>("/api/mobile/sync", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  let synchronized = 0;
  for (const result of response.results) {
    if (result.status === "synced" || result.status === "already_synced") {
      await database.runAsync("DELETE FROM mobile_outbox WHERE id = ?", result.id);
      synchronized++;
    } else {
      await database.runAsync("UPDATE mobile_outbox SET last_error = ? WHERE id = ?", (result.error || "Synchronization failed.").slice(0, 1000), result.id);
    }
  }
  return { synchronized, failed: response.results.length - synchronized };
}

export async function cacheWorkspace(ownerKey: string, value: MobileBootstrap, verifiedAt = new Date().toISOString()) {
  const database = await db();
  await database.runAsync("INSERT INTO mobile_cache (cache_key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", `bootstrap:${ownerKey}`, JSON.stringify(value), verifiedAt);
}

export async function readCachedWorkspace(ownerKey: string) {
  const database = await db();
  const row = await database.getFirstAsync<{ value: string; updated_at: string }>("SELECT value, updated_at FROM mobile_cache WHERE cache_key = ?", `bootstrap:${ownerKey}`);
  if (!row || !isMobileWorkspaceCacheFresh(row.updated_at)) return null;
  try { return { workspace: JSON.parse(row.value) as MobileBootstrap, verifiedAt: row.updated_at }; } catch { return null; }
}

export async function clearWorkspaceCache(ownerKey: string) {
  const database = await db();
  await database.runAsync("DELETE FROM mobile_cache WHERE cache_key = ?", `bootstrap:${ownerKey}`);
}
