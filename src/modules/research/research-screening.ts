export function screeningCookieName(publicToken: string) {
  return `senzilytics_screen_${publicToken.slice(0, 20)}`;
}

export function evaluateScreeningAnswer(
  answer: string | string[],
  allowedValues: string[],
) {
  const allowed = new Set(
    allowedValues
      .map((item) => item.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
  const values = (Array.isArray(answer) ? answer : [answer]).map((item) =>
    item.trim().toLocaleLowerCase(),
  );
  return allowed.size > 0 && values.some((item) => allowed.has(item));
}
