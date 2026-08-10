/**
 * Logic mirrors for the queue-promote × post-complete Available race.
 * Keep in sync with server.js §FIX-STALE-AVAIL / jobCount / phantom Active guards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function recentDriverCompletedAtMs(closedJobStore, driverId, withinMs, nowMs) {
  const did = String(driverId || '').trim();
  if (!did || did === '0') return 0;
  const now = nowMs || Date.now();
  const windowMs = withinMs || 120000;
  let best = 0;
  for (const cj of closedJobStore) {
    if (!cj || String(cj.BookingStatus || '') !== 'Completed') continue;
    const cjDrv = String(cj.DriverId || cj.driverId || cj.AssignedDriverId || '').trim();
    if (cjDrv !== did) continue;
    const ms = Number(cj.completedAtMs) ||
      (cj.JobCompleteTime ? new Date(cj.JobCompleteTime).getTime() : 0) ||
      0;
    if (ms > 0 && (now - ms) < windowMs && ms > best) best = ms;
  }
  return best;
}

function shouldSkipBusyToActive(job, priorCompletedMs, now = Date.now()) {
  const assignedAge = job.assignedAt ? (now - job.assignedAt) : Infinity;
  const noStages = !job.ArrivedAt && !job.OnBoardAt && !job.PickedUpAt;
  return (
    priorCompletedMs > 0 &&
    assignedAge < 60000 &&
    noStages &&
    (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking')
  );
}

function shouldIgnorePhantomActiveComplete(job, priorCompletedMs, now = Date.now()) {
  if (job.BookingStatus !== 'Active') return false;
  const activeAtMs = job.ActiveAt ? new Date(job.ActiveAt).getTime() : 0;
  const freshActiveMs = activeAtMs ? (now - activeAtMs) : Infinity;
  const noStages = !job.ArrivedAt && !job.OnBoardAt && !job.PickedUpAt;
  return noStages && freshActiveMs < 60000 && priorCompletedMs > 0;
}

function computeDriverJobCount(jobStore, zoneDrv, driverId, cid) {
  const did = String(driverId || '').trim();
  const tripSt = new Set(['Assigned', 'Picking', 'Arrived', 'OnTrip', 'Active', 'Busy']);
  let count = 0;
  for (const j of jobStore) {
    if (!j) continue;
    if (cid && String(j.companyId || '') !== String(cid)) continue;
    if (String(j.DriverId || '') !== did) continue;
    const st = j.BookingStatus || '';
    if (st === 'Queued') {
      count++;
      continue;
    }
    if (!tripSt.has(st)) continue;
    if (st === 'Assigned') {
      const vs = String((zoneDrv && zoneDrv.vehiclestatus) || '').trim();
      const zoneBid = String((zoneDrv && (zoneDrv.BookingId || zoneDrv.currentJobId)) || '').trim();
      if (vs === 'Available' && (!zoneBid || zoneBid === '0')) continue; // stale ghost
    }
    count++;
  }
  return count;
}

test('§FIX-STALE-AVAIL uses JobCompleteTime when completedAtMs missing', () => {
  const now = Date.now();
  const closed = [{
    Id: 1,
    BookingStatus: 'Completed',
    DriverId: 'D1',
    JobCompleteTime: new Date(now - 5000).toISOString(),
    // completedAtMs intentionally omitted — historical /api/job/complete bug
  }];
  assert.ok(recentDriverCompletedAtMs(closed, 'D1', 120000, now) > 0);
});

test('Busy→Active skipped for fresh queue promote after complete', () => {
  const now = Date.now();
  const prior = now - 3000;
  const job = {
    BookingStatus: 'Assigned',
    assignedAt: now - 1000,
  };
  assert.equal(shouldSkipBusyToActive(job, prior, now), true);
  assert.equal(
    shouldSkipBusyToActive({ ...job, ArrivedAt: new Date().toISOString() }, prior, now),
    false,
  );
});

test('phantom Active Available→Completed ignored after recent complete', () => {
  const now = Date.now();
  const prior = now - 4000;
  const job = {
    BookingStatus: 'Active',
    ActiveAt: new Date(now - 2000).toISOString(),
  };
  assert.equal(shouldIgnorePhantomActiveComplete(job, prior, now), true);
  assert.equal(
    shouldIgnorePhantomActiveComplete(
      { ...job, ArrivedAt: new Date().toISOString() },
      prior,
      now,
    ),
    false,
  );
});

test('jobCount ignores stale Assigned ghost when only one Active trip', () => {
  const jobs = [
    { Id: 10, companyId: 'co', DriverId: 'D1', BookingStatus: 'Active' },
    { Id: 99, companyId: 'co', DriverId: 'D1', BookingStatus: 'Assigned' }, // ghost
  ];
  const zone = { vehiclestatus: 'Available', currentJobId: null };
  assert.equal(computeDriverJobCount(jobs, zone, 'D1', 'co'), 1);

  // Queued + Active is a real 2; ghost Assigned still ignored while zone Available.
  assert.equal(
    computeDriverJobCount(
      [...jobs, { Id: 11, companyId: 'co', DriverId: 'D1', BookingStatus: 'Queued' }],
      zone,
      'D1',
      'co',
    ),
    2,
  );
});
