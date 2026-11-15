"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { SignOutButton } from "@/components/sign-out-button";

type UserMenuProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

function UserAvatar({
  name,
  email,
  image,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  const initial = (name?.trim() || email?.trim() || "?").charAt(0).toUpperCase();

  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export function UserMenu({ name, email, image }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const displayName = name?.trim() || "ユーザー";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="アカウントメニューを開く"
        aria-expanded={open}
        aria-controls={menuId}
        className="app-btn-icon border border-border text-foreground hover:bg-surface-muted"
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-surface"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <UserAvatar name={name} email={email} image={image} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </p>
              {email && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {email}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 px-4 py-3">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  ユーザー名
                </dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {displayName}
                </dd>
              </div>
              {email && (
                <div>
                  <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    メールアドレス
                  </dt>
                  <dd className="mt-0.5 break-all text-slate-900 dark:text-slate-100">
                    {email}
                  </dd>
                </div>
              )}
            </dl>

            <div className="pt-1">
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
