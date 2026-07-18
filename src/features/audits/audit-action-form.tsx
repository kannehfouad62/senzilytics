"use client";
import { initialAuditActionFeedback, type AuditActionFeedback } from "@/features/audits/audit-action-feedback";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

type FeedbackAction = (state: AuditActionFeedback, formData: FormData) => Promise<AuditActionFeedback>;
export function AuditActionForm({ action, children, className }: { action: FeedbackAction; children: React.ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, initialAuditActionFeedback);
  return <form action={formAction} className={className}>{children}{pending && <Message tone="pending" message="Processing request…" />}{!pending && state.status !== "idle" && <Message tone={state.status} message={state.message} />}</form>;
}
function Message({ tone, message }: { tone: "pending" | "success" | "error"; message: string }) {
  const styles = tone === "error" ? "border-red-400/30 bg-red-400/10 text-red-200" : tone === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : LoaderCircle;
  return <p role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${styles}`}><Icon size={16} className={`mt-0.5 shrink-0 ${tone === "pending" ? "animate-spin" : ""}`} />{message}</p>;
}
