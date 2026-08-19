"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth-user";
import { isZaimAvailableFor } from "@/lib/zaim/config";
import {
  deleteZaimConnection,
  updateZaimRegistrationTarget,
} from "@/lib/zaim/connection";

export type ZaimActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/**
 * 設定画面のセレクトは `${id}\t${表示名}` を value に入れている。
 * ID だけを保存すると画面に出す名前のたびに Zaim を叩くことになるため、名前も一緒に控える。
 */
function parseOptionValue(value: FormDataEntryValue | null): {
  id: string | null;
  name: string | null;
} {
  const text = String(value ?? "").trim();

  if (!text) {
    return { id: null, name: null };
  }

  const [id, ...rest] = text.split("\t");
  const name = rest.join("\t").trim();

  if (!id) {
    return { id: null, name: null };
  }

  return { id, name: name || null };
}

async function requireZaimUser() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "認証が必要です" } as const;
  }

  if (!isZaimAvailableFor(user.email)) {
    return { error: "このアカウントではZaim連携を利用できません" } as const;
  }

  return { user } as const;
}

export async function updateZaimSettingsAction(
  _prevState: ZaimActionState,
  formData: FormData,
): Promise<ZaimActionState> {
  try {
    const authorized = await requireZaimUser();

    if ("error" in authorized) {
      return { ok: false, error: authorized.error };
    }

    const category = parseOptionValue(formData.get("categoryId"));
    const genre = parseOptionValue(formData.get("genreId"));
    const account = parseOptionValue(formData.get("accountId"));
    const autoRegister = formData.get("autoRegister") === "on";

    if (autoRegister && (!category.id || !genre.id)) {
      return {
        ok: false,
        error:
          "自動で登録するには、カテゴリとジャンルを選んでください",
      };
    }

    const updated = await updateZaimRegistrationTarget(authorized.user.id, {
      autoRegister,
      categoryId: category.id,
      categoryName: category.name,
      genreId: genre.id,
      genreName: genre.name,
      accountId: account.id,
      accountName: account.name,
    });

    if (!updated) {
      return { ok: false, error: "Zaimと連携していません" };
    }

    revalidatePath("/settings");

    return { ok: true, message: "保存しました" };
  } catch (error) {
    console.error("[zaim] 設定の保存に失敗:", error);
    return { ok: false, error: "設定の保存に失敗しました" };
  }
}

export async function disconnectZaimAction(): Promise<ZaimActionState> {
  try {
    const authorized = await requireZaimUser();

    if ("error" in authorized) {
      return { ok: false, error: authorized.error };
    }

    await deleteZaimConnection(authorized.user.id);

    revalidatePath("/settings");
    revalidatePath("/fuel");

    return { ok: true, message: "連携を解除しました" };
  } catch (error) {
    console.error("[zaim] 連携の解除に失敗:", error);
    return { ok: false, error: "連携の解除に失敗しました" };
  }
}
