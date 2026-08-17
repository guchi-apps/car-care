import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Google ログインを開始する。
 *
 * ログインはクライアント JS のハイドレーションが完了していなくても動く必要があるため、
 * ブラウザ側で signInWithOAuth を呼ばず、サーバーで認可 URL を組み立ててリダイレクトする。
 * PKCE の検証値は Supabase のサーバークライアントが Cookie へ書き、/auth/callback が読む。
 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // ここではリダイレクトせず URL だけ受け取り、こちらで 302 を返す。
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error(
      "[car-care] Google ログインの開始に失敗:",
      error?.message ?? "URL が返らなかった",
    );
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(data.url);
}
