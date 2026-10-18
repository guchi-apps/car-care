#!/usr/bin/env bash
# app-deploy-gate がマイグレーションの直前に呼ぶ（guchi-apps/vps#300・#259）。
# gate は DATABASE_URL・MIGRATE_DATABASE_URL をマイグレーション専用ユーザーの接続先にして実行する。
#
# 失敗した記録が _prisma_migrations に残っていると以降のデプロイが P3018 で止まり続ける。
# 未完了の記録のロールバック扱いと、スキーマのずれの補修（ALTER TABLE を実行しうる）を
# prisma migrate deploy の前に済ませる（#31・#91）。
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/reconcile-migrations-deploy.mjs
