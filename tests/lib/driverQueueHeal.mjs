/** Keep in sync with server.js healStaleDriverQueueEntries helpers */

export const DRIVER_QUEUE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export function driverQueueEntryIsStale(rec, abRec, driverId, now = Date.now()) {
  const queuedAt = Number(rec?.queuedAt ?? rec?.acceptedAt ?? 0);
  if (queuedAt > 0 && now - queuedAt > DRIVER_QUEUE_MAX_AGE_MS) {
    return { stale: true, reason: 'expired_ttl' };
  }
  if (!abRec || typeof abRec !== 'object') {
    return { stale: true, reason: 'allbookings_missing' };
  }
  const abSt = String(abRec.BookingStatus ?? abRec.Status ?? '').trim();
  if (abSt !== 'Queued') {
    return { stale: true, reason: `allbookings_${abSt || 'unknown'}` };
  }
  const abDrv = String(abRec.DriverId ?? abRec.driverId ?? '').trim();
  if (abDrv && abDrv !== '0' && abDrv !== String(driverId).trim()) {
    return { stale: true, reason: 'driver_mismatch' };
  }
  const bid = parseInt(String(rec?.BookingId ?? rec?.jobId ?? ''), 10);
  if (!bid) {
    return { stale: true, reason: 'invalid_booking_id' };
  }
  return { stale: false, reason: null };
}
