import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth-user";
import { getVehicleForUser } from "@/lib/vehicles";

export async function getVehicleForSession(vehicleId: string) {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const vehicle = await getVehicleForUser(user.id, vehicleId);

  if (!vehicle) {
    notFound();
  }

  return { vehicle, user };
}
