const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIMEZONE = /(?:z|[+-]\d{2}:?\d{2})$/i;

/**
 * Backend mengirim datetime tanpa zona waktu (UTC). `new Date()` akan
 * menganggapnya waktu lokal, sehingga jam bergeser. Tambahkan "Z" bila string
 * belum punya zona waktu, lalu format sesuai zona waktu perangkat pengguna.
 */
export function parseApiDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = DATE_ONLY.test(trimmed) || HAS_TIMEZONE.test(trimmed)
    ? trimmed
    : `${trimmed}Z`;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseApiDateTime(value);
  if (!date) return value?.trim() ? value : "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  const date = parseApiDateTime(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Format berzona waktu Asia/Jakarta (WIB). Dipakai oleh halaman Riwayat
// Aktivitas agar waktu yang tampil tidak bergantung pada zona waktu perangkat.
// ---------------------------------------------------------------------------
const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function formatDateJakarta(
  value: string | null | undefined,
  month: "short" | "long" = "short"
): string {
  const date = parseApiDateTime(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    day: "numeric",
    month,
    year: "numeric",
  }).format(date);
}

export function formatTimeJakarta(value: string | null | undefined): string {
  const date = parseApiDateTime(value);
  if (!date) return "—";

  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute} WIB`;
}

export function formatDateTimeJakarta(value: string | null | undefined): string {
  if (!parseApiDateTime(value)) return "—";
  return `${formatDateJakarta(value, "long")}, ${formatTimeJakarta(value)}`;
}

/** Jam saja, mis. "10:42" (WIB). */
export function formatClockJakarta(value: string | null | undefined): string {
  const date = parseApiDateTime(value);
  if (!date) return "—";

  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/** Kunci tanggal kalender Jakarta "YYYY-MM-DD" (untuk filter dan pengelompokan hari). */
export function jakartaDateKey(value?: string | Date | null): string {
  const date = value instanceof Date || !value ? (value as Date | undefined) ?? new Date() : parseApiDateTime(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Label hari untuk pemisah feed: "Hari ini", "Kemarin", atau tanggal. */
export function dayLabelJakarta(value: string | null | undefined): string {
  const key = jakartaDateKey(value);
  if (!key) return "—";
  const today = jakartaDateKey();
  if (key === today) return "Hari ini";
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (key === yesterday.toISOString().slice(0, 10)) return "Kemarin";
  return formatDateJakarta(value, "long");
}
