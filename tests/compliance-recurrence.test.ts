import assert from "node:assert/strict";import test from "node:test";import { ComplianceRecurrence } from "@prisma/client";import { nextComplianceDueDate } from "../src/modules/compliance/compliance-recurrence";
test("one-time obligations do not recur",()=>assert.equal(nextComplianceDueDate(new Date(2028,0,1),ComplianceRecurrence.ONE_TIME,1),null));
test("monthly obligations clamp month-end",()=>{const result=nextComplianceDueDate(new Date(2028,0,31),ComplianceRecurrence.MONTHLY,1);assert.equal(result?.getMonth(),1);assert.equal(result?.getDate(),29)});
test("custom recurrence advances in days",()=>{const result=nextComplianceDueDate(new Date(2028,0,1),ComplianceRecurrence.CUSTOM,45);assert.equal(result?.getDate(),15);assert.equal(result?.getMonth(),1)});
