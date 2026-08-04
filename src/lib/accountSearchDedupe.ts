/**
 * Business-account search hits can contain multiple Firebase keys with the same
 * display name. Prefer a single row per normalized name for Create Job UX.
 */

export type AccountSearchHit = {
  Id: string | number;
  Name: string;
  PhoneNo?: string;
  Email?: string;
  AccountCode?: string;
  Type?: string;
};

function normalizeAccountName(name: string | undefined): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function accountHitScore(row: AccountSearchHit): number {
  let score = 0;
  if (String(row.AccountCode || '').trim()) score += 10;
  if (String(row.PhoneNo || '').trim()) score += 2;
  if (String(row.Email || '').trim()) score += 1;
  return score;
}

export function dedupeBusinessAccountHits(hits: AccountSearchHit[]): AccountSearchHit[] {
  if (!Array.isArray(hits) || hits.length <= 1) return Array.isArray(hits) ? hits : [];
  const byName = new Map<string, AccountSearchHit>();
  for (const row of hits) {
    const nameKey = normalizeAccountName(row.Name);
    if (!nameKey) {
      const id = String(row.Id ?? '');
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
      const prevId = String(prev.Id ?? '');
      const nextId = String(row.Id ?? '');
      if (nextId && (!prevId || nextId < prevId)) byName.set(nameKey, row);
    }
  }
  return Array.from(byName.values());
}
