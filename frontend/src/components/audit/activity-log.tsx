"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  PackagePlus,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Undo2,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { fetchApi, getBusinessId } from "@/lib/api";
import {
  activityTitle,
  categoryOptions,
  changeSummary,
  roleOptions,
  type ActivityCategory,
  type ActivityLog as ActivityLogItem,
  type ActivityPage,
  type ActivitySummary,
} from "@/lib/audit";
import { dayLabelJakarta, formatClockJakarta, jakartaDateKey } from "@/lib/datetime";
import { cn, formatNumber } from "@/lib/utils";
import { ActivityDetailModal } from "@/components/audit/activity-detail-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

interface Filters {
  q: string;
  category: string;
  role: string;
  startDate: string;
  endDate: string;
}

const initialFilters: Filters = { q: "", category: "ALL", role: "ALL", startDate: "", endDate: "" };

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-slate-950";

const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";

const iconTone: Record<ActivityCategory, string> = {
  TRANSACTION: "text-indigo-600 dark:text-indigo-300",
  PRODUCT: "text-sky-600 dark:text-sky-300",
  INVENTORY: "text-amber-600 dark:text-amber-300",
  EXPENSE: "text-rose-600 dark:text-rose-300",
  SHIFT: "text-teal-600 dark:text-teal-300",
  USER: "text-emerald-600 dark:text-emerald-300",
  SETTINGS: "text-violet-600 dark:text-violet-300",
};

function activityIcon(log: ActivityLogItem): LucideIcon {
  switch (log.entity_type) {
    case "PRODUCT":
      if (log.action === "STOCK_ADJUST") return Boxes;
      return log.action === "CREATE" ? PackagePlus : Pencil;
    case "SALE":
      return log.action === "CHECKOUT" ? ShoppingCart : Undo2;
    case "EXPENSE":
      return Wallet;
    case "SHIFT":
      return Clock;
    case "MEMBER":
      return UserCog;
    case "BUSINESS":
      return Settings;
    default:
      return ScrollText;
  }
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Terjadi kesalahan saat memuat riwayat aktivitas.";

function Stat({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  loading: boolean;
}) {
  return (
    <div>
      <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
      {loading ? (
        <Skeleton className="mt-3 h-7 w-14" />
      ) : (
        <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {value === null ? "—" : formatNumber(value)}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-start gap-4 py-4">
          <Skeleton className="h-5 w-5 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export interface ActivityLogCrumb {
  label: string;
  href: string;
}

export function ActivityLog({ parent }: { parent?: ActivityLogCrumb }) {
  const businessId = getBusinessId();

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(0);

  const [data, setData] = useState<ActivityPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [selected, setSelected] = useState<ActivityLogItem | null>(null);
  const requestId = useRef(0);

  // Debounce pencarian agar tidak menembak API tiap ketukan.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const timer = window.setTimeout(() => {
      setFilters((previous) => (previous.q === trimmed ? previous : { ...previous, q: trimmed }));
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadActivity = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");

    try {
      if (businessId === null) {
        throw new Error("Sesi login tidak ditemukan. Silakan masuk kembali.");
      }
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filters.q) params.set("q", filters.q);
      if (filters.category !== "ALL") params.set("category", filters.category);
      if (filters.role !== "ALL") params.set("role", filters.role);
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);

      const result = (await fetchApi(`/businesses/${businessId}/audit/activity?${params.toString()}`)) as ActivityPage;
      if (currentRequest !== requestId.current) return;
      setData(result);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setError(getErrorMessage(loadError));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [businessId, filters, page]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      if (businessId === null) return;
      setSummary((await fetchApi(`/businesses/${businessId}/audit/summary`)) as ActivitySummary);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void (async () => {
      await loadActivity();
    })();
  }, [loadActivity]);

  useEffect(() => {
    void (async () => {
      await loadSummary();
    })();
  }, [loadSummary]);

  const updateFilter = (patch: Partial<Filters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(0);
  };

  const resetFilters = () => {
    setSearchInput("");
    setFilters(initialFilters);
    setPage(0);
  };

  const todayKey = jakartaDateKey();
  const todayActive = filters.startDate === todayKey && filters.endDate === todayKey;
  const toggleToday = () =>
    updateFilter(todayActive ? { startDate: "", endDate: "" } : { startDate: todayKey, endDate: todayKey });

  const advancedActive = filters.role !== "ALL" || (!todayActive && (filters.startDate !== "" || filters.endDate !== ""));
  const hasActiveFilters =
    searchInput.trim() !== "" || filters.category !== "ALL" || filters.role !== "ALL" ||
    filters.startDate !== "" || filters.endDate !== "";

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <li>
              <Link href="/dashboard" className="transition hover:text-slate-700 dark:hover:text-slate-200">
                Dashboard
              </Link>
            </li>
            {parent ? (
              <>
                <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                <li>
                  <Link href={parent.href} className="transition hover:text-slate-700 dark:hover:text-slate-200">
                    {parent.label}
                  </Link>
                </li>
              </>
            ) : null}
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li aria-current="page" className="text-slate-600 dark:text-slate-300">Riwayat Aktivitas</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Riwayat Aktivitas
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pantau dan kelola seluruh aktivitas pengguna dalam sistem toko Anda.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat icon={Activity} label="Total aktivitas" value={summary?.total_activities ?? null} loading={summaryLoading} />
        <Stat icon={Users} label="Pengguna" value={summary?.total_users ?? null} loading={summaryLoading} />
        <Stat icon={CalendarClock} label="Hari ini" value={summary?.activities_today ?? null} loading={summaryLoading} />
      </div>

      <section aria-label="Daftar aktivitas" className="border-t border-slate-200 pt-6 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Riwayat aktivitas</h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reset
              </button>
            ) : null}
            <button
              type="button"
              aria-pressed={todayActive}
              onClick={toggleToday}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset transition",
                todayActive
                  ? "bg-indigo-600 text-white ring-indigo-600 dark:bg-indigo-500 dark:text-slate-950 dark:ring-indigo-500"
                  : "bg-slate-100 text-slate-700 ring-transparent hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              Hari ini
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <label htmlFor="activity-search" className="sr-only">Cari nama atau aktivitas</label>
            <input
              id="activity-search"
              type="search"
              value={searchInput}
              maxLength={100}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari nama atau aktivitas..."
              className={cn(inputClass, "h-12 rounded-2xl pl-10")}
            />
          </div>
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls="activity-advanced"
            aria-label="Filter lanjutan"
            onClick={() => setAdvancedOpen((open) => !open)}
            className={cn(
              "relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border transition",
              advancedOpen
                ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {advancedActive ? (
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
            ) : null}
          </button>
        </div>

        {advancedOpen ? (
          <div id="activity-advanced" className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/40">
            <div>
              <label htmlFor="activity-role" className={labelClass}>Role</label>
              <select
                id="activity-role"
                value={filters.role}
                onChange={(event) => updateFilter({ role: event.target.value })}
                className={inputClass}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="activity-start" className={labelClass}>Dari tanggal</label>
              <input
                id="activity-start"
                type="date"
                value={filters.startDate}
                max={filters.endDate || undefined}
                onChange={(event) => updateFilter({ startDate: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="activity-end" className={labelClass}>Sampai tanggal</label>
              <input
                id="activity-end"
                type="date"
                value={filters.endDate}
                min={filters.startDate || undefined}
                onChange={(event) => updateFilter({ endDate: event.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        ) : null}

        <div role="group" aria-label="Filter kategori aktivitas" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {categoryOptions.map((option) => {
            const isSelected = filters.category === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => updateFilter({ category: option.value })}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition",
                  isSelected
                    ? "bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {option.value === "ALL" ? "Semua" : option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-slate-100 dark:border-slate-800">
          {loading && !data ? (
            <FeedSkeleton />
          ) : error ? (
            <div className="pt-5">
              <ErrorState title="Riwayat aktivitas gagal dimuat" message={error} onRetry={() => void loadActivity()} />
            </div>
          ) : items.length === 0 ? (
            <div className="pt-5">
              <EmptyState
                compact
                icon={ScrollText}
                title={hasActiveFilters ? "Tidak ada aktivitas yang cocok" : "Belum ada aktivitas"}
                description={
                  hasActiveFilters
                    ? "Coba ubah atau reset filter pencarian."
                    : "Aktivitas pengguna akan tercatat di sini secara otomatis."
                }
                action={
                  hasActiveFilters ? (
                    <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset filter
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className={cn("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
              {items.map((log, index) => {
                const Icon = activityIcon(log);
                const day = jakartaDateKey(log.created_at);
                const showDay = index === 0 || day !== jakartaDateKey(items[index - 1].created_at);
                const subtitle = [log.user_name ?? "Sistem", log.entity_name, changeSummary(log)]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <Fragment key={log.id}>
                    {showDay ? (
                      <li className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {dayLabelJakarta(log.created_at)}
                      </li>
                    ) : null}
                    <li className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelected(log)}
                        aria-label={`Lihat detail: ${activityTitle(log)}`}
                        className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-start gap-4 rounded-xl px-2 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconTone[log.category])} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                            {activityTitle(log)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {subtitle}
                          </p>
                        </div>
                        <span className="shrink-0 pt-0.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                          {formatClockJakarta(log.created_at)}
                        </span>
                      </button>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <p>
              Menampilkan {formatNumber(items.length)} dari {formatNumber(total)} aktivitas
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                disabled={page === 0 || loading}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center font-semibold tabular-nums">
                {page + 1} / {formatNumber(totalPages)}
              </span>
              <button
                type="button"
                aria-label="Halaman berikutnya"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <ActivityDetailModal log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
