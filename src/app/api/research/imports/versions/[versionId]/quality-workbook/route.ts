import ExcelJS from "exceljs";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getImportedAnalysisDataset } from "@/modules/research/imported-analysis-dataset.service";
import { buildResearchQualityProfile } from "@/modules/research/research-quality-profile";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{versionId:string}>}){
  await requirePermission(PermissionKey.EXPORT_RESEARCH_OUTPUTS);
  const [{versionId},{organizationId}]=await Promise.all([params,getCurrentUserTenant()]),dataset=await getImportedAnalysisDataset(organizationId,versionId);
  if(!dataset)return new Response("Approved dataset version not found.",{status:404});
  const profile=buildResearchQualityProfile(dataset.rows,dataset.variables),workbook=new ExcelJS.Workbook(),summary=workbook.addWorksheet("Readiness Summary"),variables=workbook.addWorksheet("Variable Quality"),pairs=workbook.addWorksheet("Missingness Pairs");
  summary.addRows([["Senzilytics Research Data Quality Report"],["Project",dataset.version.dataset.project.reference],["Dataset",dataset.version.dataset.name],["Immutable version",dataset.version.version],["Version ID",dataset.version.id],["Generated at",new Date().toISOString()],["Readiness score",profile.readinessScore],["Rows",profile.rowCount],["Variables",profile.variableCount],["Missing cells",profile.missingCells],["Duplicate rows",profile.duplicateRows]]);
  variables.addRow(["Key","Variable","Type","Present","Missing","Completeness %","Unique","Minimum","Maximum","Mean","Outliers","Constant"]);for(const item of profile.variables)variables.addRow([item.key,item.label,item.type,item.present,item.missing,item.completeness,item.unique,item.minimum,item.maximum,item.mean,item.outliers,item.constant]);
  pairs.addRow(["First variable","Second variable","Rows missing both"]);for(const pair of profile.missingnessPairs)pairs.addRow([pair.first,pair.second,pair.count]);
  for(const sheet of workbook.worksheets){sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];sheet.columns.forEach((column)=>column.width=24)}
  const buffer=await workbook.xlsx.writeBuffer(),name=dataset.version.dataset.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase().slice(0,80);
  return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${name}-v${dataset.version.version}-quality.xlsx"`,"Cache-Control":"private, no-store"}})
}
