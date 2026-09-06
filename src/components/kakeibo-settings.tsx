"use client";

import { useActionState } from "react";

import {
  updateKakeiboSettingsAction,
  type KakeiboActionState,
} from "@/app/(app)/settings/kakeibo-actions";
import type { KakeiboSettingView } from "@/lib/kakeibo/settings";
import { formatDateJa } from "@/lib/vehicle-display";

const initialState: KakeiboActionState = { ok: false };

type KakeiboSettingsProps = {
  setting: KakeiboSettingView;
};

function ZaimMark() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-lime-600 text-[10px] font-bold text-white dark:bg-lime-500"
    >
      Z
    </span>
  );
}

export function KakeiboSettings({ setting }: KakeiboSettingsProps) {
  const [state, formAction, pending] = useActionState(
    updateKakeiboSettingsAction,
    initialState,
  );

  return (
    <section className="app-card">
      <h2 className="app-section-title flex items-center gap-2">
        <ZaimMark />
        家計簿連携
      </h2>

      <p className="mt-3 text-sm app-text-muted">
        給油を記録すると、同じ内容を家計簿アプリ（Asset
        Manager）へ送ります。金額・給油日・スタンド名・給油量がそのまま入り、内訳を確認したうえでZaimへ登録されます。
      </p>
      <p className="mt-2 text-xs app-text-subtle">
        Zaimへの登録はAsset Manager側で行うため、あとからクレジットカードの明細で置き換えられます。
      </p>

      <form
        action={formAction}
        className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700"
      >
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="app-label">給油を記録したら家計簿へ送る</span>
            <span className="mt-0.5 block text-xs app-text-subtle">
              オフにすると、給油履歴の「家計簿へ送る」から1件ずつ送れます
            </span>
          </span>
          <input
            type="checkbox"
            name="autoSend"
            defaultChecked={setting.autoSend}
            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-lime-600 focus:ring-lime-500 dark:border-slate-600 dark:bg-slate-700"
          />
        </label>

        <div>
          <label htmlFor="kakeibo-card-account" className="app-label">
            支払元の口座名（Zaim）
          </label>
          <input
            id="kakeibo-card-account"
            name="cardAccountName"
            type="text"
            defaultValue={setting.cardAccountName ?? ""}
            placeholder="楽天カード"
            className="app-input"
          />
          <p className="mt-1 text-xs app-text-subtle">
            Zaimに登録しているカードの名前をそのまま入力します。空にすると、家計簿アプリ側で決めた既定のカードへ登録されます。
          </p>
        </div>

        {state.error && <p className="app-alert-error">{state.error}</p>}
        {state.ok && state.message && (
          <p className="app-alert-success">{state.message}</p>
        )}

        <button type="submit" disabled={pending} className="app-btn-primary">
          {pending ? "保存中..." : "保存"}
        </button>
      </form>

      <dl className="mt-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-700">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="app-text-subtle">最後に家計簿へ送った日</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
            {setting.lastSentAt ? formatDateJa(setting.lastSentAt) : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
