import { prisma } from "@/lib/prisma";

export function findTenantAuditPrograms(organizationId: string) {
  return prisma.auditProgram.findMany({
    where: { organizationId },
    include: {
      owner: { select: { id: true, name: true, jobTitle: true } },
      defaultProtocol: { select: { id: true, name: true, version: true } },
      sites: { include: { site: { select: { id: true, name: true } } } },
      _count: { select: { schedules: true, enterpriseAudits: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export function findTenantAuditProgramById(programId: string, organizationId: string) {
  return prisma.auditProgram.findFirst({
    where: { id: programId, organizationId },
    include: {
      owner: { select: { id: true, name: true, email: true, jobTitle: true } },
      defaultProtocol: { select: { id: true, name: true, code: true, version: true, status: true } },
      sites: { include: { site: true }, orderBy: { createdAt: "asc" } },
      departments: { include: { department: { include: { site: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "asc" } },
      schedules: { select: { id: true, name: true, status: true, frequency: true, nextRunAt: true }, orderBy: { name: "asc" } },
      enterpriseAudits: { select: { id: true, reference: true, title: true, status: true, dueDate: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

export function findTenantAuditProtocols(organizationId: string) {
  return prisma.auditProtocol.findMany({
    where: { organizationId },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { sections: true, enterpriseAudits: true, schedules: true } },
      sections: { select: { _count: { select: { questions: true } } } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { version: "desc" }],
  });
}

export function findTenantAuditProtocolById(protocolId: string, organizationId: string) {
  return prisma.auditProtocol.findFirst({
    where: { id: protocolId, organizationId },
    include: {
      previousVersion: { select: { id: true, version: true } },
      newerVersions: { select: { id: true, version: true, status: true }, orderBy: { version: "desc" } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      sections: {
        include: { questions: { include: { options: { orderBy: { sequence: "asc" } } }, orderBy: { sequence: "asc" } } },
        orderBy: { sequence: "asc" },
      },
      _count: { select: { enterpriseAudits: true, schedules: true, defaultForPrograms: true } },
    },
  });
}
