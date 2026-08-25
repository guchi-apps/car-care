import { headers } from "next/headers";

// 通知の送信元。ログイン通知は全アプリ共通の1チャンネルへ集約されており、チャンネルでは
// どのアプリへのログインか分からないため、Signalyはこの値で送信元を見分ける
// （guchi-apps/signaly#192）。CI・デプロイ通知が embed の Repository フィールド
// （guchi-apps/<repo>）から作る送信元と揃うよう、リポジトリ名にする。
const SIGNALY_SOURCE = "car-care";

async function getClientInfo() {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const clientIp =
    forwarded?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  const userAgent = headersList.get("user-agent") ?? "unknown";
  return { clientIp, userAgent };
}

function formatJstTimestamp(): string {
  return new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function sendSignalyWebhook(
  webhookUrl: string | undefined,
  content: string,
): Promise<void> {
  if (!webhookUrl) {
    console.warn("[signaly] Webhook URL is not configured; skipping notification.");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: SIGNALY_SOURCE, content }),
    });

    if (!response.ok) {
      console.error(
        `[signaly] Webhook failed: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("[signaly] Failed to send webhook:", error);
  }
}

export async function notifySignalyLogin(options: {
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  const { clientIp, userAgent } = await getClientInfo();
  const timestamp = formatJstTimestamp();

  const content = [
    "🔐 Car Care にログインしました",
    `**日時**: ${timestamp} (JST)`,
    `**メール**: ${options.email ?? "不明"}`,
    `**名前**: ${options.name ?? "不明"}`,
    "**認証方式**: Google（Supabase Auth）",
    `**IP**: ${clientIp}`,
    `**User-Agent**: ${userAgent}`,
  ].join("\n");

  await sendSignalyWebhook(process.env.SIGNALY_LOGIN_WEBHOOK_URL, content);
}
