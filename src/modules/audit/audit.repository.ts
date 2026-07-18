import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export function findTenantAudits(organizationId: string) {
  return prisma.enterpriseAudit.findMany({
    where: { organizationId },
    include: {
      site: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      leadAuditor: { select: { id: true, name: true, jobTitle: true } },
      protocol: { select: { id: true, name: true, version: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });
}

export function findTenantAuditById(
  auditId: string,
  organizationId: string
) {
  return prisma.enterpriseAudit.findFirst({
    where: { id: auditId, organizationId },
    include: {
      site: true,
      department: true,
      program: { select: { id: true, name: true, code: true } },
      protocol: { select: { id: true, name: true, code: true, version: true } },
      leadAuditor: { select: { id: true, name: true, email: true, jobTitle: true } },
      owner: { select: { id: true, name: true, email: true, jobTitle: true } },
      teamMembers: {
        include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
        orderBy: { assignedAt: "asc" },
      },
      sections: {
        include: {
          questions: { select: { id: true, status: true, isRequired: true } },
        },
        orderBy: { sequence: "asc" },
      },
      findings: {
        select: { id: true, title: true, severity: true, status: true, dueDate: true },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      },
      history: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export function createTenantAudit(
  tx: Prisma.TransactionClient,
  data: Prisma.EnterpriseAuditUncheckedCreateInput
) {
  return tx.enterpriseAudit.create({ data });
}
