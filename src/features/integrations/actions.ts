"use server";

import { IntegrationApiScope, IntegrationWebhookEvent, IntegrationWebhookStatus, PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { createApiCredentialService, createWebhookEndpointService, retryWebhookDeliveryService, revokeApiCredentialService, revokeWebhookEndpointService, rotateWebhookSecretService, updateWebhookStatusService } from "@/modules/integrations/integration.service";

export type IntegrationActionState = { status: "IDLE" | "SUCCESS" | "ERROR"; message: string | null; secret?: string | null };

export async function createIntegrationCredential(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try {
    const scopes = formData.getAll("scopes").map(String).filter((value): value is IntegrationApiScope => Object.values(IntegrationApiScope).includes(value as IntegrationApiScope));
    const expires = String(formData.get("expiresAt") || "");
    const result = await createApiCredentialService({ organizationId, userId: user.id, name: String(formData.get("name") || ""), scopes, rateLimitPerMinute: Number(formData.get("rateLimitPerMinute") || 120), expiresAt: expires ? new Date(`${expires}T23:59:59.999Z`) : null });
    revalidatePath("/integrations");
    return { status: "SUCCESS", message: "Credential created. Copy the token now; it cannot be displayed again.", secret: result.secret };
  } catch (error) { return failure(error); }
}

export async function revokeIntegrationCredential(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try { await revokeApiCredentialService({ organizationId, userId: user.id, credentialId: String(formData.get("credentialId") || "") }); revalidatePath("/integrations"); return success("API credential revoked."); } catch (error) { return failure(error); }
}

export async function createIntegrationWebhook(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try {
    const events = formData.getAll("events").map(String).filter((value): value is IntegrationWebhookEvent => Object.values(IntegrationWebhookEvent).includes(value as IntegrationWebhookEvent));
    const result = await createWebhookEndpointService({ organizationId, userId: user.id, name: String(formData.get("name") || ""), url: String(formData.get("url") || ""), events });
    revalidatePath("/integrations");
    return { status: "SUCCESS", message: "Webhook created. Copy the signing secret now; it cannot be displayed again.", secret: result.secret };
  } catch (error) { return failure(error); }
}

export async function setIntegrationWebhookStatus(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try {
    const status = String(formData.get("status"));
    if (status !== IntegrationWebhookStatus.ACTIVE && status !== IntegrationWebhookStatus.PAUSED) throw new Error("Webhook status is invalid.");
    await updateWebhookStatusService({ organizationId, userId: user.id, endpointId: String(formData.get("endpointId") || ""), status });
    revalidatePath("/integrations"); return success(`Webhook ${status === IntegrationWebhookStatus.ACTIVE ? "activated" : "paused"}.`);
  } catch (error) { return failure(error); }
}

export async function rotateIntegrationWebhookSecret(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try { const result = await rotateWebhookSecretService({ organizationId, userId: user.id, endpointId: String(formData.get("endpointId") || "") }); revalidatePath("/integrations"); return { status: "SUCCESS", message: "Signing secret rotated. Update the receiving system immediately.", secret: result.secret }; } catch (error) { return failure(error); }
}

export async function revokeIntegrationWebhook(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try { await revokeWebhookEndpointService({ organizationId, userId: user.id, endpointId: String(formData.get("endpointId") || "") }); revalidatePath("/integrations"); return success("Webhook revoked."); } catch (error) { return failure(error); }
}

export async function retryIntegrationWebhookDelivery(_: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  const { user, organizationId } = await getCurrentUserTenant();
  try { await retryWebhookDeliveryService({ organizationId, userId: user.id, deliveryId: String(formData.get("deliveryId") || "") }); revalidatePath("/integrations"); return success("Webhook delivery requeued."); } catch (error) { return failure(error); }
}

function success(message: string): IntegrationActionState { return { status: "SUCCESS", message, secret: null }; }
function failure(error: unknown): IntegrationActionState { return { status: "ERROR", message: error instanceof Error ? error.message : "The integration operation could not be completed.", secret: null }; }
