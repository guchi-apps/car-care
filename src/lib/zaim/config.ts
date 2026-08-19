/**
 * Zaim（家計簿）連携の設定。
 *
 * Zaim は OAuth 1.0a（HMAC-SHA1）の公式 API を提供している。給油記録を支出として
 * **書き込む** だけなので、Playwright で zaim.net を操作する必要はない
 * （asset-manager / aide が残高の取得に使っている方式とは目的が違う）。
 *
 * consumer key / secret は https://dev.zaim.net でアプリを登録して発行する。
 * 未設定の環境では連携機能そのものを表示しない（設定していない環境で壊れて見えないため）。
 */

import { isZaimSecretBoxReady } from "@/lib/zaim/secret-box";

export const ZAIM_REQUEST_TOKEN_URL = "https://api.zaim.net/v2/auth/request";
export const ZAIM_AUTHORIZE_URL = "https://auth.zaim.net/users/auth";
export const ZAIM_ACCESS_TOKEN_URL = "https://api.zaim.net/v2/auth/access";
export const ZAIM_API_BASE = "https://api.zaim.net/v2";

/** OAuth のリクエストトークンを保持する Cookie 名。コールバックまでの数分間だけ使う。 */
export const ZAIM_REQUEST_TOKEN_COOKIE = "car-care-zaim-oauth";

export type ZaimConsumer = {
  key: string;
  secret: string;
};

export function getZaimConsumer(): ZaimConsumer | null {
  const key = process.env.ZAIM_CONSUMER_KEY?.trim();
  const secret = process.env.ZAIM_CONSUMER_SECRET?.trim();

  if (!key || !secret) {
    return null;
  }

  return { key, secret };
}

export function requireZaimConsumer(): ZaimConsumer {
  const consumer = getZaimConsumer();

  if (!consumer) {
    throw new Error(
      "ZAIM_CONSUMER_KEY / ZAIM_CONSUMER_SECRET が設定されていません",
    );
  }

  return consumer;
}

/**
 * Zaim 連携を使ってよいアカウントか。
 *
 * 連携情報はユーザーごとに分かれているため、他人の Zaim へ登録されることは仕組み上ないが、
 * 「Zaim へ登録するのは特定のユーザーだけでよい」（#26）という運用に合わせて、
 * ZAIM_ALLOWED_EMAILS に挙げたアカウントだけに機能を出す。
 *
 * ALLOWED_GOOGLE_EMAILS と同じく、**未設定なら誰も使えない**（意図せず全員に開かないため）。
 */
export function isZaimAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.ZAIM_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return false;

  return allowed.includes(email.toLowerCase());
}

/** 画面に「Zaim連携」を出してよいか（鍵が揃っていて、かつ許可されたアカウント）。 */
export function isZaimAvailableFor(email: string | null | undefined): boolean {
  return (
    getZaimConsumer() !== null &&
    isZaimSecretBoxReady() &&
    isZaimAllowedEmail(email)
  );
}
