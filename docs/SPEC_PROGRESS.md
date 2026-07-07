# 仕様書 実装進捗（Car Care）

> **他 Agent 向け:** 本ファイルが仕様書（Discord通知機能追加版）に対する実装状況の正本です。  
> 機能追加・デプロイ完了時は **必ず本ファイルを更新** してください。  
> **最終更新:** 2026-07-07

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
| 認証・Signaly・ミドルウェア | ✅ |
| DB スキーマ（Prisma） | ✅ |
| 1Password 開発環境 | ✅ |
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
| NextAuth (Auth.js) | ✅ | `src/auth.ts`, `src/auth.config.ts` |
| Google OAuth | ✅ | `src/auth.ts` |
| WebAuthn / Passkey | ✅ | Provider + ログイン (`next-auth/webauthn`) + ホーム初回登録 (`passkey-register-card.tsx`) + 設定画面の登録・再設定 (`passkey-settings.tsx`) |
| Signaly Webhook（ログイン通知） | ✅ | `src/lib/signaly.ts`, `src/auth.ts` events |
| PWA | ⚠️ | `public/manifest.json`, `public/sw.js`, `public/icons/`, `app-bottom-nav.tsx`, `app-page.tsx` |
| pm2 | ✅ | `ecosystem.config.js`（本番 PORT 3104 既定） |
| GitHub Actions → VPS SSH デプロイ | ⚠️ | `.github/workflows/deploy.yml`（**1Password・VPS 初回設定後に検証**） |

### 2.2 データモデル

| テーブル | Prisma | マイグレーション | API/UI |
|----------|--------|------------------|--------|
| `users` | ✅ | ✅ `20250621000000_init` | 認証のみ |
| `accounts` | ✅ | ✅ | 認証のみ |
| `sessions` | ✅ | ✅ | 認証のみ |
| `verification_tokens` | ✅ | ✅ | 認証のみ |
| `authenticators` | ✅ | ✅ | Passkey 登録・ログイン |
| `vehicles` | ✅ | ✅ | ✅ CRUD (`/vehicles`) |
| `maintenance_categories` | ✅ | ✅ | ✅ 設定画面 CRUD |
| `maintenance_logs` | ✅ | ✅ | ✅ CRUD + 一覧 (`/maintenance`) |
| `fuel_logs` | ✅ | ✅ | ✅ CRUD + ダッシュボード (`/fuel`) |
| `gas_station_brands` | ✅ | ✅ | ✅ 設定画面 CRUD |
| `registered_gas_stations` | ✅ | ✅ `20250621260000` | ✅ 設定画面 CRUD・給油フォーム連携 |

---

## 3. 機能要件

### ① 認証 & Signaly 通知

| 要件 | 状態 | 備考 |
|------|------|------|
| Google ログイン | ✅ | |
| パスキー登録 → 2回目以降顔認証ログイン | ✅ | Google 初回ログイン後ホームで登録、設定画面で再設定、2回目以降 `next-auth/webauthn` でログイン |
| Signaly ログイン通知（新規登録・既存ログイン共通） | ✅ | `events.signIn` → `SIGNALY_WEBHOOK_LOGIN_URL`（Discord から移行済み） |
| 未ログイン時 middleware ガード | ✅ | `src/middleware.ts` |

### ② 給油・燃費可視化 & ガソリンスタンド検索

| 要件 | 状態 |
|------|------|
| 給油入力フォーム | ✅ | `/fuel/new` 入力・登録後確認画面・一覧・編集・削除・まとめて削除・登録済み店舗クイック選択・入力時の燃費自動計算表示 |
| 登録店舗管理（設定画面） | ✅ | `registered-gas-station-settings.tsx`, `registered_gas_stations` テーブル |
| ダッシュボード（走行距離・燃費サマリー、燃費/単価/月別走行距離グラフ） | ✅ | `fuel-dashboard.tsx`, `FuelSummary`, `scrollable-trend-line-chart.tsx`, `monthly-distance-chart.tsx`, `fuel-price-trend-chart.tsx`, `fuel-efficiency-trend-chart.tsx` |
| 周辺ガソリンスタンド検索（Geolocation） | ✅ | `gas-station-map-picker.tsx`, `/api/gas-stations`（半径3km検索・近い順10件表示・中心地点の手動店舗登録・地図折りたたみ） |
| 登録済み店舗の現在地からの距離表示 | ✅ | `registered-gas-station-picker.tsx`, `/api/registered-gas-stations/nearby`（保存座標または OSM 座標から距離計算） |

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
| 1Password CLI 開発注入 | ✅ | `.env.op`, `scripts/with-op-env.sh` |
| 開発 DB | ✅ | `127.0.0.1:3306` 固定。`npm run db:setup` |
| 開発環境から本番 DB 確認 | ✅ | `DB_TARGET=production`, `scripts/with-op-prod-db.sh`, `scripts/prod-db-tunnel.sh` |
| 本番 Secrets → GitHub Actions / pm2 | ⚠️ | `.github/deploy.env.tpl` 定義済み。1Password 登録・`OP_SERVICE_ACCOUNT_TOKEN` 要設定 |

### 環境変数（1Password / 本番）

| 変数 | 用途 | 開発 | 本番 |
|------|------|------|------|
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | DB 認証 | ✅ | 要設定 |
| `DB_HOST`, `DB_PORT` | 本番 DB | —（`db:*:prod` で使用） | 要設定 |
| `SSH_HOST`, `SSH_USER`, `SSH_PORT` | 本番 DB SSH トンネル | 任意 | — |
| `AUTH_SECRET` | NextAuth | ✅ | 要設定 |
| `AUTH_URL` / `AUTH_URL_DEV` | 公開 URL | ✅ | 要設定 |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth | ✅ | 要設定 |
| `SIGNALY_WEBHOOK_LOGIN_URL` | 通知（新規登録・ログイン共通） | ✅ | 要設定 |
| `TARGET_DIR` (`target-dir`) | VPS デプロイ先パス | — | 1Password `apps/Car` |
| `PORT` (`port`) | 待受ポート | — | 1Password `apps/Car` |
| `OP_SERVICE_ACCOUNT_TOKEN` | GitHub Actions → 1Password | — | 要設定 |

---

## 5. ファーストプロンプト優先項目

| # | 項目 | 状態 |
|---|------|------|
| 1 | PWA `manifest.json` 雛形 | ✅ |
| 2 | Prisma スキーマ（MySQL + NextAuth + WebAuthn） | ✅ |
| 3 | Webhook 通知基盤（Signaly） | ✅ |
| 4 | `ecosystem.config.js` | ✅ |
| — | `develop` ブランチで開発 | ✅ |

---

## 主要ファイル索引（Agent 用）

```
認証:     src/auth.ts, src/auth.config.ts, src/middleware.ts, src/app/login/, src/components/passkey-register-card.tsx, src/components/passkey-settings.tsx, src/lib/passkey.ts
車両:     src/app/vehicles/, src/components/vehicle-form.tsx, src/components/vehicle-list.tsx, src/lib/vehicles.ts
給油:     src/app/(app)/fuel/, src/components/fuel-*.tsx, src/lib/fuel-*.ts, src/app/api/gas-stations/route.ts
メンテ:   src/app/(app)/maintenance/, src/components/maintenance-*.tsx, src/lib/maintenance-*.ts
Signaly:  src/lib/signaly.ts
DB:       prisma/schema.prisma, src/lib/prisma.ts, src/lib/database-url.ts
1Password: .env.op.example, scripts/with-op-env.sh, scripts/with-op-prod-db.sh, scripts/prod-db-tunnel.sh, scripts/setup-db.sh
PWA:      public/manifest.json, public/sw.js, src/components/app-bottom-nav.tsx, src/components/app-page.tsx
DevOps:   ecosystem.config.js, .github/workflows/ci.yml, .github/workflows/deploy.yml, .github/workflows/release.yml, .github/deploy.env.tpl, .github/ci.env.tpl, scripts/construct-database-url.sh, scripts/vps-bootstrap.sh
進捗正本: docs/SPEC_PROGRESS.md  ← このファイル
```

## npm スクリプト（開発）

| コマンド | 用途 |
|----------|------|
| `npm run dev` | 開発サーバー（1Password 経由） |
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
