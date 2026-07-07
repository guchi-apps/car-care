#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/dev-wsl-lan.sh
source "$ROOT_DIR/scripts/dev-wsl-lan.sh"
# shellcheck source=scripts/pick-dev-bundler.sh
source "$ROOT_DIR/scripts/pick-dev-bundler.sh"

setup_wsl_lan_dev_access "$PORT" "$ROOT_DIR"

if is_wsl; then
  maybe_enable_watchpack_polling
fi

bash "$ROOT_DIR/scripts/check-node.sh"

export DEV_ALLOWED_ORIGINS="${DEV_ALLOWED_ORIGINS:-}"

DEV_BUNDLER_FLAG="$(pick_dev_bundler)"

exec bash "$ROOT_DIR/scripts/with-local-env.sh" bash -c "bash scripts/tsx.sh scripts/db-check.ts && prisma generate && next dev -H 0.0.0.0 -p ${PORT} ${DEV_BUNDLER_FLAG}"
