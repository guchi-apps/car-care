import { getAssetManagerEndpoint } from "@/lib/kakeibo/config";

/**
 * Asset Manager の取り込み口へ支出を 1 件送る。
 *
 * ここが持つのは HTTP の呼び出しと失敗の分類だけにして、Zaim 側の知識
 * （カテゴリ・ジャンル・置き換えの条件）は持ち込まない。それらは Asset Manager の担当。
 */

/** Asset Manager 側の受け口（asset-manager の `app/api/receipts/import/route.ts`）。 */
const IMPORT_PATH = "/api/receipts/import";

/**
 * 待ち時間。
 *
 * Asset Manager は分類履歴で内訳が決まる支出をその場で Zaim Web 版へ登録するため、
 * ヘッドレスブラウザの操作（数十秒）まで含めて応答が返ってくる。**詰まりの検知にしか
 * 使えない長さ**にしてあるので、給油記録の保存を待たせないための工夫は呼び出し側で行う
 * （`fuel/actions.ts` は `after()` で送る）。
 */
const REQUEST_TIMEOUT_MS = 180_000;

/** Asset Manager が返す取り込み結果。 */
export type KakeiboImportStatus =
  | "imported"
  | "pendingReview"
  | "duplicate"
  | "ignored"
  | "error";

export type KakeiboImportPayload = {
  /** 送信元アプリの中での一意なキー。同じ値を送り直しても二重登録にならない。 */
  externalId: string;
  /** JST の暦日（YYYY-MM-DD）。 */
  date: string;
  /** 円。正の整数。 */
  amount: number;
  /** 店名。 */
  place: string;
  /** 品名。分類履歴のキーになるため、給油量のような毎回変わる値を混ぜない。 */
  name: string;
  /** 給油量のような使用量。品名の末尾へ足されるだけで、金額には使われない。 */
  usage?: string | null;
  /** 支払元の Zaim 口座名。決められなければ Asset Manager 側の既定カードへ落ちる。 */
  accountHint?: string | null;
  /** 抽出の確信度。画面から入力された値なので 1。 */
  confidence?: number;
  sourceMetadata?: Record<string, unknown>;
};

export type KakeiboImportResponse = {
  status: KakeiboImportStatus;
  receiptId?: number;
  zaimMoneyId?: number | null;
  reason?: string;
};

export type KakeiboImportFailureReason =
  /** car-care 側に ASSET_MANAGER_* が無い */
  | "notConfigured"
  /** シークレットが違う（401） */
  | "unauthorized"
  /** 送った内容が受け付けられない（400）。受け口が car-care 由来に未対応でもここに来る */
  | "invalid"
  /** 接続できない・応答が壊れている */
  | "unreachable"
  /** それ以外（5xx など） */
  | "failed";

export class KakeiboImportError extends Error {
  constructor(
    readonly reason: KakeiboImportFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "KakeiboImportError";
  }
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();

  if (!text) return {};

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { reason: text };
  } catch {
    return { reason: text };
  }
}

function describeFailure(reason: KakeiboImportFailureReason): string {
  switch (reason) {
    case "notConfigured":
      return "家計簿アプリの送信先が設定されていません";
    case "unauthorized":
      return "家計簿アプリに拒否されました（シークレットを確認してください）";
    case "invalid":
      return "家計簿アプリが内容を受け付けませんでした";
    case "unreachable":
      return "家計簿アプリへ接続できませんでした";
    case "failed":
      return "家計簿アプリでエラーが発生しました";
  }
}

export async function sendPaymentImport(
  payload: KakeiboImportPayload,
): Promise<KakeiboImportResponse> {
  const endpoint = getAssetManagerEndpoint();

  if (!endpoint) {
    throw new KakeiboImportError(
      "notConfigured",
      describeFailure("notConfigured"),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${endpoint.baseUrl}${IMPORT_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // 受け口は source ごとに一意キーの持ち方を変えている（asset-manager の
      // validatePaymentImportInput）。car-care からの送信であることを必ず名乗る。
      body: JSON.stringify({ source: "car-care", ...payload }),
      signal: controller.signal,
    });
  } catch (error) {
    console.error("[kakeibo] Asset Manager への送信に失敗:", error);
    throw new KakeiboImportError("unreachable", describeFailure("unreachable"));
  } finally {
    clearTimeout(timeout);
  }

  const body = await readBody(response);

  if (!response.ok) {
    const reason: KakeiboImportFailureReason =
      response.status === 401 || response.status === 403
        ? "unauthorized"
        : response.status === 400
          ? "invalid"
          : response.status === 404
            ? "unreachable"
            : "failed";

    const detail = typeof body.reason === "string" ? body.reason : null;

    throw new KakeiboImportError(
      reason,
      detail ? `${describeFailure(reason)}: ${detail}` : describeFailure(reason),
    );
  }

  const status = body.status;

  if (typeof status !== "string") {
    throw new KakeiboImportError("failed", describeFailure("failed"));
  }

  return {
    status: status as KakeiboImportStatus,
    receiptId: typeof body.receiptId === "number" ? body.receiptId : undefined,
    zaimMoneyId: typeof body.zaimMoneyId === "number" ? body.zaimMoneyId : null,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  };
}
