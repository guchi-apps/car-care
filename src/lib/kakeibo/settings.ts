import { prisma } from "@/lib/prisma";

/**
 * 家計簿連携の設定の読み書き。**すべてログイン中のユーザー ID で絞る。**
 *
 * 設定は 1 ユーザー 1 件（`kakeibo_settings.user_id` は unique）。行が無いユーザーは
 * 既定値で扱い、保存したときに初めて行を作る（OAuth の連携という手順が無くなったため、
 * 「行があること」を連携済みの印には使えない）。
 */

/** 設定していないユーザーの既定。記録したら送る、を既定にする。 */
export const DEFAULT_AUTO_SEND = true;

export type KakeiboSettingView = {
  autoSend: boolean;
  cardAccountName: string | null;
  lastSentAt: Date | null;
};

export async function getKakeiboSettingView(
  userId: string,
): Promise<KakeiboSettingView> {
  const setting = await prisma.kakeiboSetting.findUnique({
    where: { userId },
    select: { autoSend: true, cardAccountName: true, lastSentAt: true },
  });

  return {
    autoSend: setting?.autoSend ?? DEFAULT_AUTO_SEND,
    cardAccountName: setting?.cardAccountName ?? null,
    lastSentAt: setting?.lastSentAt ?? null,
  };
}

export async function saveKakeiboSetting(
  userId: string,
  values: { autoSend: boolean; cardAccountName: string | null },
): Promise<void> {
  await prisma.kakeiboSetting.upsert({
    where: { userId },
    create: { userId, ...values },
    update: values,
  });
}

export async function markKakeiboSent(
  userId: string,
  sentAt: Date,
): Promise<void> {
  await prisma.kakeiboSetting.updateMany({
    where: { userId },
    data: { lastSentAt: sentAt },
  });
}
