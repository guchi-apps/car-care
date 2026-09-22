import { after, NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail } from "@/lib/allowed-users";
import { prisma } from "@/lib/prisma";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import { notifySignalyLogin } from "@/lib/signaly";
import { createClient } from "@/lib/supabase/server";
import { signOutThisApp } from "@/lib/supabase/sign-out";

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error(
      "[car-care] セッションの取得に失敗:",
      error?.message ?? "ユーザーが返らなかった",
    );
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const { user } = data;
  const email = user.email ?? null;

  // 共有 Supabase プロジェクトを他アプリと共用しているため、Supabase でログインできることと
  // Car Care を使ってよいことは別に判定する。許可外のアカウントは Car Care 側のユーザーを
  // 作らず、このアプリのセッションも破棄する（他アプリのセッションは巻き込まない）。
  if (!isAllowedEmail(email)) {
    await signOutThisApp(supabase);
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const name =
    (metadata.full_name as string) ?? (metadata.name as string) ?? null;
  const image = (metadata.avatar_url as string) ?? null;

  await linkSupabaseUser({ supabaseUserId: user.id, email: email!, name, image });

  // ログイン通知はログインの成否とは関係ない「おまけ」（kakeiboの送信と同じ扱い）。
  // リダイレクトを待たせないよう、応答を返したあとに送る。
  const provider = user.app_metadata?.provider ?? null;
  after(() => notifySignalyLogin({ email, name, provider }));

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * Supabase のユーザーと Car Care の users レコードを対応づける。
 *
 * users.id は車両・給油・メンテナンスの外部キーに使われているため差し替えられない。
 * Supabase 移行前から存在するユーザーは supabase_user_id が NULL のままなので、
 * 初回ログイン時にメールアドレスで見つけて紐付ける（＝既存データがそのまま引き継がれる）。
 */
async function linkSupabaseUser(params: {
  supabaseUserId: string;
  email: string;
  name: string | null;
  image: string | null;
}): Promise<void> {
  const { supabaseUserId, email, name, image } = params;

  const linked = await prisma.user.findUnique({ where: { supabaseUserId } });
  if (linked) {
    await prisma.user.update({
      where: { id: linked.id },
      data: { email, name, image },
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { supabaseUserId, name, image },
    });
    return;
  }

  await prisma.user.create({
    data: { supabaseUserId, email, name, image },
  });
}
