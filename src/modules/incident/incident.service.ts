import { prisma } from "@/lib/prisma";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { startWorkflowForEntity } from "@/core/workflow/workflow.service";
import {
  ActivityAction,
  IncidentType,
  NotificationType,
  RiskLevel,
  Status, WorkflowEntityType,
} from "@prisma/client";
import {
  createTenantCorrectiveAction,
  createTenantIncident,
  findTenantCorrectiveAction,
  findTenantIncidentById,
  updateTenantCorrectiveActionStatus,
  updateTenantIncidentStatus,
  upsertTenantInvestigation,
} from "./incident.repository";

export async function createIncidentService(input: {
  organizationId: string;
  userId: string;
  title: string;
  description: string;
  type: IncidentType;
  riskLevel: RiskLevel;
  siteId: string;
  location: string;
}) {
  const site = await prisma.site.findFirst({
    where: {
      id: input.siteId,
      organizationId: input.organizationId,
    },
  });

  if (!site) {
    throw new Error("Invalid site for this organization.");
  }

  const incident = await createTenantIncident({
    title: input.title,
    description: input.description,
    type: input.type,
    riskLevel: input.riskLevel,
    location: input.location,
    siteId: input.siteId,
    reportedById: input.userId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "Incident",
    entityId: incident.id,
    title: "Incident created",
    description: incident.title,
    metadata: {
      riskLevel: incident.riskLevel,
      status: incident.status,
      siteId: incident.siteId,
    },
  });

  await createNotification({
    organizationId: input.organizationId,
    userId: input.userId,
    type: NotificationType.SUCCESS,
    title: "Incident submitted",
    message: `Your incident "${incident.title}" was submitted successfully.`,
    link: `/incidents/${incident.id}`,
  });

  await startWorkflowForEntity({
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: WorkflowEntityType.INCIDENT,
    entityId: incident.id,
  });

  return incident;
}

export async function updateIncidentStatusService(input: {
  organizationId: string;
  userId: string;
  incidentId: string;
  status: Status;
}) {
  const incident = await findTenantIncidentById(
    input.incidentId,
    input.organizationId
  );

  if (!incident) {
    throw new Error("Invalid incident for this organization.");
  }

  const previousStatus = incident.status;

  const updatedIncident = await updateTenantIncidentStatus({
    incidentId: input.incidentId,
    status: input.status,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "Incident",
    entityId: input.incidentId,
    title: "Incident status changed",
    description: `${previousStatus} → ${input.status}`,
    metadata: {
      previousStatus,
      newStatus: input.status,
    },
  });

  return updatedIncident;
}

export async function createCorrectiveActionService(input: {
  organizationId: string;
  userId: string;
  incidentId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  assignedToId: string;
  dueDate: Date;
}) {
  const incident = await findTenantIncidentById(
    input.incidentId,
    input.organizationId
  );

  if (!incident) {
    throw new Error("Invalid incident for this organization.");
  }

  const assignedUser = await prisma.user.findFirst({
    where: {
      id: input.assignedToId,
      organizationId: input.organizationId,
    },
  });

  if (!assignedUser) {
    throw new Error("Invalid assigned user for this organization.");
  }

  const action = await createTenantCorrectiveAction({
    title: input.title,
    description: input.description,
    riskLevel: input.riskLevel,
    dueDate: input.dueDate,
    incidentId: input.incidentId,
    assignedToId: input.assignedToId,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "CorrectiveAction",
    entityId: action.id,
    title: "Corrective action created",
    description: action.title,
    metadata: {
      incidentId: input.incidentId,
      riskLevel: action.riskLevel,
      status: action.status,
      assignedToId: input.assignedToId,
    },
  });

  await createNotification({
    organizationId: input.organizationId,
    userId: input.assignedToId,
    type: NotificationType.ASSIGNMENT,
    title: "Corrective action assigned",
    message: `You were assigned: ${action.title}`,
    link: `/incidents/${input.incidentId}`,
  });

  return action;
}

export async function upsertInvestigationService(input: {
  organizationId: string;
  userId: string;
  incidentId: string;
  summary: string;
  rootCause: string;
  immediateCause: string;
  contributingFactors: string;
}) {
  const incident = await findTenantIncidentById(
    input.incidentId,
    input.organizationId
  );

  if (!incident) {
    throw new Error("Invalid incident for this organization.");
  }

  const investigation = await upsertTenantInvestigation({
    incidentId: input.incidentId,
    summary: input.summary,
    rootCause: input.rootCause,
    immediateCause: input.immediateCause,
    contributingFactors: input.contributingFactors,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "Investigation",
    entityId: input.incidentId,
    title: "Investigation updated",
    description: "Incident investigation details were saved.",
    metadata: {
      incidentId: input.incidentId,
    },
  });

  return investigation;
}

export async function updateCorrectiveActionStatusService(input: {
  organizationId: string;
  userId: string;
  actionId: string;
  incidentId: string;
  status: Status;
}) {
  const action = await findTenantCorrectiveAction({
    actionId: input.actionId,
    incidentId: input.incidentId,
    organizationId: input.organizationId,
  });

  if (!action) {
    throw new Error("Invalid corrective action for this organization.");
  }

  const previousStatus = action.status;

  const updatedAction = await updateTenantCorrectiveActionStatus({
    actionId: input.actionId,
    status: input.status,
  });

  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.STATUS_CHANGE,
    entityType: "CorrectiveAction",
    entityId: input.actionId,
    title: "Corrective action status changed",
    description: `${previousStatus} → ${input.status}`,
    metadata: {
      incidentId: input.incidentId,
      previousStatus,
      newStatus: input.status,
    },
  });

  return updatedAction;
}