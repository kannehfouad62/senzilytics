import {
  ActivityAction,
  NotificationType,
  ResearchClientStatus,
  ResearchDataClassification,
  ResearchMethodology,
  ResearchMilestoneStatus,
  ResearchProjectStatus,
  ResearchTeamRole,
} from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { assertResearchProjectTransition, normalizeResearchReference, researchProjectReadiness } from "@/modules/research/research-governance";

export async function listResearchPortfolio(organizationId: string) {
  const now = new Date();
  const [projects, clients] = await Promise.all([
    prisma.researchProject.findMany({
      where: { organizationId },
      include: {
        client: { select: { id: true, name: true } },
        projectManager: { select: { id: true, name: true } },
        principalInvestigator: { select: { id: true, name: true } },
        _count: { select: { teamMembers: true, milestones: true } },
        milestones: { where: { status: { notIn: [ResearchMilestoneStatus.COMPLETED, ResearchMilestoneStatus.CANCELLED] } }, select: { id: true, dueDate: true, status: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.researchClient.count({ where: { organizationId, status: ResearchClientStatus.ACTIVE } }),
  ]);
  const activeStatuses = new Set<ResearchProjectStatus>([ResearchProjectStatus.ACTIVE, ResearchProjectStatus.DATA_COLLECTION, ResearchProjectStatus.ANALYSIS, ResearchProjectStatus.CLIENT_REVIEW]);
  const terminalStatuses: ResearchProjectStatus[] = [ResearchProjectStatus.COMPLETED, ResearchProjectStatus.CANCELLED, ResearchProjectStatus.ARCHIVED];
  return {
    projects,
    summary: {
      total: projects.length,
      active: projects.filter((project) => activeStatuses.has(project.status)).length,
      awaitingApproval: projects.filter((project) => project.status === ResearchProjectStatus.IN_REVIEW).length,
      commissioned: projects.filter((project) => project.clientId).length,
      overdue: projects.filter((project) => project.dueDate && project.dueDate < now && !terminalStatuses.includes(project.status)).length,
      blockedMilestones: projects.reduce((count, project) => count + project.milestones.filter((milestone) => milestone.status === ResearchMilestoneStatus.BLOCKED).length, 0),
      clients,
    },
  };
}

export function listResearchClients(organizationId: string) {
  return prisma.researchClient.findMany({
    where: { organizationId },
    include: { createdBy: { select: { id: true, name: true } }, _count: { select: { projects: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export function getResearchProject(organizationId: string, projectId: string) {
  return prisma.researchProject.findFirst({
    where: { id: projectId, organizationId },
    include: {
      client: true,
      projectManager: { select: { id: true, name: true, email: true, jobTitle: true } },
      principalInvestigator: { select: { id: true, name: true, email: true, jobTitle: true } },
      approvedBy: { select: { id: true, name: true } },
      teamMembers: { include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } }, orderBy: [{ isLead: "desc" }, { role: "asc" }] },
      milestones: { include: { owner: { select: { id: true, name: true } }, completedBy: { select: { id: true, name: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
    },
  });
}

export async function createResearchClientService(input: {
  organizationId: string; userId: string; name: string; legalName?: string | null; code?: string | null; industry?: string | null; country?: string | null; website?: string | null; primaryContactName?: string | null; primaryContactEmail?: string | null; dataOwnerName?: string | null; dataOwnerEmail?: string | null; dataClassification: ResearchDataClassification; retentionDays?: number | null; contractualNotes?: string | null;
}) {
  if (input.retentionDays != null && (input.retentionDays < 1 || input.retentionDays > 36500)) throw new Error("Retention must be between 1 and 36,500 days.");
  const { userId, ...data } = input;
  const client = await prisma.researchClient.create({ data: { ...data, createdById: userId, code: input.code?.toUpperCase() || null } });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "ResearchClient", entityId: client.id, title: "Research client created", description: client.name, metadata: { dataClassification: client.dataClassification } });
  return client;
}

export async function createResearchProjectService(input: {
  organizationId: string; userId: string; reference: string; title: string; purpose: string; objectives: string; researchQuestions: string; hypotheses?: string | null; methodology: ResearchMethodology; targetPopulation?: string | null; geographicScope?: string | null; samplingStrategy?: string | null; sampleTarget?: number | null; clientId?: string | null; projectManagerId: string; principalInvestigatorId?: string | null; dataClassification: ResearchDataClassification; intendedUse?: string | null; dataOwnershipStatement?: string | null; confidentialityTerms?: string | null; retentionDays?: number | null; ethicsApprovalRequired: boolean; ethicsApprovalReference?: string | null; consentRequired: boolean; startDate?: Date | null; dueDate?: Date | null;
}) {
  if (input.startDate && input.dueDate && input.dueDate < input.startDate) throw new Error("The project due date cannot be before its start date.");
  if (input.sampleTarget != null && (!Number.isInteger(input.sampleTarget) || input.sampleTarget < 1)) throw new Error("Sample target must be a positive whole number.");
  if (input.retentionDays != null && (input.retentionDays < 1 || input.retentionDays > 36500)) throw new Error("Retention must be between 1 and 36,500 days.");
  const [client, manager, investigator] = await Promise.all([
    input.clientId ? prisma.researchClient.findFirst({ where: { id: input.clientId, organizationId: input.organizationId, status: ResearchClientStatus.ACTIVE } }) : null,
    prisma.user.findFirst({ where: { id: input.projectManagerId, organizationId: input.organizationId, isActive: true } }),
    input.principalInvestigatorId ? prisma.user.findFirst({ where: { id: input.principalInvestigatorId, organizationId: input.organizationId, isActive: true } }) : null,
  ]);
  if (input.clientId && !client) throw new Error("The selected research client is invalid or inactive.");
  if (!manager) throw new Error("The selected project manager is invalid.");
  if (input.principalInvestigatorId && !investigator) throw new Error("The selected principal investigator is invalid.");
  if (input.clientId && !input.dataOwnershipStatement?.trim()) throw new Error("Commissioned research requires a data ownership statement.");
  const reference = normalizeResearchReference(input.reference);
  const { userId, ...projectData } = input;
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.researchProject.create({ data: { ...projectData, createdById: userId, reference, status: ResearchProjectStatus.DRAFT, teamMembers: { create: [{ userId: input.projectManagerId, role: ResearchTeamRole.PROJECT_MANAGER, isLead: true }, ...(input.principalInvestigatorId && input.principalInvestigatorId !== input.projectManagerId ? [{ userId: input.principalInvestigatorId, role: ResearchTeamRole.PRINCIPAL_INVESTIGATOR, isLead: true }] : [])] } } });
    await tx.researchMilestone.createMany({ data: [
      { organizationId: input.organizationId, projectId: created.id, title: "Protocol and methodology approved", ownerId: input.projectManagerId, dueDate: input.startDate },
      { organizationId: input.organizationId, projectId: created.id, title: "Questionnaire and data-management plan approved", ownerId: input.projectManagerId, dueDate: input.startDate },
      { organizationId: input.organizationId, projectId: created.id, title: "Analysis and client deliverables approved", ownerId: input.projectManagerId, dueDate: input.dueDate },
    ] });
    return created;
  });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "ResearchProject", entityId: project.id, title: "Research project created", description: `${reference} — ${input.title}`, metadata: { clientId: input.clientId ?? null, methodology: input.methodology, dataClassification: input.dataClassification } });
  if (input.projectManagerId !== input.userId) await createNotification({ organizationId: input.organizationId, userId: input.projectManagerId, type: NotificationType.ASSIGNMENT, title: "Research project assigned", message: `You are the project manager for ${reference} — ${input.title}.`, link: `/research/projects/${project.id}` });
  return project;
}

export async function assignResearchTeamMemberService(input: { organizationId: string; actorId: string; projectId: string; userId: string; role: ResearchTeamRole; isLead: boolean }) {
  const [project, user] = await Promise.all([
    prisma.researchProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId, status: { notIn: [ResearchProjectStatus.ARCHIVED, ResearchProjectStatus.CANCELLED] } } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!project) throw new Error("Editable research project not found.");
  if (!user) throw new Error("The selected team member is invalid.");
  const member = await prisma.researchTeamMember.upsert({ where: { projectId_userId: { projectId: project.id, userId: user.id } }, update: { role: input.role, isLead: input.isLead }, create: { projectId: project.id, userId: user.id, role: input.role, isLead: input.isLead } });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.ASSIGN, entityType: "ResearchProject", entityId: project.id, title: "Research team assignment updated", description: `${user.name} — ${input.role}` });
  if (input.userId !== input.actorId) await createNotification({ organizationId: input.organizationId, userId: input.userId, type: NotificationType.ASSIGNMENT, title: "Research team assignment", message: `You were assigned as ${input.role.toLowerCase().replaceAll("_", " ")} on ${project.reference} — ${project.title}.`, link: `/research/projects/${project.id}` });
  return member;
}

export async function addResearchMilestoneService(input: { organizationId: string; actorId: string; projectId: string; title: string; description?: string | null; dueDate?: Date | null; ownerId?: string | null }) {
  const [project, owner] = await Promise.all([
    prisma.researchProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId, status: { notIn: [ResearchProjectStatus.ARCHIVED, ResearchProjectStatus.CANCELLED] } } }),
    input.ownerId ? prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId, isActive: true } }) : null,
  ]);
  if (!project) throw new Error("Editable research project not found.");
  if (input.ownerId && !owner) throw new Error("The selected milestone owner is invalid.");
  const milestone = await prisma.researchMilestone.create({ data: { organizationId: input.organizationId, projectId: input.projectId, title: input.title, description: input.description, dueDate: input.dueDate, ownerId: input.ownerId } });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.CREATE, entityType: "ResearchMilestone", entityId: milestone.id, title: "Research milestone created", description: input.title, metadata: { projectId: input.projectId, dueDate: input.dueDate?.toISOString() ?? null } });
  if (input.ownerId && input.ownerId !== input.actorId) await createNotification({ organizationId: input.organizationId, userId: input.ownerId, type: NotificationType.ASSIGNMENT, title: "Research milestone assigned", message: `${input.title} was assigned for ${project.reference}.`, link: `/research/projects/${project.id}` });
  return milestone;
}

export async function changeResearchProjectStatusService(input: { organizationId: string; actorId: string; projectId: string; status: ResearchProjectStatus; canApprove: boolean }) {
  const project = await prisma.researchProject.findFirst({ where: { id: input.projectId, organizationId: input.organizationId }, include: { _count: { select: { teamMembers: true, milestones: true } } } });
  if (!project) throw new Error("Research project not found.");
  assertResearchProjectTransition(project.status, input.status);
  if (input.status === ResearchProjectStatus.APPROVED && !input.canApprove) throw new Error("Research-output approval permission is required.");
  const readinessRequiredStatuses: ResearchProjectStatus[] = [ResearchProjectStatus.IN_REVIEW, ResearchProjectStatus.APPROVED, ResearchProjectStatus.ACTIVE];
  if (readinessRequiredStatuses.includes(input.status)) {
    const readiness = researchProjectReadiness({ ...project, clientRequired: Boolean(project.clientId), teamCount: project._count.teamMembers, milestoneCount: project._count.milestones });
    if (readiness.blockers.length) throw new Error(`Research governance is incomplete: ${readiness.blockers.join(", ")}.`);
  }
  const now = new Date();
  const updated = await prisma.researchProject.update({ where: { id: project.id }, data: { status: input.status, ...(input.status === ResearchProjectStatus.APPROVED ? { approvedById: input.actorId, approvedAt: now } : {}), ...(input.status === ResearchProjectStatus.ACTIVE ? { activatedAt: now } : {}), ...(input.status === ResearchProjectStatus.COMPLETED ? { completedAt: now } : {}), ...(input.status === ResearchProjectStatus.ARCHIVED ? { archivedAt: now } : {}) } });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.STATUS_CHANGE, entityType: "ResearchProject", entityId: project.id, title: "Research project status changed", description: `${project.reference}: ${project.status} → ${input.status}` });
  return updated;
}
