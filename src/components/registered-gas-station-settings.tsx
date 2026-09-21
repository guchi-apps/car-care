"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, type MouseEvent } from "react";

import {
  deleteRegisteredGasStationAction,
  reorderRegisteredGasStationsAction,
  setRegisteredGasStationHiddenAction,
  updateRegisteredGasStationAction,
  type SettingsActionState,
} from "@/app/(app)/settings/actions";
import { DeleteConfirmPanel } from "@/components/delete-confirm-panel";
import { GasStationMapPicker } from "@/components/gas-station-map-picker";
import {
  OTHER_GAS_STATION_BRAND_NAME,
  type GasStationBrandRecord,
} from "@/lib/gas-station-brand-types";
import { type KnownGasStation } from "@/lib/gas-stations";
import {
  getRegisteredStationEditDefaults,
  type RegisteredGasStationRecord,
} from "@/lib/registered-gas-station-types";

const initialState: SettingsActionState = { ok: false };

function RegisteredStationMapSection({
  station,
  gasStationBrands,
  knownGasStations,
  selectedOsmId,
  onSelectStation,
}: {
  station: RegisteredGasStationRecord;
  gasStationBrands: GasStationBrandRecord[];
  knownGasStations: KnownGasStation[];
  selectedOsmId: string | null;
  onSelectStation: (selection: {
    id: string;
    brandSelect: string;
    customBrand: string;
    storeName: string;
    lat?: number;
    lon?: number;
  }) => void;
}) {
  const hasStoredLocation =
    station.latitude != null && station.longitude != null;

  // osmId がある店舗の位置は GasStationMapPicker が initialFocusOsmId から自分で取得する。
  // ここで同じ問い合わせを先に投げても、結果は使われず外部 API へのアクセスが増えるだけ（#185）。
  const initialFocusView = useMemo(() => {
    if (!hasStoredLocation) {
      return null;
    }

    return { lat: station.latitude!, lon: station.longitude! };
  }, [hasStoredLocation, station.latitude, station.longitude]);

  return (
    <>
      {!station.osmId && !hasStoredLocation && (
        <p className="mb-2 text-sm text-amber-800 dark:text-amber-200">
          地図上の位置が未保存です。地図から店舗を選ぶか「地図の中心を店舗として登録」で位置を設定し、保存してください。
        </p>
      )}
      <GasStationMapPicker
        enabled
        selectedStationId={selectedOsmId}
        gasStationBrands={gasStationBrands}
        knownStations={knownGasStations}
        initialFocusOsmId={station.osmId}
        initialFocusView={station.osmId ? null : initialFocusView}
        initialFocusLabel={station.registeredName}
        onSelectStation={onSelectStation}
      />
    </>
  );
}

function SectionExpandMark({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-base leading-none text-slate-500 dark:border-slate-600 dark:text-slate-400"
    >
      {expanded ? "−" : "+"}
    </span>
  );
}

function ItemExpandMark({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-sm leading-none text-slate-400 dark:border-slate-600"
    >
      {expanded ? "−" : "+"}
    </span>
  );
}

type RegisteredGasStationSettingsProps = {
  stations: RegisteredGasStationRecord[];
  gasStationBrands: GasStationBrandRecord[];
};

function sortStationList(
  stations: RegisteredGasStationRecord[],
): RegisteredGasStationRecord[] {
  return [...stations].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      left.registeredName.localeCompare(right.registeredName, "ja"),
  );
}

function toKnownGasStation(station: RegisteredGasStationRecord): KnownGasStation {
  return {
    id: station.id,
    osmId: station.osmId,
    registeredName: station.registeredName,
    brand: station.brand,
  };
}

export function RegisteredGasStationSettings({
  stations,
  gasStationBrands,
}: RegisteredGasStationSettingsProps) {
  const router = useRouter();
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [showHiddenStations, setShowHiddenStations] = useState(false);
  const [orderedStations, setOrderedStations] = useState(() => sortStationList(stations));
  const [syncedStations, setSyncedStations] = useState(stations);
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [reorderingStationId, setReorderingStationId] = useState<string | null>(null);

  if (stations !== syncedStations) {
    setSyncedStations(stations);
    setOrderedStations(sortStationList(stations));
  }

  const hiddenCount = orderedStations.filter((station) => station.hiddenFromPicker).length;
  const knownGasStations = useMemo(
    () => orderedStations.map(toKnownGasStation),
    [orderedStations],
  );
  const displayedStations = orderedStations.filter(
    (station) => showHiddenStations || !station.hiddenFromPicker,
  );

  async function handleMove(stationId: string, direction: "up" | "down") {
    const visibleStations = orderedStations.filter(
      (station) => showHiddenStations || !station.hiddenFromPicker,
    );
    const currentIndex = visibleStations.findIndex((station) => station.id === stationId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= visibleStations.length) {
      return;
    }

    const targetStationId = visibleStations[targetIndex].id;
    const fullCurrentIndex = orderedStations.findIndex((station) => station.id === stationId);
    const fullTargetIndex = orderedStations.findIndex(
      (station) => station.id === targetStationId,
    );

    const nextOrdered = [...orderedStations];
    [nextOrdered[fullCurrentIndex], nextOrdered[fullTargetIndex]] = [
      nextOrdered[fullTargetIndex],
      nextOrdered[fullCurrentIndex],
    ];

    setReorderingStationId(stationId);
    setReorderError(null);

    const result = await reorderRegisteredGasStationsAction(
      nextOrdered.map((station) => station.id),
    );

    if (!result.ok) {
      setReorderError(result.error ?? "並び順の更新に失敗しました");
      setReorderingStationId(null);
      return;
    }

    setOrderedStations(nextOrdered);
    setReorderingStationId(null);
    router.refresh();
  }

  function handleExpandStation(stationId: string) {
    setExpandedStationId((current) => (current === stationId ? null : stationId));
  }

  const visibleCount = orderedStations.length - (showHiddenStations ? 0 : hiddenCount);
  const collapsedSummary =
    orderedStations.length === 0
      ? "登録済みの店舗はまだありません"
      : hiddenCount > 0
        ? `${visibleCount}件を表示（非表示 ${hiddenCount}件）`
        : `${orderedStations.length}件の店舗を登録中`;

  return (
    <section className="app-card-muted p-6">
      <button
        type="button"
        onClick={() => setSectionExpanded((current) => !current)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={sectionExpanded}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            登録店舗
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {sectionExpanded
              ? "給油記録で登録した店舗の名称・位置を編集・削除できます。店舗をタップすると編集画面が開きます。"
              : collapsedSummary}
          </p>
        </div>
        <SectionExpandMark expanded={sectionExpanded} />
      </button>

      {sectionExpanded && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          {reorderError && <p className="app-alert-error">{reorderError}</p>}

          {orderedStations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600">
              登録済みの店舗はまだありません。給油記録を登録するとここに表示されます。
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {displayedStations.map((station) => {
                  const globalIndex = orderedStations.findIndex((item) => item.id === station.id);
                  const visibleIndex = displayedStations.findIndex(
                    (item) => item.id === station.id,
                  );

                  return (
                    <StationRow
                      key={station.id}
                      station={station}
                      gasStationBrands={gasStationBrands}
                      knownGasStations={knownGasStations}
                      expanded={expandedStationId === station.id}
                      onExpand={() => handleExpandStation(station.id)}
                      orderNumber={globalIndex + 1}
                      sortableIndex={visibleIndex}
                      sortableCount={displayedStations.length}
                      isReordering={reorderingStationId === station.id}
                      onMoveUp={() => handleMove(station.id, "up")}
                      onMoveDown={() => handleMove(station.id, "down")}
                    />
                  );
                })}
              </ul>

              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHiddenStations((current) => !current)}
                  className="app-btn-secondary w-full sm:w-auto"
                >
                  {showHiddenStations
                    ? "非表示の店舗を隠す"
                    : `非表示の店舗を表示（${hiddenCount}件）`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function StationRow({
  station,
  gasStationBrands,
  knownGasStations,
  expanded,
  onExpand,
  orderNumber,
  sortableIndex,
  sortableCount,
  isReordering,
  onMoveUp,
  onMoveDown,
}: {
  station: RegisteredGasStationRecord;
  gasStationBrands: GasStationBrandRecord[];
  knownGasStations: KnownGasStation[];
  expanded: boolean;
  onExpand: () => void;
  orderNumber: number;
  sortableIndex: number;
  sortableCount: number;
  isReordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const router = useRouter();
  const defaults = getRegisteredStationEditDefaults(station, gasStationBrands);
  const boundUpdate = updateRegisteredGasStationAction.bind(null, station.id);
  const [updateState, updateAction, updatePending] = useActionState(
    async (prev: SettingsActionState, formData: FormData) => {
      const result = await boundUpdate(prev, formData);
      if (result.ok) {
        onExpand();
        router.refresh();
      }
      return result;
    },
    initialState,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hiddenPending, setHiddenPending] = useState(false);
  const [hiddenError, setHiddenError] = useState<string | null>(null);
  const [hiddenFromPicker, setHiddenFromPicker] = useState(station.hiddenFromPicker);
  const [brandSelect, setBrandSelect] = useState(defaults.brandSelect);
  const [customBrand, setCustomBrand] = useState(defaults.customBrand);
  const [storeName, setStoreName] = useState(defaults.storeName);
  const [selectedOsmId, setSelectedOsmId] = useState(station.osmId);
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(
    station.latitude,
  );
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(
    station.longitude,
  );

  const canMoveUp = sortableIndex > 0;
  const canMoveDown = sortableIndex >= 0 && sortableIndex < sortableCount - 1;

  async function handleHiddenChange(nextHidden: boolean) {
    setHiddenPending(true);
    setHiddenError(null);

    const result = await setRegisteredGasStationHiddenAction(station.id, nextHidden);

    if (!result.ok) {
      setHiddenError(result.error ?? "表示設定の更新に失敗しました");
      setHiddenPending(false);
      return;
    }

    setHiddenFromPicker(nextHidden);
    setHiddenPending(false);
    router.refresh();
  }

  function handleMapSelect(selection: {
    id: string;
    brandSelect: string;
    customBrand: string;
    storeName: string;
    lat?: number;
    lon?: number;
  }) {
    setSelectedOsmId(selection.id || null);
    setBrandSelect(selection.brandSelect);
    setCustomBrand(selection.customBrand);
    setStoreName(selection.storeName);

    if (selection.id) {
      setSelectedLatitude(selection.lat ?? null);
      setSelectedLongitude(selection.lon ?? null);
      return;
    }

    if (selection.lat != null && selection.lon != null) {
      setSelectedLatitude(selection.lat);
      setSelectedLongitude(selection.lon);
    }
  }

  function handleDeleteClick(event: MouseEvent) {
    event.stopPropagation();
    setDeleteError(null);
    setConfirmingDelete(true);
  }

  function handleDeleteCancel() {
    if (deleting) {
      return;
    }

    setConfirmingDelete(false);
    setDeleteError(null);
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    setDeleteError(null);

    const result = await deleteRegisteredGasStationAction(station.id);

    if (!result.ok) {
      setDeleteError(result.error ?? "削除に失敗しました");
      setDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <li
      className={`rounded-xl border transition-colors ${
        expanded
          ? hiddenFromPicker
            ? "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40"
            : "border-blue-200 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20"
          : hiddenFromPicker
            ? "border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/30"
            : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <div className="flex items-stretch gap-2 p-3">
        <div className="flex shrink-0 flex-col justify-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp || isReordering}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={`${station.registeredName}を上へ`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown || isReordering}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={`${station.registeredName}を下へ`}
          >
            ↓
          </button>
        </div>

        <button
          type="button"
          onClick={onExpand}
          className={`flex min-h-9 min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition ${
            expanded
              ? ""
              : "cursor-pointer hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
          }`}
          aria-expanded={expanded}
          aria-label={`${station.registeredName}を${expanded ? "閉じる" : "編集する"}`}
        >
          <div className={`min-w-0 flex-1 ${hiddenFromPicker && !expanded ? "opacity-70" : ""}`}>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  hiddenFromPicker
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {orderNumber}
              </span>
              <p
                className={`min-w-0 flex-1 truncate font-medium ${
                  hiddenFromPicker
                    ? "text-slate-500 dark:text-slate-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}
                title={station.registeredName}
              >
                {station.registeredName}
              </p>
              {hiddenFromPicker && (
                <span className="inline-flex rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-500">
                  非表示
                </span>
              )}
            </div>
            {station.brand && (
              <p
                className={`mt-0.5 text-xs ${
                  hiddenFromPicker
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-slate-500"
                }`}
              >
                ブランド: {station.brand}
              </p>
            )}
          </div>

          <ItemExpandMark expanded={expanded} />
        </button>
      </div>

      {expanded && (
        <form
          action={updateAction}
          className="space-y-3 border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700"
        >
          <input
            type="hidden"
            name="hiddenFromPicker"
            value={hiddenFromPicker ? "on" : "off"}
          />
          <input type="hidden" name="gasStationOsmId" value={selectedOsmId ?? ""} />
          <input
            type="hidden"
            name="gasStationLatitude"
            value={selectedLatitude ?? ""}
          />
          <input
            type="hidden"
            name="gasStationLongitude"
            value={selectedLongitude ?? ""}
          />

          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">位置（地図）</h3>
            <p className="mt-1 text-xs text-slate-500">
              地図から店舗を選ぶと位置情報が更新されます。ブランド名・店舗名も自動入力されます。
            </p>
            <div className="mt-3">
              <RegisteredStationMapSection
                station={station}
                gasStationBrands={gasStationBrands}
                knownGasStations={knownGasStations}
                selectedOsmId={selectedOsmId}
                onSelectStation={handleMapSelect}
              />
            </div>
            {selectedOsmId ? (
              <p className="mt-2 text-xs text-slate-500">地図 ID: {selectedOsmId}</p>
            ) : selectedLatitude != null && selectedLongitude != null ? (
              <p className="mt-2 text-xs text-slate-500">地図上の位置: 手動設定済み</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">地図上の位置は未設定です</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`station-brand-${station.id}`} className="app-label">
                ブランド
              </label>
              <select
                id={`station-brand-${station.id}`}
                name="gasStationBrands"
                required
                value={brandSelect}
                onChange={(event) => setBrandSelect(event.target.value)}
                className="app-input"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {gasStationBrands.map((brand) => (
                  <option key={brand.id} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            {brandSelect === OTHER_GAS_STATION_BRAND_NAME && (
              <div>
                <label htmlFor={`station-custom-brand-${station.id}`} className="app-label">
                  ブランド名
                </label>
                <input
                  id={`station-custom-brand-${station.id}`}
                  name="gasStationBrandOther"
                  type="text"
                  required
                  maxLength={30}
                  value={customBrand}
                  onChange={(event) => setCustomBrand(event.target.value)}
                  className="app-input"
                />
              </div>
            )}

            <div className={brandSelect === OTHER_GAS_STATION_BRAND_NAME ? "sm:col-span-2" : ""}>
              <label htmlFor={`station-store-name-${station.id}`} className="app-label">
                店舗名
              </label>
              <input
                id={`station-store-name-${station.id}`}
                name="gasStationStoreName"
                type="text"
                required
                maxLength={80}
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                className="app-input"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={hiddenFromPicker}
              disabled={hiddenPending}
              onChange={(event) => {
                const nextHidden = event.target.checked;
                setHiddenFromPicker(nextHidden);
                void handleHiddenChange(nextHidden);
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            登録画面に表示しない
          </label>
          {hiddenError && <p className="app-alert-error">{hiddenError}</p>}

          {updateState.error && <p className="app-alert-error">{updateState.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={updatePending} className="app-btn-primary px-3 py-2">
              {updatePending ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={onExpand}
              className="app-btn-secondary px-3 py-2"
            >
              閉じる
            </button>
            {!confirmingDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="app-btn-danger text-sm"
              >
                削除
              </button>
            )}
          </div>
          {confirmingDelete && (
            <DeleteConfirmPanel
              title={`店舗「${station.registeredName}」を削除しますか？`}
              description="登録店舗リストから削除します。既存の給油記録は残ります。この操作は取り消せません。"
              deleting={deleting}
              error={deleteError}
              onCancel={handleDeleteCancel}
              onConfirm={handleDeleteConfirm}
            />
          )}
        </form>
      )}
    </li>
  );
}
