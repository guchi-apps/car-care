#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.op"
ENV_EXAMPLE="$ROOT/.env.op.example"

if ! command -v op >/dev/null 2>&1; then
  echo "Error: 1Password CLI (op) が見つかりません。" >&2
  echo "  https://developer.1password.com/docs/cli/get-started/ からインストールしてください。" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE がありません。" >&2
  echo "  cp $ENV_EXAMPLE $ENV_FILE" >&2
  echo "  作成後、op:// の Vault名・アイテム名を編集してください。" >&2
  exit 1
fi

# op run で DB 変数を注入 → DATABASE_URL を組み立て → コマンド実行（本番 DB 確認専用）
# DB_TARGET / DB_TUNNEL は with-op-prod-db.sh から渡される
exec op run --env-file="$ENV_FILE" -- bash -c '
  export DATABASE_URL
  export DB_TARGET="${DB_TARGET:-}"
  export DB_TUNNEL="${DB_TUNNEL:-}"
  export PROD_DB_LOCAL_PORT="${PROD_DB_LOCAL_PORT:-}"
  DATABASE_URL="$(bash "'"$ROOT"'/scripts/tsx.sh" "'"$ROOT"'/scripts/build-database-url.ts")"
  export DATABASE_URL
  exec "$@"
' bash "$@"
