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
# DB_NAME / DB_USER / DB_PASSWORD / AUTH_SECRET / GOOGLE_CLIENT_ID・SECRET を設定
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

- Google ログイン: 開発用 OAuth クライアント（本番とは別。`.env.local` で管理）に `http://<LAN-IP>.sslip.io:3000/api/auth/callback/google` を追加（生 IP は Google が拒否する）
- パスキー: HTTP + LAN IP では不可（Google ログインを利用）

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
