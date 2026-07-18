export type AuditAiStage = "BEFORE" | "DURING" | "AFTER";
export type AuditAiDraft = { executiveSummary: string; focusAreas: Array<{ title: string; rationale: string; priority: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" }>; evidenceGaps: string[]; recommendedQuestions: string[]; findingImprovements: string[]; managementPriorities: string[]; confidence: { level: "LOW"|"MEDIUM"|"HIGH"; rationale: string }; limitations: string };
export type AuditAiActionState = { status: "IDLE"|"SUCCESS"|"ERROR"; draft: AuditAiDraft|null; error: string|null; generatedAt: string|null };
export const initialAuditAiActionState: AuditAiActionState = { status:"IDLE", draft:null, error:null, generatedAt:null };
