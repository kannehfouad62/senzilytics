import type { MobileRegisterKey } from "@/modules/mobile/mobile-register-limits";

const CURSOR_VERSION = 1;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

type CursorPayload = {
  v: number;
  register: MobileRegisterKey;
  id: string;
};

export function encodeMobileRegisterCursor(register: MobileRegisterKey, id: string) {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid mobile register cursor id.");
  return Buffer.from(
    JSON.stringify({ v: CURSOR_VERSION, register, id } satisfies CursorPayload),
    "utf8"
  ).toString("base64url");
}

export function decodeMobileRegisterCursor(
  raw: string | null,
  register: MobileRegisterKey
) {
  if (!raw) return null;
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new Error("Invalid mobile register cursor.");
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as Partial<CursorPayload>;
    if (
      parsed.v !== CURSOR_VERSION ||
      parsed.register !== register ||
      typeof parsed.id !== "string" ||
      !ID_PATTERN.test(parsed.id)
    ) {
      throw new Error("Invalid mobile register cursor.");
    }
    return parsed.id;
  } catch {
    throw new Error("Invalid mobile register cursor.");
  }
}

export function mobileRegisterPage<T extends { id: string }>(
  register: MobileRegisterKey,
  records: T[],
  limit: number
) {
  const items = records.slice(0, limit);
  const hasMore = records.length > limit;
  return {
    items,
    hasMore,
    nextCursor:
      hasMore && items.length
        ? encodeMobileRegisterCursor(register, items[items.length - 1]!.id)
        : null,
  };
}
