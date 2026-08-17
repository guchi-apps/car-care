import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { FuelForm } from "@/components/fuel-form";
import { getCurrentUser } from "@/lib/auth-user";
import {
  listFuelLogsForVehicle,
} from "@/lib/fuel-logs";
import { ensureGasStationBrandsForUser } from "@/lib/gas-station-brands";
import {
  listKnownGasStationsForUser,
  listPickerGasStationsForUser,
  syncRegisteredGasStationsFromFuelLogs,
} from "@/lib/registered-gas-stations";
import {
  getPreviousOdometer,
  serializeFuelLogsForClient,
} from "@/lib/fuel-types";
import { getVehicleSubtitle } from "@/lib/vehicle-display";
import { getActiveVehicle } from "@/lib/vehicles";

export default async function FuelNewPage() {
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

  const previousOdometer =
    clientFuelLogs && activeVehicle
      ? getPreviousOdometer(clientFuelLogs, activeVehicle.initialOdometer)
      : (activeVehicle?.initialOdometer ?? null);

  if (userId) {
    await syncRegisteredGasStationsFromFuelLogs(userId);
  }

  const knownGasStations = userId ? await listKnownGasStationsForUser(userId) : [];
  const pickerGasStations = userId ? await listPickerGasStationsForUser(userId) : [];

  const gasStationBrands = userId
    ? await ensureGasStationBrandsForUser(userId)
    : [];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="給油を記録"
        subtitle={
          activeVehicle
            ? `${activeVehicle.name}${vehicleSubtitle ? `（${vehicleSubtitle}）` : ""}`
            : undefined
        }
        backHref="/fuel"
        backLabel="給油情報に戻る"
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
          <FuelForm
            vehicleId={activeVehicle.id}
            previousOdometer={previousOdometer}
            knownGasStations={knownGasStations}
            pickerGasStations={pickerGasStations}
            gasStationBrands={gasStationBrands}
          />
        )}
      </AppPage>
    </main>
  );
}
