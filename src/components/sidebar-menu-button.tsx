"use client";

import { useSidebar } from "@/components/app-shell";

export function SidebarMenuButton() {
  const sidebar = useSidebar();

  return (
    <button
      type="button"
      aria-label="メニューを開く"
      className="app-btn-icon mr-2 border border-border text-foreground hover:bg-surface-muted lg:hidden"
      onClick={sidebar.openSidebar}
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
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
