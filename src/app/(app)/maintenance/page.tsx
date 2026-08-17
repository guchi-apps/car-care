import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { MaintenanceList } from "@/components/maintenance-list";
import { MaintenanceOdometerChart } from "@/components/maintenance-odometer-chart";
import { MaintenanceSchedulePanel } from "@/components/maintenance-schedule-panel";
import { getCurrentUser } from "@/lib/auth-user";
import { listFuelLogsForVehicle } from "@/lib/fuel-logs";
import { ensureMaintenanceCategoriesForUser } from "@/lib/maintenance-categories";
import {
  listMaintenanceLogsForVehicle,
  serializeMaintenanceLogsForClient,
} from "@/lib/maintenance-logs";
import {
  buildMaintenanceChartData,
  computeMaintenanceSchedule,
} from "@/lib/maintenance-stats";
import { getVehicleSubtitle } from "@/lib/vehicle-display";
import { getActiveVehicle } from "@/lib/vehicles";

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  const userId = user?.id;
  const activeVehicle = userId ? await getActiveVehicle(userId) : null;
  const vehicleSubtitle = activeVehicle
    ? getVehicleSubtitle(activeVehicle)
    : null;

  const categories = userId ? await ensureMaintenanceCategoriesForUser(userId) : [];

  const maintenanceLogs =
    userId && activeVehicle
      ? await listMaintenanceLogsForVehicle(userId, activeVehicle.id)
      : null;

  const fuelLogs =
    userId && activeVehicle
      ? await listFuelLogsForVehicle(userId, activeVehicle.id)
      : null;

  const clientMaintenanceLogs = maintenanceLogs
    ? serializeMaintenanceLogsForClient(maintenanceLogs)
    : [];

  const fuelOdometerSamples =
    fuelLogs?.map((log) => ({
      date: log.date,
      odometer: log.odometer,
      distanceKm: Number(log.distanceKm),
    })) ?? [];

  const chartData = activeVehicle
    ? buildMaintenanceChartData(
        categories,
        fuelOdometerSamples,
        clientMaintenanceLogs,
        activeVehicle.initialOdometer,
      )
    : null;

  const schedule = chartData
    ? computeMaintenanceSchedule(
        categories,
        clientMaintenanceLogs,
        chartData.currentOdometerKm,
      )
    : [];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="メンテナンス"
        subtitle={
          activeVehicle
            ? `${activeVehicle.name}${vehicleSubtitle ? `（${vehicleSubtitle}）` : ""}`
            : "カテゴリ別の整備履歴"
        }
        showHomeLink
        user={{
          name: user?.name,
          email: user?.email,
          image: user?.image,
        }}
      />

      <AppPage className="space-y-6">
        {!activeVehicle ? (
          <section className="app-card-muted border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
            <span className="text-3xl" aria-hidden="true">
              🚗
            </span>
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              使用中の車両がありません
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              メンテナンス記録を始めるには、まず車両を登録して使用中に設定してください。
            </p>
            <Link href="/vehicles" className="app-btn-primary mt-4">
              車両を登録する
            </Link>
          </section>
        ) : (
          <>
            <div className="flex">
              <Link
                href="/maintenance/new"
                className="app-btn-primary w-full bg-violet-600 shadow-violet-600/20 hover:bg-violet-700 sm:ml-auto sm:w-auto dark:bg-violet-500 dark:hover:bg-violet-400"
              >
                メンテナンスを記録する
              </Link>
            </div>

            <MaintenanceSchedulePanel
              schedule={schedule}
              currentOdometerKm={chartData?.currentOdometerKm ?? null}
            />

            {chartData && (
              <section className="app-card space-y-4">
                <div>
                  <h2 className="app-section-title">走行距離の推移</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    日付（横軸）と総走行距離（縦軸）の面グラフ。色付きの点はメンテナンス実施地点です。
                  </p>
                </div>
                <MaintenanceOdometerChart
                  timeline={chartData.timeline}
                  markers={chartData.markers}
                />
              </section>
            )}

            <p className="text-sm text-slate-500">
              カテゴリの追加・編集・交換間隔の設定は
              <Link href="/settings" className="font-medium text-violet-700 hover:underline dark:text-violet-300">
                設定画面
              </Link>
              から行えます。
            </p>

            {clientMaintenanceLogs.length > 0 && (
              <MaintenanceList
                maintenanceLogs={clientMaintenanceLogs}
                categories={categories}
              />
            )}
          </>
        )}
      </AppPage>
    </main>
  );
}
