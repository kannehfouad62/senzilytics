import { logActivity } from "@/core/activity-log/activity-log.service";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import { getApplicationUrl, sendEmail } from "@/core/email/email.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditExternalAccessScope,
  AuditExternalAccessStatus,
  AuditExternalDecisionType,
  AuditExternalFindingPosition,
  AuditServiceEngagementKind,
  EnterpriseAuditStatus,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";

export const auditExternalSessionCookie = "senzilytics_audit_client";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const clean = (value: string | null | undefined, maximum = 2000) =>
  value?.trim().slice(0, maximum) || null;

export async function issueAuditExternalAccess(input: {
  organizationId: string;
  actorId: string;
  engagementId: string;
  contactId: string;
  informationRequestId?: string | null;
  auditId?: string | null;
  questionId?: string | null;
  findingId?: string | null;
  scope: AuditExternalAccessScope;
  title: string;
  instructions?: string | null;
  expiresAt: Date;
}) {
  const now = new Date();
  if (!Number.isFinite(input.expiresAt.valueOf()) || input.expiresAt <= now)
    throw new Error("External access expiry must be in the future.");
  if (input.expiresAt > new Date(now.getTime() + 30 * 86400000))
    throw new Error("External access cannot exceed 30 days.");
  const engagement = await prisma.auditServiceEngagement.findFirst({
    where: {
      id: input.engagementId,
      organizationId: input.organizationId,
      kind: AuditServiceEngagementKind.EXTERNAL,
      clientId: { not: null },
    },
    include: {
      organization: { select: { name: true } },
      client: {
        include: {
          contacts: {
            where: {
              id: input.contactId,
              isActive: true,
              isAuthorizedRepresentative: true,
            },
          },
        },
      },
    },
  });
  const contact = engagement?.client?.contacts[0];
  if (!engagement || !contact)
    throw new Error(
      "Select an active authorized representative for this external engagement.",
    );
  const informationRequestId = clean(input.informationRequestId, 100);
  const auditId = clean(input.auditId, 100);
  const questionId = clean(input.questionId, 100);
  const findingId = clean(input.findingId, 100);
  let resourceSnapshot: Prisma.InputJsonValue | undefined;
  if (input.scope === AuditExternalAccessScope.INFORMATION_REQUEST) {
    if (!informationRequestId)
      throw new Error("Select an information request for this access link.");
    const request = await prisma.auditServiceInformationRequest.findFirst({
      where: {
        id: informationRequestId,
        organizationId: input.organizationId,
        engagementId: engagement.id,
      },
      select: { id: true },
    });
    if (!request) throw new Error("Information request not found.");
  } else if (informationRequestId) {
    throw new Error("Information requests require the matching access scope.");
  }
  if (
    input.scope === AuditExternalAccessScope.AUDIT_REPORT ||
    input.scope === AuditExternalAccessScope.AUDIT_QUESTION ||
    input.scope === AuditExternalAccessScope.AUDIT_FINDING
  ) {
    if (!auditId) throw new Error("Select a linked audit for this access link.");
    const audit = await prisma.enterpriseAudit.findFirst({
      where: {
        id: auditId,
        organizationId: input.organizationId,
        engagementId: engagement.id,
        status:
          input.scope === AuditExternalAccessScope.AUDIT_REPORT
            ? { in: [EnterpriseAuditStatus.COMPLETED, EnterpriseAuditStatus.CLOSED] }
            : { notIn: [EnterpriseAuditStatus.DRAFT, EnterpriseAuditStatus.CANCELLED] },
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
        findings: true,
      },
    });
    if (!audit) throw new Error("Eligible linked audit not found.");
    if (input.scope === AuditExternalAccessScope.AUDIT_FINDING) {
      if (!findingId) throw new Error("Select an audit finding to share.");
      const finding = audit.findings.find((item) => item.id === findingId);
      if (!finding) throw new Error("Audit finding not found in the selected audit.");
      resourceSnapshot = {
        kind: "AUDIT_FINDING",
        auditReference: audit.reference,
        auditTitle: audit.title,
        findingId: finding.id,
        reference: finding.reference,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        description: finding.description,
        objectiveEvidence: finding.objectiveEvidence,
        standardClause: finding.standardClause,
        regulatoryRef: finding.regulatoryRef,
        dueDate: finding.dueDate?.toISOString() ?? null,
        frozenAt: now.toISOString(),
      };
    } else if (input.scope === AuditExternalAccessScope.AUDIT_QUESTION) {
      if (!questionId) throw new Error("Select an audit question to share.");
      const question = audit.sections
        .flatMap((section) => section.questions)
        .find((item) => item.id === questionId);
      if (!question) throw new Error("Audit question not found in the selected audit.");
      resourceSnapshot = {
        kind: "AUDIT_QUESTION",
        auditReference: audit.reference,
        auditTitle: audit.title,
        questionId: question.id,
        questionText: question.questionText,
        standardClause: question.standardClause,
        regulatoryRef: question.regulatoryRef,
        status: question.status,
        response: question.response
          ? {
              result: question.response.result,
              responseText: question.response.responseText,
              comments: question.response.comments,
            }
          : null,
        frozenAt: now.toISOString(),
      };
    } else {
      if (questionId) throw new Error("Question selection requires question scope.");
      resourceSnapshot = {
        kind: "AUDIT_REPORT",
        auditReference: audit.reference,
        auditTitle: audit.title,
        status: audit.status,
        site: audit.site.name,
        scorePercentage:
          audit.scorePercentage === null ? null : Number(audit.scorePercentage),
        executiveSummary: audit.executiveSummary,
        overallOpinion: audit.overallOpinion,
        positivePractices: audit.positivePractices,
        majorConcerns: audit.majorConcerns,
        recommendations: audit.recommendations,
        results: audit.sections.map((section) => ({
          title: section.title,
          questions: section.questions.map((question) => ({
            text: question.questionText,
            result: question.response?.result ?? "NOT_ASSESSED",
            comments: question.response?.comments ?? null,
          })),
        })),
        frozenAt: now.toISOString(),
      };
    }
  } else if (auditId || questionId || findingId) {
    throw new Error("Audit resources require report or question access scope.");
  }
  const title = clean(input.title, 200);
  if (!title) throw new Error("External access title is required.");
  const token = randomBytes(32).toString("base64url");
  const passcode = randomInt(100000, 1000000).toString();
  const access = await prisma.auditServiceExternalAccess.create({
    data: {
      organizationId: input.organizationId,
      engagementId: engagement.id,
      contactId: contact.id,
      informationRequestId:
        input.scope === AuditExternalAccessScope.INFORMATION_REQUEST
          ? informationRequestId
          : null,
      auditId,
      questionId:
        input.scope === AuditExternalAccessScope.AUDIT_QUESTION
          ? questionId
          : null,
      findingId:
        input.scope === AuditExternalAccessScope.AUDIT_FINDING
          ? findingId
          : null,
      scope: input.scope,
      title,
      instructions: clean(input.instructions),
      resourceSnapshot,
      tokenHash: digest(token),
      passcodeHash: await bcrypt.hash(passcode, 12),
      expiresAt: input.expiresAt,
      createdById: input.actorId,
    },
  });
  const url = `${getApplicationUrl()}/audit-client/${token}`;
  const delivery = await sendEmail({
    to: contact.email,
    subject: `${engagement.organization.name}: secure audit review access`,
    html: createSenzilyticsEmailTemplate({
      preheader: "Secure external audit access",
      heading: "Audit review access",
      body: `${contact.name}, ${engagement.organization.name} has provided controlled access to ${title}. Open the secure link and enter the one-time passcode below. Do not forward either credential.`,
      actionLabel: "Open Secure Audit Access",
      actionUrl: url,
      details: [
        { label: "Engagement", value: engagement.reference },
        { label: "Passcode", value: passcode },
        { label: "Expires", value: input.expiresAt.toUTCString() },
      ],
    }),
    text: `Secure audit access: ${url}\nPasscode: ${passcode}\nExpires: ${input.expiresAt.toUTCString()}`,
  });
  if (!delivery.success) {
    await prisma.auditServiceExternalAccess.update({
      where: { id: access.id },
      data: { status: AuditExternalAccessStatus.REVOKED, revokedAt: new Date() },
    });
    throw new Error("The access email could not be delivered. No active link was issued.");
  }
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceExternalAccess",
    entityId: access.id,
    title: "Secure external audit access issued",
    description: `${engagement.reference} · ${contact.email} · ${input.scope}`,
    metadata: {
      engagementId: engagement.id,
      contactId: contact.id,
      scope: input.scope,
      expiresAt: input.expiresAt.toISOString(),
      emailMessageId: delivery.messageId,
    },
  });
  return access;
}

export async function verifyAuditExternalPasscode(token: string, passcode: string) {
  const now = new Date();
  const access = await prisma.auditServiceExternalAccess.findUnique({
    where: { tokenHash: digest(token) },
  });
  if (
    !access ||
    access.status !== AuditExternalAccessStatus.ACTIVE ||
    access.expiresAt <= now
  )
    throw new Error("This external audit link is invalid or expired.");
  if (access.lockedUntil && access.lockedUntil > now)
    throw new Error("Verification is temporarily locked. Try again later.");
  const valid = await bcrypt.compare(passcode.trim(), access.passcodeHash);
  if (!valid) {
    const attempts =
      access.lockedUntil && access.lockedUntil <= now
        ? 1
        : access.failedAttempts + 1;
    await prisma.auditServiceExternalAccess.update({
      where: { id: access.id },
      data: {
        failedAttempts: attempts >= access.maxAttempts ? 0 : attempts,
        lockedUntil:
          attempts >= access.maxAttempts
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : null,
      },
    });
    throw new Error("The verification passcode is incorrect.");
  }
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionExpiresAt = new Date(
    Math.min(access.expiresAt.getTime(), now.getTime() + 4 * 60 * 60 * 1000),
  );
  await prisma.auditServiceExternalAccess.update({
    where: { id: access.id },
    data: {
      sessionTokenHash: digest(sessionToken),
      sessionExpiresAt,
      verifiedAt: now,
      lastAccessedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  return { accessId: access.id, sessionToken, sessionExpiresAt };
}

export async function resolveAuditExternalAccess(
  token: string,
  sessionToken?: string | null,
) {
  if (!sessionToken) return null;
  const now = new Date();
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: {
      tokenHash: digest(token),
      sessionTokenHash: digest(sessionToken),
      status: AuditExternalAccessStatus.ACTIVE,
      expiresAt: { gt: now },
      sessionExpiresAt: { gt: now },
    },
    include: {
      organization: { select: { name: true } },
      engagement: {
        select: { reference: true, title: true, purpose: true, scope: true },
      },
      contact: { select: { name: true, email: true } },
      informationRequest: {
        select: { reference: true, title: true, description: true, dueDate: true },
      },
      decision: true,
      findingResponse: true,
      comments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (access)
    await prisma.auditServiceExternalAccess.update({
      where: { id: access.id },
      data: { lastAccessedAt: now },
    });
  return access;
}

export async function recordAuditExternalComment(input: {
  accessId: string;
  body: string;
}) {
  const body = clean(input.body, 4000);
  if (!body || body.length < 2) throw new Error("Enter a substantive comment.");
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: {
      id: input.accessId,
      status: AuditExternalAccessStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    include: { contact: true },
  });
  if (!access) throw new Error("External audit access is no longer available.");
  const comment = await prisma.auditServiceExternalComment.create({
    data: {
      organizationId: access.organizationId,
      accessId: access.id,
      body,
      representativeName: access.contact.name,
      representativeEmail: access.contact.email,
    },
  });
  await logActivity({
    organizationId: access.organizationId,
    action: ActivityAction.COMMENT,
    entityType: "AuditServiceExternalAccess",
    entityId: access.id,
    title: "External audit comment recorded",
    description: `${access.contact.name} · ${access.title}`,
    metadata: { commentId: comment.id, contactId: access.contactId },
  });
  return comment;
}

export async function recordAuditExternalDecision(input: {
  accessId: string;
  decision: AuditExternalDecisionType;
  comment?: string | null;
}) {
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: {
      id: input.accessId,
      status: AuditExternalAccessStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    include: { contact: true, decision: true },
  });
  if (!access) throw new Error("External audit access is no longer available.");
  if (access.decision) throw new Error("A final decision has already been recorded.");
  const comment = clean(input.comment, 4000);
  if (input.decision === AuditExternalDecisionType.DENIED && !comment)
    throw new Error("A denial requires an explanatory comment.");
  const decision = await prisma.auditServiceExternalDecision.create({
    data: {
      organizationId: access.organizationId,
      accessId: access.id,
      decision: input.decision,
      comment,
      representativeName: access.contact.name,
      representativeEmail: access.contact.email,
    },
  });
  await logActivity({
    organizationId: access.organizationId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceExternalAccess",
    entityId: access.id,
    title: "External audit decision recorded",
    description: `${access.contact.name} · ${decision.decision}`,
    metadata: { decisionId: decision.id, contactId: access.contactId },
  });
  return decision;
}

export async function recordAuditExternalFindingResponse(input: {
  accessId: string;
  position: AuditExternalFindingPosition;
  response: string;
  proposedRootCause?: string | null;
  immediateCorrection?: string | null;
  remediationPlan?: string | null;
  targetDate?: Date | null;
}) {
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: { id: input.accessId, scope: AuditExternalAccessScope.AUDIT_FINDING, status: AuditExternalAccessStatus.ACTIVE, expiresAt: { gt: new Date() } },
    include: { contact: true, findingResponse: true },
  });
  if (!access) throw new Error("External finding access is no longer available.");
  if (access.findingResponse) throw new Error("A finding response has already been submitted.");
  const response = clean(input.response, 4000);
  if (!response) throw new Error("A client finding response is required.");
  const remediationPlan = clean(input.remediationPlan, 4000);
  if (input.position === AuditExternalFindingPosition.REMEDIATION_PROPOSED && !remediationPlan)
    throw new Error("A proposed remediation plan is required.");
  if (input.targetDate && input.targetDate <= new Date())
    throw new Error("The proposed target date must be in the future.");
  const record = await prisma.auditServiceExternalFindingResponse.create({ data: {
    organizationId: access.organizationId, accessId: access.id, position: input.position,
    response, proposedRootCause: clean(input.proposedRootCause), immediateCorrection: clean(input.immediateCorrection),
    remediationPlan, targetDate: input.targetDate, representativeName: access.contact.name, representativeEmail: access.contact.email,
  }});
  await logActivity({ organizationId: access.organizationId, action: ActivityAction.CREATE, entityType: "AuditServiceExternalFindingResponse", entityId: record.id, title: "External audit finding response submitted", description: `${access.contact.name} · ${record.position}`, metadata: { accessId: access.id, findingId: access.findingId } });
  return record;
}

export async function revokeAuditExternalAccess(input: {
  organizationId: string;
  actorId: string;
  accessId: string;
}) {
  const access = await prisma.auditServiceExternalAccess.findFirst({
    where: { id: input.accessId, organizationId: input.organizationId },
  });
  if (!access) throw new Error("External access record not found.");
  if (access.status === AuditExternalAccessStatus.REVOKED) return access;
  const updated = await prisma.auditServiceExternalAccess.update({
    where: { id: access.id },
    data: {
      status: AuditExternalAccessStatus.REVOKED,
      revokedAt: new Date(),
      sessionTokenHash: null,
      sessionExpiresAt: null,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.actorId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "AuditServiceExternalAccess",
    entityId: access.id,
    title: "External audit access revoked",
    description: access.title,
  });
  return updated;
}
