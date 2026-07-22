export type StoredMobileContext = {
  organizationId: string;
  userId: string;
};

export const MOBILE_WORKSPACE_MAX_OFFLINE_AGE_MS = 72 * 60 * 60 * 1000;

export function parseStoredMobileContext(value: string | null): StoredMobileContext | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredMobileContext>;
    if (!validIdentifier(parsed.organizationId) || !validIdentifier(parsed.userId)) return null;
    return { organizationId: parsed.organizationId, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function mobileOwnerKey(context: StoredMobileContext) {
  return `${context.organizationId}:${context.userId}`;
}

export function shouldDiscardMobileSession(error: { status?: number; code?: string }) {
  return (
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403 ||
    error.code === "invalid_grant" ||
    error.code === "session_revoked" ||
    error.code === "mobile_not_entitled" ||
    error.code === "unauthorized"
  );
}

export function isMobileWorkspaceCacheFresh(updatedAt: string, now = Date.now()) {
  const timestamp = Date.parse(updatedAt);
  const age = now - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60 * 1000 && age <= MOBILE_WORKSPACE_MAX_OFFLINE_AGE_MS;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 191 && !value.includes(":");
}
