// Shared formatting helpers for VENEGE pricing display.

/** Format a numeric price with exactly two decimals + thousands separators. */
export function formatPrice(value: number | null, currency: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "No disponible";
  const fixed = value.toFixed(2);
  const [intPart, dec] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const number = `${withThousands},${dec}`;
  return currency === "Bs" ? `${number} Bs` : `$ ${number}`;
}

export function isAvailable(value: number | null): boolean {
  return value !== null && value !== undefined && !Number.isNaN(value);
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return "Sin sincronizar";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
