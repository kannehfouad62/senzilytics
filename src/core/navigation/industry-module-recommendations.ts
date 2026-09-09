import { IndustryCategory } from "@prisma/client";

const common = new Set([
  "/dashboard", "/modules", "/tasks", "/notifications", "/documents", "/users",
  "/organizations", "/implementation", "/form-studio", "/workflows",
  "/performance", "/management-reviews", "/reports", "/activity", "/integrations",
]);

const profiles: Partial<Record<IndustryCategory, readonly string[]>> = {
  RESEARCH_AND_ANALYTICS: ["/research", "/intelligence", "/compliance", "/audits"],
  CONSTRUCTION_AND_ENGINEERING: ["/incidents", "/observations", "/risks", "/moc", "/assets", "/contractors", "/permits-to-work", "/inspections", "/audits", "/training", "/compliance", "/emergency"],
  MANUFACTURING: ["/incidents", "/observations", "/risks", "/moc", "/assets", "/chemicals", "/industrial-hygiene", "/occupational-health", "/inspections", "/audits", "/training", "/compliance", "/emergency", "/environmental"],
  ENERGY_AND_MINING: ["/incidents", "/observations", "/risks", "/moc", "/assets", "/contractors", "/permits-to-work", "/industrial-hygiene", "/occupational-health", "/assurance", "/inspections", "/audits", "/training", "/compliance", "/emergency", "/environmental", "/esg"],
  HEALTHCARE: ["/incidents", "/observations", "/risks", "/moc", "/assets", "/chemicals", "/industrial-hygiene", "/occupational-health", "/inspections", "/audits", "/training", "/compliance", "/emergency", "/research"],
  TRANSPORT_AND_LOGISTICS: ["/incidents", "/observations", "/risks", "/moc", "/assets", "/contractors", "/permits-to-work", "/inspections", "/audits", "/training", "/compliance", "/emergency", "/business-continuity"],
  PUBLIC_SECTOR_AND_EDUCATION: ["/incidents", "/observations", "/risks", "/assets", "/inspections", "/audits", "/training", "/compliance", "/emergency", "/business-continuity", "/research", "/esg"],
  PROFESSIONAL_SERVICES: ["/risks", "/audits", "/training", "/compliance", "/business-continuity", "/research", "/intelligence"],
  OTHER: ["/incidents", "/risks", "/audits", "/training", "/compliance"],
};

export function isIndustryRecommendedModule(category: IndustryCategory, href: string) {
  if (category === IndustryCategory.GENERAL) return true;
  if (common.has(href)) return true;
  return (profiles[category] ?? []).some(root => href === root || href.startsWith(`${root}/`));
}

export function filterIndustryRecommendedModules<T extends { href: string }>(category: IndustryCategory, items: readonly T[]) {
  return items.filter(item => isIndustryRecommendedModule(category, item.href));
}

export const industryCategoryLabels: Record<IndustryCategory, string> = {
  GENERAL: "General / Show all modules",
  RESEARCH_AND_ANALYTICS: "Research, Statistics & Analytics",
  CONSTRUCTION_AND_ENGINEERING: "Construction & Engineering",
  MANUFACTURING: "Manufacturing",
  ENERGY_AND_MINING: "Energy, Utilities & Mining",
  HEALTHCARE: "Healthcare & Life Sciences",
  TRANSPORT_AND_LOGISTICS: "Transport & Logistics",
  PUBLIC_SECTOR_AND_EDUCATION: "Public Sector & Education",
  PROFESSIONAL_SERVICES: "Professional Services",
  OTHER: "Other",
};
