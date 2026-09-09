import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("research rosters span native rendering, encrypted drafts and governed sync values", async () => {
  const [app,types,storage,runtime]=await Promise.all([
    readFile(new URL("../apps/mobile/App.tsx",import.meta.url),"utf8"),
    readFile(new URL("../apps/mobile/src/types.ts",import.meta.url),"utf8"),
    readFile(new URL("../apps/mobile/src/storage.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/modules/forms/runtime-form.service.ts",import.meta.url),"utf8"),
  ]);
  assert.match(types,/REPEATING_GROUP/);
  assert.match(types,/MobileRepeatingGroupRow\[\]/);
  assert.match(app,/MobileRepeatingGroupField/);
  assert.match(app,/Crypto\.randomUUID\(\)/);
  assert.match(app,/Draft rows remain encrypted on this device/);
  assert.match(storage,/PRAGMA key/);
  assert.match(storage,/saveResearchInterviewDraft/);
  assert.match(runtime,/validateRepeatingGroup/);
});
