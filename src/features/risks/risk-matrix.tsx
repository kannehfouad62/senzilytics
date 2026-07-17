import {
    RiskImpact,
    RiskLevel,
    RiskLikelihood,
  } from "@prisma/client";
  
  type RiskMatrixProps = {
    selectedLikelihood?: RiskLikelihood;
    selectedImpact?: RiskImpact;
    compact?: boolean;
  };
  
  const likelihoodRows = [
    {
      value:
        RiskLikelihood.ALMOST_CERTAIN,
      label: "Almost Certain",
      score: 5,
    },
    {
      value:
        RiskLikelihood.LIKELY,
      label: "Likely",
      score: 4,
    },
    {
      value:
        RiskLikelihood.POSSIBLE,
      label: "Possible",
      score: 3,
    },
    {
      value:
        RiskLikelihood.UNLIKELY,
      label: "Unlikely",
      score: 2,
    },
    {
      value:
        RiskLikelihood.RARE,
      label: "Rare",
      score: 1,
    },
  ] as const;
  
  const impactColumns = [
    {
      value:
        RiskImpact.INSIGNIFICANT,
      label: "Insignificant",
      score: 1,
    },
    {
      value:
        RiskImpact.MINOR,
      label: "Minor",
      score: 2,
    },
    {
      value:
        RiskImpact.MODERATE,
      label: "Moderate",
      score: 3,
    },
    {
      value:
        RiskImpact.MAJOR,
      label: "Major",
      score: 4,
    },
    {
      value:
        RiskImpact.CATASTROPHIC,
      label: "Catastrophic",
      score: 5,
    },
  ] as const;
  
  function getRiskLevel(
    score: number
  ): RiskLevel {
    if (score >= 20) {
      return RiskLevel.CRITICAL;
    }
  
    if (score >= 12) {
      return RiskLevel.HIGH;
    }
  
    if (score >= 5) {
      return RiskLevel.MEDIUM;
    }
  
    return RiskLevel.LOW;
  }
  
  function getCellClassName(
    riskLevel: RiskLevel
  ) {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return "border-purple-400/30 bg-purple-500/25 text-purple-100";
  
      case RiskLevel.HIGH:
        return "border-red-400/30 bg-red-500/25 text-red-100";
  
      case RiskLevel.MEDIUM:
        return "border-orange-400/30 bg-orange-500/25 text-orange-100";
  
      case RiskLevel.LOW:
      default:
        return "border-green-400/30 bg-green-500/25 text-green-100";
    }
  }
  
  export function RiskMatrix({
    selectedLikelihood,
    selectedImpact,
    compact = false,
  }: RiskMatrixProps) {
    return (
      <div className="overflow-x-auto">
        <div
          className={
            compact
              ? "min-w-[650px]"
              : "min-w-[780px]"
          }
        >
          <div className="grid grid-cols-[150px_repeat(5,minmax(90px,1fr))] gap-2">
            <div className="flex items-end justify-end px-3 pb-2 text-xs text-slate-500">
              Likelihood ↓ / Impact →
            </div>
  
            {impactColumns.map(
              (impact) => (
                <div
                  key={
                    impact.value
                  }
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
                >
                  <p className="text-xs font-semibold text-white">
                    {impact.score}
                  </p>
  
                  <p className="mt-1 text-[11px] text-slate-400">
                    {impact.label}
                  </p>
                </div>
              )
            )}
  
            {likelihoodRows.map(
              (likelihood) => (
                <RiskMatrixRow
                  key={
                    likelihood.value
                  }
                  likelihood={
                    likelihood
                  }
                  selectedLikelihood={
                    selectedLikelihood
                  }
                  selectedImpact={
                    selectedImpact
                  }
                  compact={
                    compact
                  }
                />
              )
            )}
          </div>
        </div>
      </div>
    );
  }
  
  function RiskMatrixRow({
    likelihood,
    selectedLikelihood,
    selectedImpact,
    compact,
  }: {
    likelihood:
      (typeof likelihoodRows)[number];
    selectedLikelihood?:
      RiskLikelihood;
    selectedImpact?: RiskImpact;
    compact: boolean;
  }) {
    return (
      <>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-right">
          <p className="text-xs font-semibold text-white">
            {likelihood.score}
          </p>
  
          <p className="mt-1 text-[11px] text-slate-400">
            {likelihood.label}
          </p>
        </div>
  
        {impactColumns.map(
          (impact) => {
            const score =
              likelihood.score *
              impact.score;
  
            const riskLevel =
              getRiskLevel(score);
  
            const selected =
              selectedLikelihood ===
                likelihood.value &&
              selectedImpact ===
                impact.value;
  
            return (
              <div
                key={`${likelihood.value}-${impact.value}`}
                className={`flex ${
                  compact
                    ? "min-h-16"
                    : "min-h-20"
                } items-center justify-center rounded-xl border text-center transition ${getCellClassName(
                  riskLevel
                )} ${
                  selected
                    ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-950"
                    : ""
                }`}
              >
                <div>
                  <p className="text-lg font-bold">
                    {score}
                  </p>
  
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {riskLevel}
                  </p>
                </div>
              </div>
            );
          }
        )}
      </>
    );
  }