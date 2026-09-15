import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("marketing navigation retains dedicated information pages", async () => {
  const shell = await readFile(new URL("../src/components/marketing/marketing-shell.tsx", import.meta.url), "utf8");
  for (const path of ["/", "/about", "/solutions", "/industries", "/why-senzilytics", "/pricing", "/contact"]) {
    assert.match(shell, new RegExp(`"${path.replaceAll("/", "\\/")}"`));
  }
});

test("marketing pages accurately present research and audit service delivery", async () => {
  const [home, about, solutions, industries, why, pricing, contact, metadata] = await Promise.all([
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/about/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/solutions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/industries/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/why-senzilytics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/pricing/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/contact/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
  ]);
  for (const page of [home, about, solutions, industries, why, contact, metadata]) {
    assert.match(page, /research/i);
    assert.match(page, /audit/i);
  }
  assert.match(home, /id="about"/);
  assert.match(home, /id="solutions"/);
  assert.match(home, /id="industries"/);
  assert.match(home, /id="why"/);
  assert.match(home, /id="pricing"/);
  assert.match(home, /id="contact"/);
  assert.match(solutions, /passcode-protected review links/i);
  assert.match(industries, /Research, Data and Analytics Services/);
  assert.match(industries, /Audit, Assurance and Compliance Services/);
  assert.match(pricing, /financial transactions[\s\S]*outside Senzilytics/i);
});
