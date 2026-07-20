import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";

export type SubscriptionFeature = "IN_APP_NOTIFICATIONS" | "EMAIL_NOTIFICATIONS" | "DOCUMENT_UPLOAD" | "AI" | "OFFLINE_COLLECTION" | "MOBILE_APPS";
export const planEntitlements: Record<SubscriptionPlan, Record<SubscriptionFeature, boolean>> = {
  ESSENTIAL: { IN_APP_NOTIFICATIONS: false, EMAIL_NOTIFICATIONS: false, DOCUMENT_UPLOAD: false, AI: false, OFFLINE_COLLECTION: false, MOBILE_APPS: false },
  ENTERPRISE: { IN_APP_NOTIFICATIONS: true, EMAIL_NOTIFICATIONS: true, DOCUMENT_UPLOAD: true, AI: false, OFFLINE_COLLECTION: false, MOBILE_APPS: false },
  PREMIUM: { IN_APP_NOTIFICATIONS: true, EMAIL_NOTIFICATIONS: true, DOCUMENT_UPLOAD: true, AI: true, OFFLINE_COLLECTION: true, MOBILE_APPS: true },
};

export async function getOrganizationSubscription(organizationId: string) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { subscriptionPlan: true, contractedUserMinimum: true } });
  if (!organization) throw new Error("Organization subscription was not found.");
  return { ...organization, entitlements: planEntitlements[organization.subscriptionPlan] };
}

export async function hasSubscriptionFeature(organizationId: string, feature: SubscriptionFeature) { return (await getOrganizationSubscription(organizationId)).entitlements[feature]; }
export async function requireSubscriptionFeature(organizationId: string, feature: SubscriptionFeature) { if (!(await hasSubscriptionFeature(organizationId, feature))) throw new Error("This feature is not included in your organization’s subscription plan. Contact your Senzilytics administrator to upgrade."); }
