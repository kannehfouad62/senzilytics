import assert from "node:assert/strict";
import test from "node:test";
import { rankAssuranceSignals, type AssuranceSignal } from "../src/modules/assurance/operational-assurance.service";

const signal=(id:string,severity:AssuranceSignal["severity"],title=id):AssuranceSignal=>({id,title,detail:"",source:"test",href:"/",severity,site:null});

test("operational assurance ranks critical signals ahead of high and medium signals",()=>{
  const ranked=rankAssuranceSignals([signal("medium","MEDIUM"),signal("high","HIGH"),signal("critical","CRITICAL")]);
  assert.deepEqual(ranked.map(item=>item.id),["critical","high","medium"]);
});

test("operational assurance ranking is deterministic within a severity",()=>{
  const ranked=rankAssuranceSignals([signal("b","HIGH","Bravo"),signal("a","HIGH","Alpha")]);
  assert.deepEqual(ranked.map(item=>item.id),["a","b"]);
});
