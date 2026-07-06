import { get, ref } from 'firebase/database';
import { getDb } from '@/lib/firebase';
import {
  closedJobStatusFromRecord,
  closedJobTerminalAtMs,
  isClosedJobRecord,
  mergeClosedJobRecords,
} from '@/lib/closedJobs';
import { buildClosedJobTimeline, type ClosedTimelineEvent } from '@/lib/closedJobTimeline';
import { jobFromFirebase, parseLatLng, type Job } from '@/types/job';

export type GpsRoutePoint = { lat: number; lng: number; at?: number };

export type ClosedFareBreakdown = {
  flagFall?: number;
  distanceKm?: number;
  waitingMinutes?: number;
  waitingCharge?: number;
  distanceCharge?: number;
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

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isNaN(n) ? undefined : n;
}

function mergeRaw(
  ab: Record<string, unknown> | null,
  cj: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!ab && !cj) return null;
  return { ...(ab || {}), ...(cj || {}) };
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
  const fb = raw.fareBreakdown;
  if (fb && typeof fb === 'object') {
    const o = fb as Record<string, unknown>;
    const parsed: ClosedFareBreakdown = {
      flagFall: num(o.flagFall),
      distanceKm: num(o.distanceKm),
      waitingMinutes: num(o.waitingMinutes),
      waitingCharge: num(o.waitingCharge),
      distanceCharge: num(o.distanceCharge),
      total: num(o.total),
    };
    if (Object.values(parsed).some((v) => v != null)) return parsed;
  }

  const fallback: ClosedFareBreakdown = {
    flagFall: num(raw.flagFall ?? raw.FlagFall),
    distanceKm: num(raw.distanceKm ?? raw.JobDistance ?? raw.distance),
    waitingMinutes: num(raw.waitingMinutes ?? raw.waitingMin ?? raw.WaitingTime),
    waitingCharge: num(raw.waitingCharge ?? raw.waitingCost ?? raw.WaitingCost),
    total: num(raw.totalFare ?? raw.TotalFare ?? raw.meterFare ?? raw.fare),
  };
  if (Object.values(fallback).some((v) => v != null)) return fallback;
  return null;
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
  const db = getDb();
  const [abSnap, cjSnap] = await Promise.all([
    get(ref(db, `allbookings/${companyId}/${jobId}`)),
    get(ref(db, `completedJobs/${companyId}/${jobId}`)),
  ]);

  const abRec =
    abSnap.exists() && abSnap.val() && typeof abSnap.val() === 'object'
      ? (abSnap.val() as Record<string, unknown>)
      : null;
  const cjRec =
    cjSnap.exists() && cjSnap.val() && typeof cjSnap.val() === 'object'
      ? (cjSnap.val() as Record<string, unknown>)
      : null;

  const merged = mergeRaw(abRec, cjRec);
  if (!merged) return null;

  if (abRec && cjRec && isClosedJobRecord(abRec)) {
    const base = jobFromFirebase(String(jobId), abRec, companyId);
    if (base) {
      base.status = closedJobStatusFromRecord(abRec);
      const job = mergeClosedJobRecords(base, cjRec, companyId);
      const raw = { ...abRec, ...cjRec };
      const terminalAt = closedJobTerminalAtMs(job, raw);
      if (terminalAt > 0) job.completedAt = terminalAt;
      const timeline = buildClosedJobTimeline(job, raw);
      return {
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

  if (!isClosedJobRecord(merged) && !cjRec) return null;

  return buildDetail(companyId, jobId, merged);
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
