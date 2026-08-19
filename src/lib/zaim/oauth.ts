import { createHmac, randomBytes } from "node:crypto";

import { requireZaimConsumer } from "@/lib/zaim/config";

/**
 * OAuth 1.0a（HMAC-SHA1）の署名。Zaim API が要求する唯一の認証方式。
 *
 * 依存関係は増やさない方針のため、署名は node 標準の crypto で自前に組み立てている。
 * 仕様上つまずきやすい点だけ書き残しておく。
 *
 * - パーセントエンコードは RFC 3986。`encodeURIComponent` は `!*'()` を素通しするので直す
 * - 署名対象（signature base string）には **oauth_* とクエリと POST ボディの全パラメータ**を
 *   混ぜてキー順に並べる。POST は application/x-www-form-urlencoded のときだけボディを含める
 * - 署名鍵は `consumerSecret & tokenSecret`。トークンが無い段階でも末尾の `&` は必要
 * - oauth_* は Authorization ヘッダーへ、それ以外はクエリ／ボディへ入れる
 */

export type ZaimToken = {
  token: string;
  tokenSecret: string;
};

/** RFC 3986 のパーセントエンコード。 */
function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildParameterString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => [percentEncode(key), percentEncode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/**
 * 署名そのもの。既知のテストベクタで検算できるよう export している
 * （scripts/zaim-oauth-check.ts）。
 */
export function createOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(buildParameterString(params)),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  return createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildAuthorizationHeader(oauthParams: Record<string, string>): string {
  const entries = Object.entries(oauthParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`);

  return `OAuth ${entries.join(", ")}`;
}

export type ZaimRequestOptions = {
  method: "GET" | "POST";
  url: string;
  /** クエリ（GET）またはフォームボディ（POST）へ入れるパラメータ。 */
  params?: Record<string, string>;
  /** アクセストークン。連携前は null。 */
  token?: ZaimToken | null;
  /** oauth_callback / oauth_verifier など、署名に含める追加の oauth_* パラメータ。 */
  oauthExtras?: Record<string, string>;
  /** ミリ秒。既定 10 秒。Zaim が詰まっても給油記録の保存を待たせないため短くしている。 */
  timeoutMs?: number;
};

export async function zaimOAuthFetch(
  options: ZaimRequestOptions,
): Promise<Response> {
  const { method, url, params = {}, token = null, oauthExtras = {} } = options;
  const consumer = requireZaimConsumer();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumer.key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    ...oauthExtras,
  };

  if (token) {
    oauthParams.oauth_token = token.token;
  }

  oauthParams.oauth_signature = createOAuthSignature(
    method,
    url,
    { ...oauthParams, ...params },
    consumer.secret,
    token?.tokenSecret ?? "",
  );

  const headers: Record<string, string> = {
    Authorization: buildAuthorizationHeader(oauthParams),
    Accept: "application/json",
  };

  const query = buildParameterString(params);

  if (method === "GET") {
    return fetch(query ? `${url}?${query}` : url, {
      method,
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      cache: "no-store",
    });
  }

  headers["Content-Type"] = "application/x-www-form-urlencoded";

  return fetch(url, {
    method,
    headers,
    body: query,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    cache: "no-store",
  });
}

/** `oauth_token=...&oauth_token_secret=...` 形式の応答を読む。 */
export function parseTokenResponse(body: string): ZaimToken {
  const parsed = new URLSearchParams(body);
  const token = parsed.get("oauth_token");
  const tokenSecret = parsed.get("oauth_token_secret");

  if (!token || !tokenSecret) {
    throw new Error("Zaim からトークンを取得できませんでした");
  }

  return { token, tokenSecret };
}
