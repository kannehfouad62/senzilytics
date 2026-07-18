import Link from "next/link";
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
  Settings,
  ShieldCheck,
  Users,
  ShieldAlert,
  Gauge,
  FileText,
  Workflow,
} from "lucide-react";

const primaryNavItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Tasks",
    href: "/tasks",
    icon: ClipboardList,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FolderOpen,
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: GitBranch,
  },
  {
    label: "Organizations",
    href: "/organizations",
    icon: Building2,
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
  },
];

const ehsNavItems = [
  {
    label: "Incidents",
    href: "/incidents",
    icon: AlertTriangle,
  },
  {
    label: "Corrective Actions",
    href: "/actions",
    icon: ClipboardCheck,
  },
  {
    label: "CAPA Dashboard",
    href: "/capa",
    icon: BarChart3,
  },
  {
    label: "Risk Register",
    href: "/risks",
    icon: ShieldAlert,
  },
  {
    label: "Risk Report",
    href: "/risks/report",
    icon: FileText,
  },
  {
    label: "Risk Dashboard",
    href: "/risks/dashboard",
    icon: Gauge,
  },

  {
    label: "Management of Change",
    href: "/moc",
    icon: Workflow,
  },
];

const inspectionNavItems = [
  {
    label: "All Inspections",
    href: "/inspections",
    icon: ShieldCheck,
  },
  {
    label: "Inspection Checklists",
    href: "/inspections/checklists",
    icon: ListChecks,
  },
];

const auditNavItems = [
  {
    label: "Enterprise Audits",
    href: "/audits",
    icon: SearchCheck,
  },
  {
    label: "Create Audit",
    href: "/audits/new",
    icon: ClipboardList,
  },
];

const complianceNavItems = [
  {
    label: "Compliance",
    href: "/compliance",
    icon: CalendarCheck,
  },
  {
    label: "Training",
    href: "/training",
    icon: GraduationCap,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    label: "Activity Log",
    href: "/activity",
    icon: Activity,
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
};

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl lg:block">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
          <Activity size={24} />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Senzilytics
          </h1>

          <p className="text-xs text-slate-400">
            EHS Intelligence
          </p>
        </div>
      </div>

      <nav className="space-y-7">
        <NavigationSection
          label="Platform"
          items={primaryNavItems}
        />

        <NavigationSection
          label="EHS Management"
          items={ehsNavItems}
        />

        <div>
          <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            Inspections
          </p>

          <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
            {inspectionNavItems.map((item) => {
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

        <NavigationSection
          label="Audits"
          items={auditNavItems}
        />

        <NavigationSection
          label="Governance"
          items={complianceNavItems}
        />
      </nav>
    </aside>
  );
}

function NavigationSection({
  label,
  items,
}: {
  label: string;
  items: NavigationItem[];
}) {
  return (
    <div>
      <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>

      <div className="space-y-2">
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
