import {
  ComplianceCalendarOccurrenceStatus,
  PermissionKey,
  Status,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function mobileComplianceTrainingCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canViewCompliance: granted.has(PermissionKey.VIEW_COMPLIANCE),
    canManageCompliance: granted.has(PermissionKey.MANAGE_COMPLIANCE),
    canViewTraining: granted.has(PermissionKey.VIEW_TRAINING),
    canManageTraining: granted.has(PermissionKey.MANAGE_TRAINING),
  };
}

export async function getMobileComplianceTraining(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileComplianceTrainingCapabilities(input.permissions);
  const now = input.now ?? new Date();
  const recentCompletionCutoff = new Date(now.getTime() - 30 * 86_400_000);

  const [complianceOccurrences, trainingAssignments] = await Promise.all([
    capabilities.canViewCompliance
      ? prisma.complianceCalendarOccurrence.findMany({
          where: {
            organizationId: input.organizationId,
            ...(capabilities.canManageCompliance
              ? {}
              : { assignedToId: input.userId }),
            OR: [
              {
                status: {
                  notIn: [
                    ComplianceCalendarOccurrenceStatus.COMPLETED,
                    ComplianceCalendarOccurrenceStatus.CANCELLED,
                  ],
                },
              },
              {
                status: ComplianceCalendarOccurrenceStatus.COMPLETED,
                completedAt: { gte: recentCompletionCutoff },
              },
            ],
          },
          select: {
            id: true,
            dueAt: true,
            status: true,
            completionNotes: true,
            evidenceUrl: true,
            completedAt: true,
            reviewedAt: true,
            reviewNotes: true,
            assignedTo: { select: { id: true, name: true } },
            site: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            task: {
              select: {
                id: true,
                title: true,
                description: true,
                instructions: true,
                category: true,
                regulatoryReference: true,
                evidenceRequired: true,
                approvalRequired: true,
                recurrence: true,
              },
            },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
          take: 100,
        })
      : Promise.resolve([]),
    capabilities.canViewTraining
      ? prisma.trainingRecord.findMany({
          where: {
            user: { organizationId: input.organizationId },
            ...(capabilities.canManageTraining
              ? {}
              : { userId: input.userId }),
            OR: [
              { status: { notIn: [Status.COMPLETED, Status.CLOSED] } },
              {
                status: Status.COMPLETED,
                completedAt: { gte: recentCompletionCutoff },
              },
            ],
          },
          select: {
            id: true,
            courseName: true,
            status: true,
            dueDate: true,
            completedAt: true,
            assignedAt: true,
            expiresAt: true,
            provider: true,
            certificateNumber: true,
            score: true,
            notes: true,
            user: { select: { id: true, name: true } },
            assignedBy: { select: { id: true, name: true } },
            course: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                provider: true,
                validityMonths: true,
              },
            },
            requirement: {
              select: {
                id: true,
                dueWithinDays: true,
                renewalLeadDays: true,
              },
            },
          },
          orderBy: [
            { dueDate: { sort: "asc", nulls: "last" } },
            { assignedAt: "desc" },
          ],
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  return {
    complianceOccurrences: complianceOccurrences.map((occurrence) => ({
      ...occurrence,
      isAssignedToCurrentUser: occurrence.assignedTo.id === input.userId,
    })),
    trainingAssignments: trainingAssignments.map((assignment) => ({
      ...assignment,
      isAssignedToCurrentUser: assignment.user.id === input.userId,
    })),
    capabilities,
  };
}
