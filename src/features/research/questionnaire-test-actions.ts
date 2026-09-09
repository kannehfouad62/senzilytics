"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { requireFormDefinitionManagement } from "@/modules/forms/form-authorization";
import { prepareDraftResearchQuestionnaireTest } from "@/modules/forms/runtime-form.service";
import { ActivityAction,ConfigurableFormModule } from "@prisma/client";

const value=(data:FormData,key:string)=>String(data.get(key)??"").trim();
export async function validateResearchQuestionnaireTest(_state:FormActionState,data:FormData):Promise<FormActionState>{
  void _state;
  const definitionId=value(data,"definitionId"),versionId=value(data,"versionId");
  if(!definitionId||!versionId)return {status:"ERROR",message:"The test questionnaire reference is missing."};
  const {organizationId,user,definition}=await requireFormDefinitionManagement(definitionId);
  try{
    if(definition.module!==ConfigurableFormModule.RESEARCH)throw new Error("Test-response mode is available only for research questionnaires.");
    const result=await prepareDraftResearchQuestionnaireTest({organizationId,definitionId,versionId,data});
    await logActivity({organizationId,userId:user.id,action:ActivityAction.CREATE,entityType:"ResearchQuestionnaireTest",entityId:versionId,title:"Draft questionnaire test passed",description:`${result.answerCount} validated answers across ${result.visibleFieldCount} visible fields.`,metadata:{definitionId,versionId,...result,persistedResponse:false}});
    return {status:"SUCCESS",message:`Test passed: ${result.answerCount} responses validated${result.calculatedFieldCount?`, including ${result.calculatedFieldCount} calculated result${result.calculatedFieldCount===1?"":"s"}`:""}.${result.requiredFileCount?` ${result.requiredFileCount} required file field${result.requiredFileCount===1?"":"s"} must still be verified during a controlled collection test.`:""} No response or dataset record was created.`};
  }catch(cause){return {status:"ERROR",message:cause instanceof Error?cause.message:"The questionnaire test could not be completed."};}
}
