import { ResearchProjectStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const activeProjectStatuses = [
  ResearchProjectStatus.ACTIVE,
  ResearchProjectStatus.DATA_COLLECTION,
  ResearchProjectStatus.ANALYSIS,
  ResearchProjectStatus.CLIENT_REVIEW,
];

export async function getResearchExecutiveSummary(
  organizationId: string,
  days: number,
) {
  const from = new Date(Date.now() - days * 86_400_000);
  const [
    activeProjects,
    activeWaves,
    assignedResponses,
    publicResponses,
    approvedAnalyses,
    publishedReports,
    reviewQueue,
    activePublicLinks,
  ] = await Promise.all([
    prisma.researchProject.count({
      where: { organizationId, status: { in: activeProjectStatuses } },
    }),
    prisma.researchCollectionWave.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        targetResponseCount: true,
        _count: {
          select: {
            assignments: { where: { status: "COMPLETED" } },
            publicResponses: true,
          },
        },
      },
    }),
    prisma.researchQuestionnaireAssignment.count({
      where: {
        organizationId,
        status: "COMPLETED",
        completedAt: { gte: from },
      },
    }),
    prisma.researchPublicResponse.count({
      where: { organizationId, submittedAt: { gte: from } },
    }),
    prisma.researchAnalysis.count({
      where: { organizationId, status: "APPROVED" },
    }),
    prisma.researchReport.count({
      where: { organizationId, status: "PUBLISHED" },
    }),
    prisma.researchAnalysis.count({
      where: { organizationId, status: "UNDER_REVIEW" },
    }),
    prisma.researchPublicSurveyLink.count({
      where: {
        organizationId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
  ]);
  const activeResponses = activeWaves.reduce(
    (sum, wave) => sum + wave._count.assignments + wave._count.publicResponses,
    0,
  );
  const activeTarget = activeWaves.reduce(
    (sum, wave) => sum + (wave.targetResponseCount ?? 0),
    0,
  );
  return {
    activeProjects,
    activeWaves: activeWaves.length,
    recentResponses: assignedResponses + publicResponses,
    activeResponses,
    activeTarget,
    completionRate: activeTarget
      ? Math.min(100, Math.round((activeResponses / activeTarget) * 100))
      : null,
    approvedAnalyses,
    publishedReports,
    reviewQueue,
    activePublicLinks,
  };
}
