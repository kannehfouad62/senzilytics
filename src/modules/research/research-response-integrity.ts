export function resumeCookieName(publicToken: string) {
  return `senzilytics_survey_${publicToken.slice(0, 20)}`;
}

export function calculateResponseIntegrity(input: {
  startedAt: Date;
  submittedAt: Date;
  minimumCompletionSeconds: number | null;
  answerCount: number;
}) {
  const completionSeconds = Math.max(
    0,
    Math.round(
      (input.submittedAt.getTime() - input.startedAt.getTime()) / 1000,
    ),
  );
  const flags: string[] = [];
  if (
    input.minimumCompletionSeconds !== null &&
    completionSeconds < input.minimumCompletionSeconds
  )
    flags.push("SPEEDING");
  if (input.answerCount === 0) flags.push("NO_RECORDED_ANSWERS");
  return {
    completionSeconds,
    flags,
    status: flags.length ? ("REVIEW" as const) : ("CLEAR" as const),
  };
}

export function deterministicFieldOrder<T extends { id: string }>(
  fields: T[],
  seed: string,
) {
  return [...fields].sort((left, right) =>
    fingerprint(`${seed}:${left.id}`).localeCompare(
      fingerprint(`${seed}:${right.id}`),
    ),
  );
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
