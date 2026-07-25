"use client";

import { initialFormActionState, type FormActionState } from "@/core/actions/action-state";
import {
  createPerformanceIndicator,
  createPerformanceTarget,
  recordPerformanceMeasurement,
  reviewPerformanceMeasurement,
  setPerformanceIndicatorActive,
} from "@/features/performance/actions";
import {
  PerformanceIndicatorDirection,
  PerformanceIndicatorFrequency,
  PerformanceIndicatorSource,
  PerformanceIndicatorType,
  PerformanceMeasurementStatus,
  PerformanceSystemMetric,
} from "@prisma/client";
import { useActionState, useState, type ReactNode } from "react";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm";
const button =
  "mt-5 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

type IndicatorOption = {
  id: string;
  code: string;
  name: string;
  source: PerformanceIndicatorSource;
  isActive: boolean;
};
type SiteOption = { id: string; name: string };
type DepartmentOption = {
  id: string;
  name: string;
  siteId: string;
  site: { name: string };
};
type UserOption = { id: string; name: string; jobTitle: string | null };

export function PerformanceIndicatorForm({
  users,
}: {
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState(
    createPerformanceIndicator,
    initialFormActionState,
  );
  const [source, setSource] = useState<PerformanceIndicatorSource>(
    PerformanceIndicatorSource.SYSTEM,
  );

  return (
    <ManagedForm
      title="Create indicator"
      description="Define a governed leading or lagging measure. System indicators calculate from existing tenant records."
      action={action}
      pending={pending}
      state={state}
      submitLabel="Create Indicator"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="code" label="Code" placeholder="TR-COMP" required />
        <Field name="name" label="Indicator name" required />
        <Field name="category" label="Category" placeholder="Workforce readiness" required />
        <label className="text-sm">
          Owner
          <select name="ownerId" className={input} defaultValue="">
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}{user.jobTitle ? ` — ${user.jobTitle}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Indicator type
          <select name="type" className={input}>
            {Object.values(PerformanceIndicatorType).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Performance direction
          <select name="direction" className={input}>
            {Object.values(PerformanceIndicatorDirection).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Reporting frequency
          <select name="reportingFrequency" className={input}>
            {Object.values(PerformanceIndicatorFrequency).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Data source
          <select
            name="source"
            className={input}
            value={source}
            onChange={(event) =>
              setSource(event.target.value as PerformanceIndicatorSource)
            }
          >
            {Object.values(PerformanceIndicatorSource).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        {source === PerformanceIndicatorSource.SYSTEM ? (
          <label className="text-sm md:col-span-2">
            System metric
            <select name="systemMetric" className={input} required>
              {Object.values(PerformanceSystemMetric).map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Field
            name="unit"
            label="Reporting unit"
            placeholder="%, count, days, hours"
            required
          />
        )}
        <label className="text-sm md:col-span-2">
          Description
          <textarea name="description" rows={2} className={input} />
        </label>
        <label className="text-sm md:col-span-2">
          Methodology and governance notes
          <textarea
            name="methodology"
            rows={3}
            className={input}
            placeholder="Define inclusion rules, exclusions, source controls, and reporting responsibility."
          />
        </label>
      </div>
    </ManagedForm>
  );
}

export function PerformanceTargetForm({
  indicators,
  sites,
  departments,
}: {
  indicators: IndicatorOption[];
  sites: SiteOption[];
  departments: DepartmentOption[];
}) {
  const [state, action, pending] = useActionState(
    createPerformanceTarget,
    initialFormActionState,
  );
  return (
    <ManagedForm
      title="Set target and control bands"
      description="Targets are effective-dated. Leave site and department blank for an organization-wide target."
      action={action}
      pending={pending}
      state={state}
      submitLabel="Create Target"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <IndicatorSelect indicators={indicators.filter((item) => item.isActive)} />
        <ScopeFields sites={sites} departments={departments} />
        <Field name="targetValue" label="Target" type="number" step="any" required />
        <Field
          name="warningThreshold"
          label="Warning threshold"
          type="number"
          step="any"
          required
        />
        <Field
          name="criticalThreshold"
          label="Critical threshold"
          type="number"
          step="any"
          required
        />
        <Field name="effectiveFrom" label="Effective from" type="date" required />
        <Field name="effectiveTo" label="Effective to" type="date" />
        <label className="text-sm md:col-span-2">
          Rationale
          <textarea name="rationale" rows={2} className={input} />
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Higher-is-better: target &gt; warning &gt; critical. Lower-is-better:
        target &lt; warning &lt; critical.
      </p>
    </ManagedForm>
  );
}

export function PerformanceMeasurementForm({
  indicators,
  sites,
  departments,
}: {
  indicators: IndicatorOption[];
  sites: SiteOption[];
  departments: DepartmentOption[];
}) {
  const [state, action, pending] = useActionState(
    recordPerformanceMeasurement,
    initialFormActionState,
  );
  const manualIndicators = indicators.filter(
    (item) =>
      item.isActive && item.source === PerformanceIndicatorSource.MANUAL,
  );
  return (
    <ManagedForm
      title="Record manual measurement"
      description="Manual values remain draft until reviewed. Approved values are immutable."
      action={action}
      pending={pending}
      state={state}
      submitLabel="Save Draft"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <IndicatorSelect indicators={manualIndicators} />
        <ScopeFields sites={sites} departments={departments} />
        <Field name="value" label="Measured value" type="number" step="any" required />
        <Field name="periodStart" label="Period start" type="date" required />
        <Field name="periodEnd" label="Period end" type="date" required />
        <label className="text-sm md:col-span-2">
          Evidence summary
          <textarea name="evidenceSummary" rows={2} className={input} required />
        </label>
        <label className="text-sm md:col-span-2">
          Notes
          <textarea name="notes" rows={2} className={input} />
        </label>
      </div>
      {manualIndicators.length === 0 && (
        <p className="mt-3 text-xs text-amber-300">
          Create a manual indicator before recording a manual measurement.
        </p>
      )}
    </ManagedForm>
  );
}

export function PerformanceMeasurementReviewForm({
  measurementId,
}: {
  measurementId: string;
}) {
  const [state, action, pending] = useActionState(
    reviewPerformanceMeasurement,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="measurementId" value={measurementId} />
      <input
        name="reviewNotes"
        placeholder="Review notes; required when rejecting"
        className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"
      />
      <button
        name="status"
        value={PerformanceMeasurementStatus.APPROVED}
        disabled={pending}
        className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300"
      >
        Approve
      </button>
      <button
        name="status"
        value={PerformanceMeasurementStatus.REJECTED}
        disabled={pending}
        className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300"
      >
        Reject
      </button>
      <Feedback state={state} className="sm:col-span-3" />
    </form>
  );
}

export function PerformanceIndicatorStatusForm({
  indicatorId,
  isActive,
}: {
  indicatorId: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(
    setPerformanceIndicatorActive,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="indicatorId" value={indicatorId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <button
        disabled={pending}
        className={`rounded-lg border px-3 py-2 text-xs ${
          isActive
            ? "border-amber-400/20 text-amber-300"
            : "border-emerald-400/20 text-emerald-300"
        }`}
      >
        {pending ? "Updating…" : isActive ? "Retire" : "Reactivate"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ManagedForm({
  title,
  description,
  action,
  pending,
  state,
  submitLabel,
  children,
}: {
  title: string;
  description: string;
  action: (data: FormData) => void;
  pending: boolean;
  state: FormActionState;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <form action={action} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      <div className="mt-5">{children}</div>
      <button disabled={pending} className={button}>
        {pending ? "Saving…" : submitLabel}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function IndicatorSelect({ indicators }: { indicators: IndicatorOption[] }) {
  return (
    <label className="text-sm md:col-span-2">
      Indicator
      <select name="indicatorId" required className={input} defaultValue="">
        <option value="" disabled>
          Select indicator
        </option>
        {indicators.map((indicator) => (
          <option key={indicator.id} value={indicator.id}>
            {indicator.code} — {indicator.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScopeFields({
  sites,
  departments,
}: {
  sites: SiteOption[];
  departments: DepartmentOption[];
}) {
  return (
    <>
      <label className="text-sm">
        Site scope
        <select name="siteId" className={input} defaultValue="">
          <option value="">Organization-wide</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Department scope
        <select name="departmentId" className={input} defaultValue="">
          <option value="">No department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.site.name} — {department.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function Field({
  label: fieldLabel,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      {fieldLabel}
      <input {...props} className={input} />
    </label>
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
  return (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      className={`mt-3 rounded-xl border p-3 text-xs ${
        state.status === "ERROR"
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      } ${className}`}
    >
      {state.message}
    </p>
  );
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
