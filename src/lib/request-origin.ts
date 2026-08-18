import type { NextRequest } from "next/server";

/**
 * Next.js の request.url（nextUrl.origin）は、開発サーバーが 0.0.0.0 で待ち受けている場合や
 * sslip.io 経由など複数のホストから到達できる場合に、実際のブラウザの Host ヘッダーを
 * 反映しないことがある。OAuth のリダイレクト先を組み立てる際は Host ヘッダーから明示的に
 * origin を組み立てる必要がある。
 *
 * 本番は Apache のリバースプロキシ配下で、ProxyPreserveHost On と
 * RequestHeader set X-Forwarded-Proto を設定済み（deploy/apache-vhost.example.conf）。
 */
export function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/** ログイン後の戻り先として安全に使えるパスか（オープンリダイレクト対策）。 */
export function safeNextPath(value: string | null, fallback = "/"): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}
