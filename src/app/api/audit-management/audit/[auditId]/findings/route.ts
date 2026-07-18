import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  createTenantEnterpriseAuditFinding,
  findTenantAuditForFindingManagement,
  getNextEnterpriseAuditFindingSequence,
  listTenantEnterpriseAuditFindings,
} from "@/modules/audit-v2/audit-findings.repository";
import {
  EnterpriseAuditFindingCategory,
  EnterpriseAuditFindingStatus,
  EnterpriseAuditFindingType,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditSeverity,
  PermissionKey,
} from "@prisma/client";
import { NextResponse } from "next/server";

function normalizeOptionalText(
  value: unknown
) {
  const normalized =
    String(value ?? "").trim();

  return normalized || null;
}

function parseOptionalDate(
  value: unknown
) {
  const normalized =
    normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "The finding due date is invalid."
    );
  }

  return date;
}

function parseEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string,
  fallback: T
) {
  const normalized =
    String(value ?? "").trim() as T;

  if (!normalized) {
    return fallback;
  }

  if (!allowedValues.includes(normalized)) {
    throw new Error(
      `${fieldName} is invalid.`
    );
  }

  return normalized;
}

function serializeFinding(
  finding: Awaited<
    ReturnType<
      typeof listTenantEnterpriseAuditFindings
    >
  >[number]
) {
  return {
    ...finding,
    dueDate:
      finding.dueDate?.toISOString() ??
      null,
    capaSuggestedAt:
      finding.capaSuggestedAt?.toISOString() ??
      null,
    riskSuggestedAt:
      finding.riskSuggestedAt?.toISOString() ??
      null,
    submittedAt:
      finding.submittedAt?.toISOString() ??
      null,
    acceptedAt:
      finding.acceptedAt?.toISOString() ??
      null,
    completedAt:
      finding.completedAt?.toISOString() ??
      null,
    verifiedAt:
      finding.verifiedAt?.toISOString() ??
      null,
    closedAt:
      finding.closedAt?.toISOString() ??
      null,
    reopenedAt:
      finding.reopenedAt?.toISOString() ??
      null,
    createdAt:
      finding.createdAt.toISOString(),
    updatedAt:
      finding.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      auditId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const { auditId } =
    await context.params;

  const audit =
    await findTenantAuditForFindingManagement({
      organizationId,
      auditId,
    });

  if (!audit) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The enterprise audit was not found.",
      },
      {
        status: 404,
      }
    );
  }

  const findings =
    await listTenantEnterpriseAuditFindings({
      organizationId,
      auditId,
    });

  const users =
    await prisma.user.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
      },
    });

  return NextResponse.json({
    success: true,
    findings: findings.map(
      serializeFinding
    ),
    users,
  });
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { auditId } =
    await context.params;

  const audit =
    await findTenantAuditForFindingManagement({
      organizationId,
      auditId,
    });

  if (!audit) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The enterprise audit was not found.",
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

  const title =
    normalizeOptionalText(body.title);

  if (!title) {
    return NextResponse.json(
      {
        success: false,
        message:
          "A finding title is required.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const findingType =
      parseEnumValue(
        body.findingType,
        Object.values(
          EnterpriseAuditFindingType
        ),
        "Finding type",
        EnterpriseAuditFindingType.NONCONFORMITY
      );

    const category =
      parseEnumValue(
        body.category,
        Object.values(
          EnterpriseAuditFindingCategory
        ),
        "Finding category",
        EnterpriseAuditFindingCategory.OTHER
      );

    const severity =
      parseEnumValue(
        body.severity,
        Object.values(
          EnterpriseAuditSeverity
        ),
        "Finding severity",
        EnterpriseAuditSeverity.MEDIUM
      );

    const ownerId =
      normalizeOptionalText(
        body.ownerId
      );

    if (ownerId) {
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
          "The selected finding owner was not found in this organization."
        );
      }
    }

    const sequence =
      await getNextEnterpriseAuditFindingSequence({
        organizationId,
        auditId,
      });

    const reference =
      `${audit.reference}-F${String(
        sequence
      ).padStart(3, "0")}`;

    const now = new Date();

    const finding =
      await prisma.$transaction(
        async (transaction) => {
          const created =
            await createTenantEnterpriseAuditFinding(
              {
                organizationId,
                auditId,
                reference,
                title,
                findingType,
                category,
                severity,
                status:
                  EnterpriseAuditFindingStatus.OPEN,
                description:
                  normalizeOptionalText(
                    body.description
                  ),
                objectiveEvidence:
                  normalizeOptionalText(
                    body.objectiveEvidence
                  ),
                standardClause:
                  normalizeOptionalText(
                    body.standardClause
                  ),
                regulatoryRef:
                  normalizeOptionalText(
                    body.regulatoryRef
                  ),
                ownerId,
                dueDate:
                  parseOptionalDate(
                    body.dueDate
                  ),
                requiresCapa:
                  body.requiresCapa ===
                  true,
                requiresRiskReview:
                  body.requiresRiskReview ===
                  true,
                capaSuggestedAt:
                  body.requiresCapa ===
                  true
                    ? now
                    : null,
                riskSuggestedAt:
                  body.requiresRiskReview ===
                  true
                    ? now
                    : null,
                createdById: user.id,
                updatedById: user.id,
              },
              transaction
            );

          await transaction.enterpriseAuditFindingHistory.create({
            data: {
              findingId: created.id,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.FINDING_CREATED,
              title:
                "Audit finding created",
              description:
                `${created.reference}: ${created.title}`,
              newValue: {
                status:
                  created.status,
                severity:
                  created.severity,
                ownerId:
                  created.ownerId,
                dueDate:
                  created.dueDate?.toISOString() ??
                  null,
                requiresCapa:
                  created.requiresCapa,
                requiresRiskReview:
                  created.requiresRiskReview,
              },
            },
          });

          await transaction.enterpriseAuditHistory.create({
            data: {
              organizationId,
              auditId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.FINDING_CREATED,
              entityType:
                "EnterpriseAuditFinding",
              entityId: created.id,
              title:
                "Enterprise audit finding created",
              description:
                `${created.reference}: ${created.title}`,
              newValue: {
                status:
                  created.status,
                severity:
                  created.severity,
                findingType:
                  created.findingType,
                category:
                  created.category,
                ownerId:
                  created.ownerId,
                dueDate:
                  created.dueDate?.toISOString() ??
                  null,
              },
            },
          });

          return created;
        }
      );

    return NextResponse.json(
      {
        success: true,
        message:
          "The audit finding was created.",
        findingId:
          finding.id,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The audit finding could not be created.",
      },
      {
        status: 400,
      }
    );
  }
}
