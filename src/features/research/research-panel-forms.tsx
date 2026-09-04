"use client";

import { useActionState } from "react";

import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  addResearchPanelMember,
  changePanelMemberStatus,
  createResearchCampaignQuota,
  createResearchPanel,
  inviteResearchPanelQuota,
} from "@/features/research/research-panel-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm";
const button =
  "rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50";

function Feedback({ state }: { state: FormActionState }) {
  useRefreshOnSuccess(state);
  return state.message ? (
    <p
      className={`mt-3 text-sm ${state.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}
    >
      {state.message}
    </p>
  ) : null;
}

export function ResearchPanelForm() {
  const [state, action, pending] = useActionState(
    createResearchPanel,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.035] p-6"
    >
      <h2 className="text-xl font-semibold">Create participant panel</h2>
      <p className="mt-2 text-sm text-slate-400">
        Define the reusable cohort and lawful research purpose before enrolling
        participants.
      </p>
      <label className="mt-4 block text-sm">
        Panel name
        <input name="name" required maxLength={160} className={input} />
      </label>
      <label className="mt-4 block text-sm">
        Description
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          className={input}
        />
      </label>
      <label className="mt-4 block text-sm">
        Lawful purpose
        <textarea
          name="lawfulPurpose"
          required
          rows={3}
          maxLength={2000}
          className={input}
        />
      </label>
      <button disabled={pending} className={`mt-4 ${button}`}>
        {pending ? "Creating…" : "Create governed panel"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function PanelMemberForm({ panelId }: { panelId: string }) {
  const [state, action, pending] = useActionState(
    addResearchPanelMember,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-5"
    >
      <input type="hidden" name="panelId" value={panelId} />
      <h3 className="font-semibold">Enroll consented participant</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Name
          <input name="memberName" maxLength={160} className={input} />
        </label>
        <label className="text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            className={input}
          />
        </label>
        <label className="text-sm">
          External reference
          <input name="externalRef" maxLength={160} className={input} />
        </label>
        <label className="text-sm">
          Consent expires
          <input name="consentExpiresAt" type="date" className={input} />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        Segment attributes
        <textarea
          name="attributes"
          rows={3}
          maxLength={3000}
          className={input}
          placeholder={"country=Ghana\nindustry=Healthcare\nrole=Manager"}
        />
      </label>
      <label className="mt-3 block text-sm">
        Consent statement
        <textarea
          name="consentStatement"
          required
          rows={3}
          maxLength={3000}
          className={input}
        />
      </label>
      <label className="mt-3 block text-sm">
        Lawful basis
        <input
          name="lawfulBasis"
          required
          maxLength={500}
          className={input}
          placeholder="Explicit consent"
        />
      </label>
      <button disabled={pending} className={`mt-4 ${button}`}>
        {pending ? "Recording…" : "Record participant and consent"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function PanelMemberStatusForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(
    changePanelMemberStatus,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <select
        name="status"
        className={`${input} mt-0 w-auto`}
        defaultValue="OPTED_OUT"
      >
        <option value="ACTIVE">Reactivate</option>
        <option value="OPTED_OUT">Opt out</option>
        <option value="SUPPRESSED">Suppress</option>
        <option value="INACTIVE">Mark inactive</option>
      </select>
      <input
        name="note"
        maxLength={1000}
        className={`${input} mt-0 min-w-56 flex-1`}
        placeholder="Withdrawal, suppression or renewed-consent evidence"
      />
      <input
        name="consentExpiresAt"
        type="date"
        className={`${input} mt-0 w-auto`}
        aria-label="Renewed consent expiry"
      />
      <button
        disabled={pending}
        className="rounded-xl border border-amber-400/25 px-4 py-3 text-sm text-amber-200 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Update"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CampaignQuotaForm({
  campaigns,
}: {
  campaigns: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    createResearchCampaignQuota,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-violet-400/15 bg-violet-400/[.035] p-6"
    >
      <h2 className="text-xl font-semibold">Create campaign quota</h2>
      <p className="mt-2 text-sm text-slate-400">
        Set a completion target for one exact participant attribute segment.
      </p>
      <label className="mt-4 block text-sm">
        Campaign
        <select name="campaignId" required defaultValue="" className={input}>
          <option value="" disabled>
            Select campaign
          </option>
          {campaigns.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Quota name
          <input name="name" required maxLength={160} className={input} />
        </label>
        <label className="text-sm">
          Attribute key
          <input
            name="attributeKey"
            required
            maxLength={100}
            className={input}
            placeholder="country"
          />
        </label>
        <label className="text-sm">
          Attribute value
          <input
            name="attributeValue"
            required
            maxLength={200}
            className={input}
            placeholder="Ghana"
          />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        Completed-response target
        <input
          name="target"
          required
          type="number"
          min={1}
          max={100000}
          className={input}
        />
      </label>
      <button
        disabled={pending || !campaigns.length}
        className={`mt-4 ${button}`}
      >
        {pending ? "Creating…" : "Create quota"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function QuotaInvitationForm({
  quotaId,
  panels,
}: {
  quotaId: string;
  panels: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    inviteResearchPanelQuota,
    initialFormActionState,
  );
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="quotaId" value={quotaId} />
      <label className="min-w-64 flex-1 text-sm">
        Source panel
        <select name="panelId" required defaultValue="" className={input}>
          <option value="" disabled>
            Select participant panel
          </option>
          {panels.map((panel) => (
            <option key={panel.id} value={panel.id}>
              {panel.name}
            </option>
          ))}
        </select>
      </label>
      <button disabled={pending || !panels.length} className={button}>
        {pending ? "Inviting…" : "Invite eligible segment"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
