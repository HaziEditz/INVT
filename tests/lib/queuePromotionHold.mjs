/** Keep in sync with server.js queue-promotion hold helpers (logic-only mirror for unit tests). */

export function findQueuedJobForDriver(jobs, driverId, companyId) {
  const did = String(driverId || '').trim();
  const cid = String(companyId || '').trim();
  if (!did) return null;
  return jobs.find(j => {
    if (!j || !j.Id || j.BookingStatus !== 'Queued') return false;
    if (cid && j.companyId && String(j.companyId) !== cid) return false;
    return String(j.DriverId || '').trim() === did;
  });
}

export function driverBlockedFromAutoDispatch(jobs, holdMap, driver, companyId, now = Date.now()) {
  const did = String(driver && driver.driverid || '').trim();
  if (!did) return { blocked: true, reason: 'no_driver_id' };
  if (findQueuedJobForDriver(jobs, did, companyId)) {
    return { blocked: true, reason: 'queued_job_pending' };
  }
  const key = `${String(companyId || '').trim()}:${did}`;
  const entry = holdMap.get(key);
  if (entry && now <= entry.until) {
    return { blocked: true, reason: 'queue_promotion_hold' };
  }
  return { blocked: false, reason: null };
}
