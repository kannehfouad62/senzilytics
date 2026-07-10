import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Bell, ClipboardList, LogOut, Search, Sparkles } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function Topbar() {
  const session = await auth();

  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          id: true,
          name: true,
          role: true,
          organizationId: true,
        },
      })
    : null;

  const unreadCount = currentUser
    ? await prisma.notification.count({
        where: {
          userId: currentUser.id,
          readAt: null,
        },
      })
    : 0;

  const taskCount = currentUser?.organizationId
    ? await prisma.workflowInstanceStep.count({
        where: {
          status: "IN_PROGRESS",
          instance: {
            organizationId: currentUser.organizationId,
            status: "ACTIVE",
          },
          OR: [
            { assignedUserId: currentUser.id },
            { assignedRole: currentUser.role },
            { assignedRole: null },
          ],
        },
      })
    : 0;

  const overdueTaskCount = currentUser?.organizationId
    ? await prisma.workflowInstanceStep.count({
        where: {
          status: "IN_PROGRESS",
          dueAt: {
            lt: new Date(),
          },
          instance: {
            organizationId: currentUser.organizationId,
            status: "ACTIVE",
          },
          OR: [
            { assignedUserId: currentUser.id },
            { assignedRole: currentUser.role },
            { assignedRole: null },
          ],
        },
      })
    : 0;

  async function logout() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-white/10 bg-slate-950/50 px-8 backdrop-blur-xl">
      <div>
        <p className="text-sm text-cyan-300">AI Command Center</p>
        <h2 className="text-xl font-semibold">Enterprise Risk Overview</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:flex">
          <Search size={18} className="text-slate-400" />
          <span className="text-sm text-slate-400">
            Search incidents, audits, actions...
          </span>
        </div>

        <button className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
          <Sparkles size={20} />
        </button>

        <Link
          href="/tasks"
          className="relative rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10"
          title="My Tasks"
        >
          <ClipboardList size={20} />

          {taskCount > 0 && (
            <span
              className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-slate-950 ${
                overdueTaskCount > 0 ? "bg-red-400" : "bg-orange-400"
              }`}
            >
              {overdueTaskCount > 0 ? overdueTaskCount : taskCount}
            </span>
          )}
        </Link>

        <Link
          href="/notifications"
          className="relative rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10"
          title="Notifications"
        >
          <Bell size={20} />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-xs font-bold text-slate-950">
              {unreadCount}
            </span>
          )}
        </Link>

        <div className="hidden text-right md:block">
          <p className="text-sm font-medium text-white">{currentUser?.name}</p>
          <p className="text-xs text-slate-400">
            {currentUser?.role?.replaceAll("_", " ")}
          </p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-red-300 transition hover:bg-red-400/20"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </header>
  );
}