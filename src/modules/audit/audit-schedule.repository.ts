import { prisma } from "@/lib/prisma";

export function findTenantAuditSchedules(organizationId: string) {
  return prisma.auditSchedule.findMany({
    where: { organizationId },
    include: {
      program: { select: { id: true, name: true, code: true } },
      site: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      leadAuditor: { select: { id: true, name: true, jobTitle: true } },
      protocol: { select: { id: true, name: true, version: true } },
      _count: { select: { teamMembers: true, enterpriseAudits: true } },
    },
    orderBy: [{ nextRunAt: "asc" }, { name: "asc" }],
  });
}

export function findTenantAuditScheduleById(scheduleId: string, organizationId: string) {
  return prisma.auditSchedule.findFirst({
    where: { id: scheduleId, organizationId },
    include: {
      program: { select: { id: true, name: true, code: true, riskPriority: true } },
      site: true,
      department: true,
      leadAuditor: { select: { id: true, name: true, email: true, jobTitle: true } },
      protocol: { select: { id: true, name: true, code: true, version: true } },
      teamMembers: {
        include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
        orderBy: { createdAt: "asc" },
      },
      enterpriseAudits: {
        select: { id: true, reference: true, title: true, status: true, scheduledAt: true, dueDate: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
    },
  });
}

export function findTenantAuditUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    select: { id: true, name: true, email: true, jobTitle: true, role: true },
    orderBy: { name: "asc" },
  });
}
