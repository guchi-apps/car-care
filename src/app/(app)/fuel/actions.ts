"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getCurrentUser, requireUserId } from "@/lib/auth-user";
import { OTHER_GAS_STATION_BRAND_NAME } from "@/lib/gas-station-brand-types";
import {
  ensureGasStationBrandsForUser,
} from "@/lib/gas-station-brands";
import {
  MAX_CUSTOM_GAS_STATION_BRAND_LENGTH,
  MAX_DISTANCE_KM,
  MAX_FUEL_AMOUNT,
  MAX_GAS_STATION_NAME_LENGTH,
  MAX_GAS_STATION_STORE_NAME_LENGTH,
  MAX_ODOMETER,
  MAX_PRICE_PER_LITER,
  MAX_TOTAL_COST,
  MIN_DISTANCE_KM,
} from "@/lib/fuel-constants";
import { composeGasStationRegistrationName } from "@/lib/gas-stations";
import {
  createFuelLog,
  deleteFuelLog,
  deleteFuelLogs,
  updateFuelLog,
  type FuelLogInput,
} from "@/lib/fuel-logs";
import { upsertRegisteredGasStationFromFuelLog } from "@/lib/registered-gas-stations";
import { computeFuelEfficiencyForLog } from "@/lib/fuel-stats";
import { getVehicleForUser } from "@/lib/vehicles";
import { isKakeiboAvailableFor } from "@/lib/kakeibo/config";
import { getKakeiboSettingView } from "@/lib/kakeibo/settings";
import {
  sendFuelLogToKakeibo,
  type KakeiboSendResult,
} from "@/lib/kakeibo/fuel-send";

/**
 * 家計簿への送信は応答を待たない。
 *
 * Asset Manager は内訳が決まっている支出をその場で Zaim の Web 版へ登録するため、応答までに
 * ヘッドレスブラウザの操作（数十秒）が入る。給油の保存でそれを待たせると、スタンドで記録する
 * という使い方が壊れる。`after()` で応答を返したあとに送り、結果は履歴の「家計簿へ送る」で
 * 拾い直せるようにする（送り直しても Asset Manager 側が externalId で弾く）。
 */
async function scheduleKakeiboSend(
  userId: string,
  userEmail: string | null,
  fuelLogId: string,
): Promise<KakeiboSendResult> {
  if (!isKakeiboAvailableFor(userEmail)) {
    return { status: "unavailable" };
  }

  const setting = await getKakeiboSettingView(userId);

  if (!setting.autoSend) {
    return { status: "auto-off" };
  }

  after(async () => {
    const result = await sendFuelLogToKakeibo(userId, userEmail, fuelLogId);

    if (result.status === "failed") {
      console.error("[kakeibo] 自動送信に失敗:", result.message);
    }
  });

  return { status: "queued", target: setting.cardAccountName ?? undefined };
}

export type FuelLogRegisteredSummary = {
  fuelLogId: string;
  date: string;
  distanceKm: number;
  odometer: number | null;
  fuelAmount: number;
  pricePerLiter: number;
  totalCost: number;
  isFull: boolean;
  gasStationName: string;
  fuelEfficiency: number | null;
};

export type FuelActionState = {
  ok: boolean;
  error?: string;
  resetToken?: number;
  registered?: FuelLogRegisteredSummary;
  /** 家計簿へ送ったかどうか。連携していないときは付かない。 */
  kakeibo?: KakeiboSendResult;
};

function parseDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { error: "給油日を入力してください" } as const;
  }

  const parsed = new Date(`${text}T12:00:00+09:00`);

  if (Number.isNaN(parsed.getTime())) {
    return { error: "給油日の形式が正しくありません" } as const;
  }

  return { value: parsed } as const;
}

function parseDistanceKm(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { error: "前回給油からの距離を入力してください" } as const;
  }

  const parsed = Number.parseFloat(text);

  if (
    Number.isNaN(parsed) ||
    parsed < MIN_DISTANCE_KM ||
    parsed > MAX_DISTANCE_KM ||
    !/^\d+(\.\d{1,2})?$/.test(text)
  ) {
    return {
      error: `前回給油からの距離は${MIN_DISTANCE_KM}〜${MAX_DISTANCE_KM.toLocaleString("ja-JP")}の数値で入力してください（小数点2桁まで）`,
    } as const;
  }

  return { value: parsed } as const;
}

function parseOptionalOdometer(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: null } as const;
  }

  const parsed = Number.parseInt(text, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_ODOMETER) {
    return {
      error: `オドメーターは1〜${MAX_ODOMETER.toLocaleString("ja-JP")}の整数で入力してください`,
    } as const;
  }

  return { value: parsed } as const;
}

function parseFuelAmount(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { error: "給油量を入力してください" } as const;
  }

  const parsed = Number.parseFloat(text);

  if (
    Number.isNaN(parsed) ||
    parsed <= 0 ||
    parsed > MAX_FUEL_AMOUNT ||
    !/^\d+(\.\d{1,2})?$/.test(text)
  ) {
    return {
      error: `給油量は0.01〜${MAX_FUEL_AMOUNT}の数値で入力してください`,
    } as const;
  }

  return { value: parsed } as const;
}

function parsePricePerLiter(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { error: "単価を入力してください" } as const;
  }

  const parsed = Number.parseInt(text, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_PRICE_PER_LITER) {
    return {
      error: `単価は1〜${MAX_PRICE_PER_LITER}の整数で入力してください`,
    } as const;
  }

  return { value: parsed } as const;
}

function parseTotalCost(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { error: "合計金額を入力してください" } as const;
  }

  const parsed = Number.parseInt(text, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_TOTAL_COST) {
    return {
      error: `合計金額は1〜${MAX_TOTAL_COST.toLocaleString("ja-JP")}の整数で入力してください`,
    } as const;
  }

  return { value: parsed } as const;
}

function parseRequiredText(
  value: FormDataEntryValue | null,
  fieldLabel: string,
  maxLength: number,
) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { error: `${fieldLabel}を入力してください` } as const;
  }

  if (text.length > maxLength) {
    return {
      error: `${fieldLabel}は${maxLength}文字以内で入力してください`,
    } as const;
  }

  return { value: text } as const;
}

function parseOptionalGasStationOsmId(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: null } as const;
  }

  if (!/^\d+$/.test(text)) {
    return { value: null } as const;
  }

  return { value: text } as const;
}

function parseGasStationBrandFromForm(
  formData: FormData,
  brandNames: string[],
) {
  const selected = String(formData.get("gasStationBrands") ?? "").trim();

  if (!selected) {
    return { error: "ブランドを選択してください" } as const;
  }

  if (!brandNames.includes(selected)) {
    return { error: "ガソリンスタンドブランドの値が正しくありません" } as const;
  }

  if (selected === OTHER_GAS_STATION_BRAND_NAME) {
    return parseRequiredText(
      formData.get("gasStationBrandOther"),
      "ブランド名",
      MAX_CUSTOM_GAS_STATION_BRAND_LENGTH,
    );
  }

  return { value: selected } as const;
}

async function parseFuelForm(userId: string, formData: FormData) {
  const brands = await ensureGasStationBrandsForUser(userId);
  const brandNames = brands.map((brand) => brand.name);
  const date = parseDate(formData.get("date"));
  if ("error" in date) {
    return { error: date.error } as const;
  }

  const distanceKm = parseDistanceKm(formData.get("distanceKm"));
  if ("error" in distanceKm) {
    return { error: distanceKm.error } as const;
  }

  const odometer = parseOptionalOdometer(formData.get("odometer"));
  if ("error" in odometer) {
    return { error: odometer.error } as const;
  }

  const fuelAmount = parseFuelAmount(formData.get("fuelAmount"));
  if ("error" in fuelAmount) {
    return { error: fuelAmount.error } as const;
  }

  const pricePerLiter = parsePricePerLiter(formData.get("pricePerLiter"));
  if ("error" in pricePerLiter) {
    return { error: pricePerLiter.error } as const;
  }

  const totalCost = parseTotalCost(formData.get("totalCost"));
  if ("error" in totalCost) {
    return { error: totalCost.error } as const;
  }

  const gasStationBrand = parseGasStationBrandFromForm(formData, brandNames);
  if ("error" in gasStationBrand) {
    return { error: gasStationBrand.error } as const;
  }

  const gasStationStoreName = parseRequiredText(
    formData.get("gasStationStoreName"),
    "店舗名",
    MAX_GAS_STATION_STORE_NAME_LENGTH,
  );
  if ("error" in gasStationStoreName) {
    return { error: gasStationStoreName.error } as const;
  }

  const composedGasStationName = composeGasStationRegistrationName(
    gasStationBrand.value,
    gasStationStoreName.value,
  );

  if (composedGasStationName.length > MAX_GAS_STATION_NAME_LENGTH) {
    return {
      error: `登録名は${MAX_GAS_STATION_NAME_LENGTH}文字以内にしてください`,
    } as const;
  }

  const gasStationOsmId = parseOptionalGasStationOsmId(
    formData.get("gasStationOsmId"),
  );
  if ("error" in gasStationOsmId) {
    return { error: gasStationOsmId.error } as const;
  }

  const data: FuelLogInput = {
    date: date.value,
    distanceKm: distanceKm.value,
    odometer: odometer.value,
    fuelAmount: fuelAmount.value,
    pricePerLiter: pricePerLiter.value,
    totalCost: totalCost.value,
    isFull: formData.get("isFull") === "on",
    gasStationName: composedGasStationName,
    gasStationBrands: gasStationBrand.value,
    gasStationOsmId: gasStationOsmId.value,
  };

  return { data } as const;
}

async function requireVehicleForUser(userId: string, vehicleId: string) {
  const vehicle = await getVehicleForUser(userId, vehicleId);

  if (!vehicle) {
    return { error: "車両が見つかりません" } as const;
  }

  return { vehicle } as const;
}

export async function createFuelLogAction(
  vehicleId: string,
  _prevState: FuelActionState,
  formData: FormData,
): Promise<FuelActionState> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { ok: false, error: "認証が必要です" };
    }

    const userId = user.id;
    const vehicleResult = await requireVehicleForUser(userId, vehicleId);

    if ("error" in vehicleResult) {
      return { ok: false, error: vehicleResult.error };
    }

    const parsed = await parseFuelForm(userId, formData);

    if ("error" in parsed) {
      return {
        ok: false,
        error:
          typeof parsed.error === "string"
            ? parsed.error
            : "入力内容を確認してください",
      };
    }

    const created = await createFuelLog(userId, vehicleId, parsed.data);

    if (!created) {
      return { ok: false, error: "給油記録の登録に失敗しました" };
    }

    await upsertRegisteredGasStationFromFuelLog(userId, {
      registeredName: parsed.data.gasStationName,
      brand: parsed.data.gasStationBrands,
      osmId: parsed.data.gasStationOsmId,
    });

    // 家計簿への送信は「おまけ」で、失敗しても給油記録の登録は成功とする
    // （家計簿の都合で車の記録を落とさない）。
    const kakeibo = await scheduleKakeiboSend(userId, user.email, created.id);

    revalidatePath("/fuel");
    revalidatePath("/fuel/new");
    revalidatePath("/settings");
    revalidatePath("/");

    return {
      ok: true,
      resetToken: Date.now(),
      kakeibo,
      registered: {
        fuelLogId: created.id,
        date: parsed.data.date.toISOString(),
        distanceKm: parsed.data.distanceKm,
        odometer: parsed.data.odometer ?? null,
        fuelAmount: parsed.data.fuelAmount,
        pricePerLiter: parsed.data.pricePerLiter,
        totalCost: parsed.data.totalCost,
        isFull: parsed.data.isFull,
        gasStationName: parsed.data.gasStationName,
        fuelEfficiency: computeFuelEfficiencyForLog({
          isFull: parsed.data.isFull,
          distanceKm: parsed.data.distanceKm,
          fuelAmount: parsed.data.fuelAmount,
        }),
      },
    };
  } catch {
    return { ok: false, error: "給油記録の登録に失敗しました" };
  }
}

export async function updateFuelLogAction(
  fuelLogId: string,
  _prevState: FuelActionState,
  formData: FormData,
): Promise<FuelActionState> {
  try {
    const userId = await requireUserId();
    const parsed = await parseFuelForm(userId, formData);

    if ("error" in parsed) {
      return {
        ok: false,
        error:
          typeof parsed.error === "string"
            ? parsed.error
            : "入力内容を確認してください",
      };
    }

    const updated = await updateFuelLog(userId, fuelLogId, parsed.data);

    if (!updated) {
      return { ok: false, error: "給油記録が見つかりません" };
    }

    await upsertRegisteredGasStationFromFuelLog(userId, {
      registeredName: parsed.data.gasStationName,
      brand: parsed.data.gasStationBrands,
      osmId: parsed.data.gasStationOsmId,
    });

    revalidatePath("/fuel");
    revalidatePath("/fuel/new");
    revalidatePath("/settings");
    revalidatePath("/");

    return { ok: true, resetToken: Date.now() };
  } catch {
    return { ok: false, error: "給油記録の更新に失敗しました" };
  }
}

export async function deleteFuelLogAction(
  fuelLogId: string,
): Promise<FuelActionState> {
  try {
    const userId = await requireUserId();
    const deleted = await deleteFuelLog(userId, fuelLogId);

    if (!deleted) {
      return { ok: false, error: "給油記録が見つかりません" };
    }

    revalidatePath("/fuel");
    revalidatePath("/fuel/new");
    revalidatePath("/");

    return { ok: true, resetToken: Date.now() };
  } catch {
    return { ok: false, error: "給油記録の削除に失敗しました" };
  }
}

export async function deleteFuelLogsAction(
  fuelLogIds: string[],
): Promise<FuelActionState> {
  try {
    const userId = await requireUserId();

    if (!Array.isArray(fuelLogIds) || fuelLogIds.length === 0) {
      return { ok: false, error: "削除する記録を選択してください" };
    }

    const deletedCount = await deleteFuelLogs(userId, fuelLogIds);

    if (deletedCount === 0) {
      return { ok: false, error: "給油記録が見つかりません" };
    }

    revalidatePath("/fuel");
    revalidatePath("/fuel/new");
    revalidatePath("/");

    return { ok: true, resetToken: Date.now() };
  } catch {
    return { ok: false, error: "給油記録の削除に失敗しました" };
  }
}

/**
 * 給油履歴の「家計簿へ送る」から呼ぶ。
 *
 * 自動送信がオフのとき・送信に失敗したとき・連携より前につけた記録を、あとから 1 件ずつ送る。
 * すでに送信済みの記録は二重に入らない（fuel-send.ts が asset_manager_receipt_id を見る）。
 *
 * こちらは利用者が押して待つ操作なので、`createFuelLogAction` と違って応答を待つ。
 */
export async function sendFuelLogToKakeiboAction(
  fuelLogId: string,
): Promise<FuelActionState> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { ok: false, error: "認証が必要です" };
    }

    const kakeibo = await sendFuelLogToKakeibo(user.id, user.email, fuelLogId, {
      manual: true,
    });

    if (kakeibo.status === "failed") {
      return {
        ok: false,
        error: kakeibo.message ?? "家計簿へ送信できませんでした",
        kakeibo,
      };
    }

    if (kakeibo.status === "unavailable") {
      return { ok: false, error: "家計簿連携を利用できません", kakeibo };
    }

    revalidatePath("/fuel");
    revalidatePath("/settings");

    return { ok: true, resetToken: Date.now(), kakeibo };
  } catch (error) {
    console.error("[kakeibo] 履歴からの送信に失敗:", error);
    return { ok: false, error: "家計簿へ送信できませんでした" };
  }
}
