import {
  ConfigurableFormModule,
  ExposureAssessmentStatus,
  PermissionKey,
  SurveillanceEnrollmentStatus,
  SurveillanceProgramStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { getExposureAssessmentNextStatuses } from "@/modules/industrial-hygiene/exposure-assessment-lifecycle";
import { getSurveillanceProgramNextStatuses } from "@/modules/occupational-health/surveillance-program-lifecycle";

export function mobileHygieneHealthCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canViewIndustrialHygiene: granted.has(
      PermissionKey.VIEW_INDUSTRIAL_HYGIENE
    ),
    canManageIndustrialHygiene: granted.has(
      PermissionKey.MANAGE_INDUSTRIAL_HYGIENE
    ),
    canViewOccupationalHealth: granted.has(
      PermissionKey.VIEW_OCCUPATIONAL_HEALTH
    ),
    canManageOccupationalHealth: granted.has(
      PermissionKey.MANAGE_OCCUPATIONAL_HEALTH
    ),
  };
}

export async function getMobileHygieneHealthWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileHygieneHealthCapabilities(input.permissions);
  const now = input.now ?? new Date();
  const recentCutoff = new Date(now.getTime() - 30 * 86_400_000);
  const canManageEither =
    capabilities.canManageIndustrialHygiene ||
    capabilities.canManageOccupationalHealth;

  const [assessments, programs, people, forms] = await Promise.all([
    capabilities.canViewIndustrialHygiene
      ? prisma.exposureAssessment.findMany({
          where: {
            organizationId: input.organizationId,
            OR: [
              {
                status: {
                  notIn: [
                    ExposureAssessmentStatus.COMPLETED,
                    ExposureAssessmentStatus.CANCELLED,
                  ],
                },
              },
              { updatedAt: { gte: recentCutoff } },
            ],
          },
          select: {
            id: true,
            reference: true,
            title: true,
            description: true,
            status: true,
            scheduledAt: true,
            dueDate: true,
            startedAt: true,
            completedAt: true,
            scope: true,
            samplingPlan: true,
            observations: true,
            conclusions: true,
            recommendations: true,
            site: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            assessor: { select: { id: true, name: true } },
            group: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
                jobRoles: true,
                tasks: true,
                locations: true,
                exposedHeadcount: true,
                existingControls: true,
                requiredPpe: true,
                reviewDueDate: true,
                owner: { select: { id: true, name: true } },
                agents: {
                  select: {
                    agent: {
                      select: {
                        id: true,
                        name: true,
                        category: true,
                        casNumber: true,
                        description: true,
                        healthEffects: true,
                        exposureRoutes: true,
                        occupationalLimit: true,
                        actionLevel: true,
                        ceilingLimit: true,
                        unit: true,
                        limitSource: true,
                        samplingMethod: true,
                        analyticalMethod: true,
                        requiresSurveillance: true,
                      },
                    },
                  },
                  orderBy: { agent: { name: "asc" } },
                },
              },
            },
            samples: {
              select: {
                id: true,
                sampleType: true,
                sampleReference: true,
                location: true,
                task: true,
                sampledAt: true,
                durationMinutes: true,
                resultValue: true,
                reportingLimit: true,
                occupationalLimit: true,
                actionLevel: true,
                unit: true,
                exposureRatio: true,
                classification: true,
                laboratory: true,
                analyticalMethod: true,
                analyzedAt: true,
                notes: true,
                agent: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                  },
                },
                sampledWorker: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
              },
              orderBy: { sampledAt: "desc" },
              take: 100,
            },
          },
          orderBy: [
            { dueDate: { sort: "asc", nulls: "last" } },
            { updatedAt: "desc" },
          ],
          take: 75,
        })
      : Promise.resolve([]),
    capabilities.canViewOccupationalHealth
      ? prisma.medicalSurveillanceProgram.findMany({
          where: {
            organizationId: input.organizationId,
            ...(capabilities.canManageOccupationalHealth
              ? {}
              : { enrollments: { some: { userId: input.userId } } }),
            OR: [
              { status: { not: SurveillanceProgramStatus.ARCHIVED } },
              { updatedAt: { gte: recentCutoff } },
            ],
          },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            regulatoryBasis: true,
            protocolReference: true,
            providerName: true,
            frequencyMonths: true,
            leadDays: true,
            isActive: true,
            agent: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
            group: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            responsibleUser: { select: { id: true, name: true } },
            enrollments: {
              where: capabilities.canManageOccupationalHealth
                ? {
                    OR: [
                      {
                        status: {
                          not: SurveillanceEnrollmentStatus.REMOVED,
                        },
                      },
                      { updatedAt: { gte: recentCutoff } },
                    ],
                  }
                : { userId: input.userId },
              select: {
                id: true,
                status: true,
                enrolledAt: true,
                lastCompletedAt: true,
                nextDueAt: true,
                fitnessOutcome: true,
                workRestrictions: true,
                certificateReference: true,
                removedAt: true,
                user: { select: { id: true, name: true } },
                completedBy: { select: { id: true, name: true } },
              },
              orderBy: { nextDueAt: "asc" },
              take: 200,
            },
          },
          orderBy: [{ status: "asc" }, { name: "asc" }],
          take: 75,
        })
      : Promise.resolve([]),
    canManageEither
      ? prisma.user.findMany({
          where: {
            organizationId: input.organizationId,
            isActive: true,
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
    capabilities.canViewIndustrialHygiene
      ? getPublishedRuntimeForms(
          input.organizationId,
          ConfigurableFormModule.INDUSTRIAL_HYGIENE
        )
      : Promise.resolve([]),
  ]);
  const capturedForms = assessments.length
    ? await prisma.configurableFormSubmission.findMany({
        where: {
          organizationId: input.organizationId,
          entityType: ConfigurableFormModule.INDUSTRIAL_HYGIENE,
          entityId: { in: assessments.map((assessment) => assessment.id) },
        },
        select: { entityId: true, definitionId: true },
      })
    : [];
  const capturedFormKeys = new Set(
    capturedForms.map(
      (submission) => `${submission.entityId}:${submission.definitionId}`
    )
  );

  return {
    capabilities,
    people,
    forms,
    assessments: assessments.map((assessment) => ({
      ...assessment,
      nextStatuses: getExposureAssessmentNextStatuses(assessment.status),
      isAssignedToCurrentUser:
        assessment.assessor?.id === input.userId ||
        assessment.group.owner?.id === input.userId,
      missingFormDefinitionIds: forms
        .filter(
          (form) => !capturedFormKeys.has(`${assessment.id}:${form.id}`)
        )
        .map((form) => form.id),
      samples: assessment.samples.map((sample) => ({
        ...sample,
        sampledWorker:
          capabilities.canManageIndustrialHygiene ||
          sample.sampledWorker?.id === input.userId
            ? sample.sampledWorker
            : sample.sampledWorker
              ? { id: sample.sampledWorker.id, name: "Protected worker" }
              : null,
      })),
    })),
    programs: programs.map((program) => ({
      ...program,
      nextStatuses: getSurveillanceProgramNextStatuses(program.status),
      isResponsibleUser: program.responsibleUser.id === input.userId,
      enrollments: program.enrollments.map((enrollment) => ({
        ...enrollment,
        isCurrentUser: enrollment.user.id === input.userId,
      })),
    })),
  };
}
