import type {
  AuditResponsePayload,
  AuditStartPayload,
  CapaStatusPayload,
  ComplianceOccurrenceCompletionPayload,
  ComplianceOccurrenceReviewPayload,
  IncidentPayload,
  InspectionResponsePayload,
  JsaAcknowledgmentPayload,
  MocApprovalDecisionPayload,
  MocStatusPayload,
  MocTaskStatusPayload,
  ObservationPayload,
  PermitControlPayload,
  PermitGasTestPayload,
  PermitStatusPayload,
  RiskCapturePayload,
  RiskReviewPayload,
  TrainingCompletionPayload,
  TrainingProgressPayload,
} from "./types";

export type OfflineRecordType =
  | "SAFETY_OBSERVATION"
  | "INCIDENT"
  | "INSPECTION_RESPONSE"
  | "AUDIT_START"
  | "AUDIT_RESPONSE"
  | "CAPA_STATUS"
  | "RISK_CAPTURE"
  | "RISK_REVIEW"
  | "JSA_ACKNOWLEDGMENT"
  | "COMPLIANCE_COMPLETION"
  | "COMPLIANCE_REVIEW"
  | "TRAINING_PROGRESS"
  | "TRAINING_COMPLETION"
  | "MOC_STATUS"
  | "MOC_APPROVAL_DECISION"
  | "MOC_TASK_STATUS"
  | "PERMIT_STATUS"
  | "PERMIT_CONTROL"
  | "PERMIT_GAS_TEST";

export type OfflineRecordPayload =
  | ObservationPayload
  | IncidentPayload
  | InspectionResponsePayload
  | AuditStartPayload
  | AuditResponsePayload
  | CapaStatusPayload
  | RiskCapturePayload
  | RiskReviewPayload
  | JsaAcknowledgmentPayload
  | ComplianceOccurrenceCompletionPayload
  | ComplianceOccurrenceReviewPayload
  | TrainingProgressPayload
  | TrainingCompletionPayload
  | MocStatusPayload
  | MocApprovalDecisionPayload
  | MocTaskStatusPayload
  | PermitStatusPayload
  | PermitControlPayload
  | PermitGasTestPayload;

export type OfflineEnvelope = {
  type: OfflineRecordType;
  payload: OfflineRecordPayload;
};

const recordTypes = new Set<OfflineRecordType>([
  "SAFETY_OBSERVATION",
  "INCIDENT",
  "INSPECTION_RESPONSE",
  "AUDIT_START",
  "AUDIT_RESPONSE",
  "CAPA_STATUS",
  "RISK_CAPTURE",
  "RISK_REVIEW",
  "JSA_ACKNOWLEDGMENT",
  "COMPLIANCE_COMPLETION",
  "COMPLIANCE_REVIEW",
  "TRAINING_PROGRESS",
  "TRAINING_COMPLETION",
  "MOC_STATUS",
  "MOC_APPROVAL_DECISION",
  "MOC_TASK_STATUS",
  "PERMIT_STATUS",
  "PERMIT_CONTROL",
  "PERMIT_GAS_TEST",
]);

export function decodeOfflineEnvelope(value: unknown): OfflineEnvelope {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    "payload" in value &&
    typeof value.type === "string" &&
    recordTypes.has(value.type as OfflineRecordType)
  ) {
    return {
      type: value.type as OfflineRecordType,
      payload: value.payload as OfflineRecordPayload,
    };
  }

  // Mobile 2.0 stored observations directly in the outbox. Treat those rows as
  // observations so an upgrade never strands previously captured field data.
  return {
    type: "SAFETY_OBSERVATION",
    payload: value as ObservationPayload,
  };
}
