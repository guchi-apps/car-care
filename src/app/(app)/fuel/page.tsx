import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { FuelDashboard, FuelSummary } from "@/components/fuel-dashboard";
import { FuelList } from "@/components/fuel-list";
import { getCurrentUser } from "@/lib/auth-user";
import {
  getFuelDashboardForVehicle,
  listFuelLogsForVehicle,
} from "@/lib/fuel-logs";
import { ensureGasStationBrandsForUser } from "@/lib/gas-station-brands";
import {
  listKnownGasStationsForUser,
  listPickerGasStationsForUser,
  syncRegisteredGasStationsFromFuelLogs,
} from "@/lib/registered-gas-stations";
import { serializeFuelLogsForClient } from "@/lib/fuel-types";
import { getVehicleSubtitle } from "@/lib/vehicle-display";
import { isZaimAvailableFor } from "@/lib/zaim/config";
import { getZaimConnection } from "@/lib/zaim/connection";
import { getActiveVehicle } from "@/lib/vehicles";

export default async function FuelPage() {
  const user = await getCurrentUser();
  const userId = user?.id;
  const activeVehicle = userId ? await getActiveVehicle(userId) : null;
  const vehicleSubtitle = activeVehicle
    ? getVehicleSubtitle(activeVehicle)
    : null;

  const fuelLogs =
    userId && activeVehicle
      ? await listFuelLogsForVehicle(userId, activeVehicle.id)
      : null;

  const clientFuelLogs = fuelLogs ? serializeFuelLogsForClient(fuelLogs) : null;

  const dashboardStats =
    userId && activeVehicle
      ? await getFuelDashboardForVehicle(userId, activeVehicle.id)
      : null;

  const gasStationBrands = userId
    ? await ensureGasStationBrandsForUser(userId)
    : [];

  if (userId && fuelLogs) {
    await syncRegisteredGasStationsFromFuelLogs(userId);
  }

  const knownGasStations = userId ? await listKnownGasStationsForUser(userId) : [];
  const pickerGasStations = userId ? await listPickerGasStationsForUser(userId) : [];

  // 連携していない人の履歴に Zaim の話は出さない。
  const zaimEnabled =
    userId && isZaimAvailableFor(user?.email)
      ? (await getZaimConnection(userId)) !== null
      : false;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="給油情報"
        subtitle={
          activeVehicle
            ? `${activeVehicle.name}${vehicleSubtitle ? `（${vehicleSubtitle}）` : ""}`
            : undefined
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
              給油記録を始めるには、まず車両を登録して使用中に設定してください。
            </p>
            <Link href="/vehicles" className="app-btn-primary mt-4">
              車両を登録する
            </Link>
          </section>
        ) : (
          <>
            <div className="flex">
              <Link
                href="/fuel/new"
                className="app-btn-primary w-full bg-amber-600 shadow-amber-600/20 hover:bg-amber-700 sm:ml-auto sm:w-auto dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                給油を記録する
              </Link>
            </div>

            {dashboardStats && <FuelSummary stats={dashboardStats} />}

            {dashboardStats && dashboardStats.logCount > 0 && (
              <FuelDashboard stats={dashboardStats} />
            )}

            {clientFuelLogs && (
              <FuelList
                fuelLogs={clientFuelLogs}
                vehicleInitialOdometer={activeVehicle.initialOdometer}
                knownGasStations={knownGasStations}
                pickerGasStations={pickerGasStations}
                gasStationBrands={gasStationBrands}
                zaimEnabled={zaimEnabled}
              />
            )}
          </>
        )}
      </AppPage>
    </main>
  );
}
