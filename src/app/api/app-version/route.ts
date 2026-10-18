import { NextResponse } from "next/server";

import { APP_VERSION } from "@/lib/app-version";

// CDN/ブラウザにキャッシュされると稼働中の版を取り違えるため常に無効化する。
export const dynamic = "force-dynamic";

/**
 * 稼働しているコミットの SHA（#257）。`deploy.yml` が `.env` へ書く `APP_COMMIT_SHA` を返す。
 * デプロイのヘルスチェックはこれが今回のコミットと一致するまで成功にしない
 * （旧版が HTTP 200 を返しているだけの状態を成功と見なさないため）。
 * ローカル開発など未設定なら null。
 */
export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION, sha: process.env.APP_COMMIT_SHA || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
