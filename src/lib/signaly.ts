import { headers } from "next/headers";

/**
 * Signaly へのログイン通知。
 *
 * **フォーマットの正は signaly の `docs/webhook.md`「ログイン通知の共通フォーマット」。**
 * ログイン通知は全アプリで1本のチャンネルへ集約しているため、ここだけ独自の形にすると、
 * 並べたときに同じ種類の通知に見えない。**このファイルで変えてよいのは `APP_NAME` と
 * Webhook URL の環境変数名だけ**で、残りは全アプリ共通のテンプレート
 * （guchi-apps/signaly#204）。
 *
 * **フィールド名 `接続元IP` を変えないこと。** Signaly はこの名前を手がかりに
 * 「見覚えのない接続元からのログインか」を判定し、初めての接続元なら通知を黄色にする。
 * 名前を変えるとこの警告が黙って効かなくなる。
 */
const APP_NAME = "Car Care"; // 通知に出すアプリ名。他アプリへ流用する場合はここだけ変更する

const COLOR_LOGIN = "#57f287";
const MAX_VALUE_LEN = 500;

type SignalyField = { name: string; value: string; inline: boolean };

// sv-SE ロケールは `2026-08-25 14:03:22` を返す。ja-JP だと `2026/8/25 14:03:22` になり、
// 月日がゼロ埋めされず桁が揃わないため使わない。
function jstTimestamp(): string {
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  return `${text} JST`;
}

export async function notifySignalyLogin(
  options: {
    email?: string | null;
    name?: string | null;
    provider?: string | null;
  } = {}
): Promise<void> {
  const webhookUrl = process.env.SIGNALY_WEBHOOK_LOGIN_URL;
  if (!webhookUrl) {
    console.warn("[signaly] SIGNALY_WEBHOOK_LOGIN_URL が未設定のため、ログイン通知を送りません");
    return;
  }

  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip");
  const userAgent = headersList.get("user-agent");

  // 値が取れない項目は「不明」と書かず、フィールドごと落とす。「不明」を並べると
  // どのアプリでも行数は揃うが、実際に取れている情報が読み取れなくなる。
  const fields: SignalyField[] = [];
  const push = (name: string, value: string | null | undefined, inline: boolean) => {
    if (value) fields.push({ name, value: value.slice(0, MAX_VALUE_LEN), inline });
  };

  push("ユーザー", options.name, true);
  push("メール", options.email, true);
  push("プロバイダ", options.provider, true);
  push("接続元IP", ip, true);
  fields.push({ name: "日時", value: jstTimestamp(), inline: false });
  push("User-Agent", userAgent, false);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // 集約先のチャンネルではチャンネルで送信元を見分けられないため、必ず載せる
        source: APP_NAME,
        title: `🔐 ${APP_NAME} ログイン`,
        level: "info",
        color: COLOR_LOGIN,
        fields,
      }),
    });
    if (!response.ok) {
      console.error(
        `[signaly] ログイン通知に失敗しました: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("[signaly] ログイン通知の送信に失敗しました:", error);
  }
}
