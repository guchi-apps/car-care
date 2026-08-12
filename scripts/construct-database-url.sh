#!/usr/bin/env bash
# Build DATABASE_URL from DB_* parts (1Password / GitHub Actions deploy).
set -euo pipefail

: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

DB_USER_ENC=$(urlencode "$DB_USER")
DB_PASSWORD_ENC=$(urlencode "$DB_PASSWORD")
# Prisma の接続プール上限。既定は「CPU数 * 2 + 1」で、2CPU の VPS では 5 接続になる。
# 同一 VPS 上で Prisma を使うアプリが8本動いており、既定のままでは定常で 8 * 5 = 40 接続を占有し、
# MariaDB の max_connections=50 に張り付く（デプロイ時の migrate が Too many connections で失敗した）。
# 個人用途では3で足りる。負荷の高いアプリは DB_CONNECTION_LIMIT で上書きする。
DB_CONNECTION_LIMIT="${DB_CONNECTION_LIMIT:-3}"

export DATABASE_URL="mysql://${DB_USER_ENC}:${DB_PASSWORD_ENC}@${DB_HOST}:${DB_PORT}/${DB_NAME}?connection_limit=${DB_CONNECTION_LIMIT}"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "DATABASE_URL=${DATABASE_URL}" >> "$GITHUB_ENV"
fi

if [[ $# -eq 0 ]]; then
  exit 0
fi

exec "$@"
