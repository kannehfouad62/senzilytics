"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import type {
  FormActionState,
} from "@/core/actions/action-state";
import {
  createMocApprovalService,
  createMocService,
  createMocTaskService,
  decideMocApprovalService,
  linkRiskToMocService,
  transitionMocStatusService,
  unlinkRiskFromMocService,
  updateMocService,
  updateMocTaskService,
} from "@/modules/moc/moc.service";
import {
  ConfigurableFormModule,
  MocApprovalRole,
  MocApprovalStatus,
  MocChangeDuration,
  MocChangeType,
  MocPriority,
  MocStatus,
  MocTaskStatus,
  MocTaskType,
  PermissionKey,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";

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

  const value = new Date(rawValue);

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

function getRequiredInteger(
  formData: FormData,
  fieldName: string
) {
  const value = Number(
    getRequiredString(
      formData,
      fieldName
    )
  );

  if (
    !Number.isInteger(value)
  ) {
    throw new Error(
      `${fieldName} must be a whole number.`
    );
  }

  return value;
}

function getOptionalInteger(
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

  const value = Number(rawValue);

  if (
    !Number.isInteger(value)
  ) {
    throw new Error(
      `${fieldName} must be a whole number.`
    );
  }

  return value;
}

function getBoolean(
  formData: FormData,
  fieldName: string
) {
  const value =
    formData.get(fieldName);

  return (
    value === "true" ||
    value === "on" ||
    value === "1"
  );
}

function isEnumValue<
  T extends Record<string, string>,
>(
  enumObject: T,
  value: string
): value is T[keyof T] {
  return Object.values(
    enumObject
  ).includes(
    value as T[keyof T]
  );
}

export async function createMoc(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  let mocId: string;

  try {

  const changeType =
    getRequiredString(
      formData,
      "changeType"
    );

  const changeDuration =
    getRequiredString(
      formData,
      "changeDuration"
    );

  const priority =
    getRequiredString(
      formData,
      "priority"
    );

  const initialLikelihood =
    getRequiredString(
      formData,
      "initialLikelihood"
    );

  const initialImpact =
    getRequiredString(
      formData,
      "initialImpact"
    );

  const residualLikelihood =
    getRequiredString(
      formData,
      "residualLikelihood"
    );

  const residualImpact =
    getRequiredString(
      formData,
      "residualImpact"
    );

  if (
    !isEnumValue(
      MocChangeType,
      changeType
    ) ||
    !isEnumValue(
      MocChangeDuration,
      changeDuration
    ) ||
    !isEnumValue(
      MocPriority,
      priority
    ) ||
    !isEnumValue(
      RiskLikelihood,
      initialLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      initialImpact
    ) ||
    !isEnumValue(
      RiskLikelihood,
      residualLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      residualImpact
    )
  ) {
    throw new Error(
      "One or more MOC values are invalid."
    );
  }

  const customSubmissions =
    await preparePublishedFormSubmissions({
      organizationId,
      module:
        ConfigurableFormModule.MOC,
      data: formData,
    });

  const moc =
    await createMocService({
      organizationId,
      userId: user.id,

      title:
        getRequiredString(
          formData,
          "title"
        ),

      description:
        getRequiredString(
          formData,
          "description"
        ),

      businessJustification:
        getRequiredString(
          formData,
          "businessJustification"
        ),

      changeType,
      changeDuration,
      priority,

      emergencyJustification:
        getOptionalString(
          formData,
          "emergencyJustification"
        ),

      temporaryExpirationDate:
        getOptionalDate(
          formData,
          "temporaryExpirationDate"
        ),

      affectedProcess:
        getOptionalString(
          formData,
          "affectedProcess"
        ),

      affectedEquipment:
        getOptionalString(
          formData,
          "affectedEquipment"
        ),

      affectedSystems:
        getOptionalString(
          formData,
          "affectedSystems"
        ),

      affectedMaterials:
        getOptionalString(
          formData,
          "affectedMaterials"
        ),

      operationalImpact:
        getOptionalString(
          formData,
          "operationalImpact"
        ),

      regulatoryImpact:
        getOptionalString(
          formData,
          "regulatoryImpact"
        ),

      environmentalImpact:
        getOptionalString(
          formData,
          "environmentalImpact"
        ),

      safetyImpact:
        getOptionalString(
          formData,
          "safetyImpact"
        ),

      qualityImpact:
        getOptionalString(
          formData,
          "qualityImpact"
        ),

      initialLikelihood,
      initialImpact,
      residualLikelihood,
      residualImpact,

      proposedStartDate:
        getOptionalDate(
          formData,
          "proposedStartDate"
        ),

      plannedCompletionDate:
        getOptionalDate(
          formData,
          "plannedCompletionDate"
        ),

      siteId:
        getRequiredString(
          formData,
          "siteId"
        ),

      departmentId:
        getOptionalString(
          formData,
          "departmentId"
        ),

      ownerId:
        getOptionalString(
          formData,
          "ownerId"
        ),
      customSubmissions,
    });

  mocId = moc.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The change request could not be created.",
    };
  }

  redirect(`/moc/${mocId}`);
}

export async function updateMoc(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  const changeType =
    getRequiredString(
      formData,
      "changeType"
    );

  const changeDuration =
    getRequiredString(
      formData,
      "changeDuration"
    );

  const priority =
    getRequiredString(
      formData,
      "priority"
    );

  const residualLikelihood =
    getRequiredString(
      formData,
      "residualLikelihood"
    );

  const residualImpact =
    getRequiredString(
      formData,
      "residualImpact"
    );

  if (
    !isEnumValue(
      MocChangeType,
      changeType
    ) ||
    !isEnumValue(
      MocChangeDuration,
      changeDuration
    ) ||
    !isEnumValue(
      MocPriority,
      priority
    ) ||
    !isEnumValue(
      RiskLikelihood,
      residualLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      residualImpact
    )
  ) {
    throw new Error(
      "One or more MOC values are invalid."
    );
  }

  await updateMocService({
    organizationId,
    userId: user.id,
    mocId,

    title:
      getRequiredString(
        formData,
        "title"
      ),

    description:
      getRequiredString(
        formData,
        "description"
      ),

    businessJustification:
      getRequiredString(
        formData,
        "businessJustification"
      ),

    changeType,
    changeDuration,
    priority,

    emergencyJustification:
      getOptionalString(
        formData,
        "emergencyJustification"
      ),

    temporaryExpirationDate:
      getOptionalDate(
        formData,
        "temporaryExpirationDate"
      ),

    affectedProcess:
      getOptionalString(
        formData,
        "affectedProcess"
      ),

    affectedEquipment:
      getOptionalString(
        formData,
        "affectedEquipment"
      ),

    affectedSystems:
      getOptionalString(
        formData,
        "affectedSystems"
      ),

    affectedMaterials:
      getOptionalString(
        formData,
        "affectedMaterials"
      ),

    operationalImpact:
      getOptionalString(
        formData,
        "operationalImpact"
      ),

    regulatoryImpact:
      getOptionalString(
        formData,
        "regulatoryImpact"
      ),

    environmentalImpact:
      getOptionalString(
        formData,
        "environmentalImpact"
      ),

    safetyImpact:
      getOptionalString(
        formData,
        "safetyImpact"
      ),

    qualityImpact:
      getOptionalString(
        formData,
        "qualityImpact"
      ),

    residualLikelihood,
    residualImpact,

    proposedStartDate:
      getOptionalDate(
        formData,
        "proposedStartDate"
      ),

    plannedCompletionDate:
      getOptionalDate(
        formData,
        "plannedCompletionDate"
      ),

    siteId:
      getRequiredString(
        formData,
        "siteId"
      ),

    departmentId:
      getOptionalString(
        formData,
        "departmentId"
      ),

    ownerId:
      getOptionalString(
        formData,
        "ownerId"
      ),
  });

  redirect(`/moc/${mocId}`);
}

export async function transitionMocStatus(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_MOC
    );

    const {
      organizationId,
      user,
    } =
      await getCurrentUserTenant();

    const mocId =
      getRequiredString(
        formData,
        "mocId"
      );

    const status =
      getRequiredString(
        formData,
        "status"
      );

    if (
      !isEnumValue(
        MocStatus,
        status
      )
    ) {
      return {
        status: "ERROR",
        message:
          "Select a valid MOC status.",
      };
    }

    await transitionMocStatusService({
      organizationId,
      userId: user.id,
      mocId,
      status,

      comments:
        getOptionalString(
          formData,
          "comments"
        ),
    });

    return {
      status: "SUCCESS",
      message:
        `The change was moved to ${status
          .replaceAll("_", " ")
          .toLowerCase()}.`,
    };
  } catch (error) {
    console.error(
      "MOC status transition failed:",
      error
    );

    return {
      status: "ERROR",

      message:
        error instanceof Error
          ? error.message
          : "The change status could not be updated.",
    };
  }
}

export async function createMocApproval(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  const role =
    getRequiredString(
      formData,
      "role"
    );

  if (
    !isEnumValue(
      MocApprovalRole,
      role
    )
  ) {
    throw new Error(
      "A valid approval role is required."
    );
  }

  await createMocApprovalService({
    organizationId,
    userId: user.id,
    mocId,
    role,
    sequence:
      getRequiredInteger(
        formData,
        "sequence"
      ),
    approverId:
      getOptionalString(
        formData,
        "approverId"
      ),
  });

  redirect(`/moc/${mocId}`);
}

export async function decideMocApproval(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  const statusValue =
    getRequiredString(
      formData,
      "status"
    );

  if (
    statusValue !==
      MocApprovalStatus.APPROVED &&
    statusValue !==
      MocApprovalStatus.REJECTED
  ) {
    throw new Error(
      "An approval must be approved or rejected."
    );
  }

  await decideMocApprovalService({
    organizationId,
    userId: user.id,
    mocId,

    approvalId:
      getRequiredString(
        formData,
        "approvalId"
      ),

    status: statusValue,

    comments:
      getOptionalString(
        formData,
        "comments"
      ),
  });

  redirect(`/moc/${mocId}`);
}

export async function createMocTask(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  const taskType =
    getRequiredString(
      formData,
      "taskType"
    );

  if (
    !isEnumValue(
      MocTaskType,
      taskType
    )
  ) {
    throw new Error(
      "A valid MOC task type is required."
    );
  }

  await createMocTaskService({
    organizationId,
    userId: user.id,
    mocId,

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

    taskType,

    sequence:
      getOptionalInteger(
        formData,
        "sequence"
      ),

    isRequired:
      getBoolean(
        formData,
        "isRequired"
      ),

    assignedToId:
      getOptionalString(
        formData,
        "assignedToId"
      ),

    dueDate:
      getOptionalDate(
        formData,
        "dueDate"
      ),
  });

  redirect(`/moc/${mocId}`);
}

export async function updateMocTask(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  const status =
    getRequiredString(
      formData,
      "status"
    );

  if (
    !isEnumValue(
      MocTaskStatus,
      status
    )
  ) {
    throw new Error(
      "A valid MOC task status is required."
    );
  }

  await updateMocTaskService({
    organizationId,
    userId: user.id,
    mocId,

    taskId:
      getRequiredString(
        formData,
        "taskId"
      ),

    status,

    evidenceNote:
      getOptionalString(
        formData,
        "evidenceNote"
      ),
  });

  redirect(`/moc/${mocId}`);
}

export async function linkRiskToMoc(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  await linkRiskToMocService({
    organizationId,
    userId: user.id,
    mocId,

    riskId:
      getRequiredString(
        formData,
        "riskId"
      ),

    relationshipNote:
      getOptionalString(
        formData,
        "relationshipNote"
      ),
  });

  redirect(`/moc/${mocId}`);
}

export async function unlinkRiskFromMoc(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_MOC
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const mocId =
    getRequiredString(
      formData,
      "mocId"
    );

  await unlinkRiskFromMocService({
    organizationId,
    userId: user.id,
    mocId,

    linkId:
      getRequiredString(
        formData,
        "linkId"
      ),
  });

  redirect(`/moc/${mocId}`);
}
