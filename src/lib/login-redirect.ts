export function safeLoginRedirect(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate.length > 500 || !candidate.startsWith("/mobile/authorize?challenge=smc_") || candidate.startsWith("//") || candidate.includes("\\")) return "/dashboard";
  return candidate;
}
