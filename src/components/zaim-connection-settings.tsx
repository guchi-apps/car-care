"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  disconnectZaimAction,
  updateZaimSettingsAction,
  type ZaimActionState,
} from "@/app/(app)/settings/zaim-actions";
import type { ZaimOption } from "@/lib/zaim/client";
import type { ZaimConnectionView } from "@/lib/zaim/connection";
import type { ZaimOptions } from "@/lib/zaim/options";
import { formatDateJa } from "@/lib/vehicle-display";

const initialState: ZaimActionState = { ok: false };

type ZaimConnectionSettingsProps = {
  connection: ZaimConnectionView | null;
  options: ZaimOptions | null;
  optionsError: string | null;
  notice: { kind: "success" | "error"; text: string } | null;
};

/** セレクトの value は `${id}\t${表示名}`（zaim-actions.ts の parseOptionValue と対）。 */
function toOptionValue(option: ZaimOption): string {
  return `${option.id}\t${option.name}`;
}

function findOptionValue(
  options: ZaimOption[] | undefined,
  id: string | null,
  fallbackName: string | null,
): string {
  if (!id) {
    return "";
  }

  const matched = options?.find((option) => option.id === id);

  if (matched) {
    return toOptionValue(matched);
  }

  // Zaim 側で名前が変わった／一覧を取れなかった場合でも、保存済みの選択は保持する。
  return `${id}\t${fallbackName ?? ""}`;
}

function StatusChip({ connected }: { connected: boolean }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        未連携
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-medium text-lime-800 dark:bg-lime-900/40 dark:text-lime-200">
      連携中
    </span>
  );
}

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

export function ZaimConnectionSettings({
  connection,
  options,
  optionsError,
  notice,
}: ZaimConnectionSettingsProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateZaimSettingsAction,
    initialState,
  );
  const [categoryValue, setCategoryValue] = useState(() =>
    findOptionValue(
      options?.categories,
      connection?.categoryId ?? null,
      connection?.categoryName ?? null,
    ),
  );
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const selectedCategoryId = categoryValue.split("\t")[0] || null;

  const genreOptions = useMemo(() => {
    const genres = options?.genres ?? [];

    if (!selectedCategoryId) {
      return genres;
    }

    const filtered = genres.filter(
      (genre) => genre.categoryId === selectedCategoryId,
    );

    // カテゴリとの対応が取れない場合（Zaim 側の設定次第）は絞り込まない。
    return filtered.length > 0 ? filtered : genres;
  }, [options?.genres, selectedCategoryId]);

  async function handleDisconnect() {
    setDisconnecting(true);
    setDisconnectError(null);

    const result = await disconnectZaimAction();

    if (!result.ok) {
      setDisconnectError(result.error ?? "連携の解除に失敗しました");
      setDisconnecting(false);
      return;
    }

    setDisconnecting(false);
    setConfirmingDisconnect(false);
    router.refresh();
  }

  return (
    <section className="app-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="app-section-title flex items-center gap-2">
          <ZaimMark />
          Zaim連携
        </h2>
        <StatusChip connected={Boolean(connection)} />
      </div>

      {notice && (
        <p
          className={`mt-3 ${notice.kind === "success" ? "app-alert-success" : "app-alert-error"}`}
        >
          {notice.text}
        </p>
      )}

      {!connection ? (
        <div className="mt-3 space-y-4">
          <p className="text-sm app-text-muted">
            給油を記録すると、同じ内容を家計簿アプリ Zaim
            の支出として登録します。金額・給油日・スタンド名がそのまま入ります。
          </p>

          {/* OAuth の開始は素のリンクにする。onClick で始めるとハイドレーション完了まで押せない。 */}
          <a
            href="/api/zaim/connect"
            className="app-btn-primary w-full bg-lime-600 shadow-lime-600/20 hover:bg-lime-700 sm:w-auto dark:bg-lime-500 dark:hover:bg-lime-400"
          >
            Zaimと連携する
          </a>

          <p className="text-xs app-text-subtle">
            Zaimの画面が開き、許可すると設定画面に戻ります。連携はログイン中のアカウントにだけ保存され、ほかのユーザーの給油記録がこのZaimへ登録されることはありません。
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-700">
              <dt className="app-text-subtle">Zaimアカウント</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {connection.zaimUserName ?? "（名前を取得できませんでした）"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-700">
              <dt className="app-text-subtle">連携日</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {formatDateJa(connection.createdAt)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="app-text-subtle">最後に登録した給油</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {connection.lastRegisteredAt
                  ? formatDateJa(connection.lastRegisteredAt)
                  : "—"}
              </dd>
            </div>
          </dl>

          {optionsError && <p className="app-alert-error">{optionsError}</p>}

          <form action={formAction} className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="app-label">
                  給油を記録したらZaimにも登録する
                </span>
                <span className="mt-0.5 block text-xs app-text-subtle">
                  オフにすると、給油履歴の「Zaimに登録」から1件ずつ登録できます
                </span>
              </span>
              <input
                type="checkbox"
                name="autoRegister"
                defaultChecked={connection.autoRegister}
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-lime-600 focus:ring-lime-500 dark:border-slate-600 dark:bg-slate-700"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="zaim-category" className="app-label">
                  カテゴリ
                </label>
                <select
                  id="zaim-category"
                  name="categoryId"
                  value={categoryValue}
                  onChange={(event) => setCategoryValue(event.target.value)}
                  className="app-input"
                >
                  <option value="">未選択</option>
                  {options?.categories.map((option) => (
                    <option key={option.id} value={toOptionValue(option)}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zaim-genre" className="app-label">
                  ジャンル
                </label>
                <select
                  id="zaim-genre"
                  name="genreId"
                  defaultValue={findOptionValue(
                    options?.genres,
                    connection.genreId,
                    connection.genreName,
                  )}
                  className="app-input"
                >
                  <option value="">未選択</option>
                  {genreOptions.map((option) => (
                    <option key={option.id} value={toOptionValue(option)}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zaim-account" className="app-label">
                  支払元
                </label>
                <select
                  id="zaim-account"
                  name="accountId"
                  defaultValue={findOptionValue(
                    options?.accounts,
                    connection.accountId,
                    connection.accountName,
                  )}
                  className="app-input"
                >
                  <option value="">指定しない</option>
                  {options?.accounts.map((option) => (
                    <option key={option.id} value={toOptionValue(option)}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {state.error && <p className="app-alert-error">{state.error}</p>}
            {state.ok && state.message && (
              <p className="app-alert-success">{state.message}</p>
            )}

            <button type="submit" disabled={pending} className="app-btn-primary">
              {pending ? "保存中..." : "登録先を保存"}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
            {!confirmingDisconnect ? (
              <button
                type="button"
                onClick={() => {
                  setDisconnectError(null);
                  setConfirmingDisconnect(true);
                }}
                className="app-btn-danger"
              >
                連携を解除
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm app-text-muted">
                  Zaimへのアクセス権を破棄します。すでにZaimへ登録した支出は消えません。
                </p>
                {disconnectError && (
                  <p className="app-alert-error">{disconnectError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="app-btn-danger"
                  >
                    {disconnecting ? "解除中..." : "解除する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDisconnect(false)}
                    disabled={disconnecting}
                    className="app-btn-secondary"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
