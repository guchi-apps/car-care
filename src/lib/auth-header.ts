/**
 * proxy.ts が検証した Supabase ユーザー ID を、後段のページ・ルートハンドラへ渡すためのヘッダー。
 *
 * proxy.ts は matcher に一致するすべてのリクエストでこの値を必ず上書きし、未ログインなら削除する。
 * そのため、クライアントが同名のヘッダーを詐称して送ってきても後段には届かない。
 */
export const SUPABASE_USER_ID_HEADER = "x-car-care-supabase-user-id";
