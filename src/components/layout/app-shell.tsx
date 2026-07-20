import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children, isDemo = false }: { children: React.ReactNode; isDemo?: boolean }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        {isDemo && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs text-amber-100 sm:px-8"><p><strong>Interactive Demo</strong> · Fictional data · Read-only · Session expires automatically</p><a href="mailto:sales@senzilytics.com?subject=Senzilytics%20consultation" className="font-semibold text-amber-200 underline underline-offset-2">Request a consultation</a></div>}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
