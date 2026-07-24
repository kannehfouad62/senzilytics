import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import { calculateRiskRating } from "@/modules/risk/risk-scoring";
import { createNotification } from "@/core/notifications/notifications.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  MocApprovalRole,
  MocApprovalStatus,
  MocChangeDuration,
  MocChangeType,
  MocPriority,
  MocStatus,
  MocTaskStatus,
  MocTaskType,
  NotificationType,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  findTenantMocById,
  getNextMocReference,
} from "./moc.repository";

const allowedStatusTransitions: Record<
  MocStatus,
  MocStatus[]
> = {
  [MocStatus.DRAFT]: [
    MocStatus.TECHNICAL_REVIEW,
    MocStatus.CANCELLED,
  ],

  [MocStatus.TECHNICAL_REVIEW]: [
    MocStatus.RISK_REVIEW,
    MocStatus.REJECTED,
    MocStatus.CANCELLED,
  ],

  [MocStatus.RISK_REVIEW]: [
    MocStatus.PENDING_APPROVAL,
    MocStatus.TECHNICAL_REVIEW,
    MocStatus.REJECTED,
    MocStatus.CANCELLED,
  ],

  [MocStatus.PENDING_APPROVAL]: [
    MocStatus.APPROVED,
    MocStatus.RISK_REVIEW,
    MocStatus.REJECTED,
    MocStatus.CANCELLED,
  ],

  [MocStatus.APPROVED]: [
    MocStatus.IMPLEMENTATION,
    MocStatus.CANCELLED,
  ],

  [MocStatus.IMPLEMENTATION]: [
    MocStatus.VERIFICATION,
    MocStatus.CANCELLED,
  ],

  [MocStatus.VERIFICATION]: [
    MocStatus.CLOSED,
    MocStatus.IMPLEMENTATION,
    MocStatus.CANCELLED,
  ],

  [MocStatus.CLOSED]: [],

  [MocStatus.REJECTED]: [
    MocStatus.DRAFT,
    MocStatus.CANCELLED,
  ],

  [MocStatus.CANCELLED]: [],
};

export function getMocNextStatuses(status: MocStatus) {
  return [...allowedStatusTransitions[status]];
}

async function validateMocScope(input: {
  organizationId: string;
  siteId: string;
  departmentId?: string | null;
  ownerId?: string | null;
}) {
  const [
    site,
    department,
    owner,
  ] = await Promise.all([
    prisma.site.findFirst({
      where: {
        id: input.siteId,
        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    }),

    input.departmentId
      ? prisma.department.findFirst({
          where: {
            id: input.departmentId,

            site: {
              organizationId:
                input.organizationId,
            },
          },

          select: {
            id: true,
            siteId: true,
          },
        })
      : null,

    input.ownerId
      ? prisma.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId:
              input.organizationId,
          },

          select: {
            id: true,
          },
        })
      : null,
  ]);

  if (!site) {
    throw new Error(
      "The selected site was not found in this organization."
    );
  }

  if (
    input.departmentId &&
    !department
  ) {
    throw new Error(
      "The selected department was not found in this organization."
    );
  }

  if (
    department &&
    department.siteId !==
      input.siteId
  ) {
    throw new Error(
      "The selected department does not belong to the selected site."
    );
  }

  if (
    input.ownerId &&
    !owner
  ) {
    throw new Error(
      "The selected change owner was not found in this organization."
    );
  }
}

export async function createMocService(input: {
  organizationId: string;
  userId: string;

  title: string;
  description: string;
  businessJustification: string;

  changeType: MocChangeType;
  changeDuration: MocChangeDuration;
  priority: MocPriority;

  emergencyJustification?: string | null;
  temporaryExpirationDate?: Date | null;

  affectedProcess?: string | null;
  affectedEquipment?: string | null;
  affectedSystems?: string | null;
  affectedMaterials?: string | null;

  operationalImpact?: string | null;
  regulatoryImpact?: string | null;
  environmentalImpact?: string | null;
  safetyImpact?: string | null;
  qualityImpact?: string | null;

  initialLikelihood: RiskLikelihood;
  initialImpact: RiskImpact;
  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;

  proposedStartDate?: Date | null;
  plannedCompletionDate?: Date | null;

  siteId: string;
  departmentId?: string | null;
  ownerId?: string | null;
  customSubmissions?: PreparedSubmission[];
}) {
  await validateMocScope({
    organizationId:
      input.organizationId,
    siteId: input.siteId,
    departmentId:
      input.departmentId,
    ownerId: input.ownerId,
  });

  if (
    input.changeDuration ===
      MocChangeDuration.EMERGENCY &&
    !input.emergencyJustification
  ) {
    throw new Error(
      "Emergency justification is required for an emergency change."
    );
  }

  if (
    input.changeDuration ===
      MocChangeDuration.TEMPORARY &&
    !input.temporaryExpirationDate
  ) {
    throw new Error(
      "A temporary expiration date is required for a temporary change."
    );
  }

  if (
    input.proposedStartDate &&
    input.plannedCompletionDate &&
    input.proposedStartDate >
      input.plannedCompletionDate
  ) {
    throw new Error(
      "The proposed start date cannot be after the planned completion date."
    );
  }

  const [
    initialRating,
    residualRating,
    reference,
  ] = await Promise.all([
    Promise.resolve(
      calculateRiskRating({
        likelihood:
          input.initialLikelihood,
        impact:
          input.initialImpact,
      })
    ),

    Promise.resolve(
      calculateRiskRating({
        likelihood:
          input.residualLikelihood,
        impact:
          input.residualImpact,
      })
    ),

    getNextMocReference(
      input.organizationId
    ),
  ]);

  const moc =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.managementOfChange.create({
            data: {
              reference,
              title: input.title,
              description:
                input.description,
              businessJustification:
                input.businessJustification,

              changeType:
                input.changeType,
              changeDuration:
                input.changeDuration,
              priority:
                input.priority,
              status:
                MocStatus.DRAFT,

              emergencyJustification:
                input.emergencyJustification,
              temporaryExpirationDate:
                input.temporaryExpirationDate,

              affectedProcess:
                input.affectedProcess,
              affectedEquipment:
                input.affectedEquipment,
              affectedSystems:
                input.affectedSystems,
              affectedMaterials:
                input.affectedMaterials,

              operationalImpact:
                input.operationalImpact,
              regulatoryImpact:
                input.regulatoryImpact,
              environmentalImpact:
                input.environmentalImpact,
              safetyImpact:
                input.safetyImpact,
              qualityImpact:
                input.qualityImpact,

              initialLikelihood:
                input.initialLikelihood,
              initialImpact:
                input.initialImpact,
              initialScore:
                initialRating.score,
              initialRiskLevel:
                initialRating.riskLevel,

              residualLikelihood:
                input.residualLikelihood,
              residualImpact:
                input.residualImpact,
              residualScore:
                residualRating.score,
              residualRiskLevel:
                residualRating.riskLevel,

              proposedStartDate:
                input.proposedStartDate,
              plannedCompletionDate:
                input.plannedCompletionDate,

              organizationId:
                input.organizationId,
              siteId:
                input.siteId,
              departmentId:
                input.departmentId,
              requestorId:
                input.userId,
              ownerId:
                input.ownerId,
            },
          });

        await createPreparedSubmissions(
          tx,
          {
            organizationId:
              input.organizationId,
            userId: input.userId,
            module:
              ConfigurableFormModule.MOC,
            entityId: created.id,
            submissions:
              input.customSubmissions ??
              [],
          }
        );

        await tx.activityLog.create({
          data: {
            organizationId:
              input.organizationId,
            userId: input.userId,
            action:
              ActivityAction.CREATE,
            entityType:
              "ManagementOfChange",
            entityId: created.id,
            title:
              "Management of change created",
            description:
              `${created.reference}: ${created.title}`,
            metadata: {
              changeType:
                created.changeType,
              changeDuration:
                created.changeDuration,
              priority:
                created.priority,
              status:
                created.status,
              siteId:
                created.siteId,
              departmentId:
                created.departmentId,
              ownerId:
                created.ownerId,
              initialScore:
                created.initialScore,
              initialRiskLevel:
                created.initialRiskLevel,
              residualScore:
                created.residualScore,
              residualRiskLevel:
                created.residualRiskLevel,
              customFormCount:
                input.customSubmissions
                  ?.length ?? 0,
            },
          },
        });

        return created;
      }
    );

  return moc;
}

export async function updateMocService(input: {
  organizationId: string;
  userId: string;
  mocId: string;

  title: string;
  description: string;
  businessJustification: string;

  changeType: MocChangeType;
  changeDuration: MocChangeDuration;
  priority: MocPriority;

  emergencyJustification?: string | null;
  temporaryExpirationDate?: Date | null;

  affectedProcess?: string | null;
  affectedEquipment?: string | null;
  affectedSystems?: string | null;
  affectedMaterials?: string | null;

  operationalImpact?: string | null;
  regulatoryImpact?: string | null;
  environmentalImpact?: string | null;
  safetyImpact?: string | null;
  qualityImpact?: string | null;

  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;

  proposedStartDate?: Date | null;
  plannedCompletionDate?: Date | null;

  siteId: string;
  departmentId?: string | null;
  ownerId?: string | null;
}) {
  const existingMoc =
    await findTenantMocById({
      organizationId:
        input.organizationId,
      mocId: input.mocId,
    });

  if (!existingMoc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  if (
    existingMoc.status ===
      MocStatus.CLOSED ||
    existingMoc.status ===
      MocStatus.CANCELLED
  ) {
    throw new Error(
      "A closed or cancelled change cannot be edited."
    );
  }

  await validateMocScope({
    organizationId:
      input.organizationId,
    siteId: input.siteId,
    departmentId:
      input.departmentId,
    ownerId: input.ownerId,
  });

  if (
    input.changeDuration ===
      MocChangeDuration.EMERGENCY &&
    !input.emergencyJustification
  ) {
    throw new Error(
      "Emergency justification is required for an emergency change."
    );
  }

  if (
    input.changeDuration ===
      MocChangeDuration.TEMPORARY &&
    !input.temporaryExpirationDate
  ) {
    throw new Error(
      "A temporary expiration date is required for a temporary change."
    );
  }

  if (
    input.proposedStartDate &&
    input.plannedCompletionDate &&
    input.proposedStartDate >
      input.plannedCompletionDate
  ) {
    throw new Error(
      "The proposed start date cannot be after the planned completion date."
    );
  }

  const residualRating =
    calculateRiskRating({
      likelihood:
        input.residualLikelihood,
      impact:
        input.residualImpact,
    });

  const updatedMoc =
    await prisma.managementOfChange.update({
      where: {
        id: input.mocId,
      },

      data: {
        title: input.title,
        description:
          input.description,
        businessJustification:
          input.businessJustification,

        changeType:
          input.changeType,
        changeDuration:
          input.changeDuration,
        priority:
          input.priority,

        emergencyJustification:
          input.emergencyJustification,
        temporaryExpirationDate:
          input.temporaryExpirationDate,

        affectedProcess:
          input.affectedProcess,
        affectedEquipment:
          input.affectedEquipment,
        affectedSystems:
          input.affectedSystems,
        affectedMaterials:
          input.affectedMaterials,

        operationalImpact:
          input.operationalImpact,
        regulatoryImpact:
          input.regulatoryImpact,
        environmentalImpact:
          input.environmentalImpact,
        safetyImpact:
          input.safetyImpact,
        qualityImpact:
          input.qualityImpact,

        residualLikelihood:
          input.residualLikelihood,
        residualImpact:
          input.residualImpact,
        residualScore:
          residualRating.score,
        residualRiskLevel:
          residualRating.riskLevel,

        proposedStartDate:
          input.proposedStartDate,
        plannedCompletionDate:
          input.plannedCompletionDate,

        siteId:
          input.siteId,
        departmentId:
          input.departmentId,
        ownerId:
          input.ownerId,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.UPDATE,
    entityType:
      "ManagementOfChange",
    entityId:
      updatedMoc.id,
    title:
      "Management of change updated",
    description:
      `${updatedMoc.reference}: ${updatedMoc.title}`,
    metadata: {
      previousResidualScore:
        existingMoc.residualScore,
      residualScore:
        updatedMoc.residualScore,
      previousResidualRiskLevel:
        existingMoc.residualRiskLevel,
      residualRiskLevel:
        updatedMoc.residualRiskLevel,
      ownerId:
        updatedMoc.ownerId,
      siteId:
        updatedMoc.siteId,
    },
  });

  return updatedMoc;
}

export async function transitionMocStatusService(input: {
  organizationId: string;
  userId: string;
  mocId: string;
  status: MocStatus;
  comments?: string | null;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const moc =
    await findTenantMocById({
      organizationId:
        input.organizationId,
      mocId: input.mocId,
    });

  if (!moc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  const allowedStatuses =
    getMocNextStatuses(
      moc.status
    );

  if (
    !allowedStatuses.includes(
      input.status
    )
  ) {
    throw new Error(
      `The change cannot move from ${moc.status} to ${input.status}.`
    );
  }

  if (
    input.status ===
    MocStatus.APPROVED
  ) {
    if (
      moc.approvals.length === 0
    ) {
      throw new Error(
        "At least one approval requirement must be added before the change can be approved."
      );
    }
  
    const pendingApprovals =
      moc.approvals.filter(
        (approval) =>
          approval.status ===
          MocApprovalStatus.PENDING
      );
  
    const rejectedApprovals =
      moc.approvals.filter(
        (approval) =>
          approval.status ===
          MocApprovalStatus.REJECTED
      );
  
    if (
      rejectedApprovals.length > 0
    ) {
      throw new Error(
        "The change cannot be approved because at least one approval was rejected."
      );
    }
  
    if (
      pendingApprovals.length > 0
    ) {
      throw new Error(
        "All required approvals must be completed before the change can be approved."
      );
    }
  }

  if (
    input.status ===
    MocStatus.VERIFICATION
  ) {
    const incompleteRequiredTasks =
      moc.tasks.filter(
        (task) =>
          task.isRequired &&
          task.status !==
            MocTaskStatus.COMPLETED
      );

    if (
      incompleteRequiredTasks.length >
      0
    ) {
      throw new Error(
        "All required implementation tasks must be completed before verification."
      );
    }
  }

  if (
    input.status ===
    MocStatus.CLOSED
  ) {
    const incompleteRequiredTasks =
      moc.tasks.filter(
        (task) =>
          task.isRequired &&
          task.status !==
            MocTaskStatus.COMPLETED
      );

    if (
      incompleteRequiredTasks.length >
      0
    ) {
      throw new Error(
        "All required tasks must be completed before closing the change."
      );
    }
  }

  const timestamp = new Date();

  const updatedMoc =
    await prisma.$transaction(async transaction => {
      const updated =
        await transaction.managementOfChange.update({
          where: {
            id: input.mocId,
          },

          data: {
            status: input.status,

            ...(input.status ===
            MocStatus.IMPLEMENTATION
              ? {
                  actualStartDate:
                    moc.actualStartDate ??
                    timestamp,
                }
              : {}),

            ...(input.status ===
            MocStatus.VERIFICATION
              ? {
                  implementedAt:
                    moc.implementedAt ??
                    timestamp,
                }
              : {}),

            ...(input.status ===
            MocStatus.CLOSED
              ? {
                  verifiedAt:
                    moc.verifiedAt ??
                    timestamp,
                  closedAt: timestamp,
                }
              : {}),
          },
        });

      if (input.offlineSubmission) {
        await transaction.offlineSubmission.create({
          data: {
            id: input.offlineSubmission.id,
            organizationId:
              input.organizationId,
            userId: input.userId,
            recordType: "MOC_STATUS",
            recordId: updated.id,
            capturedAt:
              input.offlineSubmission.capturedAt,
            payloadHash:
              input.offlineSubmission.payloadHash,
          },
        });
      }

      return updated;
    });

    const lifecycleRecipients =
  new Set<string>([
    moc.requestorId,
  ]);

if (moc.ownerId) {
  lifecycleRecipients.add(
    moc.ownerId
  );
}

lifecycleRecipients.delete(
  input.userId
);

const lifecycleNotification =
  getMocLifecycleNotification(
    updatedMoc.status
  );

if (lifecycleNotification) {
  await Promise.all(
    [...lifecycleRecipients].map(
      (recipientId) =>
        createNotification({
          organizationId:
            input.organizationId,

          userId:
            recipientId,

          type:
            lifecycleNotification.type,

          title:
            lifecycleNotification.title,

          message:
            `${moc.reference}: ${moc.title} ${lifecycleNotification.message}.`,

          link:
            `/moc/${moc.id}`,
        })
    )
  );
}

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType:
      "ManagementOfChange",
    entityId:
      updatedMoc.id,
    title:
      "Management of change status updated",
    description:
      `${moc.status} → ${updatedMoc.status}`,
    metadata: {
      previousStatus:
        moc.status,
      newStatus:
        updatedMoc.status,
      comments:
        input.comments,
      actualStartDate:
        updatedMoc.actualStartDate
          ?.toISOString() ??
        null,
      implementedAt:
        updatedMoc.implementedAt
          ?.toISOString() ??
        null,
      closedAt:
        updatedMoc.closedAt
          ?.toISOString() ??
        null,
    },
  });

  return updatedMoc;
}

export async function createMocApprovalService(input: {
  organizationId: string;
  userId: string;
  mocId: string;
  role: MocApprovalRole;
  sequence: number;
  approverId?: string | null;
}) {
  const moc =
    await findTenantMocById({
      organizationId:
        input.organizationId,
      mocId: input.mocId,
    });

  if (!moc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  if (input.approverId) {
    const approver =
      await prisma.user.findFirst({
        where: {
          id: input.approverId,
          organizationId:
            input.organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!approver) {
      throw new Error(
        "The selected approver was not found in this organization."
      );
    }
  }

  const approval =
    await prisma.mocApproval.create({
      data: {
        mocId: input.mocId,
        role: input.role,
        sequence:
          input.sequence,
        approverId:
          input.approverId,
        status:
          MocApprovalStatus.PENDING,
      },
    });

    if (approval.approverId) {
      await createNotification({
        organizationId: input.organizationId,
        userId: approval.approverId,
        type: NotificationType.ASSIGNMENT,
        title: "MOC approval assigned",
        message: `You have been assigned the ${approval.role
          .replaceAll("_", " ")
          .toLowerCase()} approval for ${moc.reference}: ${moc.title}.`,
        link: `/moc/${moc.id}`,
      });
    }

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.CREATE,
    entityType:
      "MocApproval",
    entityId:
      approval.id,
    title:
      "MOC approval requirement added",
    description:
      `${moc.reference}: ${approval.role}`,
    metadata: {
      mocId: moc.id,
      role: approval.role,
      sequence:
        approval.sequence,
      approverId:
        approval.approverId,
    },
  });

  return approval;
}

export async function decideMocApprovalService(input: {
  organizationId: string;
  userId: string;
  mocId: string;
  approvalId: string;
  status:
    | typeof MocApprovalStatus.APPROVED
    | typeof MocApprovalStatus.REJECTED;
  comments?: string | null;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const approval =
    await prisma.mocApproval.findFirst({
      where: {
        id: input.approvalId,

        moc: {
          id: input.mocId,
          organizationId:
            input.organizationId,
        },
      },

      include: {
        moc: {
          select: {
            reference: true,
          },
        },
      },
    });

  if (!approval) {
    throw new Error(
      "MOC approval record was not found in this organization."
    );
  }

  if (
    approval.approverId &&
    approval.approverId !==
      input.userId
  ) {
    throw new Error(
      "Only the assigned approver can decide this approval."
    );
  }

  if (
    approval.status !==
    MocApprovalStatus.PENDING
  ) {
    throw new Error(
      "This approval has already been decided."
    );
  }

  const updatedApproval =
    await prisma.$transaction(async transaction => {
      const updated =
        await transaction.mocApproval.update({
          where: {
            id: approval.id,
          },

          data: {
            status: input.status,
            comments:
              input.comments,
            approverId:
              approval.approverId ??
              input.userId,
            decidedAt:
              new Date(),
          },
        });

      if (input.offlineSubmission) {
        await transaction.offlineSubmission.create({
          data: {
            id: input.offlineSubmission.id,
            organizationId:
              input.organizationId,
            userId: input.userId,
            recordType:
              "MOC_APPROVAL_DECISION",
            recordId: updated.id,
            capturedAt:
              input.offlineSubmission.capturedAt,
            payloadHash:
              input.offlineSubmission.payloadHash,
          },
        });
      }

      return updated;
    });

    const notificationRecipients = new Set<string>();

const approvalMoc =
  await prisma.managementOfChange.findFirst({
    where: {
      id: input.mocId,
      organizationId: input.organizationId,
    },

    select: {
      id: true,
      reference: true,
      title: true,
      requestorId: true,
      ownerId: true,
    },
  });

if (approvalMoc) {
  notificationRecipients.add(
    approvalMoc.requestorId
  );

  if (approvalMoc.ownerId) {
    notificationRecipients.add(
      approvalMoc.ownerId
    );
  }

  notificationRecipients.delete(
    input.userId
  );

  await Promise.all(
    [...notificationRecipients].map(
      (recipientId) =>
        createNotification({
          organizationId:
            input.organizationId,

          userId:
            recipientId,

          type:
            updatedApproval.status ===
            MocApprovalStatus.APPROVED
              ? NotificationType.SUCCESS
              : NotificationType.WARNING,

          title:
            updatedApproval.status ===
            MocApprovalStatus.APPROVED
              ? "MOC approval completed"
              : "MOC approval rejected",

          message:
            `${updatedApproval.role
              .replaceAll("_", " ")
              .toLowerCase()} approval for ${approvalMoc.reference}: ${approvalMoc.title} was ${updatedApproval.status.toLowerCase()}.`,

          link:
            `/moc/${approvalMoc.id}`,
        })
    )
  );
}

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType:
      "MocApproval",
    entityId:
      updatedApproval.id,
    title:
      "MOC approval decided",
    description:
      `${approval.moc.reference}: ${updatedApproval.role} ${updatedApproval.status}`,
    metadata: {
      mocId: input.mocId,
      role:
        updatedApproval.role,
      status:
        updatedApproval.status,
      comments:
        updatedApproval.comments,
      approverId:
        updatedApproval.approverId,
    },
  });

  return updatedApproval;
}

export async function createMocTaskService(input: {
  organizationId: string;
  userId: string;
  mocId: string;
  title: string;
  description?: string | null;
  taskType: MocTaskType;
  sequence?: number | null;
  isRequired: boolean;
  assignedToId?: string | null;
  dueDate?: Date | null;
}) {
  const moc =
    await findTenantMocById({
      organizationId:
        input.organizationId,
      mocId: input.mocId,
    });

  if (!moc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  if (input.assignedToId) {
    const assignee =
      await prisma.user.findFirst({
        where: {
          id: input.assignedToId,
          organizationId:
            input.organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!assignee) {
      throw new Error(
        "The selected task assignee was not found in this organization."
      );
    }
  }

  const task =
    await prisma.mocTask.create({
      data: {
        mocId: input.mocId,
        title: input.title,
        description:
          input.description,
        taskType:
          input.taskType,
        sequence:
          input.sequence,
        isRequired:
          input.isRequired,
        assignedToId:
          input.assignedToId,
        dueDate:
          input.dueDate,
        status:
          MocTaskStatus.NOT_STARTED,
      },
    });

    if (task.assignedToId) {
      await createNotification({
        organizationId:
          input.organizationId,
    
        userId:
          task.assignedToId,
    
        type:
          NotificationType.ASSIGNMENT,
    
        title:
          "MOC task assigned",
    
        message:
          `You have been assigned "${task.title}" for ${moc.reference}: ${moc.title}.`,
    
        link:
          `/moc/${moc.id}`,
      });
    }

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.CREATE,
    entityType:
      "MocTask",
    entityId: task.id,
    title:
      "MOC task created",
    description:
      `${moc.reference}: ${task.title}`,
    metadata: {
      mocId: moc.id,
      taskType:
        task.taskType,
      isRequired:
        task.isRequired,
      assignedToId:
        task.assignedToId,
      dueDate:
        task.dueDate
          ?.toISOString() ??
        null,
    },
  });

  return task;
}

export async function updateMocTaskService(input: {
    organizationId: string;
    userId: string;
    mocId: string;
    taskId: string;
    status: MocTaskStatus;
    evidenceNote?: string | null;
    offlineSubmission?: {
      id: string;
      capturedAt: Date;
      payloadHash: string;
    };
  }) {
    const task =
      await prisma.mocTask.findFirst({
        where: {
          id: input.taskId,
  
          moc: {
            id: input.mocId,
            organizationId:
              input.organizationId,
          },
        },
      });
  
    if (!task) {
      throw new Error(
        "MOC task was not found in this organization."
      );
    }
  
    const now = new Date();
  
    const isStarting =
      input.status ===
      MocTaskStatus.IN_PROGRESS;
  
    const isCompleted =
      input.status ===
      MocTaskStatus.COMPLETED;
  
    const updatedTask =
      await prisma.$transaction(async transaction => {
        const updated =
          await transaction.mocTask.update({
            where: {
              id: task.id,
            },

            data: {
              status: input.status,

              evidenceNote:
                input.evidenceNote,

              startedAt:
                isStarting &&
                !task.startedAt
                  ? now
                  : task.startedAt,

              completedAt:
                isCompleted
                  ? now
                  : null,

              verifiedAt:
                isCompleted
                  ? now
                  : null,

              verifiedById:
                isCompleted
                  ? input.userId
                  : null,
            },
          });

        if (input.offlineSubmission) {
          await transaction.offlineSubmission.create({
            data: {
              id: input.offlineSubmission.id,
              organizationId:
                input.organizationId,
              userId: input.userId,
              recordType: "MOC_TASK_STATUS",
              recordId: updated.id,
              capturedAt:
                input.offlineSubmission.capturedAt,
              payloadHash:
                input.offlineSubmission.payloadHash,
            },
          });
        }

        return updated;
      });

      if (
        updatedTask.status ===
        MocTaskStatus.COMPLETED
      ) {
        const taskMoc =
          await prisma.managementOfChange.findFirst({
            where: {
              id: input.mocId,
              organizationId:
                input.organizationId,
            },
      
            select: {
              id: true,
              reference: true,
              title: true,
              requestorId: true,
              ownerId: true,
            },
          });
      
        if (taskMoc) {
          const recipients =
            new Set<string>([
              taskMoc.requestorId,
            ]);
      
          if (taskMoc.ownerId) {
            recipients.add(
              taskMoc.ownerId
            );
          }
      
          recipients.delete(
            input.userId
          );
      
          await Promise.all(
            [...recipients].map(
              (recipientId) =>
                createNotification({
                  organizationId:
                    input.organizationId,
      
                  userId:
                    recipientId,
      
                  type:
                    NotificationType.SUCCESS,
      
                  title:
                    "MOC task completed",
      
                  message:
                    `"${updatedTask.title}" was completed for ${taskMoc.reference}: ${taskMoc.title}.`,
      
                  link:
                    `/moc/${taskMoc.id}`,
                })
            )
          );
        }
      }
  
    await logActivity({
      organizationId:
        input.organizationId,
  
      userId:
        input.userId,
  
      action:
        ActivityAction.STATUS_CHANGE,
  
      entityType:
        "MocTask",
  
      entityId:
        updatedTask.id,
  
      title:
        "MOC task status updated",
  
      description:
        `${task.status} → ${updatedTask.status}`,
  
      metadata: {
        mocId:
          input.mocId,
  
        previousStatus:
          task.status,
  
        newStatus:
          updatedTask.status,
  
        evidenceNote:
          updatedTask.evidenceNote,
  
        startedAt:
          updatedTask.startedAt
            ?.toISOString() ??
          null,
  
        completedAt:
          updatedTask.completedAt
            ?.toISOString() ??
          null,
  
        verifiedAt:
          updatedTask.verifiedAt
            ?.toISOString() ??
          null,
  
        verifiedById:
          updatedTask.verifiedById,
      },
    });
  
    return updatedTask;
  }

export async function linkRiskToMocService(input: {
  organizationId: string;
  userId: string;
  mocId: string;
  riskId: string;
  relationshipNote?: string | null;
}) {
  const [
    moc,
    risk,
  ] = await Promise.all([
    findTenantMocById({
      organizationId:
        input.organizationId,
      mocId: input.mocId,
    }),

    prisma.risk.findFirst({
      where: {
        id: input.riskId,
        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
        reference: true,
        title: true,
      },
    }),
  ]);

  if (!moc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  if (!risk) {
    throw new Error(
      "Risk record not found in this organization."
    );
  }

  const link =
    await prisma.mocRiskLink.upsert({
      where: {
        mocId_riskId: {
          mocId: input.mocId,
          riskId: input.riskId,
        },
      },

      update: {
        relationshipNote:
          input.relationshipNote,
      },

      create: {
        mocId: input.mocId,
        riskId: input.riskId,
        relationshipNote:
          input.relationshipNote,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.CREATE,
    entityType:
      "MocRiskLink",
    entityId: link.id,
    title:
      "Risk linked to management of change",
    description:
      `${moc.reference} ↔ ${risk.reference}`,
    metadata: {
      mocId: input.mocId,
      riskId: input.riskId,
      relationshipNote:
        link.relationshipNote,
    },
  });

  return link;
}

export async function unlinkRiskFromMocService(input: {
  organizationId: string;
  userId: string;
  mocId: string;
  linkId: string;
}) {
  const link =
    await prisma.mocRiskLink.findFirst({
      where: {
        id: input.linkId,

        moc: {
          id: input.mocId,
          organizationId:
            input.organizationId,
        },
      },

      include: {
        risk: {
          select: {
            reference: true,
          },
        },

        moc: {
          select: {
            reference: true,
          },
        },
      },
    });

  if (!link) {
    throw new Error(
      "MOC risk link was not found in this organization."
    );
  }

  await prisma.mocRiskLink.delete({
    where: {
      id: link.id,
    },
  });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.DELETE,
    entityType:
      "MocRiskLink",
    entityId: link.id,
    title:
      "Risk unlinked from management of change",
    description:
      `${link.moc.reference} ↔ ${link.risk.reference}`,
    metadata: {
      mocId: input.mocId,
      riskId: link.riskId,
    },
  });
}

function getMocLifecycleNotification(
  status: MocStatus
): {
  type: NotificationType;
  title: string;
  message: string;
} | null {
  switch (status) {
    case MocStatus.TECHNICAL_REVIEW:
      return {
        type: NotificationType.INFO,
        title: "MOC entered technical review",
        message:
          "has entered technical review",
      };

    case MocStatus.RISK_REVIEW:
      return {
        type: NotificationType.WARNING,
        title: "MOC entered risk review",
        message:
          "has entered risk review",
      };

    case MocStatus.PENDING_APPROVAL:
      return {
        type: NotificationType.ASSIGNMENT,
        title: "MOC awaiting approvals",
        message:
          "is awaiting required approvals",
      };

    case MocStatus.APPROVED:
      return {
        type: NotificationType.SUCCESS,
        title: "MOC approved",
        message:
          "has completed its approval stage",
      };

    case MocStatus.IMPLEMENTATION:
      return {
        type: NotificationType.INFO,
        title: "MOC implementation started",
        message:
          "has moved into implementation",
      };

    case MocStatus.VERIFICATION:
      return {
        type: NotificationType.DUE_DATE,
        title: "MOC ready for verification",
        message:
          "is ready for implementation verification",
      };

    case MocStatus.CLOSED:
      return {
        type: NotificationType.SUCCESS,
        title: "MOC closed",
        message:
          "has been verified and closed",
      };

    case MocStatus.REJECTED:
      return {
        type: NotificationType.WARNING,
        title: "MOC rejected",
        message:
          "has been rejected and requires review",
      };

    case MocStatus.CANCELLED:
      return {
        type: NotificationType.WARNING,
        title: "MOC cancelled",
        message:
          "has been cancelled",
      };

    case MocStatus.DRAFT:
    default:
      return null;
  }
}
