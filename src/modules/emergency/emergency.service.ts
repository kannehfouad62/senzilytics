import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  assertEmergencyActivationTransition,
  assertEmergencyDrillTransition,
  assertEmergencyImprovementTransition,
  assertEmergencyPlanTransition,
  emergencyDrillCompletionIssues,
  emergencyPlanReadinessIssues,
  emergencyReadinessScore,
} from "@/modules/emergency/emergency-lifecycle";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  EmergencyActivationStatus,
  EmergencyContactType,
  EmergencyDrillRating,
  EmergencyDrillStatus,
  EmergencyDrillType,
  EmergencyImprovementStatus,
  EmergencyPlanStatus,
  EmergencyPlanType,
  EmergencyScenarioCategory,
  NotificationType,
  Prisma,
  RiskLevel,
  Status,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

type Actor = { id: string };

type EmergencyPlanInput = {
  organizationId: string;
  siteId: string;
  departmentId: string | null;
  ownerId: string;
  reference: string;
  title: string;
  type: EmergencyPlanType;
  scope: string;
  purpose: string | null;
  hazardProfile: string;
  commandStructure: string;
  communicationProcedure: string;
  evacuationProcedure: string;
  shelterProcedure: string | null;
  accountabilityProcedure: string;
  medicalProcedure: string | null;
  externalCoordination: string | null;
  recoveryCriteria: string;
  reviewDueAt: Date;
};

export async function createEmergencyPlanService(
  input: EmergencyPlanInput & { customSubmissions?: PreparedSubmission[] },
  actor: Actor,
) {
  const scope = await validatePlanScope(input, actor.id);
  if (input.reviewDueAt <= new Date()) {
    throw new Error("The next plan review date must be in the future.");
  }
  return prisma.$transaction(async (tx) => {
    const plan = await tx.emergencyPlan.create({
      data: {
        organizationId: input.organizationId,
        siteId: scope.site.id,
        departmentId: scope.department?.id ?? null,
        ownerId: scope.owner.id,
        createdById: actor.id,
        reference: normalizedReference(input.reference),
        title: boundedRequired(input.title, 200, "Plan title"),
        type: input.type,
        scope: boundedRequired(input.scope, 4_000, "Scope"),
        purpose: bounded(input.purpose, 2_000, "Purpose"),
        hazardProfile: boundedRequired(
          input.hazardProfile,
          4_000,
          "Hazard profile",
        ),
        commandStructure: boundedRequired(
          input.commandStructure,
          4_000,
          "Command structure",
        ),
        communicationProcedure: boundedRequired(
          input.communicationProcedure,
          4_000,
          "Communication procedure",
        ),
        evacuationProcedure: boundedRequired(
          input.evacuationProcedure,
          4_000,
          "Evacuation procedure",
        ),
        shelterProcedure: bounded(
          input.shelterProcedure,
          4_000,
          "Shelter procedure",
        ),
        accountabilityProcedure: boundedRequired(
          input.accountabilityProcedure,
          4_000,
          "Accountability procedure",
        ),
        medicalProcedure: bounded(
          input.medicalProcedure,
          4_000,
          "Medical procedure",
        ),
        externalCoordination: bounded(
          input.externalCoordination,
          4_000,
          "External coordination",
        ),
        recoveryCriteria: boundedRequired(
          input.recoveryCriteria,
          4_000,
          "Recovery criteria",
        ),
        reviewDueAt: input.reviewDueAt,
      },
    });
    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: actor.id,
      module: ConfigurableFormModule.EMERGENCY_PREPAREDNESS,
      entityId: plan.id,
      submissions: input.customSubmissions ?? [],
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyPlan",
        entityId: plan.id,
        title: "Emergency plan created",
        description: `${plan.reference} v${plan.version} — ${plan.title}`,
        metadata: {
          siteId: plan.siteId,
          departmentId: plan.departmentId,
          ownerId: plan.ownerId,
          type: plan.type,
        },
      },
    });
    return plan;
  });
}

export async function updateEmergencyPlanService(
  input: EmergencyPlanInput & { planId: string },
  actor: Actor,
) {
  const [plan, scope] = await Promise.all([
    requireEditablePlan(input.organizationId, input.planId),
    validatePlanScope(input, actor.id),
  ]);
  if (input.reviewDueAt <= new Date()) {
    throw new Error("The next plan review date must be in the future.");
  }
  await prisma.$transaction([
    prisma.emergencyPlan.update({
      where: { id: plan.id },
      data: {
        siteId: scope.site.id,
        departmentId: scope.department?.id ?? null,
        ownerId: scope.owner.id,
        title: boundedRequired(input.title, 200, "Plan title"),
        type: input.type,
        scope: boundedRequired(input.scope, 4_000, "Scope"),
        purpose: bounded(input.purpose, 2_000, "Purpose"),
        hazardProfile: boundedRequired(
          input.hazardProfile,
          4_000,
          "Hazard profile",
        ),
        commandStructure: boundedRequired(
          input.commandStructure,
          4_000,
          "Command structure",
        ),
        communicationProcedure: boundedRequired(
          input.communicationProcedure,
          4_000,
          "Communication procedure",
        ),
        evacuationProcedure: boundedRequired(
          input.evacuationProcedure,
          4_000,
          "Evacuation procedure",
        ),
        shelterProcedure: bounded(
          input.shelterProcedure,
          4_000,
          "Shelter procedure",
        ),
        accountabilityProcedure: boundedRequired(
          input.accountabilityProcedure,
          4_000,
          "Accountability procedure",
        ),
        medicalProcedure: bounded(
          input.medicalProcedure,
          4_000,
          "Medical procedure",
        ),
        externalCoordination: bounded(
          input.externalCoordination,
          4_000,
          "External coordination",
        ),
        recoveryCriteria: boundedRequired(
          input.recoveryCriteria,
          4_000,
          "Recovery criteria",
        ),
        reviewDueAt: input.reviewDueAt,
        reviewReminderAt: null,
        ...(plan.status === EmergencyPlanStatus.REJECTED
          ? {
              status: EmergencyPlanStatus.DRAFT,
              submittedById: null,
              submittedAt: null,
              approvedById: null,
              approvedAt: null,
              rejectedAt: null,
            }
          : {}),
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.UPDATE,
        entityType: "EmergencyPlan",
        entityId: plan.id,
        title: "Emergency plan updated",
        description: `${plan.reference} v${plan.version}`,
      },
    }),
  ]);
}

export async function addEmergencyScenarioService(
  input: {
    organizationId: string;
    planId: string;
    category: EmergencyScenarioCategory;
    riskLevel: RiskLevel;
    title: string;
    triggerCriteria: string;
    immediateActions: string;
    protectiveActions: string;
    evacuationAreas: string | null;
    musterPoints: string | null;
    shutdownSteps: string | null;
    requiredEquipment: string | null;
    specialAssistance: string | null;
    externalAgencies: string | null;
    evacuationRequired: boolean;
    shelterInPlace: boolean;
    sequence: number;
  },
  actor: Actor,
) {
  const plan = await requireEditablePlan(input.organizationId, input.planId);
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new Error("Scenario sequence must be a non-negative whole number.");
  }
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.emergencyScenario.create({
      data: {
        planId: plan.id,
        category: input.category,
        riskLevel: input.riskLevel,
        title: boundedRequired(input.title, 200, "Scenario title"),
        triggerCriteria: boundedRequired(
          input.triggerCriteria,
          3_000,
          "Trigger criteria",
        ),
        immediateActions: boundedRequired(
          input.immediateActions,
          4_000,
          "Immediate actions",
        ),
        protectiveActions: boundedRequired(
          input.protectiveActions,
          4_000,
          "Protective actions",
        ),
        evacuationAreas: bounded(
          input.evacuationAreas,
          2_000,
          "Evacuation areas",
        ),
        musterPoints: bounded(input.musterPoints, 2_000, "Muster points"),
        shutdownSteps: bounded(input.shutdownSteps, 3_000, "Shutdown steps"),
        requiredEquipment: bounded(
          input.requiredEquipment,
          2_000,
          "Required equipment",
        ),
        specialAssistance: bounded(
          input.specialAssistance,
          2_000,
          "Special assistance",
        ),
        externalAgencies: bounded(
          input.externalAgencies,
          2_000,
          "External agencies",
        ),
        evacuationRequired: input.evacuationRequired,
        shelterInPlace: input.shelterInPlace,
        sequence: input.sequence,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyScenario",
        entityId: scenario.id,
        title: "Emergency scenario added",
        description: `${plan.reference} — ${scenario.title}`,
        metadata: {
          planId: plan.id,
          category: scenario.category,
          riskLevel: scenario.riskLevel,
        },
      },
    });
    return scenario;
  });
}

export async function setEmergencyScenarioActiveService(
  input: {
    organizationId: string;
    planId: string;
    scenarioId: string;
    isActive: boolean;
    reason: string;
  },
  actor: Actor,
) {
  await requireEditablePlan(input.organizationId, input.planId);
  const scenario = await prisma.emergencyScenario.findFirst({
    where: { id: input.scenarioId, planId: input.planId },
  });
  if (!scenario) throw new Error("The emergency scenario was not found.");
  const reason = boundedRequired(input.reason, 1_000, "Change reason");
  await prisma.$transaction([
    prisma.emergencyScenario.update({
      where: { id: scenario.id },
      data: { isActive: input.isActive },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "EmergencyScenario",
        entityId: scenario.id,
        title: `Emergency scenario ${input.isActive ? "enabled" : "disabled"}`,
        description: reason,
        metadata: { planId: input.planId, isActive: input.isActive },
      },
    }),
  ]);
}

export async function addEmergencyContactService(
  input: {
    organizationId: string;
    planId: string;
    type: EmergencyContactType;
    name: string;
    role: string | null;
    organizationName: string | null;
    phone: string;
    alternatePhone: string | null;
    email: string | null;
    availability: string | null;
    priority: number;
  },
  actor: Actor,
) {
  const plan = await requireEditablePlan(input.organizationId, input.planId);
  if (!Number.isInteger(input.priority) || input.priority < 0) {
    throw new Error("Contact priority must be a non-negative whole number.");
  }
  const email = bounded(input.email, 320, "Email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid emergency contact email.");
  }
  return prisma.$transaction(async (tx) => {
    const contact = await tx.emergencyContact.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        type: input.type,
        name: boundedRequired(input.name, 160, "Contact name"),
        role: bounded(input.role, 160, "Contact role"),
        organizationName: bounded(
          input.organizationName,
          200,
          "Contact organization",
        ),
        phone: boundedRequired(input.phone, 80, "Phone"),
        alternatePhone: bounded(
          input.alternatePhone,
          80,
          "Alternate phone",
        ),
        email,
        availability: bounded(input.availability, 500, "Availability"),
        priority: input.priority,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyContact",
        entityId: contact.id,
        title: "Emergency contact added",
        description: `${plan.reference} — ${contact.name}`,
        metadata: { planId: plan.id, type: contact.type },
      },
    });
    return contact;
  });
}

export async function setEmergencyContactActiveService(
  input: {
    organizationId: string;
    planId: string;
    contactId: string;
    isActive: boolean;
    reason: string;
  },
  actor: Actor,
) {
  await requireEditablePlan(input.organizationId, input.planId);
  const contact = await prisma.emergencyContact.findFirst({
    where: {
      id: input.contactId,
      planId: input.planId,
      organizationId: input.organizationId,
    },
  });
  if (!contact) throw new Error("The emergency contact was not found.");
  await prisma.$transaction([
    prisma.emergencyContact.update({
      where: { id: contact.id },
      data: { isActive: input.isActive },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "EmergencyContact",
        entityId: contact.id,
        title: `Emergency contact ${input.isActive ? "enabled" : "disabled"}`,
        description: boundedRequired(input.reason, 1_000, "Change reason"),
        metadata: { planId: input.planId, isActive: input.isActive },
      },
    }),
  ]);
}

export async function submitEmergencyPlanService(
  input: { organizationId: string; planId: string; submissionNotes: string },
  actor: Actor,
) {
  const plan = await prisma.emergencyPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId },
    include: {
      scenarios: { where: { isActive: true }, select: { id: true } },
      contacts: { where: { isActive: true }, select: { id: true } },
    },
  });
  if (!plan) throw new Error("The emergency plan was not found.");
  assertEmergencyPlanTransition(
    plan.status,
    EmergencyPlanStatus.IN_REVIEW,
  );
  const issues = emergencyPlanReadinessIssues({
    reviewDueAt: plan.reviewDueAt,
    scope: plan.scope,
    hazardProfile: plan.hazardProfile,
    commandStructure: plan.commandStructure,
    communicationProcedure: plan.communicationProcedure,
    evacuationProcedure: plan.evacuationProcedure,
    accountabilityProcedure: plan.accountabilityProcedure,
    recoveryCriteria: plan.recoveryCriteria,
    activeScenarioCount: plan.scenarios.length,
    activeContactCount: plan.contacts.length,
  });
  if (issues.length) throw new Error(issues.join(" "));
  const notes = boundedRequired(
    input.submissionNotes,
    2_000,
    "Submission notes",
  );
  await prisma.$transaction([
    prisma.emergencyPlan.update({
      where: { id: plan.id },
      data: {
        status: EmergencyPlanStatus.IN_REVIEW,
        submittedById: actor.id,
        submittedAt: new Date(),
        approvedById: null,
        approvedAt: null,
        rejectedAt: null,
      },
    }),
    prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "EmergencyPlan",
        entityId: plan.id,
        title: "Emergency plan submitted for approval",
        description: notes,
        metadata: {
          reference: plan.reference,
          version: plan.version,
          previousStatus: plan.status,
          status: EmergencyPlanStatus.IN_REVIEW,
        },
      },
    }),
  ]);
}

export async function decideEmergencyPlanService(
  input: {
    organizationId: string;
    planId: string;
    decision: EmergencyPlanStatus;
    reviewNotes: string;
  },
  actor: Actor,
) {
  const plan = await prisma.emergencyPlan.findFirst({
    where: { id: input.planId, organizationId: input.organizationId },
  });
  if (!plan) throw new Error("The emergency plan was not found.");
  if (
    input.decision !== EmergencyPlanStatus.ACTIVE &&
    input.decision !== EmergencyPlanStatus.REJECTED
  ) {
    throw new Error("Select approve or reject.");
  }
  assertEmergencyPlanTransition(plan.status, input.decision);
  const notes = boundedRequired(input.reviewNotes, 2_000, "Review rationale");
  if (notes.length < 20) {
    throw new Error("Document at least 20 characters of review rationale.");
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (input.decision === EmergencyPlanStatus.ACTIVE) {
      await tx.emergencyPlan.updateMany({
        where: {
          organizationId: input.organizationId,
          reference: plan.reference,
          status: EmergencyPlanStatus.ACTIVE,
          id: { not: plan.id },
        },
        data: { status: EmergencyPlanStatus.ARCHIVED, archivedAt: now },
      });
    }
    await tx.emergencyPlan.update({
      where: { id: plan.id },
      data: {
        status: input.decision,
        approvedById:
          input.decision === EmergencyPlanStatus.ACTIVE ? actor.id : null,
        approvedAt:
          input.decision === EmergencyPlanStatus.ACTIVE ? now : null,
        effectiveAt:
          input.decision === EmergencyPlanStatus.ACTIVE ? now : null,
        rejectedAt:
          input.decision === EmergencyPlanStatus.REJECTED ? now : null,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "EmergencyPlan",
        entityId: plan.id,
        title: `Emergency plan ${input.decision === EmergencyPlanStatus.ACTIVE ? "approved" : "rejected"}`,
        description: notes,
        metadata: {
          reference: plan.reference,
          version: plan.version,
          previousStatus: plan.status,
          status: input.decision,
        },
      },
    });
  });
}

export async function createEmergencyPlanRevisionService(
  input: { organizationId: string; planId: string; reason: string },
  actor: Actor,
) {
  const plan = await prisma.emergencyPlan.findFirst({
    where: {
      id: input.planId,
      organizationId: input.organizationId,
      status: EmergencyPlanStatus.ACTIVE,
    },
    include: { scenarios: true, contacts: true },
  });
  if (!plan) throw new Error("Only an active emergency plan can be revised.");
  const existingRevision = await prisma.emergencyPlan.findFirst({
    where: { previousVersionId: plan.id },
    select: { id: true },
  });
  if (existingRevision) return existingRevision;
  const latest = await prisma.emergencyPlan.aggregate({
    where: {
      organizationId: input.organizationId,
      reference: plan.reference,
    },
    _max: { version: true },
  });
  const reason = boundedRequired(input.reason, 1_000, "Revision reason");
  return prisma.$transaction(async (tx) => {
    const revision = await tx.emergencyPlan.create({
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
        purpose: plan.purpose,
        hazardProfile: plan.hazardProfile,
        commandStructure: plan.commandStructure,
        communicationProcedure: plan.communicationProcedure,
        evacuationProcedure: plan.evacuationProcedure,
        shelterProcedure: plan.shelterProcedure,
        accountabilityProcedure: plan.accountabilityProcedure,
        medicalProcedure: plan.medicalProcedure,
        externalCoordination: plan.externalCoordination,
        recoveryCriteria: plan.recoveryCriteria,
        reviewDueAt: plan.reviewDueAt,
        scenarios: {
          create: plan.scenarios.map((scenario) => ({
            category: scenario.category,
            riskLevel: scenario.riskLevel,
            title: scenario.title,
            triggerCriteria: scenario.triggerCriteria,
            immediateActions: scenario.immediateActions,
            protectiveActions: scenario.protectiveActions,
            evacuationAreas: scenario.evacuationAreas,
            musterPoints: scenario.musterPoints,
            shutdownSteps: scenario.shutdownSteps,
            requiredEquipment: scenario.requiredEquipment,
            specialAssistance: scenario.specialAssistance,
            externalAgencies: scenario.externalAgencies,
            evacuationRequired: scenario.evacuationRequired,
            shelterInPlace: scenario.shelterInPlace,
            sequence: scenario.sequence,
            isActive: scenario.isActive,
          })),
        },
        contacts: {
          create: plan.contacts.map((contact) => ({
            organizationId: plan.organizationId,
            type: contact.type,
            name: contact.name,
            role: contact.role,
            organizationName: contact.organizationName,
            phone: contact.phone,
            alternatePhone: contact.alternatePhone,
            email: contact.email,
            availability: contact.availability,
            priority: contact.priority,
            isActive: contact.isActive,
          })),
        },
      },
      select: { id: true, version: true },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyPlan",
        entityId: revision.id,
        title: "Emergency plan revision started",
        description: reason,
        metadata: {
          previousPlanId: plan.id,
          reference: plan.reference,
          version: revision.version,
        },
      },
    });
    return revision;
  });
}

export async function scheduleEmergencyDrillService(
  input: {
    organizationId: string;
    planId: string;
    scenarioId: string | null;
    leadId: string;
    reference: string;
    type: EmergencyDrillType;
    scheduledAt: Date;
    objectives: string;
    scope: string | null;
    expectedParticipants: number;
  },
  actor: Actor,
) {
  const [plan, lead] = await Promise.all([
    prisma.emergencyPlan.findFirst({
      where: {
        id: input.planId,
        organizationId: input.organizationId,
        status: EmergencyPlanStatus.ACTIVE,
      },
      select: { id: true },
    }),
    tenantUser(input.organizationId, input.leadId),
  ]);
  if (!plan || !lead) {
    throw new Error("Select an active emergency plan and tenant drill lead.");
  }
  if (input.scenarioId) {
    const scenario = await prisma.emergencyScenario.findFirst({
      where: {
        id: input.scenarioId,
        planId: plan.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!scenario) throw new Error("Select an active scenario from this plan.");
  }
  if (input.scheduledAt <= new Date()) {
    throw new Error("Drill date must be in the future.");
  }
  if (
    !Number.isInteger(input.expectedParticipants) ||
    input.expectedParticipants < 1 ||
    input.expectedParticipants > 100_000
  ) {
    throw new Error("Expected participants must be between 1 and 100,000.");
  }
  return prisma.$transaction(async (tx) => {
    const drill = await tx.emergencyDrill.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        scenarioId: input.scenarioId,
        leadId: lead.id,
        createdById: actor.id,
        reference: normalizedReference(input.reference),
        type: input.type,
        scheduledAt: input.scheduledAt,
        objectives: boundedRequired(input.objectives, 3_000, "Drill objectives"),
        scope: bounded(input.scope, 2_000, "Drill scope"),
        expectedParticipants: input.expectedParticipants,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyDrill",
        entityId: drill.id,
        title: "Emergency drill scheduled",
        description: `${drill.reference} — ${drill.type.replaceAll("_", " ")}`,
        metadata: {
          planId: plan.id,
          leadId: lead.id,
          scheduledAt: drill.scheduledAt,
        },
      },
    });
    return drill;
  });
}

export async function startEmergencyDrillService(
  input: { organizationId: string; drillId: string; note: string },
  actor: Actor,
) {
  const drill = await tenantDrill(input.organizationId, input.drillId);
  assertEmergencyDrillTransition(
    drill.status,
    EmergencyDrillStatus.IN_PROGRESS,
  );
  await prisma.$transaction([
    prisma.emergencyDrill.update({
      where: { id: drill.id },
      data: { status: EmergencyDrillStatus.IN_PROGRESS, startedAt: new Date() },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "EmergencyDrill",
      entityId: drill.id,
      title: "Emergency drill started",
      description: boundedRequired(input.note, 1_000, "Start note"),
      metadata: {
        previousStatus: drill.status,
        status: EmergencyDrillStatus.IN_PROGRESS,
      },
    }),
  ]);
}

export async function completeEmergencyDrillService(
  input: {
    organizationId: string;
    drillId: string;
    actualParticipants: number;
    notificationMethod: string | null;
    alarmActivationSeconds: number | null;
    evacuationSeconds: number | null;
    accountabilitySeconds: number | null;
    rating: EmergencyDrillRating;
    strengths: string;
    gaps: string;
    observerNotes: string | null;
    afterActionSummary: string;
  },
  actor: Actor,
) {
  const drill = await tenantDrill(input.organizationId, input.drillId);
  assertEmergencyDrillTransition(drill.status, EmergencyDrillStatus.COMPLETED);
  const issues = emergencyDrillCompletionIssues(input);
  if (issues.length) throw new Error(issues.join(" "));
  const now = new Date();
  await prisma.$transaction([
    prisma.emergencyDrill.update({
      where: { id: drill.id },
      data: {
        status: EmergencyDrillStatus.COMPLETED,
        completedAt: now,
        actualParticipants: input.actualParticipants,
        notificationMethod: bounded(
          input.notificationMethod,
          1_000,
          "Notification method",
        ),
        alarmActivationSeconds: input.alarmActivationSeconds,
        evacuationSeconds: input.evacuationSeconds,
        accountabilitySeconds: input.accountabilitySeconds,
        rating: input.rating,
        strengths: boundedRequired(input.strengths, 4_000, "Strengths"),
        gaps: boundedRequired(input.gaps, 4_000, "Gaps"),
        observerNotes: bounded(
          input.observerNotes,
          4_000,
          "Observer notes",
        ),
        afterActionSummary: boundedRequired(
          input.afterActionSummary,
          4_000,
          "After-action summary",
        ),
        reviewedById: actor.id,
        reviewedAt: now,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "EmergencyDrill",
      entityId: drill.id,
      title: "Emergency drill completed",
      description: `${drill.reference} — ${input.rating.replaceAll("_", " ")}`,
      metadata: {
        previousStatus: drill.status,
        status: EmergencyDrillStatus.COMPLETED,
        rating: input.rating,
        actualParticipants: input.actualParticipants,
      },
    }),
  ]);
}

export async function cancelEmergencyDrillService(
  input: { organizationId: string; drillId: string; reason: string },
  actor: Actor,
) {
  const drill = await tenantDrill(input.organizationId, input.drillId);
  assertEmergencyDrillTransition(drill.status, EmergencyDrillStatus.CANCELLED);
  const reason = boundedRequired(input.reason, 2_000, "Cancellation reason");
  await prisma.$transaction([
    prisma.emergencyDrill.update({
      where: { id: drill.id },
      data: {
        status: EmergencyDrillStatus.CANCELLED,
        cancelledReason: reason,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "EmergencyDrill",
      entityId: drill.id,
      title: "Emergency drill cancelled",
      description: reason,
      metadata: {
        previousStatus: drill.status,
        status: EmergencyDrillStatus.CANCELLED,
      },
    }),
  ]);
}

export async function activateEmergencyResponseService(
  input: {
    organizationId: string;
    planId: string;
    scenarioId: string | null;
    incidentCommanderId: string;
    reference: string;
    severity: RiskLevel;
    location: string;
    summary: string;
    declaredAt: Date;
    notificationMethod: string;
    protectiveActions: string;
    externalAgenciesNotified: string | null;
    peopleAtRisk: number;
    injuriesReported: number;
    missingPersons: number;
    afterActionDueAt: Date;
  },
  actor: Actor,
) {
  const [plan, commander] = await Promise.all([
    prisma.emergencyPlan.findFirst({
      where: {
        id: input.planId,
        organizationId: input.organizationId,
        status: EmergencyPlanStatus.ACTIVE,
      },
      select: { id: true, ownerId: true, reference: true },
    }),
    tenantUser(input.organizationId, input.incidentCommanderId),
  ]);
  if (!plan || !commander) {
    throw new Error("Select an active emergency plan and tenant incident commander.");
  }
  if (input.scenarioId) {
    const scenario = await prisma.emergencyScenario.findFirst({
      where: {
        id: input.scenarioId,
        planId: plan.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!scenario) throw new Error("Select an active scenario from this plan.");
  }
  if (input.declaredAt.getTime() > Date.now() + 5 * 60_000) {
    throw new Error("Declaration time cannot be in the future.");
  }
  if (input.afterActionDueAt <= input.declaredAt) {
    throw new Error("After-action review due date must follow the declaration.");
  }
  validateCounts(
    input.peopleAtRisk,
    input.injuriesReported,
    input.missingPersons,
  );
  const activation = await prisma.$transaction(async (tx) => {
    const created = await tx.emergencyActivation.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        scenarioId: input.scenarioId,
        declaredById: actor.id,
        incidentCommanderId: commander.id,
        reference: normalizedReference(input.reference),
        severity: input.severity,
        location: boundedRequired(input.location, 500, "Location"),
        summary: boundedRequired(input.summary, 4_000, "Situation summary"),
        declaredAt: input.declaredAt,
        notificationMethod: boundedRequired(
          input.notificationMethod,
          2_000,
          "Notification method",
        ),
        protectiveActions: boundedRequired(
          input.protectiveActions,
          4_000,
          "Protective actions",
        ),
        externalAgenciesNotified: bounded(
          input.externalAgenciesNotified,
          2_000,
          "External agencies notified",
        ),
        peopleAtRisk: input.peopleAtRisk,
        injuriesReported: input.injuriesReported,
        missingPersons: input.missingPersons,
        afterActionDueAt: input.afterActionDueAt,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyActivation",
        entityId: created.id,
        title: "Emergency response activated",
        description: `${created.reference} — ${created.summary}`,
        metadata: {
          planId: plan.id,
          severity: created.severity,
          incidentCommanderId: created.incidentCommanderId,
          declaredAt: created.declaredAt,
        },
      },
    });
    return created;
  });
  const recipients = new Set([plan.ownerId, commander.id]);
  await Promise.all(
    Array.from(recipients).map((userId) =>
      createNotification({
        organizationId: input.organizationId,
        userId,
        type: NotificationType.CRITICAL,
        title: "Emergency response record activated",
        message:
          `${activation.reference} — ${activation.location}. ` +
          "Use site alarms, emergency services, and approved response channels for life-safety instructions.",
        link: `/emergency/activations/${activation.id}`,
      }).catch(() => null),
    ),
  );
  return activation;
}

export async function updateEmergencyActivationSituationService(
  input: {
    organizationId: string;
    activationId: string;
    summary: string;
    notificationMethod: string;
    protectiveActions: string;
    externalAgenciesNotified: string | null;
    peopleAtRisk: number;
    injuriesReported: number;
    missingPersons: number;
  },
  actor: Actor,
) {
  const activation = await tenantActivation(
    input.organizationId,
    input.activationId,
  );
  if (
    activation.status !== EmergencyActivationStatus.ACTIVE &&
    activation.status !== EmergencyActivationStatus.STABILIZED
  ) {
    throw new Error("A stood-down emergency record cannot be edited.");
  }
  validateCounts(
    input.peopleAtRisk,
    input.injuriesReported,
    input.missingPersons,
  );
  await prisma.$transaction([
    prisma.emergencyActivation.update({
      where: { id: activation.id },
      data: {
        summary: boundedRequired(input.summary, 4_000, "Situation summary"),
        notificationMethod: boundedRequired(
          input.notificationMethod,
          2_000,
          "Notification method",
        ),
        protectiveActions: boundedRequired(
          input.protectiveActions,
          4_000,
          "Protective actions",
        ),
        externalAgenciesNotified: bounded(
          input.externalAgenciesNotified,
          2_000,
          "External agencies notified",
        ),
        peopleAtRisk: input.peopleAtRisk,
        injuriesReported: input.injuriesReported,
        missingPersons: input.missingPersons,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.UPDATE,
      entityType: "EmergencyActivation",
      entityId: activation.id,
      title: "Emergency situation record updated",
      description: `${activation.reference} — ${input.summary}`,
      metadata: {
        status: activation.status,
        injuriesReported: input.injuriesReported,
        missingPersons: input.missingPersons,
      },
    }),
  ]);
}

export async function transitionEmergencyActivationService(
  input: {
    organizationId: string;
    activationId: string;
    status: EmergencyActivationStatus;
    note: string;
    afterActionSummary: string | null;
    lessonsLearned: string | null;
  },
  actor: Actor,
) {
  const activation = await tenantActivation(
    input.organizationId,
    input.activationId,
  );
  assertEmergencyActivationTransition(activation.status, input.status);
  const note = boundedRequired(input.note, 2_000, "Transition note");
  if (
    input.status === EmergencyActivationStatus.STOOD_DOWN &&
    activation.missingPersons > 0
  ) {
    throw new Error(
      "Update the situation record to resolve missing-person accountability before stand-down.",
    );
  }
  if (input.status === EmergencyActivationStatus.REVIEWED) {
    if ((input.afterActionSummary?.trim().length ?? 0) < 30) {
      throw new Error("Record an after-action summary of at least 30 characters.");
    }
    if ((input.lessonsLearned?.trim().length ?? 0) < 20) {
      throw new Error("Document lessons learned with at least 20 characters.");
    }
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.emergencyActivation.update({
      where: { id: activation.id },
      data: {
        status: input.status,
        stabilizedAt:
          input.status === EmergencyActivationStatus.STABILIZED
            ? now
            : input.status === EmergencyActivationStatus.ACTIVE
              ? null
              : activation.stabilizedAt,
        stoodDownAt:
          input.status === EmergencyActivationStatus.STOOD_DOWN
            ? now
            : activation.stoodDownAt,
        stoodDownById:
          input.status === EmergencyActivationStatus.STOOD_DOWN
            ? actor.id
            : activation.stoodDownById,
        stoodDownRationale:
          input.status === EmergencyActivationStatus.STOOD_DOWN
            ? note
            : activation.stoodDownRationale,
        reviewedAt:
          input.status === EmergencyActivationStatus.REVIEWED
            ? now
            : null,
        reviewedById:
          input.status === EmergencyActivationStatus.REVIEWED
            ? actor.id
            : null,
        afterActionSummary:
          input.status === EmergencyActivationStatus.REVIEWED
            ? bounded(
                input.afterActionSummary,
                4_000,
                "After-action summary",
              )
            : activation.afterActionSummary,
        lessonsLearned:
          input.status === EmergencyActivationStatus.REVIEWED
            ? bounded(input.lessonsLearned, 4_000, "Lessons learned")
            : activation.lessonsLearned,
      },
    }),
    activity(input.organizationId, actor.id, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "EmergencyActivation",
      entityId: activation.id,
      title: `Emergency response moved to ${input.status.replaceAll("_", " ").toLowerCase()}`,
      description: note,
      metadata: {
        previousStatus: activation.status,
        status: input.status,
      },
    }),
  ]);
}

export async function createEmergencyImprovementService(
  input: {
    organizationId: string;
    planId: string;
    drillId: string | null;
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
    prisma.emergencyPlan.findFirst({
      where: { id: input.planId, organizationId: input.organizationId },
      select: { id: true },
    }),
    tenantUser(input.organizationId, input.ownerId),
  ]);
  if (!plan || !owner) {
    throw new Error("Select a valid tenant emergency plan and action owner.");
  }
  if (input.drillId && input.activationId) {
    throw new Error("Select only one drill or activation as the action source.");
  }
  if (input.drillId) {
    const drill = await prisma.emergencyDrill.findFirst({
      where: {
        id: input.drillId,
        organizationId: input.organizationId,
        planId: plan.id,
        status: EmergencyDrillStatus.COMPLETED,
      },
      select: { id: true },
    });
    if (!drill) throw new Error("Select a completed drill from this plan.");
  }
  if (input.activationId) {
    const activation = await prisma.emergencyActivation.findFirst({
      where: {
        id: input.activationId,
        organizationId: input.organizationId,
        planId: plan.id,
      },
      select: { id: true },
    });
    if (!activation) throw new Error("Select an activation from this plan.");
  }
  if (input.dueAt <= new Date()) {
    throw new Error("Improvement due date must be in the future.");
  }
  return prisma.$transaction(async (tx) => {
    const improvement = await tx.emergencyImprovement.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        drillId: input.drillId,
        activationId: input.activationId,
        ownerId: owner.id,
        createdById: actor.id,
        title: boundedRequired(input.title, 200, "Improvement title"),
        description: boundedRequired(
          input.description,
          3_000,
          "Improvement description",
        ),
        priority: input.priority,
        dueAt: input.dueAt,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "EmergencyImprovement",
        entityId: improvement.id,
        title: "Emergency improvement created",
        description: improvement.title,
        metadata: {
          planId: plan.id,
          drillId: input.drillId,
          activationId: input.activationId,
          ownerId: owner.id,
          priority: input.priority,
        },
      },
    });
    return improvement;
  });
}

export async function updateEmergencyImprovementService(
  input: {
    organizationId: string;
    improvementId: string;
    userId: string;
    canManage: boolean;
    status: EmergencyImprovementStatus;
    completionEvidence: string | null;
    verificationNotes: string | null;
  },
) {
  const improvement = await prisma.emergencyImprovement.findFirst({
    where: { id: input.improvementId, organizationId: input.organizationId },
  });
  if (!improvement) throw new Error("The emergency improvement was not found.");
  if (improvement.ownerId !== input.userId && !input.canManage) {
    throw new Error(
      "Only the assigned owner or emergency manager can update this improvement.",
    );
  }
  if (
    input.status === EmergencyImprovementStatus.VERIFIED &&
    !input.canManage
  ) {
    throw new Error("Only an emergency manager can verify improvement closure.");
  }
  assertEmergencyImprovementTransition(improvement.status, input.status);
  const evidence = bounded(
    input.completionEvidence,
    3_000,
    "Completion evidence",
  );
  const verification = bounded(
    input.verificationNotes,
    2_000,
    "Verification notes",
  );
  if (
    input.status === EmergencyImprovementStatus.COMPLETED &&
    (evidence?.length ?? 0) < 12
  ) {
    throw new Error("Document completion evidence with at least 12 characters.");
  }
  if (
    input.status === EmergencyImprovementStatus.VERIFIED &&
    (verification?.length ?? 0) < 12
  ) {
    throw new Error("Document closure verification with at least 12 characters.");
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.emergencyImprovement.update({
      where: { id: improvement.id },
      data: {
        status: input.status,
        completionEvidence:
          input.status === EmergencyImprovementStatus.COMPLETED
            ? evidence
            : improvement.completionEvidence,
        completedAt:
          input.status === EmergencyImprovementStatus.COMPLETED
            ? now
            : input.status === EmergencyImprovementStatus.IN_PROGRESS
              ? null
              : improvement.completedAt,
        verificationNotes:
          input.status === EmergencyImprovementStatus.VERIFIED
            ? verification
            : improvement.verificationNotes,
        verifiedById:
          input.status === EmergencyImprovementStatus.VERIFIED
            ? input.userId
            : null,
        verifiedAt:
          input.status === EmergencyImprovementStatus.VERIFIED ? now : null,
      },
    }),
    activity(input.organizationId, input.userId, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "EmergencyImprovement",
      entityId: improvement.id,
      title: "Emergency improvement status updated",
      description: `${improvement.status} → ${input.status}`,
      metadata: {
        previousStatus: improvement.status,
        status: input.status,
      },
    }),
  ]);
}

export async function createCapaFromEmergencyImprovementService(
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
    prisma.emergencyImprovement.findFirst({
      where: { id: input.improvementId, organizationId: input.organizationId },
    }),
    tenantUser(input.organizationId, input.assignedToId),
  ]);
  if (!improvement || !assignee) {
    throw new Error("Select a valid tenant emergency improvement and CAPA owner.");
  }
  if (improvement.correctiveActionId) {
    throw new Error("This improvement already has a linked corrective action.");
  }
  if (input.dueDate <= new Date()) {
    throw new Error("Corrective-action due date must be in the future.");
  }
  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.correctiveAction.create({
      data: {
        title: boundedRequired(input.title, 200, "Corrective-action title"),
        description: bounded(
          input.description,
          3_000,
          "Corrective-action description",
        ),
        status: Status.OPEN,
        riskLevel: improvement.priority,
        dueDate: input.dueDate,
        assignedToId: assignee.id,
      },
    });
    await tx.emergencyImprovement.update({
      where: { id: improvement.id },
      data: { correctiveActionId: created.id },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "CorrectiveAction",
        entityId: created.id,
        title: "Emergency improvement CAPA created",
        description: `${improvement.title} — ${created.title}`,
        metadata: {
          emergencyImprovementId: improvement.id,
          assignedToId: assignee.id,
          dueDate: created.dueDate,
        },
      },
    });
    return created;
  });
  await createNotification({
    organizationId: input.organizationId,
    userId: assignee.id,
    type: NotificationType.ASSIGNMENT,
    title: "Emergency preparedness corrective action assigned",
    message: action.title,
    link: `/actions/${action.id}`,
  }).catch(() => null);
  return action;
}

export async function getEmergencyPreparednessDashboardService(
  organizationId: string,
  now = new Date(),
) {
  const sixMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  const [plans, drills, activations, improvements] = await Promise.all([
    prisma.emergencyPlan.findMany({
      where: { organizationId },
      include: {
        site: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        scenarios: { where: { isActive: true }, select: { id: true } },
        contacts: { where: { isActive: true }, select: { id: true } },
        drills: {
          where: { status: EmergencyDrillStatus.COMPLETED },
          select: { completedAt: true, rating: true },
          orderBy: { completedAt: "desc" },
        },
        improvements: {
          where: {
            status: {
              in: [
                EmergencyImprovementStatus.OPEN,
                EmergencyImprovementStatus.IN_PROGRESS,
                EmergencyImprovementStatus.COMPLETED,
              ],
            },
          },
          select: { priority: true, status: true, dueAt: true },
        },
      },
      orderBy: [{ status: "asc" }, { reviewDueAt: "asc" }],
    }),
    prisma.emergencyDrill.findMany({
      where: {
        organizationId,
        OR: [
          { status: { in: [EmergencyDrillStatus.PLANNED, EmergencyDrillStatus.IN_PROGRESS] } },
          { completedAt: { gte: sixMonthsAgo } },
        ],
      },
      include: {
        plan: { select: { title: true } },
        lead: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.emergencyActivation.findMany({
      where: {
        organizationId,
        OR: [
          {
            status: {
              in: [
                EmergencyActivationStatus.ACTIVE,
                EmergencyActivationStatus.STABILIZED,
                EmergencyActivationStatus.STOOD_DOWN,
              ],
            },
          },
          { declaredAt: { gte: sixMonthsAgo } },
        ],
      },
      include: {
        plan: { select: { title: true } },
        incidentCommander: { select: { name: true } },
      },
      orderBy: { declaredAt: "desc" },
    }),
    prisma.emergencyImprovement.findMany({
      where: {
        organizationId,
        status: {
          in: [
            EmergencyImprovementStatus.OPEN,
            EmergencyImprovementStatus.IN_PROGRESS,
            EmergencyImprovementStatus.COMPLETED,
          ],
        },
      },
      include: {
        owner: { select: { name: true } },
        plan: { select: { title: true } },
        correctiveAction: { select: { id: true, status: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  const scoredPlans = plans.map((plan) => ({
    ...plan,
    readinessScore: emergencyReadinessScore(
      {
        status: plan.status,
        reviewDueAt: plan.reviewDueAt,
        activeScenarioCount: plan.scenarios.length,
        activeContactCount: plan.contacts.length,
        latestCompletedDrillAt: plan.drills[0]?.completedAt ?? null,
        openCriticalImprovements: plan.improvements.filter(
          (item) =>
            item.priority === RiskLevel.HIGH ||
            item.priority === RiskLevel.CRITICAL,
        ).length,
      },
      now,
    ),
  }));
  const completedDrills = drills.filter(
    (drill) => drill.status === EmergencyDrillStatus.COMPLETED,
  );
  const effectiveDrills = completedDrills.filter(
    (drill) => drill.rating === EmergencyDrillRating.EFFECTIVE,
  ).length;
  return {
    plans: scoredPlans,
    drills,
    activations,
    improvements,
    metrics: {
      activePlans: plans.filter(
        (plan) => plan.status === EmergencyPlanStatus.ACTIVE,
      ).length,
      overduePlanReviews: plans.filter(
        (plan) =>
          plan.status === EmergencyPlanStatus.ACTIVE &&
          plan.reviewDueAt < now,
      ).length,
      openActivations: activations.filter(
        (activation) =>
          activation.status === EmergencyActivationStatus.ACTIVE ||
          activation.status === EmergencyActivationStatus.STABILIZED,
      ).length,
      overdueDrills: drills.filter(
        (drill) =>
          drill.status === EmergencyDrillStatus.PLANNED &&
          drill.scheduledAt < now,
      ).length,
      drillEffectiveness: completedDrills.length
        ? Math.round((effectiveDrills / completedDrills.length) * 100)
        : 0,
      openImprovements: improvements.length,
      overdueImprovements: improvements.filter(
        (improvement) => improvement.dueAt < now,
      ).length,
    },
  };
}

export async function processEmergencyPreparednessMonitoring(
  now = new Date(),
) {
  const reviewHorizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);
  const drillHorizon = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  const [plans, drills, activations, improvements] = await Promise.all([
    prisma.emergencyPlan.findMany({
      where: {
        status: EmergencyPlanStatus.ACTIVE,
        reviewDueAt: { lte: reviewHorizon },
        reviewReminderAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        ownerId: true,
        reference: true,
        title: true,
        reviewDueAt: true,
      },
    }),
    prisma.emergencyDrill.findMany({
      where: {
        status: EmergencyDrillStatus.PLANNED,
        scheduledAt: { lte: drillHorizon },
        reminderSentAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        leadId: true,
        reference: true,
        scheduledAt: true,
      },
    }),
    prisma.emergencyActivation.findMany({
      where: {
        status: EmergencyActivationStatus.STOOD_DOWN,
        afterActionDueAt: { lt: now },
        reminderSentAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        incidentCommanderId: true,
        reference: true,
      },
    }),
    prisma.emergencyImprovement.findMany({
      where: {
        status: {
          in: [
            EmergencyImprovementStatus.OPEN,
            EmergencyImprovementStatus.IN_PROGRESS,
          ],
        },
        dueAt: { lt: now },
        reminderSentAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        planId: true,
        ownerId: true,
        title: true,
      },
    }),
  ]);
  let notificationsSent = 0;
  for (const plan of plans) {
    const sent = await createNotification({
      organizationId: plan.organizationId,
      userId: plan.ownerId,
      type:
        plan.reviewDueAt < now
          ? NotificationType.CRITICAL
          : NotificationType.DUE_DATE,
      title: `Emergency plan review ${plan.reviewDueAt < now ? "overdue" : "due soon"}`,
      message: `${plan.reference} — ${plan.title}`,
      link: `/emergency/plans/${plan.id}`,
    }).catch(() => null);
    if (sent) {
      await prisma.emergencyPlan.update({
        where: { id: plan.id },
        data: { reviewReminderAt: now },
      });
      notificationsSent++;
    }
  }
  for (const drill of drills) {
    const sent = await createNotification({
      organizationId: drill.organizationId,
      userId: drill.leadId,
      type:
        drill.scheduledAt < now
          ? NotificationType.CRITICAL
          : NotificationType.DUE_DATE,
      title: `Emergency drill ${drill.scheduledAt < now ? "overdue" : "due within 24 hours"}`,
      message: drill.reference,
      link: `/emergency/drills/${drill.id}`,
    }).catch(() => null);
    if (sent) {
      await prisma.emergencyDrill.update({
        where: { id: drill.id },
        data: { reminderSentAt: now },
      });
      notificationsSent++;
    }
  }
  for (const activation of activations) {
    const sent = await createNotification({
      organizationId: activation.organizationId,
      userId: activation.incidentCommanderId,
      type: NotificationType.CRITICAL,
      title: "Emergency after-action review overdue",
      message: activation.reference,
      link: `/emergency/activations/${activation.id}`,
    }).catch(() => null);
    if (sent) {
      await prisma.emergencyActivation.update({
        where: { id: activation.id },
        data: { reminderSentAt: now },
      });
      notificationsSent++;
    }
  }
  for (const improvement of improvements) {
    const sent = await createNotification({
      organizationId: improvement.organizationId,
      userId: improvement.ownerId,
      type: NotificationType.CRITICAL,
      title: "Emergency improvement overdue",
      message: improvement.title,
      link: `/emergency/plans/${improvement.planId}`,
    }).catch(() => null);
    if (sent) {
      await prisma.emergencyImprovement.update({
        where: { id: improvement.id },
        data: { reminderSentAt: now },
      });
      notificationsSent++;
    }
  }
  return {
    planReviews: plans.length,
    drills: drills.length,
    afterActionReviews: activations.length,
    overdueImprovements: improvements.length,
    notificationsSent,
  };
}

async function validatePlanScope(input: EmergencyPlanInput, actorId: string) {
  const [actor, site, department, owner] = await Promise.all([
    tenantUser(input.organizationId, actorId),
    prisma.site.findFirst({
      where: { id: input.siteId, organizationId: input.organizationId },
      select: { id: true },
    }),
    input.departmentId
      ? prisma.department.findFirst({
          where: {
            id: input.departmentId,
            site: { organizationId: input.organizationId },
          },
          select: { id: true, siteId: true },
        })
      : null,
    tenantUser(input.organizationId, input.ownerId),
  ]);
  if (!actor || !site || !owner || (input.departmentId && !department)) {
    throw new Error("Select valid tenant plan ownership and scope values.");
  }
  if (department && department.siteId !== site.id) {
    throw new Error("The selected department does not belong to the plan site.");
  }
  return { site, department, owner };
}

async function requireEditablePlan(organizationId: string, planId: string) {
  const plan = await prisma.emergencyPlan.findFirst({
    where: { id: planId, organizationId },
    select: { id: true, reference: true, version: true, status: true },
  });
  if (!plan) throw new Error("The emergency plan was not found.");
  if (
    plan.status !== EmergencyPlanStatus.DRAFT &&
    plan.status !== EmergencyPlanStatus.REJECTED
  ) {
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

async function tenantDrill(organizationId: string, drillId: string) {
  const drill = await prisma.emergencyDrill.findFirst({
    where: { id: drillId, organizationId },
  });
  if (!drill) throw new Error("The emergency drill was not found.");
  return drill;
}

async function tenantActivation(organizationId: string, activationId: string) {
  const activation = await prisma.emergencyActivation.findFirst({
    where: { id: activationId, organizationId },
  });
  if (!activation) throw new Error("The emergency activation was not found.");
  return activation;
}

function validateCounts(...values: number[]) {
  if (
    values.some(
      (value) =>
        !Number.isInteger(value) || value < 0 || value > 1_000_000,
    )
  ) {
    throw new Error("Emergency accountability counts must be valid non-negative whole numbers.");
  }
}

function normalizedReference(value: string) {
  const normalized = boundedRequired(value, 80, "Reference")
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]/g, "-")
    .replace(/-+/g, "-");
  if (!/^[A-Z0-9]/.test(normalized)) {
    return `ERP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return normalized;
}

function boundedRequired(value: string, max: number, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function bounded(value: string | null | undefined, max: number, label: string) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return normalized;
}

function activity(
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
  return prisma.activityLog.create({
    data: {
      organizationId,
      userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      title: data.title,
      description: data.description,
      metadata: data.metadata,
    },
  });
}
