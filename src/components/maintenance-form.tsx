"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import {
  createMaintenanceLogAction,
  type MaintenanceActionState,
} from "@/app/(app)/maintenance/actions";
import { MaintenanceFormFields } from "@/components/maintenance-form-fields";
import type { MaintenanceCategoryRecord } from "@/lib/maintenance-category-types";

const initialState: MaintenanceActionState = { ok: false };

type MaintenanceFormProps = {
  vehicleId: string;
  categories: MaintenanceCategoryRecord[];
};

export function MaintenanceForm({ vehicleId, categories }: MaintenanceFormProps) {
  const router = useRouter();
  const boundAction = createMaintenanceLogAction.bind(null, vehicleId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.push("/maintenance");
    }
  }, [state.ok, router]);

  return (
    <section className="app-card">
      <h2 className="app-section-title">メンテナンス情報を入力</h2>
      <p className="mt-1 text-sm text-slate-500">
        カテゴリは
        <Link href="/settings" className="font-medium text-violet-700 hover:underline dark:text-violet-300">
          設定画面
        </Link>
        から追加・編集できます。
      </p>

      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <MaintenanceFormFields categories={categories} />

        {state.error && <p className="app-alert-error">{state.error}</p>}

        <button
          type="submit"
          disabled={pending || categories.length === 0}
          className="app-btn-primary flex w-full bg-violet-600 py-3 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-500"
        >
          {pending ? "登録中..." : "メンテナンスを記録する"}
        </button>
      </form>
    </section>
  );
}
