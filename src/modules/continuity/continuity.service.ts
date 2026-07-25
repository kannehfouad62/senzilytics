import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  assertContinuityActivationTransition,
  assertContinuityExerciseTransition,
  assertContinuityImprovementTransition,
  assertContinuityPlanTransition,
  businessImpactObjectiveIssues,
  continuityExerciseCompletionIssues,
  continuityPlanReadinessIssues,
  continuityReadinessScore,
} from "@/modules/continuity/continuity-lifecycle";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  ContinuityActivationStatus,
  ContinuityCriticality,
  ContinuityDependencyType,
  ContinuityDisruptionCategory,
  ContinuityExerciseResult,
  ContinuityExerciseStatus,
  ContinuityExerciseType,
  ContinuityImprovementStatus,
  ContinuityPlanStatus,
  ContinuityPlanType,
  NotificationType,
  Prisma,
  RiskLevel,
  Status,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

type Actor = { id: string };

export type ContinuityPlanInput = {
  organizationId: string;
  siteId: string | null;
  departmentId: string | null;
  ownerId: string;
  reference: string;
  title: string;
  type: ContinuityPlanType;
  scope: string;
  criticalActivitiesSummary: string;
  activationCriteria: string;
  governanceStructure: string;
  communicationStrategy: string;
  alternateWorkStrategy: string;
  technologyRecoveryStrategy: string;
  supplierContinuityStrategy: string | null;
  manualWorkarounds: string;
  recoveryPriorities: string;
  reviewDueAt: Date;
};

export type BusinessImpactAnalysisInput = {
  organizationId: string;
  planId: string;
  ownerId: string;
  reference: string;
  processName: string;
  criticality: ContinuityCriticality;
  description: string;
  maximumTolerableDowntimeHours: number;
  recoveryTimeObjectiveHours: number;
  recoveryPointObjectiveHours: number;
  minimumStaff: number;
  peakPeriods: string | null;
  operationalImpact: string;
  financialImpact: string | null;
  legalRegulatoryImpact: string | null;
  customerStakeholderImpact: string | null;
  minimumResources: string;
  vitalRecords: string | null;
  recoveryStrategy: string;
  workaroundProcedure: string;
  reviewDueAt: Date;
};

export async function createContinuityPlanService(
  input: ContinuityPlanInput & { customSubmissions?: PreparedSubmission[] },
  actor: Actor,
) {
  const scope = await validatePlanScope(input, actor.id);
  validateFutureDate(input.reviewDueAt, "The next plan review date");
  return prisma.$transaction(async (tx) => {
    const plan = await tx.businessContinuityPlan.create({
      data: {
        organizationId: input.organizationId,
        siteId: scope.site?.id ?? null,
        departmentId: scope.department?.id ?? null,
        ownerId: scope.owner.id,
        createdById: actor.id,
        reference: normalizedReference(input.reference, "BCP"),
        title: boundedRequired(input.title, 200, "Plan title"),
        type: input.type,
        scope: boundedRequired(input.scope, 4_000, "Scope"),
        criticalActivitiesSummary: boundedRequired(input.criticalActivitiesSummary, 4_000, "Critical activities summary"),
        activationCriteria: boundedRequired(input.activationCriteria, 4_000, "Activation criteria"),
        governanceStructure: boundedRequired(input.governanceStructure, 4_000, "Governance structure"),
        communicationStrategy: boundedRequired(input.communicationStrategy, 4_000, "Communication strategy"),
        alternateWorkStrategy: boundedRequired(input.alternateWorkStrategy, 4_000, "Alternate work strategy"),
        technologyRecoveryStrategy: boundedRequired(input.technologyRecoveryStrategy, 4_000, "Technology recovery strategy"),
        supplierContinuityStrategy: bounded(input.supplierContinuityStrategy, 4_000, "Supplier continuity strategy"),
        manualWorkarounds: boundedRequired(input.manualWorkarounds, 4_000, "Manual workarounds"),
        recoveryPriorities: boundedRequired(input.recoveryPriorities, 4_000, "Recovery priorities"),
        reviewDueAt: input.reviewDueAt,
      },
    });
    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: actor.id,
      module: ConfigurableFormModule.BUSINESS_CONTINUITY,
      entityId: plan.id,
      submissions: input.customSubmissions ?? [],
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "BusinessContinuityPlan",
        entityId: plan.id,
        title: "Business continuity plan created",
        description: `${plan.reference} v${plan.version} — ${plan.title}`,
        metadata: { ownerId: plan.ownerId, siteId: plan.siteId, type: plan.type },
      }),
    });
    return plan;
  });
}

export async function updateContinuityPlanService(
  input: ContinuityPlanInput & { planId: string },
  actor: Actor,
) {
  const [plan, scope] = await Promise.all([
    requireEditablePlan(input.organizationId, input.planId),
    validatePlanScope(input, actor.id),
  ]);
  validateFutureDate(input.reviewDueAt, "The next plan review date");
  await prisma.$transaction([
    prisma.businessContinuityPlan.update({
      where: { id: plan.id },
      data: {
        siteId: scope.site?.id ?? null,
        departmentId: scope.department?.id ?? null,
        ownerId: scope.owner.id,
        title: boundedRequired(input.title, 200, "Plan title"),
        type: input.type,
        scope: boundedRequired(input.scope, 4_000, "Scope"),
        criticalActivitiesSummary: boundedRequired(input.criticalActivitiesSummary, 4_000, "Critical activities summary"),
        activationCriteria: boundedRequired(input.activationCriteria, 4_000, "Activation criteria"),
        governanceStructure: boundedRequired(input.governanceStructure, 4_000, "Governance structure"),
        communicationStrategy: boundedRequired(input.communicationStrategy, 4_000, "Communication strategy"),
        alternateWorkStrategy: boundedRequired(input.alternateWorkStrategy, 4_000, "Alternate work strategy"),
        technologyRecoveryStrategy: boundedRequired(input.technologyRecoveryStrategy, 4_000, "Technology recovery strategy"),
        supplierContinuityStrategy: bounded(input.supplierContinuityStrategy, 4_000, "Supplier continuity strategy"),
        manualWorkarounds: boundedRequired(input.manualWorkarounds, 4_000, "Manual workarounds"),
        recoveryPriorities: boundedRequired(input.recoveryPriorities, 4_000, "Recovery priorities"),
        reviewDueAt: input.reviewDueAt,
        reviewReminderAt: null,
        ...(plan.status === ContinuityPlanStatus.REJECTED
          ? {
              status: ContinuityPlanStatus.DRAFT,
              submittedById: null,
              submittedAt: null,
              approvedById: null,
              approvedAt: null,
              rejectedAt: null,
            }
          : {}),
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.UPDATE,
      entityType: "BusinessContinuityPlan",
      entityId: plan.id,
      title: "Business continuity plan updated",
      description: `${plan.reference} v${plan.version}`,
    }),
  ]);
}

export async function upsertBusinessImpactAnalysisService(
  input: BusinessImpactAnalysisInput & { analysisId?: string | null },
  actor: Actor,
) {
  const issues = businessImpactObjectiveIssues(input);
  if (issues.length) throw new Error(issues.join(" "));
  validateFutureDate(input.reviewDueAt, "The BIA review date");
  const [plan, owner] = await Promise.all([
    requireEditablePlan(input.organizationId, input.planId),
    tenantUser(input.organizationId, input.ownerId),
  ]);
  if (!owner) throw new Error("Select a valid tenant process owner.");
  const common = {
    ownerId: owner.id,
    reference: normalizedReference(input.reference, "BIA"),
    processName: boundedRequired(input.processName, 200, "Process name"),
    criticality: input.criticality,
    description: boundedRequired(input.description, 3_000, "Process description"),
    maximumTolerableDowntimeHours: input.maximumTolerableDowntimeHours,
    recoveryTimeObjectiveHours: input.recoveryTimeObjectiveHours,
    recoveryPointObjectiveHours: input.recoveryPointObjectiveHours,
    minimumStaff: input.minimumStaff,
    peakPeriods: bounded(input.peakPeriods, 1_500, "Peak periods"),
    operationalImpact: boundedRequired(input.operationalImpact, 3_000, "Operational impact"),
    financialImpact: bounded(input.financialImpact, 3_000, "Financial impact"),
    legalRegulatoryImpact: bounded(input.legalRegulatoryImpact, 3_000, "Legal or regulatory impact"),
    customerStakeholderImpact: bounded(input.customerStakeholderImpact, 3_000, "Customer or stakeholder impact"),
    minimumResources: boundedRequired(input.minimumResources, 3_000, "Minimum resources"),
    vitalRecords: bounded(input.vitalRecords, 3_000, "Vital records"),
    recoveryStrategy: boundedRequired(input.recoveryStrategy, 4_000, "Recovery strategy"),
    workaroundProcedure: boundedRequired(input.workaroundProcedure, 4_000, "Workaround procedure"),
    reviewDueAt: input.reviewDueAt,
    reviewReminderAt: null,
  };
  if (input.analysisId) {
    const analysis = await prisma.businessImpactAnalysis.findFirst({
      where: { id: input.analysisId, organizationId: input.organizationId, planId: plan.id },
      select: { id: true },
    });
    if (!analysis) throw new Error("The business impact analysis was not found.");
    await prisma.$transaction([
      prisma.businessImpactAnalysis.update({ where: { id: analysis.id }, data: common }),
      activity(input.organizationId, actor.id, {
        action: ActivityAction.UPDATE,
        entityType: "BusinessImpactAnalysis",
        entityId: analysis.id,
        title: "Business impact analysis updated",
        description: common.processName,
      }),
    ]);
    return analysis;
  }
  return prisma.$transaction(async (tx) => {
    const analysis = await tx.businessImpactAnalysis.create({
      data: { organizationId: input.organizationId, planId: plan.id, ...common },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "BusinessImpactAnalysis",
        entityId: analysis.id,
        title: "Business impact analysis created",
        description: `${analysis.reference} — ${analysis.processName}`,
        metadata: { planId: plan.id, criticality: analysis.criticality },
      }),
    });
    return analysis;
  });
}

export async function setBusinessImpactAnalysisActiveService(
  input: { organizationId: string; planId: string; analysisId: string; active: boolean },
  actor: Actor,
) {
  await requireEditablePlan(input.organizationId, input.planId);
  const analysis = await prisma.businessImpactAnalysis.findFirst({
    where: { id: input.analysisId, organizationId: input.organizationId, planId: input.planId },
    select: { id: true, processName: true },
  });
  if (!analysis) throw new Error("The business impact analysis was not found.");
  await prisma.$transaction([
    prisma.businessImpactAnalysis.update({
      where: { id: analysis.id },
      data: { isActive: input.active, reviewReminderAt: null },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "BusinessImpactAnalysis",
      entityId: analysis.id,
      title: `Business impact analysis ${input.active ? "activated" : "deactivated"}`,
      description: analysis.processName,
    }),
  ]);
}

export async function addContinuityDependencyService(
  input: {
    organizationId: string;
    planId: string;
    analysisId: string;
    type: ContinuityDependencyType;
    name: string;
    description: string | null;
    provider: string | null;
    contactDetails: string | null;
    recoveryLeadTimeHours: number | null;
    fallbackArrangement: string;
    isSinglePointFailure: boolean;
  },
  actor: Actor,
) {
  await requireEditablePlan(input.organizationId, input.planId);
  const analysis = await prisma.businessImpactAnalysis.findFirst({
    where: { id: input.analysisId, organizationId: input.organizationId, planId: input.planId },
    select: { id: true },
  });
  if (!analysis) throw new Error("Select a business impact analysis from this plan.");
  if (input.recoveryLeadTimeHours !== null && (!Number.isInteger(input.recoveryLeadTimeHours) || input.recoveryLeadTimeHours < 0)) {
    throw new Error("Recovery lead time must be a non-negative whole number.");
  }
  const fallback = boundedRequired(input.fallbackArrangement, 3_000, "Fallback arrangement");
  if (input.isSinglePointFailure && fallback.length < 20) {
    throw new Error("Document a credible fallback for the single point of failure.");
  }
  return prisma.$transaction(async (tx) => {
    const dependency = await tx.continuityDependency.create({
      data: {
        organizationId: input.organizationId,
        analysisId: analysis.id,
        type: input.type,
        name: boundedRequired(input.name, 200, "Dependency name"),
        description: bounded(input.description, 2_000, "Description"),
        provider: bounded(input.provider, 200, "Provider"),
        contactDetails: bounded(input.contactDetails, 500, "Contact details"),
        recoveryLeadTimeHours: input.recoveryLeadTimeHours,
        fallbackArrangement: fallback,
        isSinglePointFailure: input.isSinglePointFailure,
      },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ContinuityDependency",
        entityId: dependency.id,
        title: "Continuity dependency recorded",
        description: dependency.name,
        metadata: { analysisId: analysis.id, type: dependency.type },
      }),
    });
    return dependency;
  });
}

export async function setContinuityDependencyActiveService(
  input: { organizationId: string; planId: string; dependencyId: string; active: boolean },
  actor: Actor,
) {
  await requireEditablePlan(input.organizationId, input.planId);
  const dependency = await prisma.continuityDependency.findFirst({
    where: {
      id: input.dependencyId,
      organizationId: input.organizationId,
      analysis: { planId: input.planId },
    },
  });
  if (!dependency) throw new Error("The continuity dependency was not found.");
  await prisma.$transaction([
    prisma.continuityDependency.update({ where: { id: dependency.id }, data: { isActive: input.active } }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ContinuityDependency",
      entityId: dependency.id,
      title: `Continuity dependency ${input.active ? "activated" : "deactivated"}`,
      description: dependency.name,
    }),
  ]);
}

export async function submitContinuityPlanService(
  input: { organizationId: string; planId: string; submissionNotes: string },
  actor: Actor,
) {
  const plan = await prisma.businessContinuityPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId },
    include: {
      businessImpactAnalyses: {
        where: { isActive: true },
        include: { dependencies: { where: { isActive: true } } },
      },
    },
  });
  if (!plan) throw new Error("The business continuity plan was not found.");
  assertContinuityPlanTransition(plan.status, ContinuityPlanStatus.IN_REVIEW);
  const invalidAnalysisCount = plan.businessImpactAnalyses.filter(
    (analysis) => businessImpactObjectiveIssues(analysis).length > 0,
  ).length;
  const issues = continuityPlanReadinessIssues({
    reviewDueAt: plan.reviewDueAt,
    scope: plan.scope,
    criticalActivitiesSummary: plan.criticalActivitiesSummary,
    activationCriteria: plan.activationCriteria,
    governanceStructure: plan.governanceStructure,
    communicationStrategy: plan.communicationStrategy,
    alternateWorkStrategy: plan.alternateWorkStrategy,
    technologyRecoveryStrategy: plan.technologyRecoveryStrategy,
    manualWorkarounds: plan.manualWorkarounds,
    recoveryPriorities: plan.recoveryPriorities,
    activeAnalysisCount: plan.businessImpactAnalyses.length,
    highCriticalityAnalysisCount: plan.businessImpactAnalyses.filter((analysis) =>
      analysis.criticality === ContinuityCriticality.TIER_0_CRITICAL ||
      analysis.criticality === ContinuityCriticality.TIER_1_HIGH,
    ).length,
    invalidAnalysisCount,
  });
  if (issues.length) throw new Error(issues.join(" "));
  const notes = boundedRequired(input.submissionNotes, 2_000, "Submission notes");
  await prisma.$transaction([
    prisma.businessContinuityPlan.update({
      where: { id: plan.id },
      data: {
        status: ContinuityPlanStatus.IN_REVIEW,
        submittedById: actor.id,
        submittedAt: new Date(),
        approvedById: null,
        approvedAt: null,
        rejectedAt: null,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "BusinessContinuityPlan",
      entityId: plan.id,
      title: "Business continuity plan submitted for approval",
      description: notes,
      metadata: { previousStatus: plan.status, status: ContinuityPlanStatus.IN_REVIEW },
    }),
  ]);
}

export async function decideContinuityPlanService(
  input: {
    organizationId: string;
    planId: string;
    decision: ContinuityPlanStatus;
    reviewNotes: string;
  },
  actor: Actor,
) {
  const plan = await prisma.businessContinuityPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId },
  });
  if (!plan) throw new Error("The business continuity plan was not found.");
  if (input.decision !== ContinuityPlanStatus.ACTIVE && input.decision !== ContinuityPlanStatus.REJECTED) {
    throw new Error("Select approve or reject.");
  }
  assertContinuityPlanTransition(plan.status, input.decision);
  const notes = boundedRequired(input.reviewNotes, 2_000, "Review rationale");
  if (notes.length < 20) throw new Error("Document at least 20 characters of review rationale.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (input.decision === ContinuityPlanStatus.ACTIVE) {
      await tx.businessContinuityPlan.updateMany({
        where: {
          organizationId: input.organizationId,
          reference: plan.reference,
          status: ContinuityPlanStatus.ACTIVE,
          id: { not: plan.id },
        },
        data: { status: ContinuityPlanStatus.ARCHIVED, archivedAt: now },
      });
    }
    await tx.businessContinuityPlan.update({
      where: { id: plan.id },
      data: {
        status: input.decision,
        approvedById: input.decision === ContinuityPlanStatus.ACTIVE ? actor.id : null,
        approvedAt: input.decision === ContinuityPlanStatus.ACTIVE ? now : null,
        effectiveAt: input.decision === ContinuityPlanStatus.ACTIVE ? now : null,
        rejectedAt: input.decision === ContinuityPlanStatus.REJECTED ? now : null,
      },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.STATUS_CHANGE,
        entityType: "BusinessContinuityPlan",
        entityId: plan.id,
        title: `Business continuity plan ${input.decision === ContinuityPlanStatus.ACTIVE ? "approved" : "rejected"}`,
        description: notes,
        metadata: { previousStatus: plan.status, status: input.decision },
      }),
    });
  });
}

export async function createContinuityPlanRevisionService(
  input: { organizationId: string; planId: string; reason: string },
  actor: Actor,
) {
  const plan = await prisma.businessContinuityPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId, status: ContinuityPlanStatus.ACTIVE },
    include: { businessImpactAnalyses: { include: { dependencies: true } } },
  });
  if (!plan) throw new Error("Only an active business continuity plan can be revised.");
  const existingRevision = await prisma.businessContinuityPlan.findFirst({
    where: { previousVersionId: plan.id },
    select: { id: true },
  });
  if (existingRevision) return existingRevision;
  const latest = await prisma.businessContinuityPlan.aggregate({
    where: { organizationId: input.organizationId, reference: plan.reference },
    _max: { version: true },
  });
  const reason = boundedRequired(input.reason, 1_000, "Revision reason");
  return prisma.$transaction(async (tx) => {
    const revision = await tx.businessContinuityPlan.create({
      data: {
        organizationId: plan.organizationId,
        siteId: plan.siteId,
        departmentId: plan.departmentId,
        ownerId: plan.ownerId,
        createdById: actor.id,
        previousVersionId: plan.id,
        reference: plan.reference,
        version: (latest._max.version ?? plan.version) + 1,
        title: plan.title,
        type: plan.type,
        scope: plan.scope,
        criticalActivitiesSummary: plan.criticalActivitiesSummary,
        activationCriteria: plan.activationCriteria,
        governanceStructure: plan.governanceStructure,
        communicationStrategy: plan.communicationStrategy,
        alternateWorkStrategy: plan.alternateWorkStrategy,
        technologyRecoveryStrategy: plan.technologyRecoveryStrategy,
        supplierContinuityStrategy: plan.supplierContinuityStrategy,
        manualWorkarounds: plan.manualWorkarounds,
        recoveryPriorities: plan.recoveryPriorities,
        reviewDueAt: plan.reviewDueAt,
        businessImpactAnalyses: {
          create: plan.businessImpactAnalyses.map((analysis) => ({
            organizationId: plan.organizationId,
            ownerId: analysis.ownerId,
            reference: `${analysis.reference}-V${(latest._max.version ?? plan.version) + 1}`,
            processName: analysis.processName,
            criticality: analysis.criticality,
            description: analysis.description,
            maximumTolerableDowntimeHours: analysis.maximumTolerableDowntimeHours,
            recoveryTimeObjectiveHours: analysis.recoveryTimeObjectiveHours,
            recoveryPointObjectiveHours: analysis.recoveryPointObjectiveHours,
            minimumStaff: analysis.minimumStaff,
            peakPeriods: analysis.peakPeriods,
            operationalImpact: analysis.operationalImpact,
            financialImpact: analysis.financialImpact,
            legalRegulatoryImpact: analysis.legalRegulatoryImpact,
            customerStakeholderImpact: analysis.customerStakeholderImpact,
            minimumResources: analysis.minimumResources,
            vitalRecords: analysis.vitalRecords,
            recoveryStrategy: analysis.recoveryStrategy,
            workaroundProcedure: analysis.workaroundProcedure,
            reviewDueAt: analysis.reviewDueAt,
            isActive: analysis.isActive,
            dependencies: {
              create: analysis.dependencies.map((dependency) => ({
                organizationId: plan.organizationId,
                type: dependency.type,
                name: dependency.name,
                description: dependency.description,
                provider: dependency.provider,
                contactDetails: dependency.contactDetails,
                recoveryLeadTimeHours: dependency.recoveryLeadTimeHours,
                fallbackArrangement: dependency.fallbackArrangement,
                isSinglePointFailure: dependency.isSinglePointFailure,
                isActive: dependency.isActive,
              })),
            },
          })),
        },
      },
      select: { id: true, version: true },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "BusinessContinuityPlan",
        entityId: revision.id,
        title: "Business continuity plan revision started",
        description: reason,
        metadata: { previousPlanId: plan.id, version: revision.version },
      }),
    });
    return revision;
  });
}

export async function scheduleContinuityExerciseService(
  input: {
    organizationId: string;
    planId: string;
    analysisId: string | null;
    leadId: string;
    reference: string;
    type: ContinuityExerciseType;
    scheduledAt: Date;
    objectives: string;
    scenario: string;
    expectedParticipants: number;
    targetRecoveryTimeHours: number | null;
    targetRecoveryPointHours: number | null;
  },
  actor: Actor,
) {
  const [plan, lead] = await Promise.all([
    prisma.businessContinuityPlan.findFirst({
      where: { id: input.planId, organizationId: input.organizationId, status: ContinuityPlanStatus.ACTIVE },
      select: { id: true },
    }),
    tenantUser(input.organizationId, input.leadId),
  ]);
  if (!plan || !lead) throw new Error("Select an active continuity plan and tenant exercise lead.");
  if (input.analysisId) {
    const analysis = await prisma.businessImpactAnalysis.findFirst({
      where: { id: input.analysisId, organizationId: input.organizationId, planId: plan.id, isActive: true },
      select: { id: true },
    });
    if (!analysis) throw new Error("Select an active BIA from this plan.");
  }
  validateFutureDate(input.scheduledAt, "Exercise date");
  if (!Number.isInteger(input.expectedParticipants) || input.expectedParticipants < 1 || input.expectedParticipants > 100_000) {
    throw new Error("Expected participants must be between 1 and 100,000.");
  }
  validateOptionalWholeHours(input.targetRecoveryTimeHours, "Target recovery time");
  validateOptionalWholeHours(input.targetRecoveryPointHours, "Target recovery point");
  return prisma.$transaction(async (tx) => {
    const exercise = await tx.continuityExercise.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        analysisId: input.analysisId,
        leadId: lead.id,
        createdById: actor.id,
        reference: normalizedReference(input.reference, "BCX"),
        type: input.type,
        scheduledAt: input.scheduledAt,
        objectives: boundedRequired(input.objectives, 3_000, "Exercise objectives"),
        scenario: boundedRequired(input.scenario, 4_000, "Exercise scenario"),
        expectedParticipants: input.expectedParticipants,
        targetRecoveryTimeHours: input.targetRecoveryTimeHours,
        targetRecoveryPointHours: input.targetRecoveryPointHours,
      },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ContinuityExercise",
        entityId: exercise.id,
        title: "Business continuity exercise scheduled",
        description: `${exercise.reference} — ${exercise.type.replaceAll("_", " ")}`,
        metadata: { planId: plan.id, leadId: lead.id, scheduledAt: exercise.scheduledAt },
      }),
    });
    return exercise;
  });
}

export async function startContinuityExerciseService(
  input: { organizationId: string; exerciseId: string; note: string },
  actor: Actor,
) {
  const exercise = await tenantExercise(input.organizationId, input.exerciseId);
  assertContinuityExerciseTransition(exercise.status, ContinuityExerciseStatus.IN_PROGRESS);
  await prisma.$transaction([
    prisma.continuityExercise.update({
      where: { id: exercise.id },
      data: { status: ContinuityExerciseStatus.IN_PROGRESS, startedAt: new Date() },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ContinuityExercise",
      entityId: exercise.id,
      title: "Business continuity exercise started",
      description: boundedRequired(input.note, 1_000, "Start note"),
      metadata: { previousStatus: exercise.status, status: ContinuityExerciseStatus.IN_PROGRESS },
    }),
  ]);
}

export async function completeContinuityExerciseService(
  input: {
    organizationId: string;
    exerciseId: string;
    actualParticipants: number;
    actualRecoveryTimeHours: number | null;
    actualRecoveryPointHours: number | null;
    result: ContinuityExerciseResult;
    strengths: string;
    gaps: string;
    afterActionSummary: string;
  },
  actor: Actor,
) {
  const exercise = await tenantExercise(input.organizationId, input.exerciseId);
  assertContinuityExerciseTransition(exercise.status, ContinuityExerciseStatus.COMPLETED);
  const issues = continuityExerciseCompletionIssues(input);
  if (issues.length) throw new Error(issues.join(" "));
  const now = new Date();
  await prisma.$transaction([
    prisma.continuityExercise.update({
      where: { id: exercise.id },
      data: {
        status: ContinuityExerciseStatus.COMPLETED,
        completedAt: now,
        actualParticipants: input.actualParticipants,
        actualRecoveryTimeHours: input.actualRecoveryTimeHours,
        actualRecoveryPointHours: input.actualRecoveryPointHours,
        result: input.result,
        strengths: boundedRequired(input.strengths, 4_000, "Strengths"),
        gaps: boundedRequired(input.gaps, 4_000, "Gaps"),
        afterActionSummary: boundedRequired(input.afterActionSummary, 4_000, "After-action summary"),
        reviewedById: actor.id,
        reviewedAt: now,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ContinuityExercise",
      entityId: exercise.id,
      title: "Business continuity exercise completed",
      description: `${exercise.reference} — ${input.result.replaceAll("_", " ")}`,
      metadata: { previousStatus: exercise.status, status: ContinuityExerciseStatus.COMPLETED, result: input.result },
    }),
  ]);
}

export async function cancelContinuityExerciseService(
  input: { organizationId: string; exerciseId: string; reason: string },
  actor: Actor,
) {
  const exercise = await tenantExercise(input.organizationId, input.exerciseId);
  assertContinuityExerciseTransition(exercise.status, ContinuityExerciseStatus.CANCELLED);
  const reason = boundedRequired(input.reason, 2_000, "Cancellation reason");
  await prisma.$transaction([
    prisma.continuityExercise.update({
      where: { id: exercise.id },
      data: { status: ContinuityExerciseStatus.CANCELLED, cancelledReason: reason },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ContinuityExercise",
      entityId: exercise.id,
      title: "Business continuity exercise cancelled",
      description: reason,
      metadata: { previousStatus: exercise.status, status: ContinuityExerciseStatus.CANCELLED },
    }),
  ]);
}

export async function activateContinuityService(
  input: {
    organizationId: string;
    planId: string;
    emergencyActivationId: string | null;
    coordinatorId: string;
    reference: string;
    category: ContinuityDisruptionCategory;
    severity: RiskLevel;
    title: string;
    location: string | null;
    disruptionSummary: string;
    impactedProcesses: string;
    activationRationale: string;
    recoveryActions: string;
    stakeholderCommunication: string;
    workaroundStatus: string | null;
    declaredAt: Date;
    expectedRecoveryAt: Date;
    afterActionDueAt: Date;
    estimatedDowntimeHours: number | null;
  },
  actor: Actor,
) {
  const [plan, coordinator, emergency] = await Promise.all([
    prisma.businessContinuityPlan.findFirst({
      where: { id: input.planId, organizationId: input.organizationId, status: ContinuityPlanStatus.ACTIVE },
      select: { id: true, ownerId: true },
    }),
    tenantUser(input.organizationId, input.coordinatorId),
    input.emergencyActivationId
      ? prisma.emergencyActivation.findFirst({
          where: { id: input.emergencyActivationId, organizationId: input.organizationId },
          select: { id: true },
        })
      : null,
  ]);
  if (!plan || !coordinator) throw new Error("Select an active continuity plan and tenant recovery coordinator.");
  if (input.emergencyActivationId && !emergency) throw new Error("Select an emergency activation from this tenant.");
  if (input.declaredAt.getTime() > Date.now() + 5 * 60_000) throw new Error("Declaration time cannot be in the future.");
  if (input.expectedRecoveryAt <= input.declaredAt) throw new Error("Expected recovery must follow the declaration.");
  if (input.afterActionDueAt <= input.declaredAt) throw new Error("After-action due date must follow the declaration.");
  validateOptionalWholeHours(input.estimatedDowntimeHours, "Estimated downtime");
  const activation = await prisma.$transaction(async (tx) => {
    const created = await tx.continuityActivation.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        emergencyActivationId: emergency?.id ?? null,
        declaredById: actor.id,
        coordinatorId: coordinator.id,
        reference: normalizedReference(input.reference, "BCA"),
        category: input.category,
        severity: input.severity,
        title: boundedRequired(input.title, 200, "Activation title"),
        location: bounded(input.location, 500, "Location"),
        disruptionSummary: boundedRequired(input.disruptionSummary, 4_000, "Disruption summary"),
        impactedProcesses: boundedRequired(input.impactedProcesses, 4_000, "Impacted processes"),
        activationRationale: boundedRequired(input.activationRationale, 3_000, "Activation rationale"),
        recoveryActions: boundedRequired(input.recoveryActions, 4_000, "Recovery actions"),
        stakeholderCommunication: boundedRequired(input.stakeholderCommunication, 4_000, "Stakeholder communication"),
        workaroundStatus: bounded(input.workaroundStatus, 3_000, "Workaround status"),
        declaredAt: input.declaredAt,
        expectedRecoveryAt: input.expectedRecoveryAt,
        afterActionDueAt: input.afterActionDueAt,
        estimatedDowntimeHours: input.estimatedDowntimeHours,
      },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ContinuityActivation",
        entityId: created.id,
        title: "Business continuity plan activated",
        description: `${created.reference} — ${created.title}`,
        metadata: {
          planId: plan.id,
          emergencyActivationId: emergency?.id ?? null,
          severity: created.severity,
          coordinatorId: created.coordinatorId,
        },
      }),
    });
    return created;
  });
  await Promise.all(
    Array.from(new Set([plan.ownerId, coordinator.id])).map((userId) =>
      createNotification({
        organizationId: input.organizationId,
        userId,
        type: NotificationType.CRITICAL,
        title: "Business continuity plan activated",
        message: `${activation.reference} — ${activation.title}. Follow the approved continuity plan and authorized response channels.`,
        link: `/business-continuity/activations/${activation.id}`,
      }).catch(() => null),
    ),
  );
  return activation;
}

export async function updateContinuitySituationService(
  input: {
    organizationId: string;
    activationId: string;
    disruptionSummary: string;
    impactedProcesses: string;
    recoveryActions: string;
    stakeholderCommunication: string;
    workaroundStatus: string | null;
    expectedRecoveryAt: Date;
    estimatedDowntimeHours: number | null;
  },
  actor: Actor,
) {
  const activation = await tenantActivation(input.organizationId, input.activationId);
  if (activation.status !== ContinuityActivationStatus.ACTIVE && activation.status !== ContinuityActivationStatus.RECOVERING) {
    throw new Error("A restored continuity record cannot be edited.");
  }
  if (input.expectedRecoveryAt <= activation.declaredAt) throw new Error("Expected recovery must follow the declaration.");
  validateOptionalWholeHours(input.estimatedDowntimeHours, "Estimated downtime");
  await prisma.$transaction([
    prisma.continuityActivation.update({
      where: { id: activation.id },
      data: {
        disruptionSummary: boundedRequired(input.disruptionSummary, 4_000, "Disruption summary"),
        impactedProcesses: boundedRequired(input.impactedProcesses, 4_000, "Impacted processes"),
        recoveryActions: boundedRequired(input.recoveryActions, 4_000, "Recovery actions"),
        stakeholderCommunication: boundedRequired(input.stakeholderCommunication, 4_000, "Stakeholder communication"),
        workaroundStatus: bounded(input.workaroundStatus, 3_000, "Workaround status"),
        expectedRecoveryAt: input.expectedRecoveryAt,
        estimatedDowntimeHours: input.estimatedDowntimeHours,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.UPDATE,
      entityType: "ContinuityActivation",
      entityId: activation.id,
      title: "Continuity recovery situation updated",
      description: `${activation.reference} — ${input.disruptionSummary}`,
      metadata: { status: activation.status, expectedRecoveryAt: input.expectedRecoveryAt },
    }),
  ]);
}

export async function transitionContinuityActivationService(
  input: {
    organizationId: string;
    activationId: string;
    status: ContinuityActivationStatus;
    note: string;
    restorationEvidence: string | null;
    actualDowntimeHours: number | null;
    closureSummary: string | null;
    lessonsLearned: string | null;
  },
  actor: Actor,
) {
  const activation = await tenantActivation(input.organizationId, input.activationId);
  assertContinuityActivationTransition(activation.status, input.status);
  const note = boundedRequired(input.note, 2_000, "Transition note");
  validateOptionalWholeHours(input.actualDowntimeHours, "Actual downtime");
  if (input.status === ContinuityActivationStatus.RESTORED) {
    if ((input.restorationEvidence?.trim().length ?? 0) < 20) {
      throw new Error("Document restoration evidence with at least 20 characters.");
    }
    if (input.actualDowntimeHours === null) throw new Error("Record actual downtime before restoration.");
  }
  if (input.status === ContinuityActivationStatus.CLOSED) {
    if ((input.closureSummary?.trim().length ?? 0) < 30) {
      throw new Error("Record a closure summary of at least 30 characters.");
    }
    if ((input.lessonsLearned?.trim().length ?? 0) < 20) {
      throw new Error("Document lessons learned with at least 20 characters.");
    }
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.continuityActivation.update({
      where: { id: activation.id },
      data: {
        status: input.status,
        restoredAt: input.status === ContinuityActivationStatus.RESTORED ? now : activation.restoredAt,
        restoredById: input.status === ContinuityActivationStatus.RESTORED ? actor.id : activation.restoredById,
        restorationEvidence: input.status === ContinuityActivationStatus.RESTORED
          ? bounded(input.restorationEvidence, 4_000, "Restoration evidence")
          : activation.restorationEvidence,
        actualDowntimeHours: input.status === ContinuityActivationStatus.RESTORED
          ? input.actualDowntimeHours
          : activation.actualDowntimeHours,
        closedAt: input.status === ContinuityActivationStatus.CLOSED ? now : activation.closedAt,
        closedById: input.status === ContinuityActivationStatus.CLOSED ? actor.id : activation.closedById,
        closureSummary: input.status === ContinuityActivationStatus.CLOSED
          ? bounded(input.closureSummary, 4_000, "Closure summary")
          : activation.closureSummary,
        lessonsLearned: input.status === ContinuityActivationStatus.CLOSED
          ? bounded(input.lessonsLearned, 4_000, "Lessons learned")
          : activation.lessonsLearned,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ContinuityActivation",
      entityId: activation.id,
      title: `Continuity activation moved to ${input.status.replaceAll("_", " ").toLowerCase()}`,
      description: note,
      metadata: { previousStatus: activation.status, status: input.status },
    }),
  ]);
}

export async function createContinuityImprovementService(
  input: {
    organizationId: string;
    planId: string;
    exerciseId: string | null;
    activationId: string | null;
    ownerId: string;
    title: string;
    description: string;
    priority: RiskLevel;
    dueAt: Date;
  },
  actor: Actor,
) {
  const [plan, owner] = await Promise.all([
    prisma.businessContinuityPlan.findFirst({
      where: { id: input.planId, organizationId: input.organizationId },
      select: { id: true },
    }),
    tenantUser(input.organizationId, input.ownerId),
  ]);
  if (!plan || !owner) throw new Error("Select a valid tenant continuity plan and action owner.");
  if (input.exerciseId && input.activationId) throw new Error("Select only one exercise or activation as the source.");
  if (input.exerciseId) {
    const exercise = await prisma.continuityExercise.findFirst({
      where: {
        id: input.exerciseId,
        organizationId: input.organizationId,
        planId: plan.id,
        status: ContinuityExerciseStatus.COMPLETED,
      },
      select: { id: true },
    });
    if (!exercise) throw new Error("Select a completed exercise from this plan.");
  }
  if (input.activationId) {
    const activation = await prisma.continuityActivation.findFirst({
      where: { id: input.activationId, organizationId: input.organizationId, planId: plan.id },
      select: { id: true },
    });
    if (!activation) throw new Error("Select an activation from this plan.");
  }
  validateFutureDate(input.dueAt, "Improvement due date");
  return prisma.$transaction(async (tx) => {
    const improvement = await tx.continuityImprovement.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        exerciseId: input.exerciseId,
        activationId: input.activationId,
        ownerId: owner.id,
        createdById: actor.id,
        title: boundedRequired(input.title, 200, "Improvement title"),
        description: boundedRequired(input.description, 3_000, "Improvement description"),
        priority: input.priority,
        dueAt: input.dueAt,
      },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "ContinuityImprovement",
        entityId: improvement.id,
        title: "Continuity improvement created",
        description: improvement.title,
        metadata: {
          planId: plan.id,
          exerciseId: input.exerciseId,
          activationId: input.activationId,
          ownerId: owner.id,
          priority: input.priority,
        },
      }),
    });
    return improvement;
  });
}

export async function updateContinuityImprovementService(input: {
  organizationId: string;
  improvementId: string;
  userId: string;
  canManage: boolean;
  status: ContinuityImprovementStatus;
  completionEvidence: string | null;
  verificationNotes: string | null;
}) {
  const improvement = await prisma.continuityImprovement.findFirst({
    where: { id: input.improvementId, organizationId: input.organizationId },
  });
  if (!improvement) throw new Error("The continuity improvement was not found.");
  if (improvement.ownerId !== input.userId && !input.canManage) {
    throw new Error("Only the assigned owner or continuity manager can update this improvement.");
  }
  if (input.status === ContinuityImprovementStatus.VERIFIED && !input.canManage) {
    throw new Error("Only a continuity manager can verify improvement closure.");
  }
  assertContinuityImprovementTransition(improvement.status, input.status);
  const evidence = bounded(input.completionEvidence, 3_000, "Completion evidence");
  const verification = bounded(input.verificationNotes, 2_000, "Verification notes");
  if (input.status === ContinuityImprovementStatus.COMPLETED && (evidence?.length ?? 0) < 12) {
    throw new Error("Document completion evidence with at least 12 characters.");
  }
  if (input.status === ContinuityImprovementStatus.VERIFIED && (verification?.length ?? 0) < 12) {
    throw new Error("Document closure verification with at least 12 characters.");
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.continuityImprovement.update({
      where: { id: improvement.id },
      data: {
        status: input.status,
        completionEvidence: input.status === ContinuityImprovementStatus.COMPLETED ? evidence : improvement.completionEvidence,
        completedAt: input.status === ContinuityImprovementStatus.COMPLETED
          ? now
          : input.status === ContinuityImprovementStatus.IN_PROGRESS ? null : improvement.completedAt,
        verificationNotes: input.status === ContinuityImprovementStatus.VERIFIED ? verification : improvement.verificationNotes,
        verifiedById: input.status === ContinuityImprovementStatus.VERIFIED ? input.userId : null,
        verifiedAt: input.status === ContinuityImprovementStatus.VERIFIED ? now : null,
      },
    }),
    activity(input.organizationId, input.userId, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ContinuityImprovement",
      entityId: improvement.id,
      title: "Continuity improvement status updated",
      description: `${improvement.status} → ${input.status}`,
      metadata: { previousStatus: improvement.status, status: input.status },
    }),
  ]);
}

export async function createCapaFromContinuityImprovementService(
  input: {
    organizationId: string;
    improvementId: string;
    title: string;
    description: string | null;
    assignedToId: string;
    dueDate: Date;
  },
  actor: Actor,
) {
  const [improvement, assignee] = await Promise.all([
    prisma.continuityImprovement.findFirst({
      where: { id: input.improvementId, organizationId: input.organizationId },
    }),
    tenantUser(input.organizationId, input.assignedToId),
  ]);
  if (!improvement || !assignee) throw new Error("Select a valid tenant continuity improvement and CAPA owner.");
  if (improvement.correctiveActionId) throw new Error("This improvement already has a linked corrective action.");
  validateFutureDate(input.dueDate, "Corrective-action due date");
  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.correctiveAction.create({
      data: {
        title: boundedRequired(input.title, 200, "Corrective-action title"),
        description: bounded(input.description, 3_000, "Corrective-action description"),
        status: Status.OPEN,
        riskLevel: improvement.priority,
        dueDate: input.dueDate,
        assignedToId: assignee.id,
      },
    });
    await tx.continuityImprovement.update({
      where: { id: improvement.id },
      data: { correctiveActionId: created.id },
    });
    await tx.activityLog.create({
      data: activityData(input.organizationId, actor.id, {
        action: ActivityAction.CREATE,
        entityType: "CorrectiveAction",
        entityId: created.id,
        title: "Continuity improvement CAPA created",
        description: `${improvement.title} — ${created.title}`,
        metadata: { continuityImprovementId: improvement.id, assignedToId: assignee.id },
      }),
    });
    return created;
  });
  await createNotification({
    organizationId: input.organizationId,
    userId: assignee.id,
    type: NotificationType.ASSIGNMENT,
    title: "Business continuity corrective action assigned",
    message: action.title,
    link: `/actions/${action.id}`,
  }).catch(() => null);
  return action;
}

export async function getBusinessContinuityDashboardService(
  organizationId: string,
  now = new Date(),
) {
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [plans, exercises, activations, improvements] = await Promise.all([
    prisma.businessContinuityPlan.findMany({
      where: { organizationId },
      include: {
        site: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        businessImpactAnalyses: {
          where: { isActive: true },
          include: { dependencies: { where: { isActive: true } } },
        },
        exercises: {
          where: { status: ContinuityExerciseStatus.COMPLETED },
          select: { completedAt: true, result: true },
          orderBy: { completedAt: "desc" },
        },
        improvements: {
          where: {
            status: { in: [
              ContinuityImprovementStatus.OPEN,
              ContinuityImprovementStatus.IN_PROGRESS,
              ContinuityImprovementStatus.COMPLETED,
            ] },
          },
          select: { priority: true, dueAt: true },
        },
      },
      orderBy: [{ status: "asc" }, { reviewDueAt: "asc" }],
    }),
    prisma.continuityExercise.findMany({
      where: {
        organizationId,
        OR: [
          { status: { in: [ContinuityExerciseStatus.PLANNED, ContinuityExerciseStatus.IN_PROGRESS] } },
          { completedAt: { gte: sixMonthsAgo } },
        ],
      },
      include: {
        plan: { select: { title: true } },
        lead: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.continuityActivation.findMany({
      where: {
        organizationId,
        OR: [
          { status: { in: [
            ContinuityActivationStatus.ACTIVE,
            ContinuityActivationStatus.RECOVERING,
            ContinuityActivationStatus.RESTORED,
          ] } },
          { declaredAt: { gte: sixMonthsAgo } },
        ],
      },
      include: {
        plan: { select: { title: true } },
        coordinator: { select: { name: true } },
      },
      orderBy: { declaredAt: "desc" },
    }),
    prisma.continuityImprovement.findMany({
      where: {
        organizationId,
        status: { in: [
          ContinuityImprovementStatus.OPEN,
          ContinuityImprovementStatus.IN_PROGRESS,
          ContinuityImprovementStatus.COMPLETED,
        ] },
      },
      include: {
        owner: { select: { name: true } },
        plan: { select: { title: true } },
        correctiveAction: { select: { id: true, status: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  const scoredPlans = plans.map((plan) => {
    const invalid = plan.businessImpactAnalyses.some(
      (analysis) => businessImpactObjectiveIssues(analysis).length > 0,
    );
    const unresolvedSinglePoints = plan.businessImpactAnalyses.reduce(
      (count, analysis) =>
        count + analysis.dependencies.filter(
          (dependency) =>
            dependency.isSinglePointFailure &&
            dependency.fallbackArrangement.trim().length < 20,
        ).length,
      0,
    );
    return {
      ...plan,
      readinessScore: continuityReadinessScore({
        status: plan.status,
        reviewDueAt: plan.reviewDueAt,
        activeAnalysisCount: plan.businessImpactAnalyses.length,
        allObjectivesValid: !invalid && plan.businessImpactAnalyses.length > 0,
        unresolvedSinglePointFailures: unresolvedSinglePoints,
        latestCompletedExerciseAt: plan.exercises[0]?.completedAt ?? null,
        overdueCriticalImprovements: plan.improvements.filter(
          (item) =>
            item.dueAt < now &&
            (item.priority === RiskLevel.HIGH || item.priority === RiskLevel.CRITICAL),
        ).length,
      }, now),
    };
  });
  const completedExercises = exercises.filter((exercise) => exercise.status === ContinuityExerciseStatus.COMPLETED);
  const effectiveExercises = completedExercises.filter((exercise) => exercise.result === ContinuityExerciseResult.MET_OBJECTIVES).length;
  return {
    plans: scoredPlans,
    exercises,
    activations,
    improvements,
    metrics: {
      activePlans: plans.filter((plan) => plan.status === ContinuityPlanStatus.ACTIVE).length,
      overduePlanReviews: plans.filter(
        (plan) => plan.status === ContinuityPlanStatus.ACTIVE && plan.reviewDueAt < now,
      ).length,
      criticalProcesses: plans.reduce(
        (count, plan) => count + plan.businessImpactAnalyses.filter(
          (analysis) => analysis.criticality === ContinuityCriticality.TIER_0_CRITICAL,
        ).length,
        0,
      ),
      openActivations: activations.filter(
        (activation) =>
          activation.status === ContinuityActivationStatus.ACTIVE ||
          activation.status === ContinuityActivationStatus.RECOVERING,
      ).length,
      exerciseEffectiveness: completedExercises.length
        ? Math.round((effectiveExercises / completedExercises.length) * 100)
        : 0,
      overdueImprovements: improvements.filter((item) => item.dueAt < now).length,
    },
  };
}

export async function processBusinessContinuityMonitoring(now = new Date()) {
  const reviewHorizon = new Date(now.getTime() + 14 * 86_400_000);
  const exerciseHorizon = new Date(now.getTime() + 86_400_000);
  const [plans, analyses, exercises, activations, improvements] = await Promise.all([
    prisma.businessContinuityPlan.findMany({
      where: {
        status: ContinuityPlanStatus.ACTIVE,
        reviewDueAt: { lte: reviewHorizon },
        reviewReminderAt: null,
      },
      select: { id: true, organizationId: true, ownerId: true, reference: true, title: true, reviewDueAt: true },
    }),
    prisma.businessImpactAnalysis.findMany({
      where: { isActive: true, reviewDueAt: { lte: reviewHorizon }, reviewReminderAt: null },
      select: { id: true, organizationId: true, ownerId: true, reference: true, processName: true, reviewDueAt: true, planId: true },
    }),
    prisma.continuityExercise.findMany({
      where: {
        status: ContinuityExerciseStatus.PLANNED,
        scheduledAt: { lte: exerciseHorizon },
        reminderSentAt: null,
      },
      select: { id: true, organizationId: true, leadId: true, reference: true, scheduledAt: true },
    }),
    prisma.continuityActivation.findMany({
      where: {
        status: ContinuityActivationStatus.RESTORED,
        afterActionDueAt: { lt: now },
        reminderSentAt: null,
      },
      select: { id: true, organizationId: true, coordinatorId: true, reference: true },
    }),
    prisma.continuityImprovement.findMany({
      where: {
        status: { in: [ContinuityImprovementStatus.OPEN, ContinuityImprovementStatus.IN_PROGRESS] },
        dueAt: { lt: now },
        reminderSentAt: null,
      },
      select: { id: true, organizationId: true, planId: true, ownerId: true, title: true },
    }),
  ]);
  let notificationsSent = 0;
  for (const plan of plans) {
    const sent = await createNotification({
      organizationId: plan.organizationId,
      userId: plan.ownerId,
      type: plan.reviewDueAt < now ? NotificationType.CRITICAL : NotificationType.DUE_DATE,
      title: `Continuity plan review ${plan.reviewDueAt < now ? "overdue" : "due soon"}`,
      message: `${plan.reference} — ${plan.title}`,
      link: `/business-continuity/plans/${plan.id}`,
    }).catch(() => null);
    if (sent) {
      await prisma.businessContinuityPlan.update({ where: { id: plan.id }, data: { reviewReminderAt: now } });
      notificationsSent++;
    }
  }
  for (const analysis of analyses) {
    const sent = await createNotification({
      organizationId: analysis.organizationId,
      userId: analysis.ownerId,
      type: analysis.reviewDueAt < now ? NotificationType.CRITICAL : NotificationType.DUE_DATE,
      title: `Business impact analysis review ${analysis.reviewDueAt < now ? "overdue" : "due soon"}`,
      message: `${analysis.reference} — ${analysis.processName}`,
      link: `/business-continuity/plans/${analysis.planId}`,
    }).catch(() => null);
    if (sent) {
      await prisma.businessImpactAnalysis.update({ where: { id: analysis.id }, data: { reviewReminderAt: now } });
      notificationsSent++;
    }
  }
  for (const exercise of exercises) {
    const sent = await createNotification({
      organizationId: exercise.organizationId,
      userId: exercise.leadId,
      type: exercise.scheduledAt < now ? NotificationType.CRITICAL : NotificationType.DUE_DATE,
      title: `Continuity exercise ${exercise.scheduledAt < now ? "overdue" : "due within 24 hours"}`,
      message: exercise.reference,
      link: `/business-continuity/exercises/${exercise.id}`,
    }).catch(() => null);
    if (sent) {
      await prisma.continuityExercise.update({ where: { id: exercise.id }, data: { reminderSentAt: now } });
      notificationsSent++;
    }
  }
  for (const activation of activations) {
    const sent = await createNotification({
      organizationId: activation.organizationId,
      userId: activation.coordinatorId,
      type: NotificationType.CRITICAL,
      title: "Continuity after-action review overdue",
      message: activation.reference,
      link: `/business-continuity/activations/${activation.id}`,
    }).catch(() => null);
    if (sent) {
      await prisma.continuityActivation.update({ where: { id: activation.id }, data: { reminderSentAt: now } });
      notificationsSent++;
    }
  }
  for (const improvement of improvements) {
    const sent = await createNotification({
      organizationId: improvement.organizationId,
      userId: improvement.ownerId,
      type: NotificationType.CRITICAL,
      title: "Continuity improvement overdue",
      message: improvement.title,
      link: `/business-continuity/plans/${improvement.planId}`,
    }).catch(() => null);
    if (sent) {
      await prisma.continuityImprovement.update({ where: { id: improvement.id }, data: { reminderSentAt: now } });
      notificationsSent++;
    }
  }
  return {
    planReviews: plans.length,
    analysisReviews: analyses.length,
    exercises: exercises.length,
    afterActionReviews: activations.length,
    overdueImprovements: improvements.length,
    notificationsSent,
  };
}

async function validatePlanScope(input: ContinuityPlanInput, actorId: string) {
  const [actor, site, department, owner] = await Promise.all([
    tenantUser(input.organizationId, actorId),
    input.siteId
      ? prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId }, select: { id: true } })
      : null,
    input.departmentId
      ? prisma.department.findFirst({
          where: { id: input.departmentId, site: { organizationId: input.organizationId } },
          select: { id: true, siteId: true },
        })
      : null,
    tenantUser(input.organizationId, input.ownerId),
  ]);
  if (!actor || !owner || (input.siteId && !site) || (input.departmentId && !department)) {
    throw new Error("Select valid tenant plan ownership and scope values.");
  }
  if (department && (!site || department.siteId !== site.id)) {
    throw new Error("A department-scoped plan must use the department's site.");
  }
  return { site, department, owner };
}

async function requireEditablePlan(organizationId: string, planId: string) {
  const plan = await prisma.businessContinuityPlan.findFirst({
    where: { id: planId, organizationId },
    select: { id: true, reference: true, version: true, status: true },
  });
  if (!plan) throw new Error("The business continuity plan was not found.");
  if (plan.status !== ContinuityPlanStatus.DRAFT && plan.status !== ContinuityPlanStatus.REJECTED) {
    throw new Error("Only draft or rejected plan versions can be edited.");
  }
  return plan;
}

async function tenantUser(organizationId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true, name: true },
  });
}

async function tenantExercise(organizationId: string, exerciseId: string) {
  const exercise = await prisma.continuityExercise.findFirst({ where: { id: exerciseId, organizationId } });
  if (!exercise) throw new Error("The business continuity exercise was not found.");
  return exercise;
}

async function tenantActivation(organizationId: string, activationId: string) {
  const activation = await prisma.continuityActivation.findFirst({ where: { id: activationId, organizationId } });
  if (!activation) throw new Error("The business continuity activation was not found.");
  return activation;
}

function validateFutureDate(value: Date, label: string) {
  if (value <= new Date()) throw new Error(`${label} must be in the future.`);
}

function validateOptionalWholeHours(value: number | null, label: string) {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 87_600)) {
    throw new Error(`${label} must be between 0 and 87,600 hours.`);
  }
}

function normalizedReference(value: string, prefix: string) {
  const normalized = boundedRequired(value, 80, "Reference")
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]/g, "-")
    .replace(/-+/g, "-");
  if (!/^[A-Z0-9]/.test(normalized)) {
    return `${prefix}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return normalized;
}

function boundedRequired(value: string, max: number, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}

function bounded(value: string | null | undefined, max: number, label: string) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}

function activityData(
  organizationId: string,
  userId: string,
  data: {
    action: ActivityAction;
    entityType: string;
    entityId: string;
    title: string;
    description?: string | null;
    metadata?: Prisma.InputJsonObject;
  },
) {
  return {
    organizationId,
    userId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    title: data.title,
    description: data.description,
    metadata: data.metadata,
  };
}

function activity(
  organizationId: string,
  userId: string,
  data: Parameters<typeof activityData>[2],
) {
  return prisma.activityLog.create({ data: activityData(organizationId, userId, data) });
}
