"use client";
import { useActionState } from "react";
import {
  initialFormActionState,
  type FormActionState,
} from "@/core/actions/action-state";
import {
  changeSurveyCampaignStatus,
  createSurveyCampaign,
  sendSurveyCampaignReminders,
} from "@/features/research/survey-campaign-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";
const input =
    "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm",
  button =
    "rounded-xl bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50";
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

export function CampaignStatusButton({
  campaignId,
  status,
  label,
}: {
  campaignId: string;
  status: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    changeSurveyCampaignStatus,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="status" value={status} />
      <button
        disabled={pending}
        className="rounded-lg border border-amber-400/20 px-3 py-2 text-xs text-amber-200"
      >
        {pending ? "Updating…" : label}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function SurveyCampaignForm({
  collectionId,
  links,
}: {
  collectionId: string;
  links: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(
    createSurveyCampaign,
    initialFormActionState,
  );
  return (
    <form
      action={action}
      className="rounded-3xl border border-violet-400/15 bg-violet-400/[.035] p-6"
    >
      <input type="hidden" name="collectionId" value={collectionId} />
      <h2 className="text-xl font-semibold">Launch invitation campaign</h2>
      <p className="mt-2 text-sm text-slate-400">
        Paste one recipient per line as <code>Name, email@example.com</code> or
        an email address. Each receives a unique single-use link.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          Campaign name
          <input name="name" required maxLength={160} className={input} />
        </label>
        <label className="text-sm">
          Survey link
          <select
            name="publicLinkId"
            required
            defaultValue=""
            className={input}
          >
            <option value="" disabled>
              Select active link
            </option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Reminder limit
          <input
            name="reminderLimit"
            type="number"
            min={0}
            max={5}
            defaultValue={2}
            className={input}
          />
        </label>
      </div>
      <textarea
        name="recipients"
        required
        rows={7}
        maxLength={30000}
        className={input}
        placeholder={"Jane Doe, jane@example.com\nJohn Doe, john@example.com"}
      />
      <button disabled={pending || !links.length} className={`mt-4 ${button}`}>
        {pending ? "Launching…" : "Launch and send invitations"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function CampaignReminderButton({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState(
    sendSurveyCampaignReminders,
    initialFormActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        disabled={pending}
        className="rounded-lg border border-violet-400/20 px-3 py-2 text-xs text-violet-300"
      >
        {pending ? "Sending…" : "Send reminders"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
