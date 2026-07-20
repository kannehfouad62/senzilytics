"use server";

import { getCurrentUserTenant } from "@/lib/tenant";
import { decideWorkflowStep } from "@/core/workflow/workflow.service";
import { PermissionKey, WorkflowDecision, WorkflowEntityType } from "@prisma/client";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/permissions";

export async function decideIncidentWorkflow(formData: FormData) {
  await requirePermission(PermissionKey.UPDATE_INCIDENT);
  const { organizationId, user } = await getCurrentUserTenant();

  const incidentId = String(formData.get("incidentId"));
  const decision = formData.get("decision") as WorkflowDecision;
  const comments = String(formData.get("comments") || "");

  await decideWorkflowStep({
    organizationId,
    userId: user.id,
    entityType: WorkflowEntityType.INCIDENT,
    entityId: incidentId,
    decision,
    comments,
  });

  redirect(`/incidents/${incidentId}`);
}
