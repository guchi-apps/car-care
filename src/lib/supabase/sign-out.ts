import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * このアプリのセッションだけを破棄する。
 *
 * Supabase Auth の `signOut()` は scope の既定が `global` で、同じユーザーの全アプリ・全端末の
 * refresh token を失効させる。このプロジェクトは複数アプリで共有しているため、Car Care から
 * ログアウトしただけで他アプリまで巻き込まないよう、必ず `local` を明示する（#169）。
 *
 * ログアウト・許可外ユーザーの拒否など「このアプリのセッションを捨てる」経路はすべて
 * `supabase.auth.signOut()` を直接呼ばず、この関数を通すこと。
 */
export function signOutThisApp(supabase: {
  auth: Pick<SupabaseClient["auth"], "signOut">;
}) {
  return supabase.auth.signOut({ scope: "local" });
}
