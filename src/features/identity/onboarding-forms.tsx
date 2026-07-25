"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  startPlatformTenantOnboarding,
  startTenantOnboarding,
  updatePlatformTenantOnboardingMetadata,
  updatePlatformTenantOnboardingStepAction,
  updateTenantOnboardingMetadata,
  updateTenantOnboardingStepAction,
} from "@/features/identity/onboarding.actions";
import {
  TenantOnboardingStepKey,
  TenantOnboardingStepStatus,
} from "@prisma/client";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

type UserOption = { id: string; name: string; email: string };
type Step = {
  key: TenantOnboardingStepKey;
  status: TenantOnboardingStepStatus;
  ownerId: string | null;
  dueAt: string | null;
  tenantNotes: string | null;
  blocker: string | null;
};

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-400/40";

export function OnboardingStartForm({
  organizationId,
  platform,
}: {
  organizationId?: string;
  platform: boolean;
}) {
  const [state, action, pending] = useActionState(
    platform ? startPlatformTenantOnboarding : startTenantOnboarding,
    initialFormActionState,
  );
  return (
    <form action={action} className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.04] p-8">
      {organizationId && (
        <input type="hidden" name="organizationId" value={organizationId} />
      )}
      <h2 className="text-2xl font-semibold">Initialize implementation plan</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Create the governed nine-step checklist used to prepare this tenant for
        production go-live.
      </p>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Initializing…" : "Start implementation"}
      </button>
    </form>
  );
}

export function OnboardingPlanForm({
  organizationId,
  platform,
  users,
  plan,
}: {
  organizationId: string;
  platform: boolean;
  users: UserOption[];
  plan: {
    targetGoLiveAt: string | null;
    customerOwnerId: string | null;
    tenantVisibleNotes: string | null;
    platformOwnerName?: string | null;
    platformOwnerEmail?: string | null;
    internalNotes?: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    platform
      ? updatePlatformTenantOnboardingMetadata
      : updateTenantOnboardingMetadata,
    initialFormActionState,
  );
  return (
    <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
      <input type="hidden" name="organizationId" value={organizationId} />
      <h2 className="text-xl font-semibold">Implementation ownership</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-300">
          Target go-live
          <input
            type="date"
            name="targetGoLiveAt"
            defaultValue={plan.targetGoLiveAt || ""}
            className={input}
          />
        </label>
        <label className="text-sm text-slate-300">
          Tenant owner
          <select
            name="customerOwnerId"
            defaultValue={plan.customerOwnerId || ""}
            className={input}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {user.email}
              </option>
            ))}
          </select>
        </label>
        {platform && (
          <>
            <label className="text-sm text-slate-300">
              Senzilytics implementation owner
              <input
                name="platformOwnerName"
                maxLength={120}
                defaultValue={plan.platformOwnerName || ""}
                className={input}
              />
            </label>
            <label className="text-sm text-slate-300">
              Senzilytics owner email
              <input
                type="email"
                name="platformOwnerEmail"
                defaultValue={plan.platformOwnerEmail || ""}
                placeholder="name@senzilytics.com"
                className={input}
              />
            </label>
          </>
        )}
        <label className="text-sm text-slate-300 md:col-span-2">
          Shared implementation notes
          <textarea
            name="tenantVisibleNotes"
            maxLength={2_000}
            rows={3}
            defaultValue={plan.tenantVisibleNotes || ""}
            className={input}
          />
        </label>
        {platform && (
          <label className="text-sm text-slate-300 md:col-span-2">
            Internal Senzilytics notes
            <textarea
              name="internalNotes"
              maxLength={4_000}
              rows={3}
              defaultValue={plan.internalNotes || ""}
              className={input}
            />
            <span className="mt-2 block text-xs text-amber-200">
              Internal notes are never rendered in the tenant workspace.
            </span>
          </label>
        )}
      </div>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save ownership"}
      </button>
    </form>
  );
}

export function OnboardingStepForm({
  organizationId,
  platform,
  users,
  step,
}: {
  organizationId: string;
  platform: boolean;
  users: UserOption[];
  step: Step;
}) {
  const [state, action, pending] = useActionState(
    platform
      ? updatePlatformTenantOnboardingStepAction
      : updateTenantOnboardingStepAction,
    initialFormActionState,
  );
  const goLive = step.key === TenantOnboardingStepKey.GO_LIVE_APPROVAL;
  if (goLive && !platform) {
    return (
      <p className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[.04] p-4 text-sm text-slate-400">
        Senzilytics will complete this approval after all prerequisite steps are
        complete or formally waived.
      </p>
    );
  }
  const statuses = Object.values(TenantOnboardingStepStatus).filter(
    (status) =>
      !goLive ||
      ([
        TenantOnboardingStepStatus.NOT_STARTED,
        TenantOnboardingStepStatus.IN_PROGRESS,
        TenantOnboardingStepStatus.BLOCKED,
        TenantOnboardingStepStatus.COMPLETED,
      ] as TenantOnboardingStepStatus[]).includes(status),
  );
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="key" value={step.key} />
      <label className="text-xs text-slate-400">
        Status
        <select name="status" defaultValue={step.status} className={input}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {pretty(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Accountable owner
        <select name="ownerId" defaultValue={step.ownerId || ""} className={input}>
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Due date
        <input
          type="date"
          name="dueAt"
          defaultValue={step.dueAt || ""}
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400">
        Blocker
        <input
          name="blocker"
          maxLength={1_000}
          defaultValue={step.blocker || ""}
          placeholder="Required when blocked"
          className={input}
        />
      </label>
      <label className="text-xs text-slate-400 md:col-span-2">
        Evidence, notes, or waiver rationale
        <textarea
          name="tenantNotes"
          maxLength={2_000}
          rows={3}
          defaultValue={step.tenantNotes || ""}
          className={input}
        />
      </label>
      <Feedback state={state} className="md:col-span-2" />
      <button
        disabled={pending}
        className="rounded-xl border border-cyan-400/25 px-4 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50 md:col-span-2"
      >
        {pending ? "Saving…" : goLive ? "Apply go-live decision" : "Update step"}
      </button>
    </form>
  );
}

function Feedback({
  state,
  className = "",
}: {
  state: FormActionState;
  className?: string;
}) {
  if (!state.message) return null;
  const success = state.status === "SUCCESS";
  const Icon = success ? CheckCircle2 : state.status === "ERROR" ? CircleAlert : LoaderCircle;
  return (
    <p
      role={success ? "status" : "alert"}
      className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
        success
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/20 bg-red-400/10 text-red-300"
      } ${className}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      {state.message}
    </p>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
