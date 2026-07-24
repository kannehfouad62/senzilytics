import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  ConfigurableFormModule,
  RiskCategory,
  RiskControlEffectiveness,
  RiskControlHierarchy,
  RiskControlType,
  RiskImpact,
  RiskLikelihood,
  RiskLinkedEntityType,
  RiskReviewFrequency,
  RiskStatus,
  Status,
} from "@prisma/client";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  calculateRiskRating,
} from "./risk-scoring";
import {
  findTenantRiskById,
  getNextRiskReference,
} from "./risk.repository";

export async function createRiskService(input: {
  organizationId: string;
  userId: string;
  title: string;
  description: string;
  category: RiskCategory;
  hazardType?: string | null;
  process?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  initialLikelihood: RiskLikelihood;
  initialImpact: RiskImpact;
  currentLikelihood: RiskLikelihood;
  currentImpact: RiskImpact;
  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;
  reviewFrequency: RiskReviewFrequency;
  nextReviewDate?: Date | null;
  customSubmissions?: PreparedSubmission[];
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const [
    site,
    department,
    owner,
  ] = await Promise.all([
    input.siteId
      ? prisma.site.findFirst({
          where: {
            id: input.siteId,
            organizationId:
              input.organizationId,
          },
          select: {
            id: true,
          },
        })
      : null,

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

  if (
    input.siteId &&
    !site
  ) {
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
    input.siteId &&
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
      "The selected risk owner was not found in this organization."
    );
  }

  const [
    initialRating,
    currentRating,
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
          input.currentLikelihood,
        impact:
          input.currentImpact,
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

    getNextRiskReference(
      input.organizationId
    ),
  ]);

  const risk =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.risk.create({
            data: {
              reference,
              title: input.title,
              description:
                input.description,
              category:
                input.category,
              hazardType:
                input.hazardType,
              process:
                input.process,
              status:
                RiskStatus.DRAFT,

              organizationId:
                input.organizationId,

              siteId:
                input.siteId,
              departmentId:
                input.departmentId,
              ownerId:
                input.ownerId,

              initialLikelihood:
                input.initialLikelihood,
              initialImpact:
                input.initialImpact,
              initialScore:
                initialRating.score,
              initialRiskLevel:
                initialRating.riskLevel,

              currentLikelihood:
                input.currentLikelihood,
              currentImpact:
                input.currentImpact,
              currentScore:
                currentRating.score,
              currentRiskLevel:
                currentRating.riskLevel,

              residualLikelihood:
                input.residualLikelihood,
              residualImpact:
                input.residualImpact,
              residualScore:
                residualRating.score,
              residualRiskLevel:
                residualRating.riskLevel,

              reviewFrequency:
                input.reviewFrequency,
              nextReviewDate:
                input.nextReviewDate,
            },
          });

        await createPreparedSubmissions(
          tx,
          {
            organizationId:
              input.organizationId,
            userId: input.userId,
            module:
              ConfigurableFormModule.RISK,
            entityId: created.id,
            submissions:
              input.customSubmissions ??
              [],
          }
        );

        if (input.offlineSubmission) {
          await tx.offlineSubmission.create({
            data: {
              id: input.offlineSubmission.id,
              organizationId: input.organizationId,
              userId: input.userId,
              recordType: "RISK_CAPTURE",
              recordId: created.id,
              capturedAt: input.offlineSubmission.capturedAt,
              payloadHash: input.offlineSubmission.payloadHash,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            organizationId:
              input.organizationId,
            userId: input.userId,
            action:
              ActivityAction.CREATE,
            entityType: "Risk",
            entityId: created.id,
            title: "Risk created",
            description:
              `${created.reference}: ${created.title}`,
            metadata: {
              category:
                created.category,
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
              currentScore:
                created.currentScore,
              currentRiskLevel:
                created.currentRiskLevel,
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

  return risk;
}

export async function updateRiskService(input: {
  organizationId: string;
  userId: string;
  riskId: string;
  title: string;
  description: string;
  category: RiskCategory;
  hazardType?: string | null;
  process?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  status: RiskStatus;
  currentLikelihood: RiskLikelihood;
  currentImpact: RiskImpact;
  residualLikelihood: RiskLikelihood;
  residualImpact: RiskImpact;
  reviewFrequency: RiskReviewFrequency;
  nextReviewDate?: Date | null;
}) {
  const existingRisk =
    await findTenantRiskById({
      organizationId:
        input.organizationId,
      riskId: input.riskId,
    });

  if (!existingRisk) {
    throw new Error(
      "Risk not found in this organization."
    );
  }

  const [
    site,
    department,
    owner,
  ] = await Promise.all([
    input.siteId
      ? prisma.site.findFirst({
          where: {
            id: input.siteId,
            organizationId:
              input.organizationId,
          },
          select: {
            id: true,
          },
        })
      : null,

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

  if (
    input.siteId &&
    !site
  ) {
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
    input.siteId &&
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
      "The selected risk owner was not found in this organization."
    );
  }

  const currentRating =
    calculateRiskRating({
      likelihood:
        input.currentLikelihood,
      impact:
        input.currentImpact,
    });

  const residualRating =
    calculateRiskRating({
      likelihood:
        input.residualLikelihood,
      impact:
        input.residualImpact,
    });

  const updatedRisk =
    await prisma.risk.update({
      where: {
        id: input.riskId,
      },

      data: {
        title: input.title,
        description:
          input.description,
        category:
          input.category,
        hazardType:
          input.hazardType,
        process:
          input.process,
        status:
          input.status,

        siteId:
          input.siteId,
        departmentId:
          input.departmentId,
        ownerId:
          input.ownerId,

        currentLikelihood:
          input.currentLikelihood,
        currentImpact:
          input.currentImpact,
        currentScore:
          currentRating.score,
        currentRiskLevel:
          currentRating.riskLevel,

        residualLikelihood:
          input.residualLikelihood,
        residualImpact:
          input.residualImpact,
        residualScore:
          residualRating.score,
        residualRiskLevel:
          residualRating.riskLevel,

        reviewFrequency:
          input.reviewFrequency,
        nextReviewDate:
          input.nextReviewDate,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.UPDATE,
    entityType: "Risk",
    entityId:
      updatedRisk.id,
    title: "Risk updated",
    description:
      `${updatedRisk.reference}: ${updatedRisk.title}`,
    metadata: {
      previousStatus:
        existingRisk.status,
      newStatus:
        updatedRisk.status,
      previousCurrentScore:
        existingRisk.currentScore,
      currentScore:
        updatedRisk.currentScore,
      previousResidualScore:
        existingRisk.residualScore,
      residualScore:
        updatedRisk.residualScore,
      currentRiskLevel:
        updatedRisk.currentRiskLevel,
      residualRiskLevel:
        updatedRisk.residualRiskLevel,
    },
  });

  return updatedRisk;
}

export async function createRiskControlService(input: {
  organizationId: string;
  userId: string;
  riskId: string;
  name: string;
  description?: string | null;
  controlType: RiskControlType;
  hierarchy: RiskControlHierarchy;
  effectiveness: RiskControlEffectiveness;
  ownerId?: string | null;
  dueDate?: Date | null;
  verificationDate?: Date | null;
  verificationMethod?: string | null;
}) {
  const risk =
    await findTenantRiskById({
      organizationId:
        input.organizationId,
      riskId: input.riskId,
    });

  if (!risk) {
    throw new Error(
      "Risk not found in this organization."
    );
  }

  if (input.ownerId) {
    const owner =
      await prisma.user.findFirst({
        where: {
          id: input.ownerId,
          organizationId:
            input.organizationId,
        },
        select: {
          id: true,
        },
      });

    if (!owner) {
      throw new Error(
        "The selected control owner was not found in this organization."
      );
    }
  }

  const control =
    await prisma.riskControl.create({
      data: {
        riskId:
          input.riskId,
        name:
          input.name,
        description:
          input.description,
        controlType:
          input.controlType,
        hierarchy:
          input.hierarchy,
        effectiveness:
          input.effectiveness,
        ownerId:
          input.ownerId,
        dueDate:
          input.dueDate,
        verificationDate:
          input.verificationDate,
        verificationMethod:
          input.verificationMethod,
        status:
          input.controlType ===
          RiskControlType.EXISTING
            ? Status.COMPLETED
            : Status.OPEN,
        implementedAt:
          input.controlType ===
          RiskControlType.EXISTING
            ? new Date()
            : null,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.CREATE,
    entityType:
      "RiskControl",
    entityId:
      control.id,
    title:
      "Risk control created",
    description:
      control.name,
    metadata: {
      riskId:
        risk.id,
      riskReference:
        risk.reference,
      controlType:
        control.controlType,
      hierarchy:
        control.hierarchy,
      effectiveness:
        control.effectiveness,
      ownerId:
        control.ownerId,
      status:
        control.status,
    },
  });

  return control;
}

export async function updateRiskControlStatusService(input: {
  organizationId: string;
  userId: string;
  riskId: string;
  controlId: string;
  status: Status;
  effectiveness?: RiskControlEffectiveness | null;
  verificationResult?: string | null;
}) {
  const control =
    await prisma.riskControl.findFirst({
      where: {
        id: input.controlId,
        risk: {
          id: input.riskId,
          organizationId:
            input.organizationId,
        },
      },
    });

  if (!control) {
    throw new Error(
      "Risk control not found in this organization."
    );
  }

  const updatedControl =
    await prisma.riskControl.update({
      where: {
        id: input.controlId,
      },

      data: {
        status:
          input.status,

        ...(input.effectiveness
          ? {
              effectiveness:
                input.effectiveness,
            }
          : {}),

        verificationResult:
          input.verificationResult,

        implementedAt:
          input.status ===
            Status.COMPLETED &&
          !control.implementedAt
            ? new Date()
            : control.implementedAt,

        verificationDate:
          input.status ===
            Status.COMPLETED
            ? new Date()
            : control.verificationDate,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.STATUS_CHANGE,
    entityType:
      "RiskControl",
    entityId:
      updatedControl.id,
    title:
      "Risk control status changed",
    description:
      `${control.status} → ${updatedControl.status}`,
    metadata: {
      riskId:
        input.riskId,
      previousStatus:
        control.status,
      newStatus:
        updatedControl.status,
      effectiveness:
        updatedControl.effectiveness,
    },
  });

  return updatedControl;
}

export async function createRiskReviewService(input: {
  organizationId: string;
  userId: string;
  riskId: string;
  notes?: string | null;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  controlEffectiveness?: RiskControlEffectiveness | null;
  trend?: string | null;
  nextReviewDate?: Date | null;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const risk =
    await findTenantRiskById({
      organizationId:
        input.organizationId,
      riskId:
        input.riskId,
    });

  if (!risk) {
    throw new Error(
      "Risk not found in this organization."
    );
  }

  const rating =
    calculateRiskRating({
      likelihood:
        input.likelihood,
      impact:
        input.impact,
    });

  const review =
    await prisma.$transaction(
      async (transaction) => {
        const createdReview =
          await transaction.riskReview.create({
            data: {
              riskId:
                input.riskId,
              notes:
                input.notes,
              likelihood:
                input.likelihood,
              impact:
                input.impact,
              score:
                rating.score,
              riskLevel:
                rating.riskLevel,
              controlEffectiveness:
                input.controlEffectiveness,
              trend:
                input.trend,
              nextReviewDate:
                input.nextReviewDate,
              completedById:
                input.userId,
            },
          });

        await transaction.risk.update({
          where: {
            id: input.riskId,
          },

          data: {
            currentLikelihood:
              input.likelihood,
            currentImpact:
              input.impact,
            currentScore:
              rating.score,
            currentRiskLevel:
              rating.riskLevel,
            lastReviewedAt:
              new Date(),
            nextReviewDate:
              input.nextReviewDate,
            status:
              risk.status ===
              RiskStatus.DRAFT
                ? RiskStatus.ACTIVE
                : risk.status,
          },
        });

        if (input.offlineSubmission) {
          await transaction.offlineSubmission.create({
            data: {
              id: input.offlineSubmission.id,
              organizationId: input.organizationId,
              userId: input.userId,
              recordType: "RISK_REVIEW",
              recordId: createdReview.id,
              capturedAt: input.offlineSubmission.capturedAt,
              payloadHash: input.offlineSubmission.payloadHash,
            },
          });
        }

        return createdReview;
      }
    );

  await logActivity({
    organizationId:
      input.organizationId,
    userId:
      input.userId,
    action:
      ActivityAction.CREATE,
    entityType:
      "RiskReview",
    entityId:
      review.id,
    title:
      "Risk review completed",
    description:
      `${risk.reference}: ${risk.title}`,
    metadata: {
      riskId:
        risk.id,
      score:
        review.score,
      riskLevel:
        review.riskLevel,
      likelihood:
        review.likelihood,
      impact:
        review.impact,
      controlEffectiveness:
        review.controlEffectiveness,
      trend:
        review.trend,
      nextReviewDate:
        review.nextReviewDate?.toISOString() ??
        null,
    },
  });

  return review;
}

export async function createRiskLinkService(input: {
  organizationId: string;
  userId: string;
  riskId: string;
  entityType: RiskLinkedEntityType;
  entityId: string;
  label?: string | null;
}) {
  const risk =
    await findTenantRiskById({
      organizationId:
        input.organizationId,
      riskId:
        input.riskId,
    });

  if (!risk) {
    throw new Error(
      "Risk not found in this organization."
    );
  }

  const link =
    await prisma.riskLink.upsert({
      where: {
        riskId_entityType_entityId: {
          riskId:
            input.riskId,
          entityType:
            input.entityType,
          entityId:
            input.entityId,
        },
      },

      update: {
        label:
          input.label,
      },

      create: {
        riskId:
          input.riskId,
        entityType:
          input.entityType,
        entityId:
          input.entityId,
        label:
          input.label,
      },
    });

  await logActivity({
    organizationId:
      input.organizationId,
    userId:
      input.userId,
    action:
      ActivityAction.CREATE,
    entityType:
      "RiskLink",
    entityId:
      link.id,
    title:
      "Record linked to risk",
    description:
      link.label ||
      `${link.entityType}: ${link.entityId}`,
    metadata: {
      riskId:
        risk.id,
      riskReference:
        risk.reference,
      linkedEntityType:
        link.entityType,
      linkedEntityId:
        link.entityId,
    },
  });

  return link;
}

export async function deleteRiskLinkService(input: {
  organizationId: string;
  userId: string;
  riskId: string;
  linkId: string;
}) {
  const link =
    await prisma.riskLink.findFirst({
      where: {
        id: input.linkId,
        risk: {
          id: input.riskId,
          organizationId:
            input.organizationId,
        },
      },
    });

  if (!link) {
    throw new Error(
      "Risk link not found in this organization."
    );
  }

  await prisma.riskLink.delete({
    where: {
      id: link.id,
    },
  });

  await logActivity({
    organizationId:
      input.organizationId,
    userId:
      input.userId,
    action:
      ActivityAction.DELETE,
    entityType:
      "RiskLink",
    entityId:
      link.id,
    title:
      "Risk link removed",
    description:
      link.label ||
      `${link.entityType}: ${link.entityId}`,
    metadata: {
      riskId:
        input.riskId,
      linkedEntityType:
        link.entityType,
      linkedEntityId:
        link.entityId,
    },
  });
}
