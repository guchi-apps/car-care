"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth-user";
import { isKakeiboAvailableFor } from "@/lib/kakeibo/config";
import { saveKakeiboSetting } from "@/lib/kakeibo/settings";

export type KakeiboActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Zaim の口座名は画面に出るだけの短い文字列。長い入力は取り違えとして弾く。 */
const MAX_CARD_ACCOUNT_NAME_LENGTH = 60;

async function requireKakeiboUser() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "認証が必要です" } as const;
  }

  if (!isKakeiboAvailableFor(user.email)) {
    return { error: "このアカウントでは家計簿連携を利用できません" } as const;
  }

  return { user } as const;
}

export async function updateKakeiboSettingsAction(
  _prevState: KakeiboActionState,
  formData: FormData,
): Promise<KakeiboActionState> {
  try {
    const authorized = await requireKakeiboUser();

    if ("error" in authorized) {
      return { ok: false, error: authorized.error };
    }

    const cardAccountName = String(formData.get("cardAccountName") ?? "").trim();

    if (cardAccountName.length > MAX_CARD_ACCOUNT_NAME_LENGTH) {
      return {
        ok: false,
        error: `支払元の口座名は${MAX_CARD_ACCOUNT_NAME_LENGTH}文字以内で入力してください`,
      };
    }

    await saveKakeiboSetting(authorized.user.id, {
      autoSend: formData.get("autoSend") === "on",
      cardAccountName: cardAccountName || null,
    });

    revalidatePath("/settings");
    revalidatePath("/fuel");

    return { ok: true, message: "保存しました" };
  } catch (error) {
    console.error("[kakeibo] 設定の保存に失敗:", error);
    return { ok: false, error: "設定の保存に失敗しました" };
  }
}
