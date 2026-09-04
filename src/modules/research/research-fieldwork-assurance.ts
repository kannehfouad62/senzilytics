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

export function detectFieldworkLocationClusters<T extends { id: string; latitude: number | null; longitude: number | null; capturedAt: Date; enumeratorId: string }>(responses: T[], radiusM = 25) {
  if (!Number.isFinite(radiusM) || radiusM < 1 || radiusM > 1000) throw new Error("Location-cluster radius must be between 1 and 1,000 metres.");
  const located = responses.filter((item): item is T & { latitude: number; longitude: number } => item.latitude !== null && item.longitude !== null);
  const pairs: Array<{ firstId: string; secondId: string; distanceM: number; sameEnumerator: boolean }> = [];
  for (let first = 0; first < located.length; first += 1) for (let second = first + 1; second < located.length; second += 1) {
    const distanceM = haversineMetres(located[first].latitude, located[first].longitude, located[second].latitude, located[second].longitude);
    if (distanceM <= radiusM) pairs.push({ firstId: located[first].id, secondId: located[second].id, distanceM: Number(distanceM.toFixed(1)), sameEnumerator: located[first].enumeratorId === located[second].enumeratorId });
  }
  return { radiusM, pairs, responseIds: [...new Set(pairs.flatMap((pair) => [pair.firstId, pair.secondId]))] };
}

function haversineMetres(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA), longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function buildInterviewerQuality<T extends FieldworkIntegrityResponse & { enumerator: { name: string } }>(responses: T[], now = new Date()) {
  const groups = new Map<string, T[]>();
  for (const response of responses) groups.set(response.enumeratorId, [...(groups.get(response.enumeratorId) ?? []), response]);
  return [...groups.entries()].map(([enumeratorId, rows]) => {
    const assessed = rows.map((response) => ({ response, integrity: fieldworkIntegritySignals(response, now) }));
    const durations = assessed.map((item) => item.integrity.durationMinutes).sort((a, b) => a - b);
    const middle = Math.floor(durations.length / 2);
    const medianDurationMinutes = durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
    const selected = rows.filter((row) => row.backcheckRequired);
    return {
      enumeratorId,
      name: rows[0].enumerator.name,
      interviews: rows.length,
      medianDurationMinutes: Number(medianDurationMinutes.toFixed(1)),
      averageSyncDelayHours: Number((assessed.reduce((sum, item) => sum + item.integrity.syncDelayHours, 0) / rows.length).toFixed(1)),
      locationCoverage: Number(((rows.filter((row) => row.latitude !== null && row.longitude !== null).length / rows.length) * 100).toFixed(1)),
      backchecksSelected: selected.length,
      backchecksVerified: selected.filter((row) => row.backcheckStatus === "APPROVED").length,
      backchecksRejected: selected.filter((row) => row.backcheckStatus === "REJECTED").length,
      reviewPriority: assessed.filter((item) => item.integrity.risk !== "LOW").length,
    };
  }).sort((a, b) => b.interviews - a.interviews || a.name.localeCompare(b.name));
}
