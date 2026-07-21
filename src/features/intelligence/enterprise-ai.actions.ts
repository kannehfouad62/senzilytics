"use server";

import { getCurrentUserPermissions } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  generateEnterpriseAiAnalysisService,
  recordEnterpriseAiFeedbackService,
  reviewEnterpriseAiAnalysisService,
} from "@/modules/intelligence/enterprise-ai.service";
import type { AiIntelligenceActionState } from "@/modules/intelligence/enterprise-ai.types";
import {
  AiIntelligenceFeedbackRating,
  AiIntelligenceStatus,
  AiIntelligenceUseCase,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

function errorState(error: unknown): AiIntelligenceActionState {
  return {
    status: "ERROR",
    message: error instanceof Error ? error.message : "The intelligence request could not be completed.",
    analysisId: null,
  };
}

async function getAuthorizedContext(review = false) {
  const [tenant, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  const allowed = permissions.includes(PermissionKey.USE_AI)
    && permissions.includes(review ? PermissionKey.VIEW_REPORTS : PermissionKey.VIEW_DASHBOARD);

  if (!allowed) {
    return { authorized: false, error: "Premium AI Intelligence is not available to your role or subscription plan." } as const;
  }

  return { authorized: true, tenant, permissions } as const;
}

export async function generateEnterpriseAiAnalysis(
  _state: AiIntelligenceActionState,
  formData: FormData,
): Promise<AiIntelligenceActionState> {
  const context = await getAuthorizedContext();
  if (!context.authorized) return { status: "ERROR", message: context.error, analysisId: null };

  try {
    const rawUseCase = String(formData.get("useCase") ?? "");
    if (!Object.values(AiIntelligenceUseCase).includes(rawUseCase as AiIntelligenceUseCase)) {
      throw new Error("Select a valid intelligence analysis type.");
    }

    const analysis = await generateEnterpriseAiAnalysisService({
      organizationId: context.tenant.organizationId,
      userId: context.tenant.user.id,
      permissions: context.permissions,
      useCase: rawUseCase as AiIntelligenceUseCase,
      question: String(formData.get("question") ?? ""),
    });

    revalidatePath("/intelligence");
    return {
      status: "SUCCESS",
      message: "Review-only intelligence generated and saved for human disposition.",
      analysisId: analysis.id,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function reviewEnterpriseAiAnalysis(
  _state: AiIntelligenceActionState,
  formData: FormData,
): Promise<AiIntelligenceActionState> {
  const context = await getAuthorizedContext(true);
  if (!context.authorized) return { status: "ERROR", message: context.error, analysisId: null };

  try {
    const analysisId = String(formData.get("analysisId") ?? "");
    const rawDecision = String(formData.get("decision") ?? "");
    if (rawDecision !== AiIntelligenceStatus.APPROVED && rawDecision !== AiIntelligenceStatus.REJECTED) {
      throw new Error("Select approve or reject as the review decision.");
    }

    await reviewEnterpriseAiAnalysisService({
      organizationId: context.tenant.organizationId,
      reviewerId: context.tenant.user.id,
      analysisId,
      decision: rawDecision as AiIntelligenceStatus,
      notes: String(formData.get("notes") ?? ""),
    });

    revalidatePath("/intelligence");
    revalidatePath(`/intelligence/${analysisId}`);
    return { status: "SUCCESS", message: "Human review decision recorded.", analysisId };
  } catch (error) {
    return errorState(error);
  }
}

export async function recordEnterpriseAiFeedback(
  _state: AiIntelligenceActionState,
  formData: FormData,
): Promise<AiIntelligenceActionState> {
  const context = await getAuthorizedContext();
  if (!context.authorized) return { status: "ERROR", message: context.error, analysisId: null };

  try {
    const analysisId = String(formData.get("analysisId") ?? "");
    const rawRating = String(formData.get("rating") ?? "");
    if (!Object.values(AiIntelligenceFeedbackRating).includes(rawRating as AiIntelligenceFeedbackRating)) {
      throw new Error("Select whether the analysis was helpful.");
    }

    await recordEnterpriseAiFeedbackService({
      organizationId: context.tenant.organizationId,
      userId: context.tenant.user.id,
      analysisId,
      rating: rawRating as AiIntelligenceFeedbackRating,
      comment: String(formData.get("comment") ?? ""),
    });

    revalidatePath(`/intelligence/${analysisId}`);
    return { status: "SUCCESS", message: "Your feedback was recorded.", analysisId };
  } catch (error) {
    return errorState(error);
  }
}
