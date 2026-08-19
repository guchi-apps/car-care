"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  createFuelLogAction,
  type FuelActionState,
} from "@/app/(app)/fuel/actions";
import { FuelFormFields } from "@/components/fuel-form-fields";
import { FuelLogConfirmPanel } from "@/components/fuel-log-confirm-panel";
import type { GasStationBrandRecord } from "@/lib/gas-station-brand-types";
import type { KnownGasStation } from "@/lib/gas-stations";

const initialState: FuelActionState = { ok: false };

type FuelFormProps = {
  vehicleId: string;
  previousOdometer?: number | null;
  knownGasStations?: KnownGasStation[];
  pickerGasStations?: KnownGasStation[];
  gasStationBrands: GasStationBrandRecord[];
};

export function FuelForm({
  vehicleId,
  previousOdometer = null,
  knownGasStations = [],
  pickerGasStations = [],
  gasStationBrands,
}: FuelFormProps) {
  const router = useRouter();
  const boundAction = createFuelLogAction.bind(null, vehicleId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [formKey, setFormKey] = useState("new");
  const [dismissedConfirmationToken, setDismissedConfirmationToken] = useState<
    number | null
  >(null);

  const showConfirmation =
    state.ok &&
    state.registered &&
    state.resetToken != null &&
    state.resetToken !== dismissedConfirmationToken;

  useEffect(() => {
    if (showConfirmation) {
      router.refresh();
    }
  }, [showConfirmation, router]);

  if (showConfirmation && state.registered) {
    return (
      <FuelLogConfirmPanel
        summary={state.registered}
        zaim={state.zaim}
        onRecordAnother={() => {
          setDismissedConfirmationToken(state.resetToken ?? null);
          setFormKey(String(Date.now()));
        }}
      />
    );
  }

  return (
    <section className="app-card border-l-4 border-l-amber-500">
      <h2 className="app-section-title">給油情報を入力</h2>
      <p className="mt-1 text-sm text-slate-500">
        前回給油からの距離を入力するとオドメーターが、満タン給油時は距離と給油量から燃費が自動計算されます。
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <FuelFormFields
          key={formKey}
          previousOdometer={previousOdometer}
          knownGasStations={knownGasStations}
          pickerGasStations={pickerGasStations}
          gasStationBrands={gasStationBrands}
        />

        {state.error && <p className="app-alert-error">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="app-btn-primary flex w-full bg-amber-600 py-3 shadow-amber-600/20 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
        >
          {pending ? "登録中..." : "給油を記録する"}
        </button>
      </form>
    </section>
  );
}
