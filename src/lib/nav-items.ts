export type MenuItem = {
  title: string;
  desc: string;
  emoji: string;
  href?: string;
  ready?: boolean;
  accent: string;
  iconBg: string;
};

const fuelAccent =
  "bg-surface hover:border-amber-400 dark:hover:border-amber-500";
const fuelIconBg = "bg-amber-100 dark:bg-amber-900/40";

export const menuItems: MenuItem[] = [
  {
    title: "給油を記録",
    desc: "給油量・料金を入力",
    emoji: "⛽",
    href: "/fuel/new",
    ready: true,
    accent: fuelAccent,
    iconBg: fuelIconBg,
  },
  {
    title: "給油情報",
    desc: "燃費・ガソリン代・履歴",
    emoji: "📊",
    href: "/fuel",
    ready: true,
    accent: fuelAccent,
    iconBg: fuelIconBg,
  },
  {
    title: "メンテナンス",
    desc: "カテゴリ別の整備履歴",
    emoji: "🔧",
    href: "/maintenance",
    ready: true,
    accent:
      "bg-surface hover:border-violet-400 dark:hover:border-violet-500",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
  },
  {
    title: "車両管理",
    desc: "複数台・買い替え対応",
    emoji: "🚙",
    href: "/vehicles",
    ready: true,
    accent:
      "bg-surface hover:border-emerald-400 dark:hover:border-emerald-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  {
    title: "設定",
    desc: "ブランド・登録店舗・メンテカテゴリ",
    emoji: "⚙️",
    href: "/settings",
    ready: true,
    accent:
      "bg-surface-muted",
    iconBg: "bg-slate-100 dark:bg-slate-700",
  },
];

export type NavItem = {
  title: string;
  href?: string;
  emoji: string;
  ready?: boolean;
};

export const navItems: NavItem[] = [
  { title: "ホーム", href: "/", emoji: "🏠" },
  ...menuItems.map(({ title, href, emoji, ready }) => ({
    title,
    href,
    emoji,
    ready,
  })),
];

/** Bottom nav / sidebar のアクティブ判定 */
export function isNavActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  // 閲覧 (/fuel) と記録 (/fuel/new) を別メニューとして扱う
  if (href === "/fuel") {
    return pathname === "/fuel";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** モバイル下部ナビ（ホーム・給油記録・給油情報・メンテナンス） */
export const bottomNavItems: NavItem[] = [
  { title: "ホーム", href: "/", emoji: "🏠" },
  { title: "給油を記録", href: "/fuel/new", emoji: "⛽" },
  { title: "給油情報", href: "/fuel", emoji: "📊" },
  { title: "メンテナンス", href: "/maintenance", emoji: "🔧" },
];
