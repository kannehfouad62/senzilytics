"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import {
  assignPlatformReleasePilot,
  createPlatformReleaseCandidate,
  decidePlatformReleaseCandidate,
  recordPlatformReleasePilotOutcome,
  removePlatformReleasePilot,
  startPlatformReleasePilot,
  submitPlatformReleaseCandidate,
  updatePlatformReleaseCheck,
  updatePlatformReleaseMetadata,
} from "@/modules/platform/release-candidate.service";
import {
  PlatformReleaseCheckStatus,
  PlatformReleasePilotStatus,
  PlatformReleaseStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => value(data, key) || null;

function dateValue(data: FormData, key: string) {
  const raw = value(data, key);
  if (!raw) return null;
  const result = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime())) {
    throw new Error(`${key} is not a valid date.`);
  }
  return result;
}

function failure(cause: unknown, fallback: string): FormActionState {
  return {
    status: "ERROR",
    message: cause instanceof Error ? cause.message : fallback,
  };
}

function refreshReleaseWorkspace() {
  revalidatePath("/platform/releases");
  revalidatePath("/platform/operations");
}

export async function createPlatformReleaseAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  let releaseId: string;
  try {
    const release = await createPlatformReleaseCandidate(
      {
        version: value(data, "version"),
        commitSha: value(data, "commitSha"),
        deploymentUrl: value(data, "deploymentUrl"),
        targetCertificationAt: dateValue(data, "targetCertificationAt"),
      },
      actor,
    );
    releaseId = release.id;
    refreshReleaseWorkspace();
  } catch (cause) {
    return failure(cause, "The release candidate could not be created.");
  }
  redirect(`/platform/releases?release=${releaseId}`);
}

export async function updatePlatformReleaseMetadataAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    await updatePlatformReleaseMetadata(
      {
        releaseId: value(data, "releaseId"),
        deploymentUrl: value(data, "deploymentUrl"),
        targetCertificationAt: dateValue(data, "targetCertificationAt"),
        releaseNotes: optional(data, "releaseNotes"),
        riskSummary: optional(data, "riskSummary"),
        rollbackPlan: optional(data, "rollbackPlan"),
      },
      actor,
    );
    refreshReleaseWorkspace();
    return { status: "SUCCESS", message: "Release scope and controls updated." };
  } catch (cause) {
    return failure(cause, "The release candidate could not be updated.");
  }
}

export async function updatePlatformReleaseCheckAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    const status = value(data, "status") as PlatformReleaseCheckStatus;
    if (!Object.values(PlatformReleaseCheckStatus).includes(status)) {
      throw new Error("Select a valid release-check result.");
    }
    await updatePlatformReleaseCheck(
      {
        releaseId: value(data, "releaseId"),
        checkId: value(data, "checkId"),
        status,
        testMethod: optional(data, "testMethod"),
        evidenceSummary: optional(data, "evidenceSummary"),
        resultNotes: optional(data, "resultNotes"),
        evidenceUrl: optional(data, "evidenceUrl"),
        testedAt: dateValue(data, "testedAt"),
      },
      actor,
    );
    refreshReleaseWorkspace();
    return { status: "SUCCESS", message: "Certification evidence recorded." };
  } catch (cause) {
    return failure(cause, "The release check could not be updated.");
  }
}

export async function assignPlatformReleasePilotAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    await assignPlatformReleasePilot(
      {
        releaseId: value(data, "releaseId"),
        organizationId: value(data, "organizationId"),
        plannedStartAt: dateValue(data, "plannedStartAt"),
        exitCriteria: value(data, "exitCriteria"),
      },
      actor,
    );
    refreshReleaseWorkspace();
    return { status: "SUCCESS", message: "Pilot tenant assigned." };
  } catch (cause) {
    return failure(cause, "The pilot tenant could not be assigned.");
  }
}

export async function removePlatformReleasePilotAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    await removePlatformReleasePilot(
      value(data, "releaseId"),
      value(data, "pilotId"),
      actor,
    );
    refreshReleaseWorkspace();
    return { status: "SUCCESS", message: "Pilot tenant unassigned." };
  } catch (cause) {
    return failure(cause, "The pilot assignment could not be removed.");
  }
}

export async function submitPlatformReleaseAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    await submitPlatformReleaseCandidate(
      {
        releaseId: value(data, "releaseId"),
        submissionNotes: optional(data, "submissionNotes"),
      },
      actor,
    );
    refreshReleaseWorkspace();
    return {
      status: "SUCCESS",
      message: "Release candidate submitted for certification.",
    };
  } catch (cause) {
    return failure(cause, "The release candidate could not be submitted.");
  }
}

export async function decidePlatformReleaseAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    const decision = value(data, "decision") as PlatformReleaseStatus;
    if (
      decision !== PlatformReleaseStatus.APPROVED &&
      decision !== PlatformReleaseStatus.REJECTED
    ) {
      throw new Error("Select approve or reject.");
    }
    await decidePlatformReleaseCandidate(
      {
        releaseId: value(data, "releaseId"),
        decision,
        reviewNotes: optional(data, "reviewNotes"),
      },
      actor,
    );
    refreshReleaseWorkspace();
    return {
      status: "SUCCESS",
      message: `Release candidate ${decision.toLowerCase()}.`,
    };
  } catch (cause) {
    return failure(cause, "The release decision could not be recorded.");
  }
}

export async function startPlatformReleasePilotAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    await startPlatformReleasePilot(value(data, "releaseId"), actor);
    refreshReleaseWorkspace();
    return { status: "SUCCESS", message: "Controlled pilot rollout started." };
  } catch (cause) {
    return failure(cause, "The pilot rollout could not be started.");
  }
}

export async function recordPlatformReleasePilotOutcomeAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const actor = await requirePlatformAdministrator();
  try {
    const outcome = value(data, "outcome") as PlatformReleasePilotStatus;
    const finalOutcomes = new Set<PlatformReleasePilotStatus>([
        PlatformReleasePilotStatus.PASSED,
        PlatformReleasePilotStatus.FAILED,
        PlatformReleasePilotStatus.ROLLED_BACK,
    ]);
    if (!finalOutcomes.has(outcome)) {
      throw new Error("Select a final pilot outcome.");
    }
    await recordPlatformReleasePilotOutcome(
      {
        releaseId: value(data, "releaseId"),
        pilotId: value(data, "pilotId"),
        outcome,
        resultSummary: value(data, "resultSummary"),
      },
      actor,
    );
    refreshReleaseWorkspace();
    return { status: "SUCCESS", message: "Pilot outcome recorded." };
  } catch (cause) {
    return failure(cause, "The pilot outcome could not be recorded.");
  }
}
