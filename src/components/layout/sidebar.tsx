import Link from "next/link";
import Image from "next/image";
import { getPlatformAdministrator } from "@/lib/platform-admin";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { PermissionKey, UserRole } from "@prisma/client";
import { planEntitlements } from "@/lib/subscription";
import { filterNavigationItems } from "@/core/permissions/navigation-access";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  SearchCheck,
  ShieldCheck,
  Users,
  ShieldAlert,
  Gauge,
  FileText,
  FlaskConical,
  Leaf,
  Sprout,
  Workflow,
  Eye,
  WifiOff,
  Network,
  Radar,
  FileCog,
  HardHat,
  HeartPulse,
  Waves,
  Award,
  Wrench,
  BrainCircuit,
  PlugZap,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
  permission?: PermissionKey;
  anyPermissions?: readonly PermissionKey[];
};

export const primaryNavItems: NavigationItem[] = [
  {
    label: "Global Executive Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: PermissionKey.VIEW_DASHBOARD,
  },
  {
    label: "Operational Assurance",
    href: "/assurance",
    icon: Network,
    permission: PermissionKey.VIEW_DASHBOARD,
  },
  {
    label: "AI Intelligence",
    href: "/intelligence",
    icon: BrainCircuit,
    permission: PermissionKey.USE_AI,
  },
  {
    label: "SIF Prevention",
    href: "/assurance/sif",
    icon: Radar,
    permission: PermissionKey.VIEW_SIF_INTELLIGENCE,
  },
  {
    label: "Certification Readiness",
    href: "/assurance/certification",
    icon: Award,
    permission: PermissionKey.VIEW_CERTIFICATION_READINESS,
  },
  {
    label: "My Tasks",
    href: "/tasks",
    icon: ClipboardList,
  },
  {
    label: "Field Collection",
    href: "/field-collection",
    icon: WifiOff,
    permission: PermissionKey.CREATE_OBSERVATION,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FolderOpen,
    permission: PermissionKey.MANAGE_DOCUMENTS,
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: PlugZap,
    permission: PermissionKey.MANAGE_INTEGRATIONS,
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: GitBranch,
    permission: PermissionKey.MANAGE_WORKFLOWS,
  },
  {
    label: "Form Studio",
    href: "/form-studio",
    icon: FileCog,
    permission: PermissionKey.MANAGE_ORGANIZATION,
  },
  {
    label: "Organizations",
    href: "/organizations",
    icon: Building2,
    permission: PermissionKey.MANAGE_ORGANIZATION,
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    permission: PermissionKey.VIEW_USERS,
  },
];

export const ehsNavItems: NavigationItem[] = [
  {
    label: "Behavior-Based Safety",
    href: "/behavior-safety",
    icon: Users,
    permission: PermissionKey.VIEW_BEHAVIOR_SAFETY,
  },
  {
    label: "Assets & Equipment",
    href: "/assets",
    icon: Wrench,
    permission: PermissionKey.VIEW_ASSETS,
  },
  {
    label: "Contractors",
    href: "/contractors",
    icon: HardHat,
    permission: PermissionKey.VIEW_CONTRACTORS,
  },
  {
    label: "Permit to Work",
    href: "/permits-to-work",
    icon: ShieldCheck,
    permission: PermissionKey.VIEW_PERMITS_TO_WORK,
  },
  {
    label: "Industrial Hygiene",
    href: "/industrial-hygiene",
    icon: Waves,
    permission: PermissionKey.VIEW_INDUSTRIAL_HYGIENE,
  },
  {
    label: "Occupational Health",
    href: "/occupational-health",
    icon: HeartPulse,
    permission: PermissionKey.VIEW_OCCUPATIONAL_HEALTH,
  },
  {
    label: "Safety Observations",
    href: "/observations",
    icon: Eye,
    permission: PermissionKey.VIEW_OBSERVATIONS,
  },
  {
    label: "Incidents",
    href: "/incidents",
    icon: AlertTriangle,
    permission: PermissionKey.VIEW_INCIDENT,
  },
  {
    label: "Corrective Actions",
    href: "/actions",
    icon: ClipboardCheck,
    anyPermissions: [
      PermissionKey.CREATE_CAPA,
      PermissionKey.UPDATE_CAPA,
      PermissionKey.CLOSE_CAPA,
      PermissionKey.VIEW_REPORTS,
    ],
  },
  {
    label: "CAPA Dashboard",
    href: "/capa",
    icon: BarChart3,
    permission: PermissionKey.VIEW_REPORTS,
  },
  {
    label: "Risk Register",
    href: "/risks",
    icon: ShieldAlert,
    permission: PermissionKey.VIEW_RISKS,
  },
  {
    label: "JSA / JHA",
    href: "/risks/jsa",
    icon: ListChecks,
    permission: PermissionKey.VIEW_RISKS,
  },
  {
    label: "Risk Report",
    href: "/risks/report",
    icon: FileText,
    permission: PermissionKey.VIEW_RISKS,
  },
  {
    label: "Risk Dashboard",
    href: "/risks/dashboard",
    icon: Gauge,
    permission: PermissionKey.VIEW_RISKS,
  },

  {
    label: "Management of Change",
    href: "/moc",
    icon: Workflow,
    permission: PermissionKey.VIEW_MOC,
  },
];

export const inspectionNavItems: NavigationItem[] = [
  {
    label: "All Inspections",
    href: "/inspections",
    icon: ShieldCheck,
    permission: PermissionKey.VIEW_INSPECTIONS,
  },
  {
    label: "Inspection Checklists",
    href: "/inspections/checklists",
    icon: ListChecks,
    permission: PermissionKey.MANAGE_INSPECTIONS,
  },
];

export const auditNavItems: NavigationItem[] = [
  {
    label: "Audit Workspace",
    href: "/audits",
    icon: SearchCheck,
    permission: PermissionKey.VIEW_AUDITS,
  },
  {
    label: "Audit Analytics",
    href: "/audits/dashboard",
    icon: BarChart3,
    permission: PermissionKey.VIEW_AUDITS,
  },
];

export const complianceNavItems: NavigationItem[] = [
  {
    label: "Sustainability & ESG",
    href: "/esg",
    icon: Sprout,
    permission: PermissionKey.VIEW_ESG,
  },
  {
    label: "Environmental Metrics",
    href: "/environmental",
    icon: Leaf,
    permission: PermissionKey.VIEW_ENVIRONMENTAL,
  },
  {
    label: "Chemicals & SDS",
    href: "/chemicals",
    icon: FlaskConical,
    permission: PermissionKey.VIEW_CHEMICALS,
  },
  {
    label: "Regulatory Intelligence",
    href: "/compliance/regulatory",
    icon: Radar,
    permission: PermissionKey.VIEW_COMPLIANCE,
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: CalendarCheck,
    permission: PermissionKey.VIEW_COMPLIANCE,
  },
  {
    label: "Compliance Calendar",
    href: "/compliance/calendar",
    icon: CalendarCheck,
    permission: PermissionKey.VIEW_COMPLIANCE,
  },
  {
    label: "Training",
    href: "/training",
    icon: GraduationCap,
    permission: PermissionKey.VIEW_TRAINING,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: PermissionKey.VIEW_REPORTS,
  },
  {
    label: "Activity Log",
    href: "/activity",
    icon: Activity,
    permission: PermissionKey.VIEW_ACTIVITY_LOG,
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
];

export async function Sidebar() {
  const [platformAdministrator, { user, organization }, permissions] = await Promise.all([getPlatformAdministrator(), getCurrentUserTenant(), getCurrentUserPermissions()]);
  const isDemo = user.role === UserRole.DEMO_VIEWER;
  const entitlements = organization ? planEntitlements[organization.subscriptionPlan] : planEntitlements.PREMIUM;
  const entitledPrimaryItems = filterNavigationItems(primaryNavItems, permissions).filter(item => item.href !== "/field-collection" || entitlements.OFFLINE_COLLECTION);
  const platformNavItems = platformAdministrator
    ? [
        ...entitledPrimaryItems,
        {
          label: "Tenant Provisioning",
          href: "/platform/tenants",
          icon: Building2,
        },
      ]
    : isDemo
      ? entitledPrimaryItems.filter((item) => item.href === "/dashboard")
      : entitledPrimaryItems;
  const permittedGovernanceItems = filterNavigationItems(complianceNavItems, permissions);
  const governanceItems = isDemo
    ? permittedGovernanceItems.filter((item) => item.href !== "/notifications")
    : permittedGovernanceItems.filter(item => item.href !== "/notifications" || entitlements.IN_APP_NOTIFICATIONS);
  const visibleEhsItems = filterNavigationItems(ehsNavItems, permissions);
  const visibleAuditItems = filterNavigationItems(auditNavItems, permissions);
  const visibleInspectionItems = filterNavigationItems(inspectionNavItems, permissions);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl lg:flex">
      <Link
        href="/dashboard"
        aria-label="Senzilytics dashboard"
        className="mb-8 flex shrink-0 items-center gap-3 rounded-2xl transition hover:-translate-y-0.5"
      >
        <Image
          src="/brand/senzilytics-mark.svg"
          alt=""
          width={46}
          height={46}
          className="rounded-2xl shadow-[0_10px_30px_rgba(34,211,238,.18)]"
          priority
        />
        <span>
          <strong className="block text-xl font-bold tracking-tight">Senzilytics</strong>
          <span className="block text-xs text-slate-400">EHS Intelligence</span>
        </span>
      </Link>

      <nav className="min-h-0 flex-1 space-y-7 overflow-y-auto pr-2">
        <NavigationSection
          label="Platform"
          items={platformNavItems}
        />

        <NavigationSection
          label="EHS Management"
          items={visibleEhsItems}
        />

        <NavigationSection
          label="Audit Management 2.0"
          items={visibleAuditItems}
          featured
        />

        {visibleInspectionItems.length > 0 && <div>
          <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            Inspections
          </p>

          <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
            {visibleInspectionItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>}

        <NavigationSection
          label="Governance"
          items={governanceItems}
        />
      </nav>
    </aside>
  );
}

function NavigationSection({
  label,
  items,
  featured = false,
}: {
  label: string;
  items: NavigationItem[];
  featured?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>

      <div className={`space-y-2 ${featured ? "rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-2" : ""}`}>
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
