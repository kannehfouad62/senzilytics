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
const MOBILE_SYNC_RECORD_BATCH_SIZE = 50;
const MOBILE_SYNC_RECORD_WINDOW = 200;
const MOBILE_SYNC_EVIDENCE_WINDOW = 100;

import type {
  AssetDefectPayload,
  AssetDefectStatusPayload,
  AssetInspectionPayload,
  AssetMaintenanceCompletionPayload,
  AssetMaintenanceStatusPayload,
  AssetStatusPayload,
  AuditResponsePayload,
  AuditStartPayload,
  BehaviorFollowUpPayload,
  BehaviorProgramReviewPayload,
  BehaviorRecognitionPayload,
  BehaviorSessionPayload,
  CapaStatusPayload,
  CertificationReviewApprovePayload,
  CertificationReviewCompletePayload,
  ChemicalFormsPayload,
  ChemicalInventoryPayload,
  ChemicalStatusPayload,
  ComplianceOccurrenceCompletionPayload,
  ComplianceOccurrenceReviewPayload,
  ContractorStatusPayload,
  EnvironmentalDataPayload,
  EnvironmentalFormsPayload,
  EnvironmentalReviewPayload,
  EsgDataPayload,
  EsgDisclosureStatusPayload,
  EsgFormsPayload,
  EsgInitiativeStatusPayload,
  HygieneAssessmentStatusPayload,
  HygieneFormsPayload,
  HygieneSamplePayload,
  IncidentPayload,
  InspectionResponsePayload,
  JsaAcknowledgmentPayload,
  MobileBootstrap,
  MocApprovalDecisionPayload,
  MocStatusPayload,
  MocTaskStatusPayload,
  ObservationPayload,
  PermitControlPayload,
  PermitGasTestPayload,
  PermitStatusPayload,
  RegulatoryAssessmentReviewPayload,
  RegulatoryChangeClosePayload,
  RegulatoryChangeReviewPayload,
  RegulatoryImpactAssessmentPayload,
  RegulatoryImplementationPayload,
  RegulatorySourceReviewPayload,
  ResearchFieldworkResponsePayload,
  ResearchInterviewDraft,
  RiskCapturePayload,
  RiskReviewPayload,
  SifSignalReviewPayload,
  SifVerificationPayload,
  SurveillanceCompletionPayload,
  SurveillanceEnrollmentPayload,
  SurveillanceProgramStatusPayload,
  SurveillanceRemovalPayload,
  TrainingCompletionPayload,
  TrainingProgressPayload,
} from "./types";

type QueueRow = { id: string; payload: string; captured_at: string };

export type OfflineOutboxStatus = "PENDING" | "FAILED" | "EVIDENCE_PENDING";

export type OfflineOutboxItem = {
  id: string;
  kind: "record";
  recordType: OfflineRecordType;
  label: string;
  capturedAt: string;
  status: OfflineOutboxStatus;
  attachmentCount: number;
  lastError: string | null;
};

export type OfflineEvidenceItem = {
  id: string;
  kind: "evidence";
  parentSubmissionId: string | null;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
  status: "EVIDENCE_PENDING" | "FAILED";
  lastError: string | null;
};

export type OfflineSyncHistoryItem = {
  id: string;
  itemKind: "record" | "evidence";
  itemId: string;
  label: string;
  outcome: "SYNCED" | "ALREADY_SYNCED" | "FAILED" | "RETRIED" | "DISCARDED";
  occurredAt: string;
  detail: string | null;
};

export type OfflineOutboxSnapshot = {
  records: OfflineOutboxItem[];
  evidence: OfflineEvidenceItem[];
  history: OfflineSyncHistoryItem[];
  pendingCount: number;
  failedCount: number;
};

type OutboxMetadataRow = QueueRow & { last_error: string | null };
type EvidenceMetadataRow = {
  id: string;
  parent_submission_id: string | null;
  target_type: EvidenceTargetType;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  captured_at: string;
  last_error: string | null;
};
type EvidenceTargetType =
  | "SAFETY_OBSERVATION"
  | "INCIDENT"
  | "INSPECTION"
  | "AUDIT_QUESTION"
  | "CORRECTIVE_ACTION"
  | "ASSET_INSPECTION"
  | "ASSET_DEFECT"
  | "ASSET_MAINTENANCE"
  | "INDUSTRIAL_HYGIENE"
  | "CHEMICAL"
  | "ENVIRONMENTAL"
  | "ESG"
  | "BEHAVIOR_SAFETY"
  | "SIF_ASSURANCE"
  | "CERTIFICATION_READINESS"
  | "REGULATORY_CHANGE"
  | "CONFIGURABLE_FORM";
type EvidenceRow = {
  id: string;
  parent_submission_id: string | null;
  target_type: EvidenceTargetType;
  entity_id: string | null;
  question_id: string | null;
  checklist_item_id: string | null;
  form_definition_id: string | null;
  form_version_id: string | null;
  form_field_id: string | null;
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
  formDefinitionId?: string;
  formVersionId?: string;
  formFieldId?: string;
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
      form_definition_id TEXT,
      form_version_id TEXT,
      form_field_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      file_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      bytes BLOB NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS mobile_evidence_owner_captured
      ON mobile_evidence(owner_key, captured_at);
    CREATE TABLE IF NOT EXISTS mobile_research_draft_evidence (
      id TEXT PRIMARY KEY NOT NULL,
      owner_key TEXT NOT NULL,
      assignment_id TEXT NOT NULL,
      collection_id TEXT NOT NULL,
      form_definition_id TEXT NOT NULL,
      form_version_id TEXT NOT NULL,
      form_field_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      bytes BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mobile_research_draft_evidence_owner_assignment
      ON mobile_research_draft_evidence(owner_key, assignment_id, collection_id);
    CREATE TABLE IF NOT EXISTS mobile_sync_history (
      id TEXT PRIMARY KEY NOT NULL,
      owner_key TEXT NOT NULL,
      item_kind TEXT NOT NULL,
      item_id TEXT NOT NULL,
      label TEXT NOT NULL,
      outcome TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS mobile_sync_history_owner_occurred
      ON mobile_sync_history(owner_key, occurred_at);
    CREATE TABLE IF NOT EXISTS mobile_document_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      owner_key TEXT NOT NULL,
      document_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      checksum TEXT,
      downloaded_at TEXT NOT NULL,
      bytes BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mobile_document_cache_owner
      ON mobile_document_cache(owner_key, downloaded_at);
  `);
  const evidenceColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(mobile_evidence)"
  );
  const existingEvidenceColumns = new Set(evidenceColumns.map((column) => column.name));
  for (const [name, definition] of [
    ["form_definition_id", "TEXT"],
    ["form_version_id", "TEXT"],
    ["form_field_id", "TEXT"],
  ] as const) {
    if (!existingEvidenceColumns.has(name)) {
      await database.execAsync(`ALTER TABLE mobile_evidence ADD COLUMN ${name} ${definition}`);
    }
  }
}

async function queueOfflineItem(
  ownerKey: string,
  type: OfflineRecordType,
  payload: OfflineRecordPayload,
  evidence?: Omit<EvidenceQueueInput, "parentSubmissionId"> | Array<Omit<EvidenceQueueInput, "parentSubmissionId">>
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
    const evidenceGroups = evidence ? (Array.isArray(evidence) ? evidence : [evidence]) : [];
    for (const evidenceGroup of evidenceGroups) {
      if (!evidenceGroup.files.length) continue;
      await insertEvidence(transaction, ownerKey, {
        ...evidenceGroup,
        parentSubmissionId:
          evidenceGroup.targetType === "CONFIGURABLE_FORM" ||
          type === "SAFETY_OBSERVATION" ||
          type === "INCIDENT" ||
          type === "CAPA_STATUS" ||
          type === "ASSET_INSPECTION" ||
          type === "ASSET_DEFECT" ||
          type === "ASSET_MAINTENANCE_COMPLETE" ||
          type === "IH_SAMPLE" ||
          type === "ENVIRONMENTAL_DATA" ||
          type === "ESG_DATA" ||
          type === "BEHAVIOR_SESSION" ||
          type === "SIF_VERIFICATION" ||
          type === "CERTIFICATION_REVIEW_COMPLETE"
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
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "SAFETY_OBSERVATION", payload, [
    {
    files: evidence,
    targetType: "SAFETY_OBSERVATION",
    title: `Observation evidence: ${payload.title}`,
    description: payload.description,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
}

export async function queueIncident(
  ownerKey: string,
  payload: IncidentPayload,
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "INCIDENT", payload, [
    {
    files: evidence,
    targetType: "INCIDENT",
    title: `Incident evidence: ${payload.title}`,
    description: payload.description,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
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

export async function queueCapaStatus(
  ownerKey: string,
  payload: CapaStatusPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "CAPA_STATUS", payload, {
    files: evidence,
    targetType: "CORRECTIVE_ACTION",
    entityId: payload.actionId,
    title: `CAPA evidence: ${payload.status.replaceAll("_", " ")}`,
    description: payload.comments,
  });
}

export async function queueRiskCapture(
  ownerKey: string,
  payload: RiskCapturePayload
) {
  return queueOfflineItem(ownerKey, "RISK_CAPTURE", payload);
}

export async function queueRiskReview(
  ownerKey: string,
  payload: RiskReviewPayload
) {
  return queueOfflineItem(ownerKey, "RISK_REVIEW", payload);
}

export async function queueJsaAcknowledgment(
  ownerKey: string,
  payload: JsaAcknowledgmentPayload
) {
  return queueOfflineItem(ownerKey, "JSA_ACKNOWLEDGMENT", payload);
}

export type ConfigurableFormEvidenceInput = {
  files: SelectedEvidence[];
  formDefinitionId: string;
  formVersionId: string;
  formFieldId: string;
  fieldLabel: string;
};

function configurableEvidenceGroups(items: ConfigurableFormEvidenceInput[]) {
  return items.map((item) => ({
    files: item.files,
    targetType: "CONFIGURABLE_FORM" as const,
    formDefinitionId: item.formDefinitionId,
    formVersionId: item.formVersionId,
    formFieldId: item.formFieldId,
    title: `Form evidence: ${item.fieldLabel}`,
    description: "Native configurable-form file field evidence.",
  }));
}

export async function queueResearchFieldworkResponse(
  ownerKey: string,
  payload: ResearchFieldworkResponsePayload,
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(
    ownerKey,
    "RESEARCH_FIELDWORK_RESPONSE",
    payload,
    configurableEvidenceGroups(formEvidence)
  );
}

export async function queueComplianceCompletion(
  ownerKey: string,
  payload: ComplianceOccurrenceCompletionPayload
) {
  return queueOfflineItem(ownerKey, "COMPLIANCE_COMPLETION", payload);
}

export async function queueComplianceReview(
  ownerKey: string,
  payload: ComplianceOccurrenceReviewPayload
) {
  return queueOfflineItem(ownerKey, "COMPLIANCE_REVIEW", payload);
}

export async function queueTrainingProgress(
  ownerKey: string,
  payload: TrainingProgressPayload
) {
  return queueOfflineItem(ownerKey, "TRAINING_PROGRESS", payload);
}

export async function queueTrainingCompletion(
  ownerKey: string,
  payload: TrainingCompletionPayload
) {
  return queueOfflineItem(ownerKey, "TRAINING_COMPLETION", payload);
}

export async function queueMocStatus(
  ownerKey: string,
  payload: MocStatusPayload
) {
  return queueOfflineItem(ownerKey, "MOC_STATUS", payload);
}

export async function queueMocApprovalDecision(
  ownerKey: string,
  payload: MocApprovalDecisionPayload
) {
  return queueOfflineItem(ownerKey, "MOC_APPROVAL_DECISION", payload);
}

export async function queueMocTaskStatus(
  ownerKey: string,
  payload: MocTaskStatusPayload
) {
  return queueOfflineItem(ownerKey, "MOC_TASK_STATUS", payload);
}

export async function queuePermitStatus(
  ownerKey: string,
  payload: PermitStatusPayload
) {
  return queueOfflineItem(ownerKey, "PERMIT_STATUS", payload);
}

export async function queuePermitControl(
  ownerKey: string,
  payload: PermitControlPayload
) {
  return queueOfflineItem(ownerKey, "PERMIT_CONTROL", payload);
}

export async function queuePermitGasTest(
  ownerKey: string,
  payload: PermitGasTestPayload
) {
  return queueOfflineItem(ownerKey, "PERMIT_GAS_TEST", payload);
}

export async function queueAssetStatus(
  ownerKey: string,
  payload: AssetStatusPayload
) {
  return queueOfflineItem(ownerKey, "ASSET_STATUS", payload);
}

export async function queueAssetInspection(
  ownerKey: string,
  payload: AssetInspectionPayload,
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "ASSET_INSPECTION", payload, [
    {
    files: evidence,
    targetType: "ASSET_INSPECTION",
    entityId: payload.assetId,
    title: "Asset inspection evidence",
    description: payload.observations || payload.evidenceReference,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
}

export async function queueAssetDefect(
  ownerKey: string,
  payload: AssetDefectPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "ASSET_DEFECT", payload, {
    files: evidence,
    targetType: "ASSET_DEFECT",
    entityId: payload.assetId,
    title: `Asset defect evidence: ${payload.title}`,
    description: payload.description,
  });
}

export async function queueAssetDefectStatus(
  ownerKey: string,
  payload: AssetDefectStatusPayload
) {
  return queueOfflineItem(ownerKey, "ASSET_DEFECT_STATUS", payload);
}

export async function queueAssetMaintenanceStatus(
  ownerKey: string,
  payload: AssetMaintenanceStatusPayload
) {
  return queueOfflineItem(ownerKey, "ASSET_MAINTENANCE_STATUS", payload);
}

export async function queueAssetMaintenanceCompletion(
  ownerKey: string,
  payload: AssetMaintenanceCompletionPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "ASSET_MAINTENANCE_COMPLETE", payload, {
    files: evidence,
    targetType: "ASSET_MAINTENANCE",
    title: "Asset maintenance completion evidence",
    description: payload.workSummary,
  });
}

export async function queueContractorStatus(
  ownerKey: string,
  payload: ContractorStatusPayload
) {
  return queueOfflineItem(ownerKey, "CONTRACTOR_STATUS", payload);
}

export async function queueHygieneAssessmentStatus(
  ownerKey: string,
  payload: HygieneAssessmentStatusPayload
) {
  return queueOfflineItem(ownerKey, "IH_ASSESSMENT_STATUS", payload);
}

export async function queueHygieneSample(
  ownerKey: string,
  payload: HygieneSamplePayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "IH_SAMPLE", payload, {
    files: evidence,
    targetType: "INDUSTRIAL_HYGIENE",
    entityId: payload.assessmentId,
    title: `Industrial hygiene sample evidence${payload.sampleReference ? `: ${payload.sampleReference}` : ""}`,
    description: payload.notes,
  });
}

export async function queueHygieneForms(
  ownerKey: string,
  payload: HygieneFormsPayload,
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "IH_FORMS", payload, configurableEvidenceGroups(formEvidence));
}

export async function queueSurveillanceProgramStatus(
  ownerKey: string,
  payload: SurveillanceProgramStatusPayload
) {
  return queueOfflineItem(ownerKey, "OH_PROGRAM_STATUS", payload);
}

export async function queueSurveillanceEnrollment(
  ownerKey: string,
  payload: SurveillanceEnrollmentPayload
) {
  return queueOfflineItem(ownerKey, "OH_ENROLLMENT", payload);
}

export async function queueSurveillanceCompletion(
  ownerKey: string,
  payload: SurveillanceCompletionPayload
) {
  return queueOfflineItem(ownerKey, "OH_ENROLLMENT_COMPLETE", payload);
}

export async function queueSurveillanceRemoval(
  ownerKey: string,
  payload: SurveillanceRemovalPayload
) {
  return queueOfflineItem(ownerKey, "OH_ENROLLMENT_REMOVE", payload);
}

export async function queueChemicalInventory(
  ownerKey: string,
  payload: ChemicalInventoryPayload
) {
  return queueOfflineItem(ownerKey, "CHEMICAL_INVENTORY", payload);
}

export async function queueChemicalStatus(
  ownerKey: string,
  payload: ChemicalStatusPayload
) {
  return queueOfflineItem(ownerKey, "CHEMICAL_STATUS", payload);
}

export async function queueChemicalForms(
  ownerKey: string,
  payload: ChemicalFormsPayload,
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "CHEMICAL_FORMS", payload, configurableEvidenceGroups(formEvidence));
}

export async function queueEnvironmentalData(
  ownerKey: string,
  payload: EnvironmentalDataPayload,
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "ENVIRONMENTAL_DATA", payload, [
    {
    files: evidence,
    targetType: "ENVIRONMENTAL",
    title: "Environmental data evidence",
    description: payload.evidenceSummary || payload.notes,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
}

export async function queueEnvironmentalReview(
  ownerKey: string,
  payload: EnvironmentalReviewPayload
) {
  return queueOfflineItem(ownerKey, "ENVIRONMENTAL_REVIEW", payload);
}

export async function queueEnvironmentalForms(
  ownerKey: string,
  payload: EnvironmentalFormsPayload,
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "ENVIRONMENTAL_FORMS", payload, configurableEvidenceGroups(formEvidence));
}

export async function queueChemicalEvidence(
  ownerKey: string,
  chemicalId: string,
  files: SelectedEvidence[],
  title: string,
  description?: string
) {
  const database = await db();
  await database.withExclusiveTransactionAsync((transaction) =>
    insertEvidence(transaction, ownerKey, {
      files,
      targetType: "CHEMICAL",
      entityId: chemicalId,
      title,
      description,
    })
  );
}

export async function queueEnvironmentalEvidence(
  ownerKey: string,
  dataPointId: string,
  files: SelectedEvidence[],
  title: string,
  description?: string
) {
  const database = await db();
  await database.withExclusiveTransactionAsync((transaction) =>
    insertEvidence(transaction, ownerKey, {
      files,
      targetType: "ENVIRONMENTAL",
      entityId: dataPointId,
      title,
      description,
    })
  );
}

export async function queueEsgData(
  ownerKey: string,
  payload: EsgDataPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "ESG_DATA", payload, {
    files: evidence,
    targetType: "ESG",
    title: "ESG disclosure evidence",
    description: payload.evidenceSummary || payload.sourceDescription,
  });
}

export async function queueEsgForms(
  ownerKey: string,
  payload: EsgFormsPayload,
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "ESG_FORMS", payload, configurableEvidenceGroups(formEvidence));
}

export async function queueEsgDisclosureStatus(
  ownerKey: string,
  payload: EsgDisclosureStatusPayload
) {
  return queueOfflineItem(ownerKey, "ESG_DISCLOSURE_STATUS", payload);
}

export async function queueEsgInitiativeStatus(
  ownerKey: string,
  payload: EsgInitiativeStatusPayload
) {
  return queueOfflineItem(ownerKey, "ESG_INITIATIVE_STATUS", payload);
}

export async function queueEsgEvidence(
  ownerKey: string,
  periodId: string,
  files: SelectedEvidence[],
  title: string,
  description?: string
) {
  const database = await db();
  await database.withExclusiveTransactionAsync((transaction) =>
    insertEvidence(transaction, ownerKey, {
      files,
      targetType: "ESG",
      entityId: periodId,
      title,
      description,
    })
  );
}

export async function queueBehaviorSession(
  ownerKey: string,
  payload: BehaviorSessionPayload,
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "BEHAVIOR_SESSION", payload, [
    {
    files: evidence,
    targetType: "BEHAVIOR_SAFETY",
    title: "Behavior coaching evidence",
    description: payload.discussionSummary || payload.immediateAction,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
}

export async function queueBehaviorFollowUp(
  ownerKey: string,
  payload: BehaviorFollowUpPayload
) {
  return queueOfflineItem(ownerKey, "BEHAVIOR_FOLLOW_UP", payload);
}

export async function queueBehaviorRecognition(
  ownerKey: string,
  payload: BehaviorRecognitionPayload
) {
  return queueOfflineItem(ownerKey, "BEHAVIOR_RECOGNITION", payload);
}

export async function queueBehaviorProgramReview(
  ownerKey: string,
  payload: BehaviorProgramReviewPayload
) {
  return queueOfflineItem(ownerKey, "BEHAVIOR_PROGRAM_REVIEW", payload);
}

export async function queueSifVerification(
  ownerKey: string,
  payload: SifVerificationPayload,
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "SIF_VERIFICATION", payload, [
    {
    files: evidence,
    targetType: "SIF_ASSURANCE",
    title: "Critical-control verification evidence",
    description: payload.findings || payload.immediateAction,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
}

export async function queueSifSignalReview(
  ownerKey: string,
  payload: SifSignalReviewPayload
) {
  return queueOfflineItem(ownerKey, "SIF_SIGNAL_REVIEW", payload);
}

export async function queueCertificationReviewComplete(
  ownerKey: string,
  payload: CertificationReviewCompletePayload,
  evidence: SelectedEvidence[] = [],
  formEvidence: ConfigurableFormEvidenceInput[] = []
) {
  return queueOfflineItem(ownerKey, "CERTIFICATION_REVIEW_COMPLETE", payload, [
    {
    files: evidence,
    targetType: "CERTIFICATION_READINESS",
    title: "Management-review evidence",
    description: payload.decisions,
  },
    ...configurableEvidenceGroups(formEvidence),
  ]);
}

export async function queueCertificationReviewApprove(
  ownerKey: string,
  payload: CertificationReviewApprovePayload
) {
  return queueOfflineItem(ownerKey, "CERTIFICATION_REVIEW_APPROVE", payload);
}

export async function queueRegulatorySourceReview(
  ownerKey: string,
  payload: RegulatorySourceReviewPayload
) {
  return queueOfflineItem(ownerKey, "REGULATORY_SOURCE_REVIEW", payload);
}

export async function queueRegulatoryChangeReview(
  ownerKey: string,
  payload: RegulatoryChangeReviewPayload
) {
  return queueOfflineItem(ownerKey, "REGULATORY_CHANGE_REVIEW", payload);
}

export async function queueRegulatoryImpactAssessment(
  ownerKey: string,
  payload: RegulatoryImpactAssessmentPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "REGULATORY_IMPACT_ASSESSMENT", payload, {
    files: evidence,
    targetType: "REGULATORY_CHANGE",
    title: "Regulatory impact assessment evidence",
    description: payload.impactSummary || payload.applicabilityRationale,
  });
}

export async function queueRegulatoryAssessmentReview(
  ownerKey: string,
  payload: RegulatoryAssessmentReviewPayload
) {
  return queueOfflineItem(ownerKey, "REGULATORY_ASSESSMENT_REVIEW", payload);
}

export async function queueRegulatoryImplementation(
  ownerKey: string,
  payload: RegulatoryImplementationPayload,
  evidence: SelectedEvidence[] = []
) {
  return queueOfflineItem(ownerKey, "REGULATORY_IMPLEMENTATION", payload, {
    files: evidence,
    targetType: "REGULATORY_CHANGE",
    title: "Regulatory implementation evidence",
    description: payload.implementationSummary,
  });
}

export async function queueRegulatoryChangeClose(
  ownerKey: string,
  payload: RegulatoryChangeClosePayload
) {
  return queueOfflineItem(ownerKey, "REGULATORY_CHANGE_CLOSE", payload);
}

function classifyOfflineFailure(error: string) {
  const normalized = error.toLowerCase();
  if (
    normalized.includes("role cannot") ||
    normalized.includes("permission") ||
    normalized.includes("not included in this subscription") ||
    normalized.includes("not authorized")
  ) {
    return "Authorization changed. This item cannot synchronize with the current access.";
  }
  return error;
}

async function appendOfflineSyncHistory(
  database: SQLite.SQLiteDatabase,
  ownerKey: string,
  input: Omit<OfflineSyncHistoryItem, "id" | "occurredAt">
) {
  await database.runAsync(
    `INSERT INTO mobile_sync_history (
      id, owner_key, item_kind, item_id, label, outcome, occurred_at, detail
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    Crypto.randomUUID(),
    ownerKey,
    input.itemKind,
    input.itemId,
    input.label,
    input.outcome,
    new Date().toISOString(),
    input.detail
  );
  await database.runAsync(
    `DELETE FROM mobile_sync_history
     WHERE owner_key = ? AND id NOT IN (
       SELECT id FROM mobile_sync_history WHERE owner_key = ?
       ORDER BY occurred_at DESC LIMIT 100
     )`,
    ownerKey,
    ownerKey
  );
}

const offlineRecordLabels: Record<OfflineRecordType, string> = {
  SAFETY_OBSERVATION: "Safety observation", INCIDENT: "Incident",
  INSPECTION_RESPONSE: "Inspection response", AUDIT_START: "Audit start", AUDIT_RESPONSE: "Audit response",
  CAPA_STATUS: "Corrective action", RISK_CAPTURE: "Risk assessment", RISK_REVIEW: "Risk review",
  JSA_ACKNOWLEDGMENT: "JSA/JHA acknowledgment", COMPLIANCE_COMPLETION: "Compliance completion",
  COMPLIANCE_REVIEW: "Compliance review", TRAINING_PROGRESS: "Training progress", TRAINING_COMPLETION: "Training completion",
  MOC_STATUS: "Management of change", MOC_APPROVAL_DECISION: "MOC approval", MOC_TASK_STATUS: "MOC task",
  PERMIT_STATUS: "Permit to work", PERMIT_CONTROL: "Permit control", PERMIT_GAS_TEST: "Permit gas test",
  ASSET_STATUS: "Asset status", ASSET_INSPECTION: "Asset inspection", ASSET_DEFECT: "Asset defect",
  ASSET_DEFECT_STATUS: "Asset defect status", ASSET_MAINTENANCE_STATUS: "Asset maintenance",
  ASSET_MAINTENANCE_COMPLETE: "Asset maintenance completion", CONTRACTOR_STATUS: "Contractor status",
  IH_ASSESSMENT_STATUS: "Hygiene assessment", IH_SAMPLE: "Hygiene sample", IH_FORMS: "Hygiene form",
  OH_PROGRAM_STATUS: "Health surveillance program", OH_ENROLLMENT: "Health surveillance enrollment",
  OH_ENROLLMENT_COMPLETE: "Health surveillance completion", OH_ENROLLMENT_REMOVE: "Health surveillance removal",
  CHEMICAL_INVENTORY: "Chemical inventory", CHEMICAL_STATUS: "Chemical status", CHEMICAL_FORMS: "Chemical form",
  ENVIRONMENTAL_DATA: "Environmental data", ENVIRONMENTAL_REVIEW: "Environmental review", ENVIRONMENTAL_FORMS: "Environmental form",
  ESG_DATA: "ESG data", ESG_FORMS: "ESG form", ESG_DISCLOSURE_STATUS: "ESG disclosure", ESG_INITIATIVE_STATUS: "ESG initiative",
  BEHAVIOR_SESSION: "Behavior coaching session", BEHAVIOR_FOLLOW_UP: "Behavior follow-up",
  BEHAVIOR_RECOGNITION: "Behavior recognition", BEHAVIOR_PROGRAM_REVIEW: "Behavior program review",
  SIF_VERIFICATION: "Critical-control verification", SIF_SIGNAL_REVIEW: "SIF signal review",
  CERTIFICATION_REVIEW_COMPLETE: "Certification review", CERTIFICATION_REVIEW_APPROVE: "Certification approval",
  REGULATORY_SOURCE_REVIEW: "Regulatory source review", REGULATORY_CHANGE_REVIEW: "Regulatory change review",
  REGULATORY_IMPACT_ASSESSMENT: "Regulatory impact assessment", REGULATORY_ASSESSMENT_REVIEW: "Regulatory assessment review",
  REGULATORY_IMPLEMENTATION: "Regulatory implementation", REGULATORY_CHANGE_CLOSE: "Regulatory change closure",
  RESEARCH_FIELDWORK_RESPONSE: "Research fieldwork response",
};

function boundedOfflineError(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

export async function readOfflineOutbox(ownerKey: string): Promise<OfflineOutboxSnapshot> {
  const database = await db();
  const [rows, evidenceRows, historyRows] = await Promise.all([
    database.getAllAsync<OutboxMetadataRow>(
      `SELECT id, payload, captured_at, last_error FROM mobile_outbox
       WHERE owner_key = ? ORDER BY captured_at ASC LIMIT 250`,
      ownerKey
    ),
    database.getAllAsync<EvidenceMetadataRow>(
      `SELECT id, parent_submission_id, target_type, title, file_name, mime_type,
        size_bytes, captured_at, last_error FROM mobile_evidence
       WHERE owner_key = ? ORDER BY captured_at ASC LIMIT 250`,
      ownerKey
    ),
    database.getAllAsync<{
      id: string; item_kind: "record" | "evidence"; item_id: string;
      label: string; outcome: OfflineSyncHistoryItem["outcome"];
      occurred_at: string; detail: string | null;
    }>(
      `SELECT id, item_kind, item_id, label, outcome, occurred_at, detail
       FROM mobile_sync_history WHERE owner_key = ?
       ORDER BY occurred_at DESC LIMIT 50`,
      ownerKey
    ),
  ]);
  const evidenceByParent = new Map<string, number>();
  for (const item of evidenceRows) {
    if (item.parent_submission_id) {
      evidenceByParent.set(item.parent_submission_id, (evidenceByParent.get(item.parent_submission_id) ?? 0) + 1);
    }
  }
  const records = rows.map((row): OfflineOutboxItem => {
    const envelope = decodeOfflineEnvelope(JSON.parse(row.payload));
    const lastError = boundedOfflineError(row.last_error);
    const attachmentCount = evidenceByParent.get(row.id) ?? 0;
    return {
      id: row.id, kind: "record", recordType: envelope.type, label: offlineRecordLabels[envelope.type],
      capturedAt: row.captured_at, status: lastError ? "FAILED" : attachmentCount ? "EVIDENCE_PENDING" : "PENDING",
      attachmentCount, lastError,
    };
  });
  const evidence = evidenceRows.map((row): OfflineEvidenceItem => {
    const lastError = boundedOfflineError(row.last_error);
    return {
      id: row.id, kind: "evidence", parentSubmissionId: row.parent_submission_id, label: row.title,
      fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes, capturedAt: row.captured_at,
      status: lastError ? "FAILED" : "EVIDENCE_PENDING", lastError,
    };
  });
  const history = historyRows.map((row): OfflineSyncHistoryItem => ({
    id: row.id, itemKind: row.item_kind, itemId: row.item_id, label: row.label,
    outcome: row.outcome, occurredAt: row.occurred_at, detail: boundedOfflineError(row.detail),
  }));
  return {
    records, evidence, history, pendingCount: records.length + evidence.length,
    failedCount: records.filter((item) => item.status === "FAILED").length + evidence.filter((item) => item.status === "FAILED").length,
  };
}


export async function retryOfflineOutboxItem(
  ownerKey: string,
  kind: "record" | "evidence",
  id: string
) {
  const database = await db();
  const table = kind === "record" ? "mobile_outbox" : "mobile_evidence";
  const result = await database.runAsync(
    `UPDATE ${table} SET last_error = NULL WHERE id = ? AND owner_key = ?`,
    id,
    ownerKey
  );
  if (!result.changes) {
    throw new Error("The queued item is no longer available for this device user.");
  }
  await appendOfflineSyncHistory(database, ownerKey, {
    itemKind: kind, itemId: id, label: kind === "record" ? "Queued record" : "Queued evidence",
    outcome: "RETRIED", detail: "Manual retry requested.",
  });
}

export async function discardOfflineOutboxItem(
  ownerKey: string,
  kind: "record" | "evidence",
  id: string
) {
  const database = await db();
  if (kind === "evidence") {
    const result = await database.runAsync(
      "DELETE FROM mobile_evidence WHERE id = ? AND owner_key = ?",
      id,
      ownerKey
    );
    if (!result.changes) {
      throw new Error("The queued evidence is no longer available for this device user.");
    }
    await appendOfflineSyncHistory(database, ownerKey, {
      itemKind: "evidence", itemId: id, label: "Queued evidence",
      outcome: "DISCARDED", detail: "Unsynchronized local evidence discarded by the device user.",
    });
    return { discardedRecords: 0, discardedEvidence: 1 };
  }

  let discardedEvidence = 0;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const record = await transaction.getFirstAsync<{ id: string }>(
      "SELECT id FROM mobile_outbox WHERE id = ? AND owner_key = ?",
      id,
      ownerKey
    );
    if (!record) {
      throw new Error("The queued record is no longer available for this device user.");
    }
    const evidence = await transaction.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM mobile_evidence
       WHERE parent_submission_id = ? AND owner_key = ?`,
      id,
      ownerKey
    );
    await transaction.runAsync(
      "DELETE FROM mobile_evidence WHERE parent_submission_id = ? AND owner_key = ?",
      id,
      ownerKey
    );
    await transaction.runAsync(
      "DELETE FROM mobile_outbox WHERE id = ? AND owner_key = ?",
      id,
      ownerKey
    );
    discardedEvidence = evidence?.count ?? 0;
  });
  await appendOfflineSyncHistory(database, ownerKey, {
    itemKind: "record", itemId: id, label: "Queued record", outcome: "DISCARDED",
    detail: discardedEvidence
      ? `Unsynchronized local record and ${discardedEvidence} linked evidence attachment${discardedEvidence === 1 ? "" : "s"} discarded by the device user.`
      : "Unsynchronized local record discarded by the device user.",
  });
  return {
    discardedRecords: 1,
    discardedEvidence,
  };
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
  const rows = await database.getAllAsync<QueueRow>(`SELECT id, payload, captured_at FROM mobile_outbox WHERE owner_key = ? ORDER BY captured_at ASC LIMIT ${MOBILE_SYNC_RECORD_WINDOW}`, ownerKey);
  const decoded = rows.map((row) => ({
    row,
    envelope: decodeOfflineEnvelope(JSON.parse(row.payload)),
  }));
  const parents = decoded.filter(({ envelope }) =>
    envelope.type === "SAFETY_OBSERVATION" ||
    envelope.type === "INCIDENT" ||
    envelope.type === "AUDIT_START" ||
    envelope.type === "RISK_CAPTURE" ||
    envelope.type === "ASSET_INSPECTION" ||
    envelope.type === "ASSET_DEFECT" ||
    envelope.type === "ASSET_MAINTENANCE_COMPLETE" ||
    envelope.type === "IH_SAMPLE" ||
    envelope.type === "ENVIRONMENTAL_DATA" ||
    envelope.type === "ESG_DATA" ||
    envelope.type === "BEHAVIOR_SESSION" ||
    envelope.type === "SIF_VERIFICATION" ||
    envelope.type === "CERTIFICATION_REVIEW_COMPLETE" ||
    envelope.type === "REGULATORY_IMPACT_ASSESSMENT" ||
    envelope.type === "REGULATORY_IMPLEMENTATION"
  );
  const responses = decoded.filter(({ envelope }) =>
    envelope.type === "INSPECTION_RESPONSE" ||
    envelope.type === "AUDIT_RESPONSE" ||
    envelope.type === "CAPA_STATUS" ||
    envelope.type === "RISK_REVIEW" ||
    envelope.type === "JSA_ACKNOWLEDGMENT" ||
    envelope.type === "COMPLIANCE_COMPLETION" ||
    envelope.type === "COMPLIANCE_REVIEW" ||
    envelope.type === "TRAINING_PROGRESS" ||
    envelope.type === "TRAINING_COMPLETION" ||
    envelope.type === "MOC_STATUS" ||
    envelope.type === "MOC_APPROVAL_DECISION" ||
    envelope.type === "MOC_TASK_STATUS" ||
    envelope.type === "PERMIT_STATUS" ||
    envelope.type === "PERMIT_CONTROL" ||
    envelope.type === "PERMIT_GAS_TEST" ||
    envelope.type === "ASSET_STATUS" ||
    envelope.type === "ASSET_DEFECT_STATUS" ||
    envelope.type === "ASSET_MAINTENANCE_STATUS" ||
    envelope.type === "CONTRACTOR_STATUS" ||
    envelope.type === "IH_ASSESSMENT_STATUS" ||
    envelope.type === "IH_FORMS" ||
    envelope.type === "OH_PROGRAM_STATUS" ||
    envelope.type === "OH_ENROLLMENT" ||
    envelope.type === "OH_ENROLLMENT_COMPLETE" ||
    envelope.type === "OH_ENROLLMENT_REMOVE" ||
    envelope.type === "CHEMICAL_INVENTORY" ||
    envelope.type === "CHEMICAL_STATUS" ||
    envelope.type === "CHEMICAL_FORMS" ||
    envelope.type === "ENVIRONMENTAL_REVIEW" ||
    envelope.type === "ENVIRONMENTAL_FORMS" ||
    envelope.type === "ESG_FORMS" ||
    envelope.type === "ESG_DISCLOSURE_STATUS" ||
    envelope.type === "ESG_INITIATIVE_STATUS" ||
    envelope.type === "BEHAVIOR_FOLLOW_UP" ||
    envelope.type === "BEHAVIOR_RECOGNITION" ||
    envelope.type === "BEHAVIOR_PROGRAM_REVIEW" ||
    envelope.type === "SIF_SIGNAL_REVIEW" ||
    envelope.type === "CERTIFICATION_REVIEW_APPROVE" ||
    envelope.type === "REGULATORY_SOURCE_REVIEW" ||
    envelope.type === "REGULATORY_CHANGE_REVIEW" ||
    envelope.type === "REGULATORY_ASSESSMENT_REVIEW" ||
    envelope.type === "REGULATORY_CHANGE_CLOSE"
  );
  const first = await synchronizeRows(database, ownerKey, parents);
  const files = await synchronizeEvidence(database, ownerKey);
  const pendingEvidenceParents = new Set(
    (await database.getAllAsync<{ parent_submission_id: string }>(
      `SELECT DISTINCT parent_submission_id
       FROM mobile_evidence
       WHERE owner_key = ? AND parent_submission_id IS NOT NULL`,
      ownerKey
    )).map((row) => row.parent_submission_id)
  );
  const last = await synchronizeRows(
    database,
    ownerKey,
    responses.filter(({ row }) => !pendingEvidenceParents.has(row.id))
  );
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
        question_id, checklist_item_id, form_definition_id, form_version_id,
        form_field_id, title, description, file_name, mime_type, size_bytes,
        checksum, captured_at, bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      file.id,
      ownerKey,
      input.parentSubmissionId ?? null,
      input.targetType,
      input.entityId ?? null,
      input.questionId ?? null,
      input.checklistItemId ?? null,
      input.formDefinitionId ?? null,
      input.formVersionId ?? null,
      input.formFieldId ?? null,
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
  ownerKey: string,
  rows: Array<{ row: QueueRow; envelope: ReturnType<typeof decodeOfflineEnvelope> }>
) {
  if (!rows.length) return { synchronized: 0, failed: 0 };
  let synchronized = 0;
  let failed = 0;
  for (let offset = 0; offset < rows.length; offset += MOBILE_SYNC_RECORD_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + MOBILE_SYNC_RECORD_BATCH_SIZE);
    const response = await mobileApi<{
      results: Array<{ id: string; status: string; error?: string }>;
    }>("/api/mobile/sync", {
      method: "POST",
      body: JSON.stringify({
        items: batch.map(({ row, envelope }) => ({
          id: row.id,
          type: envelope.type,
          capturedAt: row.captured_at,
          payload: envelope.payload,
        })),
      }),
    });
    for (const result of response.results) {
    const queued = rows.find(({ row }) => row.id === result.id);
    const label = queued ? offlineRecordLabels[queued.envelope.type] : "Queued record";
    if (result.status === "synced" || result.status === "already_synced") {
      await database.runAsync("DELETE FROM mobile_outbox WHERE id = ? AND owner_key = ?", result.id, ownerKey);
      await appendOfflineSyncHistory(database, ownerKey, {
        itemKind: "record", itemId: result.id, label,
        outcome: result.status === "already_synced" ? "ALREADY_SYNCED" : "SYNCED",
        detail: result.status === "already_synced"
          ? "Server idempotency confirmed this submission was already synchronized."
          : null,
      });
      synchronized++;
    } else {
      const error = classifyOfflineFailure(result.error || "Synchronization failed.");
      await database.runAsync(
        "UPDATE mobile_outbox SET last_error = ? WHERE id = ? AND owner_key = ?",
        error.slice(0, 1000),
        result.id,
        ownerKey
      );
      await appendOfflineSyncHistory(database, ownerKey, {
        itemKind: "record", itemId: result.id, label, outcome: "FAILED", detail: error,
      });
      failed++;
    }
    }
  }
  return { synchronized, failed };
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
     LIMIT ${MOBILE_SYNC_EVIDENCE_WINDOW}`,
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
            formDefinitionId: row.form_definition_id || undefined,
            formVersionId: row.form_version_id || undefined,
            formFieldId: row.form_field_id || undefined,
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
        "DELETE FROM mobile_evidence WHERE id = ? AND owner_key = ?",
        row.id,
        ownerKey
      );
      await appendOfflineSyncHistory(database, ownerKey, {
        itemKind: "evidence", itemId: row.id, label: row.title,
        outcome: "SYNCED", detail: "Private evidence upload and secure server registration confirmed.",
      });
      synchronized++;
    } catch (error) {
      const detail = classifyOfflineFailure(
        error instanceof Error ? error.message : "Evidence synchronization failed."
      );
      await database.runAsync(
        "UPDATE mobile_evidence SET last_error = ? WHERE id = ? AND owner_key = ?",
        detail.slice(0, 1000),
        row.id,
        ownerKey
      );
      await appendOfflineSyncHistory(database, ownerKey, {
        itemKind: "evidence", itemId: row.id, label: row.title, outcome: "FAILED", detail,
      });
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
  const cacheKey = `bootstrap:${ownerKey}`;
  const row = await database.getFirstAsync<{ value: string; updated_at: string }>(
    "SELECT value, updated_at FROM mobile_cache WHERE cache_key = ?",
    cacheKey
  );
  if (!row) return null;
  if (!isMobileWorkspaceCacheFresh(row.updated_at)) {
    await database.runAsync("DELETE FROM mobile_cache WHERE cache_key = ?", cacheKey);
    return null;
  }
  try {
    return { workspace: JSON.parse(row.value) as MobileBootstrap, verifiedAt: row.updated_at };
  } catch {
    await database.runAsync("DELETE FROM mobile_cache WHERE cache_key = ?", cacheKey);
    return null;
  }
}

export async function clearWorkspaceCache(ownerKey: string) {
  const database = await db();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "DELETE FROM mobile_cache WHERE cache_key = ?",
      `bootstrap:${ownerKey}`
    );
    await transaction.runAsync(
      "DELETE FROM mobile_document_cache WHERE owner_key = ?",
      ownerKey
    );
  });
}

const researchDraftKey = (ownerKey: string, sampleUnitId: string) => `research-draft:${ownerKey}:${sampleUnitId}`;

export async function saveResearchInterviewDraftEvidence(
  ownerKey: string,
  assignmentId: string,
  collectionId: string,
  evidence: ConfigurableFormEvidenceInput[]
) {
  const database = await db();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "DELETE FROM mobile_research_draft_evidence WHERE owner_key = ? AND assignment_id = ? AND collection_id = ?",
      ownerKey, assignmentId, collectionId
    );
    for (const group of evidence) {
      for (const file of group.files) {
        await transaction.runAsync(
          `INSERT INTO mobile_research_draft_evidence
           (id, owner_key, assignment_id, collection_id, form_definition_id, form_version_id, form_field_id,
            file_name, kind, mime_type, size_bytes, checksum, captured_at, bytes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          file.id, ownerKey, assignmentId, collectionId, group.formDefinitionId, group.formVersionId,
          group.formFieldId, file.fileName, file.kind, file.mimeType, file.sizeBytes, file.checksum, new Date().toISOString(), file.bytes
        );
      }
    }
  });
}

export async function readResearchInterviewDraftEvidence(
  ownerKey: string,
  assignmentId: string,
  collectionId: string
): Promise<Record<string, SelectedEvidence[]>> {
  const database = await db();
  const rows = await database.getAllAsync<{
    id: string; form_field_id: string; file_name: string; kind: SelectedEvidence["kind"]; mime_type: string;
    size_bytes: number; checksum: string; captured_at: string; bytes: Uint8Array;
  }>(
    `SELECT id, form_field_id, file_name, kind, mime_type, size_bytes, checksum, captured_at, bytes
     FROM mobile_research_draft_evidence
     WHERE owner_key = ? AND assignment_id = ? AND collection_id = ?
     ORDER BY captured_at ASC`,
    ownerKey, assignmentId, collectionId
  );
  const result: Record<string, SelectedEvidence[]> = {};
  for (const row of rows) {
    (result[row.form_field_id] ??= []).push({
      id: row.id, fileName: row.file_name, kind: row.kind, mimeType: row.mime_type,
      sizeBytes: row.size_bytes, checksum: row.checksum, bytes: row.bytes,
    });
  }
  return result;
}

export async function clearResearchInterviewDraftEvidence(
  ownerKey: string,
  assignmentId: string,
  collectionId?: string
) {
  const database = await db();
  if (collectionId) {
    await database.runAsync(
      "DELETE FROM mobile_research_draft_evidence WHERE owner_key = ? AND assignment_id = ? AND collection_id = ?",
      ownerKey, assignmentId, collectionId
    );
  } else {
    await database.runAsync(
      "DELETE FROM mobile_research_draft_evidence WHERE owner_key = ? AND assignment_id = ?",
      ownerKey, assignmentId
    );
  }
}

export async function saveResearchInterviewDraft(ownerKey: string, sampleUnitId: string, draft: ResearchInterviewDraft) {
  const database = await db();
  await database.runAsync("INSERT INTO mobile_cache (cache_key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", researchDraftKey(ownerKey, sampleUnitId), JSON.stringify(draft), draft.updatedAt);
}

export async function readResearchInterviewDraft(ownerKey: string, sampleUnitId: string) {
  const database = await db();
  const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM mobile_cache WHERE cache_key = ?", researchDraftKey(ownerKey, sampleUnitId));
  if (!row) return null;
  try { return JSON.parse(row.value) as ResearchInterviewDraft; } catch { return null; }
}

export async function clearResearchInterviewDraft(ownerKey: string, sampleUnitId: string) {
  const database = await db();
  await database.runAsync("DELETE FROM mobile_cache WHERE cache_key = ?", researchDraftKey(ownerKey, sampleUnitId));
}

export async function cacheControlledDocument(
  ownerKey: string,
  input: {
    documentId: string;
    fileName: string;
    mimeType: string;
    checksum?: string | null;
    bytes: Uint8Array;
  }
) {
  const database = await db();
  await database.runAsync(
    `INSERT INTO mobile_document_cache (
      cache_key, owner_key, document_id, file_name, mime_type,
      checksum, downloaded_at, bytes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      checksum = excluded.checksum,
      downloaded_at = excluded.downloaded_at,
      bytes = excluded.bytes`,
    `document:${ownerKey}:${input.documentId}`,
    ownerKey,
    input.documentId,
    input.fileName,
    input.mimeType,
    input.checksum ?? null,
    new Date().toISOString(),
    input.bytes
  );
}

export async function readCachedControlledDocument(
  ownerKey: string,
  documentId: string
) {
  const database = await db();
  return database.getFirstAsync<{
    file_name: string;
    mime_type: string;
    checksum: string | null;
    downloaded_at: string;
    bytes: Uint8Array | ArrayBuffer;
  }>(
    `SELECT file_name, mime_type, checksum, downloaded_at, bytes
     FROM mobile_document_cache
     WHERE cache_key = ? AND owner_key = ?`,
    `document:${ownerKey}:${documentId}`,
    ownerKey
  );
}

export async function cachedControlledDocumentIds(ownerKey: string) {
  const database = await db();
  const rows = await database.getAllAsync<{ document_id: string }>(
    "SELECT document_id FROM mobile_document_cache WHERE owner_key = ?",
    ownerKey
  );
  return rows.map((row) => row.document_id);
}

export async function removeCachedControlledDocument(
  ownerKey: string,
  documentId: string
) {
  const database = await db();
  await database.runAsync(
    "DELETE FROM mobile_document_cache WHERE cache_key = ? AND owner_key = ?",
    `document:${ownerKey}:${documentId}`,
    ownerKey
  );
}

export async function clearCachedControlledDocuments(ownerKey: string) {
  const database = await db();
  await database.runAsync(
    "DELETE FROM mobile_document_cache WHERE owner_key = ?",
    ownerKey
  );
}
