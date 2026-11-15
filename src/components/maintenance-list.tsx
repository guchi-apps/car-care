"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  deleteMaintenanceLogAction,
  deleteMaintenanceLogsAction,
  updateMaintenanceLogAction,
  type MaintenanceActionState,
} from "@/app/(app)/maintenance/actions";
import { DeleteConfirmPanel } from "@/components/delete-confirm-panel";
import { MaintenanceFormFields } from "@/components/maintenance-form-fields";
import { formatCurrency } from "@/lib/fuel-display";
import type { MaintenanceCategoryRecord } from "@/lib/maintenance-category-types";
import {
  buildMaintenanceCategoryColorIndexById,
  getMaintenanceCategoryColorStyleById,
} from "@/lib/maintenance-category-colors";
import type { MaintenanceLogClientRecord } from "@/lib/maintenance-types";
import { formatDateJa, formatOdometer } from "@/lib/vehicle-display";

type MaintenanceListProps = {
  maintenanceLogs: MaintenanceLogClientRecord[];
  categories: MaintenanceCategoryRecord[];
};

const initialState: MaintenanceActionState = { ok: false };

function MaintenanceEditForm({
  maintenanceLog,
  categories,
  onCancel,
}: {
  maintenanceLog: MaintenanceLogClientRecord;
  categories: MaintenanceCategoryRecord[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const boundAction = updateMaintenanceLogAction.bind(null, maintenanceLog.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

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
      <MaintenanceFormFields
        maintenanceLog={maintenanceLog}
        categories={categories}
        idPrefix={`edit-${maintenanceLog.id}`}
      />

      {state.error && <p className="app-alert-error">{state.error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="app-btn-primary">
          {pending ? "保存中..." : "保存"}
        </button>
        <button type="button" onClick={onCancel} className="app-btn-secondary">
          キャンセル
        </button>
      </div>
    </form>
  );
}

function MaintenanceLogCard({
  maintenanceLog,
  categories,
  categoryColorIndexById,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  maintenanceLog: MaintenanceLogClientRecord;
  categories: MaintenanceCategoryRecord[];
  categoryColorIndexById: Map<string, number>;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoryColorStyle = getMaintenanceCategoryColorStyleById(
    maintenanceLog.categoryId,
    categoryColorIndexById,
  );

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

    const result = await deleteMaintenanceLogAction(maintenanceLog.id);

    if (!result.ok) {
      setDeleteError(result.error ?? "削除に失敗しました");
      setDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <article
      className={`app-card p-5 ${
        selectionMode && selected ? "border-accent" : ""
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
                aria-label={`${formatDateJa(maintenanceLog.date)}の記録を選択`}
              />
            </label>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatDateJa(maintenanceLog.date)}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {formatOdometer(maintenanceLog.odometer)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(maintenanceLog.cost)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: categoryColorStyle.badgeBackground,
            color: categoryColorStyle.badgeText,
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: categoryColorStyle.color }}
            aria-hidden
          />
          {maintenanceLog.categoryName}
        </span>
      </div>

      {maintenanceLog.notes && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
          {maintenanceLog.notes}
        </p>
      )}

      {!editing && !selectionMode && !confirmingDelete && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="app-btn-secondary"
          >
            編集
          </button>
          <button type="button" onClick={handleDeleteClick} className="app-btn-danger">
            削除
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-4">
          <DeleteConfirmPanel
            title="このメンテナンス記録を削除しますか？"
            description={`${formatDateJa(maintenanceLog.date)}の記録（${formatCurrency(maintenanceLog.cost)}）を削除します。この操作は取り消せません。`}
            deleting={deleting}
            error={deleteError}
            onCancel={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        </div>
      )}

      {editing && (
        <MaintenanceEditForm
          maintenanceLog={maintenanceLog}
          categories={categories}
          onCancel={() => setEditing(false)}
        />
      )}
    </article>
  );
}

export function MaintenanceList({
  maintenanceLogs,
  categories,
}: MaintenanceListProps) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const categoryColorIndexById = useMemo(
    () => buildMaintenanceCategoryColorIndexById(categories),
    [categories],
  );

  const filterCategories = useMemo(() => {
    const categoryIdsInLogs = new Set(
      maintenanceLogs.map((log) => log.categoryId),
    );

    return categories
      .filter((category) => categoryIdsInLogs.has(category.id))
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }, [categories, maintenanceLogs]);

  const filteredLogs = useMemo(() => {
    if (!selectedCategoryId) {
      return maintenanceLogs;
    }

    return maintenanceLogs.filter(
      (log) => log.categoryId === selectedCategoryId,
    );
  }, [maintenanceLogs, selectedCategoryId]);

  const selectedCount = selectedIds.size;
  const allSelected =
    filteredLogs.length > 0 && selectedCount === filteredLogs.length;

  function handleCategoryFilterClick(categoryId: string) {
    setSelectedCategoryId((current) =>
      current === categoryId ? null : categoryId,
    );
    setSelectedIds(new Set());
    setConfirmingBulkDelete(false);
    setBulkDeleteError(null);
  }

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

  function toggleSelect(maintenanceLogId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(maintenanceLogId)) {
        next.delete(maintenanceLogId);
      } else {
        next.add(maintenanceLogId);
      }

      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredLogs.map((log) => log.id)));
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

    const result = await deleteMaintenanceLogsAction([...selectedIds]);

    if (!result.ok) {
      setBulkDeleteError(result.error ?? "削除に失敗しました");
      setBulkDeleting(false);
      return;
    }

    exitSelectionMode();
    setBulkDeleting(false);
    router.refresh();
  }

  if (maintenanceLogs.length === 0) {
    return (
      <section className="app-card-muted border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        <span className="text-3xl" aria-hidden="true">
          🔧
        </span>
        <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
          メンテナンス記録はまだありません
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          <Link
            href="/maintenance/new"
            className="font-medium text-violet-700 hover:underline dark:text-violet-300"
          >
            メンテナンスを記録する
          </Link>
          から最初の整備を登録してください
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="app-section-title">
          整備履歴（
          {selectedCategoryId
            ? `${filteredLogs.length}件 / 全${maintenanceLogs.length}件`
            : `${maintenanceLogs.length}件`}
          ）
        </h2>
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

      {filterCategories.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {selectedCategoryId
              ? "同じカテゴリをもう一度タップするとすべて表示に戻ります"
              : "カテゴリをタップすると、その整備記録だけを表示します"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {filterCategories.map((category) => {
              const isSelected = selectedCategoryId === category.id;
              const isDimmed =
                selectedCategoryId != null && selectedCategoryId !== category.id;
              const colorStyle = getMaintenanceCategoryColorStyleById(
                category.id,
                categoryColorIndexById,
              );

              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => handleCategoryFilterClick(category.id)}
                    aria-pressed={isSelected}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition"
                    style={
                      isSelected
                        ? {
                            backgroundColor: colorStyle.filterSelectedBackground,
                            color: colorStyle.filterSelectedText,
                            boxShadow: `0 0 0 2px ${colorStyle.color}`,
                          }
                        : isDimmed
                          ? {
                              backgroundColor: colorStyle.filterDimmedBackground,
                              color: colorStyle.filterDimmedText,
                            }
                          : {
                              backgroundColor: colorStyle.filterIdleBackground,
                              color: colorStyle.filterIdleText,
                            }
                    }
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorStyle.color }}
                      aria-hidden
                    />
                    {category.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
              title={`選択した${selectedCount}件のメンテナンス記録を削除しますか？`}
              description="選択した記録をすべて削除します。この操作は取り消せません。"
              deleting={bulkDeleting}
              error={bulkDeleteError}
              onCancel={handleBulkDeleteCancel}
              onConfirm={handleBulkDeleteConfirm}
            />
          )}
        </div>
      )}

      {filteredLogs.length === 0 ? (
        <p className="app-card-muted border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600">
          このカテゴリの整備記録はありません
        </p>
      ) : (
        filteredLogs.map((maintenanceLog) => (
          <MaintenanceLogCard
            key={maintenanceLog.id}
            maintenanceLog={maintenanceLog}
            categories={categories}
            categoryColorIndexById={categoryColorIndexById}
            selectionMode={selectionMode}
            selected={selectedIds.has(maintenanceLog.id)}
            onToggleSelect={() => toggleSelect(maintenanceLog.id)}
          />
        ))
      )}
    </section>
  );
}
