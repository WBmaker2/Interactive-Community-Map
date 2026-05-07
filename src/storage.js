import { APP_SCHEMA_VERSION, CATEGORY_BY_KEY, SESSION_STORAGE_KEY, STORAGE_KEY } from "./config.js";

const EMPTY_SESSION = Object.freeze({ className: "", groupName: "" });

export function createEntryId(
  cryptoSource = globalThis.crypto,
  now = Date.now,
  random = Math.random
) {
  if (cryptoSource && typeof cryptoSource.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }

  const timePart = Number(now()).toString(36);
  const randomPart = Math.floor(Number(random()) * 0xffffffff)
    .toString(36)
    .padStart(6, "0");
  return `entry-${timePart}-${randomPart}`;
}

export function normalizeEntry(raw, options = {}) {
  if (!raw || typeof raw !== "object") return null;

  const idFactory = options.idFactory ?? (() => createEntryId());
  const placeName = toTrimmedString(raw.placeName);
  const category = toTrimmedString(raw.category);
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);

  if (!placeName || !CATEGORY_BY_KEY[category] || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const id = toTrimmedString(raw.id) || idFactory();
  if (!id) return null;

  return {
    id,
    placeName,
    category,
    note: toTrimmedString(raw.note),
    lat,
    lng,
    createdAt: raw.createdAt ? String(raw.createdAt) : "",
  };
}

export function normalizeEntries(rows, options = {}) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeEntry(row, options)).filter(Boolean);
}

export function loadEntries(storage = getLocalStorage(), options = {}) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeEntries(parsed, options);
  } catch {
    return [];
  }
}

export function saveEntries(entries, storage = getLocalStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeEntries(entries)));
    return true;
  } catch {
    return false;
  }
}

export function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SESSION };

  return {
    className: toTrimmedString(raw.className),
    groupName: toTrimmedString(raw.groupName),
  };
}

export function loadSession(storage = getLocalStorage()) {
  try {
    const raw = storage?.getItem(SESSION_STORAGE_KEY);
    return normalizeSession(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export function saveSession(session, storage = getLocalStorage()) {
  try {
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizeSession(session)));
    return true;
  } catch {
    return false;
  }
}

export function exportAppJson(entries, session) {
  return JSON.stringify(
    {
      schemaVersion: APP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      session: normalizeSession(session),
      entries: normalizeEntries(entries),
    },
    null,
    2
  );
}

export function importAppJson(raw, options = {}) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const entriesRaw = Array.isArray(parsed) ? parsed : parsed?.entries;
  const sessionRaw = Array.isArray(parsed) ? null : parsed?.session;

  return {
    schemaVersion: APP_SCHEMA_VERSION,
    session: normalizeSession(sessionRaw),
    entries: normalizeEntries(entriesRaw, options),
  };
}

function toTrimmedString(value) {
  return String(value ?? "").trim();
}

function getLocalStorage() {
  return globalThis.localStorage;
}
