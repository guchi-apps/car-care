import { prisma } from "@/lib/prisma";
import { formatFuelAmount, formatPricePerLiter } from "@/lib/fuel-display";
import { createZaimPayment, ZaimApiError } from "@/lib/zaim/client";
import { isZaimAvailableFor } from "@/lib/zaim/config";
import {
  getZaimAccessToken,
  getZaimConnection,
  markZaimRegistered,
} from "@/lib/zaim/connection";

/**
 * 給油記録を Zaim の支出として登録する。
 *
 * 設計上の約束が 2 つある。
 *
 * 1. **給油記録の保存を Zaim の都合で失敗させない。** Zaim が落ちていても車の記録は残す。
 *    そのためこの関数は例外を投げず、結果を status で返す。
 * 2. **1 件の給油記録につき Zaim への登録は 1 回だけ。** 登録済みかどうかは
 *    `fuel_logs.zaim_money_id` の有無で判定する。二重に家計簿へ入るのを防ぐ。
 */

export type ZaimSyncStatus =
  | "registered"
  | "already"
  | "unavailable"
  | "auto-off"
  | "not-configured"
  | "failed";

export type ZaimSyncResult = {
  status: ZaimSyncStatus;
  /** 画面に出す一言。 */
  message?: string;
  /** 「自動車 › ガソリン ／ 楽天カード」のような登録先の表示。 */
  target?: string;
};

export type ZaimSyncOptions = {
  /** true なら「自動登録がオフ」でも登録する（履歴の「Zaimに登録」ボタン用）。 */
  manual?: boolean;
};

function formatZaimDate(date: Date): string {
  // 給油日は JST の正午として保存されている（fuel/actions.ts の parseDate）。
  // Zaim へは JST の暦日で渡す必要があるため、UTC ではなく Asia/Tokyo で組み立てる。
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  return parts;
}

function buildComment(params: {
  fuelAmount: number;
  pricePerLiter: number;
  vehicleName: string;
}): string {
  return [
    formatFuelAmount(params.fuelAmount),
    formatPricePerLiter(params.pricePerLiter),
    params.vehicleName,
  ].join(" ・ ");
}

function buildTargetLabel(connection: {
  categoryName: string | null;
  genreName: string | null;
  accountName: string | null;
}): string {
  const category = [connection.categoryName, connection.genreName]
    .filter(Boolean)
    .join(" › ");

  return [category, connection.accountName].filter(Boolean).join(" ／ ");
}

export async function registerFuelLogToZaim(
  userId: string,
  userEmail: string | null,
  fuelLogId: string,
  options: ZaimSyncOptions = {},
): Promise<ZaimSyncResult> {
  if (!isZaimAvailableFor(userEmail)) {
    return { status: "unavailable" };
  }

  const connection = await getZaimConnection(userId);

  if (!connection) {
    return { status: "unavailable" };
  }

  if (!options.manual && !connection.autoRegister) {
    return { status: "auto-off" };
  }

  if (!connection.categoryId || !connection.genreId) {
    return {
      status: "not-configured",
      message: "設定画面でZaimの登録先（カテゴリ・ジャンル）を選んでください",
    };
  }

  const fuelLog = await prisma.fuelLog.findFirst({
    where: { id: fuelLogId, vehicle: { userId } },
    include: { vehicle: { select: { name: true } } },
  });

  if (!fuelLog) {
    return { status: "failed", message: "給油記録が見つかりません" };
  }

  if (fuelLog.zaimMoneyId) {
    return {
      status: "already",
      target: buildTargetLabel(connection),
      message: "この記録はすでにZaimへ登録されています",
    };
  }

  const token = await getZaimAccessToken(userId);

  if (!token) {
    return { status: "unavailable" };
  }

  try {
    const moneyId = await createZaimPayment(token, {
      date: formatZaimDate(fuelLog.date),
      amount: fuelLog.totalCost,
      categoryId: connection.categoryId,
      genreId: connection.genreId,
      accountId: connection.accountId,
      place: fuelLog.gasStationName ?? fuelLog.gasStationBrands,
      comment: buildComment({
        fuelAmount: Number(fuelLog.fuelAmount),
        pricePerLiter: fuelLog.pricePerLiter,
        vehicleName: fuelLog.vehicle.name,
      }),
    });

    const registeredAt = new Date();

    await prisma.fuelLog.update({
      where: { id: fuelLog.id },
      data: {
        // Zaim が id を返さなかった場合も、登録済みであることは記録して二重登録を防ぐ。
        zaimMoneyId: moneyId ?? "unknown",
        zaimRegisteredAt: registeredAt,
      },
    });

    await markZaimRegistered(userId, registeredAt);

    return { status: "registered", target: buildTargetLabel(connection) };
  } catch (error) {
    console.error("[zaim] 支出の登録に失敗:", error);

    if (error instanceof ZaimApiError && error.status === 401) {
      return {
        status: "failed",
        message: "Zaimの連携が切れています。設定画面から連携し直してください",
      };
    }

    return {
      status: "failed",
      message:
        error instanceof ZaimApiError
          ? error.message
          : "Zaimへの登録に失敗しました",
    };
  }
}
