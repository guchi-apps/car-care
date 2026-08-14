# Car Care

個人用の車両メンテナンス・給油記録アプリ。スマートフォン向け PWA として利用できる Next.js アプリケーションです。

**現在のバージョン:** v1.5.0（[`package.json`](./package.json) の `version` が正本）

## 機能

| 機能 | 説明 |
|------|------|
| 認証 | Google ログイン、パスキー（WebAuthn） |
| ホーム | メンテアラート / ようこそ表示、給油・メンテのクイック入力、今月・先月の維持費サマリー |
| 車両管理 | 車両の登録・編集・削除、アクティブ車両の切り替え（複数台対応） |
| 給油記録 | 入力・一覧・編集・削除、燃費ダッシュボード（燃費・単価・月別走行距離グラフ）、周辺ガソリンスタンド検索、登録店舗の距離順表示 |
| メンテナンス | カテゴリ別の整備履歴（入力・一覧・編集・削除）、次回メンテ予定アラート、走行距離グラフ |
| 設定 | ガソリンスタンドブランド・登録店舗・メンテカテゴリの管理、パスキー登録・再設定 |
| 通知 | 新規登録・ログイン時、CI / デプロイ結果の Signaly Webhook 通知 |
| PWA | `manifest.json`、Service Worker（更新検知・自動リロード）、モバイルファースト UI |

実装状況の詳細は [`docs/SPEC_PROGRESS.md`](./docs/SPEC_PROGRESS.md) を参照してください。

## 技術スタック

- **フロントエンド:** Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS 4
- **バックエンド:** Next.js Server Actions / Route Handlers
- **認証:** NextAuth.js（Auth.js）— Google OAuth、WebAuthn
- **データベース:** MySQL + Prisma 7
- **地図:** Leaflet + OpenStreetMap（Overpass API）
- **機密情報:** ローカル開発は `.env.local`（1Password 不要）、本番デプロイ・本番 DB 確認は 1Password CLI（`.env.op`）
- **本番運用:** VPS + Apache リバースプロキシ + pm2、GitHub Actions による CI/CD

## 必要条件

- Node.js **20.19.0 以上**（[`.nvmrc`](./.nvmrc) 参照）
- MySQL（開発時はローカル `127.0.0.1:3306`）
- Google OAuth クライアント（ログイン用。**本番用とは別に開発用クライアントを作成**）
- [1Password CLI](https://developer.1password.com/docs/cli/)（`op` コマンド。本番デプロイ・本番 DB 確認時のみ必要）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数（.env.local、1Password 不要）

ローカル開発の秘密情報（DB・Auth・Google OAuth・通知）はすべて `.env.local` に平文で保存します（`.gitignore` 済みでコミットされません）。1Password は本番デプロイと本番 DB 確認にのみ使用します。

```bash
cp .env.local.example .env.local
# DB_NAME / DB_USER / DB_PASSWORD, AUTH_SECRET は自由な値で OK
```

Google Cloud Console で **開発用**（本番とは別）の OAuth クライアントを作成し、Client ID / Secret を `.env.local` に設定します。承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を追加してください。

`SIGNALY_WEBHOOK_LOGIN_URL` は任意です（未設定ならログイン通知をスキップします）。フィールド一覧は [`.env.local.example`](./.env.local.example) を参照してください。

### 3. データベース

```bash
sudo service mysql start   # MySQL が未起動の場合
npm run db:setup           # .env.local の値で DB・ユーザーを作成
npm run db:migrate         # マイグレーション適用
npm run db:check           # 接続確認
```

スキーマ変更時は `npm run db:migrate:dev` で新規マイグレーションを作成します。

### 4. 開発サーバー起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## WSL2 でのスマホ確認

`npm run dev` 起動時に Windows 側のポート転送（3000）を自動更新し、LAN 用 URL を表示します。表示された `Phone: http://…` をスマホのブラウザで開いてください（PC と同一 Wi-Fi）。

WSL 再起動後の初回は UAC（管理者承認）が求められることがあります。手動でポート転送する場合は、管理者 PowerShell で次を実行します。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/wsl-port-forward.ps1
```

**Google ログイン（LAN 経由）:** OAuth クライアントに `http://<LAN-IP>.sslip.io:3000/api/auth/callback/google` を追加してください（生 IP は Google が拒否します）。

**パスキー:** HTTP + LAN IP では利用できません。LAN 経由の確認時は Google ログインを使用してください。

## よく使うコマンド

| コマンド | 用途 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド（ローカルの `.env` を読む） |
| `npm run build:ci` | 本番ビルド（環境変数を外から与える。CI・無人実行はこちら） |
| `npm run start` | 本番モードで起動 |
| `npm run lint` | ESLint |
| `npm run env:check` | 環境変数の確認 |
| `npm run db:studio` | Prisma Studio（ローカル DB） |
| `npm run db:migrate` | マイグレーション適用 |
| `npm run db:migrate:dev` | 新規マイグレーション作成 |

### 本番 DB の確認（開発環境から）

通常はローカル MySQL を使用します。本番データの確認が必要な場合:

```bash
op signin
npm run db:check:prod        # 接続確認
npm run db:studio:prod       # Prisma Studio
npm run dev:prod-db          # 開発サーバー（閲覧のみ推奨）
```

VPS の MySQL が localhost のみ待受の場合は SSH トンネルを使用します。

```bash
# ターミナル 1
npm run db:tunnel:prod

# ターミナル 2
npm run db:studio:prod:tunnel
# または
npm run dev:prod-db:tunnel
```

`.env.op` に `SSH_HOST` / `SSH_USER` / `SSH_PORT` を登録してください。`prisma migrate dev` は本番 DB ではブロックされます。

## ブランチ戦略

| ブランチ | 用途 |
|----------|------|
| `develop` | 機能開発（push 時に CI 実行） |
| `main` | 安定版。マージ時に GitHub Actions が VPS へデプロイ |

## CI / CD

### CI（`.github/workflows/ci.yml`）

- **トリガー:** `develop` への push、`main` / `develop` 向け PR
- **内容:** ESLint、本番ビルド（`build:ci`）
- **Signaly 通知:** `develop` push 時は失敗のみ、`main` 向け PR では成功・失敗・キャンセルを通知

### バージョン管理

バージョンの正本は [`package.json`](./package.json) の `version` フィールドです。`main` へのマージ時、GitHub Actions がこの値から `v1.0.1` 形式の Git タグと GitHub Release を自動作成します。

#### リリース手順

`develop` でバージョンを上げてから `main` にマージします。タグは CI が `main` 上で付けるため、ローカルでは **`--no-git-tag-version`** を付けて `package.json` / `package-lock.json` だけ更新してください（ローカルでタグを作ると、マージ後のデプロイが「タグが既に別コミットを指している」として失敗します）。

```bash
git checkout develop
git pull

# パッチ（バグ修正）: 1.0.1 → 1.0.2
npm version patch --no-git-tag-version

# マイナー（機能追加）: 1.0.1 → 1.1.0
npm version minor --no-git-tag-version

# メジャー（破壊的変更）: 1.0.1 → 2.0.0
npm version major --no-git-tag-version

git add package.json package-lock.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git push origin develop

# PR を作成して main にマージ（または fast-forward マージ）
```

`main` マージ後の流れ:

1. `deploy.yml` が `package.json` のバージョンから `v*` タグを作成
2. CI でビルド
3. VPS へ転送し `.env` を同期 → `prisma migrate deploy` → `pm2 reload`
4. **デプロイ成功後のみ** GitHub Release を作成

同じバージョン番号で再デプロイする場合は、先にバージョンを上げてから `main` にマージする必要があります（タグが既に別コミットを指していると workflow がエラーになります）。

#### コマンド早見表

| コマンド | 用途 |
|----------|------|
| `npm version patch --no-git-tag-version` | パッチ版を上げる（`x.y.Z`） |
| `npm version minor --no-git-tag-version` | マイナー版を上げる（`x.Y.0`） |
| `npm version major --no-git-tag-version` | メジャー版を上げる（`X.0.0`） |
| `node -p "require('./package.json').version"` | 現在のバージョンを表示 |

プレリリース（例: `1.1.0-beta.0`）が必要な場合は `npm version prerelease --preid=beta --no-git-tag-version` を使用します。タグ名に `-` が含まれると GitHub Release は prerelease として扱われます。

## 本番デプロイ

`main` ブランチへの push で GitHub Actions が次を実行します。

1. `package.json` のバージョンから Git タグを作成
2. CI でビルド（`npm run build:ci`）
3. VPS へ転送し `.env` を同期
4. `prisma migrate deploy` → `pm2 reload`
5. デプロイ成功後に GitHub Release を作成

初回セットアップは `scripts/vps-bootstrap.sh` と 1Password の本番シークレット登録が必要です。詳細は [`docs/SPEC_PROGRESS.md`](./docs/SPEC_PROGRESS.md) の「開発・運用フロー、インフラ」セクションを参照してください。

本番では pm2（[`ecosystem.config.js`](./ecosystem.config.js)）でポート **3104**（環境変数 `PORT` で変更可）を待受け、Apache がリバースプロキシします。

## プロジェクト構成

```
src/
  app/
    (app)/         # 認証済みアプリ（ホーム・給油・メンテ・車両・設定）
    login/         # ログイン画面
    api/           # Route Handlers（認証・ガソリンスタンド検索・ジオコーディング）
  auth.ts          # NextAuth 設定
  components/      # UI コンポーネント
  lib/             # ビジネスロジック・ユーティリティ
prisma/            # スキーマ・マイグレーション
scripts/           # 開発・デプロイ用シェルスクリプト
public/            # 静的ファイル・PWA アセット
.github/workflows/ # CI（ci.yml）・デプロイ（deploy.yml）
docs/              # 仕様・進捗ドキュメント
```

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [`docs/SPEC_PROGRESS.md`](./docs/SPEC_PROGRESS.md) | 仕様書に対する実装進捗（正本） |
| [`AGENTS.md`](./AGENTS.md) | AI Agent 向け開発ガイド |
| [`.env.example`](./.env.example) | 環境変数フィールド一覧 |
| [`.env.local.example`](./.env.local.example) | ローカル開発用環境変数テンプレート（1Password 不要） |
| [`.env.op.example`](./.env.op.example) | 1Password CLI 設定テンプレート（本番 DB 確認用） |

## ライセンス

Private — 個人利用向けプロジェクトです。

