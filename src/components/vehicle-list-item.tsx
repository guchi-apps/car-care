import Link from "next/link";

import type { VehicleRecord } from "@/lib/vehicles";
import {
  formatDateJa,
  formatFuelType,
  getVehicleSubtitle,
} from "@/lib/vehicle-display";

type VehicleListItemProps = {
  vehicle: VehicleRecord;
};

function getPreviewText(vehicle: VehicleRecord): string | null {
  const parts = [
    vehicle.fuelType ? formatFuelType(vehicle.fuelType) : null,
    vehicle.inspectionExpiry
      ? `車検 ${formatDateJa(vehicle.inspectionExpiry)}`
      : null,
    vehicle.licensePlate,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function VehicleListItem({ vehicle }: VehicleListItemProps) {
  const subtitle = getVehicleSubtitle(vehicle);
  const preview = getPreviewText(vehicle);

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className="app-card block p-5 transition hover:border-accent"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
              {vehicle.name}
            </h3>
            {vehicle.isActive && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                使用中
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 truncate text-sm app-text-subtle">{subtitle}</p>
          )}
          {preview && (
            <p className="mt-1 truncate text-xs app-text-subtle">{preview}</p>
          )}
        </div>
        <span
          className="shrink-0 text-xl text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          ›
        </span>
      </div>
    </Link>
  );
}
