"use server";

import { randomBytes } from "node:crypto";
import {
  ActivityAction,
  PermissionKey,
  ResearchPublicLinkStatus,
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

const text = (data: FormData, key: string, max = 10000) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);
const fail = (error: unknown): FormActionState => ({
  status: "ERROR",
  message:
    error instanceof Error
      ? error.message
      : "Survey campaign could not be updated.",
});
const refresh = (id: string) => {
  revalidatePath("/research", "layout");
  revalidatePath(`/research/collections/${id}`);
};

export async function createSurveyCampaign(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const collectionId = text(data, "collectionId", 100),
      publicLinkId = text(data, "publicLinkId", 100),
      name = text(data, "name", 160),
      reminderLimit = Number(text(data, "reminderLimit", 2) || "2");
    if (name.length < 3)
      throw new Error("Campaign name must contain at least 3 characters.");
    if (
      !Number.isInteger(reminderLimit) ||
      reminderLimit < 0 ||
      reminderLimit > 5
    )
      throw new Error("Reminder limit must be between 0 and 5.");
    const link = await prisma.researchPublicSurveyLink.findFirst({
      where: {
        id: publicLinkId,
        collectionId,
        organizationId,
        status: ResearchPublicLinkStatus.ACTIVE,
        collection: { status: "ACTIVE" },
      },
      include: { collection: true },
    });
    if (!link)
      throw new Error("Select an active public link from this collection.");
    const recipients = parseRecipients(text(data, "recipients", 30000));
    if (!recipients.length)
      throw new Error("Add at least one valid recipient email.");
    if (recipients.length > 500)
      throw new Error("A campaign batch is limited to 500 unique recipients.");
    const campaign = await prisma.researchSurveyCampaign.create({
      data: {
        organizationId,
        collectionId,
        publicLinkId,
        name,
        reminderLimit,
        createdById: user.id,
        status: ResearchSurveyCampaignStatus.ACTIVE,
        activatedAt: new Date(),
        invitations: {
          create: recipients.map((item) => ({
            organizationId,
            participantName: item.name,
            participantEmail: item.email,
            token: randomBytes(32).toString("base64url"),
          })),
        },
      },
      include: {
        invitations: true,
        collection: { include: { questionnaire: true } },
      },
    });
    const base = getApplicationUrl();
    let sent = 0;
    for (const invite of campaign.invitations) {
      const url = `${base}/survey/${link.token}?invite=${invite.token}`;
      const title = escapeHtml(campaign.collection.questionnaire.name);
      const result = await sendTenantNotificationEmail({
        to: invite.participantEmail,
        subject: `Research invitation: ${campaign.collection.questionnaire.name}`,
        html: `<p>You are invited to participate in ${title}.</p><p><a href="${url}">Open secure questionnaire</a></p><p>This invitation is unique and can be completed once.</p>`,
        text: `Open your secure research questionnaire: ${url}`,
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
      action: ActivityAction.CREATE,
      entityType: "ResearchSurveyCampaign",
      entityId: campaign.id,
      title: "Research survey campaign launched",
      description: `${campaign.name} — ${sent}/${recipients.length} invitations sent`,
      metadata: { collectionId, recipientCount: recipients.length, sent },
    });
    refresh(collectionId);
    return {
      status: "SUCCESS",
      message: `Campaign launched. ${sent} of ${recipients.length} invitations sent.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function sendSurveyCampaignReminders(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const campaignId = text(data, "campaignId", 100);
    const campaign = await prisma.researchSurveyCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
        status: ResearchSurveyCampaignStatus.ACTIVE,
        publicLink: { status: ResearchPublicLinkStatus.ACTIVE },
        collection: { status: "ACTIVE" },
      },
      include: {
        publicLink: true,
        collection: { include: { questionnaire: true } },
        invitations: {
          where: {
            status: {
              in: [
                ResearchSurveyInvitationStatus.SENT,
                ResearchSurveyInvitationStatus.OPENED,
              ],
            },
          },
        },
      },
    });
    if (!campaign) throw new Error("Active campaign not found.");
    const reminderCutoff = new Date(Date.now() - 86_400_000);
    const eligible = campaign.invitations.filter(
      (item) =>
        item.remindersSent < campaign.reminderLimit &&
        (!item.lastReminderAt || item.lastReminderAt < reminderCutoff),
    );
    const base = getApplicationUrl();
    let sent = 0;
    for (const invite of eligible) {
      const url = `${base}/survey/${campaign.publicLink.token}?invite=${invite.token}`;
      const title = escapeHtml(campaign.collection.questionnaire.name);
      const result = await sendTenantNotificationEmail({
        to: invite.participantEmail,
        subject: `Reminder: ${campaign.collection.questionnaire.name}`,
        html: `<p>This is a reminder to complete ${title}.</p><p><a href="${url}">Continue to secure questionnaire</a></p>`,
        text: `Complete the questionnaire: ${url}`,
      });
      if (result.success) {
        await prisma.researchSurveyInvitation.update({
          where: { id: invite.id },
          data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
        });
        sent++;
      }
    }
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.SYSTEM,
      entityType: "ResearchSurveyCampaign",
      entityId: campaign.id,
      title: "Research campaign reminders sent",
      description: `${sent} reminders delivered`,
      metadata: { collectionId: campaign.collectionId },
    });
    refresh(campaign.collectionId);
    return {
      status: "SUCCESS",
      message: `${sent} reminder${sent === 1 ? "" : "s"} sent.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function changeSurveyCampaignStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const campaignId = text(data, "campaignId", 100);
    const target = text(data, "status", 30) as ResearchSurveyCampaignStatus;
    const campaign = await prisma.researchSurveyCampaign.findFirst({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) throw new Error("Campaign not found.");
    const allowed: Partial<
      Record<ResearchSurveyCampaignStatus, ResearchSurveyCampaignStatus[]>
    > = {
      ACTIVE: [
        ResearchSurveyCampaignStatus.PAUSED,
        ResearchSurveyCampaignStatus.CLOSED,
        ResearchSurveyCampaignStatus.CANCELLED,
      ],
      PAUSED: [
        ResearchSurveyCampaignStatus.ACTIVE,
        ResearchSurveyCampaignStatus.CLOSED,
        ResearchSurveyCampaignStatus.CANCELLED,
      ],
    };
    if (!(allowed[campaign.status] ?? []).includes(target))
      throw new Error(
        `Campaign cannot move from ${campaign.status} to ${target}.`,
      );
    await prisma.researchSurveyCampaign.update({
      where: { id: campaign.id },
      data: {
        status: target,
        closedAt:
          target === ResearchSurveyCampaignStatus.CLOSED ? new Date() : null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSurveyCampaign",
      entityId: campaign.id,
      title: "Research campaign status changed",
      description: `${campaign.status} → ${target}`,
      metadata: { collectionId: campaign.collectionId },
    });
    refresh(campaign.collectionId);
    return { status: "SUCCESS", message: "Campaign status updated." };
  } catch (error) {
    return fail(error);
  }
}

function parseRecipients(raw: string) {
  const unique = new Map<string, { name: string | null; email: string }>();
  for (const line of raw.split(/\r?\n/)) {
    const parts = line.split(",").map((item) => item.trim()),
      email = (parts.length > 1 ? parts.at(-1) : parts[0])?.toLowerCase() ?? "";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      unique.set(email, {
        name:
          parts.length > 1
            ? parts.slice(0, -1).join(" ").slice(0, 160) || null
            : null,
        email,
      });
  }
  return [...unique.values()];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
