/**
 * Business-account search hits can contain multiple Firebase keys with the same
 * display name. Prefer a single row per normalized name for Create Job UX.
 */

function normalizeAccountName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function accountHitScore(row) {
  let score = 0;
  const code = String(row.AccountCode || row.accountCode || '').trim();
  if (code) score += 10;
  const phone = String(row.PhoneNo || row.phone || '').trim();
  if (phone) score += 2;
  const email = String(row.Email || row.email || '').trim();
  if (email) score += 1;
  return score;
}

/**
 * @param {Array<{ Id?: unknown, id?: unknown, Name?: string, name?: string, AccountCode?: string, accountCode?: string }>} hits
 * @returns {typeof hits}
 */
function dedupeBusinessAccountHits(hits) {
  if (!Array.isArray(hits) || hits.length <= 1) return Array.isArray(hits) ? hits : [];
  const byName = new Map();
  for (const row of hits) {
    const nameKey = normalizeAccountName(row.Name ?? row.name);
    if (!nameKey) {
      // Keep nameless rows keyed by id so they are not dropped.
      const id = String(row.Id ?? row.id ?? '');
      byName.set(id ? `id:${id}` : `row:${byName.size}`, row);
      continue;
    }
    const prev = byName.get(nameKey);
    if (!prev) {
      byName.set(nameKey, row);
      continue;
    }
    const prevScore = accountHitScore(prev);
    const nextScore = accountHitScore(row);
    if (nextScore > prevScore) {
      byName.set(nameKey, row);
      continue;
    }
    if (nextScore === prevScore) {
      // Stable: prefer lexicographically smaller id (deterministic).
      const prevId = String(prev.Id ?? prev.id ?? '');
      const nextId = String(row.Id ?? row.id ?? '');
      if (nextId && (!prevId || nextId < prevId)) byName.set(nameKey, row);
    }
  }
  return Array.from(byName.values());
}

module.exports = {
  normalizeAccountName,
  dedupeBusinessAccountHits,
};
