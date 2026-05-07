import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCsv, neutralizeCsvCell } from "../src/exporters.js";
import { CATEGORY_BY_KEY } from "../src/config.js";

test("neutralizeCsvCell protects spreadsheet formula-like input", () => {
  assert.equal(neutralizeCsvCell("=1+1"), "'=1+1");
  assert.equal(neutralizeCsvCell("+cmd"), "'+cmd");
  assert.equal(neutralizeCsvCell("-10"), "'-10");
  assert.equal(neutralizeCsvCell("@name"), "'@name");
  assert.equal(neutralizeCsvCell("안전한 값"), "안전한 값");
});

test("buildCsv includes class and group metadata and escapes cells", () => {
  const csv = buildCsv(
    [
      {
        id: "one",
        placeName: '쉼표, "따옴표"',
        category: "safety",
        note: "=조심",
        lat: 37.1,
        lng: 127.1,
        createdAt: "2026-05-07T00:00:00.000Z",
      },
    ],
    { categories: CATEGORY_BY_KEY, session: { className: "4-1", groupName: "2모둠" } }
  );

  assert.match(csv, /^"학급","모둠","장소 이름","카테고리","특징","위도","경도","기록일"/);
  assert.match(csv, /"4-1","2모둠","쉼표, ""따옴표"""/);
  assert.match(csv, /"'=조심"/);
});
