import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { MaintenanceForm } from "@/components/maintenance-form";
import { getCurrentUser } from "@/lib/auth-user";
import { ensureMaintenanceCategoriesForUser } from "@/lib/maintenance-categories";
import { getVehicleSubtitle } from "@/lib/vehicle-display";
import { getActiveVehicle } from "@/lib/vehicles";

export default async function MaintenanceNewPage() {
  const user = await getCurrentUser();
  const userId = user?.id;
  const activeVehicle = userId ? await getActiveVehicle(userId) : null;
  const vehicleSubtitle = activeVehicle
    ? getVehicleSubtitle(activeVehicle)
    : null;

  const categories = userId ? await ensureMaintenanceCategoriesForUser(userId) : [];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="メンテナンスを記録"
        subtitle={
          activeVehicle
            ? `${activeVehicle.name}${vehicleSubtitle ? `（${vehicleSubtitle}）` : ""}`
            : undefined
        }
        backHref="/maintenance"
        backLabel="メンテナンスに戻る"
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
          <MaintenanceForm vehicleId={activeVehicle.id} categories={categories} />
        )}
      </AppPage>
    </main>
  );
}
