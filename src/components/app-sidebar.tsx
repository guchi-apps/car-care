"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_VERSION } from "@/lib/app-version";
import { isNavActive, navItems } from "@/lib/nav-items";

type AppSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="border-b border-border px-4 py-5">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Car Care
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">メニュー</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = item.href ? isNavActive(pathname, item.href) : false;
              const disabled = !item.href;

              const content = (
                <>
                  <span className="text-lg" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {disabled && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                      準備中
                    </span>
                  )}
                </>
              );

              const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : disabled
                    ? "cursor-default text-slate-400 dark:text-slate-500"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`;

              return (
                <li key={item.title}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={className}
                      aria-current={active ? "page" : undefined}
                      onClick={onClose}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span className={className} aria-disabled="true">
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            v{APP_VERSION}
          </p>
        </div>
      </aside>
    </>
  );
}
