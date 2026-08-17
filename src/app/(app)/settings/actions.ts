"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/auth-user";
import {
  createGasStationBrandForUser,
  deleteGasStationBrandForUser,
  reorderGasStationBrandsForUser,
  updateGasStationBrandForUser,
} from "@/lib/gas-station-brands";
import {
  deleteRegisteredGasStationForUser,
  reorderRegisteredGasStationsForUser,
  setRegisteredGasStationHiddenForUser,
  updateRegisteredGasStationForUser,
} from "@/lib/registered-gas-stations";
import { MAX_GAS_STATION_BRAND_KEYWORDS_LENGTH } from "@/lib/fuel-constants";
import {
  MAX_MAINTENANCE_INTERVAL_DAYS,
  MAX_MAINTENANCE_INTERVAL_KM,
  MIN_MAINTENANCE_INTERVAL_DAYS,
  MIN_MAINTENANCE_INTERVAL_KM,
} from "@/lib/maintenance-constants";
import {
  createMaintenanceCategoryForUser,
  deleteMaintenanceCategoryForUser,
  reorderMaintenanceCategoriesForUser,
  updateMaintenanceCategoryForUser,
} from "@/lib/maintenance-categories";

export type SettingsActionState = {
  ok: boolean;
  error?: string;
};

function formatMaintenanceCategoryActionError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (/Unknown argument `intervalKm`|Unknown argument `intervalDays`/.test(error.message)) {
    return "Prisma クライアントが古い可能性があります。npm run db:generate を実行して開発サーバーを再起動してください。";
  }

  if (/Unknown column|interval_km|interval_days|P2022/.test(error.message)) {
    return "データベースの更新が必要です。op signin のあと npm run db:migrate を実行してください。";
  }

  return fallback;
}

function parseKeywords(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "")
    .trim()
    .replace(/、/g, ",");

  if (!text) {
    return null;
  }

  if (text.length > MAX_GAS_STATION_BRAND_KEYWORDS_LENGTH) {
    return null;
  }

  return text;
}

export async function reorderGasStationBrandsAction(
  orderedBrandIds: string[],
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await reorderGasStationBrandsForUser(userId, orderedBrandIds);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidatePath("/settings");
    revalidatePath("/fuel/new");
    revalidatePath("/fuel");

    return { ok: true };
  } catch {
    return { ok: false, error: "並び順の更新に失敗しました" };
  }
}

export async function createGasStationBrandAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await createGasStationBrandForUser(
      userId,
      String(formData.get("name") ?? ""),
      parseKeywords(formData.get("matchKeywords")),
    );

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidatePath("/settings");
    revalidatePath("/fuel/new");
    revalidatePath("/fuel");

    return { ok: true };
  } catch {
    return { ok: false, error: "ブランドの追加に失敗しました" };
  }
}

export async function updateGasStationBrandAction(
  brandId: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await updateGasStationBrandForUser(userId, brandId, {
      name: String(formData.get("name") ?? ""),
      matchKeywords: parseKeywords(formData.get("matchKeywords")),
    });

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidatePath("/settings");
    revalidatePath("/fuel/new");
    revalidatePath("/fuel");

    return { ok: true };
  } catch {
    return { ok: false, error: "ブランドの更新に失敗しました" };
  }
}

export async function deleteGasStationBrandAction(
  brandId: string,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await deleteGasStationBrandForUser(userId, brandId);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidatePath("/settings");
    revalidatePath("/fuel/new");
    revalidatePath("/fuel");

    return { ok: true };
  } catch {
    return { ok: false, error: "ブランドの削除に失敗しました" };
  }
}

function revalidateFuelPaths() {
  revalidatePath("/settings");
  revalidatePath("/fuel/new");
  revalidatePath("/fuel");
}

export async function reorderRegisteredGasStationsAction(
  orderedStationIds: string[],
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await reorderRegisteredGasStationsForUser(userId, orderedStationIds);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateFuelPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "並び順の更新に失敗しました" };
  }
}

function parseOptionalGasStationOsmId(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  if (!/^\d+$/.test(text)) {
    return null;
  }

  return text;
}

function parseOptionalCoordinate(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function updateRegisteredGasStationAction(
  stationId: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await updateRegisteredGasStationForUser(userId, stationId, {
      brandSelect: String(formData.get("gasStationBrands") ?? ""),
      customBrand: String(formData.get("gasStationBrandOther") ?? ""),
      storeName: String(formData.get("gasStationStoreName") ?? ""),
      hiddenFromPicker: formData.get("hiddenFromPicker") === "on",
      osmId: parseOptionalGasStationOsmId(formData.get("gasStationOsmId")),
      latitude: parseOptionalCoordinate(formData.get("gasStationLatitude")),
      longitude: parseOptionalCoordinate(formData.get("gasStationLongitude")),
    });

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateFuelPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "登録店舗の更新に失敗しました" };
  }
}

export async function setRegisteredGasStationHiddenAction(
  stationId: string,
  hiddenFromPicker: boolean,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await setRegisteredGasStationHiddenForUser(
      userId,
      stationId,
      hiddenFromPicker,
    );

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateFuelPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "表示設定の更新に失敗しました" };
  }
}

export async function deleteRegisteredGasStationAction(
  stationId: string,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await deleteRegisteredGasStationForUser(userId, stationId);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateFuelPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "登録店舗の削除に失敗しました" };
  }
}

function revalidateMaintenancePaths() {
  revalidatePath("/settings");
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/new");
}

function parseOptionalMaintenanceIntervalKm(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: null } as const;
  }

  const parsed = Number.parseInt(text, 10);

  if (
    Number.isNaN(parsed) ||
    parsed < MIN_MAINTENANCE_INTERVAL_KM ||
    parsed > MAX_MAINTENANCE_INTERVAL_KM
  ) {
    return {
      error: `交換・整備間隔（距離）は${MIN_MAINTENANCE_INTERVAL_KM.toLocaleString("ja-JP")}〜${MAX_MAINTENANCE_INTERVAL_KM.toLocaleString("ja-JP")} kmの整数で入力してください`,
    } as const;
  }

  return { value: parsed } as const;
}

function parseOptionalMaintenanceIntervalDays(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: null } as const;
  }

  const parsed = Number.parseInt(text, 10);

  if (
    Number.isNaN(parsed) ||
    parsed < MIN_MAINTENANCE_INTERVAL_DAYS ||
    parsed > MAX_MAINTENANCE_INTERVAL_DAYS
  ) {
    return {
      error: `交換・整備間隔（日数）は${MIN_MAINTENANCE_INTERVAL_DAYS}〜${MAX_MAINTENANCE_INTERVAL_DAYS}日の整数で入力してください`,
    } as const;
  }

  return { value: parsed } as const;
}

function parseMaintenanceCategoryForm(formData: FormData) {
  const intervalKm = parseOptionalMaintenanceIntervalKm(formData.get("intervalKm"));
  if ("error" in intervalKm) {
    return { error: intervalKm.error } as const;
  }

  const intervalDays = parseOptionalMaintenanceIntervalDays(formData.get("intervalDays"));
  if ("error" in intervalDays) {
    return { error: intervalDays.error } as const;
  }

  return {
    data: {
      name: String(formData.get("name") ?? ""),
      intervalKm: intervalKm.value,
      intervalDays: intervalDays.value,
    },
  } as const;
}

export async function reorderMaintenanceCategoriesAction(
  orderedCategoryIds: string[],
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await reorderMaintenanceCategoriesForUser(userId, orderedCategoryIds);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateMaintenancePaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "並び順の更新に失敗しました" };
  }
}

export async function createMaintenanceCategoryAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const parsed = parseMaintenanceCategoryForm(formData);

    if ("error" in parsed) {
      return { ok: false, error: parsed.error };
    }

    const result = await createMaintenanceCategoryForUser(userId, parsed.data);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateMaintenancePaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: formatMaintenanceCategoryActionError(error, "カテゴリの追加に失敗しました"),
    };
  }
}

export async function updateMaintenanceCategoryAction(
  categoryId: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const parsed = parseMaintenanceCategoryForm(formData);

    if ("error" in parsed) {
      return { ok: false, error: parsed.error };
    }

    const result = await updateMaintenanceCategoryForUser(userId, categoryId, parsed.data);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateMaintenancePaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: formatMaintenanceCategoryActionError(error, "カテゴリの更新に失敗しました"),
    };
  }
}

export async function deleteMaintenanceCategoryAction(
  categoryId: string,
): Promise<SettingsActionState> {
  try {
    const userId = await requireUserId();
    const result = await deleteMaintenanceCategoryForUser(userId, categoryId);

    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    revalidateMaintenancePaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "カテゴリの削除に失敗しました" };
  }
}
