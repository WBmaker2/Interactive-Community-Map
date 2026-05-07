import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSchoolSearchUrl,
  findSchoolLocation,
  normalizeSchoolSearchResult,
} from "../src/school-search.js";

test("school search URL focuses Korean school lookups", () => {
  const url = new URL(buildSchoolSearchUrl("한빛"));

  assert.equal(url.origin + url.pathname, "https://nominatim.openstreetmap.org/search");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.get("limit"), "1");
  assert.equal(url.searchParams.get("countrycodes"), "kr");
  assert.equal(url.searchParams.get("q"), "한빛 학교");
});

test("school search result normalizes coordinates and names", () => {
  assert.deepEqual(
    normalizeSchoolSearchResult({
      lat: "37.5652",
      lon: "126.9778",
      name: "서울한빛초등학교",
      display_name: "서울한빛초등학교, 서울특별시",
    }),
    {
      lat: 37.5652,
      lng: 126.9778,
      name: "서울한빛초등학교",
      address: "서울한빛초등학교, 서울특별시",
    }
  );

  assert.equal(normalizeSchoolSearchResult({ lat: "x", lon: "126.9778" }), null);
});

test("findSchoolLocation returns the first normalized result", async () => {
  const result = await findSchoolLocation("서울한빛초등학교", async () => ({
    ok: true,
    json: async () => [
      {
        lat: "37.5652",
        lon: "126.9778",
        name: "서울한빛초등학교",
      },
    ],
  }));

  assert.deepEqual(result, {
    lat: 37.5652,
    lng: 126.9778,
    name: "서울한빛초등학교",
    address: "서울한빛초등학교",
  });
});
