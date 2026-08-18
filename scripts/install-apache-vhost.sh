#!/usr/bin/env bash
# Install Apache reverse proxy for Car Maintenance (VPS で 1 回、またはドメイン変更時)
#
# Next.js は pm2 で 127.0.0.1:<APP_PORT> に待受。Apache は 80/443 をそこへ転送する。
# 未設定のままだと Apache2 デフォルトページが表示される。
#
# 使い方:
#   op signin
#   bash scripts/install-apache-vhost.sh
#
# 手動指定:
#   CAR_SERVER_NAME=car.example.com APP_PORT=3104 bash scripts/install-apache-vhost.sh
#
# サーバー固有の設定（phpMyAdmin 除外など）:
#   cp deploy/apache-vhost.local.conf.example deploy/apache-vhost.local.conf
#   # 編集後に再実行
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_NAME="car-maintenance"
APACHE_SITE="/etc/apache2/sites-available/${SITE_NAME}.conf"

read_op() {
  local ref="$1"
  if command -v op >/dev/null 2>&1; then
    op read "$ref" 2>/dev/null || true
  fi
}

hostname_from_url() {
  python3 -c "from urllib.parse import urlparse; import sys; print(urlparse(sys.argv[1]).hostname or '')" "$1"
}

# 待受ポートはシークレットではなく設定値として平文で持つ
# （guchi-apps/docs の standards/ports.md。1Password の port フィールドは #76 で削除済み）。
APP_PORT="${APP_PORT:-3104}"

if [[ -z "${CAR_SERVER_NAME:-}" ]]; then
  AUTH_URL_VALUE="$(read_op "op://apps/Car/auth-url")"
  if [[ -n "$AUTH_URL_VALUE" ]]; then
    CAR_SERVER_NAME="$(hostname_from_url "$AUTH_URL_VALUE")"
  fi
fi

if [[ -z "${CAR_SERVER_NAME:-}" ]]; then
  echo "Error: CAR_SERVER_NAME または 1Password auth-url を設定してください。" >&2
  echo "  例: CAR_SERVER_NAME=car.example.com bash scripts/install-apache-vhost.sh" >&2
  exit 1
fi

LOCAL_CONF="${ROOT}/deploy/apache-vhost.local.conf"
TEMPLATE="${ROOT}/deploy/apache-vhost.example.conf"

if [[ -f "$LOCAL_CONF" ]]; then
  SOURCE="$LOCAL_CONF"
  echo "==> Using ${LOCAL_CONF}"
else
  SOURCE="$TEMPLATE"
  echo "==> Using ${TEMPLATE} (placeholders を置換)"
fi

if ! command -v apache2ctl >/dev/null 2>&1 && ! command -v apachectl >/dev/null 2>&1; then
  echo "Error: Apache が見つかりません。apache2 をインストールしてください。" >&2
  exit 1
fi

echo "==> Car Maintenance Apache vhost"
echo "    ServerName=${CAR_SERVER_NAME}"
echo "    APP_PORT=${APP_PORT}"
echo "    Site file=${APACHE_SITE}"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

sed \
  -e "s/<SERVER_NAME>/${CAR_SERVER_NAME}/g" \
  -e "s/<APP_PORT>/${APP_PORT}/g" \
  "$SOURCE" > "$TMP"

if grep -q '<PHPMYADMIN_PATH>' "$TMP"; then
  echo "Error: deploy/apache-vhost.local.conf の <PHPMYADMIN_PATH> を置換してください。" >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

$SUDO a2enmod proxy proxy_http headers rewrite ssl >/dev/null 2>&1 || true
$SUDO cp "$TMP" "$APACHE_SITE"
$SUDO a2ensite "$SITE_NAME" >/dev/null
$SUDO apache2ctl configtest
$SUDO systemctl reload apache2

echo "==> Apache vhost installed."
echo "    http://${CAR_SERVER_NAME}/ → http://127.0.0.1:${APP_PORT}/"
echo ""
echo "確認:"
echo "  curl -fsS http://127.0.0.1:${APP_PORT}/login >/dev/null && echo 'pm2: OK'"
echo "  curl -fsSI \"http://${CAR_SERVER_NAME}/login\" | head -5"
