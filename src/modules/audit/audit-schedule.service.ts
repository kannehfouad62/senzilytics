import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  EnterpriseAuditFrequency,
  EnterpriseAuditProgramStatus,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditScheduleStatus,
  EnterpriseAuditScheduleTeamRole,
  EnterpriseAuditTeamRole,
  NotificationType,
} from "@prisma/client";
import { calculateInitialNextRunAt } from "./audit-schedule-recurrence";

export async function createAuditScheduleService(input: {
  organizationId: string;
  userId: string;
  programId: string;
  name: string;
  description?: string | null;
  frequency: EnterpriseAuditFrequency;
  intervalValue: number;
  timezone: string;
  startDate: Date;
  endDate?: Date | null;
  generateDaysBefore: number;
  dueDaysAfter: number;
  siteId: string;
  departmentId?: string | null;
  leadAuditorId?: string | null;
  protocolId?: string | null;
  autoGenerate: boolean;
  requireTeam: boolean;
  requireLeadAuditor: boolean;
  teamMemberIds: string[];
}) {
  if (input.endDate && input.endDate < input.startDate) throw new Error("The schedule end date cannot be before the start date.");
  const uniqueTeamIds = [...new Set(input.teamMemberIds)];
  const [program, site, department, leadAuditor, protocol, teamUsers] = await Promise.all([
    prisma.auditProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId, status: EnterpriseAuditProgramStatus.ACTIVE, isActive: true } }),
    prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }),
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, site: { organizationId: input.organizationId } } }) : null,
    input.leadAuditorId ? prisma.user.findFirst({ where: { id: input.leadAuditorId, organizationId: input.organizationId } }) : null,
    input.protocolId ? prisma.auditProtocol.findFirst({ where: { id: input.protocolId, organizationId: input.organizationId, status: EnterpriseAuditProtocolStatus.ACTIVE, isActive: true } }) : null,
    prisma.user.findMany({ where: { id: { in: uniqueTeamIds }, organizationId: input.organizationId }, select: { id: true } }),
  ]);
  if (!program) throw new Error("Select an active audit program.");
  if (!site) throw new Error("The selected site is invalid.");
  if (input.departmentId && (!department || department.siteId !== site.id)) throw new Error("The selected department does not belong to the selected site.");
  if (input.leadAuditorId && !leadAuditor) throw new Error("The selected lead auditor is invalid.");
  if (input.protocolId && !protocol) throw new Error("Select an active audit protocol.");
  if (teamUsers.length !== uniqueTeamIds.length) throw new Error("One or more selected team members are invalid.");
  if (input.requireLeadAuditor && !input.leadAuditorId) throw new Error("A lead auditor is required for this schedule.");
  if (input.requireTeam && uniqueTeamIds.length === 0 && !input.leadAuditorId) throw new Error("At least one audit team member is required.");

  const nextRunAt = calculateInitialNextRunAt({ startDate: input.startDate, endDate: input.endDate, frequency: input.frequency, intervalValue: input.intervalValue });
  const memberIds = [...new Set([...(input.leadAuditorId ? [input.leadAuditorId] : []), ...uniqueTeamIds])];
  const schedule = await prisma.auditSchedule.create({
    data: {
      organizationId: input.organizationId,
      programId: input.programId,
      name: input.name,
      description: input.description,
      status: nextRunAt ? EnterpriseAuditScheduleStatus.ACTIVE : EnterpriseAuditScheduleStatus.EXPIRED,
      frequency: input.frequency,
      intervalValue: input.intervalValue,
      recurrenceRule: { unit: input.frequency, interval: input.intervalValue },
      timezone: input.timezone,
      startDate: input.startDate,
      endDate: input.endDate,
      nextRunAt,
      generateDaysBefore: input.generateDaysBefore,
      dueDaysAfter: input.dueDaysAfter,
      siteId: input.siteId,
      departmentId: input.departmentId,
      leadAuditorId: input.leadAuditorId,
      protocolId: input.protocolId,
      autoGenerate: input.autoGenerate,
      requireTeam: input.requireTeam,
      requireLeadAuditor: input.requireLeadAuditor,
      createdById: input.userId,
      updatedById: input.userId,
      teamMembers: {
        create: memberIds.map((userId) => ({
          userId,
          role: userId === input.leadAuditorId ? EnterpriseAuditScheduleTeamRole.LEAD_AUDITOR : EnterpriseAuditScheduleTeamRole.AUDITOR,
        })),
      },
    },
  });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "AuditSchedule", entityId: schedule.id, title: "Audit schedule created", description: input.name, metadata: { frequency: input.frequency, nextRunAt: nextRunAt?.toISOString() ?? null } });
  await Promise.all(memberIds.filter((id) => id !== input.userId).map((userId) => createNotification({ organizationId: input.organizationId, userId, type: NotificationType.ASSIGNMENT, title: "Audit schedule assignment", message: `You were assigned to the audit schedule “${input.name}”.`, link: `/audits/schedules/${schedule.id}` })));
  return schedule;
}

export async function addAuditScheduleTeamMemberService(input: { organizationId: string; userId: string; scheduleId: string; memberId: string; role: EnterpriseAuditScheduleTeamRole }) {
  const [schedule, member] = await Promise.all([prisma.auditSchedule.findFirst({ where: { id: input.scheduleId, organizationId: input.organizationId } }), prisma.user.findFirst({ where: { id: input.memberId, organizationId: input.organizationId } })]);
  if (!schedule || !member) throw new Error("Schedule or team member not found.");
  const assignment = await prisma.auditScheduleTeamMember.upsert({ where: { scheduleId_userId: { scheduleId: schedule.id, userId: member.id } }, update: { role: input.role }, create: { scheduleId: schedule.id, userId: member.id, role: input.role } });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.ASSIGN, entityType: "AuditSchedule", entityId: schedule.id, title: "Schedule team updated", description: `${member.name} assigned as ${input.role.replaceAll("_", " ")}.` });
  if (member.id !== input.userId) await createNotification({ organizationId: input.organizationId, userId: member.id, type: NotificationType.ASSIGNMENT, title: "Audit schedule assignment", message: `You were assigned to “${schedule.name}”.`, link: `/audits/schedules/${schedule.id}` });
  return assignment;
}

export async function removeAuditScheduleTeamMemberService(input: { organizationId: string; userId: string; scheduleId: string; memberId: string }) {
  const schedule = await prisma.auditSchedule.findFirst({ where: { id: input.scheduleId, organizationId: input.organizationId } });
  if (!schedule) throw new Error("Audit schedule not found.");
  if (schedule.leadAuditorId === input.memberId) throw new Error("Change the lead auditor before removing this team member.");
  await prisma.auditScheduleTeamMember.deleteMany({ where: { scheduleId: schedule.id, userId: input.memberId } });
  await logActivity({ organizationId: input.organizationId, userId: input.userId, action: ActivityAction.UPDATE, entityType: "AuditSchedule", entityId: schedule.id, title: "Schedule team member removed", description: input.memberId });
}

export async function addAuditTeamMemberService(input: { organizationId: string; userId: string; auditId: string; memberId: string; role: EnterpriseAuditTeamRole; canEdit: boolean; canReview: boolean }) {
  const [audit, member] = await Promise.all([prisma.enterpriseAudit.findFirst({ where: { id: input.auditId, organizationId: input.organizationId } }), prisma.user.findFirst({ where: { id: input.memberId, organizationId: input.organizationId } })]);
  if (!audit || !member) throw new Error("Audit or team member not found.");
  const assignment = await prisma.enterpriseAuditTeamMember.upsert({ where: { auditId_userId: { auditId: audit.id, userId: member.id } }, update: { role: input.role, canEdit: input.canEdit, canReview: input.canReview }, create: { auditId: audit.id, userId: member.id, role: input.role, canEdit: input.canEdit, canReview: input.canReview } });
  await prisma.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "ASSIGNED", entityType: "EnterpriseAuditTeamMember", entityId: assignment.id, title: "Audit team updated", description: `${member.name} assigned as ${input.role.replaceAll("_", " ")}.` } });
  if (member.id !== input.userId) await createNotification({ organizationId: input.organizationId, userId: member.id, type: NotificationType.ASSIGNMENT, title: "Audit team assignment", message: `You were assigned to ${audit.reference} — ${audit.title}.`, link: `/audits/${audit.id}` });
  return assignment;
}

export async function removeAuditTeamMemberService(input: { organizationId: string; userId: string; auditId: string; memberId: string }) {
  const audit = await prisma.enterpriseAudit.findFirst({ where: { id: input.auditId, organizationId: input.organizationId } });
  if (!audit) throw new Error("Audit not found.");
  if (audit.leadAuditorId === input.memberId) throw new Error("Change the lead auditor before removing this team member.");
  await prisma.enterpriseAuditTeamMember.deleteMany({ where: { auditId: audit.id, userId: input.memberId } });
  await prisma.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "UPDATED", entityType: "EnterpriseAuditTeamMember", entityId: input.memberId, title: "Audit team member removed" } });
}
