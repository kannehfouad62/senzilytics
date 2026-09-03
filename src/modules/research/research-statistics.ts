import type { ResearchDataRow, ResearchVariable, ResearchValue } from "@/modules/research/research-analysis";

const EPSILON = 1e-12;
const numericValues = (rows: ResearchDataRow[], variable: ResearchVariable) => rows.flatMap(row => {
  const value = row.values[variable.key];
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
});
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sampleVariance = (values: number[]) => values.length > 1 ? values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1) : 0;
const clampProbability = (value: number) => Math.max(0, Math.min(1, value));

function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = .9999999999998099;
  const shifted = value - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - .5;
  return .5 * Math.log(2 * Math.PI) + (shifted + .5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a: number, b: number, x: number) {
  const maxIterations = 200;
  const floor = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = iteration * (b - iteration) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    result *= d * c;
    aa = -(a + iteration) * (qab + iteration) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return result;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? factor * betaFraction(a, b, x) / a : 1 - factor * betaFraction(b, a, 1 - x) / b;
}

function regularizedGammaQ(shape: number, x: number) {
  if (x <= 0) return 1;
  if (x < shape + 1) {
    let term = 1 / shape;
    let sum = term;
    for (let index = 1; index < 200; index += 1) {
      term *= x / (shape + index);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
    }
    return clampProbability(1 - sum * Math.exp(-x + shape * Math.log(x) - logGamma(shape)));
  }
  let b = x + 1 - shape;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let result = d;
  for (let index = 1; index < 200; index += 1) {
    const an = -index * (index - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return clampProbability(result * Math.exp(-x + shape * Math.log(x) - logGamma(shape)));
}

const twoSidedTPValue = (t: number, degreesOfFreedom: number) => regularizedBeta(degreesOfFreedom / (degreesOfFreedom + t * t), degreesOfFreedom / 2, .5);
const fUpperTail = (f: number, numeratorDf: number, denominatorDf: number) => 1 - regularizedBeta((numeratorDf * f) / (numeratorDf * f + denominatorDf), numeratorDf / 2, denominatorDf / 2);

export function pearsonCorrelation(rows: ResearchDataRow[], x: ResearchVariable, y: ResearchVariable) {
  const pairs = rows.flatMap(row => {
    const first = row.values[x.key];
    const second = row.values[y.key];
    return typeof first === "number" && typeof second === "number" && Number.isFinite(first) && Number.isFinite(second) ? [[first, second] as const] : [];
  });
  if (pairs.length < 3) return null;
  const xMean = mean(pairs.map(pair => pair[0]));
  const yMean = mean(pairs.map(pair => pair[1]));
  const numerator = pairs.reduce((sum, pair) => sum + (pair[0] - xMean) * (pair[1] - yMean), 0);
  const xSpread = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[0] - xMean) ** 2, 0));
  const ySpread = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[1] - yMean) ** 2, 0));
  if (!xSpread || !ySpread) return null;
  const coefficient = numerator / (xSpread * ySpread);
  const statistic = coefficient * Math.sqrt((pairs.length - 2) / Math.max(EPSILON, 1 - coefficient ** 2));
  return { coefficient, n: pairs.length, statistic, degreesOfFreedom: pairs.length - 2, pValue: twoSidedTPValue(Math.abs(statistic), pairs.length - 2) };
}

function ranks(values: number[]) {
  const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = Array<number>(values.length);
  for (let start = 0; start < ordered.length;) {
    let end = start;
    while (end + 1 < ordered.length && ordered[end + 1].value === ordered[start].value) end += 1;
    const rank = (start + end + 2) / 2;
    for (let index = start; index <= end; index += 1) result[ordered[index].index] = rank;
    start = end + 1;
  }
  return result;
}

export function spearmanCorrelation(rows: ResearchDataRow[], x: ResearchVariable, y: ResearchVariable) {
  const pairs = rows.flatMap(row => {
    const first = row.values[x.key];
    const second = row.values[y.key];
    return typeof first === "number" && typeof second === "number" ? [[first, second] as const] : [];
  });
  const xRanks = ranks(pairs.map(pair => pair[0]));
  const yRanks = ranks(pairs.map(pair => pair[1]));
  const rankRows = pairs.map((_, index) => ({ assignmentId: String(index), responseId: String(index), submittedAt: "", values: { x: xRanks[index], y: yRanks[index] } }));
  return pearsonCorrelation(rankRows, { ...x, key: "x" }, { ...y, key: "y" });
}

export function confidenceInterval(rows: ResearchDataRow[], variable: ResearchVariable, confidence = .95) {
  const values = numericValues(rows, variable);
  if (values.length < 2 || confidence !== .95) return null;
  const average = mean(values);
  const standardError = Math.sqrt(sampleVariance(values) / values.length);
  const df = values.length - 1;
  const critical = df === 1 ? 12.706 : df === 2 ? 4.303 : df === 3 ? 3.182 : df === 4 ? 2.776 : df === 5 ? 2.571 : df <= 7 ? 2.447 : df <= 9 ? 2.306 : df <= 14 ? 2.145 : df <= 19 ? 2.093 : df <= 29 ? 2.045 : df <= 39 ? 2.023 : df <= 59 ? 2 : df <= 119 ? 1.98 : 1.96;
  return { mean: average, standardError, lower: average - critical * standardError, upper: average + critical * standardError, confidence, n: values.length };
}

export function histogram(rows: ResearchDataRow[], variable: ResearchVariable, requestedBins?: number) {
  const values = numericValues(rows, variable);
  if (!values.length) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return [{ name: String(minimum), lower: minimum, upper: maximum, value: values.length }];
  const binCount = Math.max(2, Math.min(30, requestedBins ?? Math.ceil(Math.log2(values.length) + 1)));
  const width = (maximum - minimum) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({ lower: minimum + index * width, upper: minimum + (index + 1) * width, value: 0 }));
  values.forEach(value => { bins[Math.min(binCount - 1, Math.floor((value - minimum) / width))].value += 1; });
  return bins.map(bin => ({ ...bin, name: `${formatNumber(bin.lower)}–${formatNumber(bin.upper)}` }));
}

export function boxPlot(rows: ResearchDataRow[], variable: ResearchVariable) {
  const values = numericValues(rows, variable).sort((a, b) => a - b);
  if (!values.length) return null;
  const quantile = (p: number) => { const position = (values.length - 1) * p; const lower = Math.floor(position); const upper = Math.ceil(position); return lower === upper ? values[lower] : values[lower] + (values[upper] - values[lower]) * (position - lower); };
  const q1 = quantile(.25);
  const median = quantile(.5);
  const q3 = quantile(.75);
  const spread = q3 - q1;
  const lowerFence = q1 - 1.5 * spread;
  const upperFence = q3 + 1.5 * spread;
  const regular = values.filter(value => value >= lowerFence && value <= upperFence);
  return { minimum: regular[0], q1, median, q3, maximum: regular.at(-1)!, displayMinimum: values[0], displayMaximum: values.at(-1)!, outliers: values.filter(value => value < lowerFence || value > upperFence), n: values.length };
}

export function contingencyTable(rows: ResearchDataRow[], rowVariable: ResearchVariable, columnVariable: ResearchVariable) {
  const complete = rows.flatMap(row => { const rowLabel = categoryLabel(row.values[rowVariable.key]); const columnLabel = categoryLabel(row.values[columnVariable.key]); return rowLabel && columnLabel ? [{ rowLabel, columnLabel }] : []; });
  const rowLabels = [...new Set(complete.map(row => row.rowLabel))];
  const columnLabels = [...new Set(complete.map(row => row.columnLabel))];
  const cells = rowLabels.map(rowLabel => columnLabels.map(columnLabel => complete.filter(row => row.rowLabel === rowLabel && row.columnLabel === columnLabel).length));
  const total = cells.flat().reduce((sum, value) => sum + value, 0);
  const rowTotals = cells.map(row => row.reduce((sum, value) => sum + value, 0));
  const columnTotals = columnLabels.map((_, column) => cells.reduce((sum, row) => sum + row[column], 0));
  let statistic = 0;
  cells.forEach((row, rowIndex) => row.forEach((observed, columnIndex) => { const expected = rowTotals[rowIndex] * columnTotals[columnIndex] / total; if (expected) statistic += (observed - expected) ** 2 / expected; }));
  const degreesOfFreedom = Math.max(0, (rowLabels.length - 1) * (columnLabels.length - 1));
  return { rowLabels, columnLabels, cells, rowTotals, columnTotals, total, statistic, degreesOfFreedom, pValue: degreesOfFreedom ? regularizedGammaQ(degreesOfFreedom / 2, statistic / 2) : null, cramersV: total && Math.min(rowLabels.length - 1, columnLabels.length - 1) > 0 ? Math.sqrt(statistic / (total * Math.min(rowLabels.length - 1, columnLabels.length - 1))) : null };
}

export function welchTTest(rows: ResearchDataRow[], groupVariable: ResearchVariable, outcomeVariable: ResearchVariable) {
  const grouped = groupNumeric(rows, groupVariable, outcomeVariable);
  if (grouped.length !== 2 || grouped.some(group => group.values.length < 2)) return null;
  const [first, second] = grouped;
  const firstMean = mean(first.values);
  const secondMean = mean(second.values);
  const firstVariance = sampleVariance(first.values);
  const secondVariance = sampleVariance(second.values);
  const standardErrorSquared = firstVariance / first.values.length + secondVariance / second.values.length;
  if (!standardErrorSquared) return null;
  const statistic = (firstMean - secondMean) / Math.sqrt(standardErrorSquared);
  const degreesOfFreedom = standardErrorSquared ** 2 / ((firstVariance / first.values.length) ** 2 / (first.values.length - 1) + (secondVariance / second.values.length) ** 2 / (second.values.length - 1));
  const pooledStandardDeviation = Math.sqrt(((first.values.length - 1) * firstVariance + (second.values.length - 1) * secondVariance) / (first.values.length + second.values.length - 2));
  return { groups: [first.name, second.name], means: [firstMean, secondMean], counts: [first.values.length, second.values.length], difference: firstMean - secondMean, statistic, degreesOfFreedom, pValue: twoSidedTPValue(Math.abs(statistic), degreesOfFreedom), cohensD: pooledStandardDeviation ? (firstMean - secondMean) / pooledStandardDeviation : null };
}

export function oneWayAnova(rows: ResearchDataRow[], groupVariable: ResearchVariable, outcomeVariable: ResearchVariable) {
  const groups = groupNumeric(rows, groupVariable, outcomeVariable).filter(group => group.values.length);
  const all = groups.flatMap(group => group.values);
  if (groups.length < 2 || all.length <= groups.length) return null;
  const grandMean = mean(all);
  const between = groups.reduce((sum, group) => sum + group.values.length * (mean(group.values) - grandMean) ** 2, 0);
  const within = groups.reduce((sum, group) => sum + group.values.reduce((groupSum, value) => groupSum + (value - mean(group.values)) ** 2, 0), 0);
  const numeratorDf = groups.length - 1;
  const denominatorDf = all.length - groups.length;
  const statistic = within ? (between / numeratorDf) / (within / denominatorDf) : Infinity;
  return { groups: groups.map(group => ({ name: group.name, n: group.values.length, mean: mean(group.values) })), statistic, numeratorDf, denominatorDf, pValue: Number.isFinite(statistic) ? fUpperTail(statistic, numeratorDf, denominatorDf) : 0, etaSquared: between + within ? between / (between + within) : null };
}

export function linearRegression(rows: ResearchDataRow[], x: ResearchVariable, y: ResearchVariable) {
  const pairs = rows.flatMap(row => {
    const first = row.values[x.key];
    const second = row.values[y.key];
    return typeof first === "number" && typeof second === "number" ? [[first, second] as const] : [];
  });
  if (pairs.length < 3) return null;
  const xMean = mean(pairs.map(pair => pair[0]));
  const yMean = mean(pairs.map(pair => pair[1]));
  const xx = pairs.reduce((sum, pair) => sum + (pair[0] - xMean) ** 2, 0);
  if (!xx) return null;
  const slope = pairs.reduce((sum, pair) => sum + (pair[0] - xMean) * (pair[1] - yMean), 0) / xx;
  const intercept = yMean - slope * xMean;
  const residual = pairs.reduce((sum, pair) => sum + (pair[1] - (intercept + slope * pair[0])) ** 2, 0);
  const total = pairs.reduce((sum, pair) => sum + (pair[1] - yMean) ** 2, 0);
  const slopeStandardError = Math.sqrt((residual / (pairs.length - 2)) / xx);
  const statistic = slopeStandardError ? slope / slopeStandardError : Infinity;
  return { slope, intercept, rSquared: total ? 1 - residual / total : 1, n: pairs.length, statistic, degreesOfFreedom: pairs.length - 2, pValue: Number.isFinite(statistic) ? twoSidedTPValue(Math.abs(statistic), pairs.length - 2) : 0 };
}

export function interpretPValue(pValue: number | null | undefined, alpha = .05) {
  if (pValue === null || pValue === undefined || !Number.isFinite(pValue)) return "Insufficient data for inference.";
  return pValue < alpha ? `Statistically significant at α = ${alpha}.` : `Not statistically significant at α = ${alpha}.`;
}

export function buildAnalysisSnapshot(method: string, rows: ResearchDataRow[], x: ResearchVariable, y?: ResearchVariable | null) {
  if (method === "DISTRIBUTION") return { method, summary: confidenceInterval(rows, x), histogram: histogram(rows, x) };
  if (method === "BOX_PLOT") return { method, summary: boxPlot(rows, x) };
  if (method === "CROSSTAB" && y) return { method, result: contingencyTable(rows, x, y) };
  if (method === "CORRELATION" && y) return { method, pearson: pearsonCorrelation(rows, x, y), spearman: spearmanCorrelation(rows, x, y) };
  if (method === "GROUP_COMPARISON" && y) return { method, welch: welchTTest(rows, x, y), anova: oneWayAnova(rows, x, y) };
  if (method === "REGRESSION" && y) return { method, result: linearRegression(rows, x, y) };
  return { method: "DESCRIPTIVE", summary: { x: confidenceInterval(rows, x), y: y ? confidenceInterval(rows, y) : null } };
}

const categories = (value: ResearchValue) => value === null || value === "" ? [] : Array.isArray(value) ? value.map(String) : [String(value)];
const groupNumeric = (rows: ResearchDataRow[], group: ResearchVariable, outcome: ResearchVariable) => {
  const grouped = new Map<string, number[]>();
  rows.forEach(row => {
    const value = row.values[outcome.key];
    if (typeof value !== "number") return;
    const category = categoryLabel(row.values[group.key]);
    if (category) grouped.set(category, [...(grouped.get(category) ?? []), value]);
  });
  return [...grouped].map(([name, values]) => ({ name, values }));
};
const categoryLabel = (value: ResearchValue) => { const values = categories(value); return values.length ? values.join(" | ") : null; };
const formatNumber = (value: number) => Number(value.toPrecision(4)).toString();
