import assert from "node:assert/strict";
import { test } from "node:test";

import { lookupGasStationsByOsmIds } from "@/lib/gas-stations-search";

test("lookupGasStationsByOsmIds は Overpass で引けなかった osmId を、上限を絞って並列に Nominatim へ問い合わせる", async () => {
  const osmIds = ["1", "2", "3", "4", "5"];
  let activeLookupCount = 0;
  let maxActiveLookupCount = 0;

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("overpass")) {
      return new Response(JSON.stringify({ elements: [] }), { status: 200 });
    }

    if (url.includes("nominatim.openstreetmap.org/lookup")) {
      activeLookupCount += 1;
      maxActiveLookupCount = Math.max(maxActiveLookupCount, activeLookupCount);

      await new Promise((resolve) => setTimeout(resolve, 20));

      activeLookupCount -= 1;

      const osmIdsParam =
        new URL(url).searchParams.get("osm_ids") ?? "";
      const prefix = osmIdsParam[0];
      const numericId = osmIdsParam.slice(1);

      // N/W/R のうち N だけがヒットする想定にして、1 件あたりの fetch 回数を 1 回に揃える。
      if (prefix !== "N") {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(
        JSON.stringify([
          {
            place_id: 1,
            osm_type: "node",
            osm_id: Number(numericId),
            class: "amenity",
            type: "fuel",
            lat: "35.0",
            lon: "135.0",
            display_name: "テストスタンド, テスト市, 日本",
          },
        ]),
        { status: 200 },
      );
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const result = await lookupGasStationsByOsmIds(osmIds);

    assert.equal(result.size, osmIds.length);
    for (const osmId of osmIds) {
      assert.deepEqual(result.get(osmId), { lat: 35, lon: 135 });
    }

    assert.ok(
      maxActiveLookupCount <= 2,
      `Nominatim への同時問い合わせ数が上限を超えた: ${maxActiveLookupCount}`,
    );
    assert.ok(
      maxActiveLookupCount > 1,
      "直列実行のままで並列化されていない",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lookupGasStationsByOsmIds は同じ番号の別種別の要素ではなく、給油所タグを持つ要素の座標を採る", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("overpass")) {
      // 実在する衝突の再現: 東京のスタンド（way）と同じ番号の node が米国にある。
      // 給油所の node と、同じ番号の無関係な way（後に返る）の組み合わせも混ぜる。
      return new Response(
        JSON.stringify({
          elements: [
            { type: "node", id: 329593718, lat: 42.3684202, lon: -71.1589375 },
            { type: "node", id: 100, lat: 34.7, lon: 135.5, tags: { amenity: "fuel" } },
            {
              type: "way",
              id: 100,
              center: { lat: 40.7, lon: -74.0 },
              tags: { building: "yes" },
            },
            {
              type: "way",
              id: 329593718,
              center: { lat: 35.6427316, lon: 139.7336926 },
              tags: { amenity: "fuel" },
            },
          ],
        }),
        { status: 200 },
      );
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const result = await lookupGasStationsByOsmIds(["329593718", "100"]);

    assert.deepEqual(result.get("329593718"), {
      lat: 35.6427316,
      lon: 139.7336926,
    });
    assert.deepEqual(result.get("100"), { lat: 34.7, lon: 135.5 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lookupGasStationsByOsmIds は Nominatim が返した給油所でない要素を採らず、次の種別を試す", async () => {
  const originalFetch = globalThis.fetch;
  const requestedOsmIds: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("overpass")) {
      return new Response(JSON.stringify({ elements: [] }), { status: 200 });
    }

    if (url.includes("nominatim.openstreetmap.org/lookup")) {
      const osmIdsParam = new URL(url).searchParams.get("osm_ids") ?? "";
      requestedOsmIds.push(osmIdsParam);

      const body =
        osmIdsParam === "N7"
          ? [
              {
                place_id: 1,
                osm_type: "node",
                osm_id: 7,
                class: "shop",
                type: "convenience",
                lat: "40.0",
                lon: "-75.0",
                display_name: "別のお店, 米国",
              },
            ]
          : osmIdsParam === "W7"
            ? [
                {
                  place_id: 2,
                  osm_type: "way",
                  osm_id: 7,
                  class: "amenity",
                  type: "fuel",
                  lat: "35.5",
                  lon: "139.5",
                  display_name: "テストスタンド, テスト市, 日本",
                },
              ]
            : [];

      return new Response(JSON.stringify(body), { status: 200 });
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const result = await lookupGasStationsByOsmIds(["7"]);

    assert.deepEqual(result.get("7"), { lat: 35.5, lon: 139.5 });
    assert.deepEqual(requestedOsmIds, ["N7", "W7"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
