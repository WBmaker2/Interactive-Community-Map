import assert from "node:assert/strict";
import { test } from "node:test";

const PUBLIC_URL = process.env.PUBLIC_URL ?? "https://wbmaker2.github.io/Interactive-Community-Map/";

test("public GitHub Pages deployment serves the modular app shell", async () => {
  const html = await fetchText(new URL(`?v=${Date.now()}`, PUBLIC_URL));

  assert.match(html, /<script type="module" src="src\/main\.js"><\/script>/);
  assert.doesNotMatch(html, /<script src="app\.js"><\/script>/);
  assert.match(html, /id="map"/);
  assert.match(html, /id="className"/);
  assert.match(html, /id="groupName"/);
  assert.match(html, /id="exportMenu"/);
  assert.match(html, /id="exportJsonBtn"/);
  assert.match(html, /id="importPreviewPanel"/);
});

test("public GitHub Pages deployment serves the focused source modules", async () => {
  const [mainSource, uiSource, configSource] = await Promise.all([
    fetchText(new URL(`src/main.js?v=${Date.now()}`, PUBLIC_URL)),
    fetchText(new URL(`src/ui.js?v=${Date.now()}`, PUBLIC_URL)),
    fetchText(new URL(`src/config.js?v=${Date.now()}`, PUBLIC_URL)),
  ]);

  assert.match(mainSource, /import \{ initApp \} from "\.\/ui\.js"/);
  assert.match(uiSource, /showImportPreview/);
  assert.match(uiSource, /mergeImportedEntries/);
  assert.match(configSource, /export const CATEGORIES = \[/);
});

async function fetchText(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return response.text();
}
