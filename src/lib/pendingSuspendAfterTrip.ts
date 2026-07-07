import { useEffect } from 'react';
import { useJobStore } from '@/store/jobStore';
import { evaluateSuspendGuard } from '@/lib/suspendDriverGuards';
import { suspendDriver } from '@/lib/suspendedApi';

export type PendingSuspendEntry = {
  driverId: string;
  vehicleId: string;
  driverName?: string;
  vehicleNo?: string;
  vehicleType?: string;
  zoneName?: string;
  suspendedUntil?: string;
};

const pending = new Map<string, PendingSuspendEntry>();

function entryKey(driverId: string, vehicleId: string) {
  return `${driverId}:${vehicleId || driverId}`;
}

export function queueSuspendAfterTrip(entry: PendingSuspendEntry): void {
  pending.set(entryKey(entry.driverId, entry.vehicleId), entry);
}

export function clearPendingSuspendAfterTrip(driverId: string, vehicleId: string): void {
  pending.delete(entryKey(driverId, vehicleId));
}

export function hasPendingSuspendAfterTrip(driverId: string, vehicleId?: string): boolean {
  const vid = vehicleId || driverId;
  return pending.has(entryKey(driverId, vid));
}

async function flushPending(jobs: ReadonlyArray<{ id: number; driverId?: string; status: string }>) {
  for (const [key, entry] of [...pending.entries()]) {
    const guard = evaluateSuspendGuard(entry, jobs);
    if (!guard.canProceed) continue;
    pending.delete(key);
    try {
      await suspendDriver({
        driverId: entry.driverId,
        vehicleId: entry.vehicleId || entry.driverId,
        driverName: entry.driverName,
        vehicleNo: entry.vehicleNo,
        vehicleType: entry.vehicleType,
        zoneName: entry.zoneName,
        suspendedUntil: entry.suspendedUntil,
      });
    } catch {
      pending.set(key, entry);
    }
  }
}

/** Watch live jobs and suspend drivers once their active trip completes. */
export function usePendingSuspendAfterTrip() {
  const jobs = useJobStore((s) => s.jobs);

  useEffect(() => {
    if (pending.size === 0) return;
    void flushPending(jobs);
  }, [jobs]);
}
