import Link from "next/link";

import { getVehicleSubtitle } from "@/lib/vehicle-display";
import type { VehicleRecord } from "@/lib/vehicles";

type HomeWelcomeCardProps = {
  activeVehicle: VehicleRecord | null;
  vehicleCount: number;
  userName?: string | null;
};

export function HomeWelcomeCard({
  activeVehicle,
  vehicleCount,
  userName,
}: HomeWelcomeCardProps) {
  const activeVehicleSubtitle = activeVehicle
    ? getVehicleSubtitle(activeVehicle)
    : null;

  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-2xl dark:bg-blue-900/40">
          🚗
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="app-section-title">
            ようこそ{userName ? `、${userName}さん` : ""}
          </h2>
          {activeVehicle ? (
            <p className="mt-2 text-sm leading-relaxed app-text-muted">
              使用中の車両:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeVehicle.name}
              </span>
              {activeVehicleSubtitle && (
                <span className="app-text-subtle"> （{activeVehicleSubtitle}）</span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed app-text-muted">
              まず車両を登録して、給油記録やメンテナンス管理を始めましょう。
            </p>
          )}
          <Link href="/vehicles" className="app-btn-primary mt-4">
            {vehicleCount > 0 ? "車両を管理する" : "車両を登録する"}
          </Link>
        </div>
      </div>
    </section>
  );
}
