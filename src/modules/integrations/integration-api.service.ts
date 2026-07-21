import { IntegrationApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IntegrationApiError } from "@/modules/integrations/integration.service";

export const integrationResources = {
  incidents: IntegrationApiScope.READ_INCIDENTS,
  actions: IntegrationApiScope.READ_ACTIONS,
  audits: IntegrationApiScope.READ_AUDITS,
  inspections: IntegrationApiScope.READ_INSPECTIONS,
  risks: IntegrationApiScope.READ_RISKS,
  compliance: IntegrationApiScope.READ_COMPLIANCE,
  training: IntegrationApiScope.READ_TRAINING,
  assurance: IntegrationApiScope.READ_ASSURANCE,
} as const;

export type IntegrationResource = keyof typeof integrationResources;

export function parseIntegrationQuery(url: URL) {
  const limitValue = Number(url.searchParams.get("limit") || "50");
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) throw new IntegrationApiError("limit must be an integer between 1 and 100.", 400, "invalid_query");
  const sinceValue = url.searchParams.get("updatedSince");
  const updatedSince = sinceValue ? new Date(sinceValue) : null;
  if (updatedSince && Number.isNaN(updatedSince.getTime())) throw new IntegrationApiError("updatedSince must be an ISO 8601 timestamp.", 400, "invalid_query");
  const cursorValue = url.searchParams.get("cursor");
  let cursor: { updatedAt: Date; id: string } | null = null;
  if (cursorValue) {
    try {
      const parsed = JSON.parse(Buffer.from(cursorValue, "base64url").toString("utf8")) as { updatedAt?: unknown; id?: unknown };
      const cursorDate = new Date(String(parsed.updatedAt));
      if (typeof parsed.id !== "string" || !parsed.id || parsed.id.length > 100 || Number.isNaN(cursorDate.getTime())) throw new Error("invalid");
      cursor = { updatedAt: cursorDate, id: parsed.id };
    } catch { throw new IntegrationApiError("cursor is invalid.", 400, "invalid_query"); }
  }
  return { limit: limitValue, cursor, updatedSince };
}

export async function listIntegrationResource(input: { resource: IntegrationResource; organizationId: string; limit: number; cursor: { updatedAt: Date; id: string } | null; updatedSince: Date | null }) {
  const pagination = { take: input.limit + 1, orderBy: [{ updatedAt: "desc" as const }, { id: "desc" as const }] };
  const updated = input.updatedSince ? { updatedAt: { gte: input.updatedSince } } : {};
  const page = input.cursor ? { OR: [{ updatedAt: { lt: input.cursor.updatedAt } }, { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } }] } : {};
  let rows: Array<Record<string, unknown>>;

  switch (input.resource) {
    case "incidents":
      rows = await prisma.incident.findMany({ where: { site: { organizationId: input.organizationId }, ...updated, ...page }, select: { id: true, title: true, description: true, type: true, riskLevel: true, status: true, location: true, occurredAt: true, siteId: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "actions":
      rows = await prisma.correctiveAction.findMany({ where: { assignedTo: { organizationId: input.organizationId }, ...updated, ...page }, select: { id: true, title: true, description: true, status: true, riskLevel: true, dueDate: true, assignedToId: true, incidentId: true, auditFindingId: true, inspectionFindingId: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "audits":
      rows = await prisma.enterpriseAudit.findMany({ where: { organizationId: input.organizationId, ...updated, ...page }, select: { id: true, reference: true, title: true, description: true, scope: true, status: true, auditType: true, siteId: true, departmentId: true, leadAuditorId: true, scheduledAt: true, dueDate: true, completedAt: true, scorePercentage: true, findingCount: true, openFindingCount: true, overallRiskLevel: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "inspections":
      rows = await prisma.inspection.findMany({ where: { site: { organizationId: input.organizationId }, ...updated, ...page }, select: { id: true, title: true, reference: true, description: true, area: true, type: true, status: true, siteId: true, leadInspectorId: true, scheduledAt: true, dueDate: true, completedAt: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "risks":
      rows = await prisma.risk.findMany({ where: { organizationId: input.organizationId, ...updated, ...page }, select: { id: true, reference: true, title: true, description: true, category: true, hazardType: true, process: true, status: true, siteId: true, departmentId: true, ownerId: true, currentScore: true, currentRiskLevel: true, residualScore: true, residualRiskLevel: true, nextReviewDate: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "compliance":
      rows = await prisma.complianceItem.findMany({ where: { site: { organizationId: input.organizationId }, ...updated, ...page }, select: { id: true, title: true, description: true, status: true, dueDate: true, reference: true, obligationType: true, authority: true, jurisdiction: true, legalReference: true, recurrence: true, ownerId: true, siteId: true, completedAt: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "training":
      rows = await prisma.trainingRecord.findMany({ where: { user: { organizationId: input.organizationId }, ...updated, ...page }, select: { id: true, courseName: true, status: true, dueDate: true, completedAt: true, userId: true, courseId: true, assignedAt: true, expiresAt: true, provider: true, score: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
    case "assurance":
      rows = await prisma.criticalControlStandard.findMany({ where: { organizationId: input.organizationId, ...updated, ...page }, select: { id: true, code: true, name: true, category: true, description: true, performanceStandard: true, verificationFrequencyDays: true, siteId: true, departmentId: true, ownerId: true, isActive: true, nextVerificationDueAt: true, createdAt: true, updatedAt: true }, ...pagination });
      break;
  }

  const hasMore = rows.length > input.limit;
  const data = hasMore ? rows.slice(0, input.limit) : rows;
  const last = data.at(-1);
  const nextCursor = hasMore && last?.id && last.updatedAt ? Buffer.from(JSON.stringify({ id: last.id, updatedAt: last.updatedAt })).toString("base64url") : null;
  return { data, nextCursor };
}
