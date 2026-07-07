import { headers } from "next/headers";

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
      body: JSON.stringify({ content }),
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

function formatProviderLabel(provider?: string | null) {
  if (provider === "google") return "Google";
  if (provider === "passkey") return "Passkey";
  return provider ?? "不明";
}

export async function notifySignalyLogin(options: {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
}): Promise<void> {
  const { clientIp, userAgent } = await getClientInfo();
  const timestamp = formatJstTimestamp();

  const content = [
    "🔐 Car Care にログインしました",
    `**日時**: ${timestamp} (JST)`,
    `**メール**: ${options.email ?? "不明"}`,
    `**名前**: ${options.name ?? "不明"}`,
    `**認証方式**: ${formatProviderLabel(options.provider)}`,
    `**IP**: ${clientIp}`,
    `**User-Agent**: ${userAgent}`,
  ].join("\n");

  await sendSignalyWebhook(process.env.SIGNALY_WEBHOOK_LOGIN_URL, content);
}
