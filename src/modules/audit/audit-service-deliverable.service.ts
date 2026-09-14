import {
  ActivityAction,
  AuditServiceDeliverableStatus,
  AuditServiceDeliverableType,
  Prisma,
} from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";

const clean = (value: string | null | undefined, maximum = 4000) =>
  value?.trim().slice(0, maximum) || null;

async function engagementFor(organizationId: string, engagementId: string) {
  const engagement = await prisma.auditServiceEngagement.findFirst({
    where: { id: engagementId, organizationId },
    select: { id: true, reference: true, title: true },
  });
  if (!engagement) throw new Error("Audit service engagement not found.");
  return engagement;
}

async function frozenSnapshot(input: {
  organizationId: string;
  engagementId: string;
  sourceAuditId?: string | null;
  summary: string;
  narrative?: string | null;
}) {
  const frozenAt = new Date().toISOString();
  if (!input.sourceAuditId)
    return {
      kind: "AUDIT_SERVICE_DELIVERABLE",
      summary: input.summary,
      narrative: clean(input.narrative, 20000),
      frozenAt,
    } satisfies Prisma.InputJsonObject;
  const audit = await prisma.enterpriseAudit.findFirst({
    where: {
      id: input.sourceAuditId,
      organizationId: input.organizationId,
      engagementId: input.engagementId,
    },
    include: {
      site: { select: { name: true } },
      sections: {
        orderBy: { sequence: "asc" },
        include: {
          questions: {
            orderBy: { sequence: "asc" },
            include: { response: true },
          },
        },
      },
      findings: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!audit) throw new Error("Select an audit linked to this engagement.");
  return {
    kind: "ENTERPRISE_AUDIT_REPORT",
    frozenAt,
    audit: {
      id: audit.id,
      reference: audit.reference,
      title: audit.title,
      status: audit.status,
      site: audit.site.name,
      scorePercentage:
        audit.scorePercentage === null ? null : Number(audit.scorePercentage),
      executiveSummary: audit.executiveSummary,
      overallOpinion: audit.overallOpinion,
      positivePractices: audit.positivePractices,
      majorConcerns: audit.majorConcerns,
      recommendations: audit.recommendations,
      sections: audit.sections.map((section) => ({
        title: section.title,
        questions: section.questions.map((question) => ({
          text: question.questionText,
          result: question.response?.result ?? "NOT_ASSESSED",
          response: question.response?.responseText ?? null,
          comments: question.response?.comments ?? null,
        })),
      })),
      findings: audit.findings.map((finding) => ({
        reference: finding.reference,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        description: finding.description,
        objectiveEvidence: finding.objectiveEvidence,
      })),
    },
  } satisfies Prisma.InputJsonObject;
}

export async function createAuditServiceDeliverable(input: {
  organizationId: string;
  actorId: string;
  engagementId: string;
  sourceAuditId?: string | null;
  reference?: string | null;
  type: AuditServiceDeliverableType;
  title: string;
  summary: string;
  narrative?: string | null;
}) {
  const engagement = await engagementFor(
    input.organizationId,
    input.engagementId,
  );
  const title = clean(input.title, 200);
  const summary = clean(input.summary, 4000);
  if (!title || !summary)
    throw new Error("Deliverable title and summary are required.");
  const reference =
    clean(input.reference, 80)?.toUpperCase() ??
    `${engagement.reference}-DEL-${Date.now().toString(36).toUpperCase()}`;
  const contentSnapshot = await frozenSnapshot({ ...input, summary });
  const deliverable = await prisma.auditServiceDeliverable.create({
    data: {
      organizationId: input.organizationId,
      engagementId: engagement.id,
      sourceAuditId: clean(input.sourceAuditId, 100),
      reference,
      type: input.type,
      title,
      summary,
      contentSnapshot,
      createdById: input.actorId,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceDeliverable",
    entityId: deliverable.id,
    title: "Audit deliverable created",
    description: `${reference} v1 — ${title}`,
    metadata: { engagementId: engagement.id, type: input.type },
  });
  return deliverable;
}

export async function reviseAuditServiceDeliverable(input: {
  organizationId: string;
  actorId: string;
  deliverableId: string;
  changeNote: string;
  summary?: string | null;
  narrative?: string | null;
}) {
  const previous = await prisma.auditServiceDeliverable.findFirst({
    where: { id: input.deliverableId, organizationId: input.organizationId },
  });
  if (!previous) throw new Error("Audit deliverable not found.");
  if (!(
    previous.status === AuditServiceDeliverableStatus.APPROVED ||
    previous.status === AuditServiceDeliverableStatus.RELEASED ||
    previous.status === AuditServiceDeliverableStatus.WITHDRAWN
  ))
    throw new Error(
      "Only approved, released, or withdrawn deliverables can be revised.",
    );
  const changeNote = clean(input.changeNote, 2000);
  if (!changeNote) throw new Error("A revision change note is required.");
  const summary = clean(input.summary, 4000) ?? previous.summary;
  const contentSnapshot = await frozenSnapshot({
    organizationId: input.organizationId,
    engagementId: previous.engagementId,
    sourceAuditId: previous.sourceAuditId,
    summary,
    narrative: input.narrative,
  });
  const revision = await prisma.auditServiceDeliverable.create({
    data: {
      organizationId: input.organizationId,
      engagementId: previous.engagementId,
      sourceAuditId: previous.sourceAuditId,
      previousVersionId: previous.id,
      reference: previous.reference,
      type: previous.type,
      title: previous.title,
      version: previous.version + 1,
      summary,
      contentSnapshot,
      changeNote,
      createdById: input.actorId,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceDeliverable",
    entityId: revision.id,
    title: "Audit deliverable revision created",
    description: `${revision.reference} v${revision.version}`,
    metadata: {
      engagementId: revision.engagementId,
      previousVersionId: previous.id,
    },
  });
  return revision;
}

export async function transitionAuditServiceDeliverable(input: {
  organizationId: string;
  actorId: string;
  deliverableId: string;
  status: AuditServiceDeliverableStatus;
  notes?: string | null;
}) {
  const deliverable = await prisma.auditServiceDeliverable.findFirst({
    where: { id: input.deliverableId, organizationId: input.organizationId },
  });
  if (!deliverable) throw new Error("Audit deliverable not found.");
  const allowed: Record<
    AuditServiceDeliverableStatus,
    AuditServiceDeliverableStatus[]
  > = {
    DRAFT: [AuditServiceDeliverableStatus.UNDER_REVIEW],
    UNDER_REVIEW: [
      AuditServiceDeliverableStatus.CHANGES_REQUESTED,
      AuditServiceDeliverableStatus.APPROVED,
    ],
    CHANGES_REQUESTED: [AuditServiceDeliverableStatus.UNDER_REVIEW],
    APPROVED: [AuditServiceDeliverableStatus.RELEASED],
    RELEASED: [AuditServiceDeliverableStatus.WITHDRAWN],
    WITHDRAWN: [],
  };
  if (!allowed[deliverable.status].includes(input.status))
    throw new Error(
      `Cannot move a deliverable from ${deliverable.status} to ${input.status}.`,
    );
  const now = new Date();
  const notes = clean(input.notes, 4000);
  if (
    input.status === AuditServiceDeliverableStatus.APPROVED &&
    deliverable.createdById === input.actorId
  )
    throw new Error(
      "The deliverable creator cannot approve their own deliverable.",
    );
  if (
    input.status === AuditServiceDeliverableStatus.CHANGES_REQUESTED &&
    !notes
  )
    throw new Error("Review notes are required when requesting changes.");
  if (
    input.status === AuditServiceDeliverableStatus.RELEASED &&
    deliverable.createdById === input.actorId
  )
    throw new Error(
      "The deliverable creator cannot release their own deliverable.",
    );
  const data: Prisma.AuditServiceDeliverableUpdateInput = {
    status: input.status,
  };
  if (input.status === AuditServiceDeliverableStatus.UNDER_REVIEW)
    data.submittedAt = now;
  if (
    input.status === AuditServiceDeliverableStatus.CHANGES_REQUESTED ||
    input.status === AuditServiceDeliverableStatus.APPROVED
  ) {
    data.reviewedBy = { connect: { id: input.actorId } };
    data.reviewedAt = now;
    data.reviewNotes = notes;
  }
  if (input.status === AuditServiceDeliverableStatus.APPROVED) {
    data.approvedBy = { connect: { id: input.actorId } };
    data.approvedAt = now;
  }
  if (input.status === AuditServiceDeliverableStatus.RELEASED) {
    data.releasedBy = { connect: { id: input.actorId } };
    data.releasedAt = now;
    data.withdrawnAt = null;
  }
  if (input.status === AuditServiceDeliverableStatus.WITHDRAWN) {
    if (!notes) throw new Error("A withdrawal reason is required.");
    data.withdrawnAt = now;
    data.reviewNotes = notes;
  }
  const updated = await prisma.auditServiceDeliverable.update({
    where: { id: deliverable.id },
    data,
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceDeliverable",
    entityId: deliverable.id,
    title: "Audit deliverable status changed",
    description: `${deliverable.reference} v${deliverable.version}: ${deliverable.status} → ${input.status}`,
    metadata: { engagementId: deliverable.engagementId, notes },
  });
  return updated;
}

export function authorizeInternalAuditDeliverableDownload(
  organizationId: string,
  deliverableId: string,
) {
  return prisma.auditServiceDeliverable.findFirst({
    where: {
      id: deliverableId,
      organizationId,
      status: AuditServiceDeliverableStatus.RELEASED,
    },
    include: {
      organization: { select: { name: true } },
      engagement: {
        include: { client: { select: { name: true } } },
      },
    },
  });
}

export async function recordAuditDeliverableDownload(input: {
  organizationId: string;
  deliverableId: string;
  actorId?: string | null;
  accessId?: string | null;
  representativeName?: string | null;
  representativeEmail?: string | null;
}) {
  const download = await prisma.auditServiceDeliverableDownload.create({
    data: {
      organizationId: input.organizationId,
      deliverableId: input.deliverableId,
      accessId: input.accessId || null,
      representativeName: clean(input.representativeName, 200),
      representativeEmail: clean(input.representativeEmail, 320),
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId || undefined,
    action: ActivityAction.SYSTEM,
    entityType: "AuditServiceDeliverable",
    entityId: input.deliverableId,
    title: "Audit deliverable downloaded",
    description: input.representativeName
      ? `Downloaded by ${input.representativeName}`
      : "Downloaded by an authorized tenant user",
    metadata: { downloadId: download.id, accessId: input.accessId || null },
  });
  return download;
}
