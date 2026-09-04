"use server";

import { randomBytes } from "node:crypto";
import {
  ActivityAction,
  PermissionKey,
  ResearchCampaignQuotaStatus,
  ResearchConsentEventType,
  ResearchPanelMemberStatus,
  ResearchSurveyCampaignStatus,
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

const value = (data: FormData, key: string, max = 5000) =>
    String(data.get(key) ?? "")
      .trim()
      .slice(0, max),
  fail = (error: unknown): FormActionState => ({
    status: "ERROR",
    message: error instanceof Error ? error.message : "Panel operation failed.",
  }),
  refresh = () => {
    revalidatePath("/research", "layout");
    revalidatePath("/research/panels");
  };

export async function createResearchPanel(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const name = value(data, "name", 160),
      lawfulPurpose = value(data, "lawfulPurpose", 2000);
    if (name.length < 3 || lawfulPurpose.length < 10)
      throw new Error(
        "Panel name and a substantive lawful purpose are required.",
      );
    const panel = await prisma.researchPanel.create({
      data: {
        organizationId,
        name,
        description: value(data, "description", 2000) || null,
        lawfulPurpose,
        createdById: user.id,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchPanel",
      entityId: panel.id,
      title: "Research participant panel created",
      description: name,
    });
    refresh();
    return { status: "SUCCESS", message: "Participant panel created." };
  } catch (error) {
    return fail(error);
  }
}

export async function addResearchPanelMember(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const panelId = value(data, "panelId", 100),
      email = value(data, "email", 254).toLowerCase(),
      statement = value(data, "consentStatement", 3000),
      lawfulBasis = value(data, "lawfulBasis", 500);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("A valid participant email is required.");
    if (statement.length < 10 || lawfulBasis.length < 3)
      throw new Error("Consent statement and lawful basis are required.");
    const panel = await prisma.researchPanel.findFirst({
      where: { id: panelId, organizationId, status: "ACTIVE" },
    });
    if (!panel) throw new Error("Active tenant panel not found.");
    const expiresRaw = value(data, "consentExpiresAt", 40),
      expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (
      expiresAt &&
      (!Number.isFinite(expiresAt.valueOf()) || expiresAt <= new Date())
    )
      throw new Error("Consent expiry must be a future date.");
    const attributes = parseAttributes(value(data, "attributes", 3000));
    const member = await prisma.researchPanelMember.create({
      data: {
        organizationId,
        panelId,
        email,
        name: value(data, "memberName", 160) || null,
        externalRef: value(data, "externalRef", 160) || null,
        attributes,
        consentExpiresAt: expiresAt,
        managedById: user.id,
        consentEvents: {
          create: {
            organizationId,
            type: ResearchConsentEventType.GRANTED,
            statement,
            lawfulBasis,
            expiresAt,
            recordedById: user.id,
          },
        },
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchPanelMember",
      entityId: member.id,
      title: "Consented research panel member added",
      description: panel.name,
      metadata: { panelId, attributeKeys: Object.keys(attributes) },
    });
    refresh();
    return {
      status: "SUCCESS",
      message: "Panel member and immutable consent evidence recorded.",
    };
  } catch (error) {
    return fail(error);
  }
}

export async function changePanelMemberStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const id = value(data, "memberId", 100),
      target = value(data, "status", 30) as ResearchPanelMemberStatus,
      note = value(data, "note", 1000),
      member = await prisma.researchPanelMember.findFirst({
        where: { id, organizationId },
      });
    if (!member) throw new Error("Panel member not found.");
    if (!Object.values(ResearchPanelMemberStatus).includes(target))
      throw new Error("Invalid member status.");
    if (target === member.status)
      throw new Error("Select a different member status.");
    if (
      (target === ResearchPanelMemberStatus.OPTED_OUT ||
        target === ResearchPanelMemberStatus.SUPPRESSED ||
        target === ResearchPanelMemberStatus.ACTIVE) &&
      note.length < 5
    )
      throw new Error("A governance note is required.");
    const expiresRaw = value(data, "consentExpiresAt", 40);
    const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
    if (
      target === ResearchPanelMemberStatus.ACTIVE &&
      expiresAt &&
      (!Number.isFinite(expiresAt.valueOf()) || expiresAt <= new Date())
    )
      throw new Error("Renewed consent expiry must be a future date.");
    await prisma.$transaction(async (tx) => {
      await tx.researchPanelMember.update({
        where: { id },
        data: {
          status: target,
          ...(target === ResearchPanelMemberStatus.ACTIVE
            ? { consentExpiresAt: expiresAt }
            : {}),
        },
      });
      if (target === ResearchPanelMemberStatus.OPTED_OUT) {
        await tx.researchPanelConsentEvent.create({
          data: {
            organizationId,
            panelMemberId: id,
            type: ResearchConsentEventType.WITHDRAWN,
            statement: note,
            lawfulBasis: "Participant withdrawal",
            recordedById: user.id,
          },
        });
      }
      if (
        target === ResearchPanelMemberStatus.ACTIVE &&
        member.status !== ResearchPanelMemberStatus.ACTIVE
      ) {
        await tx.researchPanelConsentEvent.create({
          data: {
            organizationId,
            panelMemberId: id,
            type: ResearchConsentEventType.RENEWED,
            statement: note,
            lawfulBasis: "Renewed participant consent",
            expiresAt,
            recordedById: user.id,
          },
        });
      }
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchPanelMember",
      entityId: id,
      title: "Research panel eligibility changed",
      description: `${member.status} → ${target}`,
      metadata: { note },
    });
    refresh();
    return { status: "SUCCESS", message: "Member eligibility updated." };
  } catch (error) {
    return fail(error);
  }
}

export async function createResearchCampaignQuota(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const campaignId = value(data, "campaignId", 100),
      target = Number(value(data, "target", 12)),
      attributeKey = value(data, "attributeKey", 100),
      attributeValue = value(data, "attributeValue", 200),
      name = value(data, "name", 160);
    if (!Number.isInteger(target) || target < 1 || target > 100000)
      throw new Error("Quota target must be between 1 and 100,000.");
    if (!attributeKey || !attributeValue || name.length < 3)
      throw new Error("Quota name and segment attribute are required.");
    const campaign = await prisma.researchSurveyCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
        status: {
          in: [
            ResearchSurveyCampaignStatus.ACTIVE,
            ResearchSurveyCampaignStatus.PAUSED,
          ],
        },
      },
    });
    if (!campaign) throw new Error("Editable campaign not found.");
    const quota = await prisma.researchCampaignQuota.create({
      data: {
        organizationId,
        campaignId,
        name,
        attributeKey,
        attributeValue,
        target,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchCampaignQuota",
      entityId: quota.id,
      title: "Research campaign quota created",
      description: `${name} target ${target}`,
      metadata: { campaignId, attributeKey, attributeValue },
    });
    refresh();
    return { status: "SUCCESS", message: "Campaign quota created." };
  } catch (error) {
    return fail(error);
  }
}

export async function inviteResearchPanelQuota(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const quotaId = value(data, "quotaId", 100),
      panelId = value(data, "panelId", 100),
      quota = await prisma.researchCampaignQuota.findFirst({
        where: {
          id: quotaId,
          organizationId,
          status: ResearchCampaignQuotaStatus.OPEN,
        },
        include: {
          campaign: {
            include: {
              publicLink: true,
              collection: { include: { questionnaire: true } },
              invitations: { select: { participantEmail: true } },
            },
          },
          invitations: {
            where: { status: ResearchSurveyInvitationStatus.COMPLETED },
            select: { id: true },
          },
          _count: { select: { invitations: true } },
        },
      });
    if (!quota || quota.campaign.status !== ResearchSurveyCampaignStatus.ACTIVE)
      throw new Error("Open quota on an active campaign is required.");
    if (quota.invitations.length >= quota.target)
      throw new Error("This quota has already been filled.");
    const members = await prisma.researchPanelMember.findMany({
      where: {
        panelId,
        organizationId,
        status: ResearchPanelMemberStatus.ACTIVE,
        OR: [
          { consentExpiresAt: null },
          { consentExpiresAt: { gt: new Date() } },
        ],
      },
      take: 5000,
    });
    const existing = new Set(
        quota.campaign.invitations.map((item) =>
          item.participantEmail.toLowerCase(),
        ),
      ),
      invitationCapacity = Math.max(
        0,
        quota.target * 3 - quota._count.invitations,
      ),
      eligible = members
        .filter(
          (member) =>
            String(
              (member.attributes as Record<string, unknown>)[
                quota.attributeKey
              ] ?? "",
            ) === quota.attributeValue &&
            !existing.has(member.email.toLowerCase()),
        )
        .slice(0, Math.min(500, invitationCapacity));
    if (!eligible.length)
      throw new Error(
        invitationCapacity
          ? "No eligible consented panel members remain for this quota."
          : "This quota has reached its invitation safety limit.",
      );
    const invitations = await prisma.$transaction(
      eligible.map((member) =>
        prisma.researchSurveyInvitation.create({
          data: {
            organizationId,
            campaignId: quota.campaignId,
            panelMemberId: member.id,
            quotaId: quota.id,
            token: randomBytes(32).toString("base64url"),
            participantName: member.name,
            participantEmail: member.email,
          },
        }),
      ),
    );
    let sent = 0;
    for (const invite of invitations) {
      const url = `${getApplicationUrl()}/survey/${quota.campaign.publicLink.token}?invite=${invite.token}`,
        result = await sendTenantNotificationEmail({
          to: invite.participantEmail,
          subject: `Research invitation: ${quota.campaign.collection.questionnaire.name}`,
          html: `<p>You are invited to participate in a research questionnaire.</p><p><a href="${url}">Open secure questionnaire</a></p>`,
          text: `Open your secure questionnaire: ${url}`,
        });
      await prisma.researchSurveyInvitation.update({
        where: { id: invite.id },
        data: {
          status: result.success
            ? ResearchSurveyInvitationStatus.SENT
            : ResearchSurveyInvitationStatus.FAILED,
          sentAt: result.success ? new Date() : null,
        },
      });
      if (result.success) sent++;
    }
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.ASSIGN,
      entityType: "ResearchCampaignQuota",
      entityId: quota.id,
      title: "Panel segment invited to campaign quota",
      description: `${sent}/${eligible.length} invitations sent`,
      metadata: { panelId, campaignId: quota.campaignId },
    });
    refresh();
    return {
      status: "SUCCESS",
      message: `${sent} eligible panel invitations sent.`,
    };
  } catch (error) {
    return fail(error);
  }
}

function parseAttributes(raw: string) {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0) {
      const key = line
          .slice(0, index)
          .trim()
          .replace(/[^a-zA-Z0-9_.-]/g, "")
          .slice(0, 100),
        val = line
          .slice(index + 1)
          .trim()
          .slice(0, 300);
      if (key && val) result[key] = val;
    }
  }
  return result;
}
