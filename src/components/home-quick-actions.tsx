import Link from "next/link";

const fuelAccent =
  "bg-surface hover:border-amber-400 dark:hover:border-amber-500";
const fuelIconBg = "bg-amber-100 dark:bg-amber-900/40";
const maintenanceAccent =
  "bg-surface hover:border-violet-400 dark:hover:border-violet-500";
const maintenanceIconBg = "bg-violet-100 dark:bg-violet-900/40";

const actions = [
  {
    title: "給油を記録",
    desc: "給油量・料金を入力",
    emoji: "⛽",
    href: "/fuel/new",
    accent: fuelAccent,
    iconBg: fuelIconBg,
  },
  {
    title: "メンテナンスを記録",
    desc: "整備内容・費用を入力",
    emoji: "🔧",
    href: "/maintenance/new",
    accent: maintenanceAccent,
    iconBg: maintenanceIconBg,
  },
] as const;

export function HomeQuickActions() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        記録を追加
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`rounded-xl border border-border p-4 transition ${action.accent}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${action.iconBg}`}
                aria-hidden="true"
              >
                {action.emoji}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {action.title}
                </h3>
                <p className="mt-0.5 text-sm app-text-muted">{action.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
