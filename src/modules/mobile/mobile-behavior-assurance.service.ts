import {
  BehaviorFollowUpStatus,
  BehaviorProgramStatus,
  CertificationManagementReviewStatus,
  ConfigurableFormModule,
  PermissionKey,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBehaviorProgramNextStatuses } from "@/modules/behavior-safety/behavior-safety-lifecycle";
import { getCertificationPortfolioService } from "@/modules/assurance/certification-readiness.service";
import { getSifIntelligenceOverview } from "@/modules/assurance/sif-intelligence.service";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";

export function mobileBehaviorAssuranceCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canViewBehavior: granted.has(PermissionKey.VIEW_BEHAVIOR_SAFETY),
    canRecordBehavior: granted.has(PermissionKey.RECORD_BEHAVIOR_COACHING),
    canManageBehavior: granted.has(PermissionKey.MANAGE_BEHAVIOR_SAFETY),
    canViewSif: granted.has(PermissionKey.VIEW_SIF_INTELLIGENCE),
    canManageCriticalControls: granted.has(
      PermissionKey.MANAGE_CRITICAL_CONTROLS
    ),
    canViewCertification: granted.has(
      PermissionKey.VIEW_CERTIFICATION_READINESS
    ),
    canManageCertification: granted.has(
      PermissionKey.MANAGE_CERTIFICATION_READINESS
    ),
  };
}

export async function getMobileBehaviorAssuranceWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileBehaviorAssuranceCapabilities(input.permissions);
  const now = input.now ?? new Date();
  const recentCutoff = new Date(now.getTime() - 90 * 86_400_000);
  const canOperate =
    capabilities.canRecordBehavior ||
    capabilities.canManageCriticalControls ||
    capabilities.canManageCertification;

  const [
    behaviorPrograms,
    behaviorForms,
    sifOverview,
    sifForms,
    certificationPortfolio,
    certificationForms,
    people,
  ] = await Promise.all([
    capabilities.canViewBehavior
      ? prisma.behaviorSafetyProgram.findMany({
          where: {
            organizationId: input.organizationId,
            OR: [
              { status: { not: BehaviorProgramStatus.ARCHIVED } },
              { updatedAt: { gte: recentCutoff } },
            ],
          },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            objective: true,
            status: true,
            targetSessionsPerMonth: true,
            effectiveFrom: true,
            effectiveTo: true,
            nextReviewAt: true,
            site: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true } },
            behaviors: {
              where: { isActive: true },
              select: {
                id: true,
                code: true,
                title: true,
                category: true,
                prompt: true,
                safeDescription: true,
                atRiskDescription: true,
                isCritical: true,
                sequence: true,
              },
              orderBy: [{ sequence: "asc" }, { code: "asc" }],
            },
            sessions: {
              where: {
                OR: [
                  { observedAt: { gte: recentCutoff } },
                  {
                    followUpStatus: {
                      in: [
                        BehaviorFollowUpStatus.OPEN,
                        BehaviorFollowUpStatus.IN_PROGRESS,
                      ],
                    },
                  },
                ],
              },
              select: {
                id: true,
                reference: true,
                isParticipantAnonymous: true,
                workGroup: true,
                observedAt: true,
                location: true,
                coachingType: true,
                overallOutcome: true,
                safeCount: true,
                atRiskCount: true,
                criticalAtRiskCount: true,
                discussionSummary: true,
                workerCommitment: true,
                immediateAction: true,
                followUpStatus: true,
                followUpDueAt: true,
                followUpCompletedAt: true,
                safetyObservationId: true,
                correctiveActionId: true,
                site: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                observer: { select: { id: true, name: true } },
                participant: { select: { id: true, name: true } },
                followUpOwner: { select: { id: true, name: true } },
                results: {
                  select: {
                    id: true,
                    behaviorId: true,
                    outcome: true,
                    note: true,
                    immediateAction: true,
                    behavior: {
                      select: {
                        code: true,
                        title: true,
                        category: true,
                        isCritical: true,
                      },
                    },
                  },
                  orderBy: { behavior: { sequence: "asc" } },
                },
                recognitions: {
                  select: {
                    id: true,
                    reason: true,
                    status: true,
                    awardedAt: true,
                    nominatedUser: { select: { id: true, name: true } },
                    nominatedBy: { select: { id: true, name: true } },
                  },
                  take: 1,
                },
              },
              orderBy: { observedAt: "desc" },
              take: 100,
            },
          },
          orderBy: [{ status: "asc" }, { name: "asc" }],
          take: 75,
        })
      : Promise.resolve([]),
    capabilities.canViewBehavior
      ? getPublishedRuntimeForms(
          input.organizationId,
          ConfigurableFormModule.BEHAVIOR_SAFETY
        )
      : Promise.resolve([]),
    capabilities.canViewSif
      ? getSifIntelligenceOverview({
          organizationId: input.organizationId,
          permissions: [...input.permissions],
          now,
          windowDays: 90,
        })
      : Promise.resolve(null),
    capabilities.canViewSif
      ? getPublishedRuntimeForms(
          input.organizationId,
          ConfigurableFormModule.SIF_ASSURANCE
        )
      : Promise.resolve([]),
    capabilities.canViewCertification
      ? getCertificationPortfolioService(input.organizationId, now)
      : Promise.resolve([]),
    capabilities.canViewCertification
      ? getPublishedRuntimeForms(
          input.organizationId,
          ConfigurableFormModule.CERTIFICATION_READINESS
        )
      : Promise.resolve([]),
    canOperate
      ? prisma.user.findMany({
          where: { organizationId: input.organizationId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const behaviorSessions = behaviorPrograms.flatMap(
    (program) => program.sessions
  );
  const behaviorCapturedForms = behaviorSessions.length
    ? await prisma.configurableFormSubmission.findMany({
        where: {
          organizationId: input.organizationId,
          entityType: ConfigurableFormModule.BEHAVIOR_SAFETY,
          entityId: { in: behaviorSessions.map((session) => session.id) },
        },
        select: { entityId: true, definitionId: true },
      })
    : [];
  const capturedBehaviorForms = new Set(
    behaviorCapturedForms.map(
      (submission) => `${submission.entityId}:${submission.definitionId}`
    )
  );

  return {
    capabilities,
    people,
    behaviorForms,
    sifForms,
    certificationForms,
    behaviorPrograms: behaviorPrograms.map((program) => ({
      ...program,
      nextStatuses: getBehaviorProgramNextStatuses(program.status),
      sessions: program.sessions.map((session) => ({
        ...session,
        isFollowUpOwner: session.followUpOwner?.id === input.userId,
        missingFormDefinitionIds: behaviorForms
          .filter(
            (form) =>
              !capturedBehaviorForms.has(`${session.id}:${form.id}`)
          )
          .map((form) => form.id),
      })),
    })),
    sif: sifOverview
      ? {
          generatedAt: sifOverview.generatedAt,
          windowDays: sifOverview.windowDays,
          metrics: sifOverview.metrics,
          signals: sifOverview.signals,
          clusters: sifOverview.clusters.map((cluster) => ({
            id: cluster.id,
            siteId: cluster.siteId,
            siteName: cluster.siteName,
            category: cluster.category,
            count: cluster.count,
            score: cluster.score,
            highConfidence: cluster.highConfidence,
            trend: cluster.trend,
            controlCount: cluster.controlCount,
            effectiveControls: cluster.effectiveControls,
            failedControls: cluster.failedControls,
            coveragePercent: cluster.coveragePercent,
            pressure: cluster.pressure,
          })),
          controls: sifOverview.controls.map((control) => ({
            id: control.id,
            code: control.code,
            name: control.name,
            category: control.category,
            description: control.description,
            performanceStandard: control.performanceStandard,
            verificationPrompt: control.verificationPrompt,
            verificationFrequencyDays: control.verificationFrequencyDays,
            nextVerificationDueAt: control.nextVerificationDueAt,
            isActive: control.isActive,
            isOverdue: control.isOverdue,
            site: control.site
              ? { id: control.site.id, name: control.site.name }
              : null,
            owner: control.owner
              ? { id: control.owner.id, name: control.owner.name }
              : null,
            latestVerification: control.latestVerification
              ? {
                  id: control.latestVerification.id,
                  result: control.latestVerification.result,
                  verifiedAt: control.latestVerification.verifiedAt,
                  nextDueAt: control.latestVerification.nextDueAt,
                  evidenceReference:
                    control.latestVerification.evidenceReference,
                  findings: control.latestVerification.findings,
                  immediateAction:
                    control.latestVerification.immediateAction,
                  correctiveActionId:
                    control.latestVerification.correctiveActionId,
                }
              : null,
          })),
        }
      : null,
    certificationPrograms: certificationPortfolio.map((overview) => ({
      id: overview.program.id,
      code: overview.program.code,
      name: overview.program.name,
      description: overview.program.description,
      standardName: overview.program.standardName,
      standardVersion: overview.program.standardVersion,
      framework: overview.program.framework,
      owner: overview.program.owner
        ? {
            id: overview.program.owner.id,
            name: overview.program.owner.name,
          }
        : null,
      readiness: overview.readiness,
      gaps: overview.gaps,
      evidence: overview.evidence,
      sections: overview.sections,
      reviews: overview.program.certificationReviews
        .slice(0, 20)
        .map((review) => ({
          id: review.id,
          reference: review.reference,
          title: review.title,
          status: review.status,
          periodStart: review.periodStart,
          periodEnd: review.periodEnd,
          scheduledAt: review.scheduledAt,
          attendees: review.attendees,
          auditResultsSummary: review.auditResultsSummary,
          complianceStatusSummary: review.complianceStatusSummary,
          objectivesPerformance: review.objectivesPerformance,
          stakeholderFeedback: review.stakeholderFeedback,
          changesInContext: review.changesInContext,
          risksAndOpportunities: review.risksAndOpportunities,
          resourceAdequacy: review.resourceAdequacy,
          decisions: review.decisions,
          improvementOpportunities: review.improvementOpportunities,
          conclusion: review.conclusion,
          readinessScore: review.readinessScore,
          nextReviewAt: review.nextReviewAt,
          completedAt: review.completedAt,
          approvedAt: review.approvedAt,
          chair: { id: review.chair.id, name: review.chair.name },
          approvedBy: review.approvedBy
            ? { id: review.approvedBy.id, name: review.approvedBy.name }
            : null,
          actionCount: review.actions.length,
          canComplete:
            review.status === CertificationManagementReviewStatus.PLANNED ||
            review.status === CertificationManagementReviewStatus.IN_PROGRESS,
          canApprove:
            review.status === CertificationManagementReviewStatus.COMPLETED,
        })),
    })),
  };
}
