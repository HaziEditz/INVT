/**
 * Closed Job detail: merge allbookings+completedJobs must not wipe meter fields.
 * Reproduces blank Fare Breakdown / Timeline when Network JSON is rich.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Mirror src/lib/closedJobDetailMerge.ts + num/parse (keep in sync).
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function coerceRecord(v) {
  if (isPlainObject(v)) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(s);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function meaningfulValueCount(rec) {
  if (!rec) return 0;
  let n = 0;
  for (const v of Object.values(rec)) {
    if (v == null || v === '') continue;
    if (isPlainObject(v) && Object.keys(v).length === 0) continue;
    n += 1;
  }
  return n;
}
function preferRicherRecord(a, b) {
  const left = coerceRecord(a);
  const right = coerceRecord(b);
  const ls = meaningfulValueCount(left);
  const rs = meaningfulValueCount(right);
  if (ls === 0 && rs === 0) return null;
  if (rs > ls) return right;
  return left;
}
function mergePreferDefined(base, overlay) {
  const out = { ...base };
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
function mergeClosedDetailRaw(ab, cj) {
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
  const aSteps = coerceRecord(a.stepTimes ?? a.StepTimes) || {};
  const cSteps = coerceRecord(c.stepTimes ?? c.StepTimes) || {};
  if (meaningfulValueCount(aSteps) || meaningfulValueCount(cSteps)) {
    const union = mergePreferDefined(aSteps, cSteps);
    merged.stepTimes = union;
    merged.StepTimes = union;
  } else {
    delete merged.stepTimes;
    delete merged.StepTimes;
  }
  return merged;
}
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '')
    .trim()
    .replace(/[$,]/g, '');
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}
function parseClosedFareBreakdown(raw) {
  const fb = coerceRecord(raw.fareBreakdown ?? raw.FareBreakdown);
  if (fb) {
    const parsed = {
      flagFall: num(fb.flagFall ?? fb.FlagFall),
      distanceKm: num(fb.distanceKm ?? fb.DistanceKm),
      waitingMinutes: num(fb.waitingMinutes ?? fb.WaitingMinutes),
      waitingCharge: num(fb.waitingCharge ?? fb.WaitingCharge ?? fb.waitingCost),
      distanceCharge: num(fb.distanceCharge ?? fb.DistanceCharge ?? fb.RideCost),
      total: num(fb.total ?? fb.Total ?? fb.totalFare ?? fb.TotalFare),
    };
    if (Object.values(parsed).some((v) => v != null)) return parsed;
  }
  return null;
}
function parseTimestamp(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}
function timelineEventCount(raw) {
  const step = coerceRecord(raw.stepTimes) || coerceRecord(raw.StepTimes) || {};
  const keys = ['acceptedAt', 'arrivedAt', 'onboardAt', 'completeAt', 'hailStartedAt', 'hailEndedAt'];
  return keys.filter((k) => parseTimestamp(step[k])).length;
}

const richAb = {
  BookingStatus: 'Completed',
  fareBreakdown: {
    flagFall: 5,
    distanceKm: 0.4,
    distanceCharge: 0.5,
    waitingMinutes: 0.2,
    waitingCharge: 0.2,
    total: 5.7,
  },
  stepTimes: {
    acceptedAt: 1720000001000,
    arrivedAt: 1720000010000,
    onboardAt: 1720000020000,
    completeAt: 1720000030000,
  },
};

test('naive spread wipes rich allbookings when completedJobs has empty nested objects', () => {
  const cj = { fareBreakdown: {}, stepTimes: {}, fare: '5.70' };
  const naive = { ...richAb, ...cj };
  assert.equal(Object.keys(naive.fareBreakdown).length, 0);
  assert.equal(Object.keys(naive.stepTimes).length, 0);
  assert.equal(parseClosedFareBreakdown(naive), null);
  assert.equal(timelineEventCount(naive), 0);
});

test('mergeClosedDetailRaw keeps richer fareBreakdown + stepTimes from allbookings', () => {
  const cj = { fareBreakdown: null, FareBreakdown: {}, stepTimes: {}, fare: '5.70' };
  const merged = mergeClosedDetailRaw(richAb, cj);
  const fb = parseClosedFareBreakdown(merged);
  assert.ok(fb, 'fareBreakdown should parse');
  assert.equal(fb.flagFall, 5);
  assert.equal(fb.total, 5.7);
  assert.ok(timelineEventCount(merged) >= 4, `expected step events, got ${timelineEventCount(merged)}`);
});

test('num() accepts currency strings', () => {
  assert.equal(num('$5.70'), 5.7);
  assert.equal(num(' $5,000.25 '), 5000.25);
});

test('source: fetchClosedJobDetail uses mergeClosedDetailRaw (not naive spread)', () => {
  const src = readFileSync(join(root, 'src/lib/closedJobDetail.ts'), 'utf8');
  assert.match(src, /mergeClosedDetailRaw/);
  assert.doesNotMatch(src, /const raw = \{ \.\.\.abRec, \.\.\.cjRec \}/);
});
