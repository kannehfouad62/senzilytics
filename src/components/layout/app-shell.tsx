import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CollapsibleAppShell } from "./collapsible-app-shell";

export function AppShell({
  children,
  isDemo = false,
}: {
  children: React.ReactNode;
  isDemo?: boolean;
}) {
  return (
    <CollapsibleAppShell
      sidebar={
        <div id="desktop-application-navigation">
          <Sidebar />
        </div>
      }
      topbar={<Topbar />}
      demoBanner={
        isDemo ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs text-amber-100 sm:px-8">
            <p>
              <strong>Interactive Demo</strong> · Fictional data · Read-only ·
              Session expires automatically
            </p>
            <a
              href="mailto:sales@senzilytics.com?subject=Senzilytics%20consultation"
              className="font-semibold text-amber-200 underline underline-offset-2"
            >
              Request a consultation
            </a>
          </div>
        ) : undefined
      }
    >
      {children}
    </CollapsibleAppShell>
  );
}
