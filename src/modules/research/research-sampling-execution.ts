import { createHash } from "node:crypto";

import { ResearchSamplingDesignType } from "@prisma/client";

export type SamplingFrameRow = {
  frameRowNumber: number;
  unitReference: string;
  stratum: string | null;
  cluster: string | null;
};

export type SelectedSamplingUnit = SamplingFrameRow & {
  selectionOrder: number;
  inclusionProbability: number | null;
  baseWeight: number | null;
  isReserve: boolean;
};

export type SamplingExecutionResult = {
  units: SelectedSamplingUnit[];
  snapshot: {
    algorithm: ResearchSamplingDesignType;
    frameSize: number;
    requestedPrimary: number;
    selectedPrimary: number;
    requestedReserve: number;
    selectedReserve: number;
    seedFingerprint: string;
    allocations: Array<{
      group: string;
      frame: number;
      primary: number;
      reserve: number;
    }>;
  };
};

export function generateSamplingSelection(input: {
  type: ResearchSamplingDesignType;
  rows: SamplingFrameRow[];
  targetSampleSize: number;
  reserveSampleSize: number;
  seed: string;
}): SamplingExecutionResult {
  validate(input);
  const random = seededRandom(input.seed);
  const totalRequested = input.targetSampleSize + input.reserveSampleSize;
  let primary: SamplingFrameRow[] = [];
  let reserve: SamplingFrameRow[] = [];
  let allocations: SamplingExecutionResult["snapshot"]["allocations"] = [];

  if (input.type === ResearchSamplingDesignType.CENSUS) {
    primary = [...input.rows];
    allocations = [
      {
        group: "Population",
        frame: input.rows.length,
        primary: primary.length,
        reserve: 0,
      },
    ];
  } else if (input.type === ResearchSamplingDesignType.STRATIFIED) {
    const groups = groupRows(input.rows, "stratum");
    const primaryAllocation = proportionalAllocation(
      groups,
      input.targetSampleSize,
    );
    const remainingGroups = new Map<string, SamplingFrameRow[]>();
    for (const [group, rows] of groups) {
      const ordered = shuffled(rows, random);
      const take = primaryAllocation.get(group) ?? 0;
      primary.push(...ordered.slice(0, take));
      remainingGroups.set(group, ordered.slice(take));
    }
    const reserveAllocation = proportionalAllocation(
      remainingGroups,
      input.reserveSampleSize,
    );
    for (const [group, rows] of remainingGroups)
      reserve.push(...rows.slice(0, reserveAllocation.get(group) ?? 0));
    allocations = [...groups].map(([group, rows]) => ({
      group,
      frame: rows.length,
      primary: primaryAllocation.get(group) ?? 0,
      reserve: reserveAllocation.get(group) ?? 0,
    }));
  } else if (input.type === ResearchSamplingDesignType.SYSTEMATIC) {
    const ordered = [...input.rows];
    const interval = ordered.length / input.targetSampleSize;
    const start = random() * interval;
    primary = Array.from(
      { length: input.targetSampleSize },
      (_, index) => ordered[Math.floor(start + index * interval)]!,
    ).filter(Boolean);
    const selected = new Set(primary.map((row) => row.unitReference));
    reserve = shuffled(
      ordered.filter((row) => !selected.has(row.unitReference)),
      random,
    ).slice(0, input.reserveSampleSize);
    allocations = [
      {
        group: "Systematic frame",
        frame: ordered.length,
        primary: primary.length,
        reserve: reserve.length,
      },
    ];
  } else if (input.type === ResearchSamplingDesignType.CLUSTER) {
    const groups = groupRows(input.rows, "cluster");
    const orderedGroups = shuffled([...groups], random);
    for (const [group, rows] of orderedGroups) {
      const destination =
        primary.length < input.targetSampleSize ? primary : reserve;
      destination.push(...rows);
      allocations.push({
        group,
        frame: rows.length,
        primary: destination === primary ? rows.length : 0,
        reserve: destination === reserve ? rows.length : 0,
      });
      if (
        primary.length >= input.targetSampleSize &&
        primary.length + reserve.length >= totalRequested
      )
        break;
    }
  } else if (input.type === ResearchSamplingDesignType.MULTISTAGE) {
    const groups = shuffled([...groupRows(input.rows, "cluster")], random).map(
      ([group, rows]) => [group, shuffled(rows, random)] as const,
    );
    const ordered: SamplingFrameRow[] = [];
    for (let position = 0; ordered.length < totalRequested; position += 1) {
      let added = false;
      for (const [, rows] of groups)
        if (rows[position]) {
          ordered.push(rows[position]!);
          added = true;
        }
      if (!added) break;
    }
    primary = ordered.slice(0, input.targetSampleSize);
    reserve = ordered.slice(input.targetSampleSize, totalRequested);
    allocations = groups.map(([group, rows]) => ({
      group,
      frame: rows.length,
      primary: primary.filter((row) => row.cluster === group).length,
      reserve: reserve.filter((row) => row.cluster === group).length,
    }));
  } else {
    const ordered =
      input.type === ResearchSamplingDesignType.NON_PROBABILITY
        ? [...input.rows]
        : shuffled(input.rows, random);
    primary = ordered.slice(0, input.targetSampleSize);
    reserve = ordered.slice(input.targetSampleSize, totalRequested);
    allocations = [
      {
        group:
          input.type === ResearchSamplingDesignType.NON_PROBABILITY
            ? "Frame order"
            : "Population",
        frame: input.rows.length,
        primary: primary.length,
        reserve: reserve.length,
      },
    ];
  }

  const selected = [
    ...primary.map((row) => ({ row, isReserve: false })),
    ...reserve.map((row) => ({ row, isReserve: true })),
  ];
  const units = selected.map(({ row, isReserve }, index) => {
    const probability = inclusionProbability(
      input.type,
      row,
      input.rows,
      primary,
      allocations,
    );
    return {
      ...row,
      selectionOrder: index + 1,
      inclusionProbability: probability,
      baseWeight: probability ? 1 / probability : null,
      isReserve,
    };
  });
  return {
    units,
    snapshot: {
      algorithm: input.type,
      frameSize: input.rows.length,
      requestedPrimary: input.targetSampleSize,
      selectedPrimary: primary.length,
      requestedReserve: input.reserveSampleSize,
      selectedReserve: reserve.length,
      seedFingerprint: createHash("sha256").update(input.seed).digest("hex"),
      allocations,
    },
  };
}

function validate(input: {
  type: ResearchSamplingDesignType;
  rows: SamplingFrameRow[];
  targetSampleSize: number;
  reserveSampleSize: number;
  seed: string;
}) {
  if (!input.seed.trim() || input.seed.length > 200)
    throw new Error("A bounded reproducibility seed is required.");
  if (!input.rows.length) throw new Error("The sampling frame is empty.");
  if (!Number.isInteger(input.targetSampleSize) || input.targetSampleSize < 1)
    throw new Error("Target sample size must be a positive whole number.");
  if (!Number.isInteger(input.reserveSampleSize) || input.reserveSampleSize < 0)
    throw new Error("Reserve sample size must be a non-negative whole number.");
  if (
    input.type !== ResearchSamplingDesignType.CENSUS &&
    input.targetSampleSize + input.reserveSampleSize > input.rows.length
  )
    throw new Error(
      "Primary and reserve samples cannot exceed the frame size.",
    );
  if (
    input.type === ResearchSamplingDesignType.CENSUS &&
    input.reserveSampleSize > 0
  )
    throw new Error("A census cannot include a reserve sample.");
  if (
    new Set(input.rows.map((row) => row.unitReference)).size !==
    input.rows.length
  )
    throw new Error("Sampling-frame identifiers must be unique.");
  if (
    input.type === ResearchSamplingDesignType.STRATIFIED &&
    input.rows.some((row) => !row.stratum)
  )
    throw new Error(
      "Every frame row requires a stratum for stratified sampling.",
    );
  if (
    (input.type === ResearchSamplingDesignType.CLUSTER ||
      input.type === ResearchSamplingDesignType.MULTISTAGE) &&
    input.rows.some((row) => !row.cluster)
  )
    throw new Error(
      "Every frame row requires a cluster for cluster or multistage sampling.",
    );
}

function groupRows(rows: SamplingFrameRow[], key: "stratum" | "cluster") {
  const groups = new Map<string, SamplingFrameRow[]>();
  for (const row of rows) {
    const group = row[key] || "Unspecified";
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return groups;
}

function proportionalAllocation(
  groups: Map<string, SamplingFrameRow[]>,
  total: number,
) {
  const allocation = new Map<string, number>();
  if (!total) return allocation;
  const population = [...groups.values()].reduce(
    (sum, rows) => sum + rows.length,
    0,
  );
  const ranked = [...groups]
    .map(([group, rows]) => {
      const exact = population ? (rows.length / population) * total : 0;
      const floor = Math.min(rows.length, Math.floor(exact));
      allocation.set(group, floor);
      return { group, remainder: exact - floor, capacity: rows.length - floor };
    })
    .sort(
      (a, b) => b.remainder - a.remainder || a.group.localeCompare(b.group),
    );
  let unallocated =
    total - [...allocation.values()].reduce((sum, count) => sum + count, 0);
  while (unallocated > 0) {
    const candidate = ranked.find((item) => item.capacity > 0);
    if (!candidate) break;
    allocation.set(candidate.group, (allocation.get(candidate.group) ?? 0) + 1);
    candidate.capacity -= 1;
    candidate.remainder = -1;
    ranked.sort(
      (a, b) =>
        b.remainder - a.remainder ||
        b.capacity - a.capacity ||
        a.group.localeCompare(b.group),
    );
    unallocated -= 1;
  }
  return allocation;
}

function inclusionProbability(
  type: ResearchSamplingDesignType,
  row: SamplingFrameRow,
  frame: SamplingFrameRow[],
  primary: SamplingFrameRow[],
  allocations: SamplingExecutionResult["snapshot"]["allocations"],
) {
  if (type === ResearchSamplingDesignType.NON_PROBABILITY) return null;
  if (type === ResearchSamplingDesignType.CENSUS) return 1;
  if (type === ResearchSamplingDesignType.STRATIFIED) {
    const allocation = allocations.find((item) => item.group === row.stratum);
    return allocation?.frame ? allocation.primary / allocation.frame : null;
  }
  if (type === ResearchSamplingDesignType.CLUSTER) {
    const totalClusters = new Set(frame.map((item) => item.cluster)).size;
    const selectedClusters = new Set(primary.map((item) => item.cluster)).size;
    return totalClusters ? Math.min(1, selectedClusters / totalClusters) : null;
  }
  return Math.min(1, primary.length / frame.length);
}

function shuffled<T>(values: T[], random: () => number) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap]!, output[index]!];
  }
  return output;
}

function seededRandom(seed: string) {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
