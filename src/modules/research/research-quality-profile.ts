import type { ResearchDataRow, ResearchVariable } from "@/modules/research/research-analysis";

export type ResearchVariableQuality={key:string;label:string;type:string;present:number;missing:number;completeness:number;unique:number;minimum:number|null;maximum:number|null;mean:number|null;outliers:number;constant:boolean};
export type ResearchQualityProfile={rowCount:number;variableCount:number;missingCells:number;duplicateRows:number;readinessScore:number;variables:ResearchVariableQuality[];missingnessPairs:Array<{first:string;second:string;count:number}>};

export function buildResearchQualityProfile(rows:ResearchDataRow[],variables:ResearchVariable[]):ResearchQualityProfile{
  const profiles=variables.map((variable)=>profileVariable(rows,variable));
  const missingCells=profiles.reduce((sum,item)=>sum+item.missing,0),fingerprints=new Set<string>();let duplicateRows=0;
  for(const row of rows){const fingerprint=JSON.stringify(variables.map((variable)=>row.values[variable.key]??null));if(fingerprints.has(fingerprint))duplicateRows+=1;else fingerprints.add(fingerprint)}
  const missingnessPairs:Array<{first:string;second:string;count:number}>=[];
  for(let first=0;first<variables.length;first+=1)for(let second=first+1;second<variables.length;second+=1){const count=rows.filter((row)=>missing(row.values[variables[first]!.key])&&missing(row.values[variables[second]!.key])).length;if(count)missingnessPairs.push({first:variables[first]!.label,second:variables[second]!.label,count})}
  missingnessPairs.sort((a,b)=>b.count-a.count);
  const cells=Math.max(rows.length*variables.length,1),missingRate=missingCells/cells,duplicateRate=duplicateRows/Math.max(rows.length,1),constantRate=profiles.filter((item)=>item.constant&&item.present>0).length/Math.max(variables.length,1),outlierRate=profiles.reduce((sum,item)=>sum+item.outliers,0)/Math.max(rows.length,1);
  const readinessScore=Math.max(0,Math.round(100-50*missingRate-25*duplicateRate-15*constantRate-10*Math.min(outlierRate,1)));
  return{rowCount:rows.length,variableCount:variables.length,missingCells,duplicateRows,readinessScore,variables:profiles,missingnessPairs:missingnessPairs.slice(0,20)};
}

function profileVariable(rows:ResearchDataRow[],variable:ResearchVariable):ResearchVariableQuality{
  const values=rows.map((row)=>row.values[variable.key]).filter((value)=>!missing(value)),numbers=values.filter((value):value is number=>typeof value==="number"&&Number.isFinite(value)).sort((a,b)=>a-b),missingCount=rows.length-values.length,unique=new Set(values.map((value)=>JSON.stringify(value))).size;
  const mean=numbers.length?numbers.reduce((sum,value)=>sum+value,0)/numbers.length:null,q1=quantile(numbers,.25),q3=quantile(numbers,.75),spread=q1===null||q3===null?null:q3-q1,outliers=spread===null||numbers.length<4?0:numbers.filter((value)=>value<q1!-1.5*spread||value>q3!+1.5*spread).length;
  return{key:variable.key,label:variable.label,type:variable.type,present:values.length,missing:missingCount,completeness:rows.length?values.length/rows.length*100:0,unique,minimum:numbers[0]??null,maximum:numbers.at(-1)??null,mean,outliers,constant:unique===1};
}
function missing(value:unknown){return value===null||value===undefined||value===""||(Array.isArray(value)&&!value.length)}
function quantile(values:number[],p:number){if(!values.length)return null;const index=(values.length-1)*p,lower=Math.floor(index),fraction=index-lower,base=values[lower]!,upper=values[lower+1]??base;return base+(upper-base)*fraction}
