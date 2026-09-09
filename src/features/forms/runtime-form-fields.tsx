"use client";
import { useState } from "react";
import { repeatingGroupConfig, type RepeatingGroupRow } from "@/modules/forms/repeating-group.service";
type WebFieldValue = string | string[] | boolean | RepeatingGroupRow[];
type Field = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  fieldType: string;
  isRequired: boolean;
  options: unknown;
  visibilityRule: unknown;
  optionLabels?: Record<string, string>;
};
type Form = {
  id: string;
  name: string;
  description: string | null;
  version: {
    id: string;
    version: number;
    instructions: string | null;
    fields: Field[];
  };
};
const input =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white";
const ruleOf = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as { fieldKey?: string; operator?: string; value?: string })
    : null;
export function RuntimeFormFields({
  forms,
  initialValues = {},
}: {
  forms: Form[];
  initialValues?: Record<string, WebFieldValue>;
}) {
  const [values, setValues] = useState<
    Record<string, WebFieldValue>
  >(
    () =>
      Object.fromEntries(
        forms.flatMap((form) =>
          form.version.fields
            .map(
              (field) =>
                [field.key, initialValues[`custom_${field.id}`]] as const,
            )
            .filter((entry) => entry[1] !== undefined),
        ),
      ) as Record<string, WebFieldValue>,
  );
  if (!forms.length) return null;
  const visible = (field: Field) => {
    const rule = ruleOf(field.visibilityRule);
    if (!rule?.fieldKey || rule.operator !== "EQUALS") return true;
    const actual = values[rule.fieldKey];
    return Array.isArray(actual)
      ? actual.some((item) => typeof item === "string" && item === (rule.value || ""))
      : String(actual ?? "") === String(rule.value ?? "");
  };
  return (
    <div className="space-y-6">
      {forms.map((form) => (
        <section
          key={form.id}
          className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Organization-specific form · v{form.version.version}
          </p>
          <h2 className="mt-2 text-xl font-semibold">{form.name}</h2>
          {form.description && (
            <p className="mt-1 text-sm text-slate-400">{form.description}</p>
          )}
          {form.version.instructions && (
            <p className="mt-3 rounded-xl bg-slate-950/40 p-3 text-sm text-slate-300">
              {form.version.instructions}
            </p>
          )}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {form.version.fields.filter(visible).map((field) => (
              <RuntimeField
                key={field.id}
                field={field}
                initialValue={initialValues[`custom_${field.id}`]}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.key]: value }))
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function RuntimeField({
  field,
  onChange,
  initialValue,
}: {
  field: Field;
  onChange: (value: WebFieldValue) => void;
  initialValue?: WebFieldValue;
}) {
  const name = `custom_${field.id}`,
    options = Array.isArray(field.options)
      ? field.options.flatMap((option) => {
          if (typeof option === "string")
            return [{ value: option, label: field.optionLabels?.[option] || option }];
          if (
            option &&
            typeof option === "object" &&
            !Array.isArray(option) &&
            typeof (option as { value?: unknown }).value === "string" &&
            typeof (option as { label?: unknown }).label === "string"
          )
            return [
              option as {
                value: string;
                label: string;
              },
            ];
          return [];
        })
      : [],
    label = (
      <span className="text-sm text-slate-300">
        {field.label}
        {field.isRequired && <span className="text-red-300"> *</span>}
        {field.description && (
          <span className="mt-1 block text-xs text-slate-500">
            {field.description}
          </span>
        )}
      </span>
    );
  if (field.fieldType === "MATRIX") return <MatrixRuntimeField field={field} name={name} initialValue={initialValue} onChange={onChange} label={label} />;
  if (field.fieldType === "RANKING") return <RankingRuntimeField field={field} name={name} initialValue={initialValue} onChange={onChange} label={label} />;
  if (field.fieldType === "REPEATING_GROUP") return <RepeatingGroupRuntimeField field={field} name={name} initialValue={initialValue} onChange={onChange} label={label} />;
  if (field.fieldType === "FILE")
    return (
      <div>
        {label}
        <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
          This private attachment can be uploaded immediately after the record
          is created.
        </p>
      </div>
    );
  if (field.fieldType === "BOOLEAN")
    return (
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name={name}
          required={field.isRequired}
          defaultChecked={initialValue === true || initialValue === "on"}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1"
        />
        <span>{label}</span>
      </label>
    );
  if (field.fieldType === "LONG_TEXT")
    return (
      <label>
        {label}
        <textarea
          name={name}
          required={field.isRequired}
          rows={4}
          defaultValue={typeof initialValue === "string" ? initialValue : ""}
          placeholder={field.placeholder || ""}
          onChange={(event) => onChange(event.target.value)}
          className={input}
        />
      </label>
    );
  if (field.fieldType === "SINGLE_SELECT")
    return (
      <label>
        {label}
        <select
          name={name}
          required={field.isRequired}
          defaultValue={typeof initialValue === "string" ? initialValue : ""}
          onChange={(event) => onChange(event.target.value)}
          className={input}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.fieldType === "MULTI_SELECT")
    return (
      <label>
        {label}
        <select
          name={name}
          required={field.isRequired}
          multiple
          defaultValue={Array.isArray(initialValue) ? initialValue.filter((item): item is string => typeof item === "string") : []}
          onChange={(event) =>
            onChange(
              [...event.target.selectedOptions].map((option) => option.value),
            )
          }
          className={input}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <label>
      {label}
      <input
        name={name}
        required={field.isRequired}
        defaultValue={typeof initialValue === "string" ? initialValue : ""}
        type={
          field.fieldType === "NUMBER"
            ? "number"
            : field.fieldType === "DATE"
              ? "date"
              : field.fieldType === "DATETIME"
                ? "datetime-local"
                : field.fieldType === "EMAIL"
                  ? "email"
                  : field.fieldType === "PHONE"
                    ? "tel"
                    : "text"
        }
        placeholder={field.placeholder || ""}
        onChange={(event) => onChange(event.target.value)}
        className={input}
      />
    </label>
  );
}

function matrixOptions(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return { rows: [] as string[], columns: [] as string[] };
  const configured = value as { rows?: unknown; columns?: unknown };
  return {
    rows: Array.isArray(configured.rows) ? configured.rows.filter((item): item is string => typeof item === "string") : [],
    columns: Array.isArray(configured.columns) ? configured.columns.filter((item): item is string => typeof item === "string") : [],
  };
}

function MatrixRuntimeField({ field, name, initialValue, onChange, label }: { field: Field; name: string; initialValue?: WebFieldValue; onChange: (value: WebFieldValue) => void; label: React.ReactNode }) {
  const matrix = matrixOptions(field.options);
  const initial = new Map((Array.isArray(initialValue) ? initialValue.filter((item): item is string => typeof item === "string") : []).flatMap((encoded) => { try { const pair = JSON.parse(encoded) as unknown; return Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" && typeof pair[1] === "string" ? [[pair[0], pair[1]] as const] : []; } catch { return []; } }));
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(initial));
  const update = (row: string, selected: string) => { const next = { ...answers, [row]: selected }; setAnswers(next); onChange(matrix.rows.flatMap((item) => next[item] ? [JSON.stringify([item, next[item]])] : [])); };
  return <fieldset className="md:col-span-2"><legend>{label}</legend><div className="mt-2 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/[.03] text-xs text-slate-400"><tr><th className="p-3 text-left">Statement</th>{matrix.columns.map((column) => <th key={column} className="p-3 text-center">{field.optionLabels?.[column] || column}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{matrix.rows.map((row, rowIndex) => <tr key={row}><th className="p-3 text-left font-normal text-slate-300">{field.optionLabels?.[row] || row}</th>{matrix.columns.map((column) => <td key={column} className="p-3 text-center"><input type="radio" name={`${name}_matrix_${rowIndex}`} value={column} required={field.isRequired} checked={answers[row] === column} onChange={() => update(row, column)} aria-label={`${row}: ${column}`} /></td>)}</tr>)}</tbody></table></div></fieldset>;
}

function RankingRuntimeField({ field, name, initialValue, onChange, label }: { field: Field; name: string; initialValue?: WebFieldValue; onChange: (value: WebFieldValue) => void; label: React.ReactNode }) {
  const options = Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
  const initialOrder = Array.isArray(initialValue) && initialValue.every((item): item is string => typeof item === "string") && initialValue.length === options.length ? initialValue : [];
  const [ranks, setRanks] = useState<Record<string, number>>(() => Object.fromEntries(initialOrder.map((option, index) => [option, index + 1])));
  const update = (option: string, rank: number) => { const next = { ...ranks, [option]: rank }; setRanks(next); const ordered = options.filter((item) => next[item]).sort((a, b) => next[a] - next[b]); onChange(ordered); };
  return <fieldset className="md:col-span-2"><legend>{label}</legend><div className="mt-2 space-y-2">{options.map((option, index) => <label key={option} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3 text-sm"><span>{field.optionLabels?.[option] || option}</span><select name={`${name}_rank_${index}`} value={ranks[option] ?? ""} required={field.isRequired} onChange={(event) => update(option, Number(event.target.value))} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"><option value="">Rank</option>{options.map((_, position) => <option key={position + 1} value={position + 1}>{position + 1}</option>)}</select></label>)}</div><p className="mt-2 text-xs text-slate-500">Assign each item a unique position; 1 is highest priority.</p></fieldset>;
}

function RepeatingGroupRuntimeField({ field, name, initialValue, onChange, label }: { field: Field; name: string; initialValue?: WebFieldValue; onChange: (value: WebFieldValue) => void; label: React.ReactNode }) {
  const config = repeatingGroupConfig(field.options);
  const makeRow = (): RepeatingGroupRow => ({ id: globalThis.crypto?.randomUUID?.() ?? `row_${Date.now()}_${Math.random().toString(36).slice(2)}`, values: {} });
  let restored: unknown = initialValue;
  if (typeof initialValue === "string") { try { restored = JSON.parse(initialValue) as unknown; } catch { restored = []; } }
  const initialRows = Array.isArray(restored) && restored.every((item) => item && typeof item === "object" && !Array.isArray(item)) ? restored as RepeatingGroupRow[] : [];
  const [rows, setRows] = useState<RepeatingGroupRow[]>(() => config ? (initialRows.length ? initialRows : Array.from({ length: config.minRows }, makeRow)) : []);
  if (!config) return <p className="text-sm text-red-300">{field.label} has an invalid roster configuration.</p>;
  const update = (next: RepeatingGroupRow[]) => { setRows(next); onChange(next); };
  const setValue = (rowId: string, key: string, value: string | number | boolean) => update(rows.map((row) => row.id === rowId ? { ...row, values: { ...row.values, [key]: value } } : row));
  return <fieldset className="md:col-span-2"><legend>{label}</legend><input type="hidden" name={name} value={JSON.stringify(rows)}/><div className="mt-3 space-y-4">{rows.map((row, rowIndex) => <div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-cyan-200">Row {rowIndex + 1}</p><button type="button" disabled={rows.length <= config.minRows} onClick={() => update(rows.filter((item) => item.id !== row.id))} className="text-xs text-red-300 disabled:opacity-30">Remove</button></div><div className="mt-3 grid gap-3 md:grid-cols-2">{config.columns.filter((column) => !column.showWhen || String(row.values[column.showWhen.columnKey] ?? "") === column.showWhen.value).map((column) => <label key={column.key} className="text-sm text-slate-300">{column.label}{column.required&&<span className="text-red-300"> *</span>}{column.type === "SINGLE_SELECT" ? <select value={String(row.values[column.key] ?? "")} onChange={(event) => setValue(row.id, column.key, event.target.value)} className={input}><option value="">Select</option>{column.options.map((option) => <option key={option}>{option}</option>)}</select> : column.type === "BOOLEAN" ? <input type="checkbox" checked={row.values[column.key] === true} onChange={(event) => setValue(row.id, column.key, event.target.checked)} className="ml-3"/> : column.type === "LONG_TEXT" ? <textarea rows={3} value={String(row.values[column.key] ?? "")} onChange={(event) => setValue(row.id, column.key, event.target.value)} className={input}/> : <input type={column.type === "NUMBER" ? "number" : column.type === "DATE" ? "date" : "text"} value={String(row.values[column.key] ?? "")} onChange={(event) => setValue(row.id, column.key, event.target.value)} className={input}/>}</label>)}</div></div>)}</div><button type="button" disabled={rows.length >= config.maxRows} onClick={() => update([...rows, makeRow()])} className="mt-4 rounded-xl border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 disabled:opacity-30">Add row</button><p className="mt-2 text-xs text-slate-500">Minimum {config.minRows}; maximum {config.maxRows} rows.</p></fieldset>;
}
