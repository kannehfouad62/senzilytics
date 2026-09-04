import {
  ResearchCampaignQuotaStatus,
  ResearchPanelMemberStatus,
} from "@prisma/client";

export function isPanelMemberEligible(
  status: ResearchPanelMemberStatus,
  consentExpiresAt: Date | null,
  now = new Date(),
) {
  return (
    status === ResearchPanelMemberStatus.ACTIVE &&
    (!consentExpiresAt || consentExpiresAt > now)
  );
}

export function calculatePanelQualityScore(input: {
  sent: number;
  opened: number;
  completed: number;
  failed: number;
}) {
  if (input.sent < 1) return 100;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (input.completed / input.sent) * 70 +
          (input.opened / input.sent) * 25 -
          (input.failed / input.sent) * 25 +
          5,
      ),
    ),
  );
}

export function summarizeQuota(target: number, completed: number) {
  const safeTarget = Math.max(1, target);
  const safeCompleted = Math.max(0, completed);
  return {
    completed: safeCompleted,
    remaining: Math.max(0, safeTarget - safeCompleted),
    percentage: Math.min(100, Math.round((safeCompleted / safeTarget) * 100)),
    status:
      safeCompleted >= safeTarget
        ? ResearchCampaignQuotaStatus.FILLED
        : ResearchCampaignQuotaStatus.OPEN,
  };
}
