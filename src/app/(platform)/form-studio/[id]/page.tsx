import {
  addConfigurableField,
  copyResearchQuestionFromLibrary,
  publishConfigurableForm,
  removeConfigurableField,
  reviseConfigurableForm,
} from "@/features/forms/actions";
import { FormDefinitionManagement } from "@/features/forms/form-definition-management";
import { prisma } from "@/lib/prisma";
import { ConfigurableFieldType, ConfigurableFormModule } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFormDefinitionManagement } from "@/modules/forms/form-authorization";
import { repeatingGroupConfig } from "@/modules/forms/repeating-group.service";
import { calculatedFieldConfig } from "@/modules/forms/calculated-field.service";
const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
export default async function FormDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const [{ error }, { organizationId }] = await Promise.all([
    searchParams,
    requireFormDefinitionManagement(id),
  ]);
  const form = await prisma.configurableFormDefinition.findFirst({
    where: { id, organizationId },
    include: {
      researchQuestionnaire: { select: { projectId: true } },
      _count: { select: { submissions: true } },
      versions: {
        include: {
          fields: { orderBy: { sequence: "asc" } },
          createdBy: { select: { name: true } },
          publishedBy: { select: { name: true } },
        },
        orderBy: { version: "desc" },
      },
    },
  });
  if (!form) notFound();
  const draft = form.versions.find((v) => v.status === "DRAFT"),
    published = form.versions.find((v) => v.status === "PUBLISHED"),
    selected = draft ?? published ?? form.versions[0];
  const libraryFields=form.module===ConfigurableFormModule.RESEARCH&&draft?await prisma.configurableFormField.findMany({where:{version:{status:"PUBLISHED",definition:{organizationId,module:ConfigurableFormModule.RESEARCH,id:{not:form.id}}}},select:{id:true,label:true,key:true,fieldType:true,version:{select:{version:true,definition:{select:{name:true}}}}},orderBy:{createdAt:"desc"},take:250}):[];
  const backHref =
    form.module === ConfigurableFormModule.RESEARCH &&
    form.researchQuestionnaire
      ? `/research/projects/${form.researchQuestionnaire.projectId}/questionnaires`
      : "/form-studio";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-cyan-300">
          ←{" "}
          {form.module === ConfigurableFormModule.RESEARCH
            ? "Questionnaire Studio"
            : "Form Studio"}
        </Link>
        <Link
          href={`/form-studio/submissions?definitionId=${encodeURIComponent(form.id)}`}
          className="text-sm text-cyan-300"
        >
          View {form._count.submissions} submissions →
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-cyan-300">
            {form.module.replaceAll("_", " ")}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{form.name}</h1>
          <p className="mt-2 text-slate-400">
            {form.description || "No description"}
          </p>
        </div>
        <div className="flex gap-3">
          {draft ? (
            <div className="flex flex-wrap gap-3"><Link href={`/form-studio/${form.id}/test`} className="rounded-xl border border-amber-300/30 px-4 py-2 font-semibold text-amber-200">Preview & test</Link><form action={publishConfigurableForm}>
              <input type="hidden" name="definitionId" value={form.id} />
              <input type="hidden" name="versionId" value={draft.id} />
              <button className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-950">
                Publish v{draft.version}
              </button>
            </form></div>
          ) : (
            <form action={reviseConfigurableForm}>
              <input type="hidden" name="definitionId" value={form.id} />
              <button className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950">
                Create New Revision
              </button>
            </form>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
        >
          {error}
        </p>
      )}
      <FormDefinitionManagement
        form={{
          id: form.id,
          name: form.name,
          description: form.description,
          module: form.module,
          isActive: form.isActive,
          submissionCount: form._count.submissions,
        }}
      />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.8fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {selected.status === "DRAFT"
                  ? "Draft editor"
                  : "Published form"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Version {selected.version} · {selected.status}
              </p>
            </div>
            {published && (
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                Live v{published.version}
              </span>
            )}
          </div>
          <div className="mt-5 space-y-3">
            {selected.fields.map((field) => (
              <div
                key={field.id}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {field.sequence}. {field.label}
                      {field.isRequired && (
                        <span className="text-red-300"> *</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-cyan-300">
                      {field.fieldType.replaceAll("_", " ")} · {field.key}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {field.description}
                    </p>
                    {field.visibilityRule && (
                      <p className="mt-2 text-xs text-amber-300">
                        Conditional visibility configured
                      </p>
                    )}
                  </div>
                  {draft && selected.id === draft.id && (
                    <form action={removeConfigurableField}>
                      <input
                        type="hidden"
                        name="definitionId"
                        value={form.id}
                      />
                      <input type="hidden" name="fieldId" value={field.id} />
                      <button className="text-xs text-red-300">Remove</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {!selected.fields.length && (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                No fields configured.
              </p>
            )}
          </div>
        </section>
        <section className="space-y-6">
          {draft && (
            <>
            {form.module===ConfigurableFormModule.RESEARCH&&<form action={copyResearchQuestionFromLibrary} className="rounded-3xl border border-amber-400/15 bg-amber-400/[.035] p-6"><input type="hidden" name="definitionId" value={form.id}/><input type="hidden" name="versionId" value={draft.id}/><h2 className="text-xl font-semibold">Reusable question library</h2><p className="mt-1 text-sm text-slate-400">Copy an individual question from another published questionnaire in this organization. The copied field becomes an independent draft snapshot.</p><label className="mt-4 block text-sm">Published question<select name="sourceFieldId" required defaultValue="" className={input}><option value="" disabled>Select a library question</option>{libraryFields.map(field=><option key={field.id} value={field.id}>{field.version.definition.name} v{field.version.version} · {field.label} ({field.fieldType.replaceAll("_"," ")})</option>)}</select></label><button disabled={!libraryFields.length} className="mt-4 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">Copy question into draft</button>{!libraryFields.length&&<p className="mt-3 text-xs text-slate-500">Publish another questionnaire to populate this tenant library.</p>}</form>}
            <form
              action={addConfigurableField}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <input type="hidden" name="definitionId" value={form.id} />
              <input type="hidden" name="versionId" value={draft.id} />
              <h2 className="text-xl font-semibold">Add field</h2>
              <label className="mt-4 block">
                Label
                <input name="label" required className={input} />
              </label>
              <label className="mt-4 block">
                Stable field key
                <input
                  name="key"
                  placeholder="generated_from_label"
                  className={input}
                />
              </label>
              <label className="mt-4 block">
                Type
                <select name="fieldType" className={input}>
                  {Object.values(ConfigurableFieldType).map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block">
                Description
                <input name="description" className={input} />
              </label>
              <label className="mt-4 block">
                Placeholder
                <input name="placeholder" className={input} />
              </label>
              <label className="mt-4 block">
                Options
                <textarea
                  name="options"
                  rows={3}
                  placeholder="One option per line; required for select and ranking fields"
                  className={input}
                />
              </label>
              <div className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-400/[.035] p-4">
                <p className="text-sm font-semibold text-violet-200">
                  Matrix configuration
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Used only when the field type is Matrix.
                </p>
                <label className="mt-3 block text-sm">
                  Rows
                  <textarea
                    name="matrixRows"
                    rows={3}
                    placeholder={"Service quality\nTimeliness\nCommunication"}
                    className={input}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  Columns
                  <textarea
                    name="matrixColumns"
                    rows={3}
                    placeholder={"Very poor\nPoor\nGood\nExcellent"}
                    className={input}
                  />
                </label>
              </div>
              <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.035] p-4">
                <p className="text-sm font-semibold text-cyan-200">Repeating group / roster configuration</p>
                <p className="mt-1 text-xs text-slate-500">One column per line: key | label | type | required/optional | semicolon-separated choices | conditional key=value.</p>
                <label className="mt-3 block text-sm">Roster columns
                  <textarea name="rosterColumns" rows={5} placeholder={"member_name | Member name | SHORT_TEXT | required\nage | Age | NUMBER | optional\nrelationship | Relationship | SINGLE_SELECT | required | Head;Spouse;Child;Other\nother_relationship | Specify other | SHORT_TEXT | required | | relationship=Other"} className={input}/>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-sm">Minimum rows<input name="rosterMinRows" type="number" min="0" max="50" defaultValue="1" className={input}/></label>
                  <label className="text-sm">Maximum rows<input name="rosterMaxRows" type="number" min="1" max="50" defaultValue="10" className={input}/></label>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.035] p-4">
                <p className="text-sm font-semibold text-emerald-200">Calculated field and scoring configuration</p>
                <p className="mt-1 text-xs text-slate-500">Used only for Calculated fields. Sources must be earlier Number or Calculated field keys. Results are recomputed securely during submission.</p>
                <label className="mt-3 block text-sm">Operation
                  <select name="calculationOperation" defaultValue="SUM" className={input}>
                    <option value="SUM">Sum</option><option value="AVERAGE">Average</option><option value="WEIGHTED_SUM">Weighted sum</option>
                  </select>
                </label>
                <label className="mt-3 block text-sm">Source fields and weights
                  <textarea name="calculationSources" rows={4} placeholder={"quality_score | 1\ntimeliness_score | 1\nrisk_score | 0.5"} className={input}/>
                </label>
                <label className="mt-3 block text-sm">Decimal places
                  <input name="calculationDecimals" type="number" min="0" max="6" defaultValue="2" className={input}/>
                </label>
                <label className="mt-3 block text-sm">Score bands (optional)
                  <textarea name="scoreBands" rows={4} placeholder={"0 | 49.99 | Needs improvement\n50 | 79.99 | Satisfactory\n80 | 100 | Excellent"} className={input}/>
                </label>
              </div>
              <label className="mt-4 flex items-center gap-2">
                <input type="checkbox" name="isRequired" />
                Required
              </label>
              <div className="mt-5 rounded-2xl border border-white/10 p-4">
                <p className="text-sm font-semibold">
                  Conditional visibility (optional)
                </p>
                <label className="mt-3 block text-sm">
                  Show when field key
                  <input name="visibilityField" className={input} />
                </label>
                <label className="mt-3 block text-sm">
                  Equals value
                  <input name="visibilityValue" className={input} />
                </label>
              </div>
              <button className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">
                Add Field
              </button>
            </form>
            </>
          )}
          <FormPreview fields={selected.fields} />
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Version history</h2>
            <div className="mt-4 space-y-3">
              {form.versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between rounded-xl bg-slate-950/50 p-3 text-sm"
                >
                  <span>Version {version.version}</span>
                  <span
                    className={
                      version.status === "PUBLISHED"
                        ? "text-emerald-300"
                        : version.status === "DRAFT"
                          ? "text-amber-300"
                          : "text-slate-500"
                    }
                  >
                    {version.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

function FormPreview({
  fields,
}: {
  fields: Array<{
    id: string;
    label: string;
    description: string | null;
    placeholder: string | null;
    fieldType: ConfigurableFieldType;
    isRequired: boolean;
    options: unknown;
    visibilityRule: unknown;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        Read-only preview
      </p>
      <h2 className="mt-1 text-xl font-semibold">Field experience</h2>
      <div className="mt-5 space-y-4">
        {fields.map((field) => {
          const options = Array.isArray(field.options)
            ? field.options.filter(
                (value): value is string => typeof value === "string",
              )
            : [];
          const matrix = matrixOptions(field.options);
          const roster = repeatingGroupConfig(field.options);
          const calculated = calculatedFieldConfig(field.options);
          return (
            <div key={field.id} className="block">
              <span>
                {field.label}
                {field.isRequired && <span className="text-red-300"> *</span>}
              </span>
              {field.description && (
                <span className="mt-1 block text-xs text-slate-500">
                  {field.description}
                </span>
              )}
              {field.fieldType === "CALCULATED" && calculated ? (
                <div className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-100">
                  <p>Automatic {calculated.operation.replaceAll("_", " ").toLowerCase()} · {calculated.decimalPlaces} decimal places</p>
                  <p className="mt-1 text-xs text-slate-400">Sources: {calculated.sources.map((source) => `${source.fieldKey}${calculated.operation === "WEIGHTED_SUM" ? ` × ${source.weight}` : ""}`).join(" + ")}</p>
                  {calculated.bands.length > 0 && <p className="mt-1 text-xs text-slate-400">Bands: {calculated.bands.map((band) => `${band.min}–${band.max} ${band.label}`).join(" · ")}</p>}
                </div>
              ) : field.fieldType === "MATRIX" ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">Statement</th>
                        {matrix.columns.map((column) => (
                          <th key={column} className="p-2">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.rows.map((row) => (
                        <tr key={row} className="border-t border-white/10">
                          <th className="p-2 text-left font-normal">{row}</th>
                          {matrix.columns.map((column) => (
                            <td key={column} className="p-2 text-center">
                              <input type="radio" disabled />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : field.fieldType === "REPEATING_GROUP" && roster ? (
                <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 p-3 text-xs text-slate-400">
                  <p>{roster.minRows}–{roster.maxRows} rows · {roster.columns.length} columns</p>
                  <p className="mt-2">{roster.columns.map((column) => column.label).join(" · ")}</p>
                </div>
              ) : field.fieldType === "RANKING" ? (
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-300">
                  {options.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ol>
              ) : field.fieldType === "LONG_TEXT" ? (
                <textarea
                  disabled
                  rows={3}
                  placeholder={field.placeholder || ""}
                  className={input}
                />
              ) : field.fieldType === "SINGLE_SELECT" ||
                field.fieldType === "MULTI_SELECT" ? (
                <select
                  disabled
                  multiple={field.fieldType === "MULTI_SELECT"}
                  className={input}
                >
                  <option>
                    {options.length
                      ? "Select an option"
                      : "No options configured"}
                  </option>
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : field.fieldType === "BOOLEAN" ? (
                <input disabled type="checkbox" className="ml-3" />
              ) : (
                <input
                  disabled
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
                  className={input}
                />
              )}{" "}
              {Boolean(field.visibilityRule) && (
                <span className="mt-1 block text-[11px] text-amber-300">
                  Shown conditionally at runtime
                </span>
              )}
            </div>
          );
        })}
        {!fields.length && (
          <p className="text-sm text-slate-500">
            Add fields to preview this form.
          </p>
        )}
      </div>
    </section>
  );
}

function matrixOptions(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object")
    return { rows: [] as string[], columns: [] as string[] };
  const configured = value as { rows?: unknown; columns?: unknown };
  return {
    rows: Array.isArray(configured.rows)
      ? configured.rows.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    columns: Array.isArray(configured.columns)
      ? configured.columns.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}
