import { createHash } from "node:crypto";

export type FieldworkIntegrityResponse = {
  id: string;
  enumeratorId: string;
  interviewStartedAt: Date;
  capturedAt: Date;
  synchronizedAt: Date;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  backcheckRequired: boolean;
  backcheckStatus: "PENDING" | "RECONTACT_REQUIRED" | "APPROVED" | "REJECTED";
  backcheckDueAt: Date | null;
};

export function fieldworkIntegritySignals(response: FieldworkIntegrityResponse, now = new Date()) {
  const durationMinutes = Math.max(0, (response.capturedAt.getTime() - response.interviewStartedAt.getTime()) / 60_000);
  const syncDelayHours = Math.max(0, (response.synchronizedAt.getTime() - response.capturedAt.getTime()) / 3_600_000);
  const signals: string[] = [];
  if (durationMinutes < 2) signals.push("VERY_SHORT_INTERVIEW");
  if (syncDelayHours > 72) signals.push("DELAYED_SYNCHRONIZATION");
  if (response.latitude === null || response.longitude === null) signals.push("LOCATION_NOT_CAPTURED");
  else if (response.locationAccuracyM !== null && response.locationAccuracyM > 250) signals.push("LOW_LOCATION_ACCURACY");
  if (response.backcheckRequired && response.backcheckStatus === "PENDING" && response.backcheckDueAt && response.backcheckDueAt < now) signals.push("BACKCHECK_OVERDUE");
  return {
    durationMinutes: Number(durationMinutes.toFixed(1)),
    syncDelayHours: Number(syncDelayHours.toFixed(1)),
    signals,
    risk: signals.includes("BACKCHECK_OVERDUE") || signals.length >= 3 ? "HIGH" as const : signals.length ? "MEDIUM" as const : "LOW" as const,
  };
}

export function selectDeterministicBackcheckSample<T extends { id: string }>(responses: T[], percentage: number, seed: string) {
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) throw new Error("Back-check percentage must be between 1 and 100.");
  const count = Math.min(responses.length, Math.max(1, Math.ceil((responses.length * percentage) / 100)));
  return [...responses]
    .sort((a, b) => createHash("sha256").update(`${seed}:${a.id}`).digest("hex").localeCompare(createHash("sha256").update(`${seed}:${b.id}`).digest("hex")))
    .slice(0, count);
}

export function summarizeFieldworkAssurance<T extends FieldworkIntegrityResponse>(responses: T[], now = new Date()) {
  const assessed = responses.map((response) => ({ response, integrity: fieldworkIntegritySignals(response, now) }));
  return {
    total: responses.length,
    selected: responses.filter((item) => item.backcheckRequired).length,
    pending: responses.filter((item) => item.backcheckRequired && (item.backcheckStatus === "PENDING" || item.backcheckStatus === "RECONTACT_REQUIRED")).length,
    approved: responses.filter((item) => item.backcheckRequired && item.backcheckStatus === "APPROVED").length,
    rejected: responses.filter((item) => item.backcheckRequired && item.backcheckStatus === "REJECTED").length,
    overdue: assessed.filter(({ response, integrity }) => response.backcheckRequired && integrity.signals.includes("BACKCHECK_OVERDUE")).length,
    highRisk: assessed.filter(({ integrity }) => integrity.risk === "HIGH").length,
    locationCaptured: responses.filter((item) => item.latitude !== null && item.longitude !== null).length,
    assessed,
  };
}
