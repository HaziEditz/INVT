import { useUiStore, type NotificationCategory } from '@/store/uiStore';
import { useDriverStore } from '@/store/driverStore';
import { normalizeJobStatus } from '@/lib/jobStatusAuthority';
import type { Job } from '@/types/job';

const dedupUntil = new Map<string, number>();
const DEDUP_MS = 8000;

function shouldSkip(key: string): boolean {
  const now = Date.now();
  const prev = dedupUntil.get(key);
  if (prev != null && now - prev < DEDUP_MS) return true;
  dedupUntil.set(key, now);
  return false;
}

function push(
  category: NotificationCategory,
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  dedupKey?: string,
  message?: string,
) {
  if (dedupKey && shouldSkip(dedupKey)) return;
  useUiStore.getState().addToast({ type, title, message, category });
}

function resolveDriverName(job?: Job | null, driverId?: string): string {
  const fromJob = job?.driverName?.trim();
  if (fromJob) return fromJob;
  const id = String(driverId ?? job?.driverId ?? '').trim();
  if (!id || id === '0' || id === '-1') return 'Unassigned';
  const d = useDriverStore.getState().drivers.find((x) => x.driverId === id);
  if (d?.driverName?.trim()) return d.driverName.trim();
  return `Driver ${id}`;
}

function resolveVehicle(job?: Job | null, driverId?: string): string {
  const fromJob = job?.vehicleNo?.trim() || job?.vehicleId?.trim();
  if (fromJob) return fromJob;
  const id = String(driverId ?? job?.driverId ?? '').trim();
  if (!id) return '—';
  const d = useDriverStore.getState().drivers.find((x) => x.driverId === id);
  return d?.vehicleNo?.trim() || d?.vehicleId?.trim() || '—';
}

export function notifyJobAccepted(jobId: number, job?: Job | null, driverId?: string) {
  const name = resolveDriverName(job, driverId);
  push(
    'job_accepted',
    'success',
    `Job Accepted — Job #${jobId} — Driver: ${name}`,
    `accept:${jobId}`,
  );
}

export function notifyJobCancelled(jobId: number, _job?: Job | null, _signalAt?: number) {
  push(
    'job_cancelled',
    'warning',
    `Job Cancelled — Job #${jobId}`,
    `cancel:${jobId}`,
  );
}

export function notifyJobRecalled(jobId: number, job?: Job | null, driverId?: string, _signalAt?: number) {
  const name = resolveDriverName(job, driverId);
  push(
    'job_recalled',
    'info',
    `Job Recalled — Job #${jobId} — Driver: ${name}`,
    `recall:${jobId}`,
  );
}

export function notifyNoShow(jobId: number, job?: Job | null, driverId?: string, _signalAt?: number) {
  const name = resolveDriverName(job, driverId);
  push(
    'no_show',
    'warning',
    `No Show — Job #${jobId} — Driver: ${name}`,
    `noshow:${jobId}`,
  );
}

export function notifyNewBooking(jobId: number, _signalAt?: number) {
  push(
    'new_booking',
    'info',
    `New Booking — Job #${jobId}`,
    `newbooking:${jobId}`,
  );
}

export function notifyJobCreated(jobId: number) {
  push(
    'job_created',
    'success',
    `New Booking — Job #${jobId}`,
    `created:${jobId}`,
  );
}

export function notifyDriverOnline(driverName: string, vehicle: string) {
  const name = driverName.trim() || 'Driver';
  const veh = vehicle.trim() || '—';
  push(
    'driver_online',
    'info',
    `Driver Online — ${name} (Vehicle ${veh})`,
    `online:${name}:${veh}`,
  );
}

export function notifySosAlert(driverName: string, location: string) {
  const name = driverName.trim() || 'Driver';
  const loc = location.trim() || 'Location unknown';
  push(
    'sos_alert',
    'error',
    `SOS Alert — Driver: ${name} — Location: ${loc}`,
    `sos:${name}:${loc}`,
  );
}

export function notifyFromDispatchRefresh(opts: {
  bookingId: number;
  action?: string;
  status?: string;
  driverId?: string;
  signalAt?: number;
  job?: Job | null;
}) {
  const { bookingId, action, status, driverId, signalAt, job } = opts;
  const st = status ? normalizeJobStatus(status) : null;

  if (action === 'accept') {
    notifyJobAccepted(bookingId, job, driverId);
    return;
  }
  if (action === 'recall') {
    notifyJobRecalled(bookingId, job, driverId, signalAt);
    return;
  }
  if (action === 'no-show' || st === 'No Show') {
    notifyNoShow(bookingId, job, driverId, signalAt);
    return;
  }
  if (action === 'cancel' || st === 'Cancelled') {
    notifyJobCancelled(bookingId, job, signalAt);
  }
}

export function formatSosLocation(rec: Record<string, unknown>): string {
  const addr = String(
    rec.address ?? rec.Address ?? rec.pickAddress ?? rec.location ?? rec.Location ?? '',
  ).trim();
  if (addr) return addr;
  const lat = Number(rec.lat ?? rec.Lat ?? 0);
  const lng = Number(rec.lng ?? rec.Lng ?? 0);
  if (lat && lng) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return 'Location unknown';
}
