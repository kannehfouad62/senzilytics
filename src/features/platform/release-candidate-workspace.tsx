"use client";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  assignPlatformReleasePilotAction,
  createPlatformReleaseAction,
  decidePlatformReleaseAction,
  recordPlatformReleasePilotOutcomeAction,
  removePlatformReleasePilotAction,
  startPlatformReleasePilotAction,
  submitPlatformReleaseAction,
  updatePlatformReleaseCheckAction,
  updatePlatformReleaseMetadataAction,
} from "@/features/platform/release-candidate.actions";
import { platformReleaseCheckDefinitions } from "@/modules/platform/release-candidate";
import {
  PlatformReleaseCheckKey,
  PlatformReleaseCheckStatus,
  PlatformReleasePilotStatus,
  PlatformReleaseStatus,
} from "@prisma/client";
import {
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Play,
  Rocket,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50";

type ReleaseCheck = {
  id: string;
  key: PlatformReleaseCheckKey;
  status: PlatformReleaseCheckStatus;
  testMethod: string | null;
  evidenceSummary: string | null;
  resultNotes: string | null;
  evidenceUrl: string | null;
  testedAt: string | null;
  testedBy: { name: string } | null;
};

type ReleasePilot = {
  id: string;
  status: PlatformReleasePilotStatus;
  plannedStartAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  exitCriteria: string;
  resultSummary: string | null;
  organization: { id: string; name: string };
};

export type ReleaseCandidateDetail = {
  id: string;
  version: string;
  commitSha: string;
  deploymentUrl: string;
  status: PlatformReleaseStatus;
  releaseNotes: string | null;
  riskSummary: string | null;
  rollbackPlan: string | null;
  targetCertificationAt: string | null;
  submissionNotes: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  pilotStartedAt: string | null;
  releasedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  createdBy: { name: string };
  submittedBy: { name: string } | null;
  reviewedBy: { name: string } | null;
  checks: ReleaseCheck[];
  pilots: ReleasePilot[];
};

export type PilotTenantOption = {
  id: string;
  name: string;
  onboardingStatus: string | null;
  readinessStatus: string | null;
  readinessVersion: number | null;
  eligibilityIssues: string[];
};

export function CreateReleaseCandidateForm() {
  const [state, action, pending] = useActionState(
    createPlatformReleaseAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.035] p-6"
    >
      <p className="flex items-center gap-2 text-sm text-cyan-300">
        <Rocket size={17} /> New release candidate
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Open certification record</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Release version">
          <input
            name="version"
            required
            maxLength={40}
            placeholder="1.1.0-rc.1"
            className={input}
          />
        </Field>
        <Field label="Git commit SHA">
          <input
            name="commitSha"
            required
            minLength={7}
            maxLength={64}
            placeholder="44f868b"
            className={input}
          />
        </Field>
        <Field label="Candidate deployment URL">
          <input
            name="deploymentUrl"
            required
            type="url"
            placeholder="https://candidate.example.com"
            className={input}
          />
        </Field>
        <Field label="Target certification date">
          <input name="targetCertificationAt" type="date" className={input} />
        </Field>
      </div>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Rocket size={17} />}
        {pending ? "Creating…" : "Create release candidate"}
      </button>
    </form>
  );
}

export function ReleaseCandidateWorkspace({
  release,
  progress,
  tenantOptions,
}: {
  release: ReleaseCandidateDetail;
  progress: number;
  tenantOptions: PilotTenantOption[];
}) {
  const editable =
    release.status === PlatformReleaseStatus.DRAFT ||
    release.status === PlatformReleaseStatus.REJECTED;
  const checksByKey = new Map(release.checks.map((check) => [check.key, check]));
  const assignedTenantIds = new Set(
    release.pilots.map((pilot) => pilot.organization.id),
  );
  const eligibleTenants = tenantOptions.filter(
    (tenant) =>
      tenant.eligibilityIssues.length === 0 && !assignedTenantIds.has(tenant.id),
  );

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-emerald-400/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_36%),rgba(255,255,255,.035)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <ShieldCheck size={17} /> Release Candidate Certification
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Release {release.version}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Commit <span className="font-mono text-slate-300">{release.commitSha}</span>
              {" · "}Created by {release.createdBy.name} {release.createdAt}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={release.status} />
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-3xl font-bold text-emerald-200">{progress}%</p>
              <p className="mt-1 text-xs text-slate-500">Checks passed</p>
            </div>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-950">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={release.deploymentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-200"
          >
            Open candidate deployment <ExternalLink size={15} />
          </Link>
          <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400">
            {release.pilots.length} pilot tenant{release.pilots.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {editable ? (
        <ReleaseMetadataForm release={release} />
      ) : (
        <ReleaseSummary release={release} />
      )}

      <section>
        <h2 className="text-2xl font-semibold">Governed certification checks</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Each check is tied to this exact commit and deployment. A release
          cannot enter review while checks are unrun or failed.
        </p>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {platformReleaseCheckDefinitions.map((definition, index) => {
            const check = checksByKey.get(definition.key);
            if (!check) return null;
            return (
              <article
                key={definition.key}
                className={`rounded-3xl border p-5 ${
                  check.status === PlatformReleaseCheckStatus.FAIL
                    ? "border-red-400/25 bg-red-400/[.04]"
                    : check.status === PlatformReleaseCheckStatus.PASS
                      ? "border-emerald-400/20 bg-emerald-400/[.025]"
                      : "border-white/10 bg-white/[.035]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-cyan-300">
                      CHECK {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">{definition.label}</h3>
                  </div>
                  <CheckBadge status={check.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {definition.description}
                </p>
                {editable ? (
                  <ReleaseCheckForm releaseId={release.id} check={check} />
                ) : (
                  <ReleaseCheckEvidence check={check} />
                )}
              </article>
            );
          })}
        </div>
      </section>

      <PilotSection
        release={release}
        editable={editable}
        eligibleTenants={eligibleTenants}
        allTenantOptions={tenantOptions}
      />

      {editable ? (
        <SubmitReleaseForm release={release} />
      ) : release.status === PlatformReleaseStatus.IN_REVIEW ? (
        <ReleaseDecisionForm release={release} />
      ) : release.status === PlatformReleaseStatus.APPROVED ? (
        <StartPilotForm release={release} />
      ) : null}
    </div>
  );
}

function ReleaseMetadataForm({
  release,
}: {
  release: ReleaseCandidateDetail;
}) {
  const [state, action, pending] = useActionState(
    updatePlatformReleaseMetadataAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-white/10 bg-white/[.04] p-6"
    >
      <input type="hidden" name="releaseId" value={release.id} />
      <h2 className="text-xl font-semibold">Release scope and recovery</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Candidate deployment URL">
          <input
            name="deploymentUrl"
            type="url"
            required
            defaultValue={release.deploymentUrl}
            className={input}
          />
        </Field>
        <Field label="Target certification date">
          <input
            name="targetCertificationAt"
            type="date"
            defaultValue={release.targetCertificationAt ?? ""}
            className={input}
          />
        </Field>
        <Field label="Release notes" className="md:col-span-2">
          <textarea
            name="releaseNotes"
            required
            minLength={40}
            maxLength={8_000}
            rows={4}
            defaultValue={release.releaseNotes ?? ""}
            placeholder="Describe the customer-visible and operational changes included in this candidate."
            className={input}
          />
        </Field>
        <Field label="Risk summary">
          <textarea
            name="riskSummary"
            required
            minLength={30}
            maxLength={4_000}
            rows={5}
            defaultValue={release.riskSummary ?? ""}
            placeholder="Identify change risk, affected services, data considerations, and residual exposure."
            className={input}
          />
        </Field>
        <Field label="Rollback plan">
          <textarea
            name="rollbackPlan"
            required
            minLength={40}
            maxLength={6_000}
            rows={5}
            defaultValue={release.rollbackPlan ?? ""}
            placeholder="State the rollback trigger, owner, sequence, validation, and communication steps."
            className={input}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <SubmitButton pending={pending} label="Save release scope" />
    </form>
  );
}

function ReleaseSummary({ release }: { release: ReleaseCandidateDetail }) {
  return (
    <section className="grid gap-5 md:grid-cols-3">
      <SummaryCard title="Release notes" value={release.releaseNotes} />
      <SummaryCard title="Risk summary" value={release.riskSummary} />
      <SummaryCard title="Rollback plan" value={release.rollbackPlan} />
      {release.reviewNotes ? (
        <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.03] p-5 md:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Certification decision
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {release.reviewNotes}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {release.reviewedBy?.name ?? "Platform reviewer"}
            {release.reviewedAt ? ` · ${release.reviewedAt}` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ReleaseCheckForm({
  releaseId,
  check,
}: {
  releaseId: string;
  check: ReleaseCheck;
}) {
  const [state, action, pending] = useActionState(
    updatePlatformReleaseCheckAction,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-5 grid gap-3 md:grid-cols-2">
      <input type="hidden" name="releaseId" value={releaseId} />
      <input type="hidden" name="checkId" value={check.id} />
      <Field label="Result">
        <select name="status" defaultValue={check.status} className={input}>
          {Object.values(PlatformReleaseCheckStatus).map((status) => (
            <option key={status} value={status}>
              {pretty(status)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Test date">
        <input
          name="testedAt"
          type="date"
          defaultValue={check.testedAt ?? ""}
          className={input}
        />
      </Field>
      <Field label="Test method" className="md:col-span-2">
        <textarea
          name="testMethod"
          rows={2}
          maxLength={1_000}
          defaultValue={check.testMethod ?? ""}
          className={input}
        />
      </Field>
      <Field label="Evidence summary" className="md:col-span-2">
        <textarea
          name="evidenceSummary"
          rows={3}
          maxLength={3_000}
          defaultValue={check.evidenceSummary ?? ""}
          className={input}
        />
      </Field>
      <Field label="Result notes">
        <textarea
          name="resultNotes"
          rows={2}
          maxLength={2_000}
          defaultValue={check.resultNotes ?? ""}
          className={input}
        />
      </Field>
      <Field label="Evidence reference">
        <input
          name="evidenceUrl"
          maxLength={1_000}
          defaultValue={check.evidenceUrl ?? ""}
          placeholder="/documents or https://…"
          className={input}
        />
      </Field>
      <div className="md:col-span-2">
        <Feedback state={state} />
        <SubmitButton pending={pending} label="Save certification evidence" />
      </div>
    </form>
  );
}

function ReleaseCheckEvidence({ check }: { check: ReleaseCheck }) {
  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm">
      <Evidence label="Method" value={check.testMethod} />
      <Evidence label="Evidence" value={check.evidenceSummary} />
      <Evidence label="Result notes" value={check.resultNotes} />
      <p className="text-xs text-slate-500">
        {check.testedBy?.name ?? "Not tested"}
        {check.testedAt ? ` · ${check.testedAt}` : ""}
      </p>
      {check.evidenceUrl ? (
        <Link
          href={check.evidenceUrl}
          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300"
        >
          Open evidence <ExternalLink size={13} />
        </Link>
      ) : null}
    </div>
  );
}

function PilotSection({
  release,
  editable,
  eligibleTenants,
  allTenantOptions,
}: {
  release: ReleaseCandidateDetail;
  editable: boolean;
  eligibleTenants: PilotTenantOption[];
  allTenantOptions: PilotTenantOption[];
}) {
  return (
    <section className="rounded-3xl border border-violet-400/15 bg-violet-400/[.025] p-6">
      <p className="flex items-center gap-2 text-sm text-violet-300">
        <Rocket size={17} /> Pilot Tenant Go-Live
      </p>
      <h2 className="mt-2 text-2xl font-semibold">Controlled pilot cohort</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Assignment requires approved Production Assurance and readiness for
        go-live. Starting the pilot additionally requires every tenant to be
        formally live.
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {release.pilots.map((pilot) => (
          <PilotCard
            key={pilot.id}
            release={release}
            pilot={pilot}
            editable={editable}
          />
        ))}
        {!release.pilots.length ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
            No pilot tenant has been assigned.
          </p>
        ) : null}
      </div>

      {editable ? (
        <AssignPilotForm releaseId={release.id} tenants={eligibleTenants} />
      ) : null}

      {editable && !eligibleTenants.length ? (
        <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[.04] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <CircleAlert size={16} /> No additional eligible pilot tenants
          </p>
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            {allTenantOptions
              .filter(
                (tenant) =>
                  tenant.eligibilityIssues.length > 0 &&
                  !release.pilots.some(
                    (pilot) => pilot.organization.id === tenant.id,
                  ),
              )
              .slice(0, 5)
              .map((tenant) => (
                <p key={tenant.id}>
                  <span className="font-semibold text-slate-300">{tenant.name}:</span>{" "}
                  {tenant.eligibilityIssues.join(" ")}
                </p>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssignPilotForm({
  releaseId,
  tenants,
}: {
  releaseId: string;
  tenants: PilotTenantOption[];
}) {
  const [state, action, pending] = useActionState(
    assignPlatformReleasePilotAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5"
    >
      <input type="hidden" name="releaseId" value={releaseId} />
      <h3 className="font-semibold">Assign pilot tenant</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Eligible tenant">
          <select
            name="organizationId"
            required
            disabled={!tenants.length}
            defaultValue=""
            className={input}
          >
            <option value="" disabled>
              Select tenant
            </option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} · {pretty(tenant.onboardingStatus ?? "unknown")} ·
                Assurance v{tenant.readinessVersion ?? "—"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Planned pilot start">
          <input name="plannedStartAt" type="date" className={input} />
        </Field>
        <Field label="Measurable exit criteria" className="md:col-span-2">
          <textarea
            name="exitCriteria"
            required
            minLength={30}
            maxLength={3_000}
            rows={3}
            placeholder="Define successful workflows, monitoring window, stakeholder acceptance, incident threshold, and rollback triggers."
            className={input}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <SubmitButton
        pending={pending}
        disabled={!tenants.length}
        label="Assign pilot tenant"
      />
    </form>
  );
}

function PilotCard({
  release,
  pilot,
  editable,
}: {
  release: ReleaseCandidateDetail;
  pilot: ReleasePilot;
  editable: boolean;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{pilot.organization.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Planned {pilot.plannedStartAt ?? "date not set"}
          </p>
        </div>
        <PilotBadge status={pilot.status} />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">
        {pilot.exitCriteria}
      </p>
      {pilot.resultSummary ? (
        <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-slate-300">
          {pilot.resultSummary}
        </p>
      ) : null}
      {editable ? (
        <RemovePilotForm releaseId={release.id} pilotId={pilot.id} />
      ) : release.status === PlatformReleaseStatus.PILOT_ACTIVE &&
        pilot.status === PlatformReleasePilotStatus.ACTIVE ? (
        <PilotOutcomeForm releaseId={release.id} pilotId={pilot.id} />
      ) : null}
    </article>
  );
}

function RemovePilotForm({
  releaseId,
  pilotId,
}: {
  releaseId: string;
  pilotId: string;
}) {
  const [state, action, pending] = useActionState(
    removePlatformReleasePilotAction,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="releaseId" value={releaseId} />
      <input type="hidden" name="pilotId" value={pilotId} />
      <Feedback state={state} />
      <button
        disabled={pending}
        className="inline-flex items-center gap-2 text-xs font-semibold text-red-300 disabled:opacity-50"
      >
        <Trash2 size={14} /> {pending ? "Removing…" : "Unassign pilot"}
      </button>
    </form>
  );
}

function PilotOutcomeForm({
  releaseId,
  pilotId,
}: {
  releaseId: string;
  pilotId: string;
}) {
  const [state, action, pending] = useActionState(
    recordPlatformReleasePilotOutcomeAction,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-5 space-y-3">
      <input type="hidden" name="releaseId" value={releaseId} />
      <input type="hidden" name="pilotId" value={pilotId} />
      <Field label="Final outcome">
        <select name="outcome" defaultValue="" required className={input}>
          <option value="" disabled>
            Select outcome
          </option>
          <option value={PlatformReleasePilotStatus.PASSED}>Passed</option>
          <option value={PlatformReleasePilotStatus.FAILED}>Failed</option>
          <option value={PlatformReleasePilotStatus.ROLLED_BACK}>
            Rolled back
          </option>
        </select>
      </Field>
      <Field label="Pilot result summary">
        <textarea
          name="resultSummary"
          required
          minLength={30}
          maxLength={4_000}
          rows={4}
          className={input}
        />
      </Field>
      <Feedback state={state} />
      <SubmitButton pending={pending} label="Record final outcome" />
    </form>
  );
}

function SubmitReleaseForm({
  release,
}: {
  release: ReleaseCandidateDetail;
}) {
  const [state, action, pending] = useActionState(
    submitPlatformReleaseAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[.04] p-6"
    >
      <input type="hidden" name="releaseId" value={release.id} />
      <h2 className="text-xl font-semibold">Submit for release certification</h2>
      <p className="mt-2 text-sm text-slate-400">
        Submission locks the scope, checks, and pilot cohort while the final
        platform decision is pending.
      </p>
      <Field label="Submission notes" className="mt-4">
        <textarea
          name="submissionNotes"
          maxLength={2_000}
          rows={3}
          defaultValue={release.submissionNotes ?? ""}
          className={input}
        />
      </Field>
      <Feedback state={state} />
      <SubmitButton pending={pending} label="Submit candidate" />
    </form>
  );
}

function ReleaseDecisionForm({
  release,
}: {
  release: ReleaseCandidateDetail;
}) {
  const [state, action, pending] = useActionState(
    decidePlatformReleaseAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-amber-400/20 bg-amber-400/[.04] p-6"
    >
      <input type="hidden" name="releaseId" value={release.id} />
      <h2 className="text-xl font-semibold">Independent certification decision</h2>
      <Field label="Decision rationale" className="mt-4">
        <textarea
          name="reviewNotes"
          required
          minLength={20}
          maxLength={3_000}
          rows={4}
          className={input}
        />
      </Field>
      <Feedback state={state} />
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          name="decision"
          value={PlatformReleaseStatus.APPROVED}
          disabled={pending}
          className="rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          Approve candidate
        </button>
        <button
          name="decision"
          value={PlatformReleaseStatus.REJECTED}
          disabled={pending}
          className="rounded-xl border border-red-400/25 px-5 py-3 font-semibold text-red-200 disabled:opacity-50"
        >
          Reject candidate
        </button>
      </div>
    </form>
  );
}

function StartPilotForm({
  release,
}: {
  release: ReleaseCandidateDetail;
}) {
  const [state, action, pending] = useActionState(
    startPlatformReleasePilotAction,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[.04] p-6"
    >
      <input type="hidden" name="releaseId" value={release.id} />
      <p className="flex items-center gap-2 text-sm text-emerald-300">
        <BadgeCheck size={17} /> Candidate certified
      </p>
      <h2 className="mt-2 text-xl font-semibold">Start controlled pilot rollout</h2>
      <p className="mt-2 text-sm text-slate-400">
        The system rechecks that every assigned tenant is formally live and
        still has an approved latest Production Assurance review.
      </p>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        <Play size={17} /> {pending ? "Starting…" : "Start pilot rollout"}
      </button>
    </form>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm text-slate-300 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        {title}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value || "Not recorded"}
      </p>
    </article>
  );
}

function Evidence({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-slate-300">
        {value || "Not recorded"}
      </p>
    </div>
  );
}

function Feedback({ state }: { state: FormActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "ERROR" ? "alert" : "status"}
      className={`mt-4 rounded-xl border p-3 text-sm ${
        state.status === "ERROR"
          ? "border-red-400/20 bg-red-400/[.06] text-red-200"
          : "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-200"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({
  pending,
  label,
  disabled = false,
}: {
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={pending || disabled}
      className="mt-5 rounded-xl border border-cyan-400/25 px-5 py-3 font-semibold text-cyan-200 disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function StatusBadge({ status }: { status: PlatformReleaseStatus }) {
  const color =
    status === PlatformReleaseStatus.RELEASED
      ? "bg-emerald-400/10 text-emerald-300"
      : status === PlatformReleaseStatus.ROLLED_BACK ||
          status === PlatformReleaseStatus.REJECTED
        ? "bg-red-400/10 text-red-300"
        : status === PlatformReleaseStatus.PILOT_ACTIVE
          ? "bg-violet-400/10 text-violet-200"
          : status === PlatformReleaseStatus.APPROVED
            ? "bg-cyan-400/10 text-cyan-200"
            : "bg-amber-400/10 text-amber-200";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {pretty(status)}
    </span>
  );
}

function CheckBadge({ status }: { status: PlatformReleaseCheckStatus }) {
  const color =
    status === PlatformReleaseCheckStatus.PASS
      ? "bg-emerald-400/10 text-emerald-300"
      : status === PlatformReleaseCheckStatus.FAIL
        ? "bg-red-400/10 text-red-300"
        : status === PlatformReleaseCheckStatus.NOT_APPLICABLE
          ? "bg-slate-800 text-slate-300"
          : "bg-amber-400/10 text-amber-200";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {pretty(status)}
    </span>
  );
}

function PilotBadge({ status }: { status: PlatformReleasePilotStatus }) {
  const color =
    status === PlatformReleasePilotStatus.PASSED
      ? "bg-emerald-400/10 text-emerald-300"
      : status === PlatformReleasePilotStatus.FAILED ||
          status === PlatformReleasePilotStatus.ROLLED_BACK
        ? "bg-red-400/10 text-red-300"
        : status === PlatformReleasePilotStatus.ACTIVE
          ? "bg-cyan-400/10 text-cyan-200"
          : "bg-slate-800 text-slate-300";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {pretty(status)}
    </span>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
