import {
  JsaStatus,
  PermissionKey,
  RiskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function mobileRiskCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canView: granted.has(PermissionKey.VIEW_RISKS),
    canManage: granted.has(PermissionKey.MANAGE_RISKS),
  };
}

export async function getMobileRiskField(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
}) {
  const capabilities = mobileRiskCapabilities(input.permissions);
  if (!capabilities.canView) {
    return {
      departments: [],
      risks: [],
      jsas: [],
      capabilities,
    };
  }

  const [departments, risks, jsas] = await Promise.all([
    prisma.department.findMany({
      where: {
        site: {
          organizationId: input.organizationId,
        },
      },
      select: {
        id: true,
        name: true,
        siteId: true,
      },
      orderBy: [
        { site: { name: "asc" } },
        { name: "asc" },
      ],
    }),
    prisma.risk.findMany({
      where: {
        organizationId: input.organizationId,
        status: {
          not: RiskStatus.ARCHIVED,
        },
      },
      select: {
        id: true,
        reference: true,
        title: true,
        description: true,
        category: true,
        hazardType: true,
        process: true,
        status: true,
        currentLikelihood: true,
        currentImpact: true,
        currentScore: true,
        currentRiskLevel: true,
        residualLikelihood: true,
        residualImpact: true,
        residualScore: true,
        residualRiskLevel: true,
        reviewFrequency: true,
        lastReviewedAt: true,
        nextReviewDate: true,
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        controls: {
          select: {
            id: true,
            name: true,
            description: true,
            controlType: true,
            hierarchy: true,
            effectiveness: true,
            status: true,
            dueDate: true,
          },
          orderBy: [
            { status: "asc" },
            { dueDate: { sort: "asc", nulls: "last" } },
          ],
          take: 25,
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
      orderBy: [
        { currentScore: "desc" },
        { nextReviewDate: { sort: "asc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: 75,
    }),
    prisma.jobSafetyAnalysis.findMany({
      where: {
        organizationId: input.organizationId,
        status: {
          not: JsaStatus.ARCHIVED,
        },
      },
      select: {
        id: true,
        reference: true,
        version: true,
        title: true,
        jobDescription: true,
        workLocation: true,
        requiredCompetency: true,
        requiredPpe: true,
        emergencyRequirements: true,
        status: true,
        effectiveDate: true,
        reviewDueDate: true,
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        acknowledgments: {
          where: {
            userId: input.userId,
          },
          select: {
            acknowledgedAt: true,
            statement: true,
          },
          take: 1,
        },
        steps: {
          select: {
            id: true,
            sequence: true,
            taskStep: true,
            hazards: {
              select: {
                id: true,
                hazard: true,
                potentialConsequence: true,
                initialLikelihood: true,
                initialImpact: true,
                initialScore: true,
                residualLikelihood: true,
                residualImpact: true,
                residualScore: true,
                controls: {
                  select: {
                    id: true,
                    hierarchy: true,
                    description: true,
                    responsibleRole: true,
                    verificationRequired: true,
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            sequence: "asc",
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { reviewDueDate: { sort: "asc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: 50,
    }),
  ]);

  return {
    departments,
    risks: risks.map(({ _count, ...risk }) => ({
      ...risk,
      reviewCount: _count.reviews,
    })),
    jsas: jsas.map(({ acknowledgments, ...jsa }) => ({
      ...jsa,
      acknowledgment: acknowledgments[0] ?? null,
    })),
    capabilities,
  };
}
