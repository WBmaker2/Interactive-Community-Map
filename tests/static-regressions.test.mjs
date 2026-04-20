import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("download object URLs are revoked asynchronously after click", () => {
  assert.match(appSource, /function revokeObjectUrlLater\(url\)/);
  assert.match(appSource, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 0\)/);
  assert.doesNotMatch(appSource, /link\.remove\(\);\s*URL\.revokeObjectURL\(url\);/);
});

test("entry saves report storage failures without throwing through the UI flow", () => {
  assert.match(appSource, /function saveEntries\(data\) {\s*try {/s);
  assert.match(appSource, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(data\)\);/);
  assert.match(appSource, /return true;/);
  assert.match(appSource, /catch \{/);
  assert.match(appSource, /return false;/);
});

test("dashboard toggle exposes its expanded state to assistive technology", () => {
  assert.match(
    htmlSource,
    /id="toggleDashboardBtn"[\s\S]*aria-controls="dashboardPanel"[\s\S]*aria-expanded="false"/
  );
  assert.match(appSource, /function syncDashboardButtonState\(\)/);
  assert.match(
    appSource,
    /toggleDashboardBtn\.setAttribute\(\s*"aria-expanded",\s*String\(!dashboardPanel\.classList\.contains\("hidden"\)\)\s*\);/
  );
});

test("category filters expose the selected state semantically", () => {
  assert.match(htmlSource, /id="filterWrap"[\s\S]*role="group"/);
  assert.match(appSource, /btn\.setAttribute\("aria-pressed", String\(key === activeFilter\)\);/);
  assert.match(
    appSource,
    /node\.setAttribute\("aria-pressed", String\(node\.dataset\.filter === key\)\);/
  );
});
