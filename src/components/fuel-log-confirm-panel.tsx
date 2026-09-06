"use client";

import Link from "next/link";
import { useState } from "react";

import {
  sendFuelLogToKakeiboAction,
  type FuelLogRegisteredSummary,
} from "@/app/(app)/fuel/actions";
import type { KakeiboSendResult } from "@/lib/kakeibo/fuel-send";
import {
  formatCurrency,
  formatDistanceKmValue,
  formatFuelAmount,
  formatFuelEfficiency,
  formatPricePerLiter,
} from "@/lib/fuel-display";
import { formatDateJa } from "@/lib/vehicle-display";

type FuelLogConfirmPanelProps = {
  summary: FuelLogRegisteredSummary;
  kakeibo?: KakeiboSendResult;
  onRecordAnother?: () => void;
};

/**
 * 家計簿への送信結果。連携していない・自動送信がオフのときは何も出さない
 * （使っていない人の画面に家計簿の話を出さないため）。
 *
 * 自動送信は応答を待たずに走るため（`fuel/actions.ts` の `scheduleKakeiboSend`）、
 * 保存直後は `queued` になる。ボタンを押すと結果を取りに行き、送信済みなら
 * Asset Manager 側が重複として返すので二重登録にはならない。
 */
function KakeiboResultRow({
  fuelLogId,
  kakeibo,
}: {
  fuelLogId: string;
  kakeibo: KakeiboSendResult;
}) {
  const [result, setResult] = useState<KakeiboSendResult>(kakeibo);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    const state = await sendFuelLogToKakeiboAction(fuelLogId);
    setResult(
      state.kakeibo ?? {
        status: "failed",
        message: state.error ?? "家計簿へ送信できませんでした",
      },
    );
    setSending(false);
  }

  if (result.status === "unavailable" || result.status === "auto-off") {
    return null;
  }

  if (result.status === "sent" || result.status === "already") {
    return (
      <div className="mt-4 rounded-lg border border-lime-200 bg-lime-50 px-3 py-2.5 text-sm dark:border-lime-800 dark:bg-lime-950/40">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {result.status === "sent"
            ? "家計簿に登録しました"
            : "家計簿にはすでに送信済みです"}
        </p>
        {result.target && (
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {result.target}
          </p>
        )}
      </div>
    );
  }

  if (result.status === "queued" || result.status === "pending") {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {result.status === "queued"
            ? "家計簿アプリへ送信しています"
            : "家計簿アプリで確認待ちです"}
        </p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {result.status === "queued"
            ? "登録まで少し時間がかかります。"
            : "家計簿アプリで内訳を確認すると登録されます。"}
          {result.message ? `（${result.message}）` : ""}
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="app-btn-secondary mt-2 min-h-9 py-1.5 text-sm"
        >
          {sending ? "確認中..." : "送信状況を確認"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm dark:border-red-800 dark:bg-red-950/50">
      <p className="font-medium text-slate-900 dark:text-slate-100">
        家計簿へ送信できませんでした
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
        給油記録は保存されています。
        {result.message ? `（${result.message}）` : ""}
      </p>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="app-btn-secondary mt-2 min-h-9 py-1.5 text-sm"
      >
        {sending ? "送信中..." : "家計簿へ送る"}
      </button>
    </div>
  );
}

export function FuelLogConfirmPanel({
  summary,
  kakeibo,
  onRecordAnother,
}: FuelLogConfirmPanelProps) {
  const date = new Date(summary.date);

  return (
    <section className="app-card border-l-4 border-l-emerald-500 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        給油記録を登録しました
      </h2>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-700">
          <dt className="shrink-0 text-slate-500">給油日</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
            {formatDateJa(date)}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-700">
          <dt className="shrink-0 text-slate-500">スタンド</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
            {summary.gasStationName}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="text-xs text-slate-500">距離</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {formatDistanceKmValue(summary.distanceKm)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">オドメーター</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {summary.odometer != null
                ? `${summary.odometer.toLocaleString("ja-JP")} km`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">給油量</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {formatFuelAmount(summary.fuelAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">単価</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {formatPricePerLiter(summary.pricePerLiter)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">合計</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.totalCost)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">満タン</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {summary.isFull ? "はい" : "いいえ"}
            </dd>
          </div>
          {summary.fuelEfficiency !== null && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">燃費</dt>
              <dd className="font-medium text-emerald-700 dark:text-emerald-300">
                {formatFuelEfficiency(summary.fuelEfficiency)}
              </dd>
            </div>
          )}
        </div>
      </dl>

      {kakeibo && (
        <KakeiboResultRow fuelLogId={summary.fuelLogId} kakeibo={kakeibo} />
      )}

      <div className="mt-4 flex gap-2">
        <Link href="/fuel" className="app-btn-primary min-h-11 flex-1 text-center text-sm">
          給油一覧へ
        </Link>
        {onRecordAnother && (
          <button
            type="button"
            onClick={onRecordAnother}
            className="app-btn-secondary min-h-11 flex-1 text-sm"
          >
            続けて記録
          </button>
        )}
      </div>
    </section>
  );
}
