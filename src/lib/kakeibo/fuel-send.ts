import { prisma } from "@/lib/prisma";
import {
  KakeiboImportError,
  sendPaymentImport,
  type KakeiboImportPayload,
} from "@/lib/kakeibo/client";
import { isKakeiboAvailableFor } from "@/lib/kakeibo/config";
import { getKakeiboSettingView, markKakeiboSent } from "@/lib/kakeibo/settings";

/**
 * 給油記録を家計簿（Asset Manager 経由の Zaim）へ送る。
 *
 * 設計上の約束が 3 つある。
 *
 * 1. **給油記録の保存を家計簿の都合で失敗させない。** Asset Manager が落ちていても車の記録は
 *    残す。そのためこの関数は例外を投げず、結果を status で返す。
 * 2. **1 件の給油記録につき送信は 1 回だけ。** 送信済みかどうかは
 *    `fuel_logs.asset_manager_receipt_id`（#141 より前の記録は `zaim_money_id`）で判定する。
 *    送り直しても Asset Manager 側が externalId で弾くが、こちらでも止める。
 * 3. **Zaim へ入ったかどうかを car-care は判断しない。** 内訳が決まっていない初回は
 *    Asset Manager の画面で確認待ちになる。ここが返すのは「送れたか」までにする。
 */

export type KakeiboSendStatus =
  /** Asset Manager が Zaim へ登録済み。 */
  | "sent"
  /** Asset Manager で確認待ち。画面で確定すると Zaim へ入る。 */
  | "pending"
  /** すでに送信済みの記録だった。 */
  | "already"
  /** 送信を予約した（応答を待たずに保存を返す経路）。 */
  | "queued"
  /** 連携そのものを使えない（未設定・許可外のアカウント）。 */
  | "unavailable"
  /** 自動送信がオフ。 */
  | "auto-off"
  | "failed";

export type KakeiboSendResult = {
  status: KakeiboSendStatus;
  /** 画面に出す一言。 */
  message?: string;
  /** 「楽天カード」のような送り先の表示。 */
  target?: string;
};

export type KakeiboSendOptions = {
  /** true なら「自動送信がオフ」でも送る（履歴の「家計簿へ送る」ボタン用）。 */
  manual?: boolean;
};

/** Asset Manager 側で分類履歴のキーになる品名。給油量は usage で渡す（毎回変わる値を混ぜない）。 */
const ITEM_NAME = "ガソリン";

/** 店名が分からない給油記録でも送れるようにする（受け口は place を必須にしている）。 */
const FALLBACK_PLACE = "ガソリンスタンド";

function formatJstDate(date: Date): string {
  // 給油日は JST の正午として保存されている（fuel/actions.ts の parseDate）。
  // 家計簿へは JST の暦日で渡す必要があるため、UTC ではなく Asia/Tokyo で組み立てる。
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** `35.2L` のような表記。Asset Manager が品名の末尾へ足す。 */
function formatUsage(liters: number): string | null {
  if (!Number.isFinite(liters) || liters <= 0) return null;

  return `${Number(liters.toFixed(2))}L`;
}

export function buildFuelPayload(fuelLog: {
  id: string;
  date: Date;
  totalCost: number;
  fuelAmount: unknown;
  pricePerLiter: number;
  odometer: number | null;
  isFull: boolean;
  gasStationName: string | null;
  gasStationBrands: string | null;
  vehicle: { name: string };
}): KakeiboImportPayload {
  const liters = Number(fuelLog.fuelAmount);

  return {
    externalId: `fuel:${fuelLog.id}`,
    date: formatJstDate(fuelLog.date),
    amount: fuelLog.totalCost,
    place:
      fuelLog.gasStationName?.trim() ||
      fuelLog.gasStationBrands?.trim() ||
      FALLBACK_PLACE,
    name: ITEM_NAME,
    usage: formatUsage(liters),
    // 画面から入力された値なので、Asset Manager 側で「抽出が曖昧」とは扱わせない。
    confidence: 1,
    sourceMetadata: {
      app: "car-care",
      fuelLogId: fuelLog.id,
      vehicleName: fuelLog.vehicle.name,
      fuelAmountLiters: Number.isFinite(liters) ? liters : null,
      pricePerLiter: fuelLog.pricePerLiter,
      odometer: fuelLog.odometer,
      isFull: fuelLog.isFull,
    },
  };
}

export async function sendFuelLogToKakeibo(
  userId: string,
  userEmail: string | null,
  fuelLogId: string,
  options: KakeiboSendOptions = {},
): Promise<KakeiboSendResult> {
  if (!isKakeiboAvailableFor(userEmail)) {
    return { status: "unavailable" };
  }

  const setting = await getKakeiboSettingView(userId);

  if (!options.manual && !setting.autoSend) {
    return { status: "auto-off" };
  }

  const target = setting.cardAccountName ?? undefined;

  const fuelLog = await prisma.fuelLog.findFirst({
    where: { id: fuelLogId, vehicle: { userId } },
    include: { vehicle: { select: { name: true } } },
  });

  if (!fuelLog) {
    return { status: "failed", message: "給油記録が見つかりません" };
  }

  if (fuelLog.assetManagerReceiptId || fuelLog.zaimMoneyId) {
    return {
      status: "already",
      target,
      message: "この記録はすでに家計簿へ送信済みです",
    };
  }

  const payload = buildFuelPayload(fuelLog);

  if (setting.cardAccountName) {
    payload.accountHint = setting.cardAccountName;
  }

  try {
    const response = await sendPaymentImport(payload);

    if (response.status === "ignored" || response.status === "error") {
      return {
        status: "failed",
        target,
        message: response.reason ?? "家計簿へ送信できませんでした",
      };
    }

    const sentAt = new Date();

    await prisma.fuelLog.update({
      where: { id: fuelLog.id },
      data: {
        // 取り込み ID を返さなかった場合も、送信済みであることは記録して二重送信を防ぐ。
        assetManagerReceiptId: response.receiptId
          ? String(response.receiptId)
          : "unknown",
        kakeiboSentAt: sentAt,
      },
    });

    await markKakeiboSent(userId, sentAt);

    if (response.status === "duplicate") {
      return {
        status: "already",
        target,
        message: "この記録はすでに家計簿へ送信済みです",
      };
    }

    if (response.status === "pendingReview") {
      return {
        status: "pending",
        target,
        message:
          response.reason ??
          "家計簿アプリで内訳を確認してから登録されます",
      };
    }

    return { status: "sent", target };
  } catch (error) {
    console.error("[kakeibo] 給油記録の送信に失敗:", error);

    return {
      status: "failed",
      target,
      message:
        error instanceof KakeiboImportError
          ? error.message
          : "家計簿へ送信できませんでした",
    };
  }
}
