"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { authorizeMobileChallengeService, denyMobileChallengeService, getMobileAuthorizationEligibilityService } from "@/modules/mobile/mobile-auth.service";

export type MobileAuthorizationState = { status: "IDLE" | "ERROR"; message: string | null };

export async function approveMobileAuthorization(_: MobileAuthorizationState, formData: FormData): Promise<MobileAuthorizationState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.sessionValid) return { status: "ERROR", message: "Your secure sign-in session has expired. Return to the mobile app and try again." };
  const eligibility = await getMobileAuthorizationEligibilityService(session.user.id);
  if (!eligibility.eligible) return { status: "ERROR", message: eligibility.detail };
  let target: string;
  try { target = await authorizeMobileChallengeService({ challenge: String(formData.get("challenge") || ""), userId: eligibility.user.id, organizationId: eligibility.organization.id, organizationPlan: eligibility.organization.subscriptionPlan, isDemo: eligibility.organization.isDemo }); }
  catch (error) { return { status: "ERROR", message: error instanceof Error ? error.message : "Mobile access could not be authorized." }; }
  redirect(target);
}

export async function denyMobileAuthorization(_: MobileAuthorizationState, formData: FormData): Promise<MobileAuthorizationState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.sessionValid) return { status: "ERROR", message: "Your secure sign-in session has expired. Return to the mobile app and try again." };
  const eligibility = await getMobileAuthorizationEligibilityService(session.user.id);
  if (!eligibility.eligible) return { status: "ERROR", message: eligibility.detail };
  let target: string;
  try { target = await denyMobileChallengeService(String(formData.get("challenge") || "")); }
  catch (error) { return { status: "ERROR", message: error instanceof Error ? error.message : "Mobile authorization could not be denied." }; }
  redirect(target);
}
