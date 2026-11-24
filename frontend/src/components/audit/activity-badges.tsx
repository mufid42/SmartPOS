import { Badge } from "@/components/ui/badge";
import { categoryLabel, type ActivityCategory } from "@/lib/audit";
import { roleLabel } from "@/lib/session";
import { cn } from "@/lib/utils";

const categoryStyles: Record<ActivityCategory, string> = {
  TRANSACTION:
    "bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20",
  PRODUCT:
    "bg-sky-50 text-sky-700 ring-sky-600/10 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
  INVENTORY:
    "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  EXPENSE:
    "bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
  SHIFT:
    "bg-teal-50 text-teal-700 ring-teal-600/10 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/20",
  USER:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  SETTINGS:
    "bg-violet-50 text-violet-700 ring-violet-600/10 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20",
};

export function CategoryBadge({ category }: { category: ActivityCategory }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        categoryStyles[category] ?? "bg-slate-100 text-slate-600 ring-slate-500/10"
      )}
    >
      {categoryLabel(category)}
    </span>
  );
}

const roleTones = { OWNER: "indigo", MANAGER: "sky", CASHIER: "slate" } as const;

export function RoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  const tone = roleTones[role as keyof typeof roleTones] ?? "slate";
  return <Badge tone={tone}>{roleLabel(role)}</Badge>;
}
