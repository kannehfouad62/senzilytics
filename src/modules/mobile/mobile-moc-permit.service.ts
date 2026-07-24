import {
  MocStatus,
  PermissionKey,
  PermitToWorkStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMocNextStatuses } from "@/modules/moc/moc.service";
import { getPermitToWorkNextStatuses } from "@/modules/permits-to-work/permit-to-work-lifecycle";

export function mobileMocPermitCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canViewMoc: granted.has(PermissionKey.VIEW_MOC),
    canManageMoc: granted.has(PermissionKey.MANAGE_MOC),
    canViewPermits: granted.has(PermissionKey.VIEW_PERMITS_TO_WORK),
    canManagePermits: granted.has(PermissionKey.MANAGE_PERMITS_TO_WORK),
  };
}

export async function getMobileMocPermitWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileMocPermitCapabilities(input.permissions);
  const now = input.now ?? new Date();
  const recentCutoff = new Date(now.getTime() - 30 * 86_400_000);

  const [mocs, permits] = await Promise.all([
    capabilities.canViewMoc
      ? prisma.managementOfChange.findMany({
          where: {
            organizationId: input.organizationId,
            OR: [
              {
                status: {
                  notIn: [MocStatus.CLOSED, MocStatus.CANCELLED],
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
            businessJustification: true,
            changeType: true,
            changeDuration: true,
            priority: true,
            status: true,
            emergencyJustification: true,
            temporaryExpirationDate: true,
            affectedProcess: true,
            affectedEquipment: true,
            affectedSystems: true,
            affectedMaterials: true,
            operationalImpact: true,
            regulatoryImpact: true,
            environmentalImpact: true,
            safetyImpact: true,
            qualityImpact: true,
            initialScore: true,
            initialRiskLevel: true,
            residualScore: true,
            residualRiskLevel: true,
            proposedStartDate: true,
            plannedCompletionDate: true,
            actualStartDate: true,
            implementedAt: true,
            verifiedAt: true,
            closedAt: true,
            site: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            requestor: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true } },
            approvals: {
              select: {
                id: true,
                role: true,
                status: true,
                sequence: true,
                comments: true,
                requestedAt: true,
                decidedAt: true,
                approver: { select: { id: true, name: true } },
              },
              orderBy: { sequence: "asc" },
            },
            tasks: {
              select: {
                id: true,
                title: true,
                description: true,
                taskType: true,
                status: true,
                sequence: true,
                isRequired: true,
                dueDate: true,
                startedAt: true,
                completedAt: true,
                verifiedAt: true,
                evidenceNote: true,
                assignedTo: { select: { id: true, name: true } },
                verifiedBy: { select: { id: true, name: true } },
              },
              orderBy: [
                { sequence: { sort: "asc", nulls: "last" } },
                { dueDate: { sort: "asc", nulls: "last" } },
              ],
            },
            riskLinks: {
              select: {
                id: true,
                relationshipNote: true,
                risk: {
                  select: {
                    id: true,
                    reference: true,
                    title: true,
                    currentScore: true,
                    currentRiskLevel: true,
                    residualScore: true,
                    residualRiskLevel: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { priority: "desc" },
            { plannedCompletionDate: { sort: "asc", nulls: "last" } },
            { updatedAt: "desc" },
          ],
          take: 75,
        })
      : Promise.resolve([]),
    capabilities.canViewPermits
      ? prisma.permitToWork.findMany({
          where: {
            organizationId: input.organizationId,
            OR: [
              {
                status: {
                  notIn: [
                    PermitToWorkStatus.CLOSED,
                    PermitToWorkStatus.CANCELLED,
                    PermitToWorkStatus.EXPIRED,
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
            type: true,
            status: true,
            responsiblePerson: true,
            exactLocation: true,
            workOrderReference: true,
            plannedStartAt: true,
            plannedEndAt: true,
            hazardsSummary: true,
            controlsSummary: true,
            requiredPpe: true,
            isolationDetails: true,
            emergencyPlan: true,
            gasTestingRequired: true,
            approvedAt: true,
            activatedAt: true,
            suspendedAt: true,
            closedAt: true,
            closeoutNotes: true,
            site: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            contractor: {
              select: {
                id: true,
                name: true,
                status: true,
                insuranceExpiresAt: true,
              },
            },
            requestedBy: { select: { id: true, name: true } },
            issuedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
            closedBy: { select: { id: true, name: true } },
            controls: {
              select: {
                id: true,
                description: true,
                isRequired: true,
                isVerified: true,
                verifiedAt: true,
                verifiedBy: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "asc" },
            },
            gasTests: {
              select: {
                id: true,
                testedAt: true,
                oxygenPercent: true,
                lelPercent: true,
                h2sPpm: true,
                coPpm: true,
                result: true,
                notes: true,
                performedBy: { select: { id: true, name: true } },
              },
              orderBy: { testedAt: "desc" },
              take: 10,
            },
            workers: {
              select: {
                id: true,
                role: true,
                worker: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    jobTitle: true,
                    status: true,
                    inductionExpiresAt: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
            history: {
              select: {
                id: true,
                fromStatus: true,
                toStatus: true,
                comments: true,
                createdAt: true,
                actor: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
          orderBy: [
            { plannedStartAt: "asc" },
            { updatedAt: "desc" },
          ],
          take: 75,
        })
      : Promise.resolve([]),
  ]);

  return {
    mocs: mocs.map((moc) => ({
      ...moc,
      nextStatuses: getMocNextStatuses(moc.status),
      isOwner: moc.owner?.id === input.userId,
      isRequestor: moc.requestor.id === input.userId,
      approvals: moc.approvals.map((approval) => ({
        ...approval,
        isAssignedToCurrentUser: approval.approver?.id === input.userId,
      })),
      tasks: moc.tasks.map((task) => ({
        ...task,
        isAssignedToCurrentUser: task.assignedTo?.id === input.userId,
      })),
    })),
    permits: permits.map((permit) => ({
      ...permit,
      nextStatuses: getPermitToWorkNextStatuses(permit.status),
      isRequestedByCurrentUser: permit.requestedBy.id === input.userId,
    })),
    capabilities,
  };
}
