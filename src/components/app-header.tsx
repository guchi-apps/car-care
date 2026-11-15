import Link from "next/link";

import { SidebarMenuButton } from "@/components/sidebar-menu-button";
import { UserMenu } from "@/components/user-menu";

type AppHeaderUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  showHomeLink?: boolean;
  backHref?: string;
  backLabel?: string;
  user?: AppHeaderUser;
};

export function AppHeader({
  title,
  subtitle,
  showHomeLink = false,
  backHref,
  backLabel = "戻る",
  user,
}: AppHeaderProps) {
  const navigationLink = backHref ? (
    <Link
      href={backHref}
      className="mb-1 inline-flex items-center text-sm text-muted transition hover:text-foreground"
    >
      ← {backLabel}
    </Link>
  ) : showHomeLink ? (
    <Link
      href="/"
      className="mb-1 inline-flex items-center text-sm text-muted transition hover:text-foreground"
    >
      ← ホーム
    </Link>
  ) : null;

  return (
    <header className="border-b border-border bg-surface px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 lg:max-w-5xl">
        <div className="flex min-w-0 items-center">
          <SidebarMenuButton />
          <div className="min-w-0">
            {navigationLink}
            <h1 className="truncate text-lg font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="truncate text-sm text-muted">{subtitle}</p>
            )}
          </div>
        </div>
        <UserMenu
          name={user?.name}
          email={user?.email}
          image={user?.image}
        />
      </div>
    </header>
  );
}
