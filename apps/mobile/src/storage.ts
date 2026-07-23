import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { mobileApi } from "./api";
import { uploadPrivateMobileEvidence } from "./blob-upload";
import type { SelectedEvidence } from "./evidence";
import {
  decodeOfflineEnvelope,
  type OfflineRecordPayload,
  type OfflineRecordType,
} from "./offline-envelope";
import { isMobileWorkspaceCacheFresh } from "./session-lifecycle";
import type {
  AuditResponsePayload,
  AuditStartPayload,
  IncidentPayload,
  InspectionResponsePayload,
  MobileBootstrap,
  ObservationPayload,
} from "./types";

type QueueRow = { id: string; payload: string; captured_at: string };
type EvidenceTargetType =
  | "SAFETY_OBSERVATION"
  | "INCIDENT"
  | "INSPECTION"
  | "AUDIT_QUESTION";
type EvidenceRow = {
  id: string;
  parent_submission_id: string | null;
  target_type: EvidenceTargetType;
  entity_id: string | null;
  question_id: string | null;
  checklist_item_id: string | null;
  title: string;
  description: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  captured_at: string;
  bytes: Uint8Array | ArrayBuffer;
};
type EvidenceQueueInput = {
  files: SelectedEvidence[];
  targetType: EvidenceTargetType;
  parentSubmissionId?: string;
  entityId?: string;
  questionId?: string;
  checklistItemId?: string;
  title: string;
  description?: string;
};
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
    CREATE TABLE IF NOT EXISTS mobile_evidence (
      id TEXT PRIMARY KEY NOT NULL,
      owner_key TEXT NOT NULL,
      parent_submission_id TEXT,
      target_type TEXT NOT NULL,
      entity_id TEXT,
      question_id TEXT,
      checklist_item_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      bytes BLOB NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS mobile_evidence_owner_captured
      ON mobile_evidence(owner_key, captured_at);
  `);
}

async function queueOfflineItem(
  ownerKey: string,
  type: OfflineRecordType,
  payload: OfflineRecordPayload,
  evidence?: Omit<EvidenceQueueInput, "parentSubmissionId">
) {
  const database = await db();
  const id = Crypto.randomUUID();
  const capturedAt = new Date().toISOString();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "INSERT INTO mobile_outbox (id, owner_key, payload, captured_at) VALUES (?, ?, ?, ?)",
      id,
      ownerKey,
      JSON.stringify({ type, payload }),
      capturedAt
    );
    if (evidence?.files.length) {
      await insertEvidence(transaction, ownerKey, {
        ...evidence,
        parentSubmissionId:
          type === "SAFETY_OBSERVATION" || type === "INCIDENT"
            ? id
            : undefined,
      });
    }
  });
  return id;
}

export async function queueObservation(
  ownerKey: string,
  payload: ObservationPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "SAFETY_OBSERVATION", payload, {
    files: evidence,
    targetType: "SAFETY_OBSERVATION",
    title: `Observation evidence: ${payload.title}`,
    description: payload.description,
  });
}

export async function queueIncident(
  ownerKey: string,
  payload: IncidentPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "INCIDENT", payload, {
    files: evidence,
    targetType: "INCIDENT",
    title: `Incident evidence: ${payload.title}`,
    description: payload.description,
  });
}

export async function queueInspectionResponse(
  ownerKey: string,
  payload: InspectionResponsePayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "INSPECTION_RESPONSE", payload, {
    files: evidence,
    targetType: "INSPECTION",
    entityId: payload.inspectionId,
    checklistItemId: payload.checklistItemId,
    title: "Inspection question evidence",
    description: payload.comments,
  });
}

export async function queueAuditStart(ownerKey: string, payload: AuditStartPayload) {
  return queueOfflineItem(ownerKey, "AUDIT_START", payload);
}

export async function queueAuditResponse(
  ownerKey: string,
  payload: AuditResponsePayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "AUDIT_RESPONSE", payload, {
    files: evidence,
    targetType: "AUDIT_QUESTION",
    entityId: payload.auditId,
    questionId: payload.questionId,
    title: "Audit question evidence",
    description: payload.evidenceNote || payload.comments,
  });
}

export async function pendingOfflineCount(ownerKey: string) {
  const database = await db();
  const [outbox, evidence] = await Promise.all([
    database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM mobile_outbox WHERE owner_key = ?",
      ownerKey
    ),
    database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM mobile_evidence WHERE owner_key = ?",
      ownerKey
    ),
  ]);
  return (outbox?.count ?? 0) + (evidence?.count ?? 0);
}

export async function synchronizeOfflineItems(ownerKey: string) {
  const database = await db();
  const rows = await database.getAllAsync<QueueRow>("SELECT id, payload, captured_at FROM mobile_outbox WHERE owner_key = ? ORDER BY captured_at ASC LIMIT 50", ownerKey);
  const decoded = rows.map((row) => ({
    row,
    envelope: decodeOfflineEnvelope(JSON.parse(row.payload)),
  }));
  const parents = decoded.filter(({ envelope }) =>
    envelope.type === "SAFETY_OBSERVATION" ||
    envelope.type === "INCIDENT" ||
    envelope.type === "AUDIT_START"
  );
  const responses = decoded.filter(({ envelope }) =>
    envelope.type === "INSPECTION_RESPONSE" ||
    envelope.type === "AUDIT_RESPONSE"
  );
  const first = await synchronizeRows(database, parents);
  const files = await synchronizeEvidence(database, ownerKey);
  const last = await synchronizeRows(database, responses);
  return {
    synchronized: first.synchronized + files.synchronized + last.synchronized,
    failed: first.failed + files.failed + last.failed,
  };
}

async function insertEvidence(
  transaction: SQLite.SQLiteDatabase,
  ownerKey: string,
  input: EvidenceQueueInput
) {
  const capturedAt = new Date().toISOString();
  for (const file of input.files) {
    await transaction.runAsync(
      `INSERT INTO mobile_evidence (
        id, owner_key, parent_submission_id, target_type, entity_id,
        question_id, checklist_item_id, title, description, file_name,
        mime_type, size_bytes, checksum, captured_at, bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      file.id,
      ownerKey,
      input.parentSubmissionId ?? null,
      input.targetType,
      input.entityId ?? null,
      input.questionId ?? null,
      input.checklistItemId ?? null,
      input.title,
      input.description ?? null,
      file.fileName,
      file.mimeType,
      file.sizeBytes,
      file.checksum,
      capturedAt,
      file.bytes
    );
  }
}

async function synchronizeRows(
  database: SQLite.SQLiteDatabase,
  rows: Array<{ row: QueueRow; envelope: ReturnType<typeof decodeOfflineEnvelope> }>
) {
  if (!rows.length) return { synchronized: 0, failed: 0 };
  const response = await mobileApi<{
    results: Array<{ id: string; status: string; error?: string }>;
  }>("/api/mobile/sync", {
    method: "POST",
    body: JSON.stringify({
      items: rows.map(({ row, envelope }) => ({
        id: row.id,
        type: envelope.type,
        capturedAt: row.captured_at,
        payload: envelope.payload,
      })),
    }),
  });
  let synchronized = 0;
  for (const result of response.results) {
    if (result.status === "synced" || result.status === "already_synced") {
      await database.runAsync("DELETE FROM mobile_outbox WHERE id = ?", result.id);
      synchronized++;
    } else {
      await database.runAsync(
        "UPDATE mobile_outbox SET last_error = ? WHERE id = ?",
        (result.error || "Synchronization failed.").slice(0, 1000),
        result.id
      );
    }
  }
  return {
    synchronized,
    failed: response.results.length - synchronized,
  };
}

async function synchronizeEvidence(
  database: SQLite.SQLiteDatabase,
  ownerKey: string
) {
  const rows = await database.getAllAsync<EvidenceRow>(
    `SELECT id, parent_submission_id, target_type, entity_id, question_id,
      checklist_item_id, title, description, file_name, mime_type,
      size_bytes, checksum, captured_at, bytes
     FROM mobile_evidence
     WHERE owner_key = ?
     ORDER BY captured_at ASC
     LIMIT 25`,
    ownerKey
  );
  let synchronized = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      let synchronizedOnServer = await evidenceSynchronized(row.id);
      if (!synchronizedOnServer) {
        const bytes = row.bytes instanceof Uint8Array
          ? row.bytes
          : new Uint8Array(row.bytes);
        const body = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
        await uploadPrivateMobileEvidence({
          pathname: `mobile-evidence/${row.id}/${row.file_name}`,
          body,
          contentType: row.mime_type,
          clientPayload: JSON.stringify({
            localEvidenceId: row.id,
            targetType: row.target_type,
            parentSubmissionId: row.parent_submission_id || undefined,
            entityId: row.entity_id || undefined,
            questionId: row.question_id || undefined,
            checklistItemId: row.checklist_item_id || undefined,
            title: row.title,
            description: row.description || undefined,
            fileName: row.file_name,
            mimeType: row.mime_type,
            sizeBytes: row.size_bytes,
            checksum: row.checksum,
            capturedAt: row.captured_at,
          }),
        });
        for (let attempt = 0; attempt < 3 && !synchronizedOnServer; attempt++) {
          synchronizedOnServer = await evidenceSynchronized(row.id);
        }
        if (!synchronizedOnServer) {
          throw new Error("Evidence was uploaded and is awaiting secure server registration. Synchronize again shortly.");
        }
      }
      await database.runAsync(
        "DELETE FROM mobile_evidence WHERE id = ?",
        row.id
      );
      synchronized++;
    } catch (error) {
      await database.runAsync(
        "UPDATE mobile_evidence SET last_error = ? WHERE id = ?",
        (error instanceof Error ? error.message : "Evidence synchronization failed.").slice(0, 1000),
        row.id
      );
      failed++;
    }
  }
  return { synchronized, failed };
}

async function evidenceSynchronized(evidenceId: string) {
  return (await mobileApi<{ synchronized: boolean }>(
    `/api/mobile/evidence/upload?evidenceId=${encodeURIComponent(evidenceId)}`
  )).synchronized;
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
