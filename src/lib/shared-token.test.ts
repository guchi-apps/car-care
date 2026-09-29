import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { resolveSharedToken } from "@/lib/shared-token";

const originalFetch = globalThis.fetch;
const originalEnv = {
  url: process.env.ISSUE_DECK_URL,
  secret: process.env.SHARED_TOKEN_API_SECRET,
};

beforeEach(() => {
  process.env.ISSUE_DECK_URL = "https://deck.example/";
  process.env.SHARED_TOKEN_API_SECRET = "bearer-secret";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["ISSUE_DECK_URL", originalEnv.url],
    ["SHARED_TOKEN_API_SECRET", originalEnv.secret],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("利用元とBearerを付けて取得し、値をキャッシュへ返す", async () => {
  let seen: { url: string; headers: Headers } | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen = { url: String(input), headers: new Headers(init?.headers) };
    return new Response(JSON.stringify({ name: "T", value: "v1" }), {
      status: 200,
    });
  }) as typeof fetch;

  const result = await resolveSharedToken("T", null, { now: 1000 });

  assert.equal(result.value, "v1");
  assert.deepEqual(result.cache, { value: "v1", fetchedAtMs: 1000 });
  assert.equal(seen!.url, "https://deck.example/api/shared-tokens?name=T");
  assert.equal(seen!.headers.get("authorization"), "Bearer bearer-secret");
  assert.equal(seen!.headers.get("x-shared-token-consumer"), "car-care");
});

test("キャッシュが新しい間は取りに行かない", async () => {
  globalThis.fetch = (async () => {
    throw new Error("呼ばれてはいけない");
  }) as typeof fetch;

  const previous = { value: "cached", fetchedAtMs: 1000 };
  const result = await resolveSharedToken("T", previous, { now: 2000 });

  assert.equal(result.value, "cached");
});

test("取得に失敗したら古くても直前の値を使い、ログに値を出さない", async () => {
  globalThis.fetch = (async () =>
    new Response("{}", { status: 500 })) as typeof fetch;

  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => logged.push(args.join(" "));

  try {
    const previous = { value: "old-secret-value", fetchedAtMs: 0 };
    const result = await resolveSharedToken("T", previous, {
      now: 60 * 60 * 1000,
    });

    assert.equal(result.value, "old-secret-value");
    assert.deepEqual(result.cache, previous);
  } finally {
    console.error = originalError;
  }

  assert.equal(logged.length, 1);
  assert.ok(!logged[0].includes("old-secret-value"));
  assert.ok(!logged[0].includes("bearer-secret"));
});

test("キャッシュも無く失敗したら null（呼び出し側が環境変数へフォールバックする）", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network");
  }) as typeof fetch;

  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await resolveSharedToken("T", null);
    assert.equal(result.value, null);
    assert.equal(result.cache, null);
  } finally {
    console.error = originalError;
  }
});

test("URL・Bearerが未設定なら取得を試みず null", async () => {
  delete process.env.SHARED_TOKEN_API_SECRET;
  globalThis.fetch = (async () => {
    throw new Error("呼ばれてはいけない");
  }) as typeof fetch;

  const result = await resolveSharedToken("T", null);

  assert.equal(result.value, null);
});

test("value が文字列でない応答は失敗として扱う", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ name: "T", value: 1 }), {
      status: 200,
    })) as typeof fetch;

  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await resolveSharedToken("T", null);
    assert.equal(result.value, null);
  } finally {
    console.error = originalError;
  }
});
