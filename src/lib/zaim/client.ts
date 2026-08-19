import {
  ZAIM_ACCESS_TOKEN_URL,
  ZAIM_API_BASE,
  ZAIM_REQUEST_TOKEN_URL,
} from "@/lib/zaim/config";
import {
  parseTokenResponse,
  zaimOAuthFetch,
  type ZaimToken,
} from "@/lib/zaim/oauth";

/**
 * Zaim API のうち、この機能で使うぶんだけを包む。
 *
 * Zaim の応答は数値 ID を数値で返したり文字列で返したりするため、この層で文字列へ揃える。
 * カテゴリ・ジャンル・口座の ID は利用者ごとに違う値なので、決め打ちにはできない。
 */

export type ZaimOption = {
  id: string;
  name: string;
  /** ジャンルだけが持つ。どのカテゴリに属するか。 */
  categoryId?: string;
};

export type ZaimAccountInfo = {
  id: string;
  name: string;
};

export class ZaimApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ZaimApiError";
    this.status = status;
  }
}

function toId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}

function isActive(entry: Record<string, unknown>): boolean {
  // Zaim は削除済みの項目を active: -1 で返す。0 を返すこともあるため、-1 以外を有効とみなす。
  const active = entry.active;
  return !(typeof active === "number" && active < 0);
}

async function readJson(response: Response, label: string): Promise<unknown> {
  const text = await response.text();

  if (!response.ok) {
    throw new ZaimApiError(
      `Zaim の${label}に失敗しました（HTTP ${response.status}）`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ZaimApiError(`Zaim の${label}の応答を読み取れませんでした`, 502);
  }
}

function pickList(payload: unknown, key: string): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const list = (payload as Record<string, unknown>)[key];

  if (!Array.isArray(list)) {
    return [];
  }

  return list.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object",
  );
}

function sortByName(options: ZaimOption[]): ZaimOption[] {
  return [...options].sort((left, right) =>
    left.name.localeCompare(right.name, "ja"),
  );
}

/** 連携の開始。リクエストトークンを取り、ユーザーを Zaim の認可画面へ送る。 */
export async function fetchZaimRequestToken(
  callbackUrl: string,
): Promise<ZaimToken> {
  const response = await zaimOAuthFetch({
    method: "GET",
    url: ZAIM_REQUEST_TOKEN_URL,
    oauthExtras: { oauth_callback: callbackUrl },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new ZaimApiError(
      `Zaim との連携を開始できませんでした（HTTP ${response.status}）`,
      response.status,
    );
  }

  return parseTokenResponse(body);
}

/** 認可後のコールバックで、リクエストトークンをアクセストークンへ交換する。 */
export async function fetchZaimAccessToken(
  requestToken: ZaimToken,
  verifier: string,
): Promise<ZaimToken> {
  const response = await zaimOAuthFetch({
    method: "GET",
    url: ZAIM_ACCESS_TOKEN_URL,
    token: requestToken,
    oauthExtras: { oauth_verifier: verifier },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new ZaimApiError(
      `Zaim のアクセストークンを取得できませんでした（HTTP ${response.status}）`,
      response.status,
    );
  }

  return parseTokenResponse(body);
}

/** 連携先の Zaim アカウントを確認する。表示名の取得を兼ねる。 */
export async function verifyZaimUser(
  token: ZaimToken,
): Promise<{ id: string | null; name: string | null }> {
  const response = await zaimOAuthFetch({
    method: "GET",
    url: `${ZAIM_API_BASE}/home/user/verify`,
    token,
  });

  const payload = await readJson(response, "アカウント確認");
  const me = (payload as Record<string, unknown>)?.me;

  if (!me || typeof me !== "object") {
    return { id: null, name: null };
  }

  const record = me as Record<string, unknown>;
  const name =
    (typeof record.name === "string" && record.name.trim()) ||
    (typeof record.login === "string" && record.login.trim()) ||
    null;

  return { id: toId(record.id), name };
}

/** 支出のカテゴリ一覧（payment のものだけ）。 */
export async function fetchZaimCategories(
  token: ZaimToken,
): Promise<ZaimOption[]> {
  const response = await zaimOAuthFetch({
    method: "GET",
    url: `${ZAIM_API_BASE}/home/category`,
    token,
  });

  const payload = await readJson(response, "カテゴリ取得");

  const options: ZaimOption[] = [];

  for (const entry of pickList(payload, "categories")) {
    const id = toId(entry.id);
    const name = typeof entry.name === "string" ? entry.name : null;

    if (!id || !name || !isActive(entry)) {
      continue;
    }

    if (entry.mode !== undefined && entry.mode !== "payment") {
      continue;
    }

    options.push({ id, name });
  }

  return sortByName(options);
}

/** ジャンル一覧。カテゴリで絞り込めるよう categoryId を持たせる。 */
export async function fetchZaimGenres(token: ZaimToken): Promise<ZaimOption[]> {
  const response = await zaimOAuthFetch({
    method: "GET",
    url: `${ZAIM_API_BASE}/home/genre`,
    token,
  });

  const payload = await readJson(response, "ジャンル取得");

  const options: ZaimOption[] = [];

  for (const entry of pickList(payload, "genres")) {
    const id = toId(entry.id);
    const name = typeof entry.name === "string" ? entry.name : null;

    if (!id || !name || !isActive(entry)) {
      continue;
    }

    options.push({
      id,
      name,
      categoryId: toId(entry.category_id) ?? undefined,
    });
  }

  return sortByName(options);
}

/** 支払元の口座一覧。 */
export async function fetchZaimAccounts(
  token: ZaimToken,
): Promise<ZaimOption[]> {
  const response = await zaimOAuthFetch({
    method: "GET",
    url: `${ZAIM_API_BASE}/home/account`,
    token,
  });

  const payload = await readJson(response, "口座取得");

  const options: ZaimOption[] = [];

  for (const entry of pickList(payload, "accounts")) {
    const id = toId(entry.id);
    const name = typeof entry.name === "string" ? entry.name : null;

    if (!id || !name || !isActive(entry)) {
      continue;
    }

    options.push({ id, name });
  }

  return sortByName(options);
}

export type ZaimPaymentInput = {
  /** YYYY-MM-DD（JST）。 */
  date: string;
  amount: number;
  categoryId: string;
  genreId: string;
  accountId?: string | null;
  /** 店名。Zaim の「お店」欄。 */
  place?: string | null;
  /** 品目。Zaim の「品目」欄。 */
  name?: string | null;
  comment?: string | null;
};

/** 支出を 1 件登録し、Zaim 側の money id を返す。 */
export async function createZaimPayment(
  token: ZaimToken,
  input: ZaimPaymentInput,
): Promise<string | null> {
  const params: Record<string, string> = {
    mapping: "1",
    category_id: input.categoryId,
    genre_id: input.genreId,
    amount: String(Math.round(input.amount)),
    date: input.date,
  };

  if (input.accountId) {
    params.from_account_id = input.accountId;
  }

  if (input.place) {
    params.place = input.place;
  }

  if (input.name) {
    params.name = input.name;
  }

  if (input.comment) {
    params.comment = input.comment;
  }

  const response = await zaimOAuthFetch({
    method: "POST",
    url: `${ZAIM_API_BASE}/home/money/payment`,
    token,
    params,
  });

  const payload = await readJson(response, "支出の登録");
  const money = (payload as Record<string, unknown>)?.money;

  if (money && typeof money === "object") {
    return toId((money as Record<string, unknown>).id);
  }

  return toId((payload as Record<string, unknown>)?.id);
}
