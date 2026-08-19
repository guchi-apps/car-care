"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  deleteFuelLogAction,
  deleteFuelLogsAction,
  registerFuelLogToZaimAction,
  updateFuelLogAction,
  type FuelActionState,
} from "@/app/(app)/fuel/actions";
import { DeleteConfirmPanel } from "@/components/delete-confirm-panel";
import { FuelFormFields } from "@/components/fuel-form-fields";
import {
  formatCurrency,
  formatDistanceKmValue,
  formatDistanceSinceLastFill,
  formatFuelAmount,
  formatFuelEfficiency,
  formatPricePerLiter,
} from "@/lib/fuel-display";
import { computeFuelEfficiencyForLog } from "@/lib/fuel-stats";
import type { GasStationBrandRecord } from "@/lib/gas-station-brand-types";
import type { KnownGasStation } from "@/lib/gas-stations";
import {
  buildCumulativeDistanceByLogId,
  getPreviousOdometer,
  type FuelLogClientRecord,
} from "@/lib/fuel-types";
import { formatDateJa } from "@/lib/vehicle-display";

type FuelListProps = {
  fuelLogs: FuelLogClientRecord[];
  vehicleInitialOdometer?: number | null;
  knownGasStations: KnownGasStation[];
  pickerGasStations: KnownGasStation[];
  gasStationBrands: GasStationBrandRecord[];
  /** Zaim と連携済みのときだけ、登録状態のバッジと「Zaimに登録」を出す。 */
  zaimEnabled?: boolean;
};

const initialState: FuelActionState = { ok: false };

function getEfficiencyForLog(fuelLog: FuelLogClientRecord): number | null {
  return computeFuelEfficiencyForLog(fuelLog);
}

function FuelEditForm({
  fuelLog,
  fuelLogs,
  vehicleInitialOdometer,
  onCancel,
  knownGasStations,
  pickerGasStations,
  gasStationBrands,
}: {
  fuelLog: FuelLogClientRecord;
  fuelLogs: FuelLogClientRecord[];
  vehicleInitialOdometer?: number | null;
  onCancel: () => void;
  knownGasStations: KnownGasStation[];
  pickerGasStations: KnownGasStation[];
  gasStationBrands: GasStationBrandRecord[];
}) {
  const router = useRouter();
  const boundAction = updateFuelLogAction.bind(null, fuelLog.id);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onCancel();
    }
  }, [state.ok, onCancel, router]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700"
    >
      <FuelFormFields
        fuelLog={fuelLog}
        idPrefix={`edit-${fuelLog.id}`}
        previousOdometer={getPreviousOdometer(
          fuelLogs,
          vehicleInitialOdometer,
          fuelLog.id,
        )}
        knownGasStations={knownGasStations}
        pickerGasStations={pickerGasStations}
        gasStationBrands={gasStationBrands}
      />

      {state.error && <p className="app-alert-error">{state.error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="app-btn-primary"
        >
          {pending ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="app-btn-secondary"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

function FuelLogCard({
  fuelLog,
  fuelLogs,
  vehicleInitialOdometer,
  cumulativeDistanceKm,
  knownGasStations,
  pickerGasStations,
  gasStationBrands,
  selectionMode,
  selected,
  onToggleSelect,
  zaimEnabled,
}: {
  fuelLog: FuelLogClientRecord;
  fuelLogs: FuelLogClientRecord[];
  vehicleInitialOdometer?: number | null;
  cumulativeDistanceKm: number;
  knownGasStations: KnownGasStation[];
  pickerGasStations: KnownGasStation[];
  gasStationBrands: GasStationBrandRecord[];
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  zaimEnabled: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [zaimSending, setZaimSending] = useState(false);
  const [zaimError, setZaimError] = useState<string | null>(null);
  const efficiency = getEfficiencyForLog(fuelLog);
  const registeredToZaim = Boolean(fuelLog.zaimMoneyId);

  async function handleZaimRegister() {
    setZaimSending(true);
    setZaimError(null);

    const result = await registerFuelLogToZaimAction(fuelLog.id);

    if (!result.ok) {
      setZaimError(result.error ?? "Zaimへの登録に失敗しました");
      setZaimSending(false);
      return;
    }

    setZaimSending(false);
    router.refresh();
  }

  function handleDeleteClick() {
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

    const result = await deleteFuelLogAction(fuelLog.id);

    if (!result.ok) {
      setDeleteError(result.error ?? "削除に失敗しました");
      setDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <article
      className={`app-card border-l-4 p-5 ${
        selectionMode && selected
          ? "border-l-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-l-amber-400"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {selectionMode && (
            <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                aria-label={`${formatDateJa(fuelLog.date)}の記録を選択`}
              />
            </label>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatDateJa(fuelLog.date)}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {formatDistanceSinceLastFill(fuelLog.distanceKm)}
              <span className="text-slate-500">
                {" "}
                · {formatDistanceKmValue(cumulativeDistanceKm)}
              </span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(fuelLog.totalCost)}
          </p>
          <p className="text-sm text-slate-500">
            {formatFuelAmount(fuelLog.fuelAmount)} ·{" "}
            {formatPricePerLiter(fuelLog.pricePerLiter)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {fuelLog.isFull && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            満タン
          </span>
        )}
        {efficiency !== null && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            燃費 {formatFuelEfficiency(efficiency)}
          </span>
        )}
        {fuelLog.gasStationBrands && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {fuelLog.gasStationBrands}
          </span>
        )}
        {zaimEnabled && (
          <span
            className={
              registeredToZaim
                ? "inline-flex items-center rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-medium text-lime-800 dark:bg-lime-900/40 dark:text-lime-200"
                : "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }
          >
            {registeredToZaim ? "Zaim登録済み" : "Zaim未登録"}
          </span>
        )}
      </div>

      {(fuelLog.gasStationName || fuelLog.gasStationBrands) && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {fuelLog.gasStationName ?? fuelLog.gasStationBrands}
        </p>
      )}

      {!editing && !selectionMode && !confirmingDelete && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {zaimEnabled && !registeredToZaim && (
              <button
                type="button"
                onClick={handleZaimRegister}
                disabled={zaimSending}
                className="app-btn-secondary border-lime-200 text-lime-800 hover:border-lime-300 hover:bg-lime-50 dark:border-lime-800 dark:text-lime-200 dark:hover:border-lime-700 dark:hover:bg-lime-950/50"
              >
                {zaimSending ? "登録中..." : "Zaimに登録"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="app-btn-secondary"
            >
              編集
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="app-btn-danger"
            >
              削除
            </button>
          </div>
          {zaimError && <p className="app-alert-error mt-2">{zaimError}</p>}
        </>
      )}

      {confirmingDelete && (
        <div className="mt-4">
          <DeleteConfirmPanel
            title="この給油記録を削除しますか？"
            description={`${formatDateJa(fuelLog.date)}の記録（${formatCurrency(fuelLog.totalCost)}）を削除します。この操作は取り消せません。`}
            deleting={deleting}
            error={deleteError}
            onCancel={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        </div>
      )}

      {editing && (
        <FuelEditForm
          fuelLog={fuelLog}
          fuelLogs={fuelLogs}
          vehicleInitialOdometer={vehicleInitialOdometer}
          knownGasStations={knownGasStations}
          pickerGasStations={pickerGasStations}
          gasStationBrands={gasStationBrands}
          onCancel={() => setEditing(false)}
        />
      )}
    </article>
  );
}

export function FuelList({
  fuelLogs,
  vehicleInitialOdometer = null,
  knownGasStations,
  pickerGasStations,
  gasStationBrands,
  zaimEnabled = false,
}: FuelListProps) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const selectedCount = selectedIds.size;
  const allSelected =
    fuelLogs.length > 0 && selectedCount === fuelLogs.length;
  const cumulativeDistanceByLogId = buildCumulativeDistanceByLogId(fuelLogs);

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setBulkDeleteError(null);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmingBulkDelete(false);
    setBulkDeleteError(null);
  }

  function toggleSelect(fuelLogId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(fuelLogId)) {
        next.delete(fuelLogId);
      } else {
        next.add(fuelLogId);
      }

      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(fuelLogs.map((fuelLog) => fuelLog.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleBulkDeleteClick() {
    if (selectedCount === 0) {
      return;
    }

    setBulkDeleteError(null);
    setConfirmingBulkDelete(true);
  }

  function handleBulkDeleteCancel() {
    if (bulkDeleting) {
      return;
    }
    setConfirmingBulkDelete(false);
    setBulkDeleteError(null);
  }

  async function handleBulkDeleteConfirm() {
    setBulkDeleting(true);
    setBulkDeleteError(null);

    const result = await deleteFuelLogsAction([...selectedIds]);

    if (!result.ok) {
      setBulkDeleteError(result.error ?? "削除に失敗しました");
      setBulkDeleting(false);
      return;
    }

    exitSelectionMode();
    setBulkDeleting(false);
    router.refresh();
  }

  if (fuelLogs.length === 0) {
    return (
      <section className="app-card-muted border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        <span className="text-3xl" aria-hidden="true">
          ⛽
        </span>
        <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
          給油記録はまだありません
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          <Link href="/fuel/new" className="font-medium text-amber-700 hover:underline dark:text-amber-300">
            給油を記録する
          </Link>
          から最初の給油を登録してください
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="app-section-title">給油履歴（{fuelLogs.length}件）</h2>
        {!selectionMode ? (
          <button
            type="button"
            onClick={enterSelectionMode}
            className="app-btn-secondary text-sm"
          >
            まとめて削除
          </button>
        ) : (
          <button
            type="button"
            onClick={exitSelectionMode}
            disabled={bulkDeleting}
            className="app-btn-secondary text-sm"
          >
            キャンセル
          </button>
        )}
      </div>

      {selectionMode && (
        <div className="app-card space-y-3 p-3">
          {!confirmingBulkDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={allSelected ? clearSelection : selectAll}
                disabled={bulkDeleting}
                className="app-btn-secondary text-sm"
              >
                {allSelected ? "選択解除" : "すべて選択"}
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteClick}
                disabled={bulkDeleting || selectedCount === 0}
                className="app-btn-danger text-sm"
              >
                {selectedCount > 0 ? `${selectedCount}件を削除` : "削除"}
              </button>
              <p className="ml-auto text-sm text-slate-500">
                {selectedCount > 0
                  ? `${selectedCount}件選択中`
                  : "削除する記録を選択してください"}
              </p>
            </div>
          ) : (
            <DeleteConfirmPanel
              title={`選択した${selectedCount}件の給油記録を削除しますか？`}
              description="選択した記録をすべて削除します。この操作は取り消せません。"
              deleting={bulkDeleting}
              error={bulkDeleteError}
              onCancel={handleBulkDeleteCancel}
              onConfirm={handleBulkDeleteConfirm}
            />
          )}
        </div>
      )}

      {fuelLogs.map((fuelLog) => (
        <FuelLogCard
          key={fuelLog.id}
          fuelLog={fuelLog}
          fuelLogs={fuelLogs}
          vehicleInitialOdometer={vehicleInitialOdometer}
          cumulativeDistanceKm={
            cumulativeDistanceByLogId.get(fuelLog.id) ?? fuelLog.distanceKm
          }
          knownGasStations={knownGasStations}
          pickerGasStations={pickerGasStations}
          gasStationBrands={gasStationBrands}
          selectionMode={selectionMode}
          selected={selectedIds.has(fuelLog.id)}
          onToggleSelect={() => toggleSelect(fuelLog.id)}
          zaimEnabled={zaimEnabled}
        />
      ))}
    </section>
  );
}
