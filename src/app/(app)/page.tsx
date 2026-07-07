import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { HomeMaintenanceAlerts } from "@/components/home-maintenance-alerts";
import { HomeMonthlyCosts } from "@/components/home-monthly-costs";
import { HomeQuickActions } from "@/components/home-quick-actions";
import { HomeWelcomeCard } from "@/components/home-welcome-card";
import { PasskeyRegisterCard } from "@/components/passkey-register-card";
import { listFuelLogsForVehicle } from "@/lib/fuel-logs";
import { ensureMaintenanceCategoriesForUser } from "@/lib/maintenance-categories";
import {
  listMaintenanceLogsForVehicle,
  serializeMaintenanceLogsForClient,
} from "@/lib/maintenance-logs";
import {
  buildMaintenanceChartData,
  computeMaintenanceSchedule,
  getMaintenanceAlerts,
} from "@/lib/maintenance-stats";
import { hasRegisteredPasskeys } from "@/lib/passkey";
import { computeVehicleMonthlyCosts } from "@/lib/vehicle-costs";
import { getActiveVehicle, listVehicles } from "@/lib/vehicles";

export default async function HomePage() {
  const session = await auth();
  const email = session?.user?.email;
  const userId = session?.user?.id;

  const [hasPasskey, vehicles, activeVehicle, categories] = await Promise.all([
    email ? hasRegisteredPasskeys(email) : Promise.resolve(false),
    userId ? listVehicles(userId) : Promise.resolve([]),
    userId ? getActiveVehicle(userId) : Promise.resolve(null),
    userId ? ensureMaintenanceCategoriesForUser(userId) : Promise.resolve([]),
  ]);

  const [fuelLogs, maintenanceLogs] =
    userId && activeVehicle
      ? await Promise.all([
          listFuelLogsForVehicle(userId, activeVehicle.id),
          listMaintenanceLogsForVehicle(userId, activeVehicle.id),
        ])
      : [null, null];

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

  const maintenanceAlerts = getMaintenanceAlerts(schedule);

  const monthlyCosts = computeVehicleMonthlyCosts(
    fuelLogs ?? [],
    clientMaintenanceLogs,
  );

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="Car Care"
        subtitle="ダッシュボード"
        user={{
          name: session?.user?.name,
          email: session?.user?.email,
          image: session?.user?.image,
        }}
      />

      <AppPage className="space-y-6">
        {email && !hasPasskey && <PasskeyRegisterCard />}

        {maintenanceAlerts.length > 0 ? (
          <HomeMaintenanceAlerts alerts={maintenanceAlerts} />
        ) : (
          <HomeWelcomeCard
            activeVehicle={activeVehicle}
            vehicleCount={vehicles.length}
            userName={session?.user?.name}
          />
        )}

        <HomeQuickActions />

        <HomeMonthlyCosts {...monthlyCosts} />
      </AppPage>
    </main>
  );
}
