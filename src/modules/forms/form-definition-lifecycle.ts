export function configurableFormDeletionBlocker(submissionCount: number) {
  if (!Number.isInteger(submissionCount) || submissionCount < 0) {
    return "The form submission count is invalid.";
  }
  if (submissionCount > 0) {
    return `This form has ${submissionCount} historical submission${submissionCount === 1 ? "" : "s"} and cannot be permanently deleted. Unassign it instead to preserve the audit trail.`;
  }
  return null;
}
