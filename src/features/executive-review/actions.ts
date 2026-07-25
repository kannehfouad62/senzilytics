"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addExecutiveAgendaItemService,
  approveExecutiveReviewService,
  archiveExecutiveReviewService,
  cancelExecutiveReviewService,
  captureExecutiveReviewSnapshotService,
  closeExecutiveDecisionService,
  completeExecutiveReviewService,
  createCapaFromExecutiveDecisionService,
  createExecutiveDecisionService,
  createExecutiveReviewService,
  publishExecutiveReviewService,
  recordExecutiveAgendaOutcomeService,
  recordExecutiveAttendanceService,
  scheduleExecutiveReviewService,
  startExecutiveReviewService,
  upsertExecutiveAttendeeService,
} from "@/modules/executive-review/executive-review.service";
import {
  ExecutiveReviewAgendaStatus,
  ExecutiveReviewAttendanceRole,
  ExecutiveReviewConclusion,
  ExecutiveReviewDecisionType,
  ExecutiveReviewFrequency,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = text(data, key);
  if (!result) throw new Error(`${label(key)} is required.`);
  return result;
};
const date = (data: FormData, key: string, optional = false) => {
  const raw = text(data, key);
  if (!raw && optional) return null;
  const result = new Date(raw);
  if (!raw || Number.isNaN(result.getTime())) {
    throw new Error(`Enter a valid ${label(key)}.`);
  }
  return result;
};
const enumValue = <T extends string>(
  data: FormData,
  key: string,
  values: Record<string, T>,
) => {
  const raw = required(data, key);
  if (!Object.values(values).includes(raw as T)) {
    throw new Error(`Select a valid ${label(key)}.`);
  }
  return raw as T;
};
const success = (message: string): FormActionState => ({
  status: "SUCCESS",
  message,
});
const failure = (cause: unknown, fallback: string): FormActionState => ({
  status: "ERROR",
  message: cause instanceof Error ? cause.message : fallback,
});

function refresh(reviewId?: string) {
  revalidatePath("/management-reviews");
  revalidatePath("/management-reviews/new");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/compliance/calendar");
  revalidatePath("/notifications");
  revalidatePath("/search");
  if (reviewId) {
    revalidatePath(`/management-reviews/${reviewId}`);
    revalidatePath(`/management-reviews/${reviewId}/board-pack`);
  }
}

async function managementContext() {
  await requirePermission(PermissionKey.MANAGE_EXECUTIVE_REVIEWS);
  return getCurrentUserTenant();
}

export async function createExecutiveReview(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  let reviewId = "";
  try {
    const review = await createExecutiveReviewService(
      {
        organizationId,
        siteId: text(data, "siteId") || null,
        chairId: required(data, "chairId"),
        title: required(data, "title"),
        frequency: enumValue(
          data,
          "frequency",
          ExecutiveReviewFrequency,
        ),
        periodStart: date(data, "periodStart")!,
        periodEnd: date(data, "periodEnd")!,
        scheduledAt: date(data, "scheduledAt")!,
        scope: required(data, "scope"),
        objectives: required(data, "objectives"),
      },
      { id: user.id },
    );
    reviewId = review.id;
    refresh(review.id);
  } catch (cause) {
    return failure(cause, "Executive management review could not be created.");
  }
  redirect(`/management-reviews/${reviewId}`);
}

export async function addExecutiveAgendaItem(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await addExecutiveAgendaItemService(
      {
        organizationId,
        reviewId,
        topic: required(data, "topic"),
        sourceModule: required(data, "sourceModule"),
        sourceHref: text(data, "sourceHref") || null,
        reviewPrompt: required(data, "reviewPrompt"),
        ownerId: text(data, "ownerId") || null,
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Agenda item added.");
  } catch (cause) {
    return failure(cause, "Agenda item could not be added.");
  }
}

export async function assignExecutiveAttendee(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await upsertExecutiveAttendeeService(
      {
        organizationId,
        reviewId,
        userId: required(data, "userId"),
        role: enumValue(data, "role", ExecutiveReviewAttendanceRole),
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Review participant assigned.");
  } catch (cause) {
    return failure(cause, "Review participant could not be assigned.");
  }
}

export async function scheduleExecutiveReview(
  _state: FormActionState,
  data: FormData,
) {
  return transition(
    _state,
    data,
    scheduleExecutiveReviewService,
    "Executive review scheduled.",
  );
}

export async function startExecutiveReview(
  _state: FormActionState,
  data: FormData,
) {
  return transition(
    _state,
    data,
    startExecutiveReviewService,
    "Executive review started and its evidence snapshot was frozen.",
  );
}

export async function refreshExecutiveReviewSnapshot(
  _state: FormActionState,
  data: FormData,
) {
  return transition(
    _state,
    data,
    captureExecutiveReviewSnapshotService,
    "Cross-module evidence snapshot refreshed.",
  );
}

export async function recordExecutiveAttendance(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await recordExecutiveAttendanceService(
      {
        organizationId,
        reviewId,
        attendeeId: required(data, "attendeeId"),
        attended: data.get("attended") === "on",
        attendanceNote: text(data, "attendanceNote") || null,
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Attendance updated.");
  } catch (cause) {
    return failure(cause, "Attendance could not be updated.");
  }
}

export async function recordExecutiveAgendaOutcome(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await recordExecutiveAgendaOutcomeService(
      {
        organizationId,
        reviewId,
        agendaItemId: required(data, "agendaItemId"),
        status: enumValue(data, "status", ExecutiveReviewAgendaStatus),
        discussion: required(data, "discussion"),
        conclusion: required(data, "conclusion"),
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Agenda outcome recorded.");
  } catch (cause) {
    return failure(cause, "Agenda outcome could not be recorded.");
  }
}

export async function createExecutiveDecision(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await createExecutiveDecisionService(
      {
        organizationId,
        reviewId,
        agendaItemId: text(data, "agendaItemId") || null,
        ownerId: text(data, "ownerId") || null,
        type: enumValue(data, "type", ExecutiveReviewDecisionType),
        title: required(data, "title"),
        rationale: required(data, "rationale"),
        expectedOutcome: text(data, "expectedOutcome") || null,
        priority: enumValue(data, "priority", RiskLevel),
        dueAt: date(data, "dueAt", true),
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Executive decision recorded.");
  } catch (cause) {
    return failure(cause, "Executive decision could not be recorded.");
  }
}

export async function createCapaFromExecutiveDecision(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.CREATE_CAPA);
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await createCapaFromExecutiveDecisionService(
      {
        organizationId,
        reviewId,
        decisionId: required(data, "decisionId"),
        assignedToId: required(data, "assignedToId"),
        dueDate: date(data, "dueDate")!,
        title: required(data, "title"),
        description: text(data, "description") || null,
      },
      { id: user.id },
    );
    refresh(reviewId);
    revalidatePath("/actions");
    return success("Corrective action created and linked.");
  } catch (cause) {
    return failure(cause, "Corrective action could not be created.");
  }
}

export async function closeExecutiveDecision(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await closeExecutiveDecisionService(
      {
        organizationId,
        reviewId,
        decisionId: required(data, "decisionId"),
        closureEvidence: required(data, "closureEvidence"),
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Executive decision closed.");
  } catch (cause) {
    return failure(cause, "Executive decision could not be closed.");
  }
}

export async function completeExecutiveReview(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await completeExecutiveReviewService(
      {
        organizationId,
        reviewId,
        executiveSummary: required(data, "executiveSummary"),
        performanceConclusion: required(data, "performanceConclusion"),
        riskControlConclusion: required(data, "riskControlConclusion"),
        complianceConclusion: required(data, "complianceConclusion"),
        resourceAdequacy: required(data, "resourceAdequacy"),
        significantChanges: text(data, "significantChanges") || null,
        decisionsSummary: required(data, "decisionsSummary"),
        overallConclusion: enumValue(
          data,
          "overallConclusion",
          ExecutiveReviewConclusion,
        ),
        nextReviewAt: date(data, "nextReviewAt", true),
      },
      { id: user.id },
    );
    refresh(reviewId);
    return success("Executive management review completed.");
  } catch (cause) {
    return failure(cause, "Executive management review could not be completed.");
  }
}

export async function approveExecutiveReview(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.APPROVE_EXECUTIVE_REVIEWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const reviewId = required(data, "reviewId");
  try {
    await approveExecutiveReviewService(organizationId, reviewId, {
      id: user.id,
    });
    refresh(reviewId);
    return success("Executive management review approved.");
  } catch (cause) {
    return failure(cause, "Executive management review could not be approved.");
  }
}

export async function publishExecutiveReview(
  _state: FormActionState,
  data: FormData,
) {
  return transition(
    _state,
    data,
    publishExecutiveReviewService,
    "Controlled board pack published.",
  );
}

export async function archiveExecutiveReview(
  _state: FormActionState,
  data: FormData,
) {
  return transition(
    _state,
    data,
    archiveExecutiveReviewService,
    "Executive management review archived.",
  );
}

export async function cancelExecutiveReview(
  _state: FormActionState,
  data: FormData,
) {
  return transition(
    _state,
    data,
    cancelExecutiveReviewService,
    "Executive management review cancelled.",
  );
}

async function transition(
  _state: FormActionState,
  data: FormData,
  service: (
    organizationId: string,
    reviewId: string,
    actor: { id: string },
  ) => Promise<unknown>,
  message: string,
): Promise<FormActionState> {
  void _state;
  const { organizationId, user } = await managementContext();
  const reviewId = required(data, "reviewId");
  try {
    await service(organizationId, reviewId, { id: user.id });
    refresh(reviewId);
    return success(message);
  } catch (cause) {
    return failure(cause, "Executive-review action could not be completed.");
  }
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
