"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CategoryBadge, RoleBadge } from "@/components/audit/activity-badges";
import { activityTitle, buildChangeRows, entityLabel, type ActivityLog } from "@/lib/audit";
import { formatDateTimeJakarta } from "@/lib/datetime";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

export function ActivityDetailModal({
  log,
  onClose,
}: {
  log: ActivityLog | null;
  onClose: () => void;
}) {
  if (!log) return null;

  const rows = buildChangeRows(log);
  const hasBefore = rows.some((row) => row.before !== null);
  const hasAfter = rows.some((row) => row.after !== null);
  const entity = entityLabel(log.entity_type);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={activityTitle(log)}
      description={log.description ?? undefined}
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Dilakukan oleh">{log.user_name ?? "Sistem"}</Field>
        {log.user_id ? <Field label="ID Pengguna">#{log.user_id}</Field> : null}
        {log.user_role ? (
          <Field label="Role">
            <RoleBadge role={log.user_role} />
          </Field>
        ) : null}
        <Field label="Kategori">
          <CategoryBadge category={log.category} />
        </Field>
        <Field label="Tanggal & waktu">{formatDateTimeJakarta(log.created_at)}</Field>
        <Field label="Jenis data">{entity}</Field>
        {log.entity_name ? <Field label={`Nama ${entity.toLowerCase()}`}>{log.entity_name}</Field> : null}
        {log.entity_id ? <Field label={`ID ${entity}`}>#{log.entity_id}</Field> : null}
      </dl>

      <div className="mt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Perubahan data
        </h3>
        {rows.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {log.before_data || log.after_data
              ? "Tidak ada perubahan nilai yang tercatat."
              : "Aktivitas ini tidak menyimpan nilai sebelum/sesudah."}
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-800/50 dark:text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2.5">Data</th>
                  {hasBefore ? <th scope="col" className="px-3 py-2.5">Sebelumnya</th> : null}
                  {hasAfter ? <th scope="col" className="px-3 py-2.5">Sekarang</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300">
                      {row.label}
                    </th>
                    {hasBefore ? (
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{row.before ?? "—"}</td>
                    ) : null}
                    {hasAfter ? (
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">{row.after ?? "—"}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
