export type ResearchFieldTranslation = {
  label?: string;
  description?: string;
  placeholder?: string;
  options?: Record<string, string>;
};

export type ResearchFieldTranslations = Record<
  string,
  ResearchFieldTranslation
>;

export function normalizeResearchLocale(value: string) {
  const locale = value.trim().replaceAll("_", "-").toLowerCase().slice(0, 20);
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(locale) ? locale : null;
}

export function researchFieldTranslations(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ResearchFieldTranslations;
}

export function localizedResearchField<
  T extends {
    id: string;
    label: string;
    description: string | null;
    placeholder: string | null;
    options: unknown;
  },
>(field: T, translations: ResearchFieldTranslations) {
  const translation = translations[field.id];
  const baseOptions = Array.isArray(field.options)
    ? field.options.filter((item): item is string => typeof item === "string")
    : [];
  return {
    ...field,
    label: translation?.label?.trim() || field.label,
    description:
      translation?.description?.trim() || field.description,
    placeholder:
      translation?.placeholder?.trim() || field.placeholder,
    options: baseOptions.map((option) => ({
      value: option,
      label: translation?.options?.[option]?.trim() || option,
    })),
  };
}
