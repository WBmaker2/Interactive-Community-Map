import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEntryId,
  exportAppJson,
  importAppJson,
  loadEntries,
  normalizeEntry,
  normalizeSession,
} from "../src/storage.js";

class MemoryStorage {
  constructor(values = {}) {
    this.values = { ...values };
  }

  getItem(key) {
    return this.values[key] ?? null;
  }

  setItem(key, value) {
    this.values[key] = String(value);
  }
}

test("createEntryId falls back when randomUUID is unavailable", () => {
  const id = createEntryId({ randomUUID: undefined }, () => 123456789, () => 0.25);

  assert.match(id, /^entry-/);
  assert.match(id, /21i3v9/);
});

test("loadEntries drops invalid stored rows and normalizes valid legacy rows", () => {
  const storage = new MemoryStorage({
    community_map_entries_v1: JSON.stringify([
      { id: "ok", placeName: "학교 앞", category: "safety", note: 123, lat: "37.1", lng: "127.1" },
      { id: "bad", placeName: "", category: "safety", lat: 37.1, lng: 127.1 },
      { id: "bad2", placeName: "좌표 없음", category: "help" },
    ]),
  });

  const entries = loadEntries(storage, { idFactory: () => "generated-id" });

  assert.deepEqual(entries, [
    {
      id: "ok",
      placeName: "학교 앞",
      category: "safety",
      note: "123",
      lat: 37.1,
      lng: 127.1,
      createdAt: "",
    },
  ]);
});

test("normalizeEntry generates ids for imported rows without ids", () => {
  const entry = normalizeEntry(
    { placeName: "보건실", category: "help", lat: 37.2, lng: 127.2 },
    { idFactory: () => "generated-id" }
  );

  assert.equal(entry.id, "generated-id");
});

test("session metadata keeps classroom fields tidy", () => {
  assert.deepEqual(normalizeSession({ className: " 4-1 ", groupName: " 3모둠 " }), {
    className: "4-1",
    groupName: "3모둠",
  });
});

test("JSON export and import round-trip entries and session metadata", () => {
  const entries = [
    { id: "one", placeName: "공원", category: "pride", note: "", lat: 37, lng: 127, createdAt: "" },
  ];
  const session = { className: "4-1", groupName: "1모둠" };

  const json = exportAppJson(entries, session);
  const imported = importAppJson(json, { idFactory: () => "generated-id" });

  assert.equal(imported.schemaVersion, 2);
  assert.deepEqual(imported.entries, entries);
  assert.deepEqual(imported.session, session);
});
