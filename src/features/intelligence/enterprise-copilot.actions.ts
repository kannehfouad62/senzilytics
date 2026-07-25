"use server";

import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  archiveAiCopilotConversationService,
  askAiCopilotService,
  createAiCopilotConversationService,
  recordAiCopilotFeedbackService,
  updateAiCopilotPolicyService,
} from "@/modules/intelligence/enterprise-copilot.service";
import type { AiCopilotActionState } from "@/modules/intelligence/enterprise-copilot.types";
import {
  AiIntelligenceFeedbackRating,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function failure(
  cause: unknown,
  fallback: string,
): AiCopilotActionState {
  return {
    status: "ERROR",
    message: cause instanceof Error ? cause.message : fallback,
    conversationId: null,
  };
}

function success(
  message: string,
  conversationId: string,
): AiCopilotActionState {
  return { status: "SUCCESS", message, conversationId };
}

async function authorizedCopilotContext() {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  await requirePermission(PermissionKey.USE_AI);
  const [tenant, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  return {
    organizationId: tenant.organizationId,
    userId: tenant.user.id,
    permissions,
  };
}

export async function createAiCopilotConversation(
  _state: AiCopilotActionState,
  formData: FormData,
): Promise<AiCopilotActionState> {
  void _state;
  let conversationId = "";
  try {
    const context = await authorizedCopilotContext();
    const conversation = await createAiCopilotConversationService({
      ...context,
      question: String(formData.get("question") ?? ""),
    });
    conversationId = conversation.id;
    revalidatePath("/intelligence");
    revalidatePath("/intelligence/copilot");
  } catch (cause) {
    return failure(cause, "The Copilot conversation could not be created.");
  }
  redirect(`/intelligence/copilot/${conversationId}`);
}

export async function askAiCopilot(
  _state: AiCopilotActionState,
  formData: FormData,
): Promise<AiCopilotActionState> {
  void _state;
  const conversationId = String(formData.get("conversationId") ?? "");
  try {
    const context = await authorizedCopilotContext();
    await askAiCopilotService({
      ...context,
      conversationId,
      question: String(formData.get("question") ?? ""),
    });
    revalidatePath("/intelligence/copilot");
    revalidatePath(`/intelligence/copilot/${conversationId}`);
    return success("Source-grounded Copilot response generated.", conversationId);
  } catch (cause) {
    return failure(cause, "The Copilot question could not be completed.");
  }
}

export async function archiveAiCopilotConversation(
  _state: AiCopilotActionState,
  formData: FormData,
): Promise<AiCopilotActionState> {
  void _state;
  const conversationId = String(formData.get("conversationId") ?? "");
  try {
    const context = await authorizedCopilotContext();
    await archiveAiCopilotConversationService({
      organizationId: context.organizationId,
      userId: context.userId,
      conversationId,
    });
    revalidatePath("/intelligence/copilot");
    revalidatePath(`/intelligence/copilot/${conversationId}`);
    return success("Copilot conversation archived.", conversationId);
  } catch (cause) {
    return failure(cause, "The Copilot conversation could not be archived.");
  }
}

export async function recordAiCopilotFeedback(
  _state: AiCopilotActionState,
  formData: FormData,
): Promise<AiCopilotActionState> {
  void _state;
  const conversationId = String(formData.get("conversationId") ?? "");
  const messageId = String(formData.get("messageId") ?? "");
  try {
    const context = await authorizedCopilotContext();
    const rawRating = String(formData.get("rating") ?? "");
    if (
      !Object.values(AiIntelligenceFeedbackRating).includes(
        rawRating as AiIntelligenceFeedbackRating,
      )
    ) {
      throw new Error("Select whether the response was helpful.");
    }
    await recordAiCopilotFeedbackService({
      organizationId: context.organizationId,
      userId: context.userId,
      conversationId,
      messageId,
      rating: rawRating as AiIntelligenceFeedbackRating,
      comment: String(formData.get("comment") ?? "").trim() || null,
    });
    revalidatePath(`/intelligence/copilot/${conversationId}`);
    return success("Your Copilot feedback was recorded.", conversationId);
  } catch (cause) {
    return failure(cause, "Copilot feedback could not be recorded.");
  }
}

export async function updateAiCopilotPolicy(
  _state: AiCopilotActionState,
  formData: FormData,
): Promise<AiCopilotActionState> {
  void _state;
  try {
    await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
    await requirePermission(PermissionKey.USE_AI);
    const { organizationId, user } = await getCurrentUserTenant();
    await updateAiCopilotPolicyService(organizationId, user.id, {
      enabled: formData.get("enabled") === "on",
      retentionDays: Number(formData.get("retentionDays")),
      maxTurnsPerConversation: Number(
        formData.get("maxTurnsPerConversation"),
      ),
      includeConversationHistory:
        formData.get("includeConversationHistory") === "on",
    });
    revalidatePath("/intelligence/copilot");
    revalidatePath("/intelligence/copilot/settings");
    return success("Tenant EHS Copilot policy updated.", organizationId);
  } catch (cause) {
    return failure(cause, "The EHS Copilot policy could not be updated.");
  }
}
