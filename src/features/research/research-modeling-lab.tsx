"use client";
import { useActionState, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ResearchDataRow,
  ResearchVariable,
} from "@/modules/research/research-analysis";
import {
  cronbachAlpha,
  logisticRegression,
  multipleLinearRegression,
} from "@/modules/research/research-modeling";
import { initialFormActionState } from "@/core/actions/action-state";
import { saveResearchAnalysis } from "@/features/research/analysis-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";
const panel = "rounded-3xl border border-white/10 bg-white/[.04]",
  input = "rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm";
export function ResearchModelingLab({
  variables,
  rows,
  collectionId,
  datasetVersionId,
}: {
  variables: ResearchVariable[];
  rows: ResearchDataRow[];
  collectionId?: string;
  datasetVersionId?: string;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveResearchAnalysis,
    initialFormActionState,
  );
  useRefreshOnSuccess(saveState);
  const numeric = variables.filter((v) => v.type === "NUMBER"),
    [mode, setMode] = useState<"LINEAR" | "LOGISTIC" | "RELIABILITY">("LINEAR"),
    [selected, setSelected] = useState<string[]>(
      numeric.slice(0, 2).map((v) => v.key),
    ),
    [outcomeKey, setOutcomeKey] = useState(
      numeric[2]?.key ?? numeric[0]?.key ?? "",
    );
  const predictors = numeric.filter(
      (v) => selected.includes(v.key) && v.key !== outcomeKey,
    ),
    outcome = variables.find((v) => v.key === outcomeKey) ?? null,
    result = useMemo(
      () =>
        mode === "RELIABILITY"
          ? cronbachAlpha(
              rows,
              numeric.filter((v) => selected.includes(v.key)),
            )
          : outcome
            ? mode === "LINEAR"
              ? multipleLinearRegression(rows, predictors, outcome)
              : logisticRegression(rows, predictors, outcome)
            : null,
      [mode, outcome, predictors, rows, selected, numeric],
    );
  const terms =
    result && "terms" in result
      ? result.terms.map((term) => ({
          name: term.term,
          value: "coefficient" in term ? term.coefficient : 0,
        }))
      : result && "itemStatistics" in result
        ? result.itemStatistics.map((item) => ({
            name: item.item,
            value: item.mean,
          }))
        : [];
  return (
    <section className={`${panel} mt-9 p-6`}>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">
        Advanced modeling
      </p>
      <h2 className="mt-1 text-2xl font-semibold">
        Modeling & Reliability Lab
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Select multiple numeric predictors or scale items. Complete-case
        analysis is applied and reported transparently.
      </p>
      <div className="mt-5 flex flex-wrap gap-4">
        <label className="grid gap-1 text-xs text-slate-400">
          <span>Method</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className={input}
          >
            <option value="LINEAR">Multiple linear regression</option>
            <option value="LOGISTIC">Binary logistic regression</option>
            <option value="RELIABILITY">Cronbach reliability</option>
          </select>
        </label>
        {mode !== "RELIABILITY" && (
          <label className="grid gap-1 text-xs text-slate-400">
            <span>Outcome</span>
            <select
              value={outcomeKey}
              onChange={(e) => setOutcomeKey(e.target.value)}
              className={input}
            >
              {variables.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {numeric.map((v) => (
          <label
            key={v.key}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(v.key)}
              disabled={v.key === outcomeKey && mode !== "RELIABILITY"}
              onChange={(e) =>
                setSelected((current) =>
                  e.target.checked
                    ? [...new Set([...current, v.key])]
                    : current.filter((key) => key !== v.key),
                )
              }
            />
            <span>{v.label}</span>
          </label>
        ))}
      </div>
      {!result ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
          Select enough complete variables and observations for this model.
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {"n" in result && (
              <Metric label="Complete cases" value={result.n} />
            )}{" "}
            {"rSquared" in result && (
              <>
                <Metric label="R²" value={fmt(result.rSquared)} />
                <Metric
                  label="Adjusted R²"
                  value={fmt(result.adjustedRSquared)}
                />
                <Metric label="RMSE" value={fmt(result.rootMeanSquareError)} />
              </>
            )}{" "}
            {"accuracy" in result && (
              <Metric
                label="Classification accuracy"
                value={`${fmt(result.accuracy * 100)}%`}
              />
            )}{" "}
            {"alpha" in result && (
              <>
                <Metric label="Cronbach’s α" value={fmt(result.alpha)} />
                <Metric label="Scale items" value={result.itemCount} />
              </>
            )}
          </div>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={terms}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {"diagnostics" in result &&
            result.diagnostics.length > 0 &&
            "residual" in result.diagnostics[0] && (
              <div className="mt-6">
                <h3 className="font-semibold">Residual diagnostics</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="#1e293b" />
                      <XAxis dataKey="predicted" stroke="#94a3b8" />
                      <YAxis dataKey="residual" stroke="#94a3b8" />
                      <Tooltip />
                      <Scatter data={result.diagnostics} fill="#22d3ee" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
        </>
      )}
      {result && (
        <form
          action={saveAction}
          className="mt-8 rounded-2xl border border-violet-400/20 p-5"
        >
          <input type="hidden" name="collectionId" value={collectionId ?? ""} />
          <input type="hidden" name="datasetVersionId" value={datasetVersionId ?? ""} />
          <input
            type="hidden"
            name="method"
            value={
              mode === "LINEAR"
                ? "MULTIPLE_REGRESSION"
                : mode === "LOGISTIC"
                  ? "LOGISTIC_REGRESSION"
                  : "RELIABILITY"
            }
          />
          <input
            type="hidden"
            name="xVariableKey"
            value={
              predictors[0]?.key ??
              numeric.find((v) => selected.includes(v.key))?.key ??
              ""
            }
          />
          <input
            type="hidden"
            name="yVariableKey"
            value={mode === "RELIABILITY" ? "" : outcomeKey}
          />
          <input
            type="hidden"
            name="variableKeys"
            value={(mode === "RELIABILITY"
              ? selected
              : predictors.map((v) => v.key)
            ).join(",")}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="title"
              required
              maxLength={160}
              placeholder="Model title"
              className={input}
            />
            <input
              name="hypothesis"
              maxLength={2000}
              placeholder="Model hypothesis"
              className={input}
            />
          </div>
          <textarea
            name="methodologyNotes"
            required
            minLength={20}
            maxLength={4000}
            rows={3}
            placeholder="Methodology, assumptions and model decisions"
          className={`${input} mt-3 w-full`}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              disabled={savePending}
              className="rounded-xl bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {savePending ? "Saving…" : "Save governed model"}
            </button>
            {saveState.message && (
              <span
                className={
                  saveState.status === "ERROR"
                    ? "text-sm text-red-300"
                    : "text-sm text-emerald-300"
                }
              >
                {saveState.message}
              </span>
            )}
          </div>
        </form>
      )}{" "}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
const fmt = (value: number) => Number(value.toFixed(3));
