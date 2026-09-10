import { ActivityAction, ConfigurableFormVersionStatus, ResearchClientPortalAccessStatus, ResearchDashboardStatus, ResearchReportStatus, ResearchSamplingDesignStatus } from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";

export async function grantResearchClientPortalAccessService(input: { organizationId: string; actorId: string; clientId: string; userId: string; projectIds: string[]; expiresAt?: Date | null }) {
  const projectIds = [...new Set(input.projectIds)];
  if (!projectIds.length) throw new Error("Assign at least one client project.");
  const [client, user, projects] = await Promise.all([
    prisma.researchClient.findFirst({ where: { id: input.clientId, organizationId: input.organizationId } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
    prisma.researchProject.findMany({ where: { id: { in: projectIds }, organizationId: input.organizationId, clientId: input.clientId }, select: { id: true } }),
  ]);
  if (!client) throw new Error("Research client not found.");
  if (!user) throw new Error("The selected portal user is not an active user in this tenant.");
  if (projects.length !== projectIds.length) throw new Error("Every assigned project must belong to the selected client and tenant.");
  if (input.expiresAt && input.expiresAt <= new Date()) throw new Error("Portal access expiry must be in the future.");

  const access = await prisma.$transaction(async (tx) => {
    const record = await tx.researchClientPortalAccess.upsert({
      where: { clientId_userId: { clientId: input.clientId, userId: input.userId } },
      update: { status: ResearchClientPortalAccessStatus.ACTIVE, expiresAt: input.expiresAt ?? null, grantedById: input.actorId },
      create: { organizationId: input.organizationId, clientId: input.clientId, userId: input.userId, status: ResearchClientPortalAccessStatus.ACTIVE, expiresAt: input.expiresAt ?? null, grantedById: input.actorId },
    });
    await tx.researchClientPortalProjectAccess.deleteMany({ where: { accessId: record.id } });
    await tx.researchClientPortalProjectAccess.createMany({ data: projectIds.map((projectId) => ({ accessId: record.id, projectId, grantedById: input.actorId })) });
    return record;
  });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.ASSIGN, entityType: "ResearchClientPortalAccess", entityId: access.id, title: "Research client portal access granted", description: `${client.name} — ${user.name}`, metadata: { clientId: client.id, portalUserId: user.id, projectIds, expiresAt: input.expiresAt?.toISOString() ?? null } });
  return access;
}

export async function changeResearchClientPortalAccessStatusService(input: { organizationId: string; actorId: string; accessId: string; status: ResearchClientPortalAccessStatus }) {
  const existing = await prisma.researchClientPortalAccess.findFirst({ where: { id: input.accessId, organizationId: input.organizationId }, include: { client: { select: { name: true } }, user: { select: { name: true } } } });
  if (!existing) throw new Error("Client portal access not found.");
  const updated = await prisma.researchClientPortalAccess.update({ where: { id: existing.id }, data: { status: input.status } });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.STATUS_CHANGE, entityType: "ResearchClientPortalAccess", entityId: existing.id, title: "Research client portal access status changed", description: `${existing.client.name} — ${existing.user.name}: ${existing.status} → ${input.status}` });
  return updated;
}

export function listResearchClientPortalAccesses(organizationId: string) {
  return prisma.researchClientPortalAccess.findMany({ where: { organizationId }, include: { client: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } }, projects: { include: { project: { select: { id: true, reference: true, title: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } });
}

const activeAccessWhere = (organizationId: string, userId: string) => ({ organizationId, userId, status: ResearchClientPortalAccessStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

export function listClientPortalProjects(organizationId: string, userId: string) {
  return prisma.researchClientPortalProjectAccess.findMany({
    where: { access: activeAccessWhere(organizationId, userId), project: { organizationId } },
    include: {
      access: { include: { client: { select: { name: true, dataOwnerName: true } } } },
      project: { include: { _count: { select: { questionnaires: true, reports: true, visualizationDashboards: true } } } },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });
}

export function getClientPortalProject(organizationId: string, userId: string, projectId: string) {
  return prisma.researchClientPortalProjectAccess.findFirst({
    where: { projectId, access: activeAccessWhere(organizationId, userId), project: { organizationId } },
    include: { access: { include: { client: true } }, project: { include: {
      questionnaires: { where: { isActive: true, formDefinition: { versions: { some: { status: ConfigurableFormVersionStatus.PUBLISHED } } } }, include: { formDefinition: { select: { name: true, versions: { where: { status: ConfigurableFormVersionStatus.PUBLISHED }, select: { version: true, publishedAt: true }, orderBy: { version: "desc" }, take: 1 } } } }, orderBy: { createdAt: "desc" } },
      samplingDesigns: { where: { status: ResearchSamplingDesignStatus.APPROVED }, orderBy: { version: "desc" } },
      visualizationDashboards: { where: { status: ResearchDashboardStatus.APPROVED }, orderBy: { updatedAt: "desc" } },
      reports: { where: { status: { in: [ResearchReportStatus.APPROVED, ResearchReportStatus.PUBLISHED] } }, orderBy: [{ version: "desc" }, { updatedAt: "desc" }] },
    } } },
  });
}
