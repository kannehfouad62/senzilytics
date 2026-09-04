"use server";

import { createHash, randomBytes } from "node:crypto";

import {
  ActivityAction,
  ConfigurableFormModule,
  Prisma,
  ResearchCampaignQuotaStatus,
  ResearchCollectionStatus,
  ResearchPublicLinkStatus,
  ResearchResponseIdentityMode,
} from "@prisma/client";
import { cookies } from "next/headers";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import { preparePublishedFormVersionSubmission } from "@/modules/forms/runtime-form.service";
import { isPanelMemberEligible } from "@/modules/research/research-panel-governance";
import { normalizeResearchLocale } from "@/modules/research/research-localization";
import {
  calculateResponseIntegrity,
  resumeCookieName,
} from "@/modules/research/research-response-integrity";
import {
  evaluateScreeningAnswer,
  screeningCookieName,
} from "@/modules/research/research-screening";

const value = (data: FormData, key: string, max = 300) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function submitPublicResearchScreening(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    const token = value(data, "token", 100);
    const invitationToken = value(data, "invitationToken", 100) || null;
    const link = await prisma.researchPublicSurveyLink.findUnique({
      where: { token },
      include: {
        collection: true,
        screeningField: true,
      },
    });
    if (
      !link ||
      link.status !== ResearchPublicLinkStatus.ACTIVE ||
      link.collection.status !== ResearchCollectionStatus.ACTIVE ||
      !link.screeningFieldId ||
      !link.screeningField ||
      link.screeningField.versionId !== link.collection.formVersionId
    )
      throw new Error("Screening is not available for this questionnaire.");
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
      throw new Error("This invitation is no longer active.");
    const supplied = data
      .getAll("screeningAnswer")
      .map((item) => String(item).trim().slice(0, 500))
      .filter(Boolean);
    if (!supplied.length) throw new Error("Answer the screening question.");
    const answer = supplied.length === 1 ? supplied[0] : supplied;
    const allowedValues = Array.isArray(link.screeningAllowedValues)
      ? link.screeningAllowedValues.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    const eligible = evaluateScreeningAnswer(answer, allowedValues);
    const accessToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Math.min(
        link.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
        Date.now() + 24 * 60 * 60 * 1000,
      ),
    );
    await prisma.$transaction(async (tx) => {
      if (invitation) {
        const prior = await tx.researchSurveyScreeningRecord.findUnique({
          where: { invitationId: invitation.id },
        });
        if (prior)
          throw new Error("This invitation has already been screened.");
      }
      await tx.researchSurveyScreeningRecord.create({
        data: {
          organizationId: link.organizationId,
          publicLinkId: link.id,
          invitationId: invitation?.id ?? null,
          accessTokenHash: tokenHash(accessToken),
          fieldId: link.screeningFieldId!,
          answer,
          outcome: eligible ? "ELIGIBLE" : "DISQUALIFIED",
          expiresAt,
        },
      });
      if (invitation && !eligible)
        await tx.researchSurveyInvitation.update({
          where: { id: invitation.id },
          data: { status: "DISQUALIFIED" },
        });
    });
    const jar = await cookies();
    jar.set(screeningCookieName(token), accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: `/survey/${token}`,
      expires: expiresAt,
    });
    await logActivity({
      organizationId: link.organizationId,
      userId: null,
      action: ActivityAction.CREATE,
      entityType: "ResearchSurveyScreeningRecord",
      title: "Public research screening completed",
      description: eligible
        ? "Participant eligible"
        : "Participant disqualified",
      metadata: { publicLinkId: link.id, invitationId: invitation?.id ?? null },
    });
    return {
      status: "SUCCESS",
      message: eligible
        ? "Screening complete. The questionnaire is ready."
        : link.disqualificationMessage ||
          "Thank you. You are not eligible for this questionnaire.",
    };
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Screening could not be completed.",
    };
  }
}

export async function savePublicResearchSurveyDraft(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  try {
    const token = value(data, "token", 100);
    const invitationToken = value(data, "invitationToken", 100) || null;
    const link = await prisma.researchPublicSurveyLink.findUnique({
      where: { token },
      include: { collection: true },
    });
    if (
      !link ||
      !link.allowSaveResume ||
      link.status !== ResearchPublicLinkStatus.ACTIVE ||
      link.collection.status !== ResearchCollectionStatus.ACTIVE
    )
      throw new Error("Save and resume is not available for this survey.");
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
      throw new Error("This invitation is no longer active.");
    const jar = await cookies();
    if (link.screeningFieldId) {
      const screeningToken = jar.get(screeningCookieName(token))?.value;
      const eligible = screeningToken
        ? await prisma.researchSurveyScreeningRecord.findFirst({
            where: {
              accessTokenHash: tokenHash(screeningToken),
              publicLinkId: link.id,
              invitationId: invitation?.id ?? null,
              outcome: "ELIGIBLE",
              expiresAt: { gt: new Date() },
            },
          })
        : null;
      if (!eligible) throw new Error("Complete eligibility screening first.");
    }
    const answers: Record<string, string | string[]> = {};
    for (const key of new Set(data.keys())) {
      if (!key.startsWith("custom_") || Object.keys(answers).length >= 200)
        continue;
      const values = data
        .getAll(key)
        .map((item) => String(item).slice(0, 10_000));
      answers[key] = values.length > 1 ? values : (values[0] ?? "");
    }
    const identity = {
      participantName: value(data, "participantName", 160) || null,
      participantEmail:
        value(data, "participantEmail", 254).toLowerCase() || null,
      pseudonymousReference: value(data, "pseudonymousReference", 160) || null,
    };
    const cookieName = resumeCookieName(token);
    const existingToken = jar.get(cookieName)?.value;
    const existing = existingToken
      ? await prisma.researchPublicSurveySession.findFirst({
          where: {
            resumeTokenHash: tokenHash(existingToken),
            publicLinkId: link.id,
            invitationId: invitation?.id ?? null,
            completedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      : null;
    const resumeToken = existingToken || randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (existing) {
      await prisma.researchPublicSurveySession.update({
        where: { id: existing.id },
        data: { answers, identity, expiresAt },
      });
    } else {
      await prisma.researchPublicSurveySession.create({
        data: {
          organizationId: link.organizationId,
          publicLinkId: link.id,
          invitationId: invitation?.id ?? null,
          resumeTokenHash: tokenHash(resumeToken),
          formVersionId: link.collection.formVersionId,
          answers,
          identity,
          expiresAt,
        },
      });
    }
    jar.set(cookieName, resumeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: `/survey/${token}`,
      expires: expiresAt,
    });
    return {
      status: "SUCCESS",
      message: "Progress saved securely on this device for 30 days.",
    };
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error ? error.message : "Progress was not saved.",
    };
  }
}

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
      include: {
        collection: {
          include: {
            questionnaire: true,
            formVersion: {
              include: {
                researchQuestionnaireLocalizations: {
                  where: { status: "APPROVED" },
                  select: { locale: true },
                },
              },
            },
          },
        },
      },
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
          include: { panelMember: true },
        })
      : null;
    if (invitationToken && !invitation)
      throw new Error(
        "This invitation is invalid, completed, or no longer active.",
      );
    if (
      invitation?.panelMember &&
      !isPanelMemberEligible(
        invitation.panelMember.status,
        invitation.panelMember.consentExpiresAt,
      )
    )
      throw new Error(
        "This participant is no longer eligible for this questionnaire.",
      );

    const now = new Date();
    const jar = await cookies();
    if (link.screeningFieldId) {
      const screeningToken = jar.get(screeningCookieName(token))?.value;
      const eligible = screeningToken
        ? await prisma.researchSurveyScreeningRecord.findFirst({
            where: {
              accessTokenHash: tokenHash(screeningToken),
              publicLinkId: link.id,
              invitationId: invitation?.id ?? null,
              outcome: "ELIGIBLE",
              expiresAt: { gt: now },
            },
          })
        : null;
      if (!eligible) throw new Error("Complete eligibility screening first.");
    }
    const resumeToken = jar.get(resumeCookieName(token))?.value;
    const resumedSession = resumeToken
      ? await prisma.researchPublicSurveySession.findFirst({
          where: {
            resumeTokenHash: tokenHash(resumeToken),
            publicLinkId: link.id,
            invitationId: invitation?.id ?? null,
            formVersionId: link.collection.formVersionId,
            completedAt: null,
            expiresAt: { gt: now },
          },
        })
      : null;
    const collection = link.collection;
    const defaultLocale =
      normalizeResearchLocale(collection.questionnaire.defaultLanguage) ?? "en";
    const responseLocale = normalizeResearchLocale(value(data, "locale", 20));
    if (
      !responseLocale ||
      (responseLocale !== defaultLocale &&
        !collection.formVersion.researchQuestionnaireLocalizations.some(
          (item) => item.locale === responseLocale,
        ))
    )
      throw new Error("Select an approved questionnaire language.");
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
    const integrity = calculateResponseIntegrity({
      startedAt: resumedSession?.startedAt ?? invitation?.openedAt ?? now,
      submittedAt: now,
      minimumCompletionSeconds: link.minimumCompletionSeconds,
      answerCount: prepared.answers.length,
    });

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
              include: {
                panelMember: true,
                quota: {
                  include: {
                    invitations: {
                      where: { status: "COMPLETED" },
                      select: { id: true },
                    },
                  },
                },
              },
            })
          : null;
        if (invitation && !currentInvitation)
          throw new Error("This invitation has already been used or revoked.");
        if (
          currentInvitation?.panelMember &&
          !isPanelMemberEligible(
            currentInvitation.panelMember.status,
            currentInvitation.panelMember.consentExpiresAt,
            now,
          )
        )
          throw new Error(
            "This participant is no longer eligible for this questionnaire.",
          );
        if (
          currentInvitation?.quota &&
          (currentInvitation.quota.status !==
            ResearchCampaignQuotaStatus.OPEN ||
            currentInvitation.quota.invitations.length >=
              currentInvitation.quota.target)
        )
          throw new Error("This participant quota has already been filled.");
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
            locale: responseLocale,
            consentedAt: collection.questionnaire.consentStatement ? now : null,
            invitationId: currentInvitation?.id ?? null,
            completionSeconds:
              resumedSession || invitation?.openedAt
                ? integrity.completionSeconds
                : null,
            integrityStatus:
              resumedSession || invitation?.openedAt
                ? integrity.status
                : "CLEAR",
            integrityFlags:
              resumedSession || invitation?.openedAt ? integrity.flags : [],
            resumedSessionId: resumedSession?.id ?? null,
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
        if (currentInvitation) {
          await tx.researchSurveyInvitation.update({
            where: { id: currentInvitation.id },
            data: { status: "COMPLETED", completedAt: now },
          });
          if (
            currentInvitation.quota &&
            currentInvitation.quota.invitations.length + 1 >=
              currentInvitation.quota.target
          ) {
            await tx.researchCampaignQuota.update({
              where: { id: currentInvitation.quota.id },
              data: {
                status: ResearchCampaignQuotaStatus.FILLED,
                filledAt: now,
              },
            });
          }
        }
        if (resumedSession)
          await tx.researchPublicSurveySession.update({
            where: { id: resumedSession.id },
            data: { completedAt: now },
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
        integrityStatus:
          resumedSession || invitation?.openedAt ? integrity.status : "CLEAR",
        integrityFlags:
          resumedSession || invitation?.openedAt ? integrity.flags : [],
      },
    });
    if (resumeToken) jar.delete(resumeCookieName(token));
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
