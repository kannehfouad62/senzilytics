import type {
    RiskHeatMapCell,
  } from "@/core/analytics/risk-analytics.service";
  import {
    RiskImpact,
    RiskLevel,
    RiskLikelihood,
  } from "@prisma/client";
  
  type RiskHeatMapProps = {
    title: string;
    description: string;
    cells: RiskHeatMapCell[];
  };
  
  const likelihoodRows = [
    RiskLikelihood.ALMOST_CERTAIN,
    RiskLikelihood.LIKELY,
    RiskLikelihood.POSSIBLE,
    RiskLikelihood.UNLIKELY,
    RiskLikelihood.RARE,
  ];
  
  const impactColumns = [
    RiskImpact.INSIGNIFICANT,
    RiskImpact.MINOR,
    RiskImpact.MODERATE,
    RiskImpact.MAJOR,
    RiskImpact.CATASTROPHIC,
  ];
  
  export function RiskHeatMap({
    title,
    description,
    cells,
  }: RiskHeatMapProps) {
    function findCell(
      likelihood: RiskLikelihood,
      impact: RiskImpact
    ) {
      return cells.find(
        (cell) =>
          cell.likelihood === likelihood &&
          cell.impact === impact
      );
    }
  
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <h2 className="text-xl font-semibold text-white">
          {title}
        </h2>
  
        <p className="mt-1 text-sm text-slate-400">
          {description}
        </p>
  
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[150px_repeat(5,minmax(100px,1fr))] gap-2">
              <div className="flex items-end justify-end px-3 pb-2 text-xs text-slate-500">
                Likelihood ↓ / Impact →
              </div>
  
              {impactColumns.map(
                (impact) => (
                  <div
                    key={impact}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-center"
                  >
                    <p className="text-xs font-semibold text-white">
                      {formatEnum(impact)}
                    </p>
  
                    <p className="mt-1 text-[11px] text-slate-500">
                      Impact
                    </p>
                  </div>
                )
              )}
  
              {likelihoodRows.map(
                (likelihood) => (
                  <HeatMapRow
                    key={likelihood}
                    likelihood={likelihood}
                    findCell={findCell}
                  />
                )
              )}
            </div>
          </div>
        </div>
  
        <div className="mt-5 flex flex-wrap gap-3">
          <LegendItem
            label="Low"
            className="border-green-400/30 bg-green-500/20 text-green-200"
          />
  
          <LegendItem
            label="Medium"
            className="border-orange-400/30 bg-orange-500/20 text-orange-200"
          />
  
          <LegendItem
            label="High"
            className="border-red-400/30 bg-red-500/20 text-red-200"
          />
  
          <LegendItem
            label="Critical"
            className="border-purple-400/30 bg-purple-500/20 text-purple-200"
          />
        </div>
      </section>
    );
  }
  
  function HeatMapRow({
    likelihood,
    findCell,
  }: {
    likelihood: RiskLikelihood;
    findCell: (
      likelihood: RiskLikelihood,
      impact: RiskImpact
    ) => RiskHeatMapCell | undefined;
  }) {
    return (
      <>
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-right">
          <p className="text-xs font-semibold text-white">
            {formatEnum(likelihood)}
          </p>
  
          <p className="mt-1 text-[11px] text-slate-500">
            Likelihood
          </p>
        </div>
  
        {impactColumns.map((impact) => {
          const cell =
            findCell(
              likelihood,
              impact
            );
  
          if (!cell) {
            return (
              <div
                key={`${likelihood}-${impact}`}
                className="min-h-24 rounded-xl border border-white/10 bg-white/5"
              />
            );
          }
  
          return (
            <div
              key={`${likelihood}-${impact}`}
              className={`flex min-h-24 items-center justify-center rounded-xl border text-center ${getRiskLevelClassName(
                cell.riskLevel
              )}`}
            >
              <div>
                <p className="text-2xl font-bold">
                  {cell.count}
                </p>
  
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  Risk records
                </p>
  
                <p className="mt-2 text-xs opacity-75">
                  Score {cell.score}
                </p>
              </div>
            </div>
          );
        })}
      </>
    );
  }
  
  function LegendItem({
    label,
    className,
  }: {
    label: string;
    className: string;
  }) {
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${className}`}
      >
        {label}
      </span>
    );
  }
  
  function getRiskLevelClassName(
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
  
  function formatEnum(
    value: string
  ) {
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }