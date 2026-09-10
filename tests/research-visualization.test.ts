import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import type { ResearchDataRow, ResearchVariable } from "../src/modules/research/research-analysis";
import { applyResearchFilters, normalizeResearchFilters, researchFilterOptions } from "../src/modules/research/research-visualization";

const variables: ResearchVariable[] = [
  { id:"department",key:"department",label:"Department",type:"SINGLE_SELECT",required:true },
  { id:"score",key:"score",label:"Score",type:"NUMBER",required:false },
  { id:"comment",key:"comment",label:"Comment",type:"TEXT",required:false },
];
const rows: ResearchDataRow[] = [
  { assignmentId:"1",responseId:"1",submittedAt:"",values:{department:"Research",score:82,comment:"Strong delivery"} },
  { assignmentId:"2",responseId:"2",submittedAt:"",values:{department:"Research",score:54,comment:"Follow up"} },
  { assignmentId:"3",responseId:"3",submittedAt:"",values:{department:"Operations",score:91,comment:null} },
];

test("visualization canvas applies governed AND and OR filters",()=>{
  const clauses=[{id:"a",variableKey:"department",operator:"EQUALS" as const,value:"Research"},{id:"b",variableKey:"score",operator:"RANGE" as const,minimum:70}];
  assert.deepEqual(applyResearchFilters(rows,{logic:"ALL",clauses}).map(row=>row.responseId),["1"]);
  assert.deepEqual(applyResearchFilters(rows,{logic:"ANY",clauses}).map(row=>row.responseId),["1","2","3"]);
});

test("visualization filters support missing values and case-insensitive text",()=>{
  assert.deepEqual(applyResearchFilters(rows,{logic:"ALL",clauses:[{id:"a",variableKey:"comment",operator:"IS_MISSING"}]}).map(row=>row.responseId),["3"]);
  assert.deepEqual(applyResearchFilters(rows,{logic:"ALL",clauses:[{id:"a",variableKey:"comment",operator:"CONTAINS",value:"DELIVERY"}]}).map(row=>row.responseId),["1"]);
  assert.deepEqual(researchFilterOptions(rows,"department"),["Operations","Research"]);
});

test("server normalization rejects unknown fields and caps filter complexity",()=>{
  const normalized=normalizeResearchFilters({logic:"ANY",clauses:[{id:"unsafe",variableKey:"tenantId",operator:"EQUALS",value:"other"},...Array.from({length:12},(_,index)=>({id:String(index),variableKey:"score",operator:"RANGE",minimum:index}))]},variables);
  assert.equal(normalized.logic,"ANY");
  assert.equal(normalized.clauses.length,8);
  assert.ok(normalized.clauses.every(clause=>clause.variableKey==="score"));
});

test("saved and exported visualization state is tenant-governed and migration-backed",async()=>{
  const [action,schema,migration,workbook,presentation]=await Promise.all([
    readFile(new URL("../src/features/research/analysis-actions.ts",import.meta.url),"utf8"),
    readFile(new URL("../prisma/schema.prisma",import.meta.url),"utf8"),
    readFile(new URL("../prisma/migrations/20260910180000_research_visualization_canvas/migration.sql",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/research/collections/[collectionId]/workbook/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/research/collections/[collectionId]/presentation/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(action,/normalizeResearchFilters/);
  assert.match(action,/applyResearchFilters/);
  assert.match(schema,/filterDefinition\s+Json\?/);
  assert.match(schema,/visualizationConfig\s+Json\?/);
  assert.match(migration,/ALTER TABLE "ResearchAnalysis"/);
  assert.match(workbook,/Filtered View/);
  assert.match(workbook,/applyResearchFilters/);
  assert.match(presentation,/applyResearchFilters/);
});
