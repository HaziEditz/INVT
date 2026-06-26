/** Hardcoded placeholder tariff names that must never surface for live companies. */
export const FORBIDDEN_PLACEHOLDER_TARIFF_NAMES = new Set(['standard']);

/** Production Invercargill tenant — guarded by regression tests. */
export const PRODUCTION_TARIFF_GUARD_CID = '860869';

export function isForbiddenPlaceholderTariffName(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim().toLowerCase();
  return !n || FORBIDDEN_PLACEHOLDER_TARIFF_NAMES.has(n);
}

export function filterForbiddenTariffRates<T extends { name?: string; TariffName?: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) => {
    const name = String(row.TariffName ?? row.name ?? '').trim();
    return name && !isForbiddenPlaceholderTariffName(name);
  });
}

export function filterForbiddenTariffDropdown<
  T extends { Id?: string | number; TariffName?: string; name?: string },
>(rows: T[]): T[] {
  return rows.filter((row) => {
    const name = String(row.TariffName ?? row.name ?? '').trim();
    return name && !isForbiddenPlaceholderTariffName(name);
  });
}
