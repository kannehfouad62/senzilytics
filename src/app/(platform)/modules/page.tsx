import { isIndustryRecommendedModule, industryCategoryLabels } from "@/core/navigation/industry-module-recommendations";
import { filterNavigationItems } from "@/core/permissions/navigation-access";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { planEntitlements } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import { auditNavItems, complianceNavItems, ehsNavItems, inspectionNavItems, primaryNavItems, researchNavItems } from "@/components/layout/sidebar";
import { PermissionKey } from "@prisma/client";
import { PanelsTopLeft, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function AllModulesPage() {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  const [{ organization }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  if (!organization) return null;
  const entitlements = planEntitlements[organization.subscriptionPlan];
  const primary = filterNavigationItems(primaryNavItems, permissions).filter(item => item.href !== "/modules" && (item.href !== "/field-collection" || entitlements.OFFLINE_COLLECTION));
  const governance = filterNavigationItems(complianceNavItems, permissions).filter(item => item.href !== "/notifications" || entitlements.IN_APP_NOTIFICATIONS);
  const sections = [
    ["Platform and intelligence", primary], ["EHS management", filterNavigationItems(ehsNavItems, permissions)],
    ["Audit management", filterNavigationItems(auditNavItems, permissions)], ["Research and analytics", filterNavigationItems(researchNavItems, permissions)],
    ["Inspections", filterNavigationItems(inspectionNavItems, permissions)], ["Governance", governance],
  ] as const;
  return <div><p className="flex items-center gap-2 text-sm text-cyan-300"><PanelsTopLeft size={18}/>Module directory</p><h1 className="mt-2 text-4xl font-bold">All Modules</h1><p className="mt-2 max-w-3xl text-slate-400">Explore every module available under your role and subscription. Your sidebar prioritizes {industryCategoryLabels[organization.industryCategory].toLowerCase()} recommendations; access controls remain unchanged.</p>
    <div className="mt-8 space-y-8">{sections.map(([label, items]) => items.length ? <section key={label}><h2 className="text-xl font-semibold">{label}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => { const Icon=item.icon; const recommended=isIndustryRecommendedModule(organization.industryCategory,item.href); return <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/[.04] p-5 transition hover:border-cyan-400/30 hover:bg-cyan-400/[.05]"><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200"><Icon size={21}/></span>{recommended && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-200"><Sparkles size={12}/>Recommended</span>}</div><h3 className="mt-4 font-semibold">{item.label}</h3><p className="mt-1 text-xs text-slate-500">Open module</p></Link>; })}</div></section> : null)}</div>
  </div>;
}
