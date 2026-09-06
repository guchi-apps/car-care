/**
 * 家計簿（Zaim）連携の設定。
 *
 * **car-care は Zaim へ直接書かない。** 給油記録は Asset Manager
 * （guchi-apps/asset-manager）へ送り、Zaim への登録は Asset Manager が行う（#141）。
 *
 * Zaim の公式 API で作った明細は、Zaim アプリの「置き換え」候補に並ばない
 * （asset-manager#300 の実測）。カード明細が届いても置き換えられないため、家計簿には
 * 同じ支出が二重に残る。置き換えの対象になるのは Web 版（my.zaim.net）の入力画面から
 * 作った明細だけで、その画面を操作できるのは AIDE（Playwright と Zaim のログイン状態を
 * 持っている）しかない。したがって経路は
 * car-care → Asset Manager → AIDE → Zaim Web 版 になる。
 */

/**
 * 送信先の既定値。本番では Asset Manager も同じ VPS 上で動いているため 127.0.0.1 で叩ける
 * （外部公開は不要）。ポートの正はポート台帳（`guchi-apps/docs` の `standards/ports.md`）。
 *
 * **ローカルで確認するときは `ASSET_MANAGER_URL` を必ず指定する。** 既定値のままだと、
 * サブPC上の別プロセスへ送ってしまう。
 */
export const DEFAULT_ASSET_MANAGER_URL = "http://127.0.0.1:3102";

export type AssetManagerEndpoint = {
  /** 末尾のスラッシュを落とした URL。 */
  baseUrl: string;
  /** Asset Manager 側の ZAIM_SYNC_SECRET と同じ値。 */
  secret: string;
};

export function getAssetManagerEndpoint(): AssetManagerEndpoint | null {
  const secret = process.env.ASSET_MANAGER_IMPORT_SECRET?.trim();

  if (!secret) {
    return null;
  }

  const baseUrl =
    process.env.ASSET_MANAGER_URL?.trim() || DEFAULT_ASSET_MANAGER_URL;

  return { baseUrl: baseUrl.replace(/\/+$/, ""), secret };
}

/**
 * 家計簿連携を使ってよいアカウントか。
 *
 * 送信先の家計簿は Asset Manager 側で 1 つに決まっている（`ZAIM_SYNC_USER_EMAIL`）。
 * 誰の給油記録でも送れると他人の家計簿へ入るため、ZAIM_ALLOWED_EMAILS に挙げた
 * アカウントだけに機能を出す。**未設定なら誰も使えない**（意図せず全員に開かないため）。
 *
 * 経路は変わったが最終的な行き先は Zaim のままなので、環境変数名は据え置いている。
 */
export function isKakeiboAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.ZAIM_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return false;

  return allowed.includes(email.toLowerCase());
}

/** 画面に「家計簿連携」を出してよいか（送信先が設定されていて、かつ許可されたアカウント）。 */
export function isKakeiboAvailableFor(email: string | null | undefined): boolean {
  return getAssetManagerEndpoint() !== null && isKakeiboAllowedEmail(email);
}
