import {
  OnboardingPlanForm,
  OnboardingStartForm,
  OnboardingStepForm,
} from "@/features/identity/onboarding-forms";
import {
  tenantOnboardingProgress,
  tenantOnboardingStepDefinitions,
} from "@/modules/platform/tenant-onboarding-lifecycle";
import {
  TenantOnboardingStatus,
  TenantOnboardingStepStatus,
} from "@prisma/client";
import { CalendarClock, CheckCircle2, CircleAlert, Rocket } from "lucide-react";

type WorkspacePlan = {
  status: TenantOnboardingStatus;
  targetGoLiveAt: Date | null;
  customerOwnerId: string | null;
  platformOwnerName: string | null;
  platformOwnerEmail: string | null;
  tenantVisibleNotes: string | null;
  internalNotes: string | null;
  liveAt: Date | null;
  goLiveApprovedAt: Date | null;
  steps: Array<{
    key: (typeof tenantOnboardingStepDefinitions)[number]["key"];
    status: TenantOnboardingStepStatus;
    ownerId: string | null;
    dueAt: Date | null;
    tenantNotes: string | null;
    blocker: string | null;
    owner: { name: string } | null;
  }>;
};

export function OnboardingWorkspace({
  organization,
  plan,
  users,
  platform,
}: {
  organization: { id: string; name: string; subscriptionPlan: string };
  plan: WorkspacePlan | null;
  users: Array<{ id: string; name: string; email: string }>;
  platform: boolean;
}) {
  if (!plan) {
    return (
      <OnboardingStartForm
        organizationId={platform ? organization.id : undefined}
        platform={platform}
      />
    );
  }

  const progress = tenantOnboardingProgress(plan.steps);
  const stepByKey = new Map(plan.steps.map((step) => [step.key, step]));
  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[.08] to-blue-500/[.03] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <Rocket size={16} /> Production onboarding
            </p>
            <h2 className="mt-2 text-3xl font-bold">{organization.name}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {pretty(organization.subscriptionPlan)} implementation ·{" "}
              {pretty(plan.status)}
            </p>
          </div>
          <div className="min-w-40 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-center">
            <p className="text-3xl font-bold text-cyan-200">{progress}%</p>
            <p className="mt-1 text-xs text-slate-500">Launch readiness</p>
          </div>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <CalendarClock size={14} />
            Target: {plan.targetGoLiveAt ? formatDate(plan.targetGoLiveAt) : "Not set"}
          </span>
          {plan.liveAt && (
            <span className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 size={14} /> Live since {formatDate(plan.liveAt)}
            </span>
          )}
        </div>
      </section>

      <OnboardingPlanForm
        organizationId={organization.id}
        platform={platform}
        users={users}
        plan={{
          targetGoLiveAt: dateInput(plan.targetGoLiveAt),
          customerOwnerId: plan.customerOwnerId,
          tenantVisibleNotes: plan.tenantVisibleNotes,
          platformOwnerName: platform ? plan.platformOwnerName : undefined,
          platformOwnerEmail: platform ? plan.platformOwnerEmail : undefined,
          internalNotes: platform ? plan.internalNotes : undefined,
        }}
      />

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Launch controls</h2>
          <p className="mt-1 text-sm text-slate-400">
            Completion gates verify system configuration before accepting a step.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {tenantOnboardingStepDefinitions.map((definition, index) => {
            const step = stepByKey.get(definition.key);
            if (!step) return null;
            return (
              <article
                key={definition.key}
                className={`rounded-3xl border p-6 ${
                  step.status === TenantOnboardingStepStatus.BLOCKED
                    ? "border-red-400/25 bg-red-400/[.04]"
                    : step.status === TenantOnboardingStepStatus.COMPLETED ||
                        step.status === TenantOnboardingStepStatus.WAIVED
                      ? "border-emerald-400/20 bg-emerald-400/[.03]"
                      : "border-white/10 bg-white/[.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-cyan-300">
                      STEP {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">{definition.label}</h3>
                  </div>
                  <StatusBadge status={step.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {definition.description}
                </p>
                {(step.owner || step.dueAt) && (
                  <p className="mt-3 text-xs text-slate-500">
                    {step.owner ? `Owner: ${step.owner.name}` : "Owner unassigned"}
                    {step.dueAt ? ` · Due ${formatDate(step.dueAt)}` : ""}
                  </p>
                )}
                {step.blocker && (
                  <p className="mt-3 flex gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" />
                    {step.blocker}
                  </p>
                )}
                <OnboardingStepForm
                  organizationId={organization.id}
                  platform={platform}
                  users={users}
                  step={{
                    key: step.key,
                    status: step.status,
                    ownerId: step.ownerId,
                    dueAt: dateInput(step.dueAt),
                    tenantNotes: step.tenantNotes,
                    blocker: step.blocker,
                  }}
                />
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: TenantOnboardingStepStatus }) {
  const color =
    status === TenantOnboardingStepStatus.BLOCKED
      ? "bg-red-400/10 text-red-300"
      : status === TenantOnboardingStepStatus.COMPLETED ||
          status === TenantOnboardingStepStatus.WAIVED
        ? "bg-emerald-400/10 text-emerald-300"
        : status === TenantOnboardingStepStatus.IN_PROGRESS
          ? "bg-cyan-400/10 text-cyan-200"
          : "bg-slate-800 text-slate-400";
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${color}`}>
      {pretty(status)}
    </span>
  );
}

function dateInput(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
