export type ResearchGovernanceReminderKind = "OVERDUE" | "DUE_7_DAYS" | "DUE_30_DAYS";

export function classifyResearchGovernanceReminder(dueAt: Date, now = new Date()): ResearchGovernanceReminderKind {
  const days = Math.ceil((dueAt.getTime() - now.getTime()) / 86_400_000);
  return days <= 0 ? "OVERDUE" : days <= 7 ? "DUE_7_DAYS" : "DUE_30_DAYS";
}

export function researchGovernanceCsv(rows: unknown[][]) {
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
