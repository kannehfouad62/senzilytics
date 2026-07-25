"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  changeConfigurableFormAssignment,
  deleteConfigurableForm,
  updateConfigurableFormSettings,
} from "@/features/forms/actions";
import { ConfigurableFormModule } from "@prisma/client";
import {
  CheckCircle2,
  CircleAlert,
  Link2,
  Link2Off,
  Save,
  Trash2,
} from "lucide-react";
import { useActionState } from "react";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400/40";

export function FormDefinitionManagement({
  form,
}: {
  form: {
    id: string;
    name: string;
    description: string | null;
    module: ConfigurableFormModule;
    isActive: boolean;
    submissionCount: number;
  };
}) {
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">Definition management</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Assignment & lifecycle
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Adjust the form definition, move it to another module, temporarily
            unassign it, or permanently delete it when no historical submission
            depends on it.
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            form.isActive
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {form.isActive ? "ASSIGNED" : "UNASSIGNED"}
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SettingsForm form={form} />
        <div className="space-y-6">
          <AssignmentForm form={form} />
          <DeleteForm form={form} />
        </div>
      </div>
    </section>
  );
}

function SettingsForm({
  form,
}: {
  form: {
    id: string;
    name: string;
    description: string | null;
    module: ConfigurableFormModule;
  };
}) {
  const [state, action, pending] = useActionState(
    updateConfigurableFormSettings,
    initialFormActionState,
  );
  return (
    <form action={action} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <input type="hidden" name="definitionId" value={form.id} />
      <h3 className="text-lg font-semibold">Form settings</h3>
      <label className="mt-4 block text-sm text-slate-300">
        Form name
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={form.name}
          className={input}
        />
      </label>
      <label className="mt-4 block text-sm text-slate-300">
        Assigned module
        <select name="module" defaultValue={form.module} className={input}>
          {Object.values(ConfigurableFormModule).map((module) => (
            <option key={module} value={module}>
              {pretty(module)}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm text-slate-300">
        Description
        <textarea
          name="description"
          rows={4}
          maxLength={2_000}
          defaultValue={form.description || ""}
          className={input}
        />
      </label>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        <Save size={16} />
        {pending ? "Saving…" : "Save adjustments"}
      </button>
    </form>
  );
}

function AssignmentForm({
  form,
}: {
  form: {
    id: string;
    module: ConfigurableFormModule;
    isActive: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    changeConfigurableFormAssignment,
    initialFormActionState,
  );
  const nextAssigned = !form.isActive;
  const Icon = nextAssigned ? Link2 : Link2Off;
  return (
    <form action={action} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <input type="hidden" name="definitionId" value={form.id} />
      <input
        type="hidden"
        name="assignment"
        value={nextAssigned ? "ASSIGNED" : "UNASSIGNED"}
      />
      <h3 className="text-lg font-semibold">
        {form.isActive ? "Unassign form" : "Assign form"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {form.isActive
          ? `Stop showing this form in ${pretty(form.module)} while preserving its versions and every historical submission.`
          : `Make the current published version available in ${pretty(form.module)}. Draft-only forms will become operational after publication.`}
      </p>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 px-5 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50"
      >
        <Icon size={16} />
        {pending
          ? "Updating…"
          : nextAssigned
            ? "Assign to module"
            : "Unassign from module"}
      </button>
    </form>
  );
}

function DeleteForm({
  form,
}: {
  form: { id: string; name: string; submissionCount: number };
}) {
  const [state, action, pending] = useActionState(
    deleteConfigurableForm,
    initialFormActionState,
  );
  const blocked = form.submissionCount > 0;
  return (
    <form action={action} className="rounded-2xl border border-red-400/20 bg-red-400/[.04] p-5">
      <input type="hidden" name="definitionId" value={form.id} />
      <h3 className="text-lg font-semibold text-red-200">Permanent deletion</h3>
      {blocked ? (
        <p className="mt-2 text-sm leading-6 text-red-200/80">
          This form has {form.submissionCount} historical submission
          {form.submissionCount === 1 ? "" : "s"}. It cannot be deleted;
          unassign it to stop future use without breaking the audit trail.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This form has never been submitted and may be permanently deleted.
            Type <strong className="text-white">{form.name}</strong> to confirm.
          </p>
          <label className="mt-4 block text-sm text-slate-300">
            Confirmation
            <input
              name="confirmation"
              required
              autoComplete="off"
              placeholder={form.name}
              className={input}
            />
          </label>
        </>
      )}
      <Feedback state={state} />
      <button
        disabled={pending || blocked}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-400/15 px-5 py-3 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={16} />
        {pending ? "Deleting…" : "Delete form permanently"}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: FormActionState }) {
  if (!state.message) return null;
  const success = state.status === "SUCCESS";
  const Icon = success ? CheckCircle2 : CircleAlert;
  return (
    <p
      role={success ? "status" : "alert"}
      aria-live="polite"
      className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
        success
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/20 bg-red-400/10 text-red-200"
      }`}
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
