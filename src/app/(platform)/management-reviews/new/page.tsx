import { ExecutiveReviewCreateForm } from "@/features/executive-review/executive-review-forms";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function NewManagementReviewPage() {
  await requirePermission(PermissionKey.MANAGE_EXECUTIVE_REVIEWS);
  const { organizationId } = await getCurrentUserTenant();
  const [sites, users] = await Promise.all([
    prisma.site.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/management-reviews"
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Management review register
      </Link>
      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ShieldCheck size={17} />
          Controlled review planning
        </p>
        <h1 className="mt-2 text-4xl font-bold">
          Create enterprise management review
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Define the reporting boundary, accountable chair, cadence, scope, and
          intended decisions. Evidence remains live until the review is
          formally started.
        </p>
      </div>
      <div className="mt-8">
        <ExecutiveReviewCreateForm sites={sites} users={users} />
      </div>
    </div>
  );
}
