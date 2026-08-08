/**
 * DISPATCH-ACTIVE-REFRESH-LAG — equal-seq complete race + Assigned promotion guard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  staleTerminalAllbookingsSuperseded,
  pickLiveJobSupersedingStaleTerminal,
  pendingSnapshotWouldRegressAssigned,
} from '../lib/jobPoolSync.mjs';

test('equal-seq Active vs Completed must NOT supersede (complete race)', () => {
  const jobId = 8692608084;
  const pending = new Map([[jobId, { id: jobId, status: 'Active', updateSeq: 5 }]]);
  const store = [{ id: jobId, status: 'Active', updateSeq: 5 }];
  const abRec = {
    BookingId: String(jobId),
    BookingStatus: 'Completed',
    Status: 'Completed',
    updateSeq: 5,
  };

  assert.equal(
    staleTerminalAllbookingsSuperseded(jobId, abRec, pending, new Map(), store),
    false,
    'same-seq Completed must win over lagging Active',
  );
  assert.equal(
    pickLiveJobSupersedingStaleTerminal(jobId, abRec, pending, new Map(), store),
    null,
  );
});

test('equal-seq Assigned vs Completed must NOT supersede', () => {
  const jobId = 42;
  const pending = new Map([[jobId, { id: jobId, status: 'Assigned', updateSeq: 4 }]]);
  const abRec = { BookingStatus: 'Completed', Status: 'Completed', updateSeq: 4 };
  assert.equal(
    staleTerminalAllbookingsSuperseded(jobId, abRec, pending, new Map(), []),
    false,
  );
});

test('newer live Offered still supersedes stale Completed (booking-id reuse)', () => {
  const jobId = 8692606221;
  const pending = new Map([
    [jobId, { id: jobId, status: 'Offered', driverId: 'D001', updateSeq: 5 }],
  ]);
  const abRec = { BookingStatus: 'Completed', Status: 'Completed', updateSeq: 2 };
  assert.equal(
    staleTerminalAllbookingsSuperseded(jobId, abRec, pending, new Map(), []),
    true,
  );
  const live = pickLiveJobSupersedingStaleTerminal(jobId, abRec, pending, new Map(), []);
  assert.ok(live);
  assert.equal(live.status, 'Offered');
  assert.equal(live.updateSeq, 5);
});

test('Assigned pending guard allows forward stages, blocks pool demotion', () => {
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Picking'), false);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Arrived'), false);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Active'), false);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'OnTrip'), false);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Assigned'), false);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Pending'), true);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'No One'), true);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Scheduled'), true);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Offered'), true);
  assert.equal(pendingSnapshotWouldRegressAssigned(true, 'Queued'), true);
  assert.equal(pendingSnapshotWouldRegressAssigned(false, 'Pending'), false);
});
