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
      evidence: {
        where: { questionId: null, findingId: null },
        select: { id: true, evidenceType: true, title: true, description: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true, externalUrl: true, capturedAt: true },
        orderBy: { createdAt: "desc" },
      },
      sections: {
        include: {
          questions: {
            include: {
              options: { orderBy: { sequence: "asc" } },
              response: true,
              evidence: {
                select: { id: true, evidenceType: true, title: true, externalUrl: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { sequence: "asc" },
          },
        },
        orderBy: { sequence: "asc" },
      },
      findings: {
        include: {
          owner: { select: { id: true, name: true, email: true, jobTitle: true } },
          question: { select: { id: true, questionText: true, standardClause: true } },
          evidence: { select: { id: true, evidenceType: true, title: true, description: true, externalUrl: true, fileUrl: true, fileName: true, mimeType: true, fileSize: true }, orderBy: { createdAt: "desc" } },
          verifications: { include: { verifiedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
          correctiveActionLinks: { include: { correctiveAction: { include: { assignedTo: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "desc" } },
          riskLinks: { include: { risk: { select: { id: true, reference: true, title: true, status: true, currentRiskLevel: true } } }, orderBy: { createdAt: "desc" } },
          history: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
        },
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
