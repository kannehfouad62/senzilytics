"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  createRiskControlService,
  createRiskLinkService,
  createRiskReviewService,
  createRiskService,
  deleteRiskLinkService,
  updateRiskControlStatusService,
  updateRiskService,
} from "@/modules/risk/risk.service";
import {
  PermissionKey,
  RiskCategory,
  RiskControlEffectiveness,
  RiskControlHierarchy,
  RiskControlType,
  RiskImpact,
  RiskLikelihood,
  RiskLinkedEntityType,
  RiskReviewFrequency,
  RiskStatus,
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

  const date =
    new Date(rawValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      `${fieldName} must contain a valid date.`
    );
  }

  return date;
}

function isEnumValue<
  T extends Record<
    string,
    string
  >,
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

export async function createRisk(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_RISKS
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const category =
    getRequiredString(
      formData,
      "category"
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

  const currentLikelihood =
    getRequiredString(
      formData,
      "currentLikelihood"
    );

  const currentImpact =
    getRequiredString(
      formData,
      "currentImpact"
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

  const reviewFrequency =
    getRequiredString(
      formData,
      "reviewFrequency"
    );

  if (
    !isEnumValue(
      RiskCategory,
      category
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
      currentLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      currentImpact
    ) ||
    !isEnumValue(
      RiskLikelihood,
      residualLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      residualImpact
    ) ||
    !isEnumValue(
      RiskReviewFrequency,
      reviewFrequency
    )
  ) {
    throw new Error(
      "One or more risk values are invalid."
    );
  }

  const risk =
    await createRiskService({
      organizationId,
      userId:
        user.id,
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
      category,
      hazardType:
        getOptionalString(
          formData,
          "hazardType"
        ),
      process:
        getOptionalString(
          formData,
          "process"
        ),
      siteId:
        getOptionalString(
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
      initialLikelihood,
      initialImpact,
      currentLikelihood,
      currentImpact,
      residualLikelihood,
      residualImpact,
      reviewFrequency,
      nextReviewDate:
        getOptionalDate(
          formData,
          "nextReviewDate"
        ),
    });

  redirect(
    `/risks/${risk.id}`
  );
}

export async function updateRisk(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_RISKS
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const riskId =
    getRequiredString(
      formData,
      "riskId"
    );

  const category =
    getRequiredString(
      formData,
      "category"
    );

  const status =
    getRequiredString(
      formData,
      "status"
    );

  const currentLikelihood =
    getRequiredString(
      formData,
      "currentLikelihood"
    );

  const currentImpact =
    getRequiredString(
      formData,
      "currentImpact"
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

  const reviewFrequency =
    getRequiredString(
      formData,
      "reviewFrequency"
    );

  if (
    !isEnumValue(
      RiskCategory,
      category
    ) ||
    !isEnumValue(
      RiskStatus,
      status
    ) ||
    !isEnumValue(
      RiskLikelihood,
      currentLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      currentImpact
    ) ||
    !isEnumValue(
      RiskLikelihood,
      residualLikelihood
    ) ||
    !isEnumValue(
      RiskImpact,
      residualImpact
    ) ||
    !isEnumValue(
      RiskReviewFrequency,
      reviewFrequency
    )
  ) {
    throw new Error(
      "One or more risk values are invalid."
    );
  }

  await updateRiskService({
    organizationId,
    userId:
      user.id,
    riskId,
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
    category,
    hazardType:
      getOptionalString(
        formData,
        "hazardType"
      ),
    process:
      getOptionalString(
        formData,
        "process"
      ),
    siteId:
      getOptionalString(
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
    status,
    currentLikelihood,
    currentImpact,
    residualLikelihood,
    residualImpact,
    reviewFrequency,
    nextReviewDate:
      getOptionalDate(
        formData,
        "nextReviewDate"
      ),
  });

  redirect(
    `/risks/${riskId}`
  );
}

export async function createRiskControl(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_RISKS
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const riskId =
    getRequiredString(
      formData,
      "riskId"
    );

  const controlType =
    getRequiredString(
      formData,
      "controlType"
    );

  const hierarchy =
    getRequiredString(
      formData,
      "hierarchy"
    );

  const effectiveness =
    getRequiredString(
      formData,
      "effectiveness"
    );

  if (
    !isEnumValue(
      RiskControlType,
      controlType
    ) ||
    !isEnumValue(
      RiskControlHierarchy,
      hierarchy
    ) ||
    !isEnumValue(
      RiskControlEffectiveness,
      effectiveness
    )
  ) {
    throw new Error(
      "One or more control values are invalid."
    );
  }

  await createRiskControlService({
    organizationId,
    userId:
      user.id,
    riskId,
    name:
      getRequiredString(
        formData,
        "name"
      ),
    description:
      getOptionalString(
        formData,
        "description"
      ),
    controlType,
    hierarchy,
    effectiveness,
    ownerId:
      getOptionalString(
        formData,
        "ownerId"
      ),
    dueDate:
      getOptionalDate(
        formData,
        "dueDate"
      ),
    verificationDate:
      getOptionalDate(
        formData,
        "verificationDate"
      ),
    verificationMethod:
      getOptionalString(
        formData,
        "verificationMethod"
      ),
  });

  redirect(
    `/risks/${riskId}`
  );
}

export async function updateRiskControlStatus(
    formData: FormData
  ) {
    await requirePermission(
      PermissionKey.MANAGE_RISKS
    );
  
    const {
      organizationId,
      user,
    } =
      await getCurrentUserTenant();
  
    const riskId =
      getRequiredString(
        formData,
        "riskId"
      );
  
    const statusValue =
      getRequiredString(
        formData,
        "status"
      );
  
    const effectivenessValue =
      getOptionalString(
        formData,
        "effectiveness"
      );
  
    if (
      !isEnumValue(
        Status,
        statusValue
      )
    ) {
      throw new Error(
        "A valid control status is required."
      );
    }
  
    let effectiveness:
      RiskControlEffectiveness | null =
      null;
  
    if (effectivenessValue) {
      if (
        !isEnumValue(
          RiskControlEffectiveness,
          effectivenessValue
        )
      ) {
        throw new Error(
          "A valid control effectiveness value is required."
        );
      }
  
      effectiveness =
        effectivenessValue;
    }
  
    await updateRiskControlStatusService({
      organizationId,
      userId: user.id,
      riskId,
      controlId:
        getRequiredString(
          formData,
          "controlId"
        ),
      status: statusValue,
      effectiveness,
      verificationResult:
        getOptionalString(
          formData,
          "verificationResult"
        ),
    });
  
    redirect(
      `/risks/${riskId}`
    );
  }

export async function createRiskReview(
    formData: FormData
  ) {
    await requirePermission(
      PermissionKey.MANAGE_RISKS
    );
  
    const {
      organizationId,
      user,
    } =
      await getCurrentUserTenant();
  
    const riskId =
      getRequiredString(
        formData,
        "riskId"
      );
  
    const likelihood =
      getRequiredString(
        formData,
        "likelihood"
      );
  
    const impact =
      getRequiredString(
        formData,
        "impact"
      );
  
    const controlEffectivenessValue =
      getOptionalString(
        formData,
        "controlEffectiveness"
      );
  
    let controlEffectiveness:
      RiskControlEffectiveness | null =
      null;
  
    if (controlEffectivenessValue) {
      if (
        !isEnumValue(
          RiskControlEffectiveness,
          controlEffectivenessValue
        )
      ) {
        throw new Error(
          "A valid control effectiveness value is required."
        );
      }
  
      controlEffectiveness =
        controlEffectivenessValue;
    }
  
    if (
      !isEnumValue(
        RiskLikelihood,
        likelihood
      ) ||
      !isEnumValue(
        RiskImpact,
        impact
      )
    ) {
      throw new Error(
        "One or more review values are invalid."
      );
    }
  
    await createRiskReviewService({
      organizationId,
      userId: user.id,
      riskId,
      notes:
        getOptionalString(
          formData,
          "notes"
        ),
      likelihood,
      impact,
      controlEffectiveness,
      trend:
        getOptionalString(
          formData,
          "trend"
        ),
      nextReviewDate:
        getOptionalDate(
          formData,
          "nextReviewDate"
        ),
    });
  
    redirect(
      `/risks/${riskId}`
    );
  }

export async function createRiskLink(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_RISKS
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const riskId =
    getRequiredString(
      formData,
      "riskId"
    );

  const entityType =
    getRequiredString(
      formData,
      "entityType"
    );

  if (
    !isEnumValue(
      RiskLinkedEntityType,
      entityType
    )
  ) {
    throw new Error(
      "A valid linked-record type is required."
    );
  }

  await createRiskLinkService({
    organizationId,
    userId:
      user.id,
    riskId,
    entityType,
    entityId:
      getRequiredString(
        formData,
        "entityId"
      ),
    label:
      getOptionalString(
        formData,
        "label"
      ),
  });

  redirect(
    `/risks/${riskId}`
  );
}

export async function deleteRiskLink(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_RISKS
  );

  const {
    organizationId,
    user,
  } =
    await getCurrentUserTenant();

  const riskId =
    getRequiredString(
      formData,
      "riskId"
    );

  await deleteRiskLinkService({
    organizationId,
    userId:
      user.id,
    riskId,
    linkId:
      getRequiredString(
        formData,
        "linkId"
      ),
  });

  redirect(
    `/risks/${riskId}`
  );
}