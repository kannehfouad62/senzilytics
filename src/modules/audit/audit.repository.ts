import { prisma } from "@/lib/prisma";
import {
  RiskLevel,
  Status,
} from "@prisma/client";

export async function findTenantAuditById(
  auditId: string,
  organizationId: string
) {
  return prisma.audit.findFirst({
    where: {
      id: auditId,
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      findings: {
        orderBy: [
          {
            riskLevel: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
      },
    },
  });
}

export async function findTenantAudits(
  organizationId: string
) {
  return prisma.audit.findMany({
    where: {
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      findings: {
        select: {
          id: true,
          riskLevel: true,
          status: true,
        },
      },
    },
    orderBy: [
      {
        scheduledAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function createTenantAudit(input: {
  title: string;
  scope?: string | null;
  siteId: string;
  scheduledAt?: Date | null;
}) {
  return prisma.audit.create({
    data: {
      title: input.title,
      scope: input.scope,
      siteId: input.siteId,
      scheduledAt: input.scheduledAt,
      status: Status.OPEN,
    },
  });
}

export async function updateTenantAuditStatus(input: {
  auditId: string;
  status: Status;
  completedAt?: Date | null;
}) {
  return prisma.audit.update({
    where: {
      id: input.auditId,
    },
    data: {
      status: input.status,
      completedAt: input.completedAt,
    },
  });
}

export async function createTenantAuditFinding(input: {
  auditId: string;
  title: string;
  description?: string | null;
  riskLevel: RiskLevel;
}) {
  return prisma.auditFinding.create({
    data: {
      auditId: input.auditId,
      title: input.title,
      description: input.description,
      riskLevel: input.riskLevel,
      status: Status.OPEN,
    },
  });
}

export async function findTenantAuditFinding(input: {
  findingId: string;
  auditId: string;
  organizationId: string;
}) {
  return prisma.auditFinding.findFirst({
    where: {
      id: input.findingId,
      audit: {
        id: input.auditId,
        site: {
          organizationId:
            input.organizationId,
        },
      },
    },
  });
}

export async function updateTenantAuditFindingStatus(input: {
  findingId: string;
  status: Status;
}) {
  return prisma.auditFinding.update({
    where: {
      id: input.findingId,
    },
    data: {
      status: input.status,
    },
  });
}