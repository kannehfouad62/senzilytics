"use client";

import { useActionState, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import { buildChartData, summarizeVariable, type ResearchDataRow, type ResearchVariable, type ResearchValue } from "@/modules/research/research-analysis";
import { boxPlot, confidenceInterval, contingencyTable, histogram, interpretPValue, linearRegression, oneWayAnova, pearsonCorrelation, spearmanCorrelation, welchTTest } from "@/modules/research/research-statistics";
import { initialFormActionState } from "@/core/actions/action-state";
import { saveResearchAnalysis } from "@/features/research/analysis-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";
import { validateSurveyWeights,weightDiagnostics,weightedFrequencies,weightedMean } from "@/modules/research/research-survey-weighting";

type AnalysisMode = "AUTO" | "DISTRIBUTION" | "BOX_PLOT" | "CROSSTAB" | "CORRELATION" | "GROUP_COMPARISON" | "REGRESSION";
const modes: Array<{ value: AnalysisMode; label: string }> = [
  { value: "AUTO", label: "Automatic" },
  { value: "DISTRIBUTION", label: "Histogram" },
  { value: "BOX_PLOT", label: "Box plot" },
  { value: "CROSSTAB", label: "Crosstab" },
  { value: "CORRELATION", label: "Correlation" },
  { value: "GROUP_COMPARISON", label: "Group comparison" },
  { value: "REGRESSION", label: "Regression" },
];
const panel = "rounded-3xl border border-white/10 bg-white/[.04]";
const input = "rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm";

export function ResearchAnalysisStudio({ variables, rows, collectionId, datasetVersionId }: { variables: ResearchVariable[]; rows: ResearchDataRow[]; collectionId?: string; datasetVersionId?: string }) {
  const [x, setX] = useState<ResearchVariable | null>(variables[0] ?? null);
  const [y, setY] = useState<ResearchVariable | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("AUTO");
  const [filterKey, setFilterKey] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [sortDirection, setSortDirection] = useState<"NONE" | "ASC" | "DESC">("NONE");
  const [search, setSearch] = useState("");
  const [bins, setBins] = useState(8);
  const [weightKey,setWeightKey]=useState("");
  const [saveState, saveAction, savePending] = useActionState(saveResearchAnalysis, initialFormActionState);
  useRefreshOnSuccess(saveState);
  const filterVariable = variables.find(variable => variable.key === filterKey) ?? null;
  const filterOptions = useMemo(() => filterVariable ? [...new Set(rows.flatMap(row => categories(row.values[filterVariable.key])))].sort() : [], [filterVariable, rows]);
  const filtered = useMemo(() => {
    const selected = filterVariable && filterValue ? rows.filter(row => categories(row.values[filterVariable.key]).includes(filterValue)) : [...rows];
    if (sortDirection !== "NONE" && x) selected.sort((first, second) => compare(first.values[x.key], second.values[x.key]) * (sortDirection === "ASC" ? 1 : -1));
    return selected;
  }, [filterValue, filterVariable, rows, sortDirection, x]);
  const visibleVariables = variables.filter(variable => `${variable.label} ${variable.key} ${variable.type}`.toLowerCase().includes(search.toLowerCase()));
  const effectiveMode = resolveMode(mode, x, y);
  const xSummary = x ? summarizeVariable(x, filtered) : null;
  const ySummary = y ? summarizeVariable(y, filtered) : null;
  const query = new URLSearchParams({ x: x?.key ?? "", y: y?.key ?? "", mode: effectiveMode });
  const weighting=useMemo(()=>{if(!weightKey||!x)return null;try{const diagnostics=weightDiagnostics(validateSurveyWeights(filtered,weightKey)),estimate=x.type==="NUMBER"?weightedMean(filtered,x.key,weightKey):weightedFrequencies(filtered,x.key,weightKey);return{diagnostics,estimate,error:null}}catch(cause){return{diagnostics:null,estimate:null,error:cause instanceof Error?cause.message:"Weights are invalid."}}},[filtered,weightKey,x]);

  return <div className="space-y-6">
    <section className={`${panel} p-5`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-slate-400"><span>Analysis method</span><select value={mode} onChange={event => setMode(event.target.value as AnalysisMode)} className={input}>{modes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-slate-400"><span>Filter variable</span><select value={filterKey} onChange={event => { setFilterKey(event.target.value); setFilterValue(""); }} className={input}><option value="">All responses</option>{variables.map(variable => <option key={variable.key} value={variable.key}>{variable.label}</option>)}</select></label>
        {filterVariable && <label className="grid gap-1 text-xs text-slate-400"><span>Filter value</span><select value={filterValue} onChange={event => setFilterValue(event.target.value)} className={input}><option value="">All values</option>{filterOptions.map(value => <option key={value}>{value}</option>)}</select></label>}
        <label className="grid gap-1 text-xs text-slate-400"><span>Sort X</span><select value={sortDirection} onChange={event => setSortDirection(event.target.value as typeof sortDirection)} className={input}><option value="NONE">Original order</option><option value="ASC">Ascending</option><option value="DESC">Descending</option></select></label>
        <label className="grid gap-1 text-xs text-slate-400"><span>Survey weight</span><select value={weightKey} onChange={event=>setWeightKey(event.target.value)} className={input}><option value="">Unweighted</option>{variables.filter(variable=>variable.type==="NUMBER").map(variable=><option key={variable.key} value={variable.key}>{variable.label}</option>)}</select></label>
        {effectiveMode === "DISTRIBUTION" && <label className="grid gap-1 text-xs text-slate-400"><span>Histogram bins</span><input type="number" min={2} max={30} value={bins} onChange={event => setBins(Math.max(2, Math.min(30, Number(event.target.value) || 2)))} className={`${input} w-24`}/></label>}
        <button onClick={() => { setFilterKey(""); setFilterValue(""); setSortDirection("NONE"); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">Reset filters</button>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[.32fr_1fr]">
      <aside className={`${panel} p-5`}>
        <h2 className="font-semibold">Variable library</h2>
        <p className="mt-1 text-xs text-slate-500">Drag variables into the analytical roles.</p>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search variables…" className={`${input} mt-4 w-full`}/>
        <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">{visibleVariables.map(variable => <button draggable onDragStart={event => event.dataTransfer.setData("variable", variable.key)} onClick={() => setX(variable)} key={variable.key} className="block w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-left hover:border-cyan-300/30"><span className="block text-sm font-medium">{variable.label}</span><span className="text-[11px] text-cyan-300">{variable.type} · {variable.key}</span></button>)}</div>
      </aside>

      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2"><DropSlot title="Group, category or X variable" variable={x} variables={variables} onDrop={setX}/><DropSlot title="Outcome or Y variable" variable={y} variables={variables} onDrop={setY} clear/></div>
        <section className={`${panel} p-6`}>
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">{modes.find(item => item.value === effectiveMode)?.label}</p><h2 className="mt-1 text-xl font-semibold">{analysisTitle(effectiveMode, x, y)}</h2><p className="mt-1 text-sm text-slate-400">{methodRequirement(effectiveMode)}</p></div>{collectionId&&<div className="flex gap-2"><a href={`/api/research/collections/${collectionId}/workbook?${query}`} className="rounded-xl border border-emerald-400/25 px-4 py-2 text-sm text-emerald-300">Excel workbook</a><a href={`/api/research/collections/${collectionId}/presentation?${query}`} className="rounded-xl border border-violet-400/25 px-4 py-2 text-sm text-violet-300">PowerPoint</a></div>}</div>
          <div className="mt-6 min-h-96"><AnalysisVisualization mode={effectiveMode} rows={filtered} x={x} y={y} bins={bins}/></div>
        </section>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Included responses" value={rows.length}/><Metric label="Filtered responses" value={filtered.length}/><Metric label="X missing" value={xSummary?.missing ?? 0}/><Metric label="X unique" value={xSummary?.unique ?? 0}/><Metric label="Y mean" value={format(ySummary?.mean)}/></div>
    <StatisticalResults mode={effectiveMode} rows={filtered} x={x} y={y}/>
    {weighting&&<section className={`${panel} border-violet-400/20 p-6`}><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Survey-weighted estimate</p>{weighting.error?<p className="mt-3 text-sm text-red-300">{weighting.error}</p>:<><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Sum of weights" value={format(weighting.diagnostics?.sumWeights)}/><Metric label="Effective N" value={format(weighting.diagnostics?.effectiveSampleSize)}/><Metric label="Design effect" value={format(weighting.diagnostics?.designEffect)}/><Metric label="Weight CV" value={format(weighting.diagnostics?.coefficientOfVariation)}/><Metric label="Weighted mean" value={format(weighting.estimate&&!Array.isArray(weighting.estimate)?weighting.estimate.mean:null)}/></div><p className="mt-4 text-xs text-slate-400">Weighting is explicit and does not replace the unweighted results above. Confirm the sampling design and weight construction before interpretation.</p></>}</section>}
    {x && <form action={saveAction} className={`${panel} p-6`}>
      <input type="hidden" name="collectionId" value={collectionId??""}/><input type="hidden" name="datasetVersionId" value={datasetVersionId??""}/><input type="hidden" name="weightVariableKey" value={weightKey}/><input type="hidden" name="method" value={effectiveMode}/><input type="hidden" name="xVariableKey" value={x.key}/><input type="hidden" name="yVariableKey" value={y?.key ?? ""}/><input type="hidden" name="filterVariableKey" value={filterKey}/><input type="hidden" name="filterValue" value={filterValue}/>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Save governed analysis</h2><p className="mt-1 text-sm text-slate-400">Freeze the current method, variables, filtered population and calculated results as a reviewable draft.</p></div><button disabled={savePending} className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{savePending ? "Saving…" : "Save analysis draft"}</button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-xs text-slate-400"><span>Analysis title</span><input name="title" required maxLength={160} defaultValue={analysisTitle(effectiveMode, x, y)} className={input}/></label><label className="grid gap-1 text-xs text-slate-400"><span>Hypothesis</span><input name="hypothesis" maxLength={2000} placeholder="Optional null or research hypothesis" className={input}/></label></div>
      <label className="mt-4 grid gap-1 text-xs text-slate-400"><span>Methodology and assumption notes</span><textarea name="methodologyNotes" maxLength={4000} rows={3} placeholder="Record sampling assumptions, exclusions, transformations and analyst decisions." className={input}/></label>
      {saveState.message && <p className={`mt-3 text-sm ${saveState.status === "ERROR" ? "text-red-300" : "text-emerald-300"}`}>{saveState.message}</p>}
    </form>}
    {xSummary && <section className={`${panel} p-6`}><h2 className="text-xl font-semibold">Descriptive statistics — {xSummary.label}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6"><Metric label="N" value={xSummary.present}/><Metric label="Mean" value={format(xSummary.mean)}/><Metric label="Median" value={format(xSummary.median)}/><Metric label="Std. deviation" value={format(xSummary.standardDeviation)}/><Metric label="Q1 / Q3" value={`${format(xSummary.q1)} / ${format(xSummary.q3)}`}/><Metric label="Minimum / Maximum" value={`${format(xSummary.min)} / ${format(xSummary.max)}`}/></div></section>}
  </div>;
}

function AnalysisVisualization({ mode, rows, x, y, bins }: { mode: AnalysisMode; rows: ResearchDataRow[]; x: ResearchVariable | null; y: ResearchVariable | null; bins: number }) {
  if (!x) return <Empty text="Select or drag an X variable to begin."/>;
  if (mode === "DISTRIBUTION") {
    if (x.type !== "NUMBER") return <Empty text="Histogram requires a numeric X variable."/>;
    return <Bars data={histogram(rows, x, bins)}/>;
  }
  if (mode === "BOX_PLOT") {
    if (x.type !== "NUMBER") return <Empty text="Box plot requires a numeric X variable."/>;
    const result = boxPlot(rows, x);
    return result ? <BoxPlotGraphic result={result}/> : <Empty text="No numeric observations are available."/>;
  }
  if (mode === "CROSSTAB") {
    if (!y) return <Empty text="Crosstab requires a second categorical variable."/>;
    return <CrosstabGraphic table={contingencyTable(rows, x, y)}/>;
  }
  if (mode === "CORRELATION" || mode === "REGRESSION") {
    if (x.type !== "NUMBER" || y?.type !== "NUMBER") return <Empty text="This method requires numeric X and Y variables."/>;
    const points = buildChartData(rows, x, y).filter((point): point is { x: number; y: number } => "x" in point && "y" in point);
    if (mode === "REGRESSION") {
      const regression = linearRegression(rows, x, y);
      const line = regression ? points.map(point => ({ x: point.x, y: regression.intercept + regression.slope * point.x })).sort((a, b) => a.x - b.x) : [];
      return <div className="h-96"><ResponsiveContainer width="100%" height="100%"><LineChart><CartesianGrid stroke="#1e293b"/><XAxis type="number" dataKey="x" domain={["auto", "auto"]} stroke="#94a3b8"/><YAxis type="number" dataKey="y" domain={["auto", "auto"]} stroke="#94a3b8"/><Tooltip/><Line data={line} dataKey="y" stroke="#a78bfa" dot={false} strokeWidth={2}/><Line data={points} dataKey="y" stroke="transparent" dot={{ fill: "#22d3ee", r: 4 }}/></LineChart></ResponsiveContainer></div>;
    }
    return <div className="h-96"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke="#1e293b"/><XAxis dataKey="x" name={x.label} stroke="#94a3b8"/><YAxis dataKey="y" name={y.label} stroke="#94a3b8"/><Tooltip cursor={{ strokeDasharray: "3 3" }}/><Scatter data={points} fill="#22d3ee"/></ScatterChart></ResponsiveContainer></div>;
  }
  const data = buildChartData(rows, x, y) as Array<Record<string, string | number>>;
  return <Bars data={data}/>;
}

function StatisticalResults({ mode, rows, x, y }: { mode: AnalysisMode; rows: ResearchDataRow[]; x: ResearchVariable | null; y: ResearchVariable | null }) {
  if (!x) return null;
  let title = "Inference summary";
  let metrics: Array<{ label: string; value: string | number }> = [];
  let interpretation = "Choose compatible variables to run inferential analysis.";
  if (mode === "DISTRIBUTION" || mode === "BOX_PLOT") {
    const interval = confidenceInterval(rows, x);
    metrics = [{ label: "Mean", value: format(interval?.mean) }, { label: "Standard error", value: format(interval?.standardError) }, { label: "95% CI lower", value: format(interval?.lower) }, { label: "95% CI upper", value: format(interval?.upper) }];
    interpretation = interval ? `The estimated population mean lies between ${format(interval.lower)} and ${format(interval.upper)} at 95% confidence under the sampling assumptions.` : "At least two numeric observations are required.";
  } else if (mode === "CROSSTAB" && y) {
    title = "Chi-square test of independence";
    const result = contingencyTable(rows, x, y);
    metrics = [{ label: "χ²", value: format(result.statistic) }, { label: "Degrees of freedom", value: result.degreesOfFreedom }, { label: "p-value", value: formatP(result.pValue) }, { label: "Cramér’s V", value: format(result.cramersV) }];
    interpretation = interpretPValue(result.pValue);
  } else if (mode === "CORRELATION" && y) {
    title = "Correlation inference";
    const pearson = pearsonCorrelation(rows, x, y);
    const spearman = spearmanCorrelation(rows, x, y);
    metrics = [{ label: "Pearson r", value: format(pearson?.coefficient) }, { label: "Pearson p", value: formatP(pearson?.pValue) }, { label: "Spearman ρ", value: format(spearman?.coefficient) }, { label: "Spearman p", value: formatP(spearman?.pValue) }];
    interpretation = interpretPValue(pearson?.pValue);
  } else if (mode === "GROUP_COMPARISON" && y) {
    const anova = oneWayAnova(rows, x, y);
    const tTest = welchTTest(rows, x, y);
    title = tTest ? "Welch independent-samples t-test" : "One-way analysis of variance";
    metrics = tTest ? [{ label: "t", value: format(tTest.statistic) }, { label: "Degrees of freedom", value: format(tTest.degreesOfFreedom) }, { label: "p-value", value: formatP(tTest.pValue) }, { label: "Cohen’s d", value: format(tTest.cohensD) }] : [{ label: "F", value: format(anova?.statistic) }, { label: "Between df", value: anova?.numeratorDf ?? "—" }, { label: "Within df", value: anova?.denominatorDf ?? "—" }, { label: "Eta squared", value: format(anova?.etaSquared) }];
    interpretation = interpretPValue(tTest?.pValue ?? anova?.pValue);
  } else if (mode === "REGRESSION" && y) {
    title = "Simple linear regression";
    const result = linearRegression(rows, x, y);
    metrics = [{ label: "Slope", value: format(result?.slope) }, { label: "Intercept", value: format(result?.intercept) }, { label: "R²", value: format(result?.rSquared) }, { label: "p-value", value: formatP(result?.pValue) }];
    interpretation = result ? `${y.label} changes by approximately ${format(result.slope)} units for each one-unit increase in ${x.label}. ${interpretPValue(result.pValue)}` : "At least three paired observations with varying X values are required.";
  }
  return <section className={`${panel} p-6`}><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <Metric key={metric.label} {...metric}/>)}</div><p className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-300/[.04] p-4 text-sm text-slate-300">{interpretation} Results require appropriate sampling, independence and model assumptions; qualified analysts must verify those assumptions before decisions.</p></section>;
}

function Bars({ data }: { data: Array<Record<string, string | number>> }) { return <div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#1e293b"/><XAxis dataKey="name" stroke="#94a3b8"/><YAxis stroke="#94a3b8"/><Tooltip/><Bar dataKey="value" fill="#22d3ee" radius={[7, 7, 0, 0]}/></BarChart></ResponsiveContainer></div>; }
function BoxPlotGraphic({ result }: { result: NonNullable<ReturnType<typeof boxPlot>> }) { const range = Math.max(result.displayMaximum - result.displayMinimum, 1); const position = (value: number) => 8 + 84 * (value - result.displayMinimum) / range; return <div className="flex h-96 flex-col justify-center"><svg viewBox="0 0 100 34" role="img" aria-label="Box and whisker plot"><line x1="8" x2="92" y1="17" y2="17" stroke="#64748b" strokeWidth=".6"/><line x1={position(result.minimum)} x2={position(result.q1)} y1="17" y2="17" stroke="#22d3ee"/><line x1={position(result.q3)} x2={position(result.maximum)} y1="17" y2="17" stroke="#22d3ee"/><rect x={position(result.q1)} y="10" width={Math.max(.5, position(result.q3) - position(result.q1))} height="14" fill="#164e63" stroke="#22d3ee"/><line x1={position(result.median)} x2={position(result.median)} y1="10" y2="24" stroke="#f8fafc"/><line x1={position(result.minimum)} x2={position(result.minimum)} y1="13" y2="21" stroke="#22d3ee"/><line x1={position(result.maximum)} x2={position(result.maximum)} y1="13" y2="21" stroke="#22d3ee"/>{result.outliers.map((value, index) => <circle key={`${value}-${index}`} cx={position(value)} cy={index % 2 ? 7 : 27} r="1" fill="#f59e0b"/>)}</svg><div className="grid grid-cols-5 text-center text-xs text-slate-400"><span>Min {format(result.minimum)}</span><span>Q1 {format(result.q1)}</span><span>Median {format(result.median)}</span><span>Q3 {format(result.q3)}</span><span>Max {format(result.maximum)}</span></div><p className="mt-5 text-center text-sm text-amber-300">{result.outliers.length} potential outlier{result.outliers.length === 1 ? "" : "s"}</p></div>; }
function CrosstabGraphic({ table }: { table: ReturnType<typeof contingencyTable> }) { const maximum = Math.max(...table.cells.flat(), 1); return <div className="overflow-x-auto"><table className="w-full border-separate border-spacing-1 text-sm"><thead><tr><th className="p-3 text-left text-slate-500">Row / Column</th>{table.columnLabels.map(label => <th key={label} className="p-3 text-center text-slate-300">{label}</th>)}<th className="p-3 text-center">Total</th></tr></thead><tbody>{table.rowLabels.map((label, row) => <tr key={label}><th className="p-3 text-left">{label}</th>{table.cells[row].map((value, column) => <td key={table.columnLabels[column]} className="rounded-lg p-4 text-center font-semibold" style={{ backgroundColor: `rgba(34,211,238,${.08 + .7 * value / maximum})` }}>{value}</td>)}<td className="p-3 text-center font-semibold">{table.rowTotals[row]}</td></tr>)}</tbody></table></div>; }
function DropSlot({ title, variable, variables, onDrop, clear }: { title: string; variable: ResearchVariable | null; variables: ResearchVariable[]; onDrop: (value: ResearchVariable | null) => void; clear?: boolean }) { return <div onDragOver={event => event.preventDefault()} onDrop={event => onDrop(variables.find(item => item.key === event.dataTransfer.getData("variable")) ?? null)} className="min-h-24 rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-300/[.04] p-4"><div className="flex justify-between"><p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>{clear && variable && <button onClick={() => onDrop(null)} className="text-xs text-red-300">Clear</button>}</div><p className="mt-3 font-semibold">{variable?.label ?? "Drop a variable here"}</p><p className="text-xs text-cyan-300">{variable?.type}</p></div>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="grid h-96 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500">{text}</div>; }
const format = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : Number(value.toFixed(3));
const formatP = (value: number | null | undefined) => value === null || value === undefined ? "—" : value < .001 ? "< 0.001" : value.toFixed(3);
const categories = (value: ResearchValue) => value === null || value === "" ? [] : Array.isArray(value) ? value.map(String) : [String(value)];
const compare = (first: ResearchValue, second: ResearchValue) => typeof first === "number" && typeof second === "number" ? first - second : String(first ?? "").localeCompare(String(second ?? ""));
function resolveMode(mode: AnalysisMode, x: ResearchVariable | null, y: ResearchVariable | null): AnalysisMode { if (mode !== "AUTO") return mode; if (x?.type === "NUMBER" && y?.type === "NUMBER") return "CORRELATION"; if (y?.type === "NUMBER") return "GROUP_COMPARISON"; if (x?.type === "NUMBER") return "DISTRIBUTION"; if (y) return "CROSSTAB"; return "AUTO"; }
function analysisTitle(mode: AnalysisMode, x: ResearchVariable | null, y: ResearchVariable | null) { if (!x) return "Select variables"; if (mode === "DISTRIBUTION") return `Distribution of ${x.label}`; if (mode === "BOX_PLOT") return `Box plot of ${x.label}`; if (mode === "CROSSTAB") return `${x.label} by ${y?.label ?? "second variable"}`; if (mode === "CORRELATION") return `${x.label} and ${y?.label ?? "Y variable"}`; if (mode === "GROUP_COMPARISON") return `${y?.label ?? "Outcome"} across ${x.label}`; if (mode === "REGRESSION") return `${y?.label ?? "Outcome"} predicted by ${x.label}`; return `Frequency distribution for ${x.label}`; }
function methodRequirement(mode: AnalysisMode) { if (mode === "CROSSTAB") return "Two categorical variables; reports χ² and Cramér’s V."; if (mode === "CORRELATION") return "Two numeric variables; reports Pearson r and Spearman ρ."; if (mode === "GROUP_COMPARISON") return "Categorical X and numeric Y; automatically selects Welch t-test or one-way ANOVA."; if (mode === "REGRESSION") return "Numeric X and Y; reports equation, R² and slope significance."; if (mode === "BOX_PLOT") return "Numeric variable with IQR-based potential outlier display."; if (mode === "DISTRIBUTION") return "Numeric variable with adjustable histogram bins and 95% mean confidence interval."; return "Variable-aware automatic analysis."; }
