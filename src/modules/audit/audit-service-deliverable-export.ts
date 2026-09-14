import type { AuditServiceDeliverable } from "@prisma/client";
import { createResearchDashboardPdf } from "@/modules/research/research-dashboard-export";

const escapeXml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const lines = (value: string, width = 92, maximum = 8) => {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const output: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      output.push(line);
      line = word;
      if (output.length === maximum) break;
    } else line = `${line} ${word}`.trim();
  }
  if (line && output.length < maximum) output.push(line);
  return output;
};

export function auditDeliverableFilename(
  deliverable: Pick<AuditServiceDeliverable, "reference" | "version">,
) {
  const safe =
    deliverable.reference
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "audit-deliverable";
  return `${safe}-v${deliverable.version}.pdf`;
}

export async function createAuditDeliverablePdf(input: {
  deliverable: Pick<
    AuditServiceDeliverable,
    | "reference"
    | "title"
    | "version"
    | "type"
    | "summary"
    | "releasedAt"
    | "contentSnapshot"
  >;
  organizationName: string;
  clientName?: string | null;
  engagementReference: string;
  engagementTitle: string;
}) {
  const summary = lines(input.deliverable.summary, 100, 10);
  const snapshot =
    input.deliverable.contentSnapshot &&
    typeof input.deliverable.contentSnapshot === "object" &&
    !Array.isArray(input.deliverable.contentSnapshot)
      ? (input.deliverable.contentSnapshot as Record<string, unknown>)
      : {};
  const audit =
    snapshot.audit &&
    typeof snapshot.audit === "object" &&
    !Array.isArray(snapshot.audit)
      ? (snapshot.audit as Record<string, unknown>)
      : null;
  const metrics = [
    ["Deliverable", input.deliverable.type.replaceAll("_", " ")],
    ["Version", String(input.deliverable.version)],
    ["Engagement", input.engagementReference],
    [
      "Audit score",
      audit?.scorePercentage == null
        ? "Not recorded"
        : `${audit.scorePercentage}%`,
    ],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
    <rect width="1600" height="1000" fill="#07111F"/><circle cx="1440" cy="80" r="320" fill="#22D3EE" opacity=".08"/><circle cx="80" cy="940" r="260" fill="#8B5CF6" opacity=".08"/>
    <text x="110" y="100" fill="#67E8F9" font-family="Arial" font-size="24" font-weight="700">SENZILYTICS · CONTROLLED AUDIT DELIVERABLE</text>
    <text x="110" y="180" fill="#FFFFFF" font-family="Arial" font-size="48" font-weight="700">${escapeXml(input.deliverable.title)}</text>
    <text x="110" y="225" fill="#94A3B8" font-family="Arial" font-size="22">${escapeXml(input.organizationName)}${input.clientName ? ` · Prepared for ${escapeXml(input.clientName)}` : ""}</text>
    ${metrics.map((metric, index) => `<g transform="translate(${110 + index * 360},285)"><rect width="325" height="105" rx="18" fill="#FFFFFF" opacity=".055" stroke="#FFFFFF" stroke-opacity=".12"/><text x="24" y="38" fill="#94A3B8" font-family="Arial" font-size="17">${escapeXml(metric[0])}</text><text x="24" y="75" fill="#E2E8F0" font-family="Arial" font-size="22" font-weight="700">${escapeXml(metric[1])}</text></g>`).join("")}
    <text x="110" y="470" fill="#FFFFFF" font-family="Arial" font-size="28" font-weight="700">Executive summary</text>
    ${summary.map((line, index) => `<text x="110" y="520" fill="#CBD5E1" font-family="Arial" font-size="22"><tspan x="110" dy="${index === 0 ? 0 : 34}">${escapeXml(line)}</tspan></text>`).join("")}
    <line x1="110" y1="875" x2="1490" y2="875" stroke="#FFFFFF" stroke-opacity=".12"/>
    <text x="110" y="920" fill="#64748B" font-family="Arial" font-size="17">${escapeXml(input.engagementTitle)} · ${escapeXml(input.deliverable.reference)} · Released ${escapeXml(input.deliverable.releasedAt?.toISOString() ?? "Not recorded")}</text>
    <text x="1490" y="920" text-anchor="end" fill="#67E8F9" font-family="Arial" font-size="17">Governed release snapshot</text>
  </svg>`;
  return createResearchDashboardPdf(svg);
}
