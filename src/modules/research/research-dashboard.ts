export type ResearchDashboardWidget={analysisId:string;title:string;width:"HALF"|"FULL";annotation?:string;referenceLine?:number};
export type ResearchDashboardLayout={columns:1|2;widgets:ResearchDashboardWidget[]};
export type ResearchDashboardBranding={brandName:string;primaryColor:string;accentColor:string;footerText:string};

const clean=(value:unknown,maximum:number)=>String(value??"").trim().slice(0,maximum);
const color=(value:unknown,fallback:string)=>/^#[0-9a-f]{6}$/i.test(clean(value,7))?clean(value,7).toUpperCase():fallback;

export function normalizeDashboardLayout(value:unknown,allowedAnalysisIds:Set<string>):ResearchDashboardLayout{
  const source=value&&typeof value==="object"?value as {columns?:unknown;widgets?:unknown}:{};
  const widgets=Array.isArray(source.widgets)?source.widgets.flatMap(item=>{
    if(!item||typeof item!=="object")return[];
    const candidate=item as Record<string,unknown>,analysisId=clean(candidate.analysisId,100);
    if(!allowedAnalysisIds.has(analysisId))return[];
    const referenceLine=typeof candidate.referenceLine==="number"&&Number.isFinite(candidate.referenceLine)?candidate.referenceLine:undefined;
    return[{analysisId,title:clean(candidate.title,160)||"Analysis",width:candidate.width==="FULL"?"FULL" as const:"HALF" as const,annotation:clean(candidate.annotation,1000)||undefined,referenceLine}];
  }).slice(0,12):[];
  return{columns:source.columns===1?1:2,widgets};
}

export function normalizeDashboardBranding(value:unknown,defaultName:string):ResearchDashboardBranding{
  const source=value&&typeof value==="object"?value as Record<string,unknown>:{};
  return{brandName:clean(source.brandName,120)||clean(defaultName,120),primaryColor:color(source.primaryColor,"#22D3EE"),accentColor:color(source.accentColor,"#A78BFA"),footerText:clean(source.footerText,240)};
}
