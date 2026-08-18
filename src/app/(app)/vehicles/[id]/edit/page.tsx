import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { VehicleEditForm } from "@/components/vehicle-edit-form";
import { getVehicleForSession } from "@/lib/vehicle-page";

type VehicleEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VehicleEditPage({ params }: VehicleEditPageProps) {
  const { id } = await params;
  const { vehicle, user } = await getVehicleForSession(id);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="車両を編集"
        subtitle={vehicle.name}
        backHref={`/vehicles/${vehicle.id}`}
        backLabel="詳細に戻る"
        user={{
          name: user?.name,
          email: user?.email,
          image: user?.image,
        }}
      />

      <AppPage className="space-y-6">
        <section className="app-card border-l-4 border-l-blue-500">
          <h2 className="app-section-title">車両情報を編集</h2>
          <p className="mt-1 text-sm app-text-subtle">
            変更内容を入力して保存してください。
          </p>

          <div className="mt-5">
            <VehicleEditForm vehicle={vehicle} />
          </div>
        </section>

        <Link
          href={`/vehicles/${vehicle.id}`}
          className="app-btn-secondary inline-flex w-full justify-center py-3"
        >
          キャンセル
        </Link>
      </AppPage>
    </main>
  );
}
