import { ActivityAction, NotificationType, Prisma, ResearchDataLifecycleStatus, ResearchDatasetAccessStatus, ResearchGovernanceRecordStatus, ResearchPanelMemberStatus } from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { getApplicationUrl, sendTenantNotificationEmail } from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { classifyResearchGovernanceReminder, researchGovernanceCsv } from "@/modules/research/research-governance-monitor";

type ReminderCandidate = { organizationId: string; recipientId: string; recipientEmail: string; targetType: string; targetId: string; label: string; dueAt: Date; link: string };

export async function processResearchGovernanceMonitoring(now = new Date()) {
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const [expiredAccesses, expiredRecords, duePlans] = await Promise.all([
    prisma.researchDatasetAccessRequest.updateMany({ where: { status: ResearchDatasetAccessStatus.APPROVED, accessExpiresAt: { lte: now } }, data: { status: ResearchDatasetAccessStatus.EXPIRED } }),
    prisma.researchGovernanceRecord.updateMany({ where: { status: ResearchGovernanceRecordStatus.APPROVED, expiresAt: { lte: now } }, data: { status: ResearchGovernanceRecordStatus.EXPIRED } }),
    prisma.researchDataLifecyclePlan.updateMany({ where: { status: ResearchDataLifecycleStatus.ACTIVE, scheduledDisposalAt: { lte: now } }, data: { status: ResearchDataLifecycleStatus.DISPOSAL_DUE } }),
  ]);
  const [members, records, plans, accesses] = await Promise.all([
    prisma.researchPanelMember.findMany({ where: { status: ResearchPanelMemberStatus.ACTIVE, consentExpiresAt: { lte: horizon } }, select: { id: true, organizationId: true, name: true, email: true, consentExpiresAt: true, managedBy: { select: { id: true, email: true } }, panel: { select: { name: true } } }, take: 500 }),
    prisma.researchGovernanceRecord.findMany({ where: { status: { in: [ResearchGovernanceRecordStatus.APPROVED, ResearchGovernanceRecordStatus.EXPIRED] }, expiresAt: { lte: horizon } }, select: { id: true, organizationId: true, reference: true, title: true, expiresAt: true, owner: { select: { id: true, email: true } }, project: { select: { id: true, reference: true } } }, take: 500 }),
    prisma.researchDataLifecyclePlan.findMany({ where: { status: { in: [ResearchDataLifecycleStatus.ACTIVE, ResearchDataLifecycleStatus.DISPOSAL_DUE] }, scheduledDisposalAt: { lte: horizon } }, select: { id: true, organizationId: true, scheduledDisposalAt: true, owner: { select: { id: true, email: true } }, project: { select: { id: true, reference: true, title: true } } }, take: 500 }),
    prisma.researchDatasetAccessRequest.findMany({ where: { status: { in: [ResearchDatasetAccessStatus.APPROVED, ResearchDatasetAccessStatus.EXPIRED] }, accessExpiresAt: { lte: horizon } }, select: { id: true, organizationId: true, datasetReference: true, accessExpiresAt: true, requestedBy: { select: { id: true, email: true } }, project: { select: { id: true, reference: true } } }, take: 500 }),
  ]);
  const candidates: ReminderCandidate[] = [
    ...members.filter(member => member.consentExpiresAt).map(member => ({ organizationId: member.organizationId, recipientId: member.managedBy.id, recipientEmail: member.managedBy.email, targetType: "ResearchPanelMember", targetId: member.id, label: `Consent for ${member.name || member.email} in ${member.panel.name}`, dueAt: member.consentExpiresAt!, link: "/research/panels" })),
    ...records.filter(record => record.expiresAt).map(record => ({ organizationId: record.organizationId, recipientId: record.owner.id, recipientEmail: record.owner.email, targetType: "ResearchGovernanceRecord", targetId: record.id, label: `${record.reference} — ${record.title}`, dueAt: record.expiresAt!, link: `/research/projects/${record.project.id}/governance` })),
    ...plans.map(plan => ({ organizationId: plan.organizationId, recipientId: plan.owner.id, recipientEmail: plan.owner.email, targetType: "ResearchDataLifecyclePlan", targetId: plan.id, label: `Data disposal for ${plan.project.reference} — ${plan.project.title}`, dueAt: plan.scheduledDisposalAt, link: `/research/projects/${plan.project.id}/data-governance` })),
    ...accesses.filter(access => access.accessExpiresAt).map(access => ({ organizationId: access.organizationId, recipientId: access.requestedBy.id, recipientEmail: access.requestedBy.email, targetType: "ResearchDatasetAccessRequest", targetId: access.id, label: `Dataset access ${access.datasetReference} for ${access.project.reference}`, dueAt: access.accessExpiresAt!, link: `/research/projects/${access.project.id}/data-governance` })),
  ];
  const existingReminders = candidates.length ? await prisma.researchGovernanceReminder.findMany({ where: { organizationId: { in: [...new Set(candidates.map(candidate => candidate.organizationId))] }, targetId: { in: candidates.map(candidate => candidate.targetId) } }, select: { organizationId: true, recipientId: true, targetType: true, targetId: true, reminderKind: true, dueAt: true, sentAt: true } }) : [];
  const reminderKey = (candidate: ReminderCandidate, kind: string) => `${candidate.organizationId}|${candidate.recipientId}|${candidate.targetType}|${candidate.targetId}|${kind}|${candidate.dueAt.toISOString()}`;
  const sentKeys = new Set(existingReminders.filter(reminder => reminder.sentAt).map(reminder => `${reminder.organizationId}|${reminder.recipientId}|${reminder.targetType}|${reminder.targetId}|${reminder.reminderKind}|${reminder.dueAt.toISOString()}`));
  const pendingCandidates = candidates.map(candidate => ({ candidate, reminderKind: classifyResearchGovernanceReminder(candidate.dueAt, now) })).filter(item => !sentKeys.has(reminderKey(item.candidate, item.reminderKind)));
  let remindersSent = 0, emailsSent = 0;
  for (const { candidate, reminderKind } of pendingCandidates.slice(0, 25)) {
    const claimed = await claimReminder(candidate, reminderKind);
    if (!claimed || claimed.sentAt) continue;
    const overdue = candidate.dueAt <= now;
    await createNotification({ organizationId: candidate.organizationId, userId: candidate.recipientId, type: overdue ? NotificationType.CRITICAL : NotificationType.DUE_DATE, title: overdue ? "Research governance item overdue" : "Research governance item approaching expiry", message: `${candidate.label} — ${formatDate(candidate.dueAt)}`, link: candidate.link });
    const absoluteLink = `${getApplicationUrl()}${candidate.link}`;
    const email = await sendTenantNotificationEmail({ to: candidate.recipientEmail, subject: overdue ? "Research governance action overdue" : "Research governance expiry reminder", text: `${candidate.label} is ${overdue ? "overdue" : "due"} on ${formatDate(candidate.dueAt)}. Review it in Senzilytics: ${absoluteLink}`, html: `<p>${escapeHtml(candidate.label)} is <strong>${overdue ? "overdue" : "due"}</strong> on ${escapeHtml(formatDate(candidate.dueAt))}.</p><p><a href="${escapeHtml(absoluteLink)}">Review this controlled item in Senzilytics</a>.</p>` });
    await prisma.researchGovernanceReminder.update({ where: { id: claimed.id }, data: { sentAt: new Date(), emailSent: email.success } });
    await logActivity({ organizationId: candidate.organizationId, userId: null, action: ActivityAction.SYSTEM, entityType: candidate.targetType, entityId: candidate.targetId, title: "Research governance reminder dispatched", description: `${reminderKind}: ${candidate.label}`, metadata: { dueAt: candidate.dueAt.toISOString(), recipientId: candidate.recipientId, emailSent: email.success } });
    remindersSent++; if (email.success) emailsSent++;
  }
  return { candidates: candidates.length, remindersSent, emailsSent, alreadySent: candidates.length - pendingCandidates.length, deferred: Math.max(0, pendingCandidates.length - 25), expiredAccesses: expiredAccesses.count, expiredGovernanceRecords: expiredRecords.count, disposalPlansDue: duePlans.count };
}

export async function getResearchGovernanceReport(organizationId: string, now = new Date()) {
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const [projects, expiringConsent, expiringRecords, disposalDue, pendingAccess, highRisk, failedEmails, upcomingRecords, upcomingPlans] = await Promise.all([
    prisma.researchProject.count({ where: { organizationId } }),
    prisma.researchPanelMember.count({ where: { organizationId, status: ResearchPanelMemberStatus.ACTIVE, consentExpiresAt: { lte: horizon } } }),
    prisma.researchGovernanceRecord.count({ where: { organizationId, status: { in: [ResearchGovernanceRecordStatus.APPROVED, ResearchGovernanceRecordStatus.EXPIRED] }, expiresAt: { lte: horizon } } }),
    prisma.researchDataLifecyclePlan.count({ where: { organizationId, status: { in: [ResearchDataLifecycleStatus.DISPOSAL_DUE, ResearchDataLifecycleStatus.ACTIVE] }, scheduledDisposalAt: { lte: horizon } } }),
    prisma.researchDatasetAccessRequest.count({ where: { organizationId, status: ResearchDatasetAccessStatus.PENDING } }),
    prisma.researchPrivacyReview.count({ where: { organizationId, residualRisk: { in: ["HIGH", "CRITICAL"] }, status: { not: "REJECTED" } } }),
    prisma.researchGovernanceReminder.count({ where: { organizationId, sentAt: { not: null }, emailSent: false } }),
    prisma.researchGovernanceRecord.findMany({ where: { organizationId, expiresAt: { lte: horizon } }, select: { id: true, reference: true, title: true, status: true, expiresAt: true, project: { select: { id: true, reference: true } } }, orderBy: { expiresAt: "asc" }, take: 20 }),
    prisma.researchDataLifecyclePlan.findMany({ where: { organizationId, scheduledDisposalAt: { lte: horizon }, status: { not: ResearchDataLifecycleStatus.DISPOSED } }, select: { id: true, status: true, scheduledDisposalAt: true, project: { select: { id: true, reference: true, title: true } } }, orderBy: { scheduledDisposalAt: "asc" }, take: 20 }),
  ]);
  return { summary: { projects, expiringConsent, expiringRecords, disposalDue, pendingAccess, highRisk, failedEmails }, upcomingRecords, upcomingPlans };
}

export async function buildResearchConsentEvidenceCsv(organizationId: string, panelId?: string | null) {
  const events = await prisma.researchPanelConsentEvent.findMany({ where: { organizationId, ...(panelId ? { panelMember: { panelId } } : {}) }, include: { panelMember: { include: { panel: { select: { name: true } } } }, recordedBy: { select: { name: true, email: true } } }, orderBy: { effectiveAt: "desc" } });
  const rows: unknown[][] = [["Panel", "Participant", "Participant email", "External reference", "Current status", "Event", "Statement", "Lawful basis", "Effective at", "Expires at", "Recorded by", "Recorder email", "Event ID"], ...events.map(event => [event.panelMember.panel.name, event.panelMember.name, event.panelMember.email, event.panelMember.externalRef, event.panelMember.status, event.type, event.statement, event.lawfulBasis, event.effectiveAt.toISOString(), event.expiresAt?.toISOString(), event.recordedBy.name, event.recordedBy.email, event.id])];
  return researchGovernanceCsv(rows);
}

async function claimReminder(candidate: ReminderCandidate, reminderKind: string) { try { return await prisma.researchGovernanceReminder.create({ data: { organizationId: candidate.organizationId, recipientId: candidate.recipientId, targetType: candidate.targetType, targetId: candidate.targetId, reminderKind, dueAt: candidate.dueAt } }); } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error; return prisma.researchGovernanceReminder.findFirst({ where: { organizationId: candidate.organizationId, recipientId: candidate.recipientId, targetType: candidate.targetType, targetId: candidate.targetId, reminderKind, dueAt: candidate.dueAt } }); } }
function formatDate(value: Date) { return value.toISOString().slice(0, 10); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
