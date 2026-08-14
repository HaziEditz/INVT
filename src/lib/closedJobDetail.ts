import {
  closedJobStatusFromRecord,
  closedJobTerminalAtMs,
  isClosedJobRecord,
  mergeClosedJobRecords,
} from '@/lib/closedJobs';
import { coerceRecord, mergeClosedDetailRaw } from '@/lib/closedJobDetailMerge';
import { buildClosedJobTimeline, type ClosedTimelineEvent } from '@/lib/closedJobTimeline';
import { jobFromFirebase, parseLatLng, type Job } from '@/types/job';

export type GpsRoutePoint = { lat: number; lng: number; at?: number };

export type ClosedFareExtraLine = {
  key: string;
  label: string;
  amount: number;
};

export type ClosedFareBreakdown = {
  flagFall?: number;
  distanceKm?: number;
  waitingMinutes?: number;
  waitingCharge?: number;
  distanceCharge?: number;
  /** Meter-only total from fareBreakdown (excludes driver extras / TM transaction fee). */
  meterTotal?: number;
  /** Itemized driver extras + optional TM transaction fee. */
  extras?: ClosedFareExtraLine[];
  /** Grand total shown as Fare Breakdown Total (meter + extras). */
  total?: number;
};

export type ClosedJobDetail = {
  job: Job;
  raw: Record<string, unknown>;
  timeline: ClosedTimelineEvent[];
  fareBreakdown: ClosedFareBreakdown | null;
  gpsRoute: GpsRoutePoint[];
  tariffLog: Record<string, unknown>[];
  driverChangeNote: string | null;
};

/** Accept numbers, numeric strings, and currency strings like "$5.70". */
export function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '')
    .trim()
    .replace(/[$,]/g, '');
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

export function parseGpsRoute(raw: Record<string, unknown>): GpsRoutePoint[] {
  const route = raw.gpsRoute ?? raw.GpsRoute;
  if (Array.isArray(route)) {
    const points: GpsRoutePoint[] = [];
    for (const p of route) {
      if (!p || typeof p !== 'object') continue;
      const o = p as Record<string, unknown>;
      const lat = num(o.lat);
      const lng = num(o.lng);
      if (lat == null || lng == null) continue;
      const atRaw = o.at != null ? Number(o.at) : undefined;
      points.push({
        lat,
        lng,
        at: atRaw != null && !Number.isNaN(atRaw) ? atRaw : undefined,
      });
    }
    if (points.length) return points;
  }

  const poly = String(raw.routePolyline ?? raw.route_polyline ?? '').trim();
  if (poly) {
    const parts = poly.split(/[|;]/).filter(Boolean);
    const points: GpsRoutePoint[] = [];
    for (const part of parts) {
      const [la, ln] = part.split(',').map((s) => parseFloat(s.trim()));
      if (Number.isNaN(la) || Number.isNaN(ln)) continue;
      const lat = Math.abs(la) > 90 ? la / 1e5 : la;
      const lng = Math.abs(ln) > 180 ? ln / 1e5 : ln;
      points.push({ lat, lng });
    }
    if (points.length) return points;
  }

  return [];
}

export function parseClosedFareBreakdown(raw: Record<string, unknown>): ClosedFareBreakdown | null {
  const fb = coerceRecord(raw.fareBreakdown ?? raw.FareBreakdown);
  let meterParts: ClosedFareBreakdown | null = null;
  if (fb) {
    const parsed: ClosedFareBreakdown = {
      flagFall: num(fb.flagFall ?? fb.FlagFall),
      distanceKm: num(fb.distanceKm ?? fb.DistanceKm),
      waitingMinutes: num(fb.waitingMinutes ?? fb.WaitingMinutes),
      waitingCharge: num(fb.waitingCharge ?? fb.WaitingCharge ?? fb.waitingCost),
      distanceCharge: num(fb.distanceCharge ?? fb.DistanceCharge ?? fb.RideCost),
      total: num(fb.total ?? fb.Total ?? fb.totalFare ?? fb.TotalFare),
    };
    if (Object.values(parsed).some((v) => v != null)) meterParts = parsed;
  }

  if (!meterParts) {
    const fallback: ClosedFareBreakdown = {
      flagFall: num(raw.flagFall ?? raw.FlagFall),
      distanceKm: num(raw.distanceKm ?? raw.JobDistance ?? raw.distance),
      waitingMinutes: num(raw.waitingMinutes ?? raw.waitingMin ?? raw.WaitingTime),
      waitingCharge: num(raw.waitingCharge ?? raw.waitingCost ?? raw.WaitingCost),
      distanceCharge: num(raw.distanceCharge ?? raw.DistanceCharge ?? raw.RideCost),
    };
    // Prefer top-level meter components; avoid treating grand totalFare as meter when
    // extras exist (Payment total includes surcharge).
    const hasMeterComponents =
      fallback.flagFall != null ||
      fallback.distanceCharge != null ||
      fallback.waitingCharge != null ||
      fallback.distanceKm != null;
    if (hasMeterComponents) {
      const meterSum = [fallback.flagFall, fallback.distanceCharge, fallback.waitingCharge]
        .filter((v): v is number => typeof v === 'number')
        .reduce((a, b) => a + b, 0);
      fallback.total =
        num(raw.meterFare) ??
        (meterSum > 0 ? +meterSum.toFixed(2) : undefined);
      meterParts = fallback;
    } else {
      const onlyTotal = num(raw.meterFare ?? raw.totalFare ?? raw.TotalFare ?? raw.fare);
      if (onlyTotal != null) {
        meterParts = { total: onlyTotal };
      }
    }
  }

  const extras = parseClosedFareExtraLines(raw);
  if (!meterParts && extras.length === 0) return null;

  const meterTotal =
    meterParts?.meterTotal ??
    meterParts?.total ??
    ([meterParts?.flagFall, meterParts?.distanceCharge, meterParts?.waitingCharge]
      .filter((v): v is number => typeof v === 'number')
      .reduce((a, b) => a + b, 0) ||
      undefined);

  const extrasSum = extras.reduce((s, e) => s + e.amount, 0);
  const storedGrand = num(raw.totalFare ?? raw.TotalFare ?? raw.fare);
  const computedGrand =
    meterTotal != null || extrasSum > 0
      ? +((meterTotal ?? 0) + extrasSum).toFixed(2)
      : undefined;
  // Prefer stored grand when it matches meter+extras (or extras alone); else computed.
  let grandTotal = computedGrand;
  if (
    storedGrand != null &&
    extrasSum > 0 &&
    meterTotal != null &&
    Math.abs(storedGrand - (meterTotal + extrasSum)) < 0.02
  ) {
    grandTotal = +storedGrand.toFixed(2);
  } else if (storedGrand != null && extrasSum === 0 && meterTotal == null) {
    grandTotal = +storedGrand.toFixed(2);
  } else if (storedGrand != null && extrasSum === 0 && meterTotal != null) {
    grandTotal = +meterTotal.toFixed(2);
  }

  return {
    ...(meterParts || {}),
    meterTotal: meterTotal != null ? +Number(meterTotal).toFixed(2) : undefined,
    extras: extras.length ? extras : undefined,
    total: grandTotal ?? meterTotal,
  };
}

const EXTRA_FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'eftposSurcharge', label: 'EFTPOS surcharge' },
  { key: 'airportFee', label: 'Airport fee' },
  { key: 'bikeCarry', label: 'Bike carry fee' },
  { key: 'tolls', label: 'Tolls' },
  { key: 'other', label: 'Other' },
];

function transactionFeeLabel(raw: Record<string, unknown>): string {
  const method = String(
    raw.tmRemainderPaymentType || raw.paymentType || raw.PaymentType || raw.paymentMethod || '',
  ).trim();
  if (method === 'EFTPOS') return 'EFTPOS fee';
  if (method === 'Card') return 'Card fee';
  if (method === 'Cash') return 'Cash fee';
  if (method === 'Account') return 'Account fee';
  if (method === 'ACC') return 'ACC fee';
  return 'Transaction fee';
}

/** Driver PaymentModal extras + optional TM remainder transactionFee. */
export function parseClosedFareExtraLines(raw: Record<string, unknown>): ClosedFareExtraLine[] {
  const lines: ClosedFareExtraLine[] = [];
  const extras = coerceRecord(raw.extras);
  if (extras) {
    for (const { key, label } of EXTRA_FIELD_LABELS) {
      const amount = num(extras[key]);
      if (amount == null || amount <= 0) continue;
      let displayLabel = label;
      if (key === 'other') {
        const note = String(extras.otherNote ?? '').trim();
        if (note) displayLabel = `Other (${note})`;
      }
      lines.push({ key, label: displayLabel, amount: +amount.toFixed(2) });
    }
  } else {
    // Rare flat mirrors
    for (const { key, label } of EXTRA_FIELD_LABELS) {
      const amount = num(raw[key]);
      if (amount == null || amount <= 0) continue;
      lines.push({ key, label, amount: +amount.toFixed(2) });
    }
  }

  const txFee = num(raw.transactionFee);
  if (txFee != null && txFee > 0) {
    lines.push({
      key: 'transactionFee',
      label: transactionFeeLabel(raw),
      amount: +txFee.toFixed(2),
    });
  }
  return lines;
}

export function parseTariffLog(raw: Record<string, unknown>): Record<string, unknown>[] {
  const log = raw.tariffChanges ?? raw.tariffLog ?? raw.TariffLog;
  if (Array.isArray(log)) {
    return log.filter((e) => e && typeof e === 'object') as Record<string, unknown>[];
  }
  if (log && typeof log === 'object') {
    return Object.values(log as Record<string, unknown>).filter(
      (e) => e && typeof e === 'object',
    ) as Record<string, unknown>[];
  }
  return [];
}

export function summarizeTariffLogEntry(entry: Record<string, unknown>): string {
  const name = String(entry.name ?? entry.tariffName ?? entry.to ?? entry.TariffName ?? '').trim();
  const from = String(entry.from ?? entry.fromName ?? entry.previous ?? '').trim();
  const by = String(entry.by ?? entry.byName ?? entry.actor ?? '').trim();
  const at = String(entry.at ?? entry.timestamp ?? '').trim();
  const parts = [
    name ? `→ ${name}` : '',
    from ? `from ${from}` : '',
    by ? `by ${by}` : '',
    at ? `at ${at}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'Tariff updated';
}

function buildDetail(companyId: string, jobId: number, raw: Record<string, unknown>): ClosedJobDetail {
  const abJob = jobFromFirebase(String(jobId), raw, companyId);
  if (!abJob) throw new Error('Invalid job record');

  abJob.status = closedJobStatusFromRecord(raw);
  const terminalAt = closedJobTerminalAtMs(abJob, raw);
  if (terminalAt > 0) abJob.completedAt = terminalAt;

  const timeline = buildClosedJobTimeline(abJob, raw);
  const fareBreakdown = parseClosedFareBreakdown(raw);
  const gpsRoute = parseGpsRoute(raw);
  const tariffLog = parseTariffLog(raw);

  return {
    job: abJob,
    raw,
    timeline,
    fareBreakdown,
    gpsRoute,
    tariffLog,
    driverChangeNote: timeline.find((e) => e.key === 'driver-change')?.detail ?? null,
  };
}

export async function fetchClosedJobDetail(
  companyId: string,
  jobId: number,
): Promise<ClosedJobDetail | null> {
  const res = await fetch(`/api/closed-job-detail?jobId=${encodeURIComponent(String(jobId))}`, {
    credentials: 'include',
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    allbookings?: Record<string, unknown> | null;
    completedJobs?: Record<string, unknown> | null;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  const abRec =
    data.allbookings && typeof data.allbookings === 'object' ? data.allbookings : null;
  const cjRec =
    data.completedJobs && typeof data.completedJobs === 'object' ? data.completedJobs : null;

  // Prefer richer nested meter/timeline fields — never let empty cj wipe ab.
  const merged = mergeClosedDetailRaw(abRec, cjRec);
  if (!merged) return null;

  let detail: ClosedJobDetail | null = null;

  if (abRec && cjRec && isClosedJobRecord(abRec)) {
    const base = jobFromFirebase(String(jobId), abRec, companyId);
    if (base) {
      base.status = closedJobStatusFromRecord(abRec);
      const job = mergeClosedJobRecords(base, cjRec, companyId);
      const raw = merged;
      const terminalAt = closedJobTerminalAtMs(job, raw);
      if (terminalAt > 0) job.completedAt = terminalAt;
      const timeline = buildClosedJobTimeline(job, raw);
      detail = {
        job,
        raw,
        timeline,
        fareBreakdown: parseClosedFareBreakdown(raw),
        gpsRoute: parseGpsRoute(raw),
        tariffLog: parseTariffLog(raw),
        driverChangeNote: timeline.find((e) => e.key === 'driver-change')?.detail ?? null,
      };
    }
  }

  if (!detail) {
    if (!isClosedJobRecord(merged) && !cjRec) return null;
    detail = buildDetail(companyId, jobId, merged);
  }

  return detail;
}

export function closedJobMapEndpoints(job: Job, raw: Record<string, unknown>, route: GpsRoutePoint[]) {
  const pick = parseLatLng(job.pickLatLng) ?? parseLatLng(String(raw.PickLatLng ?? ''));
  const drop = parseLatLng(job.dropLatLng) ?? parseLatLng(String(raw.DropLatLng ?? ''));
  const first = route[0];
  const last = route.length > 1 ? route[route.length - 1] : null;
  return {
    pick: pick ?? (first ? { lat: first.lat, lng: first.lng } : null),
    drop: drop ?? (last ? { lat: last.lat, lng: last.lng } : null),
  };
}
