import type { Job } from '@/types/job';
import type { Driver } from '@/types/driver';
import { driverEligibleForJob } from '@/lib/jobVehicleEligibility';

/** Haversine distance in km */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function parseLatLng(s?: string): { lat: number; lng: number } | null {
  if (!s) return null;
  const p = s.split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function driverMatchesJob(driver: Driver, job: Job): boolean {
  if (driver.status !== 'Available') return false;
  return driverEligibleForJob(job, driver);
}

export function isInDispatchWindow(job: Job, now = Date.now()): boolean {
  if (job.status !== 'Pending') return false;
  const notifyAt = job.notifyDispatchAt ? Date.parse(job.notifyDispatchAt) : NaN;
  if (!Number.isNaN(notifyAt) && now < notifyAt) return false;
  const db = job.dispatchBeforeMinutes || 0;
  const pickMs = job.scheduledFor || Date.parse(job.bookingDateTime) || now;
  if (db > 0 && now < pickMs - db * 60000) return false;
  return true;
}

export function nearestDriver(
  job: Job,
  drivers: Driver[]
): Driver | null {
  const pick = parseLatLng(job.pickLatLng);
  const eligible = drivers.filter((d) => driverMatchesJob(d, job) && d.lat && d.lng);
  if (!eligible.length) return null;
  if (!pick) return eligible[0];
  let best = eligible[0];
  let bestDist = Infinity;
  for (const d of eligible) {
    const dist = haversineKm(pick, { lat: d.lat!, lng: d.lng! });
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/** Client-side auto-dispatch is disabled — server runs every 30s. This helper is for UI hints only. */
export function canAutoDispatch(job: Job): boolean {
  return job.status === 'Pending' && isInDispatchWindow(job);
}
