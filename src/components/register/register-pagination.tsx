import Link from "next/link";

export function RegisterPagination({ action, search, page, pages }: { action: string; search: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (target: number) => `${action}?${new URLSearchParams({ ...(search ? { search } : {}), page: String(target) })}`;
  return <div className="flex items-center justify-between border-t border-white/10 p-4 text-sm"><span className="text-slate-400">Page {page} of {pages}</span><div className="flex gap-2">{page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-white/10 px-4 py-2">Previous</Link>}{page < pages && <Link href={href(page + 1)} className="rounded-lg border border-white/10 px-4 py-2">Next</Link>}</div></div>;
}
