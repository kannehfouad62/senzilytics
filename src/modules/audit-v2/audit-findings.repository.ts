import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditFindingStatus,
  Prisma,
} from "@prisma/client";

export type AuditFindingsDatabaseClient =
  | typeof prisma
  | Prisma.TransactionClient;

export async function findTenantAuditForFindingManagement(
  input: {
    organizationId: string;
    auditId: string;
  },
  database: AuditFindingsDatabaseClient = prisma
) {
  return database.enterpriseAudit.findFirst({
    where: {
      id: input.auditId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      leadAuditorId: true,
      ownerId: true,
    },
  });
}

export async function listTenantEnterpriseAuditFindings(
  input: {
    organizationId: string;
    auditId: string;
  },
  database: AuditFindingsDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.findMany({
    where: {
      organizationId: input.organizationId,
      auditId: input.auditId,
    },
    orderBy: [
      {
        severity: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      reference: true,
      title: true,
      findingType: true,
      category: true,
      severity: true,
      status: true,
      description: true,
      objectiveEvidence: true,
      standardClause: true,
      regulatoryRef: true,
      immediateCorrection: true,
      containmentAction: true,
      rootCause: true,
      rootCauseCategory: true,
      ownerId: true,
      dueDate: true,
      isRepeatFinding: true,
      previousFindingReference: true,
      recurrenceCount: true,
      requiresCapa: true,
      requiresRiskReview: true,
      capaSuggestedAt: true,
      riskSuggestedAt: true,
      submittedAt: true,
      acceptedAt: true,
      completedAt: true,
      verifiedAt: true,
      closedAt: true,
      reopenedAt: true,
      closureSummary: true,
      createdAt: true,
      updatedAt: true,
      question: {
        select: {
          id: true,
          questionText: true,
          section: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      response: {
        select: {
          id: true,
          result: true,
          comments: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
        },
      },
      _count: {
        select: {
          evidence: true,
          evidenceLinks: true,
          verifications: true,
          correctiveActionLinks: true,
          riskLinks: true,
          history: true,
        },
      },
    },
  });
}

export async function findTenantEnterpriseAuditFinding(
  input: {
    organizationId: string;
    auditId: string;
    findingId: string;
  },
  database: AuditFindingsDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.findFirst({
    where: {
      id: input.findingId,
      organizationId: input.organizationId,
      auditId: input.auditId,
    },
  });
}

export async function getNextEnterpriseAuditFindingSequence(
  input: {
    organizationId: string;
    auditId: string;
  },
  database: AuditFindingsDatabaseClient = prisma
) {
  const count =
    await database.enterpriseAuditFinding.count({
      where: {
        organizationId: input.organizationId,
        auditId: input.auditId,
      },
    });

  return count + 1;
}

export async function createTenantEnterpriseAuditFinding(
  input: Prisma.EnterpriseAuditFindingUncheckedCreateInput,
  database: AuditFindingsDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.create({
    data: input,
  });
}

export async function updateTenantEnterpriseAuditFinding(
  input: {
    findingId: string;
    data: Prisma.EnterpriseAuditFindingUncheckedUpdateInput;
  },
  database: AuditFindingsDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.update({
    where: {
      id: input.findingId,
    },
    data: input.data,
  });
}

export async function countOpenTenantEnterpriseAuditFindings(
  input: {
    organizationId: string;
    auditId: string;
  },
  database: AuditFindingsDatabaseClient = prisma
) {
  return database.enterpriseAuditFinding.count({
    where: {
      organizationId: input.organizationId,
      auditId: input.auditId,
      status: {
        notIn: [
          EnterpriseAuditFindingStatus.CLOSED,
          EnterpriseAuditFindingStatus.REJECTED,
          EnterpriseAuditFindingStatus.CANCELLED,
        ],
      },
    },
  });
}
