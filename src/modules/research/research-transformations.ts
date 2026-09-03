import { ResearchTransformationType } from "@prisma/client";

export type TransformationRecipe = {
  type: ResearchTransformationType;
  sourceVariableKey: string | null;
  secondaryVariableKey: string | null;
  outputVariableKey: string | null;
  parameters: unknown;
};
type Row = Record<string, unknown>;

export function applyResearchTransformations(input: Row[], recipes: TransformationRecipe[]) {
  let rows=input.map(row=>({...row}));
  for(const recipe of recipes){
    const parameters=object(recipe.parameters),source=recipe.sourceVariableKey;
    if(recipe.type===ResearchTransformationType.REPLACE_MISSING&&source){
      const codes=strings(parameters.codes);rows=rows.map(row=>({...row,[source]:codes.includes(String(row[source]??""))?null:row[source]}));
    }else if(recipe.type===ResearchTransformationType.RECODE_VALUE&&source){
      rows=rows.map(row=>String(row[source]??"")===String(parameters.from??"")?{...row,[source]:parameters.to??""}:row);
    }else if(recipe.type===ResearchTransformationType.FILTER_VALUE&&source){
      rows=rows.filter(row=>String(row[source]??"")!==String(parameters.value??""));
    }else if(recipe.type===ResearchTransformationType.REMOVE_DUPLICATES&&source){
      const seen=new Set<string>();rows=rows.filter(row=>{const key=String(row[source]??"");if(seen.has(key))return false;seen.add(key);return true});
    }else if(recipe.type===ResearchTransformationType.DERIVE_NUMERIC&&source&&recipe.secondaryVariableKey&&recipe.outputVariableKey){
      rows=rows.map(row=>({...row,[recipe.outputVariableKey!]:calculate(Number(row[source]),Number(row[recipe.secondaryVariableKey!]),String(parameters.operation??"SUM"))}));
    }else if(recipe.type===ResearchTransformationType.FLAG_OUTLIERS&&source){
      const numeric=rows.map(row=>Number(row[source])).filter(Number.isFinite).sort((a,b)=>a-b),q1=quantile(numeric,.25),q3=quantile(numeric,.75),spread=q3-q1;
      rows=rows.map(row=>({...row,[recipe.outputVariableKey||`${source}_outlier`]:Number.isFinite(Number(row[source]))&&(Number(row[source])<q1-1.5*spread||Number(row[source])>q3+1.5*spread)}));
    }
  }
  return rows;
}
function calculate(a:number,b:number,operation:string){if(!Number.isFinite(a)||!Number.isFinite(b))return null;if(operation==="DIFFERENCE")return a-b;if(operation==="PRODUCT")return a*b;if(operation==="RATIO")return b===0?null:a/b;return a+b}
function quantile(values:number[],p:number){if(!values.length)return 0;const index=(values.length-1)*p,lower=Math.floor(index),fraction=index-lower,base=values[lower]!,upper=values[lower+1]??base;return base+(upper-base)*fraction}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{}}
function strings(value:unknown){return Array.isArray(value)?value.map(String):[]}
