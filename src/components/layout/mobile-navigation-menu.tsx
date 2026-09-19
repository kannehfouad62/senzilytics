"use client";

import { Menu } from "lucide-react";
import { useRef, type MouseEvent, type ReactNode } from "react";

export function MobileNavigationMenu({ children }: { children: ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeAfterNavigation(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) {
      detailsRef.current?.removeAttribute("open");
    }
  }

  return (
    <details ref={detailsRef} className="relative lg:hidden">
      <summary
        className="flex cursor-pointer list-none items-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300"
        title="Open navigation"
      >
        <Menu size={20} />
      </summary>
      <div
        className="fixed bottom-3 left-3 top-[4.75rem] z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/98 p-3 shadow-2xl backdrop-blur-xl"
        onClick={closeAfterNavigation}
      >
        {children}
      </div>
    </details>
  );
}
