import {
  PermissionKey,
  RegulatoryAssessmentStatus,
  RegulatoryChangeStatus,
  RegulatorySourceStatus,
} from "@prisma/client";
import { getRegulatoryIntelligenceDashboardService } from "@/modules/compliance/regulatory-intelligence.service";

export function mobileRegulatoryCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canView: granted.has(PermissionKey.VIEW_COMPLIANCE),
    canManage: granted.has(PermissionKey.MANAGE_COMPLIANCE),
  };
}

export async function getMobileRegulatoryIntelligenceWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileRegulatoryCapabilities(input.permissions);
  if (!capabilities.canView) {
    return {
      capabilities,
      generatedAt: input.now ?? new Date(),
      metrics: null,
      sources: [],
      changes: [],
    };
  }

  const now = input.now ?? new Date();
  const dashboard = await getRegulatoryIntelligenceDashboardService(
    input.organizationId,
    now
  );
  const recentCutoff = new Date(now.getTime() - 180 * 86_400_000);

  return {
    capabilities,
    generatedAt: now,
    metrics: dashboard.metrics,
    sources: dashboard.sources
      .filter(
        (source) =>
          source.status !== RegulatorySourceStatus.RETIRED ||
          source.updatedAt >= recentCutoff
      )
      .slice(0, 150)
      .map((source) => ({
        id: source.id,
        code: source.code,
        name: source.name,
        authority: source.authority,
        type: source.type,
        jurisdiction: source.jurisdiction,
        sourceUrl: source.sourceUrl,
        description: source.description,
        status: source.status,
        reviewCadenceDays: source.reviewCadenceDays,
        lastReviewedAt: source.lastReviewedAt,
        nextReviewAt: source.nextReviewAt,
        owner: { id: source.owner.id, name: source.owner.name },
        changeCount: source._count.changes,
        obligationCount: source._count.obligations,
        isReviewOverdue:
          source.status === RegulatorySourceStatus.ACTIVE &&
          source.nextReviewAt < now,
        canReview:
          capabilities.canManage &&
          source.status !== RegulatorySourceStatus.RETIRED,
      })),
    changes: dashboard.changes
      .filter(
        (change) =>
          change.status !== RegulatoryChangeStatus.CLOSED ||
          change.updatedAt >= recentCutoff
      )
      .slice(0, 200)
      .map((change) => {
        const latestAssessment = change.assessments[0] ?? null;
        const pendingAssessment =
          latestAssessment?.status === RegulatoryAssessmentStatus.SUBMITTED
            ? latestAssessment
            : null;
        return {
          id: change.id,
          reference: change.reference,
          title: change.title,
          summary: change.summary,
          type: change.type,
          status: change.status,
          significance: change.significance,
          sourceUrl: change.sourceUrl,
          citation: change.citation,
          publishedAt: change.publishedAt,
          effectiveAt: change.effectiveAt,
          detectedAt: change.detectedAt,
          assessmentDueAt: change.assessmentDueAt,
          implementationSummary: change.implementationSummary,
          implementedAt: change.implementedAt,
          closeRationale: change.closeRationale,
          closedAt: change.closedAt,
          owner: { id: change.owner.id, name: change.owner.name },
          isOwner: change.owner.id === input.userId,
          source: {
            id: change.source.id,
            code: change.source.code,
            name: change.source.name,
            authority: change.source.authority,
            jurisdiction: change.source.jurisdiction,
          },
          latestAssessment: latestAssessment
            ? {
                id: latestAssessment.id,
                status: latestAssessment.status,
                decision: latestAssessment.decision,
                applicabilityRationale:
                  latestAssessment.applicabilityRationale,
                impactSummary: latestAssessment.impactSummary,
                gapSummary: latestAssessment.gapSummary,
                requiredActions: latestAssessment.requiredActions,
                implementationDueAt:
                  latestAssessment.implementationDueAt,
                submittedAt: latestAssessment.submittedAt,
                reviewedAt: latestAssessment.reviewedAt,
                reviewNotes: latestAssessment.reviewNotes,
              }
            : null,
          obligationCount: change.obligationLinks.length,
          actions: change.actionLinks.map((link) => ({
            id: link.correctiveAction.id,
            title: link.correctiveAction.title,
            status: link.correctiveAction.status,
            riskLevel: link.correctiveAction.riskLevel,
            dueDate: link.correctiveAction.dueDate,
          })),
          isAssessmentOverdue:
            new Set<RegulatoryChangeStatus>([
              RegulatoryChangeStatus.DETECTED,
              RegulatoryChangeStatus.UNDER_REVIEW,
              RegulatoryChangeStatus.IMPACT_ASSESSMENT,
            ]).has(change.status) && change.assessmentDueAt < now,
          canStartReview:
            capabilities.canManage &&
            change.status === RegulatoryChangeStatus.DETECTED,
          canSubmitAssessment:
            capabilities.canManage &&
            (
              change.status === RegulatoryChangeStatus.DETECTED ||
              change.status === RegulatoryChangeStatus.UNDER_REVIEW
            ) &&
            !pendingAssessment,
          canReviewAssessment:
            capabilities.canManage &&
            change.status === RegulatoryChangeStatus.IMPACT_ASSESSMENT &&
            Boolean(pendingAssessment),
          canImplement:
            capabilities.canManage &&
            change.status === RegulatoryChangeStatus.ACTION_REQUIRED,
          canClose:
            capabilities.canManage &&
            (
              change.status === RegulatoryChangeStatus.IMPLEMENTED ||
              change.status === RegulatoryChangeStatus.NOT_APPLICABLE
            ),
        };
      }),
  };
}
