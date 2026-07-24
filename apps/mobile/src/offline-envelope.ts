import type {
  AssetDefectPayload,
  AssetDefectStatusPayload,
  AssetInspectionPayload,
  AssetMaintenanceCompletionPayload,
  AssetMaintenanceStatusPayload,
  AssetStatusPayload,
  AuditResponsePayload,
  AuditStartPayload,
  CapaStatusPayload,
  ComplianceOccurrenceCompletionPayload,
  ComplianceOccurrenceReviewPayload,
  ContractorStatusPayload,
  HygieneAssessmentStatusPayload,
  HygieneFormsPayload,
  HygieneSamplePayload,
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
  SurveillanceCompletionPayload,
  SurveillanceEnrollmentPayload,
  SurveillanceProgramStatusPayload,
  SurveillanceRemovalPayload,
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
  | "PERMIT_GAS_TEST"
  | "ASSET_STATUS"
  | "ASSET_INSPECTION"
  | "ASSET_DEFECT"
  | "ASSET_DEFECT_STATUS"
  | "ASSET_MAINTENANCE_STATUS"
  | "ASSET_MAINTENANCE_COMPLETE"
  | "CONTRACTOR_STATUS"
  | "IH_ASSESSMENT_STATUS"
  | "IH_SAMPLE"
  | "IH_FORMS"
  | "OH_PROGRAM_STATUS"
  | "OH_ENROLLMENT"
  | "OH_ENROLLMENT_COMPLETE"
  | "OH_ENROLLMENT_REMOVE";

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
  | PermitGasTestPayload
  | AssetStatusPayload
  | AssetInspectionPayload
  | AssetDefectPayload
  | AssetDefectStatusPayload
  | AssetMaintenanceStatusPayload
  | AssetMaintenanceCompletionPayload
  | ContractorStatusPayload
  | HygieneAssessmentStatusPayload
  | HygieneSamplePayload
  | HygieneFormsPayload
  | SurveillanceProgramStatusPayload
  | SurveillanceEnrollmentPayload
  | SurveillanceCompletionPayload
  | SurveillanceRemovalPayload;

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
  "ASSET_STATUS",
  "ASSET_INSPECTION",
  "ASSET_DEFECT",
  "ASSET_DEFECT_STATUS",
  "ASSET_MAINTENANCE_STATUS",
  "ASSET_MAINTENANCE_COMPLETE",
  "CONTRACTOR_STATUS",
  "IH_ASSESSMENT_STATUS",
  "IH_SAMPLE",
  "IH_FORMS",
  "OH_PROGRAM_STATUS",
  "OH_ENROLLMENT",
  "OH_ENROLLMENT_COMPLETE",
  "OH_ENROLLMENT_REMOVE",
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
