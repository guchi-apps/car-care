"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import {
  createVehicleAction,
  type VehicleActionState,
} from "@/app/(app)/vehicles/actions";
import { VehicleFormFields } from "@/components/vehicle-form-fields";

const initialState: VehicleActionState = { ok: false };

export function VehicleForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createVehicleAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <section className="app-card">
      <h2 className="app-section-title">車両を登録</h2>
      <p className="mt-1 text-sm app-text-subtle">
        車両名は必須です。車種名・型式・燃料種別・車検満了日の入力を推奨します。
      </p>

      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <VehicleFormFields />

        {state.error && (
          <p className="app-alert-error">
            {state.error}
          </p>
        )}

        {state.ok && (
          <p className="app-alert-success">
            車両を登録しました
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="app-btn-primary flex w-full py-3"
        >
          {pending ? "登録中..." : "車両を登録する"}
        </button>
      </form>
    </section>
  );
}
