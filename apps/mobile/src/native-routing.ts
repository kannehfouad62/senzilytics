export type NativeRecordTarget =
  | { tab: "capture"; view: "incident" | "observation"; recordId?: string }
  | { tab: "actions"; view: "tasks" | "capa" | "alerts"; recordId?: string }
  | { tab: "audits"; recordId?: string }
  | { tab: "inspections"; recordId?: string }
  | { tab: "research"; recordId?: string }
  | { tab: "risks"; view: "risks" | "jsa"; recordId?: string }
  | { tab: "governance"; view: "calendar" | "training"; recordId?: string }
  | {
      tab: "complianceDocuments";
      view: "compliance" | "documents";
      recordId?: string;
    }
  | { tab: "controlledWork"; view: "moc" | "permits"; recordId?: string }
  | {
      tab: "assetContractors";
      view: "assets" | "contractors";
      recordId?: string;
    }
  | {
      tab: "chemicalEnvironmental";
      view: "chemicals" | "environmental";
      recordId?: string;
    }
  | {
      tab: "behaviorAssurance";
      view: "behavior" | "sif" | "certification";
      recordId?: string;
    };

function recordId(parts: string[], index: number) {
  const value = parts[index];
  return value && value !== "new" ? decodeURIComponent(value) : undefined;
}

export function resolveNativeRecordTarget(
  link: string | null | undefined
): NativeRecordTarget | null {
  if (!link) return null;
  let pathname = link.trim();
  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
  } catch {
    return null;
  }
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  if (!parts.length) return null;

  switch (parts[0]) {
    case "incidents": return { tab: "capture", view: "incident", recordId: recordId(parts, 1) };
    case "observations": return { tab: "capture", view: "observation", recordId: recordId(parts, 1) };
    case "actions": return { tab: "actions", view: "capa", recordId: recordId(parts, 1) };
    case "audits": return { tab: "audits", recordId: recordId(parts, 1) };
    case "inspections": return { tab: "inspections", recordId: recordId(parts, 1) };
    case "research": return { tab: "research", recordId: parts.at(-1) };
    case "risks": return { tab: "risks", view: "risks", recordId: recordId(parts, 1) };
    case "jsa":
    case "jha": return { tab: "risks", view: "jsa", recordId: recordId(parts, 1) };
    case "training": return { tab: "governance", view: "training", recordId: recordId(parts, 1) };
    case "compliance":
      if (parts[1] === "permits") {
        return { tab: "controlledWork", view: "permits", recordId: recordId(parts, 2) };
      }
      return { tab: "complianceDocuments", view: "compliance", recordId: recordId(parts, 1) };
    case "documents": return { tab: "complianceDocuments", view: "documents", recordId: recordId(parts, 1) };
    case "moc": return { tab: "controlledWork", view: "moc", recordId: recordId(parts, 1) };
    case "assets": return { tab: "assetContractors", view: "assets", recordId: recordId(parts, 1) };
    case "contractors": return { tab: "assetContractors", view: "contractors", recordId: recordId(parts, 1) };
    case "chemicals": return { tab: "chemicalEnvironmental", view: "chemicals", recordId: recordId(parts, 1) };
    case "environmental": return { tab: "chemicalEnvironmental", view: "environmental", recordId: recordId(parts, 1) };
    case "assurance":
      if (parts[1] === "sif") {
        return { tab: "behaviorAssurance", view: "sif", recordId: parts.at(-1) };
      }
      if (parts[1] === "certification") {
        return { tab: "behaviorAssurance", view: "certification", recordId: parts.at(-1) };
      }
      return null;
    default:
      return null;
  }
}

export function resolveWorkflowNativeTarget(
  entityType: string,
  entityId: string,
  href?: string | null
) {
  const linked = resolveNativeRecordTarget(href);
  if (linked) return linked;
  const fallback: Record<string, string> = {
    INCIDENT: `/incidents/${entityId}`, CORRECTIVE_ACTION: `/actions/${entityId}`,
    AUDIT: `/audits/${entityId}`, INSPECTION: `/inspections/${entityId}`,
    COMPLIANCE: `/compliance/${entityId}`, DOCUMENT: `/documents/${entityId}`,
    PERMIT: `/compliance/permits/${entityId}`, CHEMICAL: `/chemicals/${entityId}`,
    MOC: `/moc/${entityId}`, OBSERVATION: `/observations/${entityId}`,
    RISK: `/risks/${entityId}`, TRAINING: `/training/${entityId}`,
  };
  return resolveNativeRecordTarget(fallback[entityType]);
}
