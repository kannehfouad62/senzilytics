"use server";

import { requirePermission } from "@/lib/permissions";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addInspectionTeamMemberService,
  createInspectionFindingService,
  createInspectionService,
  removeInspectionTeamMemberService,
  updateInspectionFindingStatusService,
  updateInspectionStatusService,
} from "@/modules/inspection/inspection.service";
import {
  ConfigurableFormModule,
  InspectionTeamRole,
  InspectionType,
  PermissionKey,
  RiskLevel,
  Status,
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

function getOptionalDate(
  formData: FormData,
  fieldName: string
) {
  const rawValue =
    getOptionalString(
      formData,
      fieldName
    );

  if (!rawValue) {
    return null;
  }

  const value =
    new Date(rawValue);

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    throw new Error(
      `${fieldName} must contain a valid date.`
    );
  }

  return value;
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

function isInspectionTeamRole(
  value: string
): value is InspectionTeamRole {
  return Object.values(
    InspectionTeamRole
  ).includes(
    value as InspectionTeamRole
  );
}

function isRiskLevel(
  value: string
): value is RiskLevel {
  return Object.values(
    RiskLevel
  ).includes(
    value as RiskLevel
  );
}

function isStatus(
  value: string
): value is Status {
  return Object.values(
    Status
  ).includes(value as Status);
}

export type InspectionCreateState = {
  error: string | null;
};

export async function createInspection(
  _state: InspectionCreateState,
  formData: FormData
): Promise<InspectionCreateState> {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  let inspectionId: string;

  try {
    const inspectionType =
      getRequiredString(
        formData,
        "type"
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

    const customSubmissions =
      await preparePublishedFormSubmissions({
        organizationId,
        module:
          ConfigurableFormModule.INSPECTION,
        data: formData,
      });

    const inspection =
      await createInspectionService({
        organizationId,
        userId: user.id,
        title:
          getRequiredString(
            formData,
            "title"
          ),
        reference:
          getOptionalString(
            formData,
            "reference"
          ),
        description:
          getOptionalString(
            formData,
            "description"
          ),
        area:
          getOptionalString(
            formData,
            "area"
          ),
        type: inspectionType,
        siteId:
          getRequiredString(
            formData,
            "siteId"
          ),
        scheduledAt:
          getOptionalDate(
            formData,
            "scheduledAt"
          ),
        dueDate:
          getOptionalDate(
            formData,
            "dueDate"
          ),
        leadInspectorId:
          getOptionalString(
            formData,
            "leadInspectorId"
          ),
        checklistTemplateId:
          getOptionalString(
            formData,
            "checklistTemplateId"
          ),
        customSubmissions,
      });

    inspectionId = inspection.id;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The inspection could not be created.",
    };
  }

  redirect(
    `/inspections/${inspectionId}`
  );
}

export async function updateInspectionStatus(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionId =
    getRequiredString(
      formData,
      "inspectionId"
    );

  const statusValue =
    getRequiredString(
      formData,
      "status"
    );

  if (!isStatus(statusValue)) {
    throw new Error(
      "A valid inspection status is required."
    );
  }

  await updateInspectionStatusService({
    organizationId,
    userId: user.id,
    inspectionId,
    status: statusValue,
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}

export async function addInspectionTeamMember(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionId =
    getRequiredString(
      formData,
      "inspectionId"
    );

  const teamRole =
    getRequiredString(
      formData,
      "teamRole"
    );

  if (
    !isInspectionTeamRole(
      teamRole
    )
  ) {
    throw new Error(
      "A valid inspection team role is required."
    );
  }

  await addInspectionTeamMemberService({
    organizationId,
    userId: user.id,
    inspectionId,
    teamMemberId:
      getRequiredString(
        formData,
        "teamMemberId"
      ),
    teamRole,
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}

export async function removeInspectionTeamMember(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionId =
    getRequiredString(
      formData,
      "inspectionId"
    );

  await removeInspectionTeamMemberService({
    organizationId,
    userId: user.id,
    inspectionId,
    teamMemberId:
      getRequiredString(
        formData,
        "teamMemberId"
      ),
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}

export async function createInspectionFinding(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionId =
    getRequiredString(
      formData,
      "inspectionId"
    );

  const riskLevel =
    getRequiredString(
      formData,
      "riskLevel"
    );

  if (
    !isRiskLevel(
      riskLevel
    )
  ) {
    throw new Error(
      "A valid risk level is required."
    );
  }

  await createInspectionFindingService({
    organizationId,
    userId: user.id,
    inspectionId,
    title:
      getRequiredString(
        formData,
        "title"
      ),
    description:
      getOptionalString(
        formData,
        "description"
      ),
    riskLevel,
    dueDate:
      getOptionalDate(
        formData,
        "dueDate"
      ),
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}

export async function updateInspectionFindingStatus(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionId =
    getRequiredString(
      formData,
      "inspectionId"
    );

  const status =
    getRequiredString(
      formData,
      "status"
    );

  if (!isStatus(status)) {
    throw new Error(
      "A valid finding status is required."
    );
  }

  await updateInspectionFindingStatusService({
    organizationId,
    userId: user.id,
    inspectionId,
    findingId:
      getRequiredString(
        formData,
        "findingId"
      ),
    status,
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}
