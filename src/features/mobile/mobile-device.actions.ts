"use server";

import { PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { revokeTenantMobileSessionService } from "@/modules/mobile/mobile-auth.service";

export async function revokeTenantMobileDevice(_: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_USERS);
  const { organizationId, user } = await getCurrentUserTenant();
  try { await revokeTenantMobileSessionService({ sessionId: String(formData.get("sessionId") || ""), organizationId, actorId: user.id }); }
  catch (error) { return { status: "ERROR", message: error instanceof Error ? error.message : "The mobile session could not be revoked." }; }
  revalidatePath("/users");
  return { status: "SUCCESS", message: "Mobile device access revoked." };
}
