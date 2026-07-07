#!/usr/bin/env bash
# .env.local の DB_NAME / DB_USER / DB_PASSWORD を使ってローカル MySQL をセットアップ（1Password 不要）
#
# 使い方:
#   npm run db:setup
#
# 前提: sudo mysql で root 接続できること（MySQL 起動済み）
# migrate dev はシャドウ DB 上で DDL を実行するため、*.* への ALTER 等が必要（下記 GRANT 参照）

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
ENV_EXAMPLE="$ROOT/.env.local.example"

escape_sql_string() {
  printf "%s" "$1" | sed "s/'/''/g"
}

validate_identifier() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "Error: ${name} に使えない文字が含まれています（英数字・_・- のみ）: ${value}" >&2
    exit 1
  fi
}

run_setup() {
  for var in DB_NAME DB_USER DB_PASSWORD; do
    if [[ -z "${!var:-}" ]]; then
      echo "Error: ${var} が .env.local に設定されていません。" >&2
      exit 1
    fi
  done

  validate_identifier "DB_NAME" "$DB_NAME"
  validate_identifier "DB_USER" "$DB_USER"

  local db_password_esc
  db_password_esc=$(escape_sql_string "$DB_PASSWORD")

  echo "セットアップ対象:"
  echo "  DB_NAME: ${DB_NAME}"
  echo "  DB_USER: ${DB_USER}"
  echo "  DB_PASSWORD: ***"

  if ! command -v mysql >/dev/null 2>&1; then
    echo "Error: mysql コマンドが見つかりません。" >&2
    exit 1
  fi

  bash "$ROOT/scripts/ensure-mysql.sh"

  sudo mysql <<EOSQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${db_password_esc}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${db_password_esc}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES, LOCK TABLES ON *.* TO '${DB_USER}'@'localhost';

CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${db_password_esc}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${db_password_esc}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES, LOCK TABLES ON *.* TO '${DB_USER}'@'127.0.0.1';

FLUSH PRIVILEGES;
EOSQL

  echo "接続確認中..."
  local socket="/var/run/mysqld/mysqld.sock"
  [[ -S /run/mysqld/mysqld.sock ]] && socket="/run/mysqld/mysqld.sock"

  if mysql -u "$DB_USER" -p"$DB_PASSWORD" --socket="$socket" "$DB_NAME" -e "SELECT 1" >/dev/null 2>&1; then
    echo "OK: データベース・ユーザー作成完了（.env.local の認証情報と一致）"
  else
    echo "Error: MySQL ユーザーは作成しましたが、.env.local の DB_PASSWORD で接続できません。" >&2
    echo "  → .env.local の DB_USER / DB_PASSWORD / DB_NAME を確認" >&2
    echo "  → 修正後、再度 npm run db:setup を実行" >&2
    exit 1
  fi

  echo "次: npm run db:migrate"
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE がありません。" >&2
  echo "  cp $ENV_EXAMPLE $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

run_setup
