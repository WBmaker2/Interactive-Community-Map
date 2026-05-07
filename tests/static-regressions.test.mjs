import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const configSource = readFileSync(new URL("../src/config.js", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../src/ui.js", import.meta.url), "utf8");
const exportersSource = readFileSync(new URL("../src/exporters.js", import.meta.url), "utf8");

test("the app boots from focused ES modules instead of the legacy app.js bundle", () => {
  assert.match(htmlSource, /<script type="module" src="src\/main\.js"><\/script>/);
  assert.doesNotMatch(htmlSource, /<script src="app\.js"><\/script>/);
});

test("category metadata has a single JavaScript source of truth", () => {
  assert.match(configSource, /export const CATEGORIES = \[/);
  assert.match(configSource, /key: "pride"/);
  assert.match(configSource, /key: "safety"/);
  assert.match(configSource, /key: "help"/);
  assert.match(uiSource, /renderCategoryOptions/);
  assert.match(uiSource, /renderLegend/);
  assert.match(uiSource, /renderFilterButtons/);
});

test("classroom JSON controls and destructive clear controls are present", () => {
  assert.match(htmlSource, /id="className"/);
  assert.match(htmlSource, /id="groupName"/);
  assert.match(htmlSource, /id="exportJsonBtn"/);
  assert.match(htmlSource, /id="importJsonInput"/);
  assert.match(htmlSource, /id="importPreviewPanel"/);
  assert.match(htmlSource, /id="mergeImportBtn"/);
  assert.match(htmlSource, /id="clearAllBtn"/);
});

test("download object URLs are revoked asynchronously after click", () => {
  assert.match(exportersSource, /function revokeObjectUrlLater\(url\)/);
  assert.match(exportersSource, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 0\)/);
});

test("mobile-heavy sections use disclosure controls", () => {
  assert.match(htmlSource, /<details[^>]+id="standardsDetails"/);
  assert.match(htmlSource, /<details[^>]+id="exportMenu"/);
});
