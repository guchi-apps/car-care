import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { VehicleDeleteForm } from "@/components/vehicle-delete-form";
import { VehicleDetails } from "@/components/vehicle-details";
import { getVehicleForSession } from "@/lib/vehicle-page";

type VehicleDeletePageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleDeletePage({
  params,
}: VehicleDeletePageProps) {
  const { id } = await params;
  const { vehicle, user } = await getVehicleForSession(id);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="車両を削除"
        subtitle={vehicle.name}
        backHref={`/vehicles/${vehicle.id}`}
        backLabel="詳細に戻る"
        user={{
          name: user?.name,
          email: user?.email,
          image: user?.image,
        }}
      />

      <AppPage>
        <section className="app-card border-l-4 border-l-red-500">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">
              ⚠️
            </span>
            <div>
              <h2 className="app-section-title">この車両を削除しますか？</h2>
              <p className="mt-2 text-sm leading-relaxed app-text-subtle">
                「{vehicle.name}」を削除すると、関連する給油記録・メンテナンス記録もすべて削除されます。
                この操作は取り消せません。
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide app-text-subtle">
              削除対象
            </p>
            <VehicleDetails vehicle={vehicle} />
          </div>

          <VehicleDeleteForm
            vehicleId={vehicle.id}
            cancelHref={`/vehicles/${vehicle.id}`}
          />
        </section>
      </AppPage>
    </main>
  );
}
