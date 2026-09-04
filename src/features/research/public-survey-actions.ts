"use server";

import {
  ActivityAction,
  ConfigurableFormModule,
  Prisma,
  ResearchCollectionStatus,
  ResearchPublicLinkStatus,
  ResearchResponseIdentityMode,
} from "@prisma/client";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import { preparePublishedFormVersionSubmission } from "@/modules/forms/runtime-form.service";

const value = (data: FormData, key: string, max = 300) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);

export async function submitPublicResearchSurvey(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    if (value(data, "website", 200)) {
      return {
        status: "SUCCESS",
        message: "Thank you. Your response has been received.",
      };
    }
    const token = value(data, "token", 100);
    const invitationToken = value(data, "invitationToken", 100) || null;
    const link = await prisma.researchPublicSurveyLink.findUnique({
      where: { token },
      include: { collection: { include: { questionnaire: true } } },
    });
    if (!link || link.status !== ResearchPublicLinkStatus.ACTIVE) {
      throw new Error("This public survey link is not available.");
    }
    const invitation = invitationToken
      ? await prisma.researchSurveyInvitation.findFirst({
          where: {
            token: invitationToken,
            campaign: { publicLinkId: link.id, status: "ACTIVE" },
            status: { in: ["SENT", "OPENED"] },
          },
        })
      : null;
    if (invitationToken && !invitation)
      throw new Error(
        "This invitation is invalid, completed, or no longer active.",
      );

    const now = new Date();
    const collection = link.collection;
    if (collection.status !== ResearchCollectionStatus.ACTIVE) {
      throw new Error("This survey is not currently accepting responses.");
    }
    if (collection.opensAt && collection.opensAt > now)
      throw new Error("This survey has not opened yet.");
    if (collection.closesAt && collection.closesAt < now)
      throw new Error("This survey has closed.");
    if (link.expiresAt && link.expiresAt < now)
      throw new Error("This public survey link has expired.");
    if (
      collection.questionnaire.consentStatement &&
      data.get("participantConsent") !== "on"
    ) {
      throw new Error("Participant consent is required.");
    }

    const identityMode = collection.questionnaire.identityMode;
    const participantName = value(data, "participantName", 160) || null;
    const participantEmail =
      value(data, "participantEmail", 254).toLowerCase() || null;
    const pseudonymousReference =
      value(data, "pseudonymousReference", 160) || null;
    if (identityMode === ResearchResponseIdentityMode.IDENTIFIED) {
      if (!participantName || !participantEmail)
        throw new Error("Name and email are required for this survey.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participantEmail))
        throw new Error("Enter a valid email address.");
      if (
        invitation &&
        participantEmail !== invitation.participantEmail.toLowerCase()
      )
        throw new Error(
          "Use the email address associated with this invitation.",
        );
    }
    if (
      identityMode === ResearchResponseIdentityMode.PSEUDONYMIZED &&
      !pseudonymousReference
    ) {
      throw new Error("Participant reference is required for this survey.");
    }

    const prepared = await preparePublishedFormVersionSubmission({
      organizationId: link.organizationId,
      definitionId: collection.questionnaire.formDefinitionId,
      versionId: collection.formVersionId,
      module: ConfigurableFormModule.RESEARCH,
      data,
    });
    if (prepared.status !== "SUBMITTED") {
      throw new Error(
        "Questionnaires with required file fields are not supported by public links.",
      );
    }

    const response = await prisma.$transaction(
      async (tx) => {
        const current = await tx.researchPublicSurveyLink.findUnique({
          where: { id: link.id },
          include: {
            collection: true,
            _count: { select: { responses: true } },
          },
        });
        if (!current || current.status !== ResearchPublicLinkStatus.ACTIVE) {
          throw new Error("This public survey link is not available.");
        }
        if (
          current.collection.status !== ResearchCollectionStatus.ACTIVE ||
          Boolean(current.expiresAt && current.expiresAt < now) ||
          Boolean(
            current.collection.opensAt && current.collection.opensAt > now,
          ) ||
          Boolean(
            current.collection.closesAt && current.collection.closesAt < now,
          )
        ) {
          throw new Error("This survey is not currently accepting responses.");
        }
        const currentInvitation = invitation
          ? await tx.researchSurveyInvitation.findFirst({
              where: {
                id: invitation.id,
                campaign: { publicLinkId: current.id, status: "ACTIVE" },
                status: { in: ["SENT", "OPENED"] },
              },
            })
          : null;
        if (invitation && !currentInvitation)
          throw new Error("This invitation has already been used or revoked.");
        if (
          current.maxResponses !== null &&
          current._count.responses >= current.maxResponses
        ) {
          throw new Error("This survey link has reached its response limit.");
        }

        const created = await tx.researchPublicResponse.create({
          data: {
            organizationId: link.organizationId,
            collectionId: collection.id,
            publicLinkId: link.id,
            participantName:
              identityMode === ResearchResponseIdentityMode.IDENTIFIED
                ? participantName
                : null,
            participantEmail:
              identityMode === ResearchResponseIdentityMode.IDENTIFIED
                ? participantEmail
                : null,
            pseudonymousReference:
              identityMode === ResearchResponseIdentityMode.PSEUDONYMIZED
                ? pseudonymousReference
                : null,
            consentedAt: collection.questionnaire.consentStatement ? now : null,
            invitationId: currentInvitation?.id ?? null,
          },
        });
        const submission = await tx.configurableFormSubmission.create({
          data: {
            organizationId: link.organizationId,
            definitionId: prepared.definitionId,
            versionId: prepared.versionId,
            entityType: ConfigurableFormModule.RESEARCH,
            entityId: created.id,
            submittedById: null,
            status: prepared.status,
            answers: { create: prepared.answers },
          },
        });
        const completed = await tx.researchPublicResponse.update({
          where: { id: created.id },
          data: { submissionId: submission.id },
        });
        if (currentInvitation)
          await tx.researchSurveyInvitation.update({
            where: { id: currentInvitation.id },
            data: { status: "COMPLETED", completedAt: now },
          });
        return completed;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await logActivity({
      organizationId: link.organizationId,
      userId: null,
      action: ActivityAction.CREATE,
      entityType: "ResearchPublicResponse",
      entityId: response.id,
      title: "Public research questionnaire submitted",
      description: collection.questionnaire.name,
      metadata: {
        collectionId: collection.id,
        publicLinkId: link.id,
        identityMode,
        invitationId: invitation?.id ?? null,
      },
    });
    return {
      status: "SUCCESS",
      message: "Thank you. Your response has been securely submitted.",
    };
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Your response could not be submitted.",
    };
  }
}
