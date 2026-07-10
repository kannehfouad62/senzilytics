"use server";

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
} from "@prisma/client";
import { redirect } from "next/navigation";



export async function createIncident(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  await createIncidentService({
    organizationId,
    userId: user.id,
    title: String(formData.get("title")),
    description: String(formData.get("description")),
    type: formData.get("type") as IncidentType,
    riskLevel: formData.get("riskLevel") as RiskLevel,
    siteId: String(formData.get("siteId")),
    location: String(formData.get("location")),
  });

  redirect("/incidents");
}

export async function createCorrectiveAction(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const incidentId = String(formData.get("incidentId"));

  await createCorrectiveActionService({
    organizationId,
    userId: user.id,
    incidentId,
    title: String(formData.get("title")),
    description: String(formData.get("description")),
    riskLevel: formData.get("riskLevel") as RiskLevel,
    assignedToId: String(formData.get("assignedToId")),
    dueDate: new Date(String(formData.get("dueDate"))),
  });

  redirect(`/incidents/${incidentId}`);
}


export async function upsertInvestigation(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const incidentId = String(formData.get("incidentId"));

  await upsertInvestigationService({
    organizationId,
    userId: user.id,
    incidentId,
    summary: String(formData.get("summary")),
    rootCause: String(formData.get("rootCause")),
    immediateCause: String(formData.get("immediateCause")),
    contributingFactors: String(formData.get("contributingFactors")),
  });

  redirect(`/incidents/${incidentId}`);
}

export async function updateIncidentStatus(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const incidentId = String(formData.get("incidentId"));

  await updateIncidentStatusService({
    organizationId,
    userId: user.id,
    incidentId,
    status: formData.get("status") as Status,
  });

  redirect(`/incidents/${incidentId}`);
}

export async function updateCorrectiveActionStatus(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const incidentId = String(formData.get("incidentId"));

  await updateCorrectiveActionStatusService({
    organizationId,
    userId: user.id,
    incidentId,
    actionId: String(formData.get("actionId")),
    status: formData.get("status") as Status,
  });

  redirect(`/incidents/${incidentId}`);
}