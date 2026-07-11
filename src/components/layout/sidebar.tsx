import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  SearchCheck,
  Settings,
  ShieldCheck,
  Users,
  ClipboardList, GitBranch, FolderOpen,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Workflows", href: "/workflows", icon: GitBranch },
  { label: "Organizations", href: "/organizations", icon: Building2 },
  { label: "Users", href: "/users", icon: Users },
  { label: "Incidents", href: "/incidents", icon: AlertTriangle },
  { label: "Corrective Actions", href: "/actions", icon: ClipboardCheck },
  { label: "Audits", href: "/audits", icon: SearchCheck },
  { label: "Inspections", href: "/inspections", icon: ShieldCheck },
  { label: "Compliance", href: "/compliance", icon: CalendarCheck },
  { label: "Training", href: "/training", icon: GraduationCap },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Activity Log", href: "/activity", icon: Activity },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl lg:block">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
          <Activity size={24} />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight">Senzilytics</h1>
          <p className="text-xs text-slate-400">EHS Intelligence</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
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
      </nav>
    </aside>
  );
}