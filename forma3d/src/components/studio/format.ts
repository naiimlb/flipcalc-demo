export type LengthUnit = "mm" | "cm" | "in";

export function formatLength(mm: number, unit: LengthUnit): string {
  if (unit === "cm") return `${(mm / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} cm`;
  if (unit === "in") return `${(mm / 25.4).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} in`;
  return `${Math.round(mm).toLocaleString("fr-FR")} mm`;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  return `${Math.round(grams).toLocaleString("fr-FR")} g`;
}

export function formatMoney(amount: number, currency = "EUR"): string {
  try {
    return amount.toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: amount < 20 ? 2 : 0 });
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m.toString().padStart(2, "0")}` : `${h} h`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return formatDate(iso);
}
