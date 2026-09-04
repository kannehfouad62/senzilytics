"use client";

import { Menu, PanelLeftClose } from "lucide-react";
import { useState } from "react";

export function CollapsibleAppShell({
  sidebar,
  topbar,
  children,
  demoBanner,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  demoBanner?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      {expanded ? sidebar : null}
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls="desktop-application-navigation"
        className={`fixed top-4 z-50 hidden rounded-xl border border-cyan-400/20 bg-slate-950/95 p-3 text-cyan-200 shadow-xl transition hover:bg-cyan-400/10 lg:block ${expanded ? "left-[17.25rem]" : "left-4"}`}
        title={
          expanded ? "Collapse module navigation" : "Expand module navigation"
        }
      >
        {expanded ? <PanelLeftClose size={20} /> : <Menu size={20} />}
      </button>
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {topbar}
        {demoBanner}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
