"use server";

import { createHash, randomBytes } from "node:crypto";
import {
  ActivityAction,
  PermissionKey,
  ResearchConsentEventType,
  ResearchLongitudinalParticipantStatus,
  ResearchLongitudinalStudyStatus,
  ResearchLongitudinalWaveType,
  ResearchPanelMemberStatus,
  ResearchSurveyInvitationStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getApplicationUrl,
  sendTenantNotificationEmail,
} from "@/core/email/email.service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { longitudinalTransitions } from "@/modules/research/research-longitudinal";

const text = (data: FormData, key: string, max = 3000) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);
const failure = (error: unknown): FormActionState => ({
  status: "ERROR",
  message:
    error instanceof Error ? error.message : "Longitudinal operation failed.",
});
const refresh = (id?: string) => {
  revalidatePath("/research", "layout");
  revalidatePath("/research/longitudinal");
  if (id) revalidatePath(`/research/longitudinal/${id}`);
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export async function createLongitudinalStudy(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const projectId = text(data, "projectId", 100);
    const questionnaireId = text(data, "questionnaireId", 100);
    const panelId = text(data, "panelId", 100);
    const title = text(data, "title", 160);
    const purpose = text(data, "purpose");
    const recontactStatement = text(data, "recontactStatement");
    const plannedWaveCount = Number(text(data, "plannedWaveCount", 10));
    const retentionTargetPercent = Number(
      text(data, "retentionTargetPercent", 10),
    );
    if (
      title.length < 3 ||
      purpose.length < 10 ||
      recontactStatement.length < 10
    )
      throw new Error("Title, purpose and recontact statement are required.");
    if (
      !Number.isInteger(plannedWaveCount) ||
      plannedWaveCount < 2 ||
      plannedWaveCount > 100
    )
      throw new Error("A longitudinal study requires 2 to 100 planned waves.");
    if (
      !Number.isInteger(retentionTargetPercent) ||
      retentionTargetPercent < 1 ||
      retentionTargetPercent > 100
    )
      throw new Error("Retention target must be between 1 and 100 percent.");
    const [project, questionnaire, panel] = await Promise.all([
      prisma.researchProject.findFirst({
        where: { id: projectId, organizationId },
      }),
      prisma.researchQuestionnaire.findFirst({
        where: {
          id: questionnaireId,
          organizationId,
          projectId,
          isActive: true,
        },
      }),
      prisma.researchPanel.findFirst({
        where: { id: panelId, organizationId, status: "ACTIVE" },
      }),
    ]);
    if (!project || !questionnaire || !panel)
      throw new Error(
        "Tenant project, active questionnaire or participant panel not found.",
      );
    const study = await prisma.researchLongitudinalStudy.create({
      data: {
        organizationId,
        projectId,
        questionnaireId,
        panelId,
        title,
        purpose,
        recontactStatement,
        plannedWaveCount,
        retentionTargetPercent,
        createdById: user.id,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchLongitudinalStudy",
      entityId: study.id,
      title: "Longitudinal study created",
      description: title,
    });
    refresh(study.id);
    return { status: "SUCCESS", message: "Longitudinal study created." };
  } catch (error) {
    return failure(error);
  }
}

export async function addLongitudinalWave(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const studyId = text(data, "studyId", 100);
    const collectionId = text(data, "collectionId", 100);
    const label = text(data, "label", 160);
    const sequence = Number(text(data, "sequence", 10));
    const type = text(data, "type", 30) as ResearchLongitudinalWaveType;
    const scheduledRaw = text(data, "scheduledAt", 40);
    const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
    if (
      !Object.values(ResearchLongitudinalWaveType).includes(type) ||
      !Number.isInteger(sequence) ||
      sequence < 1 ||
      label.length < 2
    )
      throw new Error("Valid wave label, sequence and type are required.");
    if (scheduledAt && !Number.isFinite(scheduledAt.valueOf()))
      throw new Error("Invalid wave schedule.");
    const study = await prisma.researchLongitudinalStudy.findFirst({
      where: {
        id: studyId,
        organizationId,
        status: { in: ["DRAFT", "PAUSED"] },
      },
    });
    const collection = study
      ? await prisma.researchCollectionWave.findFirst({
          where: {
            id: collectionId,
            organizationId,
            projectId: study.projectId,
            questionnaireId: study.questionnaireId,
          },
        })
      : null;
    if (!study || !collection)
      throw new Error("Editable study or matching collection wave not found.");
    if (sequence > study.plannedWaveCount)
      throw new Error("Wave sequence exceeds the study plan.");
    const wave = await prisma.researchLongitudinalWave.create({
      data: { studyId, collectionId, label, sequence, type, scheduledAt },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchLongitudinalWave",
      entityId: wave.id,
      title: "Longitudinal wave linked",
      description: `${label} · sequence ${sequence}`,
    });
    refresh(studyId);
    return {
      status: "SUCCESS",
      message: "Collection wave added to the study.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function enrollLongitudinalPanel(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const studyId = text(data, "studyId", 100);
    const study = await prisma.researchLongitudinalStudy.findFirst({
      where: { id: studyId, organizationId, status: "DRAFT" },
      include: { participants: { select: { panelMemberId: true } } },
    });
    if (!study) throw new Error("Draft tenant study not found.");
    const existing = new Set(
      study.participants.map((item) => item.panelMemberId),
    );
    const members = await prisma.researchPanelMember.findMany({
      where: {
        panelId: study.panelId,
        organizationId,
        status: ResearchPanelMemberStatus.ACTIVE,
        OR: [
          { consentExpiresAt: null },
          { consentExpiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });
    const eligible = members.filter((item) => !existing.has(item.id));
    if (!eligible.length)
      throw new Error("No new eligible panel participants are available.");
    await prisma.researchLongitudinalParticipant.createMany({
      data: eligible.map((member) => ({
        organizationId,
        studyId,
        panelMemberId: member.id,
        subjectCode: `L-${createHash("sha256").update(`${studyId}:${member.id}`).digest("hex").slice(0, 12).toUpperCase()}`,
      })),
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.ASSIGN,
      entityType: "ResearchLongitudinalStudy",
      entityId: studyId,
      title: "Longitudinal cohort enrolled",
      description: `${eligible.length} consented participants enrolled`,
    });
    refresh(studyId);
    return {
      status: "SUCCESS",
      message: `${eligible.length} eligible participants enrolled.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function changeLongitudinalStudyStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const studyId = text(data, "studyId", 100);
    const target = text(data, "status", 30) as ResearchLongitudinalStudyStatus;
    const study = await prisma.researchLongitudinalStudy.findFirst({
      where: { id: studyId, organizationId },
      include: { _count: { select: { waves: true, participants: true } } },
    });
    if (
      !study ||
      !Object.values(ResearchLongitudinalStudyStatus).includes(target)
    )
      throw new Error("Study or target status not found.");
    if (!(longitudinalTransitions[study.status] ?? []).includes(target))
      throw new Error(`Study cannot move from ${study.status} to ${target}.`);
    if (
      target === "ACTIVE" &&
      (study._count.waves < 2 || study._count.participants < 1)
    )
      throw new Error(
        "Activation requires at least two linked waves and one enrolled participant.",
      );
    await prisma.researchLongitudinalStudy.update({
      where: { id: studyId },
      data: {
        status: target,
        activatedAt:
          target === "ACTIVE" && !study.activatedAt
            ? new Date()
            : study.activatedAt,
        completedAt: target === "COMPLETED" ? new Date() : null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchLongitudinalStudy",
      entityId: studyId,
      title: "Longitudinal study status changed",
      description: `${study.status} → ${target}`,
    });
    refresh(studyId);
    return { status: "SUCCESS", message: `Study moved to ${target}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function sendLongitudinalWaveInvitations(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const studyId = text(data, "studyId", 100);
    const waveId = text(data, "waveId", 100);
    const study = await prisma.researchLongitudinalStudy.findFirst({
      where: { id: studyId, organizationId, status: "ACTIVE" },
      include: {
        waves: {
          where: { id: waveId },
          include: {
            collection: {
              include: {
                publicLinks: { where: { status: "ACTIVE" }, take: 1 },
                questionnaire: true,
              },
            },
          },
        },
        participants: {
          where: {
            status: "ENROLLED",
            panelMember: {
              status: "ACTIVE",
              OR: [
                { consentExpiresAt: null },
                { consentExpiresAt: { gt: new Date() } },
              ],
            },
          },
          include: { panelMember: true },
        },
      },
    });
    const wave = study?.waves[0];
    const publicLink = wave?.collection.publicLinks[0];
    if (!study || !wave || !publicLink || wave.collection.status !== "ACTIVE")
      throw new Error(
        "Active study, collection wave and public link are required.",
      );
    const existing = await prisma.researchSurveyInvitation.findMany({
      where: {
        organizationId,
        campaign: { collectionId: wave.collectionId },
        panelMemberId: {
          in: study.participants.map((item) => item.panelMemberId),
        },
      },
      select: { panelMemberId: true },
    });
    const invited = new Set(existing.map((item) => item.panelMemberId));
    const eligible = study.participants
      .filter((item) => !invited.has(item.panelMemberId))
      .slice(0, 500);
    if (!eligible.length)
      throw new Error("No eligible cohort members remain for this wave.");
    const campaign = await prisma.researchSurveyCampaign.create({
      data: {
        organizationId,
        collectionId: wave.collectionId,
        publicLinkId: publicLink.id,
        name: `${study.title} — ${wave.label}`,
        status: "ACTIVE",
        activatedAt: new Date(),
        createdById: user.id,
        invitations: {
          create: eligible.map((item) => ({
            organizationId,
            panelMemberId: item.panelMemberId,
            token: randomBytes(32).toString("base64url"),
            participantName: item.panelMember.name,
            participantEmail: item.panelMember.email,
          })),
        },
      },
      include: { invitations: true },
    });
    let sent = 0;
    for (const invitation of campaign.invitations) {
      const url = `${getApplicationUrl()}/survey/${publicLink.token}?invite=${invitation.token}`;
      const result = await sendTenantNotificationEmail({
        to: invitation.participantEmail,
        subject: `${wave.label}: ${wave.collection.questionnaire.name}`,
        html: `<p>${escapeHtml(study.recontactStatement)}</p><p><a href="${url}">Open secure questionnaire</a></p>`,
        text: `${study.recontactStatement}\n\nOpen secure questionnaire: ${url}`,
      });
      await prisma.researchSurveyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: result.success
            ? ResearchSurveyInvitationStatus.SENT
            : ResearchSurveyInvitationStatus.FAILED,
          sentAt: result.success ? new Date() : null,
        },
      });
      if (result.success) sent += 1;
    }
    await prisma.researchLongitudinalParticipant.updateMany({
      where: {
        studyId,
        panelMemberId: { in: eligible.map((item) => item.panelMemberId) },
      },
      data: { lastContactAt: new Date() },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.ASSIGN,
      entityType: "ResearchLongitudinalWave",
      entityId: waveId,
      title: "Longitudinal wave recontact launched",
      description: `${sent}/${eligible.length} invitations sent`,
      metadata: { studyId, campaignId: campaign.id },
    });
    refresh(studyId);
    return {
      status: "SUCCESS",
      message: `${sent} longitudinal invitations sent.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function markLongitudinalAttrition(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const participantId = text(data, "participantId", 100);
    const status = text(
      data,
      "status",
      40,
    ) as ResearchLongitudinalParticipantStatus;
    const reason = text(data, "reason", 1000);
    if (
      (status !== ResearchLongitudinalParticipantStatus.WITHDRAWN &&
        status !== ResearchLongitudinalParticipantStatus.LOST_TO_FOLLOW_UP) ||
      reason.length < 5
    )
      throw new Error("A valid attrition outcome and reason are required.");
    const participant = await prisma.researchLongitudinalParticipant.findFirst({
      where: { id: participantId, organizationId },
      include: { study: true },
    });
    if (
      !participant ||
      participant.study.status === "COMPLETED" ||
      participant.study.status === "CANCELLED"
    )
      throw new Error("Editable longitudinal participant not found.");
    await prisma.$transaction(async (tx) => {
      await tx.researchLongitudinalParticipant.update({
        where: { id: participantId },
        data: {
          status,
          attritionReason: reason,
          withdrawnAt:
            status === ResearchLongitudinalParticipantStatus.WITHDRAWN
              ? new Date()
              : null,
        },
      });
      if (status === ResearchLongitudinalParticipantStatus.WITHDRAWN) {
        await tx.researchPanelMember.update({
          where: { id: participant.panelMemberId },
          data: { status: ResearchPanelMemberStatus.OPTED_OUT },
        });
        await tx.researchPanelConsentEvent.create({
          data: {
            organizationId,
            panelMemberId: participant.panelMemberId,
            type: ResearchConsentEventType.WITHDRAWN,
            statement: reason,
            lawfulBasis: "Participant withdrawal during longitudinal study",
            recordedById: user.id,
          },
        });
      }
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchLongitudinalParticipant",
      entityId: participantId,
      title: "Longitudinal attrition recorded",
      description: `${status} · ${reason}`,
    });
    refresh(participant.studyId);
    return { status: "SUCCESS", message: "Participant attrition recorded." };
  } catch (error) {
    return failure(error);
  }
}
