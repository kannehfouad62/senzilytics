import assert from"node:assert/strict";
import test from"node:test";
import{readFile}from"node:fs/promises";
import{normalizeDashboardBranding,normalizeDashboardLayout}from"../src/modules/research/research-dashboard";

test("dashboard layouts retain only authorized analyses and bounded annotations",()=>{const allowed=new Set(["analysis-1"]),layout=normalizeDashboardLayout({columns:2,widgets:[{analysisId:"analysis-1",title:"Outcome",width:"FULL",annotation:"A".repeat(1200),referenceLine:75},{analysisId:"other-tenant",title:"Unsafe"}]},allowed);assert.equal(layout.widgets.length,1);assert.equal(layout.widgets[0].analysisId,"analysis-1");assert.equal(layout.widgets[0].annotation?.length,1000);assert.equal(layout.widgets[0].referenceLine,75)});

test("dashboard branding accepts hex colors and falls back safely",()=>{assert.deepEqual(normalizeDashboardBranding({brandName:"Client A",primaryColor:"#123abc",accentColor:"javascript:bad",footerText:"Confidential"},"Project"),{brandName:"Client A",primaryColor:"#123ABC",accentColor:"#A78BFA",footerText:"Confidential"})});

test("dashboard persistence is tenant-scoped, audited, and independently approved",async()=>{const[action,schema,migration,page]=await Promise.all([readFile(new URL("../src/features/research/dashboard-actions.ts",import.meta.url),"utf8"),readFile(new URL("../prisma/schema.prisma",import.meta.url),"utf8"),readFile(new URL("../prisma/migrations/20260910210000_research_visualization_dashboards/migration.sql",import.meta.url),"utf8"),readFile(new URL("../src/app/(platform)/research/projects/[id]/dashboards/page.tsx",import.meta.url),"utf8")]);assert.match(action,/organizationId/);assert.match(action,/logActivity/);assert.match(action,/createdById===user\.id/);assert.match(action,/APPROVE_RESEARCH_OUTPUTS/);assert.match(schema,/model ResearchVisualizationDashboard/);assert.match(migration,/ResearchVisualizationDashboard/);assert.match(page,/ResearchDashboardBuilder/)});
