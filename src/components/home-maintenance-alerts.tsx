import Link from "next/link";

import {
  formatMaintenanceRemainingDays,
  formatMaintenanceRemainingKm,
} from "@/lib/maintenance-display";
import type { MaintenanceScheduleItem } from "@/lib/maintenance-stats";

type HomeMaintenanceAlertsProps = {
  alerts: MaintenanceScheduleItem[];
};

export function HomeMaintenanceAlerts({ alerts }: HomeMaintenanceAlertsProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-2xl dark:bg-red-950/40">
          ⚠️
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="app-section-title">メンテナンスのアラート</h2>
          <p className="mt-1 text-sm app-text-muted">
            交換・整備の予定を過ぎている項目があります。
          </p>

          <ul className="mt-4 space-y-3">
            {alerts.map((item) => (
              <li
                key={item.categoryId}
                className="rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900/50 dark:bg-red-950/20"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {item.categoryName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.isOverdueKm && item.remainingKm != null && (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200">
                      {formatMaintenanceRemainingKm(item.remainingKm)}
                    </span>
                  )}
                  {item.isOverdueDays && item.remainingDays != null && (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200">
                      {formatMaintenanceRemainingDays(item.remainingDays)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <Link href="/maintenance" className="app-btn-secondary mt-4">
            メンテナンス画面を見る
          </Link>
        </div>
      </div>
    </section>
  );
}
