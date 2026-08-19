import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-user";
import { getRequestOrigin } from "@/lib/request-origin";
import { fetchZaimAccessToken, verifyZaimUser } from "@/lib/zaim/client";
import {
  isZaimAvailableFor,
  ZAIM_REQUEST_TOKEN_COOKIE,
} from "@/lib/zaim/config";
import { saveZaimConnection } from "@/lib/zaim/connection";
import type { ZaimToken } from "@/lib/zaim/oauth";

function readRequestTokenCookie(value: string | undefined): ZaimToken | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ZaimToken>;

    if (
      typeof parsed.token === "string" &&
      typeof parsed.tokenSecret === "string"
    ) {
      return { token: parsed.token, tokenSecret: parsed.tokenSecret };
    }
  } catch {
    // 壊れた Cookie は無いものとして扱う。
  }

  return null;
}

/** Zaim の認可画面から戻ってきたときの受け口。 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const settingsUrl = `${origin}/settings`;

  const user = await getCurrentUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(loginUrl);
  }

  if (!isZaimAvailableFor(user.email)) {
    return NextResponse.redirect(`${settingsUrl}?zaim=forbidden`);
  }

  const clearCookie = (response: NextResponse) => {
    response.cookies.set(ZAIM_REQUEST_TOKEN_COOKIE, "", {
      httpOnly: true,
      path: "/api/zaim",
      maxAge: 0,
    });
    return response;
  };

  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const verifier = searchParams.get("oauth_verifier");
  const requestToken = readRequestTokenCookie(
    request.cookies.get(ZAIM_REQUEST_TOKEN_COOKIE)?.value,
  );

  // Zaim 側で「許可しない」を押した場合もここへ戻ってくる（verifier が付かない）。
  if (!oauthToken || !verifier || !requestToken) {
    return clearCookie(
      NextResponse.redirect(`${settingsUrl}?zaim=cancelled`),
    );
  }

  // 別のタブで始めた連携の戻りを取り違えないよう、開始時のトークンと突き合わせる。
  if (requestToken.token !== oauthToken) {
    return clearCookie(
      NextResponse.redirect(`${settingsUrl}?zaim=connect_failed`),
    );
  }

  try {
    const accessToken = await fetchZaimAccessToken(requestToken, verifier);
    const zaimUser = await verifyZaimUser(accessToken);

    await saveZaimConnection(user.id, {
      token: accessToken,
      zaimUserId: zaimUser.id,
      zaimUserName: zaimUser.name,
    });

    return clearCookie(
      NextResponse.redirect(`${settingsUrl}?zaim=connected`),
    );
  } catch (error) {
    console.error("[zaim] 連携の完了に失敗:", error);
    return clearCookie(
      NextResponse.redirect(`${settingsUrl}?zaim=connect_failed`),
    );
  }
}
