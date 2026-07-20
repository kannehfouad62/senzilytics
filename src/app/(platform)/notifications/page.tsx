import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { Bell, CheckCircle2 } from "lucide-react";
import { markNotificationRead } from "@/core/notifications/notifications.actions";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const { organizationId, user } = await getCurrentUserTenant();
  if (!await hasSubscriptionFeature(organizationId, "IN_APP_NOTIFICATIONS")) redirect("/subscription?feature=notifications");

  const notifications = await prisma.notification.findMany({
    where: {
      organizationId,
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <Bell size={16} />
          Notification Center
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Notifications
        </h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Review assignments, alerts, due date reminders, workflow events, and
          system notifications.
        </p>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-3xl border p-5 shadow-2xl backdrop-blur-xl ${
              notification.readAt
                ? "border-white/10 bg-white/5"
                : "border-cyan-400/20 bg-cyan-400/10"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-cyan-300">{notification.type}</p>
                <h2 className="mt-1 text-lg font-semibold">
                  {notification.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {notification.message}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {notification.createdAt.toLocaleString()}
                </p>
              </div>

              {!notification.readAt && (
                <form action={markNotificationRead}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  <input
                    type="hidden"
                    name="link"
                    value={notification.link || "/notifications"}
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    <CheckCircle2 size={16} />
                    Open
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No notifications found.
          </div>
        )}
      </div>
    </div>
  );
}
