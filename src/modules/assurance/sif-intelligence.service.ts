import { prisma } from "@/lib/prisma";
import {
  inferSifExposureCategory,
  preventionPressureBand,
  scoreWeakSignal,
  weakSignalTrend,
} from "@/modules/assurance/sif-intelligence";
import {
  CriticalControlVerificationResult,
  PermissionKey,
  RiskLevel,
  SifExposureCategory,
  SifSignalClassification,
  SifSignalSourceType,
} from "@prisma/client";

export type SifCandidate = {
  id: string;
  sourceType: SifSignalSourceType;
  sourceId: string;
  sourceLabel: string;
  title: string;
  detail: string;
  href: string;
  siteId: string | null;
  siteName: string | null;
  occurredAt: Date;
  riskLevel: RiskLevel;
  category: SifExposureCategory;
  score: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  review: {
    classification: SifSignalClassification;
    rationale: string;
    controlFailureNotes: string | null;
    reviewedAt: Date;
    reviewedBy: { name: string };
  } | null;
};

const daysBefore = (date: Date, days: number) => new Date(date.getTime() - days * 86400000);

export async function getSifIntelligenceOverview(input: {
  organizationId: string;
  permissions: PermissionKey[];
  now?: Date;
  windowDays?: number;
}) {
  const now = input.now ?? new Date();
  const since = daysBefore(now, input.windowDays ?? 90);
  const currentStart = daysBefore(now, 30);
  const previousStart = daysBefore(now, 60);
  const allowed = new Set(input.permissions);
  const [observations, incidents, auditFindings, inspectionFindings, risks, permits, controlVerifications, reviews, controls] = await Promise.all([
    allowed.has(PermissionKey.VIEW_OBSERVATIONS) ? prisma.safetyObservation.findMany({ where: { organizationId: input.organizationId, observedAt: { gte: since }, type: { not: "POSITIVE_PRACTICE" } }, include: { site: true }, orderBy: { observedAt: "desc" }, take: 100 }) : [],
    allowed.has(PermissionKey.VIEW_INCIDENT) ? prisma.incident.findMany({ where: { site: { organizationId: input.organizationId }, occurredAt: { gte: since } }, include: { site: true, actions: { select: { id: true, status: true, dueDate: true } } }, orderBy: { occurredAt: "desc" }, take: 100 }) : [],
    allowed.has(PermissionKey.VIEW_AUDITS) ? prisma.enterpriseAuditFinding.findMany({ where: { organizationId: input.organizationId, createdAt: { gte: since } }, include: { audit: { include: { site: true } }, correctiveActionLinks: { select: { correctiveActionId: true } } }, orderBy: { createdAt: "desc" }, take: 100 }) : [],
    allowed.has(PermissionKey.VIEW_INSPECTIONS) ? prisma.inspectionFinding.findMany({ where: { inspection: { site: { organizationId: input.organizationId } }, createdAt: { gte: since } }, include: { inspection: { include: { site: true } }, correctiveAction: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 100 }) : [],
    allowed.has(PermissionKey.VIEW_RISKS) ? prisma.risk.findMany({ where: { organizationId: input.organizationId, updatedAt: { gte: since }, status: { notIn: ["CLOSED", "ARCHIVED"] } }, include: { site: true, controls: { select: { id: true, status: true, effectiveness: true, dueDate: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }) : [],
    allowed.has(PermissionKey.VIEW_PERMITS_TO_WORK) ? prisma.permitToWork.findMany({ where: { organizationId: input.organizationId, updatedAt: { gte: since }, OR: [{ status: "SUSPENDED" }, { status: "ACTIVE", plannedEndAt: { lt: now } }, { controls: { some: { isRequired: true, isVerified: false } } }] }, include: { site: true, controls: true }, orderBy: { updatedAt: "desc" }, take: 100 }) : [],
    prisma.criticalControlVerification.findMany({ where: { organizationId: input.organizationId, verifiedAt: { gte: since }, result: { in: [CriticalControlVerificationResult.DEGRADED, CriticalControlVerificationResult.FAILED, CriticalControlVerificationResult.NOT_VERIFIED] } }, include: { control: { include: { site: true } } }, orderBy: { verifiedAt: "desc" }, take: 100 }),
    prisma.sifSignalReview.findMany({ where: { organizationId: input.organizationId }, include: { reviewedBy: { select: { name: true } } } }),
    prisma.criticalControlStandard.findMany({ where: { organizationId: input.organizationId, isActive: true }, include: { site: true, owner: true, verifications: { orderBy: { verifiedAt: "desc" }, take: 1 } }, orderBy: { name: "asc" } }),
  ]);
  const reviewMap = new Map(reviews.map((review) => [`${review.sourceType}:${review.sourceId}`, review]));
  const makeCandidate = (raw: Omit<SifCandidate, "id" | "category" | "score" | "confidence" | "reasons" | "review"> & { text: string; nearMiss?: boolean; overdue?: boolean; repeat?: boolean; missingAction?: boolean; controlResult?: CriticalControlVerificationResult | null }) => {
    const review = reviewMap.get(`${raw.sourceType}:${raw.sourceId}`) ?? null;
    const riskLevel = review?.potentialSeverity ?? raw.riskLevel;
    const scored = scoreWeakSignal({ riskLevel, nearMiss: raw.nearMiss, overdue: raw.overdue, repeat: raw.repeat, missingAction: raw.missingAction, controlResult: raw.controlResult });
    const reviewBoost = review?.classification === SifSignalClassification.POTENTIAL_SIF ? 3 : review?.classification === SifSignalClassification.PRECURSOR ? 1 : 0;
    const score = scored.score + reviewBoost;
    const { text: _text, nearMiss: _nearMiss, overdue: _overdue, repeat: _repeat, missingAction: _missingAction, controlResult: _controlResult, ...candidate } = raw;
    void _text; void _nearMiss; void _overdue; void _repeat; void _missingAction; void _controlResult;
    return { ...candidate, id: `${raw.sourceType}:${raw.sourceId}`, riskLevel, category: review?.exposureCategory ?? inferSifExposureCategory(raw.text), score, confidence: score >= 9 ? "HIGH" as const : score >= 5 ? "MEDIUM" as const : "LOW" as const, reasons: scored.reasons, review: review ? { classification: review.classification, rationale: review.rationale, controlFailureNotes: review.controlFailureNotes, reviewedAt: review.reviewedAt, reviewedBy: review.reviewedBy } : null } satisfies SifCandidate;
  };
  const candidates: SifCandidate[] = [
    ...observations.map((row) => makeCandidate({ sourceType: SifSignalSourceType.OBSERVATION, sourceId: row.id, sourceLabel: "Observation", title: `${row.reference} — ${row.title}`, detail: row.description, text: `${row.title} ${row.description} ${row.immediateAction ?? ""}`, href: `/observations/${row.id}`, siteId: row.siteId, siteName: row.site.name, occurredAt: row.observedAt, riskLevel: row.riskLevel, overdue: Boolean(row.followUpDueDate && row.followUpDueDate < now && !["RESOLVED", "CLOSED"].includes(row.status)), missingAction: row.riskLevel !== RiskLevel.LOW && !row.incidentId })),
    ...incidents.map((row) => makeCandidate({ sourceType: SifSignalSourceType.INCIDENT, sourceId: row.id, sourceLabel: "Incident", title: row.title, detail: row.description, text: `${row.title} ${row.description} ${row.location ?? ""}`, href: `/incidents/${row.id}`, siteId: row.siteId, siteName: row.site.name, occurredAt: row.occurredAt, riskLevel: row.riskLevel, nearMiss: row.type === "NEAR_MISS", overdue: row.actions.some((action) => action.dueDate < now && !["COMPLETED", "CLOSED"].includes(action.status)), missingAction: row.actions.length === 0 })),
    ...auditFindings.map((row) => makeCandidate({ sourceType: SifSignalSourceType.AUDIT_FINDING, sourceId: row.id, sourceLabel: "Audit Finding", title: `${row.reference} — ${row.title}`, detail: row.description ?? "Audit control deficiency", text: `${row.title} ${row.description ?? ""} ${row.objectiveEvidence ?? ""} ${row.standardClause ?? ""}`, href: `/audits/${row.auditId}`, siteId: row.audit.siteId, siteName: row.audit.site.name, occurredAt: row.createdAt, riskLevel: row.severity === "CRITICAL" ? RiskLevel.CRITICAL : row.severity === "HIGH" ? RiskLevel.HIGH : row.severity === "MEDIUM" ? RiskLevel.MEDIUM : RiskLevel.LOW, overdue: Boolean(row.dueDate && row.dueDate < now && !["VERIFIED", "CLOSED", "REJECTED", "CANCELLED"].includes(row.status)), repeat: row.isRepeatFinding, missingAction: !row.correctiveActionLinks.some((link) => link.correctiveActionId) })),
    ...inspectionFindings.map((row) => makeCandidate({ sourceType: SifSignalSourceType.INSPECTION_FINDING, sourceId: row.id, sourceLabel: "Inspection Finding", title: row.title, detail: row.description ?? "Inspection control deficiency", text: `${row.title} ${row.description ?? ""}`, href: `/inspections/${row.inspectionId}`, siteId: row.inspection.siteId, siteName: row.inspection.site.name, occurredAt: row.createdAt, riskLevel: row.riskLevel, overdue: Boolean(row.dueDate && row.dueDate < now && !["COMPLETED", "CLOSED"].includes(row.status)), missingAction: !row.correctiveAction })),
    ...risks.map((row) => makeCandidate({ sourceType: SifSignalSourceType.RISK, sourceId: row.id, sourceLabel: "Risk", title: `${row.reference} — ${row.title}`, detail: row.description, text: `${row.title} ${row.description} ${row.hazardType ?? ""} ${row.process ?? ""}`, href: `/risks/${row.id}`, siteId: row.siteId, siteName: row.site?.name ?? null, occurredAt: row.updatedAt, riskLevel: row.currentRiskLevel, overdue: Boolean(row.nextReviewDate && row.nextReviewDate < now), missingAction: row.controls.length === 0 })),
    ...permits.map((row) => makeCandidate({ sourceType: SifSignalSourceType.PERMIT_TO_WORK, sourceId: row.id, sourceLabel: "Permit to Work", title: `${row.reference} — ${row.title}`, detail: row.status === "SUSPENDED" ? "Work was suspended pending control resolution." : "Permit contains an overdue or unverified critical condition.", text: `${row.title} ${row.hazardsSummary} ${row.controlsSummary} ${row.type}`, href: `/permits-to-work/${row.id}`, siteId: row.siteId, siteName: row.site.name, occurredAt: row.updatedAt, riskLevel: row.status === "SUSPENDED" ? RiskLevel.CRITICAL : RiskLevel.HIGH, overdue: row.plannedEndAt < now, missingAction: row.controls.some((control) => control.isRequired && !control.isVerified) })),
    ...controlVerifications.map((row) => makeCandidate({ sourceType: SifSignalSourceType.CONTROL_VERIFICATION, sourceId: row.id, sourceLabel: "Critical Control", title: `${row.control.code} — ${row.control.name}`, detail: row.findings ?? `${row.result.replaceAll("_", " ")} verification result`, text: `${row.control.name} ${row.control.description ?? ""} ${row.findings ?? ""}`, href: `/assurance/sif/controls/${row.controlId}`, siteId: row.control.siteId, siteName: row.control.site?.name ?? null, occurredAt: row.verifiedAt, riskLevel: row.result === CriticalControlVerificationResult.FAILED ? RiskLevel.CRITICAL : RiskLevel.HIGH, controlResult: row.result, missingAction: !row.correctiveActionId })),
  ];
  const signals = candidates.filter((candidate) => candidate.score >= 3 && candidate.review?.classification !== SifSignalClassification.ROUTINE && candidate.review?.classification !== SifSignalClassification.DISMISSED).sort((a, b) => b.score - a.score || b.occurredAt.getTime() - a.occurredAt.getTime());
  const clusterMap = new Map<string, { siteId: string | null; siteName: string; category: SifExposureCategory; signals: SifCandidate[] }>();
  for (const signal of signals) {
    const key = `${signal.siteId ?? "organization"}:${signal.category}`;
    const cluster = clusterMap.get(key) ?? { siteId: signal.siteId, siteName: signal.siteName ?? "Organization-wide", category: signal.category, signals: [] };
    cluster.signals.push(signal); clusterMap.set(key, cluster);
  }
  const clusters = [...clusterMap.entries()].map(([id, cluster]) => {
    const applicableControls = controls.filter((control) => control.category === cluster.category && (!control.siteId || control.siteId === cluster.siteId));
    const effectiveControls = applicableControls.filter((control) => control.verifications[0]?.result === CriticalControlVerificationResult.EFFECTIVE && control.nextVerificationDueAt >= now).length;
    const failedControls = applicableControls.filter((control) => control.verifications[0]?.result === CriticalControlVerificationResult.FAILED || control.verifications[0]?.result === CriticalControlVerificationResult.DEGRADED).length;
    const score = cluster.signals.reduce((sum, signal) => sum + signal.score, 0);
    const current = cluster.signals.filter((signal) => signal.occurredAt >= currentStart).length;
    const previous = cluster.signals.filter((signal) => signal.occurredAt >= previousStart && signal.occurredAt < currentStart).length;
    return { id, ...cluster, count: cluster.signals.length, score, highConfidence: cluster.signals.filter((signal) => signal.confidence === "HIGH").length, current30Days: current, previous30Days: previous, trend: weakSignalTrend(current, previous), controlCount: applicableControls.length, effectiveControls, failedControls, coveragePercent: applicableControls.length ? Math.round(effectiveControls / applicableControls.length * 100) : 0, pressure: preventionPressureBand({ score, count: cluster.signals.length, failedControls }) };
  }).sort((a, b) => (a.pressure === "CRITICAL" ? -1 : a.pressure === "ELEVATED" ? 0 : 1) - (b.pressure === "CRITICAL" ? -1 : b.pressure === "ELEVATED" ? 0 : 1) || b.score - a.score);
  const controlRows = controls.map((control) => ({ ...control, latestVerification: control.verifications[0] ?? null, isOverdue: control.nextVerificationDueAt < now }));
  const effectiveControls = controlRows.filter((control) => control.latestVerification?.result === CriticalControlVerificationResult.EFFECTIVE && !control.isOverdue).length;
  return {
    generatedAt: now,
    windowDays: input.windowDays ?? 90,
    signals,
    clusters,
    controls: controlRows,
    metrics: {
      activeSignals: signals.length,
      unreviewed: signals.filter((signal) => !signal.review).length,
      highConfidence: signals.filter((signal) => signal.confidence === "HIGH").length,
      potentialSif: reviews.filter((review) => review.classification === SifSignalClassification.POTENTIAL_SIF && review.reviewedAt >= since).length,
      precursors: reviews.filter((review) => review.classification === SifSignalClassification.PRECURSOR && review.reviewedAt >= since).length,
      criticalClusters: clusters.filter((cluster) => cluster.pressure === "CRITICAL").length,
      activeControls: controlRows.length,
      effectiveControls,
      degradedOrFailed: controlRows.filter((control) => control.latestVerification?.result === CriticalControlVerificationResult.DEGRADED || control.latestVerification?.result === CriticalControlVerificationResult.FAILED).length,
      overdueVerifications: controlRows.filter((control) => control.isOverdue).length,
      controlCoveragePercent: controlRows.length ? Math.round(effectiveControls / controlRows.length * 100) : 0,
    },
  };
}

export async function getSifExecutiveMetricsService(organizationId: string, now = new Date()) {
  const since = daysBefore(now, 90);
  const [controls, potentialSif, precursors] = await Promise.all([
    prisma.criticalControlStandard.findMany({ where: { organizationId, isActive: true }, include: { verifications: { orderBy: { verifiedAt: "desc" }, take: 1 } } }),
    prisma.sifSignalReview.count({ where: { organizationId, classification: SifSignalClassification.POTENTIAL_SIF, reviewedAt: { gte: since } } }),
    prisma.sifSignalReview.count({ where: { organizationId, classification: SifSignalClassification.PRECURSOR, reviewedAt: { gte: since } } }),
  ]);
  const failedOrDegraded = controls.filter((control) => control.verifications[0]?.result === CriticalControlVerificationResult.FAILED || control.verifications[0]?.result === CriticalControlVerificationResult.DEGRADED).length;
  const overdueControls = controls.filter((control) => control.nextVerificationDueAt < now).length;
  return { potentialSif, precursors, failedOrDegraded, overdueControls, attentionCount: failedOrDegraded + overdueControls };
}
