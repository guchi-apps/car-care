import { headers } from "next/headers";

import { SUPABASE_USER_ID_HEADER } from "@/lib/auth-header";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * ログイン中のユーザーを返す。
 *
 * Supabase のセッション検証は proxy.ts が済ませ、結果をヘッダーで渡してくる。ここで
 * auth.getUser() を呼び直すと、1 リクエストにつき Supabase への往復が 2 回入ってしまう。
 * proxy.ts の matcher が外れているパス（静的アセット等）からは呼べないことに注意する。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabaseUserId = (await headers()).get(SUPABASE_USER_ID_HEADER);
  if (!supabaseUserId) return null;

  return prisma.user.findUnique({
    where: { supabaseUserId },
    select: { id: true, email: true, name: true, image: true },
  });
}

export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("認証が必要です");
  }

  return user.id;
}
