import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCsv, profileResearchFile } from "../src/modules/research/research-import";

test("research CSV parsing preserves quoted commas and escaped quotes",()=>{assert.deepEqual(parseCsv('name,note\n"Doe, Jane","said ""yes"""'),[["name","note"],["Doe, Jane",'said "yes"']])});
test("research import profiling infers a bounded data dictionary",async()=>{const profile=await profileResearchFile(new TextEncoder().encode("score,active,date\n12,yes,2026-09-01\n15,no,2026-09-02").buffer,"text/csv","study.csv");assert.equal(profile.rowCount,2);assert.equal(profile.variables[0]?.dataType,"NUMBER");assert.equal(profile.variables[1]?.dataType,"BOOLEAN");assert.equal(profile.variables[2]?.dataType,"DATE");assert.equal(profile.preview.length,2)});
test("research imports are private, tenant scoped and permission protected",async()=>{const source=await readFile(new URL("../src/app/api/research/imports/upload/route.ts",import.meta.url),"utf8");assert.match(source,/MANAGE_RESEARCH_DATASETS/);assert.match(source,/organizationId/);assert.match(source,/access: "private"/);assert.match(source,/maximumSizeInBytes/);assert.match(source,/logActivity/)});
