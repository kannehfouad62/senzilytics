export type AuditActionFeedback = { status: "idle" | "success" | "error"; message: string };
export const initialAuditActionFeedback: AuditActionFeedback = { status: "idle", message: "" };
export function auditActionError(error: unknown, fallback: string): AuditActionFeedback {
  return { status: "error", message: error instanceof Error && error.message ? error.message : fallback };
}
