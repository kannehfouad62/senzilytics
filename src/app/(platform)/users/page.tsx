import { prisma } from "@/lib/prisma";
import { Users } from "lucide-react";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { inviteTenantUser, setTenantUserActive } from "@/features/identity/tenant.actions";


export default async function UsersPage() {
  await requirePermission(PermissionKey.VIEW_USERS);
  const { organizationId } = await getCurrentUserTenant();

  const [users, departments] = await Promise.all([prisma.user.findMany({
  where: {
    organizationId,
  },
  orderBy: { name: "asc" },
  include: {
    organization: true,
    department: {
      include: {
        site: true,
      },
    },
  },
}), prisma.department.findMany({where:{site:{organizationId}},include:{site:true},orderBy:{name:"asc"}})]);

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <Users size={16} />
          Identity & Access
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">Users</h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          View users, roles, departments, sites, and organization assignments.
        </p>
      </div>

      <form action={inviteTenantUser} className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:grid-cols-2 xl:grid-cols-5">
        <input name="name" required placeholder="Full name" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"/><input name="email" type="email" required placeholder="Email" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"/><select name="role" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3">{Object.values(UserRole).filter(x=>x!==UserRole.SUPER_ADMIN).map(x=><option key={x}>{x}</option>)}</select><select name="departmentId" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">No department</option>{departments.map(x=><option key={x.id} value={x.id}>{x.site.name} — {x.name}</option>)}</select><button className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950">Invite User</button>
      </form>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-slate-300">
            <tr>
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Job Title</th>
              <th className="px-6 py-4 font-medium">Organization</th>
              <th className="px-6 py-4 font-medium">Site</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium">Access</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-6 py-5">
                  <p className="font-medium text-white">{user.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{user.email}</p>
                </td>

                <td className="px-6 py-5">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {user.role.replaceAll("_", " ")}
                  </span>
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {user.jobTitle || "N/A"}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {user.organization?.name || "N/A"}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {user.department?.site.name || "N/A"}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {user.department?.name || "N/A"}
                </td>
                <td className="px-6 py-5"><form action={setTenantUserActive}><input type="hidden" name="id" value={user.id}/><input type="hidden" name="active" value={user.isActive?"false":"true"}/><button className={user.isActive?"text-emerald-300":"text-red-300"}>{user.isActive?"Active · Suspend":"Suspended · Restore"}</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}
