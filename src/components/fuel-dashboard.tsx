import {
  formatDistanceKmValue,
  formatFuelEfficiency,
} from "@/lib/fuel-display";
import type { FuelDashboardStats } from "@/lib/fuel-stats";
import { formatOdometer } from "@/lib/vehicle-display";

import { FuelEfficiencyTrendChart } from "@/components/fuel-efficiency-trend-chart";
import { FuelPriceTrendChart } from "@/components/fuel-price-trend-chart";
import { MonthlyDistanceChart } from "@/components/monthly-distance-chart";

type FuelSummaryProps = {
  stats: FuelDashboardStats;
};

function FuelSummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-0 p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function FuelSummary({ stats }: FuelSummaryProps) {
  return (
    <section className="space-y-4">
      <div className="app-card overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-border">
          <FuelSummaryMetric
            label="総走行距離"
            value={
              stats.totalOdometerKm !== null
                ? formatOdometer(stats.totalOdometerKm)
                : "—"
            }
            hint={
              stats.totalOdometerKm !== null
                ? "最新のオドメーター"
                : "登録時走行距離または給油記録が必要"
            }
          />
          <FuelSummaryMetric
            label="登録以降の走行距離"
            value={formatDistanceKmValue(stats.totalDistanceKm)}
            hint="給油記録の走行距離合計"
          />
        </div>
      </div>

      <div className="app-card overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-border">
          <FuelSummaryMetric
            label="直近の燃費"
            value={
              stats.latestEfficiency !== null
                ? formatFuelEfficiency(stats.latestEfficiency)
                : "—"
            }
            hint="満タン給油ベース"
          />
          <FuelSummaryMetric
            label="平均燃費"
            value={
              stats.averageEfficiency !== null
                ? formatFuelEfficiency(stats.averageEfficiency)
                : "—"
            }
            hint={
              stats.efficiencyRecordCount > 0
                ? `${stats.efficiencyRecordCount}回分`
                : "給油記録が必要"
            }
          />
        </div>
      </div>
    </section>
  );
}

type FuelDashboardProps = {
  stats: FuelDashboardStats;
};

export function FuelDashboard({ stats }: FuelDashboardProps) {
  return (
    <section className="space-y-4">
      <div className="app-card p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          燃費
        </h3>
        <div className="mt-4">
          <FuelEfficiencyTrendChart
            efficiencyHistory={stats.efficiencyHistory.map((point) => ({
              date: point.date.toISOString(),
              kmPerLiter: point.kmPerLiter,
              distanceKm: point.distanceKm,
            }))}
          />
        </div>
      </div>

      <div className="app-card p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          ガソリン単価
        </h3>
        <div className="mt-4">
          <FuelPriceTrendChart
            priceTrend={stats.priceTrend.map((point) => ({
              date: point.date.toISOString(),
              pricePerLiter: point.pricePerLiter,
            }))}
          />
        </div>
      </div>

      <div className="app-card p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          走行距離
        </h3>
        <div className="mt-4">
          <MonthlyDistanceChart totals={stats.monthlyDistanceTotals} />
        </div>
      </div>
    </section>
  );
}
