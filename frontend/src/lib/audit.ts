import { formatRupiah } from "@/lib/utils";
import { roleLabel } from "@/lib/session";

export type ActivityCategory =
  | "TRANSACTION"
  | "PRODUCT"
  | "INVENTORY"
  | "EXPENSE"
  | "SHIFT"
  | "USER"
  | "SETTINGS";

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  category: ActivityCategory;
  description: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityPage {
  items: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActivitySummary {
  total_activities: number;
  total_users: number;
  active_users: number;
  activities_today: number;
}

export const categoryOptions: { value: "ALL" | ActivityCategory; label: string }[] = [
  { value: "ALL", label: "Semua Aktivitas" },
  { value: "TRANSACTION", label: "Transaksi" },
  { value: "PRODUCT", label: "Produk" },
  { value: "INVENTORY", label: "Inventaris" },
  { value: "EXPENSE", label: "Pengeluaran" },
  { value: "SHIFT", label: "Shift Kasir" },
  { value: "USER", label: "Pengguna" },
  { value: "SETTINGS", label: "Pengaturan" },
];

export const roleOptions = [
  { value: "ALL", label: "Semua Role" },
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manajer" },
  { value: "CASHIER", label: "Kasir" },
];

export function categoryLabel(category: string) {
  return categoryOptions.find((option) => option.value === category)?.label ?? category;
}

const entityLabels: Record<string, string> = {
  PRODUCT: "Produk",
  SALE: "Transaksi",
  EXPENSE: "Pengeluaran",
  SHIFT: "Shift",
  MEMBER: "Pengguna",
  BUSINESS: "Toko",
};

export function entityLabel(entityType: string) {
  return entityLabels[entityType] ?? entityType;
}

const PRICE_FIELDS = ["selling_price", "cost_price"];

function changedKeys(log: ActivityLog): string[] {
  const before = log.before_data;
  const after = log.after_data;
  if (!before || !after) return [];
  return Object.keys(after).filter((key) => !sameValue(before[key], after[key]));
}

function sameValue(a: unknown, b: unknown) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  const numberA = Number(a);
  const numberB = Number(b);
  if (typeof a !== "boolean" && typeof b !== "boolean" && Number.isFinite(numberA) && Number.isFinite(numberB) && String(a).trim() !== "" && String(b).trim() !== "") {
    return numberA === numberB;
  }
  return String(a) === String(b);
}

export function activityTitle(log: ActivityLog): string {
  const { entity_type: entity, action } = log;

  if (entity === "PRODUCT") {
    if (action === "CREATE") return "Menambah Produk";
    if (action === "DEACTIVATE") return "Menonaktifkan Produk";
    if (action === "STOCK_ADJUST") return "Penyesuaian Stok";
    if (action === "UPDATE") {
      const keys = changedKeys(log);
      if (keys.length > 0 && keys.every((key) => PRICE_FIELDS.includes(key))) {
        return "Mengubah Harga Produk";
      }
      if (keys.length === 1 && keys[0] === "stock") return "Mengubah Stok Produk";
      return "Mengubah Produk";
    }
  }
  if (entity === "SALE") {
    if (action === "CHECKOUT") return "Transaksi Penjualan";
    if (action === "CANCEL") return "Membatalkan Transaksi";
    if (action === "RETURN") return "Retur Transaksi";
  }
  if (entity === "EXPENSE") {
    if (action === "CREATE") return "Menambah Pengeluaran";
    if (action === "UPDATE") return "Mengubah Pengeluaran";
    if (action === "DELETE") return "Menghapus Pengeluaran";
  }
  if (entity === "SHIFT") {
    if (action === "SHIFT_OPEN") return "Membuka Shift";
    if (action === "SHIFT_CLOSE") return "Menutup Shift";
  }
  if (entity === "MEMBER") {
    if (action === "CREATE") return "Menambah Pengguna";
    if (action === "UPDATE") return "Mengubah Pengguna";
    if (action === "DEACTIVATE") return "Menonaktifkan Pengguna";
  }
  if (entity === "BUSINESS" && action === "UPDATE") return "Mengubah Pengaturan Toko";

  const readable = action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `${readable} ${entityLabel(entity)}`;
}

// ---------------------------------------------------------------------------
// Detail perubahan (sebelum/sesudah)
// ---------------------------------------------------------------------------
const fieldLabels: Record<string, string> = {
  name: "Nama",
  sku: "SKU",
  selling_price: "Harga Jual",
  cost_price: "Harga Modal",
  stock: "Stok",
  low_stock_threshold: "Batas Stok Menipis",
  is_active: "Status",
  transaction_number: "No. Transaksi",
  total_amount: "Total",
  total_cost: "Total Modal",
  discount: "Diskon",
  payment_method: "Pembayaran",
  status: "Status",
  opening_cash: "Kas Awal",
  expected_cash: "Kas Seharusnya",
  actual_cash: "Kas Aktual",
  difference: "Selisih Kas",
  category: "Kategori",
  amount: "Jumlah",
  date: "Tanggal",
  description: "Deskripsi",
  full_name: "Nama",
  role: "Peran",
  location: "Lokasi",
};

const moneyFields = new Set([
  "selling_price",
  "cost_price",
  "total_amount",
  "total_cost",
  "discount",
  "opening_cash",
  "expected_cash",
  "actual_cash",
  "difference",
  "amount",
]);

const valueLabels: Record<string, string> = {
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  RETURNED: "Diretur",
  OPEN: "Dibuka",
  CLOSED: "Ditutup",
  CASH: "Tunai",
  TRANSFER: "Transfer",
  RENT: "Sewa",
  UTILITIES: "Utilitas",
  SUPPLIES: "Perlengkapan",
  OTHER: "Lainnya",
};

export function fieldLabel(key: string) {
  return fieldLabels[key] ?? key.replace(/_/g, " ");
}

export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "is_active") return value ? "Aktif" : "Nonaktif";
  if (key === "role") return roleLabel(String(value));
  if (moneyFields.has(key)) return formatRupiah(String(value));
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return valueLabels[text] ?? text;
}

export interface ChangeRow {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
}

export function buildChangeRows(log: ActivityLog): ChangeRow[] {
  const before = log.before_data;
  const after = log.after_data;
  if (!before && !after) return [];

  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const rows: ChangeRow[] = [];

  for (const key of keys) {
    if (before && after && sameValue(before[key], after[key])) continue;
    rows.push({
      key,
      label: fieldLabel(key),
      before: before ? formatAuditValue(key, before[key]) : null,
      after: after ? formatAuditValue(key, after[key]) : null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Ringkasan perubahan singkat untuk subjudul tiap baris aktivitas.
// ---------------------------------------------------------------------------
const CREATE_SUMMARY_KEYS: Record<string, string[]> = {
  PRODUCT: ["selling_price", "stock"],
  SALE: ["total_amount", "payment_method"],
  EXPENSE: ["category", "amount"],
  SHIFT: ["opening_cash", "actual_cash", "difference"],
  MEMBER: ["role"],
  BUSINESS: ["name"],
};

const MAX_SUMMARY_PARTS = 2;

export function changeSummary(log: ActivityLog): string | null {
  const { before_data: before, after_data: after } = log;

  // Ada nilai sebelum & sesudah: tampilkan apa yang berubah.
  if (before && after) {
    const rows = buildChangeRows(log);
    if (rows.length === 0) return null;
    const parts = rows
      .slice(0, MAX_SUMMARY_PARTS)
      .map((row) => `${row.label} ${row.before ?? "—"} → ${row.after ?? "—"}`);
    const rest = rows.length - MAX_SUMMARY_PARTS;
    return rest > 0 ? `${parts.join(" · ")} · +${rest} lainnya` : parts.join(" · ");
  }

  // Hanya nilai sesudah (data baru / shift dibuka): tampilkan nilai kunci.
  if (after) {
    const keys = CREATE_SUMMARY_KEYS[log.entity_type] ?? [];
    const parts = keys
      .filter((key) => after[key] !== null && after[key] !== undefined && after[key] !== "")
      .map((key) => `${fieldLabel(key)} ${formatAuditValue(key, after[key])}`);
    if (parts.length > 0) return parts.join(" · ");
  }

  return log.description;
}
