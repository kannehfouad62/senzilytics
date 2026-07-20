"use server";

import {
  sendCorrectiveActionAssignmentEmail,
  sendCorrectiveActionStatusEmail,
} from "@/core/notifications/notification-email.service";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  createCorrectiveActionService,
  createIncidentService,
  updateCorrectiveActionStatusService,
  updateIncidentStatusService,
  upsertInvestigationService,
} from "@/modules/incident/incident.service";
import {
  IncidentType,
  RiskLevel,
  Status,
  PermissionKey,
  ConfigurableFormModule,
} from "@prisma/client";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions";
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

function getRequiredDate(
  formData: FormData,
  fieldName: string
) {
  const rawValue = getRequiredString(
    formData,
    fieldName
  );

  const value = new Date(rawValue);

  if (Number.isNaN(value.getTime())) {
    throw new Error(
      `${fieldName} must contain a valid date.`
    );
  }

  return value;
}

function isIncidentType(
  value: string
): value is IncidentType {
  return Object.values(
    IncidentType
  ).includes(value as IncidentType);
}

function isRiskLevel(
  value: string
): value is RiskLevel {
  return Object.values(
    RiskLevel
  ).includes(value as RiskLevel);
}

function isStatus(
  value: string
): value is Status {
  return Object.values(
    Status
  ).includes(value as Status);
}

export type IncidentCreateState = {
  error: string | null;
};

export async function createIncident(
  _state: IncidentCreateState,
  formData: FormData
): Promise<IncidentCreateState> {
  await requirePermission(PermissionKey.CREATE_INCIDENT);
  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  let incidentId: string;

  try {
    const typeValue = getRequiredString(
      formData,
      "type"
    );

    const riskLevelValue =
      getRequiredString(
        formData,
        "riskLevel"
      );

    if (!isIncidentType(typeValue)) {
      throw new Error(
        "A valid incident type is required."
      );
    }

    if (!isRiskLevel(riskLevelValue)) {
      throw new Error(
        "A valid risk level is required."
      );
    }

    const customSubmissions =
      await preparePublishedFormSubmissions({
        organizationId,
        module:
          ConfigurableFormModule.INCIDENT,
        data: formData,
      });

    const incident =
      await createIncidentService({
        organizationId,
        userId: user.id,
        title: getRequiredString(
          formData,
          "title"
        ),
        description:
          getRequiredString(
            formData,
            "description"
          ),
        type: typeValue,
        riskLevel:
          riskLevelValue,
        siteId: getRequiredString(
          formData,
          "siteId"
        ),
        location:
          getOptionalString(
            formData,
            "location"
          ) || "",
        customSubmissions,
      });

    incidentId = incident.id;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The incident could not be submitted.",
    };
  }

  redirect(
    `/incidents/${incidentId}`
  );
}

export async function createCorrectiveAction(
  formData: FormData
) {
  await requirePermission(PermissionKey.CREATE_CAPA);
  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const incidentId =
    getRequiredString(
      formData,
      "incidentId"
    );

  const assignedToId =
    getRequiredString(
      formData,
      "assignedToId"
    );

  const title = getRequiredString(
    formData,
    "title"
  );

  const description =
    getOptionalString(
      formData,
      "description"
    );

  const riskLevelValue =
    getRequiredString(
      formData,
      "riskLevel"
    );

  const dueDate = getRequiredDate(
    formData,
    "dueDate"
  );

  if (!isRiskLevel(riskLevelValue)) {
    throw new Error(
      "A valid risk level is required."
    );
  }

  const [incident, assignedUser] =
    await Promise.all([
      prisma.incident.findFirst({
        where: {
          id: incidentId,
          site: {
            organizationId,
          },
        },
        select: {
          id: true,
          title: true,
        },
      }),

      prisma.user.findFirst({
        where: {
          id: assignedToId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
    ]);

  if (!incident) {
    throw new Error(
      "Incident not found."
    );
  }

  if (!assignedUser) {
    throw new Error(
      "The selected assignee was not found in your organization."
    );
  }

  await createCorrectiveActionService({
    organizationId,
    userId: user.id,
    incidentId,
    title,
    description: description || "",
    riskLevel: riskLevelValue,
    assignedToId,
    dueDate,
  });

  if (assignedUser.email) {
    try {
      await sendCorrectiveActionAssignmentEmail({
        recipientEmail:
          assignedUser.email,
        recipientName:
          assignedUser.name,
        actionId: "",
        actionTitle: title,
        actionDescription:
          description,
        incidentId:
          incident.id,
        incidentTitle:
          incident.title,
        dueDate,
        riskLevel:
          riskLevelValue,
        assignedByName:
          user.name,
      });
    } catch (error) {
      console.error(
        "Corrective-action assignment notification failed:",
        error
      );
    }
  }

  redirect(
    `/incidents/${incidentId}`
  );
}

export async function upsertInvestigation(
  formData: FormData
) {
  await requirePermission(PermissionKey.UPDATE_INCIDENT);
  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const incidentId =
    getRequiredString(
      formData,
      "incidentId"
    );

  await upsertInvestigationService({
    organizationId,
    userId: user.id,
    incidentId,
    summary: getRequiredString(
      formData,
      "summary"
    ),
    rootCause:
      getRequiredString(
        formData,
        "rootCause"
      ),
    immediateCause:
      getRequiredString(
        formData,
        "immediateCause"
      ),
    contributingFactors:
      getRequiredString(
        formData,
        "contributingFactors"
      ),
  });

  redirect(
    `/incidents/${incidentId}`
  );
}

export async function updateIncidentStatus(
  formData: FormData
) {
  await requirePermission(PermissionKey.UPDATE_INCIDENT);
  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const incidentId =
    getRequiredString(
      formData,
      "incidentId"
    );

  const statusValue =
    getRequiredString(
      formData,
      "status"
    );

  if (!isStatus(statusValue)) {
    throw new Error(
      "A valid incident status is required."
    );
  }

  await updateIncidentStatusService({
    organizationId,
    userId: user.id,
    incidentId,
    status: statusValue,
  });

  redirect(
    `/incidents/${incidentId}`
  );
}

export async function updateCorrectiveActionStatus(
  formData: FormData
) {
  await requirePermission(PermissionKey.UPDATE_CAPA);
  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const incidentId =
    getRequiredString(
      formData,
      "incidentId"
    );

  const actionId =
    getRequiredString(
      formData,
      "actionId"
    );

  const statusValue =
    getRequiredString(
      formData,
      "status"
    );

  if (!isStatus(statusValue)) {
    throw new Error(
      "A valid corrective-action status is required."
    );
  }

  const existingAction =
    await prisma.correctiveAction.findFirst({
      where: {
        id: actionId,
        incident: {
          id: incidentId,
          site: {
            organizationId,
          },
        },
      },
      include: {
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
        incident: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

  if (!existingAction) {
    throw new Error(
      "Corrective action not found."
    );
  }

  await updateCorrectiveActionStatusService({
    organizationId,
    userId: user.id,
    incidentId,
    actionId,
    status: statusValue,
  });

  if (
    existingAction.assignedTo.email &&
    existingAction.status !==
      statusValue
  ) {
    try {
      await sendCorrectiveActionStatusEmail({
        recipientEmail:
          existingAction.assignedTo.email,
        recipientName:
          existingAction.assignedTo.name,
        actionId:
          existingAction.id,
        actionTitle:
          existingAction.title,
        incidentId:
          existingAction.incident?.id ||
          null,
        previousStatus:
          existingAction.status,
        newStatus:
          statusValue,
        updatedByName:
          user.name,
      });
    } catch (error) {
      console.error(
        "Corrective-action status notification failed:",
        error
      );
    }
  }

  redirect(
    `/incidents/${incidentId}`
  );
}
