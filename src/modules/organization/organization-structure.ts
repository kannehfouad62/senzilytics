export const ORGANIZATION_STRUCTURE_NAME_MAX_LENGTH = 100;

export function normalizeStructureName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateStructureName(value: string, label: string) {
  const normalized = normalizeStructureName(value);

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  if (normalized.length > ORGANIZATION_STRUCTURE_NAME_MAX_LENGTH) {
    throw new Error(
      `${label} must be ${ORGANIZATION_STRUCTURE_NAME_MAX_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}
