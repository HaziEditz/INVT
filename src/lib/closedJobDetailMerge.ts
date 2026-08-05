/**
 * Merge allbookings + completedJobs for Closed Job detail parsing.
 *
 * Naive `{ ...ab, ...cj }` is wrong: completedJobs (SA schema) often carries
 * empty `fareBreakdown: {}` / `stepTimes: {}` or nulls that wipe rich
 * allbookings meter fields before parseClosedFareBreakdown / timeline run.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Parse JSON-stringified objects Firebase/legacy writers sometimes leave behind. */
export function coerceRecord(v: unknown): Record<string, unknown> | null {
  if (isPlainObject(v)) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(s) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function meaningfulValueCount(rec: Record<string, unknown> | null): number {
  if (!rec) return 0;
  let n = 0;
  for (const v of Object.values(rec)) {
    if (v == null || v === '') continue;
    if (isPlainObject(v) && Object.keys(v).length === 0) continue;
    n += 1;
  }
  return n;
}

/** Prefer the object with more non-empty keys; ties keep `a`. */
export function preferRicherRecord(a: unknown, b: unknown): Record<string, unknown> | null {
  const left = coerceRecord(a);
  const right = coerceRecord(b);
  const ls = meaningfulValueCount(left);
  const rs = meaningfulValueCount(right);
  if (ls === 0 && rs === 0) return null;
  if (rs > ls) return right;
  return left;
}

/** Deep-merge two plain objects; skip null/''/empty-object overlays. */
export function mergePreferDefined(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value == null || value === '') continue;
    if (isPlainObject(value) && Object.keys(value).length === 0) continue;
    const prev = out[key];
    if (isPlainObject(value) && isPlainObject(prev)) {
      out[key] = mergePreferDefined(prev, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Merge API `allbookings` + `completedJobs` nodes for detail parsers.
 * Nested fareBreakdown / stepTimes always take the richer of either source.
 */
export function mergeClosedDetailRaw(
  ab: Record<string, unknown> | null | undefined,
  cj: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!ab && !cj) return null;
  const a = ab && isPlainObject(ab) ? ab : {};
  const c = cj && isPlainObject(cj) ? cj : {};
  const merged = mergePreferDefined(a, c);

  const fare = preferRicherRecord(
    a.fareBreakdown ?? a.FareBreakdown,
    c.fareBreakdown ?? c.FareBreakdown,
  );
  if (fare) {
    merged.fareBreakdown = fare;
    merged.FareBreakdown = fare;
  } else {
    delete merged.fareBreakdown;
    delete merged.FareBreakdown;
  }

  const steps = preferRicherRecord(a.stepTimes ?? a.StepTimes, c.stepTimes ?? c.StepTimes);
  if (steps) {
    // Union keys from both so neither side drops timestamps the other has.
    const aSteps = coerceRecord(a.stepTimes ?? a.StepTimes) || {};
    const cSteps = coerceRecord(c.stepTimes ?? c.StepTimes) || {};
    const union = mergePreferDefined(aSteps, cSteps);
    merged.stepTimes = union;
    merged.StepTimes = union;
  } else {
    delete merged.stepTimes;
    delete merged.StepTimes;
  }

  return merged;
}
