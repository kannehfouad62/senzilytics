import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfigurableFormModule,ConfigurableFormVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFormDefinitionManagement } from "@/modules/forms/form-authorization";
import { QuestionnaireTestForm } from "@/features/research/questionnaire-test-form";

export const dynamic="force-dynamic";
export default async function QuestionnaireTestPage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const{organizationId}=await requireFormDefinitionManagement(id);
  const definition=await prisma.configurableFormDefinition.findFirst({where:{id,organizationId,module:ConfigurableFormModule.RESEARCH},include:{versions:{where:{status:ConfigurableFormVersionStatus.DRAFT},orderBy:{version:"desc"},take:1,include:{fields:{orderBy:{sequence:"asc"}}}}}});
  const version=definition?.versions[0];if(!definition||!version)notFound();
  return <div className="mx-auto max-w-5xl"><Link href={`/form-studio/${definition.id}`} className="text-sm text-cyan-300">← Return to Questionnaire Studio</Link><div className="mt-6"><p className="text-sm uppercase tracking-wide text-amber-300">Governed pre-publication validation · Draft v{version.version}</p><h1 className="mt-2 text-4xl font-bold">Test {definition.name}</h1><p className="mt-2 max-w-3xl text-slate-400">Review the complete respondent experience and validate a disposable test response before publication.</p></div><QuestionnaireTestForm form={{id:definition.id,name:definition.name,description:definition.description,version}}/></div>;
}
