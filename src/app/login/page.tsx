import { AppMark } from "@/components/app-mark";
import { safeNextPath } from "@/lib/request-origin";

const errorMessages: Record<string, string> = {
  not_allowed:
    "許可されていないアカウントです。別の Google アカウントでお試しください。",
  auth_failed: "ログインに失敗しました。もう一度お試しください。",
};

type FeatureIconProps = {
  className?: string;
};

function FuelIcon({ className }: FeatureIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3.4s-6.6 7.4-6.6 11.3a6.6 6.6 0 0 0 13.2 0C18.6 10.8 12 3.4 12 3.4z"
        fill="currentColor"
      />
    </svg>
  );
}

function WrenchIcon({ className }: FeatureIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.9 3.9a5.2 5.2 0 0 0-6.7 6.7l-4.9 4.9a2.1 2.1 0 0 0 0 3l1.6 1.6a2.1 2.1 0 0 0 3 0l4.9-4.9a5.2 5.2 0 0 0 6.7-6.7l-3.2 3.2-2.9-.7-.7-2.9z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChartIcon({ className }: FeatureIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="currentColor">
        <rect x="4" y="13" width="4" height="7" rx="1.4" />
        <rect x="10" y="8.5" width="4" height="11.5" rx="1.4" />
        <rect x="16" y="4" width="4" height="16" rx="1.4" />
      </g>
    </svg>
  );
}

const features = [
  { short: "給油", long: "給油と燃費の記録", Icon: FuelIcon },
  { short: "メンテ", long: "メンテナンス時期のお知らせ", Icon: WrenchIcon },
  { short: "費用", long: "月ごとの費用をグラフで確認", Icon: ChartIcon },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCallbackUrl = params.callbackUrl;
  const callbackUrl = safeNextPath(
    typeof rawCallbackUrl === "string" ? rawCallbackUrl : null,
  );
  const rawError = params.error;
  const error = typeof rawError === "string" ? rawError : null;
  const errorMessage = error
    ? (errorMessages[error] ?? errorMessages.auth_failed)
    : null;

  return (
    <div className="app-brand-surface relative flex min-h-full flex-1 items-center justify-center overflow-hidden py-12">
      {/* 背景の装飾。情報は持たないので読み上げ対象から外す */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-80 -left-48 h-[780px] w-[780px] rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.30),rgba(125,211,252,0)_66%)] dark:bg-[radial-gradient(circle,rgba(125,211,252,0.14),rgba(125,211,252,0)_66%)]" />
        <svg
          viewBox="0 0 620 620"
          className="absolute -right-28 -bottom-44 h-[620px] w-[620px] opacity-[0.16]"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
        >
          <circle cx="310" cy="310" r="298" />
          <circle cx="310" cy="310" r="232" />
          <circle cx="310" cy="310" r="166" />
          <circle cx="310" cy="310" r="100" />
        </svg>
      </div>

      <div className="relative grid w-full max-w-[1080px] justify-items-center gap-9 px-6 text-center lg:grid-cols-[1fr_392px] lg:items-center lg:justify-items-stretch lg:gap-[88px] lg:px-16 lg:text-left">
        <div className="grid justify-items-center gap-3.5 lg:justify-items-start lg:gap-4">
          <AppMark
            idPrefix="login"
            className="h-[74px] w-[74px] rounded-[22.6%] shadow-[0_16px_34px_-12px_rgba(3,8,25,0.75)] lg:h-22 lg:w-22"
          />
          <h1 className="text-[34px] leading-tight font-bold text-white lg:text-[52px]">
            Car Care
          </h1>
          <p className="text-sm text-blue-100 lg:max-w-[30ch] lg:text-[17px] dark:text-slate-300">
            給油もメンテナンスも費用も、この 1 つで記録する。
          </p>

          <ul className="mt-1 flex flex-wrap justify-center gap-2 lg:mt-3 lg:flex-col lg:items-start lg:gap-3">
            {features.map(({ short, long, Icon }) => (
              <li
                key={short}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-blue-100 lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:text-[15px] dark:text-slate-300"
              >
                <span className="lg:flex lg:h-8 lg:w-8 lg:items-center lg:justify-center lg:rounded-[10px] lg:border lg:border-white/15 lg:bg-white/10">
                  <Icon className="h-3.5 w-3.5 opacity-90 lg:h-4 lg:w-4" />
                </span>
                <span className="lg:hidden">{short}</span>
                <span className="hidden lg:inline">{long}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full max-w-[392px] rounded-[22px] border border-white/50 bg-white p-6 text-left shadow-[0_34px_64px_-30px_rgba(2,8,28,0.8)] lg:justify-self-end lg:p-7 dark:border-slate-600/40 dark:bg-slate-800">
          <h2 className="text-[19px] font-bold text-slate-900 dark:text-slate-100">
            ログイン
          </h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Google アカウントでサインインします
          </p>

          {errorMessage && (
            <div className="app-alert-error mt-4 px-3 py-2.5">
              {errorMessage}
            </div>
          )}

          {/*
            ログインは素のリンクにしておく。onClick でログインを開始すると、クライアント JS の
            ハイドレーションが完了するまでボタンを押しても何も起きない状態が生まれる。
          */}
          <a
            href={`/auth/signin?next=${encodeURIComponent(callbackUrl)}`}
            className="mt-4 flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-[#3570ea] to-[#1f4fd0] text-[15px] font-semibold text-white shadow-lg shadow-blue-900/25 transition hover:from-[#2f66e8] hover:to-[#1b46bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
          >
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-white">
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </span>
            Google でログイン
          </a>

          <p className="mt-4 text-center text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
            許可された Google アカウントのみログインできます
          </p>
        </div>
      </div>
    </div>
  );
}
