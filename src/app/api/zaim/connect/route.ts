import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-user";
import { getRequestOrigin } from "@/lib/request-origin";
import { fetchZaimRequestToken } from "@/lib/zaim/client";
import {
  isZaimAvailableFor,
  ZAIM_AUTHORIZE_URL,
  ZAIM_REQUEST_TOKEN_COOKIE,
} from "@/lib/zaim/config";

/**
 * Zaim 連携の開始。設定画面のリンクから素の GET で入ってくる。
 *
 * リクエストトークンの secret は、この後のコールバックで署名に使うまで手元に置く必要がある。
 * DB に一時テーブルを作るほどのものではないため、httpOnly Cookie に数分だけ持たせる。
 *
 * `/api/*` は proxy.ts がリダイレクトしないため（ルートハンドラ側で判定する設計）、
 * 未ログインの扱いはここで書く。ブラウザの画面遷移なので 401 JSON ではなくログイン画面へ送る。
 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const user = await getCurrentUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(loginUrl);
  }

  if (!isZaimAvailableFor(user.email)) {
    return NextResponse.redirect(`${origin}/settings?zaim=forbidden`);
  }

  try {
    const requestToken = await fetchZaimRequestToken(
      `${origin}/api/zaim/callback`,
    );

    const authorizeUrl = new URL(ZAIM_AUTHORIZE_URL);
    authorizeUrl.searchParams.set("oauth_token", requestToken.token);

    const response = NextResponse.redirect(authorizeUrl);

    response.cookies.set(ZAIM_REQUEST_TOKEN_COOKIE, JSON.stringify(requestToken), {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/api/zaim",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error("[zaim] 連携の開始に失敗:", error);
    return NextResponse.redirect(`${origin}/settings?zaim=connect_failed`);
  }
}
