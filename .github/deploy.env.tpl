# 1Password secret references for GitHub Actions deploy.
# Vault: apps — Car / DB / Server / githubaction-sshkey
#
# 初回セットアップ:
#   1. apps ボールトに「Car」アイテムを作成し、下記フィールドを登録
#      - target-dir … VPS 上のデプロイ先パス（例: /home/deploy/car-maintenance）
#      - port       … アプリ待受ポート（例: 3104）
#      - その他 Auth / DB 名 / Signaly など
#   2. GitHub リポジトリ Secrets に OP_SERVICE_ACCOUNT_TOKEN を設定
#   3. VPS で op signin 後 scripts/vps-bootstrap.sh（target-dir / port を 1Password から取得）
#   4. main へマージでデプロイ実行
#
# 共通参照（他アプリと同じ）:
#   Server, DB, githubaction-sshkey

# SSH / デプロイ先
SSH_PRIVATE_KEY=op://apps/githubaction-sshkey/private_key?ssh-format=openssh
HOST=op://apps/Server/host
USERNAME=op://apps/Server/username
SSH_PORT=op://apps/Server/ssh-port
TARGET_DIR=op://apps/Car/target-dir
PORT=op://apps/Car/port

# Database（ホスト・認証は共通 DB、アプリ名のみ個別）
DB_USER=op://apps/DB/db-user
DB_PASSWORD=op://apps/DB/db-password
DB_HOST=op://apps/DB/db-host
DB_PORT=op://apps/DB/db-port
DB_NAME=op://apps/Car/db-name
MIGRATE_DB_USER=op://apps/DB/migrate-user
MIGRATE_DB_PASSWORD=op://apps/DB/migrate-password

# Auth / App
AUTH_URL=op://apps/Car/auth-url
AUTH_SECRET=op://apps/Car/auth-secret
GOOGLE_CLIENT_ID=op://apps/Car/google-client-id
GOOGLE_CLIENT_SECRET=op://apps/Car/google-client-secret
SIGNALY_WEBHOOK_LOGIN_URL=op://apps/Car/login_webhook_url

# CI / デプロイ通知
SIGNALY_WEBHOOK_URL=op://apps/Car/ci-webhook-url
