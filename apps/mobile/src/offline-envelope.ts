import type {
  IncidentPayload,
  InspectionResponsePayload,
  ObservationPayload,
} from "./types";

export type OfflineRecordType =
  | "SAFETY_OBSERVATION"
  | "INCIDENT"
  | "INSPECTION_RESPONSE";

export type OfflineRecordPayload =
  | ObservationPayload
  | IncidentPayload
  | InspectionResponsePayload;

export type OfflineEnvelope = {
  type: OfflineRecordType;
  payload: OfflineRecordPayload;
};

const recordTypes = new Set<OfflineRecordType>([
  "SAFETY_OBSERVATION",
  "INCIDENT",
  "INSPECTION_RESPONSE",
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
