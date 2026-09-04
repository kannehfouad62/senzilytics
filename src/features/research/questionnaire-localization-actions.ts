"use server";

import { ActivityAction, PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  normalizeResearchLocale,
  type ResearchFieldTranslations,
} from "@/modules/research/research-localization";

const text = (data: FormData, key: string, max: number) =>
  String(data.get(key) ?? "").trim().slice(0, max);

const result = (error: unknown): FormActionState => ({
  status: "ERROR",
  message:
    error instanceof Error ? error.message : "Localization could not be saved.",
});

function refresh(collectionId: string) {
  revalidatePath("/research", "layout");
  revalidatePath(`/research/collections/${collectionId}`);
}

export async function saveQuestionnaireLocalization(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.DESIGN_RESEARCH_QUESTIONNAIRES);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const collectionId = text(data, "collectionId", 100);
    const locale = normalizeResearchLocale(text(data, "locale", 20));
    const languageName = text(data, "languageName", 80);
    if (!locale) throw new Error("Enter a valid language code, such as fr or es-mx.");
    if (languageName.length < 2) throw new Error("Enter the language name.");
    const collection = await prisma.researchCollectionWave.findFirst({
      where: { id: collectionId, organizationId },
      include: {
        questionnaire: true,
        formVersion: {
          include: { fields: { orderBy: { sequence: "asc" } } },
        },
      },
    });
    if (!collection) throw new Error("Research collection wave not found.");
    if (locale === normalizeResearchLocale(collection.questionnaire.defaultLanguage))
      throw new Error("Use a language code different from the questionnaire default.");

    const fieldTranslations: ResearchFieldTranslations = {};
    for (const field of collection.formVersion.fields) {
      const options = Array.isArray(field.options)
        ? field.options.filter((item): item is string => typeof item === "string")
        : [];
      const optionTranslations = Object.fromEntries(
        options
          .map((option, index) => [option, text(data, `option_${field.id}_${index}`, 500)] as const)
          .filter((entry) => entry[1]),
      );
      const translation = {
        label: text(data, `label_${field.id}`, 500),
        description: text(data, `description_${field.id}`, 1000),
        placeholder: text(data, `placeholder_${field.id}`, 500),
        options: optionTranslations,
      };
      if (
        translation.label ||
        translation.description ||
        translation.placeholder ||
        Object.keys(optionTranslations).length
      )
        fieldTranslations[field.id] = translation;
    }
    const questionnaireName = text(data, "questionnaireName", 200);
    const purpose = text(data, "purpose", 4000);
    if (!questionnaireName || !purpose)
      throw new Error("Translated questionnaire name and purpose are required.");
    const localization = await prisma.researchQuestionnaireLocalization.upsert({
      where: {
        formVersionId_locale: { formVersionId: collection.formVersionId, locale },
      },
      create: {
        organizationId,
        questionnaireId: collection.questionnaireId,
        formVersionId: collection.formVersionId,
        locale,
        languageName,
        questionnaireName,
        purpose,
        consentStatement: text(data, "consentStatement", 6000) || null,
        instructions: text(data, "instructions", 4000) || null,
        fieldTranslations,
        createdById: user.id,
      },
      update: {
        languageName,
        questionnaireName,
        purpose,
        consentStatement: text(data, "consentStatement", 6000) || null,
        instructions: text(data, "instructions", 4000) || null,
        fieldTranslations,
        status: "DRAFT",
        approvedById: null,
        approvedAt: null,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.UPDATE,
      entityType: "ResearchQuestionnaireLocalization",
      entityId: localization.id,
      title: "Questionnaire localization saved as draft",
      description: `${languageName} (${locale}) · version ${collection.formVersion.version}`,
      metadata: { collectionId, questionnaireId: collection.questionnaireId, locale },
    });
    refresh(collectionId);
    return { status: "SUCCESS", message: "Localization saved as draft for review." };
  } catch (error) {
    return result(error);
  }
}

export async function changeQuestionnaireLocalizationStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.PUBLISH_RESEARCH_QUESTIONNAIRES);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const collectionId = text(data, "collectionId", 100);
    const localizationId = text(data, "localizationId", 100);
    const target = text(data, "status", 20);
    if (!(["APPROVED", "ARCHIVED"] as string[]).includes(target))
      throw new Error("Select a valid localization status.");
    const localization = await prisma.researchQuestionnaireLocalization.findFirst({
      where: {
        id: localizationId,
        organizationId,
        formVersion: { researchCollectionWaves: { some: { id: collectionId, organizationId } } },
      },
    });
    if (!localization) throw new Error("Questionnaire localization not found.");
    if (target === "APPROVED" && localization.status !== "DRAFT")
      throw new Error("Only a draft localization can be approved.");
    if (target === "ARCHIVED" && localization.status === "ARCHIVED")
      throw new Error("This localization is already archived.");
    await prisma.researchQuestionnaireLocalization.update({
      where: { id: localization.id },
      data: {
        status: target as "APPROVED" | "ARCHIVED",
        approvedById: target === "APPROVED" ? user.id : localization.approvedById,
        approvedAt: target === "APPROVED" ? new Date() : localization.approvedAt,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchQuestionnaireLocalization",
      entityId: localization.id,
      title: "Questionnaire localization status changed",
      description: `${localization.status} → ${target} · ${localization.languageName}`,
      metadata: { collectionId, locale: localization.locale },
    });
    refresh(collectionId);
    return { status: "SUCCESS", message: `Localization ${target.toLowerCase()}.` };
  } catch (error) {
    return result(error);
  }
}
