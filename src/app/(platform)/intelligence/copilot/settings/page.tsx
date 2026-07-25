import { CopilotPolicyForm } from "@/features/intelligence/enterprise-copilot-forms";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getAiCopilotPolicyService } from "@/modules/intelligence/enterprise-copilot.service";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, LockKeyhole, Settings2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EnterpriseEhsCopilotSettingsPage() {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  await requirePermission(PermissionKey.USE_AI);
  const { organizationId } = await getCurrentUserTenant();
  const policy = await getAiCopilotPolicyService(organizationId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/intelligence/copilot"
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Enterprise EHS Copilot
      </Link>
      <p className="mt-6 flex items-center gap-2 text-sm text-purple-300">
        <Settings2 size={17} />
        Administrative control
      </p>
      <h1 className="mt-2 text-4xl font-bold">Tenant Copilot policy</h1>
      <p className="mt-2 max-w-3xl text-slate-400">
        Control availability, conversation context, maximum turns, and the
        period for which private conversation content and frozen citations are
        retained.
      </p>

      <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/[.05] p-4 text-sm text-cyan-100">
        <LockKeyhole size={18} className="mr-2 inline" />
        Policy changes apply to new turns. Existing content remains private to
        its conversation owner and is automatically redacted when its current
        retention date expires.
      </div>

      <div className="mt-8">
        <CopilotPolicyForm policy={policy} />
      </div>
      {policy.updatedBy ? (
        <p className="mt-4 text-xs text-slate-500">
          Last updated by {policy.updatedBy.name}
          {policy.updatedAt ? ` on ${policy.updatedAt.toLocaleString()}` : ""}.
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Default Senzilytics Copilot policy is currently active.
        </p>
      )}
    </div>
  );
}
