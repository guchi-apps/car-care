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
