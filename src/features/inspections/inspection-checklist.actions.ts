"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addInspectionChecklistQuestionService,
  addInspectionChecklistSectionService,
  createInspectionChecklistTemplateService,
  deleteInspectionChecklistQuestionService,
  toggleInspectionChecklistTemplateService,
} from "@/modules/inspection/inspection-checklist.service";
import {
  InspectionQuestionType,
  InspectionType,
  PermissionKey,
} from "@prisma/client";
import { redirect } from "next/navigation";

function getRequiredString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) || ""
  ).trim();

  if (!value) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return value;
}

function getOptionalString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) || ""
  ).trim();

  return value || null;
}

function isInspectionType(
  value: string
): value is InspectionType {
  return Object.values(
    InspectionType
  ).includes(
    value as InspectionType
  );
}

function isInspectionQuestionType(
  value: string
): value is InspectionQuestionType {
  return Object.values(
    InspectionQuestionType
  ).includes(
    value as InspectionQuestionType
  );
}

export async function createInspectionChecklistTemplate(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionType =
    getRequiredString(
      formData,
      "inspectionType"
    );

  if (
    !isInspectionType(
      inspectionType
    )
  ) {
    throw new Error(
      "A valid inspection type is required."
    );
  }

  const template =
    await createInspectionChecklistTemplateService({
      organizationId,
      userId: user.id,
      name: getRequiredString(
        formData,
        "name"
      ),
      description:
        getOptionalString(
          formData,
          "description"
        ),
      inspectionType,
    });

  redirect(
    `/inspections/checklists/${template.id}`
  );
}

export async function addInspectionChecklistSection(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const templateId =
    getRequiredString(
      formData,
      "templateId"
    );

  await addInspectionChecklistSectionService({
    organizationId,
    userId: user.id,
    templateId,
    name: getRequiredString(
      formData,
      "name"
    ),
    description:
      getOptionalString(
        formData,
        "description"
      ),
  });

  redirect(
    `/inspections/checklists/${templateId}`
  );
}

export async function addInspectionChecklistQuestion(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const templateId =
    getRequiredString(
      formData,
      "templateId"
    );

  const questionType =
    getRequiredString(
      formData,
      "questionType"
    );

  if (
    !isInspectionQuestionType(
      questionType
    )
  ) {
    throw new Error(
      "A valid inspection question type is required."
    );
  }

  const weight =
    Number(
      getRequiredString(
        formData,
        "weight"
      )
    );

  if (
    !Number.isInteger(weight) ||
    weight < 1
  ) {
    throw new Error(
      "Question weight must be a positive whole number."
    );
  }

  await addInspectionChecklistQuestionService({
    organizationId,
    userId: user.id,
    templateId,
    sectionId:
      getRequiredString(
        formData,
        "sectionId"
      ),
    questionText:
      getRequiredString(
        formData,
        "questionText"
      ),
    guidance:
      getOptionalString(
        formData,
        "guidance"
      ),
    questionType,
    isRequired:
      formData.get(
        "isRequired"
      ) === "on",
    weight,
  });

  redirect(
    `/inspections/checklists/${templateId}`
  );
}

export async function toggleInspectionChecklistTemplate(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const templateId =
    getRequiredString(
      formData,
      "templateId"
    );

  await toggleInspectionChecklistTemplateService({
    organizationId,
    userId: user.id,
    templateId,
  });

  redirect(
    `/inspections/checklists/${templateId}`
  );
}

export async function deleteInspectionChecklistQuestion(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const templateId =
    getRequiredString(
      formData,
      "templateId"
    );

  await deleteInspectionChecklistQuestionService({
    organizationId,
    userId: user.id,
    templateId,
    questionId:
      getRequiredString(
        formData,
        "questionId"
      ),
  });

  redirect(
    `/inspections/checklists/${templateId}`
  );
}