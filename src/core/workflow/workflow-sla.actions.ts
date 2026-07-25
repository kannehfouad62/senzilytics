"use server";

import { requirePermission } from "@/lib/permissions";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { processWorkflowAutomationEvents } from "@/core/workflow/workflow-automation-event.service";
import { processWorkflowOutcomeExecutions } from "@/core/workflow/workflow-outcome.service";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { redirect } from "next/navigation";

export async function runWorkflowSlaProcessor() {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId } = await getCurrentUserTenant();

  await processWorkflowAutomationEvents({ organizationId });
  await processWorkflowSlaNotifications({ organizationId });
  await processWorkflowOutcomeExecutions({ organizationId });

  redirect("/workflows/sla");
}
