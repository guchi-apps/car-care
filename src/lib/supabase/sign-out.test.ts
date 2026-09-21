import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { signOutThisApp } from "./sign-out";

const srcDir = fileURLToPath(new URL("../..", import.meta.url));

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

test("signOutThisApp は scope: local を渡す（他アプリのセッションを失効させない）", async () => {
  const calls: unknown[] = [];
  const supabase = {
    auth: {
      signOut: async (options?: unknown) => {
        calls.push(options);
        return { error: null };
      },
    },
  };

  await signOutThisApp(supabase);

  assert.deepEqual(calls, [{ scope: "local" }]);
});

test("signOutThisApp は signOut のエラーをそのまま返す", async () => {
  const failure = { message: "boom" };
  const supabase = {
    auth: { signOut: async () => ({ error: failure }) },
  };

  // 型は AuthError だが、ここでは戻り値を素通しすることだけを確かめる。
  const result = await signOutThisApp(supabase as never);

  assert.equal((result as { error: unknown }).error, failure);
});

test("supabase.auth.signOut() を signOutThisApp 以外から直接呼んでいない", () => {
  // 引数なしの signOut() は scope が global になり、共有 Supabase を使う他アプリの
  // ログインまで失効させる。呼び出しは signOutThisApp に一本化する（#169）。
  const offenders = listSourceFiles(srcDir)
    .filter((file) => relative(srcDir, file) !== join("lib", "supabase", "sign-out.ts"))
    .filter((file) => /\.auth\s*\.signOut\s*\(/.test(readFileSync(file, "utf8")))
    .map((file) => relative(srcDir, file));

  assert.deepEqual(offenders, []);
});
