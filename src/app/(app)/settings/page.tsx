import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { GasStationBrandSettings } from "@/components/gas-station-brand-settings";
import { MaintenanceCategorySettings } from "@/components/maintenance-category-settings";
import { RegisteredGasStationSettings } from "@/components/registered-gas-station-settings";
import { APP_VERSION } from "@/lib/app-version";
import { getCurrentUser } from "@/lib/auth-user";
import { ensureGasStationBrandsForUser } from "@/lib/gas-station-brands";
import {
  ensureMaintenanceCategoriesForUser,
  getMaintenanceLogCountsByCategoryId,
} from "@/lib/maintenance-categories";
import { ensureRegisteredGasStationsForUser } from "@/lib/registered-gas-stations";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const userId = user?.id;
  const brands = userId ? await ensureGasStationBrandsForUser(userId) : [];
  const registeredStations = userId
    ? await ensureRegisteredGasStationsForUser(userId)
    : [];
  const maintenanceCategories = userId
    ? await ensureMaintenanceCategoriesForUser(userId)
    : [];
  const maintenanceLogCountByCategoryId = userId
    ? await getMaintenanceLogCountsByCategoryId(userId)
    : {};

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="設定"
        showHomeLink
        user={{
          name: user?.name,
          email: user?.email,
          image: user?.image,
        }}
      />

      <AppPage className="space-y-6">
        <GasStationBrandSettings brands={brands} />
        <RegisteredGasStationSettings
          stations={registeredStations}
          gasStationBrands={brands}
        />
        <MaintenanceCategorySettings
          categories={maintenanceCategories}
          logCountByCategoryId={maintenanceLogCountByCategoryId}
        />

        <section className="app-card-muted p-6">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            アプリ情報
          </h2>
          <dl className="mt-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">バージョン</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                v{APP_VERSION}
              </dd>
            </div>
          </dl>
        </section>
      </AppPage>
    </main>
  );
}
