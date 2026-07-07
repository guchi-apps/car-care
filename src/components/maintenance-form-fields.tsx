"use client";

import type { MaintenanceCategoryRecord } from "@/lib/maintenance-category-types";
import {
  MAX_MAINTENANCE_NOTES_LENGTH,
  MIN_MAINTENANCE_COST,
} from "@/lib/maintenance-constants";
import type { MaintenanceLogClientRecord } from "@/lib/maintenance-types";
import { formatDateForInput } from "@/lib/vehicle-display";

type MaintenanceFormFieldsProps = {
  maintenanceLog?: MaintenanceLogClientRecord;
  categories: MaintenanceCategoryRecord[];
  idPrefix?: string;
};

export function MaintenanceFormFields({
  maintenanceLog,
  categories,
  idPrefix = "maintenance",
}: MaintenanceFormFieldsProps) {
  const dateId = `${idPrefix}-date`;
  const categoryId = `${idPrefix}-category`;
  const odometerId = `${idPrefix}-odometer`;
  const costId = `${idPrefix}-cost`;
  const notesId = `${idPrefix}-notes`;

  return (
    <>
      <div>
        <label htmlFor={dateId} className="app-label">
          実施日
        </label>
        <input
          id={dateId}
          name="date"
          type="date"
          required
          defaultValue={
            maintenanceLog
              ? formatDateForInput(maintenanceLog.date)
              : formatDateForInput(new Date())
          }
          className="app-input-date"
        />
      </div>

      <div>
        <label htmlFor={categoryId} className="app-label">
          カテゴリ
        </label>
        <select
          id={categoryId}
          name="categoryId"
          required
          defaultValue={maintenanceLog?.categoryId ?? ""}
          className="app-input"
        >
          <option value="" disabled>
            カテゴリを選択
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={odometerId} className="app-label">
          総走行距離（km）
        </label>
        <input
          id={odometerId}
          name="odometer"
          type="number"
          inputMode="numeric"
          required
          min={1}
          step={1}
          placeholder="例: 45000"
          defaultValue={maintenanceLog?.odometer ?? ""}
          className="app-input"
        />
      </div>

      <div>
        <label htmlFor={costId} className="app-label">
          費用（円）
        </label>
        <input
          id={costId}
          name="cost"
          type="number"
          inputMode="numeric"
          required
          min={MIN_MAINTENANCE_COST}
          step={1}
          placeholder="例: 8000"
          defaultValue={
            maintenanceLog !== undefined ? maintenanceLog.cost : ""
          }
          className="app-input"
        />
        <p className="mt-1 text-xs text-slate-500">
          車検などと同時に実施した作業は、別カテゴリの記録で0円と入力できます
        </p>
      </div>

      <div>
        <label htmlFor={notesId} className="app-label">
          メモ（任意）
        </label>
        <textarea
          id={notesId}
          name="notes"
          rows={3}
          maxLength={MAX_MAINTENANCE_NOTES_LENGTH}
          placeholder="作業内容や次回の目安など"
          defaultValue={maintenanceLog?.notes ?? ""}
          className="app-input min-h-[5rem] resize-y"
        />
        <p className="mt-1 text-xs text-slate-500">
          {MAX_MAINTENANCE_NOTES_LENGTH}文字以内
        </p>
      </div>

      {categories.length === 0 && (
        <p className="app-alert-error">
          カテゴリがありません。設定画面からカテゴリを追加してください。
        </p>
      )}
    </>
  );
}
