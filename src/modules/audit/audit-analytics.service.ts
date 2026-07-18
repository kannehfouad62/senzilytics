import { prisma } from "@/lib/prisma";
import { EnterpriseAuditFindingStatus, EnterpriseAuditStatus } from "@prisma/client";

export type AuditDistribution = { label: string; value: number };
export type AuditTrend = { month: string; scheduled: number; completed: number; overdue: number };

const terminal = new Set<EnterpriseAuditStatus>([
  EnterpriseAuditStatus.COMPLETED, EnterpriseAuditStatus.CLOSED, EnterpriseAuditStatus.CANCELLED,
]);
const closedFindings = new Set<EnterpriseAuditFindingStatus>([
  EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.CANCELLED, EnterpriseAuditFindingStatus.REJECTED,
]);

function distribution(values: string[]): AuditDistribution[] {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].map(([label, value]) => ({ label: label.replaceAll("_", " "), value }));
}

export async function getAuditAnalytics(organizationId: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [audits, findings] = await Promise.all([
    prisma.enterpriseAudit.findMany({
      where: { organizationId },
      select: { id: true, reference: true, title: true, status: true, auditType: true, scheduledAt: true, dueDate: true, completedAt: true, scorePercentage: true, overallRiskLevel: true, openFindingCount: true, site: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enterpriseAuditFinding.findMany({
      where: { organizationId },
      select: { status: true, severity: true, category: true, isRepeatFinding: true, dueDate: true },
    }),
  ]);
  const completed = audits.filter((audit) => audit.status === EnterpriseAuditStatus.COMPLETED || audit.status === EnterpriseAuditStatus.CLOSED);
  const overdue = audits.filter((audit) => audit.dueDate && audit.dueDate < now && !terminal.has(audit.status));
  const openFindings = findings.filter((finding) => !closedFindings.has(finding.status));
  const scored = completed.flatMap((audit) => audit.scorePercentage == null ? [] : [Number(audit.scorePercentage)]);
  const months = Array.from({ length: 12 }, (_, index) => new Date(start.getFullYear(), start.getMonth() + index, 1));
  const trend: AuditTrend[] = months.map((month) => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const inMonth = (value: Date | null) => Boolean(value && value >= month && value < next);
    return { month: month.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), scheduled: audits.filter((a) => inMonth(a.scheduledAt)).length, completed: audits.filter((a) => inMonth(a.completedAt)).length, overdue: audits.filter((a) => a.dueDate && inMonth(a.dueDate) && !terminal.has(a.status)).length };
  });
  const siteMap = new Map<string, { siteName: string; total: number; completed: number; overdue: number; findings: number }>();
  audits.forEach((audit) => { const row = siteMap.get(audit.site.id) ?? { siteName: audit.site.name, total: 0, completed: 0, overdue: 0, findings: 0 }; row.total++; row.findings += audit.openFindingCount; if (completed.includes(audit)) row.completed++; if (overdue.includes(audit)) row.overdue++; siteMap.set(audit.site.id, row); });
  return {
    generatedAt: now,
    summary: { total: audits.length, active: audits.filter((a) => !terminal.has(a.status)).length, completed: completed.length, overdue: overdue.length, completionRate: audits.length ? Math.round((completed.length / audits.length) * 100) : 0, averageScore: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0, openFindings: openFindings.length, highRiskFindings: openFindings.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL").length, repeatFindings: findings.filter((f) => f.isRepeatFinding).length },
    statusDistribution: distribution(audits.map((a) => a.status)), typeDistribution: distribution(audits.map((a) => a.auditType)), riskDistribution: distribution(audits.map((a) => a.overallRiskLevel ?? "NOT RATED")), findingStatusDistribution: distribution(findings.map((f) => f.status)), findingSeverityDistribution: distribution(findings.map((f) => f.severity)), findingCategoryDistribution: distribution(findings.map((f) => f.category)), trend,
    sitePerformance: [...siteMap.values()].sort((a, b) => b.overdue - a.overdue || b.findings - a.findings),
    attention: overdue.slice(0, 8).map((a) => ({ id: a.id, reference: a.reference, title: a.title, siteName: a.site.name, dueDate: a.dueDate! })),
  };
}
