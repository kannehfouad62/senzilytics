import { prisma } from "@/lib/prisma";
import {
  RiskControlEffectiveness,
  RiskImpact,
  RiskLevel,
  RiskLikelihood,
  RiskStatus,
  Status,
} from "@prisma/client";

export type RiskAnalyticsDistributionItem = {
  label: string;
  value: number;
};

export type RiskHeatMapCell = {
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  likelihoodScore: number;
  impactScore: number;
  score: number;
  riskLevel: RiskLevel;
  count: number;
};

export type RiskAnalyticsSiteItem = {
  siteId: string | null;
  siteName: string;
  totalRisks: number;
  activeRisks: number;
  criticalRisks: number;
  highResidualRisks: number;
  overdueReviews: number;
  openControls: number;
  overdueControls: number;
  exposureScore: number;
};

export type RiskAnalyticsAttentionItem = {
  id: string;
  reference: string;
  title: string;
  category: string;
  status: RiskStatus;
  currentScore: number;
  currentRiskLevel: RiskLevel;
  residualScore: number;
  residualRiskLevel: RiskLevel;
  siteName: string;
  ownerName: string;
  nextReviewDate: Date | null;
  overdueReview: boolean;
  openControls: number;
  overdueControls: number;
  reason: string;
  link: string;
};

export type RiskAnalyticsData = {
  generatedAt: Date;

  summary: {
    totalRisks: number;
    activeRisks: number;
    criticalCurrentRisks: number;
    criticalResidualRisks: number;
    highResidualRisks: number;
    overdueReviews: number;
    unassignedRisks: number;
    totalControls: number;
    openControls: number;
    overdueControls: number;
    ineffectiveControls: number;
    averageCurrentScore: number;
    averageResidualScore: number;
    riskReductionPercentage: number;
  };

  currentHeatMap: RiskHeatMapCell[];
  residualHeatMap: RiskHeatMapCell[];

  categoryDistribution: RiskAnalyticsDistributionItem[];
  statusDistribution: RiskAnalyticsDistributionItem[];
  currentRiskDistribution: RiskAnalyticsDistributionItem[];
  residualRiskDistribution: RiskAnalyticsDistributionItem[];
  controlEffectivenessDistribution: RiskAnalyticsDistributionItem[];
  controlHierarchyDistribution: RiskAnalyticsDistributionItem[];

  sitePerformance: RiskAnalyticsSiteItem[];
  topResidualRisks: RiskAnalyticsAttentionItem[];
  managementAttention: RiskAnalyticsAttentionItem[];
};

const ACTIVE_RISK_STATUSES: RiskStatus[] = [
  RiskStatus.DRAFT,
  RiskStatus.ACTIVE,
  RiskStatus.UNDER_REVIEW,
  RiskStatus.TREATMENT_REQUIRED,
  RiskStatus.ACCEPTED,
];

const CLOSED_CONTROL_STATUSES: Status[] = [
  Status.COMPLETED,
  Status.CLOSED,
];

const likelihoodScores: Record<
  RiskLikelihood,
  number
> = {
  [RiskLikelihood.RARE]: 1,
  [RiskLikelihood.UNLIKELY]: 2,
  [RiskLikelihood.POSSIBLE]: 3,
  [RiskLikelihood.LIKELY]: 4,
  [RiskLikelihood.ALMOST_CERTAIN]: 5,
};

const impactScores: Record<
  RiskImpact,
  number
> = {
  [RiskImpact.INSIGNIFICANT]: 1,
  [RiskImpact.MINOR]: 2,
  [RiskImpact.MODERATE]: 3,
  [RiskImpact.MAJOR]: 4,
  [RiskImpact.CATASTROPHIC]: 5,
};

function calculateRiskLevel(
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

function isActiveRisk(
  status: RiskStatus
) {
  return ACTIVE_RISK_STATUSES.includes(
    status
  );
}

function isClosedControlStatus(
  status: Status
) {
  return CLOSED_CONTROL_STATUSES.includes(
    status
  );
}

function createDistribution(
  values: string[],
  preferredOrder: string[] = []
): RiskAnalyticsDistributionItem[] {
  const counts =
    new Map<string, number>();

  for (const value of values) {
    counts.set(
      value,
      (counts.get(value) ?? 0) + 1
    );
  }

  const labels = [
    ...preferredOrder.filter(
      (label) => counts.has(label)
    ),

    ...Array.from(
      counts.keys()
    ).filter(
      (label) =>
        !preferredOrder.includes(label)
    ),
  ];

  return labels.map(
    (label) => ({
      label:
        label.replaceAll("_", " "),
      value: counts.get(label) ?? 0,
    })
  );
}

function createHeatMap(
  risks: Array<{
    likelihood: RiskLikelihood;
    impact: RiskImpact;
  }>
): RiskHeatMapCell[] {
  const cells: RiskHeatMapCell[] =
    [];

  for (
    const likelihood
    of Object.values(
      RiskLikelihood
    )
  ) {
    for (
      const impact
      of Object.values(
        RiskImpact
      )
    ) {
      const likelihoodScore =
        likelihoodScores[
          likelihood
        ];

      const impactScore =
        impactScores[impact];

      const score =
        likelihoodScore *
        impactScore;

      cells.push({
        likelihood,
        impact,
        likelihoodScore,
        impactScore,
        score,
        riskLevel:
          calculateRiskLevel(
            score
          ),
        count:
          risks.filter(
            (risk) =>
              risk.likelihood ===
                likelihood &&
              risk.impact ===
                impact
          ).length,
      });
    }
  }

  return cells;
}

function roundNumber(
  value: number
) {
  return Math.round(
    value * 10
  ) / 10;
}

export async function getRiskAnalyticsData(
  organizationId: string
): Promise<RiskAnalyticsData> {
  const now = new Date();

  const risks =
    await prisma.risk.findMany({
      where: {
        organizationId,
      },

      include: {
        site: {
          select: {
            id: true,
            name: true,
          },
        },

        department: {
          select: {
            id: true,
            name: true,
          },
        },

        owner: {
          select: {
            id: true,
            name: true,
          },
        },

        controls: {
          select: {
            id: true,
            status: true,
            controlType: true,
            hierarchy: true,
            effectiveness: true,
            dueDate: true,
          },
        },
      },

      orderBy: [
        {
          residualScore: "desc",
        },
        {
          currentScore: "desc",
        },
        {
          nextReviewDate: "asc",
        },
      ],
    });

  const activeRisks =
    risks.filter((risk) =>
      isActiveRisk(risk.status)
    );

  const controls =
    risks.flatMap(
      (risk) =>
        risk.controls.map(
          (control) => ({
            ...control,
            riskId: risk.id,
          })
        )
    );

  const openControls =
    controls.filter(
      (control) =>
        !isClosedControlStatus(
          control.status
        )
    );

  const overdueControls =
    openControls.filter(
      (control) =>
        Boolean(
          control.dueDate &&
            control.dueDate <
              now
        )
    );

  const overdueReviews =
    activeRisks.filter(
      (risk) =>
        Boolean(
          risk.nextReviewDate &&
            risk.nextReviewDate <
              now
        )
    );

  const totalCurrentScore =
    activeRisks.reduce(
      (total, risk) =>
        total +
        risk.currentScore,
      0
    );

  const totalResidualScore =
    activeRisks.reduce(
      (total, risk) =>
        total +
        risk.residualScore,
      0
    );

  const averageCurrentScore =
    activeRisks.length > 0
      ? roundNumber(
          totalCurrentScore /
            activeRisks.length
        )
      : 0;

  const averageResidualScore =
    activeRisks.length > 0
      ? roundNumber(
          totalResidualScore /
            activeRisks.length
        )
      : 0;

  const riskReductionPercentage =
    totalCurrentScore > 0
      ? Math.round(
          ((totalCurrentScore -
            totalResidualScore) /
            totalCurrentScore) *
            100
        )
      : 0;

  const siteMap =
    new Map<
      string,
      RiskAnalyticsSiteItem
    >();

  siteMap.set(
    "ENTERPRISE",
    {
      siteId: null,
      siteName:
        "Enterprise-wide",
      totalRisks: 0,
      activeRisks: 0,
      criticalRisks: 0,
      highResidualRisks: 0,
      overdueReviews: 0,
      openControls: 0,
      overdueControls: 0,
      exposureScore: 0,
    }
  );

  for (const risk of risks) {
    const key =
      risk.site?.id ??
      "ENTERPRISE";

    const existing =
      siteMap.get(key) ?? {
        siteId:
          risk.site?.id ??
          null,
        siteName:
          risk.site?.name ??
          "Enterprise-wide",
        totalRisks: 0,
        activeRisks: 0,
        criticalRisks: 0,
        highResidualRisks: 0,
        overdueReviews: 0,
        openControls: 0,
        overdueControls: 0,
        exposureScore: 0,
      };

    existing.totalRisks += 1;

    if (
      isActiveRisk(
        risk.status
      )
    ) {
      existing.activeRisks +=
        1;
    }

    if (
      risk.currentRiskLevel ===
        RiskLevel.CRITICAL ||
      risk.residualRiskLevel ===
        RiskLevel.CRITICAL
    ) {
      existing.criticalRisks +=
        1;
    }

    if (
      risk.residualRiskLevel ===
        RiskLevel.HIGH ||
      risk.residualRiskLevel ===
        RiskLevel.CRITICAL
    ) {
      existing.highResidualRisks +=
        1;
    }

    if (
      isActiveRisk(
        risk.status
      ) &&
      risk.nextReviewDate &&
      risk.nextReviewDate <
        now
    ) {
      existing.overdueReviews +=
        1;
    }

    const riskOpenControls =
      risk.controls.filter(
        (control) =>
          !isClosedControlStatus(
            control.status
          )
      );

    const riskOverdueControls =
      riskOpenControls.filter(
        (control) =>
          Boolean(
            control.dueDate &&
              control.dueDate <
                now
          )
      );

    existing.openControls +=
      riskOpenControls.length;

    existing.overdueControls +=
      riskOverdueControls.length;

    existing.exposureScore +=
      risk.residualScore +
      risk.currentScore +
      riskOverdueControls.length *
        4 +
      (risk.nextReviewDate &&
      risk.nextReviewDate <
        now
        ? 3
        : 0);

    siteMap.set(
      key,
      existing
    );
  }

  const createAttentionItem = (
    risk: (typeof risks)[number]
  ): RiskAnalyticsAttentionItem => {
    const riskOpenControls =
      risk.controls.filter(
        (control) =>
          !isClosedControlStatus(
            control.status
          )
      );

    const riskOverdueControls =
      riskOpenControls.filter(
        (control) =>
          Boolean(
            control.dueDate &&
              control.dueDate <
                now
          )
      );

    const overdueReview =
      Boolean(
        risk.nextReviewDate &&
          risk.nextReviewDate <
            now &&
          isActiveRisk(
            risk.status
          )
      );

    const reasons: string[] =
      [];

    if (
      risk.residualRiskLevel ===
        RiskLevel.CRITICAL
    ) {
      reasons.push(
        "Critical residual risk"
      );
    } else if (
      risk.residualRiskLevel ===
        RiskLevel.HIGH
    ) {
      reasons.push(
        "High residual risk"
      );
    }

    if (overdueReview) {
      reasons.push(
        "Risk review overdue"
      );
    }

    if (
      riskOverdueControls.length >
      0
    ) {
      reasons.push(
        `${riskOverdueControls.length} overdue control(s)`
      );
    }

    if (!risk.ownerId) {
      reasons.push(
        "No risk owner assigned"
      );
    }

    return {
      id: risk.id,
      reference:
        risk.reference,
      title: risk.title,
      category:
        risk.category,
      status: risk.status,
      currentScore:
        risk.currentScore,
      currentRiskLevel:
        risk.currentRiskLevel,
      residualScore:
        risk.residualScore,
      residualRiskLevel:
        risk.residualRiskLevel,
      siteName:
        risk.site?.name ??
        "Enterprise-wide",
      ownerName:
        risk.owner?.name ??
        "Not assigned",
      nextReviewDate:
        risk.nextReviewDate,
      overdueReview,
      openControls:
        riskOpenControls.length,
      overdueControls:
        riskOverdueControls.length,
      reason:
        reasons.join(" · ") ||
        "Elevated risk exposure",
      link:
        `/risks/${risk.id}`,
    };
  };

  const managementAttention =
    activeRisks
      .filter((risk) => {
        const hasOverdueControl =
          risk.controls.some(
            (control) =>
              !isClosedControlStatus(
                control.status
              ) &&
              Boolean(
                control.dueDate &&
                  control.dueDate <
                    now
              )
          );

        const hasOverdueReview =
          Boolean(
            risk.nextReviewDate &&
              risk.nextReviewDate <
                now
          );

        return (
          risk.residualRiskLevel ===
            RiskLevel.CRITICAL ||
          risk.residualRiskLevel ===
            RiskLevel.HIGH ||
          hasOverdueReview ||
          hasOverdueControl ||
          !risk.ownerId
        );
      })
      .map(
        createAttentionItem
      )
      .sort(
        (
          firstRisk,
          secondRisk
        ) => {
          if (
            firstRisk.residualScore !==
            secondRisk.residualScore
          ) {
            return (
              secondRisk.residualScore -
              firstRisk.residualScore
            );
          }

          if (
            firstRisk.overdueControls !==
            secondRisk.overdueControls
          ) {
            return (
              secondRisk.overdueControls -
              firstRisk.overdueControls
            );
          }

          return (
            (firstRisk.nextReviewDate
              ?.getTime() ??
              Number.MAX_SAFE_INTEGER) -
            (secondRisk.nextReviewDate
              ?.getTime() ??
              Number.MAX_SAFE_INTEGER)
          );
        }
      );

  const topResidualRisks =
    [...activeRisks]
      .sort(
        (
          firstRisk,
          secondRisk
        ) =>
          secondRisk.residualScore -
          firstRisk.residualScore
      )
      .slice(0, 10)
      .map(
        createAttentionItem
      );

  return {
    generatedAt: now,

    summary: {
      totalRisks:
        risks.length,

      activeRisks:
        activeRisks.length,

      criticalCurrentRisks:
        activeRisks.filter(
          (risk) =>
            risk.currentRiskLevel ===
            RiskLevel.CRITICAL
        ).length,

      criticalResidualRisks:
        activeRisks.filter(
          (risk) =>
            risk.residualRiskLevel ===
            RiskLevel.CRITICAL
        ).length,

      highResidualRisks:
        activeRisks.filter(
          (risk) =>
            risk.residualRiskLevel ===
              RiskLevel.HIGH ||
            risk.residualRiskLevel ===
              RiskLevel.CRITICAL
        ).length,

      overdueReviews:
        overdueReviews.length,

      unassignedRisks:
        activeRisks.filter(
          (risk) =>
            !risk.ownerId
        ).length,

      totalControls:
        controls.length,

      openControls:
        openControls.length,

      overdueControls:
        overdueControls.length,

      ineffectiveControls:
        controls.filter(
          (control) =>
            control.effectiveness ===
              RiskControlEffectiveness.INEFFECTIVE ||
            control.effectiveness ===
              RiskControlEffectiveness.WEAK
        ).length,

      averageCurrentScore,
      averageResidualScore,
      riskReductionPercentage,
    },

    currentHeatMap:
      createHeatMap(
        activeRisks.map(
          (risk) => ({
            likelihood:
              risk.currentLikelihood,
            impact:
              risk.currentImpact,
          })
        )
      ),

    residualHeatMap:
      createHeatMap(
        activeRisks.map(
          (risk) => ({
            likelihood:
              risk.residualLikelihood,
            impact:
              risk.residualImpact,
          })
        )
      ),

    categoryDistribution:
      createDistribution(
        risks.map(
          (risk) =>
            risk.category
        )
      ),

    statusDistribution:
      createDistribution(
        risks.map(
          (risk) =>
            risk.status
        ),
        Object.values(
          RiskStatus
        )
      ),

    currentRiskDistribution:
      createDistribution(
        activeRisks.map(
          (risk) =>
            risk.currentRiskLevel
        ),
        [
          RiskLevel.CRITICAL,
          RiskLevel.HIGH,
          RiskLevel.MEDIUM,
          RiskLevel.LOW,
        ]
      ),

    residualRiskDistribution:
      createDistribution(
        activeRisks.map(
          (risk) =>
            risk.residualRiskLevel
        ),
        [
          RiskLevel.CRITICAL,
          RiskLevel.HIGH,
          RiskLevel.MEDIUM,
          RiskLevel.LOW,
        ]
      ),

    controlEffectivenessDistribution:
      createDistribution(
        controls.map(
          (control) =>
            control.effectiveness
        ),
        Object.values(
          RiskControlEffectiveness
        )
      ),

    controlHierarchyDistribution:
      createDistribution(
        controls.map(
          (control) =>
            control.hierarchy
        )
      ),

    sitePerformance:
      Array.from(
        siteMap.values()
      )
        .filter(
          (site) =>
            site.totalRisks > 0
        )
        .sort(
          (
            firstSite,
            secondSite
          ) =>
            secondSite.exposureScore -
            firstSite.exposureScore
        ),

    topResidualRisks,

    managementAttention:
      managementAttention.slice(
        0,
        30
      ),
  };
}