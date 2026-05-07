const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export function buildSchoolSearchUrl(query) {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "kr");
  url.searchParams.set("accept-language", "ko");
  url.searchParams.set("q", buildSchoolSearchQuery(query));
  return url.toString();
}

export async function findSchoolLocation(query, fetchFn = globalThis.fetch) {
  if (typeof fetchFn !== "function") {
    throw new Error("fetch is not available");
  }

  const response = await fetchFn(buildSchoolSearchUrl(query), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`School search failed: ${response.status}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return null;
  return normalizeSchoolSearchResult(rows[0]);
}

export function normalizeSchoolSearchResult(row) {
  if (!row) return null;

  const lat = Number.parseFloat(row.lat);
  const lng = Number.parseFloat(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    name: String(row.name || row.display_name || "학교 위치"),
    address: String(row.display_name || row.name || "학교 위치"),
  };
}

function buildSchoolSearchQuery(query) {
  const trimmed = String(query || "").trim();
  if (/학교|초등|중학|고등|대학/.test(trimmed)) return trimmed;
  return `${trimmed} 학교`;
}
