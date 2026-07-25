import {
  AiIntelligenceFeedbackRating,
  AiIntelligenceStatus,
  AiIntelligenceUseCase,
  PermissionKey,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";
import { getExecutiveDashboardData } from "@/core/analytics/dashboard.service";
import { getExecutiveReportData } from "@/core/analytics/executive-report.service";
import { getGlobalExecutivePortfolio } from "@/core/analytics/global-executive-dashboard.service";
import { prisma } from "@/lib/prisma";
import { getOperationalAssuranceOverview } from "@/modules/assurance/operational-assurance.service";
import {
  generateEnterpriseAiAnalysisService,
  listEnterpriseAiAnalysesWithSourcesService,
  recordEnterpriseAiFeedbackService,
  reviewEnterpriseAiAnalysisService,
} from "@/modules/intelligence/enterprise-ai.service";

export const mobileExecutiveActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("GENERATE_AI_ANALYSIS"),
    useCase: z.nativeEnum(AiIntelligenceUseCase),
    question: z.string().trim().max(1500).optional(),
  }),
  z.object({
    action: z.literal("REVIEW_AI_ANALYSIS"),
    analysisId: z.string().min(1).max(100),
    decision: z.enum([
      AiIntelligenceStatus.APPROVED,
      AiIntelligenceStatus.REJECTED,
    ]),
    notes: z.string().trim().max(1500).optional(),
  }),
  z.object({
    action: z.literal("RECORD_AI_FEEDBACK"),
    analysisId: z.string().min(1).max(100),
    rating: z.nativeEnum(AiIntelligenceFeedbackRating),
    comment: z.string().trim().max(1500).optional(),
  }),
]);

export class MobileExecutiveActionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export async function getMobileAssignedPermissions(role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) {
    return Object.values(PermissionKey);
  }

  return prisma.rolePermission
    .findMany({
      where: { role },
      select: { permission: true },
    })
    .then((rows) => rows.map((row) => row.permission));
}

export function mobileExecutiveCapabilities(
  permissions: readonly PermissionKey[]
) {
  const allowed = new Set(permissions);
  const canViewDashboard = allowed.has(PermissionKey.VIEW_DASHBOARD);
  const canViewReports = allowed.has(PermissionKey.VIEW_REPORTS);
  const canUseAi =
    canViewDashboard && allowed.has(PermissionKey.USE_AI);

  return {
    canViewDashboard,
    canViewReports,
    canUseAi,
    canReviewAi: canUseAi && canViewReports,
  };
}

export function getMobileExecutiveReportingWindow(now = new Date()) {
  const from = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 11,
      1,
      0,
      0,
      0,
      0
    )
  );
  const to = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  return { from, to };
}

export async function getMobileExecutiveWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: PermissionKey[];
}) {
  const capabilities = mobileExecutiveCapabilities(input.permissions);
  const reportingWindow = getMobileExecutiveReportingWindow();
  const [dashboard, portfolio, assurance, report, analyses] =
    await Promise.all([
      capabilities.canViewDashboard
        ? getExecutiveDashboardData({
            organizationId: input.organizationId,
          })
        : null,
      capabilities.canViewDashboard
        ? getGlobalExecutivePortfolio(
            input.organizationId,
            input.permissions
          )
        : null,
      capabilities.canViewDashboard
        ? getOperationalAssuranceOverview({
            organizationId: input.organizationId,
            permissions: input.permissions,
            limit: 30,
          })
        : null,
      capabilities.canViewReports
        ? getExecutiveReportData({
            organizationId: input.organizationId,
            userId: input.userId,
            from: reportingWindow.from,
            to: reportingWindow.to,
            recordActivity: false,
          })
        : null,
      capabilities.canUseAi
        ? listEnterpriseAiAnalysesWithSourcesService(
            input.organizationId,
            20
          )
        : [],
    ]);

  return {
    generatedAt: new Date().toISOString(),
    capabilities,
    dashboard: dashboard
      ? {
          generatedAt: dashboard.generatedAt.toISOString(),
          kpis: dashboard.kpis,
          charts: dashboard.charts,
          recentIncidents: dashboard.recentIncidents.map((incident) => ({
            id: incident.id,
            title: incident.title,
            status: incident.status,
            riskLevel: incident.riskLevel,
            occurredAt: incident.occurredAt.toISOString(),
            site: incident.site,
            reportedBy: incident.reportedBy,
          })),
          overdueActions: dashboard.recentOverdueActions.map((action) => ({
            id: action.id,
            title: action.title,
            status: action.status,
            riskLevel: action.riskLevel,
            dueDate: action.dueDate.toISOString(),
            assignedTo: action.assignedTo,
            incident: action.incident,
          })),
        }
      : null,
    portfolio: portfolio
      ? {
          attentionCount: portfolio.attentionCount,
          modules: portfolio.modules,
        }
      : null,
    assurance: assurance
      ? {
          generatedAt: assurance.generatedAt.toISOString(),
          signalCount: assurance.signalCount,
          criticalCount: assurance.criticalCount,
          connectionCount: assurance.connectionCount,
          signals: assurance.signals,
          connections: assurance.connections,
        }
      : null,
    report: report
      ? {
          generatedAt: report.generatedAt.toISOString(),
          filters: {
            from: report.filters.from.toISOString(),
            to: report.filters.to.toISOString(),
            siteId: report.filters.siteId,
            siteName: report.filters.siteName,
          },
          summary: report.summary,
          monthlyTrend: report.monthlyTrend,
          sitePerformance: report.sitePerformance.slice(0, 15),
          managementAttention: report.managementAttention
            .slice(0, 30)
            .map((item) => ({
              ...item,
              dueDate: item.dueDate?.toISOString() ?? null,
            })),
        }
      : null,
    aiAnalyses: analyses.map((analysis) => ({
      id: analysis.id,
      title: analysis.title,
      useCase: analysis.useCase,
      question: analysis.question,
      status: analysis.status,
      executiveSummary: analysis.executiveSummary,
      confidence: analysis.confidence,
      confidenceRationale: analysis.confidenceRationale,
      limitations: analysis.limitations,
      reviewNotes: analysis.reviewNotes,
      createdAt: analysis.createdAt.toISOString(),
      reviewedAt: analysis.reviewedAt?.toISOString() ?? null,
      requestedBy: analysis.requestedBy,
      reviewedBy: analysis.reviewedBy,
      sourceCount: analysis._count.sources,
      feedbackCount: analysis._count.feedback,
      sources: analysis.sources,
      detail: normalizeStoredAiDetail(analysis.responsePayload),
    })),
    aiMetrics: capabilities.canUseAi
      ? {
          pending: analyses.filter(
            (analysis) =>
              analysis.status === AiIntelligenceStatus.PENDING_REVIEW
          ).length,
          approved: analyses.filter(
            (analysis) =>
              analysis.status === AiIntelligenceStatus.APPROVED
          ).length,
          rejected: analyses.filter(
            (analysis) =>
              analysis.status === AiIntelligenceStatus.REJECTED
          ).length,
        }
      : null,
  };
}

export async function executeMobileExecutiveAction(input: {
  organizationId: string;
  userId: string;
  permissions: PermissionKey[];
  payload: z.infer<typeof mobileExecutiveActionSchema>;
}) {
  const capabilities = mobileExecutiveCapabilities(input.permissions);

  if (input.payload.action === "GENERATE_AI_ANALYSIS") {
    if (!capabilities.canUseAi) {
      throw new MobileExecutiveActionError(
        "Premium AI Intelligence is not available to your role.",
        403,
        "forbidden"
      );
    }

    const analysis = await generateEnterpriseAiAnalysisService({
      organizationId: input.organizationId,
      userId: input.userId,
      permissions: input.permissions,
      useCase: input.payload.useCase,
      question: input.payload.question,
    });

    return {
      success: true,
      analysisId: analysis.id,
      message:
        "Review-only intelligence was generated and saved for human disposition.",
    };
  }

  if (input.payload.action === "REVIEW_AI_ANALYSIS") {
    if (!capabilities.canReviewAi) {
      throw new MobileExecutiveActionError(
        "Executive report permission is required to review AI intelligence.",
        403,
        "forbidden"
      );
    }

    await reviewEnterpriseAiAnalysisService({
      organizationId: input.organizationId,
      reviewerId: input.userId,
      analysisId: input.payload.analysisId,
      decision: input.payload.decision,
      notes: input.payload.notes,
    });

    return {
      success: true,
      analysisId: input.payload.analysisId,
      message: "Human review decision recorded.",
    };
  }

  if (!capabilities.canUseAi) {
    throw new MobileExecutiveActionError(
      "Premium AI Intelligence is not available to your role.",
      403,
      "forbidden"
    );
  }

  await recordEnterpriseAiFeedbackService({
    organizationId: input.organizationId,
    userId: input.userId,
    analysisId: input.payload.analysisId,
    rating: input.payload.rating,
    comment: input.payload.comment,
  });

  return {
    success: true,
    analysisId: input.payload.analysisId,
    message: "Your intelligence feedback was recorded.",
  };
}

function normalizeStoredAiDetail(value: Prisma.JsonValue) {
  const record = asRecord(value);

  return {
    keyRisks: normalizeAiItems(record?.keyRisks, [
      "title",
      "analysis",
      "severity",
    ]),
    trends: normalizeAiItems(record?.trends, [
      "title",
      "direction",
      "analysis",
    ]),
    priorities: normalizeAiItems(record?.priorities, [
      "title",
      "rationale",
      "urgency",
    ]),
    managementQuestions: normalizeAiItems(record?.managementQuestions, [
      "question",
      "rationale",
    ]),
  };
}

function normalizeAiItems(
  value: unknown,
  fields: readonly string[]
): Array<Record<string, string | string[]>> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const normalized: Record<string, string | string[]> = {};

      for (const field of fields) {
        const fieldValue = record[field];
        if (typeof fieldValue === "string" && fieldValue.trim()) {
          normalized[field] = fieldValue.trim();
        }
      }

      normalized.sourceKeys = Array.isArray(record.sourceKeys)
        ? record.sourceKeys.filter(
            (sourceKey): sourceKey is string =>
              typeof sourceKey === "string"
          )
        : [];

      return fields.every((field) => typeof normalized[field] === "string")
        ? normalized
        : null;
    })
    .filter(
      (item): item is Record<string, string | string[]> => item !== null
    );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
