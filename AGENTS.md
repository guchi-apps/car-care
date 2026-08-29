<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Car Care — Agent 向けガイド

## 仕様書・進捗

**実装進捗の正本:** [`docs/SPEC_PROGRESS.md`](./docs/SPEC_PROGRESS.md)

仕様書（Discord通知機能追加版）に対する完了/未了の一覧、主要ファイル索引、次タスクは上記を参照すること。  
機能実装・デプロイ完了時は **必ず `docs/SPEC_PROGRESS.md` を更新** すること。

## ブランチ

- 機能開発: `develop`
- 安定版 / 本番デプロイ: `main`（マージ時に GitHub Actions が VPS へデプロイ）

## 開発起動

初回のみ `.env.local` を用意する（1Password 不要。`.env.local.example` 参照）:

```bash
cp .env.local.example .env.local
# DB_NAME / DB_USER / DB_PASSWORD と、開発用 Supabase の URL・publishable key、ALLOWED_GOOGLE_EMAILS を設定
npm run db:setup && npm run db:migrate
```

```bash
npm run dev
```

WSL2 では `npm run dev` 起動時に Windows 側のポート転送（3000）を自動更新し、LAN の URL を表示する。表示された `Phone: http://…` をスマホのブラウザで開く（PC と同一 Wi-Fi）。WSL 再起動後の初回は UAC（管理者承認）が求められることがある。

手動でポート転送を設定する場合（管理者 PowerShell）:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/wsl-port-forward.ps1
```

- Google ログイン: 開発用 Supabase プロジェクト（本番とは別。`.env.local` で管理）の Redirect URLs に `http://<LAN-IP>.sslip.io:3000/auth/callback` を追加（生 IP は Google が拒否する）

環境変数はローカル開発では `.env.local`（1Password 不要）。1Password（`.env.op`）は本番デプロイ・本番 DB 確認にのみ使用する。詳細は `.env.example` を参照。

## 本番 DB のデータ確認（開発環境）

通常はローカル MySQL（`127.0.0.1:3306`）を使用。本番データの確認が必要なとき:

```bash
op signin
npm run db:check:prod        # 接続確認
npm run db:studio:prod       # Prisma Studio
npm run dev:prod-db          # 開発サーバー（閲覧のみ推奨）
```

VPS の MySQL が localhost のみ待受の場合は SSH トンネルを使用:

```bash
# ターミナル 1
npm run db:tunnel:prod

# ターミナル 2
npm run db:studio:prod:tunnel
# または
npm run dev:prod-db:tunnel
```

`.env.op` に `SSH_HOST` / `SSH_USER` / `SSH_PORT` を登録すること。`prisma migrate dev` は本番 DB ではブロックされる。

<!-- BEGIN:multi-agent-rules -->
## 認証（Supabase Auth）

ログインは複数アプリで共有している Supabase プロジェクトの Google 認証で行う（#27）。
このリポジトリに NextAuth（Auth.js）・パスキー（WebAuthn）は**もう無い**。

| 役割 | ファイル |
|---|---|
| 全リクエストのセッション検証・認証ガード | `src/proxy.ts` → `src/lib/supabase/proxy-session.ts` |
| ログイン開始 / コールバック / ログアウト | `src/app/auth/{signin,callback,signout}/route.ts` |
| ログイン中ユーザーの取得 | `src/lib/auth-user.ts`（`getCurrentUser()` / `requireUserId()`） |
| 許可 Google アカウント判定 | `src/lib/allowed-users.ts`（`ALLOWED_GOOGLE_EMAILS`） |

触るときに引っかかりやすい点:

- **ページ・Server Action から `supabase.auth.getUser()` を呼び直さない。** `getUser()` は毎回
  Supabase へ HTTP 往復する。検証は `proxy.ts` が済ませ、結果を `x-car-care-supabase-user-id`
  ヘッダーで後段へ渡している。`proxy.ts` は matcher に一致する全リクエストでこのヘッダーを
  必ず上書き・削除するため、クライアントが同名ヘッダーを詐称しても後段には届かない
- **`middleware.ts` ではなく `proxy.ts`。** Next.js 16 で `middleware` は deprecated になり
  `proxy` へ改称された（`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`）。
  `proxy` は nodejs ランタイム固定で、edge は使えない
- **ログイン・ログアウトは素のリンク / フォーム POST にする。** `onClick` で `signInWithOAuth` を
  呼ぶとハイドレーション完了までボタンが効かない
- **`NEXT_PUBLIC_*` はビルド時にバンドルへ埋め込まれる。** `deploy.yml` の `deploy` ジョブだけでなく
  `build` ジョブの env にも必要で、CI（`ci.yml`）にもダミー値が要る。値が無いとビルドが通らない
- **`users.id` は Supabase の UUID ではない。** 車両・給油・メンテの外部キーが cuid の `users.id` を
  指しているため差し替えられない。Supabase のユーザー ID は `users.supabase_user_id` に持ち、
  移行前から居るユーザーは初回ログイン時にメールアドレスで紐付ける（`src/app/auth/callback/route.ts`）
- **リダイレクト先の origin は Host ヘッダーから組む**（`src/lib/request-origin.ts`）。
  `request.url` は 0.0.0.0 待受や sslip.io 経由で実際のホスト名を反映しないことがある

`accounts` / `sessions` / `verification_tokens` / `authenticators` と `users.email_verified` は
旧 NextAuth の残骸で、現在は誰も読み書きしていない（切り戻し余地を残すため残置。DROP は別 Issue）。

## アイコンと起動画面（#132）

アプリアイコンの原本は `scripts/icon.template.svg` の 1 ファイルで、`public/icons/*.svg` と
`*.png`・`src/app/favicon.ico` は `npm run generate:icons` が書き出す（`generate-sw.mjs` と
`sw.template.js` の関係と同じ）。書き出した結果はコミットする。**ビルドでは実行しない**ので、
CI に `rsvg-convert` / `convert` は要らない。

| 役割 | ファイル |
|---|---|
| アイコンの原本（ここだけを編集する） | `scripts/icon.template.svg` |
| 書き出し | `scripts/generate-icons.sh`（`npm run generate:icons`） |
| 画面で使う同じ絵柄 | `src/components/app-mark.tsx` |
| PWA 起動中のローディング画面 | `src/components/app-splash.tsx`, `src/app/globals.css` |

触るときに引っかかりやすい点:

- **アイコンの PNG は差し替えるときにファイル名も変える。** `public/sw.js` は PNG を
  cache-first で持つ（`isStaticAsset`）。キャッシュ名は `package.json` の version から作るため、
  バージョンを上げずにデプロイすると、同じ URL のままでは古いアイコンが表示され続ける。
  `icon-192-v2.png` のように名前を変えれば確実に切り替わる
- **`app-mark.tsx` は `icon.template.svg` の写し。** 片方だけ直すとアイコンと画面がずれる。
  グラデーションの `id` は 1 ページに 2 つ置いても衝突しないよう `idPrefix` で分ける
  （`useId` はサーバーコンポーネントで使えない）
- **起動画面の表示・非表示は CSS で決めている。** `@media (display-mode: standalone)` のときだけ
  表示し、ハイドレーション後に `<html data-app-ready>` が立つと消える。
  **JS が動かなかった場合に備えて `animation: … 8s forwards` の保険を必ず残すこと。**
  これが無いと、起動画面が残ったままアプリを操作できなくなる
- **Tailwind v4 で `h-6.5` のような値は生成されない**（`.5` 刻みは一部だけ）。クラス名を書き
  間違えてもビルドは通り、CSS が出ないだけで無言で崩れる。新しい値を使ったら
  `curl` で `/_next/static/chunks/*.css` を取って、その宣言が出ているかを確かめるのが速い

## Zaim 連携（#26）

給油記録を家計簿アプリ Zaim の支出として登録する。**Zaim の公式 API（OAuth 1.0a・HMAC-SHA1）を直接叩く。**
asset-manager / aide が Zaim に対して Playwright を使っているのは「残高の読み取り」で、こちらは書き込み
なので同じ方式にする必要はない（VPS は 2GB しかなく、リクエスト中に Chromium を起動できない）。

| 役割 | ファイル |
|---|---|
| 鍵と許可メールの判定 | `src/lib/zaim/config.ts` |
| OAuth 1.0a の署名 | `src/lib/zaim/oauth.ts` |
| アクセストークンの暗号化 | `src/lib/zaim/secret-box.ts` |
| API 呼び出し | `src/lib/zaim/client.ts` |
| 連携情報のユーザー単位の読み書き | `src/lib/zaim/connection.ts` |
| 給油記録 → 支出の登録 | `src/lib/zaim/fuel-sync.ts` |
| 連携の開始・コールバック | `src/app/api/zaim/{connect,callback}/route.ts` |

触るときに引っかかりやすい点:

- **署名を変えたら `npx tsx scripts/zaim-oauth-check.ts` を通す。** OAuth 1.0a は間違えても
  「401 が返る」以上のことが分からず、鍵の無い環境では切り分けられない。既知のテストベクタで
  署名だけを検算できるようにしてある
- **POST のボディは署名した文字列と 1 バイトも変えてはいけない。** `URLSearchParams` で組み直すと
  空白が `+` になり署名が合わなくなる（OAuth の仕様では `%20`）
- **`ZAIM_*` が 4 つ揃っていない環境では連携 UI を出さない。** 未設定でも画面が壊れないようにするため。
  判定は `isZaimAvailableFor(email)` の 1 か所に寄せてある
- **Zaim が落ちても給油記録の保存は成功させる。** `registerFuelLogToZaim()` は例外を投げず status を返す。
  家計簿の都合で車の記録を落とさない
- **二重登録は `fuel_logs.zaim_money_id` の有無で防ぐ。** 給油記録の編集・削除は Zaim 側へ反映しない
  （現時点では意図的にスコープ外）
- **`ZAIM_TOKEN_ENCRYPTION_KEY` を変えると保存済みトークンを復号できない。** 全員が連携し直しになる

## 本番デプロイとDBユーザー

本番の共有 MariaDB では、アプリのランタイムが使う通常ユーザー（`SHARED_DB_USER`）に `ALTER` 権限が
無い。DDL を伴う処理はマイグレーション専用ユーザー（`SHARED_DB_MIGRATE_USER` /
`SHARED_DB_MIGRATE_PASSWORD`。organization の Secrets で全アプリ共通）で実行する。

`.github/workflows/deploy.yml` の `deploy` ジョブで、専用ユーザーへ切り替えているのは次の2か所。

- `npx prisma migrate deploy`
- `node scripts/reconcile-migrations-deploy.mjs`（`scripts/migration-repairs.mjs` の `ALTER TABLE` を実行しうる）

触るときに引っかかりやすい点:

- **テーブル追加だけのマイグレーションは通常ユーザーでも通ってしまう。** 列を足す変更を入れて初めて
  `ALTER command denied`（MySQL 1142）で落ちるため、気付くのがデプロイ時になる（#91）
- **失敗した記録が `_prisma_migrations` に残ると、以降どのデプロイも同じ場所で止まる**（Prisma の
  P3018）。`reconcile-migrations-deploy.mjs` が未完了の記録をロールバック扱いにして復帰させている
- **`reconcile-migrations-deploy.mjs` は `import "dotenv/config"` を使う。** dotenv は既存の環境変数を
  上書きしないので、`deploy.yml` 側で `DB_USER=... node ...` と前置きすれば `.env`（通常ユーザー）より
  優先される。逆に `.env` を書き換えて切り替えようとしてはいけない（ランタイムの接続情報が変わる）
- **`MIGRATE_*` が未設定の環境では通常ユーザーへフォールバックする。** Secrets を持たない fork や
  検証用リポジトリでもデプロイ手順が壊れないようにするため

# マルチエージェント運用（GitHub Actions 無人実行）

`@claude` コメントを起点に、計画提示〜実装〜develop向けPR作成までを GitHub Actions 上で無人実行する。
ワークフローの実体は `guchi-apps/issue-deck` にあり、このリポジトリの `.github/workflows/` には
`uses:` で参照する薄い caller だけを置いている（`@workflows/v9`）。

**GitHub Actions 上での実行は、このリポジトリをチェックアウトしたワークツリーしか参照できない。**
したがって無人実行でも守られる必要があるルールは、このファイルに明文化しておく必要がある。

設計・運用の詳細は issue-deck 側を参照する。

- 進捗管理の設計: [progress-status-architecture.md](https://github.com/guchi-apps/issue-deck/blob/main/docs/progress-status-architecture.md)
- 無人実行の挙動: [multi-agent/dispatch.md](https://github.com/guchi-apps/issue-deck/blob/main/docs/multi-agent/dispatch.md)

## ブランチ命名（上の「ブランチ」節への追加）

Issue専用ブランチは `develop` から作成し、ブランチ名は **`issue-<Issue番号>`** とする（例: `issue-32`）。
ワークフローはブランチ名から対象Issueを特定するため、**この命名規約に従わないブランチはすべて対象外**になる。

デフォルトブランチは `develop` にしておく。`issues`・`issue_comment` イベントはデフォルトブランチの
ワークフローしか起動しないため、`main` にすると `@claude` コメントに反応しなくなる。

## Issueの進捗

**進捗は GitHub Projects の Status で管理する。進捗ラベルは存在しない**
（issue-deck#1010 / #991 Phase 5 で `01.wip`〜`09.main` を廃止した）。

1. `Ready` — 未着手
2. `Planning` — 計画検討中（`21.plan-required` 選択時のみ経由）
3. `Implementation` — 実装中
4. `Develop PR` — developへPR作成・マージ中
5. `Develop` — developへマージ完了（main未反映）
6. `Release` — mainへPR作成・マージ中
7. `Done` — mainへマージ完了。この時点でissueをcloseする

**`gh issue edit` で進捗を進めることはできない。** Status を書けるのは issue-deck だけで、
ワークフローは進捗報告API（`POST /api/progress`）へ報告する。ブランチのpush・PR作成・PRマージを
トリガーに自動で遷移するため、エージェントが自分で進捗を動かす必要はない。

## 条件を表すラベル（進捗とは別軸）

Status = 今どこにいるか、Label = どんな性質・条件があるか、という役割分担にしている。

| ラベル | 意味 |
|---|---|
| `00.check-user` | ユーザーの確認・指示が必要。どの段階でも併用する |
| `00.qa-answered` | 質問への回答のみ完了（`00.check-user` と常に併用） |
| `11.local` | ローカル（VSCode等）で対応中。付いている間は無人実行を起動しない |
| `21.plan-required` | 実装前に計画を提示し承認を得る |
| `22.merge-confirm-required` | 内容によらず、developへのマージ前に必ず `00.check-user` を付ける |
| `23.preview-required` | PR作成前に開発サーバーでの画面確認を必須にする |
| `24.screenshot-required` | PR作成前にスクリーンショット取得を必須にする |

## 検証コマンド

**このリポジトリには `test`・`typecheck` の npm script が無い。** CI（`.github/workflows/ci.yml`）も
`lint` と `build:ci` の2つだけを実行しており、`build:ci` の `next build` が型チェックを含むため
これで完結している。**存在しないコマンドを探さず、下記を使うこと。**

| 目的 | コマンド |
|---|---|
| Lint | `npm run lint` |
| ビルド（型チェックを含む） | `npm run build:ci` |

`npm run build`（`build:ci` ではない方）は `scripts/with-local-env.sh` を通すためローカル環境の
`.env` を要求する。**CI・無人実行では `build:ci` を使う。**

`next/headers` を使うサーバー専用モジュール（`src/lib/signaly.ts` など）は、開発サーバーを起動しなくても
tsx で単体実行して振る舞いを確かめられる。`next/headers` をスタブへ差し替える `paths` を書いた
tsconfig を作り、`npx tsx --tsconfig <その tsconfig> <検証スクリプト>` で読み込む
（送信先はローカルに立てた `node:http` のサーバーにして、実際のボディを目視する）。
Webhook の送信ボディのように「型は通るが値が違う」類の変更は、これが最も軽い確認手段になる（#119）。

## 自動マージ不可カテゴリ

以下に該当する変更は自動マージせず `00.check-user` を付与してユーザーの確認を待つ。

- 認証・認可
- DBスキーマ変更・マイグレーション（`prisma/migrations/**`）
- 本番環境の設定
- GitHub Actionsやデプロイ設定（`.github/workflows/**`）
- Secretsや環境変数（`.env*`）
- 課金・決済
- 大規模な依存関係の更新
- `develop` → `main` のマージ

## 実装エージェントの禁止事項

- `main` / `develop` への直接コミット・push
- 他Issueのブランチの編集
- 不要なforce push
- 自分が作成したPull Requestの自己マージ

## コミット・PR・コメントの書き方

- コミットメッセージ・PRタイトル・PR本文・issueコメントは**日本語**で書く
- コミットの author は `Claude Code <claude-code@example.com>` にする
- `develop` 宛のPR本文には、対応Issue・実装内容・テスト内容・確認方法・注意点を記載する。
  developマージ時点ではissueをcloseしない運用のため、`closes #番号` / `fixes #番号` は使わず
  `#番号` のみ記載する
- 機能実装・デプロイ完了時は `docs/SPEC_PROGRESS.md` を更新する（上の「仕様書・進捗」節のとおり）

## 依存関係の追加

新しい依存関係を追加する前には、必ずユーザーに確認を取る。無人実行では確認相手がいないため、
追加が必要だと判断した場合は追加せずに作業を止め、`00.check-user` を付与したうえで
なぜ必要かをIssueコメントで相談する。
<!-- END:multi-agent-rules -->
