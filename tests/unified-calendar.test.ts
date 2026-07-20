import assert from "node:assert/strict";
import test from "node:test";
import { isUnifiedCalendarStatusComplete } from "../src/modules/compliance/unified-calendar.service";

test("unified calendar recognizes terminal source statuses",()=>{for(const status of ["COMPLETED","CLOSED","CANCELLED","APPROVED","VERIFIED"])assert.equal(isUnifiedCalendarStatusComplete(status),true)});
test("unified calendar keeps actionable and overdue statuses open",()=>{for(const status of ["OPEN","ACTIVE","IN_PROGRESS","OVERDUE","PENDING","SUBMITTED"])assert.equal(isUnifiedCalendarStatusComplete(status),false)});
