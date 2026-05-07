import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { once } from "node:events";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
};

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_PATH,
    "playwright",
    `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }

  throw new Error("Playwright is not available. Set PLAYWRIGHT_MODULE_PATH.");
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(projectRoot, pathname));

    if (!filePath.startsWith(projectRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

async function addEntry(page, { x = 650, y = 500, name, category, note }) {
  await page.locator("#map").click({ position: { x, y } });
  await page.locator("#placeName").fill(name);
  await page.locator("#category").selectOption(category);
  await page.locator("#note").fill(note);
  await page.getByRole("button", { name: "저장" }).click();
  await page.getByText(name).waitFor({ state: "hidden" }).catch(() => {});
}

test("map records can be added, filtered, edited, deleted, and exported as CSV", async () => {
  const { chromium } = loadPlaywright();
  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator("#className").fill("4-1");
    await page.locator("#groupName").fill("2모둠");

    await addEntry(page, {
      x: 520,
      y: 470,
      name: "학교 앞 횡단보도",
      category: "safety",
      note: "차를 조심해요",
    });
    await addEntry(page, {
      x: 720,
      y: 520,
      name: "우리 동네 공원",
      category: "pride",
      note: "산책하기 좋아요",
    });

    await assertPins(page, 2);

    await page.getByRole("button", { name: /주의할 곳/ }).click();
    await assertPins(page, 1);

    await page.locator(".leaflet-marker-icon").first().click();
    await page.getByRole("button", { name: "수정" }).click();
    await page.locator("#placeName").fill("학교 앞 안전 횡단보도");
    await page.getByRole("button", { name: "수정 저장" }).click();
    await page.getByRole("button", { name: "전체" }).click();

    await page.locator(".leaflet-marker-icon").first().click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".leaflet-popup").last().getByRole("button", { name: "삭제" }).click();
    await assertPins(page, 1);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportMenu").evaluate((node) => {
      node.open = true;
    });
    await page.getByRole("button", { name: "CSV 내보내기" }).click();
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), "utf8");

    assert.match(csv, /"4-1","2모둠"/);
    assert.match(csv, /우리 동네 공원/);
    assert.doesNotMatch(csv, /학교 앞 횡단보도/);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("mobile layout keeps standards and export controls collapsed", async () => {
  const { chromium } = loadPlaywright();
  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 }, isMobile: true });
    await page.goto(url, { waitUntil: "networkidle" });

    assert.equal(await page.locator("#standardsDetails").evaluate((node) => node.open), false);
    assert.equal(await page.locator("#exportMenu").evaluate((node) => node.open), false);

    const mapBox = await page.locator("#map").boundingBox();
    assert.ok(mapBox.height >= 420, `expected usable map height, got ${mapBox.height}`);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("JSON import previews data and can merge records without replacing current work", async () => {
  const { chromium } = loadPlaywright();
  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle" });

    await addEntry(page, {
      x: 520,
      y: 470,
      name: "현재 기록",
      category: "pride",
      note: "남겨둘 기록",
    });
    await assertPins(page, 1);

    const payload = {
      schemaVersion: 2,
      session: { className: "4-2", groupName: "탐험 1모둠" },
      entries: [
        {
          id: "import-one",
          placeName: "가져온 안전 지점",
          category: "safety",
          note: "함께 확인해요",
          lat: 37.5668,
          lng: 126.9782,
          createdAt: "2026-05-07T00:00:00.000Z",
        },
      ],
    };

    await page.locator("#importJsonInput").setInputFiles({
      name: "community-map.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });

    await page.getByText(/가져올 기록 1개/).waitFor();
    await page.getByText(/학급 4-2/).waitFor();
    await page.getByRole("button", { name: "기록 추가" }).click();

    await assertPins(page, 2);
    assert.equal(await page.locator("#className").inputValue(), "4-2");
    assert.equal(await page.locator("#groupName").inputValue(), "탐험 1모둠");

    await page.locator("#exportMenu").evaluate((node) => {
      node.open = true;
    });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV 내보내기" }).click();
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), "utf8");

    assert.match(csv, /현재 기록/);
    assert.match(csv, /가져온 안전 지점/);
    assert.match(csv, /"4-2","탐험 1모둠"/);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

async function assertPins(page, expected) {
  await page.waitForFunction(
    ({ count }) => document.querySelectorAll(".leaflet-marker-icon").length === count,
    { count: expected }
  );
}
