export const CALCULATION_OPERATIONS = ["SUM", "AVERAGE", "WEIGHTED_SUM"] as const;
export type CalculationOperation = (typeof CALCULATION_OPERATIONS)[number];
export type CalculationSource = { fieldKey: string; weight: number };
export type ScoreBand = { min: number; max: number; label: string };
export type CalculatedFieldConfig = { operation: CalculationOperation; sources: CalculationSource[]; decimalPlaces: number; bands: ScoreBand[] };

const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);

export function parseCalculationSources(value: string): CalculationSource[] {
  const sources = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [rawKey, rawWeight = "1"] = line.split("|").map((part) => part.trim());
    const fieldKey = key(rawKey), weight = Number(rawWeight);
    if (!fieldKey || !Number.isFinite(weight) || Math.abs(weight) > 1000) throw new Error("Each calculation source must use: field_key | numeric weight.");
    return { fieldKey, weight };
  });
  if (!sources.length || sources.length > 20) throw new Error("Calculated fields require between 1 and 20 source fields.");
  if (new Set(sources.map((source) => source.fieldKey)).size !== sources.length) throw new Error("Calculation source keys must be unique.");
  return sources;
}

export function parseScoreBands(value: string): ScoreBand[] {
  if (!value.trim()) return [];
  const bands = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [rawMin, rawMax, rawLabel] = line.split("|").map((part) => part.trim());
    const min = Number(rawMin), max = Number(rawMax), label = rawLabel?.slice(0, 80);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || !label) throw new Error("Each score band must use: minimum | maximum | label.");
    return { min, max, label };
  }).sort((a, b) => a.min - b.min);
  if (bands.length > 20) throw new Error("A calculated field supports up to 20 score bands.");
  if (bands.some((band, index) => index > 0 && band.min <= bands[index - 1].max)) throw new Error("Score bands must not overlap.");
  return bands;
}

export function calculatedFieldConfig(value: unknown): CalculatedFieldConfig | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const raw = value as Partial<CalculatedFieldConfig>;
  if (!CALCULATION_OPERATIONS.includes(raw.operation as CalculationOperation) || !Array.isArray(raw.sources) || !Number.isInteger(raw.decimalPlaces)) return null;
  const decimalPlaces = Number(raw.decimalPlaces);
  if (decimalPlaces < 0 || decimalPlaces > 6 || raw.sources.length < 1 || raw.sources.length > 20) return null;
  const sources = raw.sources.flatMap((source) => source && typeof source === "object" && typeof source.fieldKey === "string" && Number.isFinite(source.weight) ? [{ fieldKey: key(source.fieldKey), weight: Number(source.weight) }] : []);
  if (sources.length !== raw.sources.length || new Set(sources.map((source) => source.fieldKey)).size !== sources.length) return null;
  const bands = Array.isArray(raw.bands) ? raw.bands.flatMap((band) => band && typeof band === "object" && Number.isFinite(band.min) && Number.isFinite(band.max) && typeof band.label === "string" && band.min <= band.max ? [{ min: Number(band.min), max: Number(band.max), label: band.label.slice(0, 80) }] : []) : [];
  if (bands.length !== (raw.bands?.length ?? 0)) return null;
  return { operation: raw.operation as CalculationOperation, sources, decimalPlaces, bands };
}

export function calculateConfiguredField(config: CalculatedFieldConfig, values: ReadonlyMap<string, unknown>) {
  const inputs = config.sources.map((source) => {
    const sourceValue = values.get(source.fieldKey);
    return { value: sourceValue === undefined || sourceValue === null || sourceValue === "" ? Number.NaN : Number(sourceValue), weight: source.weight };
  });
  if (inputs.some((input) => !Number.isFinite(input.value))) return null;
  const raw = config.operation === "AVERAGE"
    ? inputs.reduce((sum, input) => sum + input.value, 0) / inputs.length
    : inputs.reduce((sum, input) => sum + input.value * (config.operation === "WEIGHTED_SUM" ? input.weight : 1), 0);
  const factor = 10 ** config.decimalPlaces;
  const value = Math.round((raw + Number.EPSILON) * factor) / factor;
  return { value, band: config.bands.find((item) => value >= item.min && value <= item.max)?.label ?? null };
}
