import { AppHeader } from "@/components/app-header";
import { AppPage } from "@/components/app-page";
import { VehicleForm } from "@/components/vehicle-form";
import { VehicleList } from "@/components/vehicle-list";
import { getCurrentUser } from "@/lib/auth-user";
import { listVehicles } from "@/lib/vehicles";

export default async function VehiclesPage() {
  const user = await getCurrentUser();
  const userId = user?.id;

  const vehicles = userId ? await listVehicles(userId) : [];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <AppHeader
        title="車両管理"
        showHomeLink
        user={{
          name: user?.name,
          email: user?.email,
          image: user?.image,
        }}
      />

      <AppPage className="space-y-6">
        <VehicleForm />
        <VehicleList vehicles={vehicles} />
      </AppPage>
    </main>
  );
}
