#!/usr/bin/env bash
# ローカル開発用の環境変数ラッパー（1Password 不要）
#
# .env.local を読み込み、DB_* から DATABASE_URL を組み立ててコマンドを実行する。
# 本番 DB 確認（db:*:prod）は 1Password 経由の with-op-env.sh を使う。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
ENV_EXAMPLE="$ROOT/.env.local.example"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE がありません。" >&2
  echo "  cp $ENV_EXAMPLE $ENV_FILE" >&2
  echo "  作成後、値を編集してください。" >&2
  exit 1
fi

# next dev 実行時: ポート 3000 を自動解放してから起動
if [[ "$*" == *"next dev"* ]]; then
  if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ":3000 "; then
    echo "⚠  ポート 3000 を使用中のプロセスを停止します..." >&2
    fuser -k 3000/tcp 2>/dev/null || true
    sleep 1
  fi
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export DATABASE_URL
DATABASE_URL="$(bash "$ROOT/scripts/tsx.sh" "$ROOT/scripts/build-database-url.ts")"
export DATABASE_URL

# 本番 URL はローカル開発では使わない。OAuth のリダイレクト先は
# リクエストの Host ヘッダーから組み立てる（src/lib/request-origin.ts）。
unset AUTH_URL

exec "$@"
