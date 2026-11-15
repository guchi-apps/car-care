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
      ? "app-btn-secondary w-full"
      : "app-btn-secondary w-full";

  return (
    <form method="post" action="/auth/signout">
      <button type="submit" className={className}>
        ログアウト
      </button>
    </form>
  );
}
