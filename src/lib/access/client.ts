import type { User } from "@supabase/supabase-js";

import {
  createAccessClient,
  parseAccessResponse,
  type AccessDecision,
  type AccessFetcher,
  type AccessSubject,
} from "@/lib/access/decision";
import { forgetSharedToken, getSharedToken } from "@/lib/shared-token";

const TIMEOUT_MS = 5_000;

/** 管理画面「アプリ」でトークンを発行すると、issue-deck の共有トークンへこの名前で書き込まれる。 */
const TOKEN_NAME = "CAR_CARE_ACCESS_APP_TOKEN";
/** StatusHub の本番オリジン。`ACCESS_API_URL` は開発などで別の宛先へ向けるときだけ使う。 */
const DEFAULT_ACCESS_API_URL = "https://admin.gucchii.com";

/**
 * StatusHub の判定API（docs/access-control.md）を呼ぶ。
 * トークンが取れなければ通信せず失敗として扱う＝一度も判定できないので全員拒否になる
 * （未設定が「誰でも通す」に化けない。旧 ALLOWED_GOOGLE_EMAILS へのフォールバックも持たない）。
 * 再発行で古いトークンは即失効するため、401 ならキャッシュを捨てて読み直し、1 回だけ再試行する。
 * トークンの値はログへ出さない。
 */
async function post(
  baseUrl: string,
  token: string,
  body: Parameters<AccessFetcher>[0],
): Promise<Response> {
  return fetch(`${baseUrl.replace(/\/+$/, "")}/api/access/v1/decision`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

const fetcher: AccessFetcher = async (body) => {
  const baseUrl = process.env.ACCESS_API_URL || DEFAULT_ACCESS_API_URL;
  const token = await getSharedToken(TOKEN_NAME);
  if (!token) throw new Error(`${TOKEN_NAME} が未設定`);

  let response = await post(baseUrl, token, body);
  if (response.status === 401) {
    forgetSharedToken(TOKEN_NAME);
    const renewed = await getSharedToken(TOKEN_NAME);
    if (renewed && renewed !== token) response = await post(baseUrl, renewed, body);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseAccessResponse(await response.json(), body.subject !== undefined);
};

// 開発サーバーの再読み込みで状態が消えないよう globalThis に置く（instrumentation と proxy が同じ状態を見る）。
const globalForAccess = globalThis as unknown as {
  __carCareAccess?: ReturnType<typeof createAccessClient>;
};

function client() {
  globalForAccess.__carCareAccess ??= createAccessClient(
    fetcher,
    undefined,
    Date.now,
    (error) => {
      console.error(
        "[car-care] アクセス判定の取得に失敗:",
        error instanceof Error ? error.message : "unknown error",
      );
    },
  );
  return globalForAccess.__carCareAccess;
}

/**
 * Supabase が検証したユーザーから、判定 API へ送る主体を作る。
 * メールが確認済みかは Supabase の確認時刻・Google の email_verified から決める
 * （ブラウザの申告ではなく、サーバーが検証したセッションの値だけを使う）。
 */
export function toAccessSubject(
  user: Pick<User, "id" | "email" | "email_confirmed_at" | "user_metadata">,
): AccessSubject {
  const verified =
    user.user_metadata?.email_verified === true || Boolean(user.email_confirmed_at);
  return { sub: user.id, email: user.email ?? "", emailVerified: verified };
}

export async function decideAccess(subject: AccessSubject): Promise<AccessDecision> {
  return client().decide(subject);
}

export async function isUserAllowed(
  user: Parameters<typeof toAccessSubject>[0] | null | undefined,
): Promise<boolean> {
  if (!user) return false;
  return (await decideAccess(toAccessSubject(user))).allowed;
}

export async function sendAccessHeartbeat(): Promise<boolean> {
  return client().heartbeat();
}
