import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditType,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditSource,
  EnterpriseAuditStatus,
  NotificationType,
} from "@prisma/client";
import { createTenantAudit } from "./audit.repository";

type CreateAuditInput = {
  organizationId: string;
  userId: string;
  title: string;
  reference?: string | null;
  description?: string | null;
  objectives?: string | null;
  scope?: string | null;
  criteria?: string | null;
  auditType: AuditType;
  siteId: string;
  departmentId?: string | null;
  programId?: string | null;
  protocolId?: string | null;
  leadAuditorId?: string | null;
  ownerId?: string | null;
  scheduledAt?: Date | null;
  dueDate?: Date | null;
};

function buildAuditReference() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `AUD-${year}-${suffix}`;
}

export async function createAuditService(input: CreateAuditInput) {
  const [site, department, program, protocol, leadAuditor, owner] =
    await Promise.all([
      prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }),
      input.departmentId
        ? prisma.department.findFirst({
            where: { id: input.departmentId, site: { organizationId: input.organizationId } },
          })
        : null,
      input.programId
        ? prisma.auditProgram.findFirst({
            where: { id: input.programId, organizationId: input.organizationId },
          })
        : null,
      input.protocolId
        ? prisma.auditProtocol.findFirst({
            where: { id: input.protocolId, organizationId: input.organizationId, isActive: true },
            include: {
              sections: {
                where: { isActive: true },
                include: {
                  questions: {
                    where: { isActive: true },
                    include: { options: { where: { isActive: true }, orderBy: { sequence: "asc" } } },
                    orderBy: { sequence: "asc" },
                  },
                },
                orderBy: { sequence: "asc" },
              },
            },
          })
        : null,
      input.leadAuditorId
        ? prisma.user.findFirst({ where: { id: input.leadAuditorId, organizationId: input.organizationId } })
        : null,
      input.ownerId
        ? prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId } })
        : null,
    ]);

  if (!site) throw new Error("The selected site is not available to your organization.");
  if (input.departmentId && (!department || department.siteId !== site.id)) {
    throw new Error("The selected department does not belong to the selected site.");
  }
  if (input.programId && !program) throw new Error("The selected audit program is invalid.");
  if (input.protocolId && !protocol) throw new Error("The selected audit protocol is invalid.");
  if (input.leadAuditorId && !leadAuditor) throw new Error("The selected lead auditor is invalid.");
  if (input.ownerId && !owner) throw new Error("The selected audit owner is invalid.");
  if (input.dueDate && input.scheduledAt && input.dueDate < input.scheduledAt) {
    throw new Error("The due date cannot be before the scheduled date.");
  }

  const reference = input.reference || buildAuditReference();
  const totalQuestionCount =
    protocol?.sections.reduce((total, section) => total + section.questions.length, 0) ?? 0;

  const audit = await prisma.$transaction(async (tx) => {
    const created = await createTenantAudit(tx, {
      organizationId: input.organizationId,
      reference,
      title: input.title,
      description: input.description,
      objectives: input.objectives,
      scope: input.scope,
      criteria: input.criteria,
      source: EnterpriseAuditSource.MANUAL,
      status: input.scheduledAt ? EnterpriseAuditStatus.SCHEDULED : EnterpriseAuditStatus.DRAFT,
      auditType: input.auditType,
      programId: input.programId,
      protocolId: input.protocolId,
      siteId: input.siteId,
      departmentId: input.departmentId,
      leadAuditorId: input.leadAuditorId,
      ownerId: input.ownerId,
      scheduledAt: input.scheduledAt,
      dueDate: input.dueDate,
      totalQuestionCount,
      createdById: input.userId,
      updatedById: input.userId,
    });

    if (protocol) {
      for (const section of protocol.sections) {
        const sectionSnapshot = await tx.enterpriseAuditSection.create({
          data: {
            auditId: created.id,
            sourceProtocolSectionId: section.id,
            title: section.title,
            description: section.description,
            guidance: section.guidance,
            standardRef: section.standardRef,
            sequence: section.sequence,
            weight: section.weight,
            isRequired: section.isRequired,
            totalQuestionCount: section.questions.length,
          },
        });

        for (const question of section.questions) {
          await tx.enterpriseAuditQuestion.create({
            data: {
              auditId: created.id,
              sectionId: sectionSnapshot.id,
              sourceProtocolQuestionId: question.id,
              questionText: question.questionText,
              description: question.description,
              guidance: question.guidance,
              standardClause: question.standardClause,
              regulatoryRef: question.regulatoryRef,
              responseType: question.responseType,
              sequence: question.sequence,
              weight: question.weight,
              isRequired: question.isRequired,
              allowNotApplicable: question.allowNotApplicable,
              requireComment: question.requireComment,
              requireEvidence: question.requireEvidence,
              requirePhoto: question.requirePhoto,
              minimumNumericValue: question.minimumNumericValue,
              maximumNumericValue: question.maximumNumericValue,
              minimumPassingScore: question.minimumPassingScore,
              maximumScore: question.maximumScore,
              findingTrigger: question.findingTrigger,
              defaultSeverity: question.defaultSeverity,
              automaticallyCreateFinding: question.automaticallyCreateFinding,
              automaticallySuggestCapa: question.automaticallySuggestCapa,
              automaticallySuggestRisk: question.automaticallySuggestRisk,
              findingTitleTemplate: question.findingTitleTemplate,
              findingDescriptionTemplate: question.findingDescriptionTemplate,
              aiGuidance: question.aiGuidance,
              options: {
                create: question.options.map((option) => ({
                  sourceOptionId: option.id,
                  label: option.label,
                  value: option.value,
                  description: option.description,
                  sequence: option.sequence,
                  scoreValue: option.scoreValue,
                  isPassing: option.isPassing,
                  triggersFinding: option.triggersFinding,
                  findingSeverity: option.findingSeverity,
                })),
              },
            },
          });
        }
      }
    }

    if (input.leadAuditorId) {
      await tx.enterpriseAuditTeamMember.create({
        data: { auditId: created.id, userId: input.leadAuditorId, role: "LEAD_AUDITOR", canReview: true },
      });
    }

    await tx.enterpriseAuditHistory.create({
      data: {
        organizationId: input.organizationId,
        auditId: created.id,
        userId: input.userId,
        action: EnterpriseAuditHistoryAction.CREATED,
        entityType: "EnterpriseAudit",
        entityId: created.id,
        title: "Audit created",
        description: protocol
          ? `Audit created from ${protocol.name} version ${protocol.version}.`
          : "Audit created without a protocol.",
      },
    });

    return created;
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "EnterpriseAudit",
    entityId: audit.id,
    title: "Enterprise audit created",
    description: `${reference} — ${input.title}`,
    metadata: { auditType: input.auditType, siteId: input.siteId, protocolId: input.protocolId ?? null },
  });

  if (input.leadAuditorId && input.leadAuditorId !== input.userId) {
    await createNotification({
      organizationId: input.organizationId,
      userId: input.leadAuditorId,
      type: NotificationType.ASSIGNMENT,
      title: "Audit assigned",
      message: `You were assigned as lead auditor for ${reference} — ${input.title}.`,
      link: `/audits/${audit.id}`,
    });
  }

  return audit;
}
