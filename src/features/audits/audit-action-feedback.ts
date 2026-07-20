import { unstable_rethrow } from "next/navigation";

export type AuditActionFeedback = { status: "idle" | "success" | "error"; message: string };
export const initialAuditActionFeedback: AuditActionFeedback = { status: "idle", message: "" };
export function auditActionError(error: unknown, fallback: string): AuditActionFeedback {
  unstable_rethrow(error);
  return { status: "error", message: error instanceof Error && error.message ? error.message : fallback };
}
