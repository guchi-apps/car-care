type SignOutButtonProps = {
  variant?: "default" | "header";
};

/**
 * ログアウトはフォームの POST で行う。onClick に頼らないのは、クライアント JS の
 * ハイドレーション前でも押せるようにするため。GET にしないのは、ブラウザやリンクの
 * 先読みで意図せずログアウトさせられることを避けるため。
 */
export function SignOutButton({ variant = "default" }: SignOutButtonProps) {
  const className =
    variant === "header"
      ? "w-full rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
      : "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-600";

  return (
    <form method="post" action="/auth/signout">
      <button type="submit" className={className}>
        ログアウト
      </button>
    </form>
  );
}
