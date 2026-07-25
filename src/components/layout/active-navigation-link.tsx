"use client";

import { resolveActiveNavigationHref } from "@/core/permissions/navigation-access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ActiveNavigationLink({
  href,
  matchHrefs,
  children,
  className,
  activeClassName,
  inactiveClassName,
}: {
  href: string;
  matchHrefs: readonly string[];
  children: ReactNode;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
}) {
  const pathname = usePathname();
  const active = resolveActiveNavigationHref(pathname, matchHrefs) === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  );
}
