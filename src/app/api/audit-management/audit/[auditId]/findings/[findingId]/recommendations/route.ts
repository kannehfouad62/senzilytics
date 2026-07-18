import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  EnterpriseAuditHistoryAction,
  EnterpriseAuditLinkStatus,
  PermissionKey,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";
import { NextResponse } from "next/server";

function optionalText(value: unknown) {
  const normalized =
    String(value ?? "").trim();

  return normalized || null;
}

function optionalDate(value: unknown) {
  const normalized = optionalText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "The proposed due date is invalid."
    );
  }

  return date;
}

async function getFindingContext(
  organizationId: string,
  auditId: string,
  findingId: string
) {
  return prisma.enterpriseAuditFinding.findFirst({
    where: {
      id: findingId,
      organizationId,
      auditId,
    },
    select: {
      id: true,
      reference: true,
      title: true,
      description: true,
      objectiveEvidence: true,
      rootCause: true,
      ownerId: true,
      dueDate: true,
      requiresCapa: true,
      requiresRiskReview: true,
      correctiveActionLinks: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          correctiveActionId: true,
          recommendationTitle: true,
          recommendationDescription: true,
          suggestedOwnerId: true,
          suggestedDueDate: true,
          rationale: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          suggestedOwner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      riskLinks: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          riskId: true,
          proposedRiskTitle: true,
          proposedRiskDescription: true,
          proposedHazard: true,
          proposedConsequence: true,
          proposedLikelihood: true,
          proposedImpact: true,
          rationale: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

function serializeContext(
  finding: NonNullable<
    Awaited<
      ReturnType<typeof getFindingContext>
    >
  >
) {
  return {
    correctiveActionRecommendations:
      finding.correctiveActionLinks.map(
        (link) => ({
          ...link,
          suggestedDueDate:
            link.suggestedDueDate?.toISOString() ??
            null,
          reviewedAt:
            link.reviewedAt?.toISOString() ??
            null,
          createdAt:
            link.createdAt.toISOString(),
          updatedAt:
            link.updatedAt.toISOString(),
        })
      ),
    riskRecommendations:
      finding.riskLinks.map((link) => ({
        ...link,
        reviewedAt:
          link.reviewedAt?.toISOString() ??
          null,
        createdAt:
          link.createdAt.toISOString(),
        updatedAt:
          link.updatedAt.toISOString(),
      })),
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      auditId: string;
      findingId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const { auditId, findingId } =
    await context.params;

  const finding =
    await getFindingContext(
      organizationId,
      auditId,
      findingId
    );

  if (!finding) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit finding was not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,
    ...serializeContext(finding),
  });
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
      findingId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { auditId, findingId } =
    await context.params;

  const finding =
    await getFindingContext(
      organizationId,
      auditId,
      findingId
    );

  if (!finding) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit finding was not found.",
      },
      {
        status: 404,
      }
    );
  }

  const body =
    (await request.json()) as Record<
      string,
      unknown
    >;

  const recommendationType =
    String(body.type ?? "").trim();

  try {
    if (
      recommendationType ===
      "CORRECTIVE_ACTION"
    ) {
      const title =
        optionalText(body.title) ??
        `Corrective action for ${finding.reference}`;

      const ownerId =
        optionalText(body.ownerId) ??
        finding.ownerId;

      if (!ownerId) {
        throw new Error(
          "A proposed corrective-action owner is required."
        );
      }

      const owner =
        await prisma.user.findFirst({
          where: {
            id: ownerId,
            organizationId,
          },
          select: {
            id: true,
          },
        });

      if (!owner) {
        throw new Error(
          "The proposed owner was not found in this organization."
        );
      }

      const existingProposal =
        finding.correctiveActionLinks.find(
          (link) =>
            link.status ===
              EnterpriseAuditLinkStatus.PROPOSED ||
            link.status ===
              EnterpriseAuditLinkStatus.APPROVED
        );

      if (existingProposal) {
        throw new Error(
          "An active corrective-action recommendation already exists for this finding."
        );
      }

      const result =
        await prisma.$transaction(
          async (transaction) => {
            const link =
              await transaction.enterpriseAuditFindingActionLink.create({
                data: {
                  findingId,
                  status:
                    EnterpriseAuditLinkStatus.PROPOSED,
                  recommendationTitle:
                    title,
                  recommendationDescription:
                    optionalText(
                      body.description
                    ) ??
                    finding.description,
                  suggestedOwnerId:
                    ownerId,
                  suggestedDueDate:
                    optionalDate(
                      body.dueDate
                    ) ??
                    finding.dueDate,
                  rationale:
                    optionalText(
                      body.rationale
                    ) ??
                    finding.rootCause ??
                    finding.objectiveEvidence,
                  createdById:
                    user.id,
                },
              });

            await transaction.enterpriseAuditFinding.update({
              where: {
                id: findingId,
              },
              data: {
                requiresCapa: true,
                capaSuggestedAt:
                  new Date(),
                updatedById:
                  user.id,
              },
            });

            await transaction.enterpriseAuditFindingHistory.create({
              data: {
                findingId,
                userId: user.id,
                action:
                  EnterpriseAuditHistoryAction.CAPA_LINKED,
                title:
                  "Corrective-action recommendation created",
                description:
                  title,
                newValue: {
                  linkId: link.id,
                  status:
                    link.status,
                  suggestedOwnerId:
                    ownerId,
                  suggestedDueDate:
                    link.suggestedDueDate?.toISOString() ??
                    null,
                },
              },
            });

            await transaction.enterpriseAuditHistory.create({
              data: {
                organizationId,
                auditId,
                userId: user.id,
                action:
                  EnterpriseAuditHistoryAction.CAPA_LINKED,
                entityType:
                  "EnterpriseAuditFindingActionLink",
                entityId:
                  link.id,
                title:
                  "CAPA recommendation added",
                description:
                  `${finding.reference}: ${title}`,
                newValue: {
                  findingId,
                  status:
                    link.status,
                  suggestedOwnerId:
                    ownerId,
                },
              },
            });

            return link;
          }
        );

      return NextResponse.json(
        {
          success: true,
          message:
            "The corrective-action recommendation was created.",
          recommendationId:
            result.id,
        },
        {
          status: 201,
        }
      );
    }

    if (
      recommendationType ===
      "RISK_REVIEW"
    ) {
      const title =
        optionalText(body.title) ??
        `Risk review for ${finding.reference}`;

      const likelihood =
        optionalText(
          body.likelihood
        ) as RiskLikelihood | null;

      const impact =
        optionalText(
          body.impact
        ) as RiskImpact | null;

      if (
        likelihood &&
        !Object.values(
          RiskLikelihood
        ).includes(likelihood)
      ) {
        throw new Error(
          "The proposed likelihood is invalid."
        );
      }

      if (
        impact &&
        !Object.values(
          RiskImpact
        ).includes(impact)
      ) {
        throw new Error(
          "The proposed impact is invalid."
        );
      }

      const existingProposal =
        finding.riskLinks.find(
          (link) =>
            link.status ===
              EnterpriseAuditLinkStatus.PROPOSED ||
            link.status ===
              EnterpriseAuditLinkStatus.APPROVED
        );

      if (existingProposal) {
        throw new Error(
          "An active risk-review recommendation already exists for this finding."
        );
      }

      const result =
        await prisma.$transaction(
          async (transaction) => {
            const link =
              await transaction.enterpriseAuditFindingRiskLink.create({
                data: {
                  findingId,
                  status:
                    EnterpriseAuditLinkStatus.PROPOSED,
                  proposedRiskTitle:
                    title,
                  proposedRiskDescription:
                    optionalText(
                      body.description
                    ) ??
                    finding.description,
                  proposedHazard:
                    optionalText(
                      body.hazard
                    ) ??
                    finding.rootCause,
                  proposedConsequence:
                    optionalText(
                      body.consequence
                    ),
                  proposedLikelihood:
                    likelihood,
                  proposedImpact:
                    impact,
                  rationale:
                    optionalText(
                      body.rationale
                    ) ??
                    finding.objectiveEvidence,
                  createdById:
                    user.id,
                },
              });

            await transaction.enterpriseAuditFinding.update({
              where: {
                id: findingId,
              },
              data: {
                requiresRiskReview:
                  true,
                riskSuggestedAt:
                  new Date(),
                updatedById:
                  user.id,
              },
            });

            await transaction.enterpriseAuditFindingHistory.create({
              data: {
                findingId,
                userId: user.id,
                action:
                  EnterpriseAuditHistoryAction.RISK_LINKED,
                title:
                  "Risk-review recommendation created",
                description:
                  title,
                newValue: {
                  linkId: link.id,
                  status:
                    link.status,
                  proposedLikelihood:
                    likelihood,
                  proposedImpact:
                    impact,
                },
              },
            });

            await transaction.enterpriseAuditHistory.create({
              data: {
                organizationId,
                auditId,
                userId: user.id,
                action:
                  EnterpriseAuditHistoryAction.RISK_LINKED,
                entityType:
                  "EnterpriseAuditFindingRiskLink",
                entityId:
                  link.id,
                title:
                  "Risk-review recommendation added",
                description:
                  `${finding.reference}: ${title}`,
                newValue: {
                  findingId,
                  status:
                    link.status,
                  proposedLikelihood:
                    likelihood,
                  proposedImpact:
                    impact,
                },
              },
            });

            return link;
          }
        );

      return NextResponse.json(
        {
          success: true,
          message:
            "The risk-review recommendation was created.",
          recommendationId:
            result.id,
        },
        {
          status: 201,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Select a valid recommendation type.",
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The recommendation could not be created.",
      },
      {
        status: 400,
      }
    );
  }
}
