import { safeNextPath } from "@/lib/request-origin";

const errorMessages: Record<string, string> = {
  not_allowed:
    "許可されていないアカウントです。別の Google アカウントでお試しください。",
  auth_failed: "ログインに失敗しました。もう一度お試しください。",
};

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
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="app-card overflow-hidden p-0 shadow-lg shadow-blue-900/10 dark:shadow-black/30">
          <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 px-6 py-8 text-center dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">
              🚗
            </div>
            <h1 className="text-2xl font-bold text-white">Car Care</h1>
            <p className="mt-1.5 text-sm text-blue-100">
              自家用車の維持管理アプリ
            </p>
          </div>

          <div className="space-y-4 p-6">
            {errorMessage && (
              <div className="app-alert-error px-4 py-3">{errorMessage}</div>
            )}

            {/*
              ログインは素のリンクにしておく。onClick でログインを開始すると、クライアント JS の
              ハイドレーションが完了するまでボタンを押しても何も起きない状態が生まれる。
            */}
            <a
              href={`/auth/signin?next=${encodeURIComponent(callbackUrl)}`}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
              Google でログイン
            </a>

            <p className="text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              許可された Google アカウントのみログインできます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
