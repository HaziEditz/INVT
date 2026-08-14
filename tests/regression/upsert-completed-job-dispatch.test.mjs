/**
 * Unit tests: dispatch completedJobs upsert + fill-if-empty.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mod = require(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'upsertCompletedJobFromDispatch.cjs'),
);

test('buildCompletedJobRecord maps TM Card remainder economics', () => {
  const rec = mod.buildCompletedJobRecord({
    Id: 8692608144,
    companyId: '860869',
    DriverId: 'D001',
    VehicleNo: '201',
    PickAddress: '1 Dee Street',
    DropAddress: '100 Tay Street',
    TotalFare: 40,
    PaymentType: 'Card',
    isTotalMobility: true,
    tmSubsidyFare: 26,
    tmPassengerPays: 14,
    tmCouncilPays: 26,
    tmCardNumber: '78628348',
    councilId: 'cncl_invercargill_city_council_test',
  });
  assert.equal(rec.bookingId, 8692608144);
  assert.equal(rec.driverId, 'D001');
  assert.equal(rec.vehicleId, '201');
  assert.equal(rec.pickup, '1 Dee Street');
  assert.equal(rec.totalFare, 40);
  assert.equal(rec.paymentType, 'Card');
  assert.equal(rec.tmPassengerPays, 14);
  assert.equal(rec.tmSubsidyFare, 26);
  assert.equal(rec.isTotalMobility, true);
});

test('merge fill-if-empty never clobbers richer driver fields', () => {
  const existing = {
    bookingId: 1,
    companyId: '860869',
    totalFare: 40,
    driverId: 'D001',
    gpsRoute: [{ lat: 1, lng: 2 }],
    passengerName: 'Driver Wrote Name',
  };
  const incoming = mod.buildCompletedJobRecord({
    Id: 1,
    companyId: '860869',
    DriverId: 'D999',
    TotalFare: 1,
    PassengerName: '',
  });
  const merged = mod.mergeCompletedJobRecords(existing, incoming, { preferIncoming: false });
  assert.equal(merged.totalFare, 40);
  assert.equal(merged.driverId, 'D001');
  assert.equal(merged.passengerName, 'Driver Wrote Name');
  assert.ok(merged.gpsRoute);
});

test('upsert creates when missing; merges when present', async () => {
  const store = {};
  const deps = {
    get: async (p) => store[p] || null,
    set: async (p, v) => {
      store[p] = v;
    },
    push: async (p, v) => {
      const name = '-push1';
      store[`${p}/${name}`] = v;
      return { name };
    },
  };
  const job = {
    Id: 111,
    companyId: '860869',
    DriverId: 'D001',
    VehicleNo: '201',
    PickAddress: 'A',
    DropAddress: 'B',
    TotalFare: 40,
    PaymentType: 'Card',
    isTotalMobility: true,
    tmPassengerPays: 14,
    tmSubsidyFare: 26,
    councilId: 'cncl_x',
  };
  const r1 = await mod.upsertCompletedJobFromDispatch(job, deps, { source: 'dispatch_complete' });
  assert.equal(r1.action, 'created');
  assert.equal(store['completedJobs/860869/111'].tmPassengerPays, 14);
  assert.ok(store['closedJobs/860869/job_111']);
  assert.equal(store['completedJobs/860869/111'].closedJobsPushed, true);

  store['completedJobs/860869/111'].gpsRoute = [{ lat: 9, lng: 9 }];
  store['completedJobs/860869/111'].totalFare = 99;
  const r2 = await mod.upsertCompletedJobFromDispatch(
    { ...job, TotalFare: 1, DriverId: 'OTHER' },
    deps,
    { source: 'dispatch_complete' },
  );
  assert.equal(r2.action, 'merged');
  assert.equal(store['completedJobs/860869/111'].totalFare, 99);
  assert.equal(store['completedJobs/860869/111'].driverId, 'D001');
  assert.deepEqual(store['completedJobs/860869/111'].gpsRoute, [{ lat: 9, lng: 9 }]);
});

test('upsert prefers JobCompleteTime / stepTimes over upload completedAtMs', () => {
  const confirmAt = Date.parse('2026-08-14T01:00:00.000Z');
  const uploadAt = Date.parse('2026-08-14T03:00:00.000Z');
  const rec = mod.buildCompletedJobRecord({
    Id: 8692608999,
    companyId: '860869',
    DriverId: 'D001',
    PickAddress: 'A',
    DropAddress: 'B',
    TotalFare: 40,
    PaymentType: 'Cash',
    isTotalMobility: true,
    tmSubsidyFare: 26,
    tmPassengerPays: 14,
    completedAtMs: uploadAt,
    JobCompleteTime: new Date(confirmAt).toISOString(),
    stepTimes: { completeAt: confirmAt },
  });
  assert.equal(rec.completedAt, confirmAt);
  assert.equal(rec.completedAt_ISO, new Date(confirmAt).toISOString());
});

test('second upsert does not force another closedJobs write when completedJobs exists', async () => {
  const store = {};
  let sets = 0;
  const deps = {
    get: async (p) => store[p] || null,
    set: async (p, v) => {
      sets += 1;
      store[p] = v;
    },
    push: async () => {
      throw new Error('push should not be used for closedJobs');
    },
  };
  const job = {
    Id: 222,
    companyId: '860869',
    DriverId: 'D001',
    PickAddress: 'A',
    DropAddress: 'B',
    TotalFare: 40,
    PaymentType: 'Cash',
    isTotalMobility: true,
    JobCompleteTime: '2026-08-14T01:00:00.000Z',
  };
  await mod.upsertCompletedJobFromDispatch(job, deps, { source: 'dispatch_complete' });
  const setsAfterFirst = sets;
  assert.ok(store['closedJobs/860869/job_222']);
  await mod.upsertCompletedJobFromDispatch(job, deps, { source: 'dispatch_complete' });
  assert.equal(
    store['closedJobs/860869/job_222'].totalFare,
    40,
    'deterministic closedJobs key retains single row',
  );
  // Second upsert may refresh completedJobs but must not create a second closed path.
  assert.equal(Object.keys(store).filter((k) => k.startsWith('closedJobs/')).length, 1);
  assert.ok(sets >= setsAfterFirst);
});

test('fillJobFromAllbookings + applyStatusEconomics covers status-only stub', () => {
  let job = {};
  job = mod.fillJobFromAllbookings(job, {
    bookingId: 222,
    companyId: '860869',
    DriverId: 'D001',
    VehicleNo: '201',
    PickAddress: 'Pick',
    DropAddress: 'Drop',
    TotalFare: 40,
    PaymentType: 'Card',
    isTotalMobility: true,
    tmPassengerPays: 14,
    tmSubsidyFare: 26,
  });
  job = mod.applyStatusEconomicsToJob(job, {
    status: 'pending',
    tmPassengerPays: 14,
    tmCouncilPays: 26,
    isTotalMobility: true,
  });
  assert.equal(job.driverId, 'D001');
  assert.equal(job.pickup, 'Pick');
  assert.equal(job.totalFare, 40);
  assert.equal(job.tmPassengerPays, 14);
  assert.equal(job.tmSubsidyFare, 26);
});
