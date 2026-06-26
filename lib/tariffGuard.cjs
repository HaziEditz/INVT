'use strict';

/** Hardcoded placeholder tariff names that must never surface for live companies. */
const FORBIDDEN_PLACEHOLDER_TARIFF_NAMES = new Set(['standard']);

/** Production Invercargill tenant — guarded by regression tests. */
const PRODUCTION_TARIFF_GUARD_CID = '860869';

function isForbiddenPlaceholderTariffName(name) {
  const n = String(name ?? '').trim().toLowerCase();
  return !n || FORBIDDEN_PLACEHOLDER_TARIFF_NAMES.has(n);
}

function filterForbiddenTariffRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const name = String(row.TariffName ?? row.tariffName ?? row.name ?? row.zoneName ?? '').trim();
    return name && !isForbiddenPlaceholderTariffName(name);
  });
}

function collectTariffNamesFromMergedPayload(tariffs) {
  const names = [];
  if (!tariffs || typeof tariffs !== 'object') return names;
  for (const rec of Object.values(tariffs)) {
    if (!rec || typeof rec !== 'object') continue;
    const name = String(
      rec.TariffName ?? rec.tariffName ?? rec.name ?? rec.zoneName ?? rec.label ?? '',
    ).trim();
    if (name) names.push(name);
  }
  return names;
}

function assertNoForbiddenTariffNames(names, label = 'tariffs') {
  for (const name of names) {
    if (isForbiddenPlaceholderTariffName(name)) {
      throw new Error(`forbidden placeholder tariff name "${name}" in ${label}`);
    }
  }
}

function parseTariffRecordForTest(key, rec) {
  if (!rec || typeof rec !== 'object') return null;
  const name = String(
    rec.TariffName ?? rec.tariffName ?? rec.name ?? rec.zoneName ?? rec.label ?? '',
  ).trim();
  if (!name || isForbiddenPlaceholderTariffName(name)) return null;
  return {
    id: String(rec.Id ?? rec.id ?? key),
    name,
  };
}

module.exports = {
  FORBIDDEN_PLACEHOLDER_TARIFF_NAMES,
  PRODUCTION_TARIFF_GUARD_CID,
  isForbiddenPlaceholderTariffName,
  filterForbiddenTariffRows,
  collectTariffNamesFromMergedPayload,
  assertNoForbiddenTariffNames,
  parseTariffRecordForTest,
};
