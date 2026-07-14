"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addAuditChecklistQuestionService,
  addAuditChecklistSectionService,
  createAuditChecklistTemplateService,
  deleteAuditChecklistQuestionService,
  toggleAuditChecklistTemplateService,
} from "@/modules/audit/audit-checklist.service";
import {
  AuditQuestionType,
  AuditType,
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

function isAuditType(
  value: string
): value is AuditType {
  return Object.values(
    AuditType
  ).includes(value as AuditType);
}

function isAuditQuestionType(
  value: string
): value is AuditQuestionType {
  return Object.values(
    AuditQuestionType
  ).includes(
    value as AuditQuestionType
  );
}

export async function createAuditChecklistTemplate(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const auditType =
    getRequiredString(
      formData,
      "auditType"
    );

  if (!isAuditType(auditType)) {
    throw new Error(
      "A valid audit type is required."
    );
  }

  const template =
    await createAuditChecklistTemplateService({
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
      auditType,
    });

  redirect(
    `/audits/checklists/${template.id}`
  );
}

export async function addAuditChecklistSection(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
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

  await addAuditChecklistSectionService({
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
    `/audits/checklists/${templateId}`
  );
}

export async function addAuditChecklistQuestion(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
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
    !isAuditQuestionType(
      questionType
    )
  ) {
    throw new Error(
      "A valid question type is required."
    );
  }

  const weightValue =
    Number(
      getRequiredString(
        formData,
        "weight"
      )
    );

  if (
    !Number.isInteger(
      weightValue
    ) ||
    weightValue < 1
  ) {
    throw new Error(
      "Question weight must be a positive whole number."
    );
  }

  await addAuditChecklistQuestionService({
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
    weight: weightValue,
  });

  redirect(
    `/audits/checklists/${templateId}`
  );
}

export async function toggleAuditChecklistTemplate(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
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

  await toggleAuditChecklistTemplateService({
    organizationId,
    userId: user.id,
    templateId,
  });

  redirect(
    `/audits/checklists/${templateId}`
  );
}

export async function deleteAuditChecklistQuestion(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
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

  await deleteAuditChecklistQuestionService({
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
    `/audits/checklists/${templateId}`
  );
}