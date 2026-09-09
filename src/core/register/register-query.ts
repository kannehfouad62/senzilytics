export const REGISTER_PAGE_SIZE = 50;

export function normalizeRegisterQuery(input: { search?: string; page?: string }) {
  const search = input.search?.trim().slice(0, 120) ?? "";
  const parsed = Number(input.page ?? "1");
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  return { search, page, skip: (page - 1) * REGISTER_PAGE_SIZE, take: REGISTER_PAGE_SIZE };
}

export function registerPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / REGISTER_PAGE_SIZE));
}
