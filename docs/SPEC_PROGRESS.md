# 仕様書 実装進捗（Car Care）

> **他 Agent 向け:** 本ファイルが仕様書（Discord通知機能追加版）に対する実装状況の正本です。  
> 機能追加・デプロイ完了時は **必ず本ファイルを更新** してください。  
> **最終更新:** 2026-08-19

## ステータス凡例

| 記号 | 意味 |
|------|------|
| ✅ | 完了 |
| ⚠️ | 一部のみ / 基盤のみ / 未検証 |
| ❌ | 未実装 |
| 🚫 | 対象外（意図的に未着手） |

## 全体進捗

**約 65%** — 認証・DB スキーマ・車両管理・給油記録・メンテ UI は完了。本番デプロイは未了。

```
[██████████████████████████░░░░] 65%
```

| レイヤー | 状態 |
|----------|------|
| 認証（Supabase Auth）・Signaly・proxy | ✅ |
| DB スキーマ（Prisma） | ✅ |
| ローカル開発環境（`.env.local`、1Password 不要） | ✅ |
| PWA 雛形 | ⚠️ |
| 給油 UI | ✅ |
| メンテ・車両 UI | ✅ |
| 本番 VPS / CI/CD 運用 | ⚠️ |

---

## 2. システム要件 & アーキテクチャ

### 2.1 テクニカルスタック

| 項目 | 状態 | 実装場所 / 備考 |
|------|------|----------------|
| Next.js App Router + TypeScript + Tailwind | ✅ | プロジェクト全体 |
| MySQL + Prisma | ✅ | `prisma/schema.prisma`, `prisma/migrations/` |
| Supabase Auth（Google） | ✅ | `src/lib/supabase/`, `src/app/auth/`, `src/proxy.ts`（本番 / 開発で別 Supabase プロジェクト。開発用は `.env.local`）（#27） |
| 許可 Google アカウント判定 | ✅ | `src/lib/allowed-users.ts`（`ALLOWED_GOOGLE_EMAILS`）（#27） |
| WebAuthn / Passkey | 🚫 | Supabase Auth 移行に伴い廃止（#27）。`authenticators` テーブルは切り戻し用に残置 |
| Signaly Webhook（ログイン通知） | ✅ | `src/lib/signaly.ts`, `src/app/auth/callback/route.ts` |
| PWA | ⚠️ | `public/manifest.json`, `public/sw.js`, `public/icons/`, `app-bottom-nav.tsx`, `app-page.tsx` |
| pm2 | ✅ | `ecosystem.config.js`（本番 PORT 3104 既定） |
| GitHub Actions → VPS SSH デプロイ | ⚠️ | `.github/workflows/deploy.yml`（**1Password・VPS 初回設定後に検証**） |

### 2.2 データモデル

| テーブル | Prisma | マイグレーション | API/UI |
|----------|--------|------------------|--------|
| `users` | ✅ | ✅ `20250621000000_init`, `20250624000000_user_supabase_user_id` | 認証のみ。`supabase_user_id` で Supabase ユーザーと紐付け（#27） |
| `accounts` | ✅ | ✅ | 旧 NextAuth 用（#27 で未使用。DROP は別 Issue） |
| `sessions` | ✅ | ✅ | 旧 NextAuth 用（#27 で未使用。DROP は別 Issue） |
| `verification_tokens` | ✅ | ✅ | 旧 NextAuth 用（#27 で未使用。DROP は別 Issue） |
| `authenticators` | ✅ | ✅ | 旧 Passkey 用（#27 で未使用。DROP は別 Issue） |
| `vehicles` | ✅ | ✅ | ✅ CRUD (`/vehicles`) |
| `maintenance_categories` | ✅ | ✅ | ✅ 設定画面 CRUD |
| `maintenance_logs` | ✅ | ✅ | ✅ CRUD + 一覧 (`/maintenance`) |
| `fuel_logs` | ✅ | ✅ | ✅ CRUD + ダッシュボード (`/fuel`) |
| `gas_station_brands` | ✅ | ✅ | ✅ 設定画面 CRUD |
| `registered_gas_stations` | ✅ | ✅ `20250621260000` | ✅ 設定画面 CRUD・給油フォーム連携 |
| `zaim_connections` | ✅ | ✅ `20260819000000_zaim_connection` | ✅ 設定画面の「Zaim連携」（ユーザーごとに1件）（#26） |

---

## 3. 機能要件

### ① 認証 & Signaly 通知

| 要件 | 状態 | 備考 |
|------|------|------|
| Google ログイン | ✅ | Supabase Auth 経由（#27）。`/auth/signin` → Google → `/auth/callback` |
| 許可外 Google アカウントの拒否 | ✅ | `ALLOWED_GOOGLE_EMAILS`。拒否時は users を作らず Supabase セッションも破棄（#27） |
| パスキー登録 → 2回目以降顔認証ログイン | 🚫 | Supabase Auth 移行に伴い廃止（#27） |
| Signaly ログイン通知（新規登録・既存ログイン共通） | ✅ | `/auth/callback` → `SIGNALY_LOGIN_WEBHOOK_URL`（Discord から移行済み） |
| 未ログイン時の認証ガード | ✅ | `src/proxy.ts`（Next.js 16 で `middleware.ts` から改称） |

### ② 給油・燃費可視化 & ガソリンスタンド検索

| 要件 | 状態 |
|------|------|
| 給油入力フォーム | ✅ | `/fuel/new` 入力・登録後確認画面・一覧・編集・削除・まとめて削除・登録済み店舗クイック選択・入力時の燃費自動計算表示 |
| 登録店舗管理（設定画面） | ✅ | `registered-gas-station-settings.tsx`, `registered_gas_stations` テーブル |
| ダッシュボード（走行距離・燃費サマリー、燃費/単価/月別走行距離グラフ） | ✅ | `fuel-dashboard.tsx`, `FuelSummary`, `scrollable-trend-line-chart.tsx`, `monthly-distance-chart.tsx`, `fuel-price-trend-chart.tsx`, `fuel-efficiency-trend-chart.tsx` |
| 周辺ガソリンスタンド検索（Geolocation） | ✅ | `gas-station-map-picker.tsx`, `/api/gas-stations`（半径3km検索・近い順10件表示・中心地点の手動店舗登録・地図折りたたみ） |
| 登録済み店舗の現在地からの距離表示 | ✅ | `registered-gas-station-picker.tsx`, `/api/registered-gas-stations/nearby`（保存座標または OSM 座標から距離計算） |
| Zaim（家計簿）へ給油を支出として自動登録 | ✅ | `src/lib/zaim/`, `/api/zaim/connect`・`/api/zaim/callback`, `zaim-connection-settings.tsx`。OAuth 1.0a を利用者ごとに保持し、登録先（カテゴリ・ジャンル・支払元）を設定画面で選ぶ。履歴からの手動登録・二重登録防止つき（#26） |

### ③ メンテナンス記録 & カテゴリ動的管理

| 要件 | 状態 |
|------|------|
| カテゴリ CRUD（設定画面） | ✅ | `maintenance-category-settings.tsx`, `maintenance-categories.ts` |
| メンテナンス記録入力（カテゴリ dropdown） | ✅ | `/maintenance/new`, `maintenance-form.tsx`, 一覧・編集・削除・まとめて削除 |
| メンテナンス費用 0 円登録（同時作業の記録用） | ✅ | `MIN_MAINTENANCE_COST = 0`, フォーム・Server Action バリデーション |
| 整備履歴のカテゴリフィルター | ✅ | `maintenance-list.tsx`（カテゴリタップで絞り込み） |
| カテゴリ色の統一（グラフ凡例・整備履歴） | ✅ | `maintenance-category-colors.ts` |

### ④ 車両管理

| 要件 | 状態 | 備考 |
|------|------|------|
| 車両登録（名前・メーカー・車種名・型式ほか） | ✅ | `/vehicles` フォーム |
| 車両一覧・編集・削除 | ✅ | `vehicle-list.tsx`, Server Actions |
| 使用中車両の切り替え（`isActive`） | ✅ | 1台のみアクティブ |

### ⑤ スマートフォン PWA 対応

| 要件 | 状態 | 備考 |
|------|------|------|
| `manifest.json`（standalone, theme） | ✅ | `public/manifest.json` |
| Service Worker | ✅ | `scripts/sw.template.js` → ビルド時 `public/sw.js`（`package.json` version でキャッシュ名）。更新検知・自動リロード (`service-worker-register.tsx`)。**開発中は登録しない** |
| モバイルファースト UI | ✅ | `app-bottom-nav.tsx`, `app-page.tsx`, `globals.css`（44px タップ・safe-area）, 全 `(app)` ページ |

---

## 4. 開発・運用フロー、インフラ

### ⑥ Git & GitHub / CI/CD

| 要件 | 状態 | 備考 |
|------|------|------|
| Git ユーザー名 `Cursor AI` | ⚠️ | 機能コミットは `Cursor AI`。Initial commit は別作者 |
| `develop` で開発 → `main` で安定版 | ✅ | `develop` push 済み (`origin/develop`) |
| `main` マージ時 GitHub Actions デプロイ | ⚠️ | workflow 実装済み。1Password / VPS 設定後に `main` push で検証 |
| `main` マージ時 Git tag / GitHub Release | ⚠️ | `package.json` version から `v*` タグ自動作成 + Release（Portfolio 同様） |
| CI Signaly 通知 | ✅ | `.github/workflows/ci.yml`（失敗時 + `main` 向け PR のみ、Discord から Signaly へ移行済み） |

デプロイ手順（workflow）: tag → build → deploy →（成功時のみ）release。build で `npm run build:ci` → tar 転送 → VPS で `.env` 同期 → `prisma migrate deploy` → `pm2 reload`

### ⑦ 1Password & 機密情報

| 要件 | 状態 | 備考 |
|------|------|------|
| 秘密情報をリポジトリに含めない | ✅ | `.gitignore`, `.env.example` |
| ローカル開発は 1Password 不要 | ✅ | `.env.local`（DB・Supabase・通知）、`scripts/with-local-env.sh`（#21 で移行） |
| 開発 DB | ✅ | `127.0.0.1:3306` 固定。`npm run db:setup`（`.env.local` の DB_USER/PASSWORD/NAME で作成） |
| 開発環境から本番 DB 確認（1Password 使用） | ✅ | `DB_TARGET=production`, `.env.op`, `scripts/with-op-prod-db.sh`, `scripts/prod-db-tunnel.sh` |
| 本番 Secrets → GitHub Actions / pm2 | ⚠️ | `.github/deploy.env.tpl` 定義済み。1Password 登録・`OP_SERVICE_ACCOUNT_TOKEN` 要設定 |

### 環境変数（`.env.local` / ローカル開発、1Password 不要）

| 変数 | 用途 | 備考 |
|------|------|------|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | ローカル DB 認証 | 値は自由。`npm run db:setup` でユーザー・DB 作成 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Auth（開発用プロジェクト） | 本番用とは別プロジェクト（#27）。`service_role` キーは使わない |
| `ALLOWED_GOOGLE_EMAILS` | ログインを許可する Google アカウント | カンマ区切り。**未設定だと誰もログインできない**（#27） |
| `SIGNALY_LOGIN_WEBHOOK_URL` | 通知（新規登録・ログイン共通） | 任意。未設定なら通知をスキップ |
| `ZAIM_CONSUMER_KEY` / `ZAIM_CONSUMER_SECRET` | Zaim API の OAuth 1.0a 鍵 | https://dev.zaim.net で発行。未設定なら「Zaim連携」を出さない（#26） |
| `ZAIM_TOKEN_ENCRYPTION_KEY` | Zaim アクセストークンの暗号化鍵 | 16文字以上。**変更すると連携し直しになる**（#26） |
| `ZAIM_ALLOWED_EMAILS` | Zaim 連携を使ってよい Google アカウント | カンマ区切り。**未設定なら誰も使えない**（#26） |

### 環境変数（1Password `apps/Car` / 本番）

| 変数 | 用途 |
|------|------|
| `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT` | DB 認証・接続先（ローカルから本番 DB 確認する場合は `.env.op` も使用） |
| `SSH_HOST`, `SSH_USER`, `SSH_PORT` | 本番 DB SSH トンネル |
| `ALLOWED_GOOGLE_EMAILS` (`allowed-google-emails`) | ログインを許可する Google アカウント（#27） |
| `AUTH_URL` | 公開 URL（アプリからは参照しない。Supabase の Redirect URLs 登録・Apache VirtualHost 生成で使う） |
| `SIGNALY_LOGIN_WEBHOOK_URL` | 通知（新規登録・ログイン共通）。全アプリ共通のため organization secret から渡る（値の正は `op://apps/Notify/login-webhook-url`） |
| `TARGET_DIR` (`target-dir`) | VPS デプロイ先パス |
| `PORT` (`port`) | 待受ポート |
| `ZAIM_CONSUMER_KEY` (`zaim-consumer-key`) / `ZAIM_CONSUMER_SECRET` (`zaim-consumer-secret`) | Zaim API の OAuth 1.0a 鍵（#26） |
| `ZAIM_TOKEN_ENCRYPTION_KEY` (`zaim-token-encryption-key`) | Zaim アクセストークンの暗号化鍵（#26） |
| `ZAIM_ALLOWED_EMAILS` (`zaim-allowed-emails`) | Zaim 連携を使ってよい Google アカウント（#26） |
| `OP_SERVICE_ACCOUNT_TOKEN` | GitHub Actions → 1Password |

---

## 5. ファーストプロンプト優先項目

| # | 項目 | 状態 |
|---|------|------|
| 1 | PWA `manifest.json` 雛形 | ✅ |
| 2 | Prisma スキーマ（MySQL + Supabase ユーザー紐付け） | ✅ |
| 3 | Webhook 通知基盤（Signaly） | ✅ |
| 4 | `ecosystem.config.js` | ✅ |
| — | `develop` ブランチで開発 | ✅ |

---

## 主要ファイル索引（Agent 用）

```
認証:     src/proxy.ts, src/lib/supabase/, src/lib/auth-user.ts, src/lib/allowed-users.ts, src/lib/auth-header.ts, src/lib/request-origin.ts, src/app/auth/, src/app/login/
車両:     src/app/vehicles/, src/components/vehicle-form.tsx, src/components/vehicle-list.tsx, src/lib/vehicles.ts
給油:     src/app/(app)/fuel/, src/components/fuel-*.tsx, src/lib/fuel-*.ts, src/app/api/gas-stations/route.ts
メンテ:   src/app/(app)/maintenance/, src/components/maintenance-*.tsx, src/lib/maintenance-*.ts
Zaim:     src/lib/zaim/, src/app/api/zaim/, src/app/(app)/settings/zaim-actions.ts, src/components/zaim-connection-settings.tsx, scripts/zaim-oauth-check.ts
Signaly:  src/lib/signaly.ts
DB:       prisma/schema.prisma, src/lib/prisma.ts, src/lib/database-url.ts
ローカル環境: .env.local.example, scripts/with-local-env.sh, scripts/setup-db.sh（1Password 不要）
1Password（本番 DB 確認用）: .env.op.example, scripts/with-op-env.sh, scripts/with-op-prod-db.sh, scripts/prod-db-tunnel.sh
PWA:      public/manifest.json, public/sw.js, src/components/app-bottom-nav.tsx, src/components/app-page.tsx
DevOps:   ecosystem.config.js, .github/workflows/ci.yml, .github/workflows/deploy.yml, .github/workflows/release.yml, .github/deploy.env.tpl, .github/ci.env.tpl, scripts/construct-database-url.sh, scripts/vps-bootstrap.sh
進捗正本: docs/SPEC_PROGRESS.md  ← このファイル
```

## npm スクリプト（開発）

| コマンド | 用途 |
|----------|------|
| `npm run dev` | 開発サーバー（`.env.local`、1Password 不要） |
| `npm run db:setup` | ローカル MySQL に DB/ユーザー作成 |
| `npm run db:migrate` | マイグレーション適用 (`migrate deploy`) |
| `npm run db:migrate:dev` | 新規マイグレーション作成 (`migrate dev`) |
| `npm run db:check` | DB 接続確認 |
| `npm run db:check:prod` | 本番 DB 接続確認（直結） |
| `npm run db:studio:prod` | Prisma Studio（本番 DB） |
| `npm run db:tunnel:prod` | SSH トンネル（VPS MySQL が localhost 待受の場合） |
| `npm run db:studio:prod:tunnel` | Prisma Studio（トンネル経由） |
| `npm run dev:prod-db` | 開発サーバー + 本番 DB |

---

## 次の推奨タスク（優先順）

1. **本番デプロイ初回設定**（1Password `apps/Car` 登録、VPS `scripts/vps-bootstrap.sh`、`main` マージ）

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-08-25 | ログイン通知の送信先を全アプリ共通の1チャンネルへ変更。Webhook URL を organization secret `SIGNALY_LOGIN_WEBHOOK_URL` から受け取る形にし（環境変数を `SIGNALY_WEBHOOK_LOGIN_URL` から改名）、通知のペイロードへ送信元を表す `source: "car-care"` を追加（#119） |
| 2026-08-19 | 給油記録を家計簿アプリ Zaim の支出として自動登録できるようにした。Zaim API（OAuth 1.0a）の連携情報を `zaim_connections` にユーザーごとに保持し、アクセストークンは `ZAIM_TOKEN_ENCRYPTION_KEY` で暗号化して保存。`ZAIM_ALLOWED_EMAILS` に載せたアカウントにだけ機能を出す。給油履歴からの手動登録と、`fuel_logs.zaim_money_id` による二重登録防止つき（#26） |
| 2026-08-17 | ログインを NextAuth（Auth.js）から Supabase Auth の Google 認証へ移行。`users.supabase_user_id` を追加し既存ユーザーをメールアドレスで紐付け。`ALLOWED_GOOGLE_EMAILS` による許可ユーザー判定を追加。パスキー（WebAuthn）ログインを廃止。`middleware.ts` を `proxy.ts` へ改称（#27） |
| 2026-07-07 | ローカル開発を 1Password 不要に変更。DB・AUTH_SECRET・Signaly ログイン通知も `.env.local` で管理し、`scripts/with-local-env.sh` を新設（本番 DB 確認は引き続き `.env.op` / 1Password を使用）（#21） |
| 2026-07-07 | Google OAuth を本番・開発で別クライアントに分離。開発用 Client ID/Secret は 1Password ではなく `.env.local`（`.env.local.example` 追加）で管理（#21） |
| 2026-07-07 | Google ログインのみのため許可メールアドレス制限（`ALLOWED_EMAIL`）を廃止 |
| 2026-07-07 | 新規登録・ログイン通知を1つの Signaly ログイン通知に統合（`notifySignalySignup` を削除し `events.signIn` に一本化） |
| 2026-07-07 | アプリ名称を Car Maintenance → Car Care に変更（README / manifest / UI 表記） |
| 2026-07-07 | 新規登録・ログイン通知を Discord から Signaly へ移行（`src/lib/discord.ts` → `src/lib/signaly.ts`、`SIGNALY_WEBHOOK_LOGIN_URL`） |
| 2026-07-07 | 1Password 参照を `apps` ボールト「Car」アイテムに統一（`.env.op.example` 等の `Private/Car Maintenance` 表記を修正） |
| 2026-07-07 | 不要になった `.cursor/rules`（Cursor 向けシンボリックリンク）を削除（AI エディタは Claude Code に統一済み） |
| 2026-06-25 | メンテナンスのカテゴリ色をグラフ凡例と整備履歴で統一 |
| 2026-06-25 | 整備履歴にカテゴリフィルターを追加（タップで絞り込み・再タップで全件表示） |
| 2026-06-25 | メンテナンス費用の 0 円登録を許可（車検などと同時作業の記録用） |
| 2026-06-24 | デプロイ workflow: `deploy` 成功後のみ GitHub Release 作成（失敗時は Release しない） |
| 2026-06-24 | CI Discord 通知（失敗時 + `main` 向け PR のみ、MyRoom / Asset Manager 同様） |
| 2026-06-23 | v1.2.1: CI/build 修正（lint・TypeScript）、本番デプロイ時のマイグレーションドリフト自動解消 |
| 2026-06-23 | v1.2.0: ホームダッシュボード、メンテナンス記録 UI・カテゴリ管理、給油グラフ再構成（燃費・単価・月別走行距離）、給油フォーム UX 改善、パスキー再設定、登録店舗地図編集、本番 DB 開発接続、次回メンテ予定・走行距離グラフ |
| 2026-06-23 | 走行距離グラフに表示年の切替を追加（1〜12月＋前年比較折れ線） |
| 2026-06-23 | ホームダッシュボード（メンテアラート/ようこそ切替、給油・メンテ入力リンク、今月・先月の維持費表示） |
| 2026-06-23 | 登録店舗編集の地図 UX（手動店舗の座標保存、移動後の周辺検索・読込表示、マーカー整理、表示名省略） |
| 2026-06-23 | 給油の単価グラフを全体表示のみに変更（店舗別切替を廃止） |
| 2026-06-23 | 給油グラフを再構成（燃費・単価は1年表示+横スクロール折れ線、走行距離は月別棒+昨年折れ線、月別給油費を廃止） |
| 2026-06-23 | メンテナンス記録 UI（入力・一覧・編集・削除・まとめて削除）と設定画面のカテゴリ CRUD（初期シード: 洗車・オイル交換・タイヤ交換・車検） |
| 2026-06-23 | 給油記録 UX 改善（登録後確認画面のコンパクト化、登録済み店舗の距離順リスト・100m強調、地図は「地図から選択」で表示、中心地点の手動店舗登録、半径1km全件検索） |
| 2026-06-22 | v1.1.0: 給油ダッシュボード強化（燃費・単価の折れ線グラフ、月別給油費の展開表示、走行距離サマリー）、入力時燃費表示、周辺スタンド検索改善 |
| 2026-06-23 | 給油情報サマリーを統合（走行距離2項目・燃費2項目を各1カードにまとめて表示、累計給油費カードを削除） |
| 2026-06-23 | 設定画面 UX 改善（セクション折りたたみ、非表示店舗の表示切替、登録店舗の地図位置更新、アプリ情報をパスキー下へ） |
| 2026-06-23 | 設定画面 UX 改善（項目タップで編集展開、ブランド追加を一覧下へ、登録店舗の並び替え） |
| 2026-06-23 | パスキー登録・再設定時の Discord ログイン通知を抑制（`linkAccount` で登録フローを判別） |
| 2026-06-23 | 設定画面でパスキーの登録・再設定（既存パスキー削除後に再登録、`passkey-settings.tsx`） |
| 2026-06-22 | 燃費の推移グラフを単価推移と同じ折れ線グラフ（月日×燃費）に統一（`TrendLineChart` 共通化） |
| 2026-06-22 | 周辺ガソリンスタンド検索の精度改善（Overpass 件数上限除去・距離順ソート・`shop=fuel` / relation 対応） |
| 2026-06-22 | 単価推移グラフを月日（横軸）× 単価（縦軸）に改善し、店舗ごとの切替を追加 |
| 2026-06-22 | 給油履歴の走行距離表示を総走行距離から登録以降の累計走行距離に変更 |
| 2026-06-22 | 給油情報画面に総走行距離・登録以降の走行距離を表示（`FuelMileageSummary`） |
| 2026-06-22 | 給油入力フォームに燃費の自動計算表示（距離・給油量・満タンからリアルタイム算出） |
| 2026-06-22 | v1.0.1: 本番パスキーログイン修正（`authenticators.credential_id` に unique 追加）、デプロイ `.env` クォート・DB ヘルスチェック |
| 2026-06-21 | 設定画面に登録店舗管理（編集・削除・登録画面への非表示、`registered_gas_stations`） |
| 2026-06-21 | 給油フォームに登録済み店舗クイック選択（`registered-gas-station-picker.tsx`） |
| 2026-06-21 | 給油記録のまとめて削除（選択モード・`deleteFuelLogsAction`） |
| 2026-06-21 | 削除確認をアプリ内 UI に統一（`delete-confirm-panel.tsx`、給油・ブランド設定） |
| 2026-06-21 | 開発環境から本番 DB 確認（`db:*:prod`、SSH トンネル、`DB_TARGET=production`） |
| 2026-06-21 | モバイルファースト UI（ボトムナビ・AppPage・safe-area・44px タップ領域・inputMode） |
| 2026-06-21 | Git tag / GitHub Release workflow 追加（Portfolio 同様、`release.yml` 含む） |
| 2026-06-21 | GitHub Actions デプロイ環境（build/deploy workflow、1Password 参照、VPS bootstrap） |
| 2026-06-21 | 給油記録（入力・一覧・燃費ダッシュボード・周辺スタンド検索 `/fuel`） |
| 2026-06-21 | 車両詳細項目追加（車種名・型式・燃料種別・車検満了日・任意項目） |
| 2026-06-21 | 車両 CRUD（登録・一覧・編集・削除、`/vehicles`） |
| 2026-06-21 | Passkey 初回登録導線・顔認証ログイン実装 |
| 2026-06-21 | 初版作成（基盤実装完了時点の進捗） |
