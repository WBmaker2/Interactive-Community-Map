# Community Map Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single-file map app into focused modules, centralize category metadata, add classroom data management tools, improve mobile space usage, and cover core flows with browser tests.

**Architecture:** Keep the app as a static GitHub Pages site with native ES modules and no build step. Move configuration, storage, map rendering, UI wiring, and export helpers into `src/` modules while preserving the current public behavior and `localStorage` key. Add Node tests for pure modules and Playwright browser tests for real classroom flows.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Leaflet, html2canvas, jsPDF, Node `node:test`, Playwright.

**Status:** Implementation completed locally. Verification passed with `node --check src/main.js`, `node --test tests/*.test.mjs`, and `git diff --check`. Commit/push remains a separate release step.

---

## File Structure

- Create `src/config.js`: single source for categories, storage key, map defaults.
- Create `src/storage.js`: entry/session validation, schema migration, save/load, JSON import/export helpers.
- Create `src/exporters.js`: CSV escaping, CSV download, image/PDF export helpers.
- Create `src/map-view.js`: Leaflet map creation, marker rendering, user-location drawing.
- Create `src/ui.js`: DOM wiring, form state, dashboard, filters, mobile panels, JSON import/export, clear-all.
- Create `src/main.js`: app bootstrap and dependency composition.
- Modify `index.html`: load `src/main.js` as a module, replace duplicated category markup with render targets, add classroom fields, JSON controls, clear-all, and mobile disclosure controls.
- Modify `styles.css`: support mobile collapsible sections, metadata controls, import file input, and compact action layout.
- Modify `tests/static-regressions.test.mjs`: point static checks at new module files.
- Create `tests/storage.test.mjs`: validate entry/session sanitation and JSON import/export helpers.
- Create `tests/exporters.test.mjs`: verify CSV escaping and formula neutralization.
- Create `tests/browser-flow.test.mjs`: Playwright tests for add, filter, edit, delete, and CSV content.
- Create `package.json`: document `test`, `test:unit`, `test:browser`, and `check` commands without adding a bundler.

## Task 1: Planning and Test Harness

**Files:**
- Create: `package.json`
- Modify: `tests/static-regressions.test.mjs`

- [x] **Step 1: Add scripts**

Create `package.json` with:

```json
{
  "scripts": {
    "check": "node --check src/main.js",
    "test:unit": "node --test tests/*.test.mjs --test-skip-pattern browser",
    "test:browser": "node --test tests/browser-flow.test.mjs",
    "test": "node --test tests/*.test.mjs"
  }
}
```

- [x] **Step 2: Run current tests**

Run: `node --test tests/static-regressions.test.mjs`
Expected: PASS before refactor starts.

## Task 2: Central Configuration and Storage

**Files:**
- Create: `src/config.js`
- Create: `src/storage.js`
- Create: `tests/storage.test.mjs`

- [x] **Step 1: Write failing storage tests**

Cover:
- invalid `localStorage` rows are dropped
- missing ids are generated
- `crypto.randomUUID` fallback exists
- session metadata stores `className` and `groupName`
- JSON export/import round-trips entries and session metadata

- [x] **Step 2: Run tests to verify failure**

Run: `node --test tests/storage.test.mjs`
Expected: FAIL because modules do not exist.

- [x] **Step 3: Implement config and storage modules**

Move categories into `src/config.js`. Implement validation, save/load, JSON parsing, fallback id generation, and schema version handling in `src/storage.js`.

- [x] **Step 4: Run tests to verify pass**

Run: `node --test tests/storage.test.mjs`
Expected: PASS.

## Task 3: Export Helpers

**Files:**
- Create: `src/exporters.js`
- Create: `tests/exporters.test.mjs`

- [x] **Step 1: Write failing exporter tests**

Cover:
- CSV includes class/group metadata when present
- CSV cells quote commas and quotes
- formula-leading values starting with `=`, `+`, `-`, or `@` are neutralized

- [x] **Step 2: Run tests to verify failure**

Run: `node --test tests/exporters.test.mjs`
Expected: FAIL because module does not exist.

- [x] **Step 3: Implement exporters**

Move CSV generation and reusable download helpers into `src/exporters.js`. Keep image/PDF browser-only functions exported from the same module.

- [x] **Step 4: Run tests to verify pass**

Run: `node --test tests/exporters.test.mjs`
Expected: PASS.

## Task 4: Map and UI Module Split

**Files:**
- Create: `src/map-view.js`
- Create: `src/ui.js`
- Create: `src/main.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js` or remove it from HTML use

- [x] **Step 1: Add static regression tests**

Update `tests/static-regressions.test.mjs` so it checks:
- `index.html` uses `type="module"` and `src/main.js`
- category select, legend, and filters are rendered from config
- JSON import/export and clear-all controls exist
- mobile sections use disclosure controls

- [x] **Step 2: Run tests to verify failure**

Run: `node --test tests/static-regressions.test.mjs`
Expected: FAIL until HTML and modules are updated.

- [x] **Step 3: Implement map/UI split**

Move Leaflet setup and marker rendering to `src/map-view.js`. Move DOM event wiring, form logic, dashboard, filter rendering, classroom metadata, JSON import/export, and clear-all to `src/ui.js`. Keep `src/main.js` as the only bootstrap file.

- [x] **Step 4: Run static/unit tests**

Run: `node --test tests/static-regressions.test.mjs tests/storage.test.mjs tests/exporters.test.mjs`
Expected: PASS.

## Task 5: Classroom Data Tools and Mobile Space

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/ui.js`

- [x] **Step 1: Implement classroom controls**

Add compact inputs for class name and group name. Store them with session metadata and include them in CSV/JSON/PDF contexts.

- [x] **Step 2: Implement JSON controls**

Add JSON export, JSON import, and clear-all controls. Confirm before destructive clear or import replacement.

- [x] **Step 3: Implement mobile controls**

Use disclosure controls to collapse standards and export actions on small screens so the map keeps usable height.

- [x] **Step 4: Run tests**

Run: `node --test tests/*.test.mjs --test-skip-pattern browser`
Expected: PASS.

## Task 6: Browser Flow Tests

**Files:**
- Create: `tests/browser-flow.test.mjs`

- [x] **Step 1: Write failing Playwright tests**

Cover:
- clicking the map creates a record
- filtering hides/shows markers
- popup edit changes record text
- popup delete removes a record
- CSV download contains the saved record and metadata

- [x] **Step 2: Run tests to verify failure or dependency gap**

Run: `node --test tests/browser-flow.test.mjs`
Expected: FAIL before UI is complete, or report Playwright browser dependency issues.

- [x] **Step 3: Complete browser-facing behavior**

Fix the UI until all browser flows pass. Prefer robust selectors and avoid relying on visual-only state.

- [x] **Step 4: Run full verification**

Run:

```bash
node --check src/main.js
node --test tests/*.test.mjs
git diff --check
```

Expected: all commands pass.

## Task 7: Final Review

**Files:**
- All touched files

- [x] **Step 1: Review diff**

Check that `app.js` no longer owns all behavior, category metadata is not duplicated, and no secrets or generated temp files were added.

- [x] **Step 2: Verify public static compatibility**

Open `index.html` through a local static server and ensure module loading works from static hosting.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: modularize map app and add classroom data tools"
```
