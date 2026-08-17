import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_USER_ID_HEADER } from "@/lib/auth-header";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";

const publicPaths = ["/login", "/auth/signin", "/auth/callback", "/auth/signout"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  // セッション更新で Supabase が発行した Cookie は、最終的に返すレスポンスへ必ず載せる必要がある。
  // 素通しとリダイレクトのどちらを返すかはユーザーの有無を見てからでないと決まらないため、
  // ここではいったん溜めておき、レスポンスを組み立てる時点でまとめて付ける。
  const refreshedCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          refreshedCookies.push(...cookiesToSet);
        },
      },
    },
  );

  // getUser() は毎回 Supabase の /user へ往復し、アクセストークンの署名・有効期限・発行元まで
  // Supabase 側で検証させる（自前でデコードしない）。届かなかったときの戻り値は未ログインと
  // 同じ user: null なので、error を見ないと「セッションが無い」と「今は確認できない」を取り違える。
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 通信不達・5xx・レート制限。セッションが無効になったわけではないため、ログイン画面へは戻さない。
  const authUnreachable = isAuthUnreachable(error);
  if (authUnreachable) {
    console.error(
      `[car-care] Supabase Auth へ到達できずセッションを確認できない: ${request.nextUrl.pathname} ${error?.status ?? ""} ${error?.message ?? ""}`,
    );
  }

  // 検証済みのユーザー ID を後段へ渡し、ページ側が同じ検証を繰り返さずに済むようにする。
  // getUser() は毎回 Supabase へ往復するため、1 リクエストで 2 回叩くと待ち時間がそのまま倍になる。
  // 詐称を防ぐため、未ログインのときは値を残さず消す。
  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set(SUPABASE_USER_ID_HEADER, user.id);
  } else {
    requestHeaders.delete(SUPABASE_USER_ID_HEADER);
  }

  function withRefreshedCookies<T extends NextResponse>(response: T): T {
    refreshedCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    );
    return response;
  }

  const proceed = () =>
    withRefreshedCookies(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );

  const { pathname } = request.nextUrl;

  // ログイン済みユーザーが /login を開いた場合（ブラウザの「戻る」操作等）は
  // ログイン画面を再表示せずアプリへ送る。
  if (pathname === "/login" && user) {
    const target = safeNextPath(
      request.nextUrl.searchParams.get("callbackUrl"),
    );
    return withRefreshedCookies(
      NextResponse.redirect(new URL(target, getRequestOrigin(request))),
    );
  }

  if (isPublicPath(pathname)) {
    return proceed();
  }

  // ログイン状態を判定できないまま先へ進めない。ここで /login へ差し戻すと、有効なセッションを
  // 持っている利用者が電波の悪い場所で開いただけでログインし直すことになる。
  if (authUnreachable) {
    return withRefreshedCookies(serviceUnavailable(pathname));
  }

  // /api/* はルートハンドラ自身が認証チェックして 401 JSON を返す設計のため、
  // ここではリダイレクトしない（HTML のログイン画面を返すと fetch 側が解釈できない）。
  if (pathname.startsWith("/api/")) {
    return proceed();
  }

  if (!user) {
    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withRefreshedCookies(NextResponse.redirect(loginUrl));
  }

  return proceed();
}

/**
 * 「セッションが無効」ではなく「今は確認できなかった」ことを示すエラーか。
 *
 * auth-js は通信不達と HTTP 5xx を AuthRetryableFetchError（通信不達は status 0）で返す。
 * 判定関数 isAuthRetryableFetchError() は @supabase/supabase-js から再公開されておらず、
 * auth-js を直接の依存に加えたくないため、同じ判定をここに置く。
 * レート制限(429)も同じ扱いにする。時間をおけば通るもので、ログアウトさせる理由がない。
 */
function isAuthUnreachable(
  error: { name: string; status?: number } | null,
): boolean {
  if (!error) return false;
  return error.name === "AuthRetryableFetchError" || error.status === 429;
}

/**
 * ログイン状態を確認できなかったことを伝える応答。
 *
 * 401 にしないのは「認証が通らなかった」ではなく「今は確認できない」ためで、
 * 画面側にログアウトされたと解釈させない。
 */
function serviceUnavailable(pathname: string): NextResponse {
  const headers = { "Retry-After": "5", "Cache-Control": "no-store" };

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error:
          "ログイン状態を確認できませんでした。通信状況を確認して、もう一度お試しください。",
      },
      { status: 503, headers: { ...headers } },
    );
  }

  return new NextResponse(
    `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Car Care</title>
  </head>
  <body style="font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100dvh; margin: 0; text-align: center;">
    <div>
      <p>ログイン状態を確認できませんでした。</p>
      <p>通信状況を確認して、もう一度お試しください。</p>
      <p><a href="">再読み込み</a></p>
    </div>
  </body>
</html>
`,
    {
      status: 503,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
