/**
 * Car Care は所有者本人のみが利用するアプリのため、ログインできる Google アカウントを絞る。
 * 許可メールアドレスは環境変数 ALLOWED_GOOGLE_EMAILS にカンマ区切りで設定する。
 *
 * 共有 Supabase プロジェクトを他アプリと共用しているため、Supabase 側でログインできること
 * （＝Supabase にユーザーが存在すること）と、このアプリを使ってよいことは別に判定する必要がある。
 *
 * 未設定のまま誰でも入れる状態になるのを避けるため、未設定時は全員拒否とする。
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.ALLOWED_GOOGLE_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return false;

  return allowed.includes(email.toLowerCase());
}
