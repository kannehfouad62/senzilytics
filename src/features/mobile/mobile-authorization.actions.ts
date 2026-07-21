"use server";

import { redirect } from "next/navigation";
import { getCurrentUserTenant } from "@/lib/tenant";
import { authorizeMobileChallengeService, denyMobileChallengeService } from "@/modules/mobile/mobile-auth.service";

export type MobileAuthorizationState = { status: "IDLE" | "ERROR"; message: string | null };
export const initialMobileAuthorizationState: MobileAuthorizationState = { status: "IDLE", message: null };

export async function approveMobileAuthorization(_: MobileAuthorizationState, formData: FormData): Promise<MobileAuthorizationState> {
  const { user, organization, organizationId } = await getCurrentUserTenant();
  if (!organization) redirect("/unauthorized");
  let target: string;
  try { target = await authorizeMobileChallengeService({ challenge: String(formData.get("challenge") || ""), userId: user.id, organizationId, organizationPlan: organization.subscriptionPlan, isDemo: organization.isDemo }); }
  catch (error) { return { status: "ERROR", message: error instanceof Error ? error.message : "Mobile access could not be authorized." }; }
  redirect(target);
}

export async function denyMobileAuthorization(_: MobileAuthorizationState, formData: FormData): Promise<MobileAuthorizationState> {
  await getCurrentUserTenant();
  let target: string;
  try { target = await denyMobileChallengeService(String(formData.get("challenge") || "")); }
  catch (error) { return { status: "ERROR", message: error instanceof Error ? error.message : "Mobile authorization could not be denied." }; }
  redirect(target);
}
