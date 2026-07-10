"use server";

import { requirePermission } from "@/lib/permissions";
import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { PermissionKey } from "@prisma/client";
import { redirect } from "next/navigation";

export async function runWorkflowSlaProcessor() {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  await processWorkflowSlaNotifications();

  redirect("/workflows/sla");
}