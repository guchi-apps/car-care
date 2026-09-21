import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { signOutThisApp } from "@/lib/supabase/sign-out";

/**
 * ログアウトする。このアプリのセッションだけを破棄し、共有 Supabase を使う他アプリの
 * ログイン状態には触れない（scope は signOutThisApp が local に固定する）。
 *
 * ログイン（/auth/signin）と同じく、クライアント JS のハイドレーション前でも押せる必要が
 * あるためフォームの POST で受ける。GET にしないのは、ブラウザやリンクの先読みで意図せず
 * ログアウトさせられることを避けるため。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { error } = await signOutThisApp(supabase);
  if (error) {
    console.error("[car-care] ログアウトに失敗:", error.message);
  }

  // POST のリダイレクトは 303 で返す。既定の 307 のままだとリダイレクト先へも POST される。
  return NextResponse.redirect(
    new URL("/login", getRequestOrigin(request)),
    303,
  );
}
