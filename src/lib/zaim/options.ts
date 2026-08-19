import {
  fetchZaimAccounts,
  fetchZaimCategories,
  fetchZaimGenres,
  type ZaimOption,
} from "@/lib/zaim/client";
import { getZaimAccessToken } from "@/lib/zaim/connection";

/**
 * 支出の登録先として選べる一覧を Zaim から取ってくる。
 *
 * カテゴリ・ジャンル・口座の ID は利用者ごとに違うため、設定画面には Zaim の実際の一覧を出す。
 * Zaim が落ちていても設定画面自体は開けるように、失敗は例外ではなくメッセージで返す。
 */

export type ZaimOptions = {
  categories: ZaimOption[];
  genres: ZaimOption[];
  accounts: ZaimOption[];
};

export type ZaimOptionsResult = {
  options: ZaimOptions | null;
  error: string | null;
};

export async function loadZaimOptionsForUser(
  userId: string,
): Promise<ZaimOptionsResult> {
  const token = await getZaimAccessToken(userId);

  if (!token) {
    return { options: null, error: null };
  }

  try {
    const [categories, genres, accounts] = await Promise.all([
      fetchZaimCategories(token),
      fetchZaimGenres(token),
      fetchZaimAccounts(token),
    ]);

    return { options: { categories, genres, accounts }, error: null };
  } catch (error) {
    console.error("[zaim] 登録先の一覧を取得できませんでした:", error);

    return {
      options: null,
      error:
        "Zaimから登録先の一覧を取得できませんでした。時間をおいて設定画面を開き直してください。",
    };
  }
}
