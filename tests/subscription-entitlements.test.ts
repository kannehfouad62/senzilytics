import assert from "node:assert/strict";
import test from "node:test";
import { SubscriptionPlan } from "@prisma/client";
import { planEntitlements } from "../src/lib/subscription";

test("Essential includes web modules but excludes engagement and advanced collection features",()=>{const plan=planEntitlements[SubscriptionPlan.ESSENTIAL];assert.equal(plan.IN_APP_NOTIFICATIONS,false);assert.equal(plan.EMAIL_NOTIFICATIONS,false);assert.equal(plan.DOCUMENT_UPLOAD,false);assert.equal(plan.AI,false);assert.equal(plan.OFFLINE_COLLECTION,false)});
test("Enterprise enables notifications and documents without AI or offline collection",()=>{const plan=planEntitlements[SubscriptionPlan.ENTERPRISE];assert.equal(plan.IN_APP_NOTIFICATIONS,true);assert.equal(plan.EMAIL_NOTIFICATIONS,true);assert.equal(plan.DOCUMENT_UPLOAD,true);assert.equal(plan.AI,false);assert.equal(plan.OFFLINE_COLLECTION,false)});
test("Premium enables every commercial entitlement",()=>assert.ok(Object.values(planEntitlements[SubscriptionPlan.PREMIUM]).every(Boolean)));
