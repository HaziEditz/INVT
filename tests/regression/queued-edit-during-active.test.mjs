import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { jobTabForStatus, normalizeJobStatus } from '../../src/types/job.ts';
import { mergeJobSnapshots } from '../../src/lib/jobLifecycleDecision.ts';
import { mergeJobUpdate } from '../../src/lib/mergeJob.ts';

function shellJob(id, status, driverId = 'D001', extra = {}) {
  return {
    id,
    companyId: '860869',
    status,
    source: 'dispatch',
    serviceType: 'taxi',
    pickAddress: '1 Dee St',
    pickLatLng: '',
    dropAddress: 'Invercargill Airport',
    dropLatLng: '',
    passengerName: 'Regression Passenger',
    passengerPhone: '021 555 0101',
    paymentType: 'Cash',
    estimatedFare: '',
    bookingDateTime: new Date().toISOString(),
    driverId,
    ...extra,
  };
}

test('B post-edit: allbookings-only fresh keeps Queued on queue tab (not U-A)', () => {
  const driverId = 'D001';
  const queuedId = 8692608001;
  const optimistic = shellJob(queuedId, 'Queued', driverId, {
    dropAddress: 'Edited Drop 99 Test St',
    updateSeq: 8,
  });
  const allbookingsFresh = shellJob(queuedId, 'Queued', driverId, {
    dropAddress: 'Edited Drop 99 Test St',
    updateSeq: 8,
  });
  const stalePendingShape = shellJob(queuedId, 'Pending', '0', { updateSeq: 8 });

  const fetchFreshMerged = mergeJobUpdate(allbookingsFresh, stalePendingShape);
  assert.equal(
    normalizeJobStatus(fetchFreshMerged.status),
    'Pending',
    'global fetchFresh merge would demote Queued → U-A (the regression)',
  );

  const postSave = mergeJobSnapshots({
    bookingId: queuedId,
    storeJob: optimistic,
    optimisticJob: optimistic,
    freshJob: allbookingsFresh,
    authoritativeSeq: 8,
    flags: { editContext: 'postEditSave', baseStatus: 'Queued' },
  });
  assert.equal(postSave.status, 'Queued');
  assert.equal(postSave.dropAddress, 'Edited Drop 99 Test St');
  assert.equal(jobTabForStatus(postSave), 'queue');

  const activeJob = shellJob(8692608000, 'Active', driverId);
  assert.equal(jobTabForStatus(activeJob), 'active');
});

test('integration: active trip + queued job edit — Active stays Active, Queued stays Queued', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const driverId = h.driverIds[0];
  for (const id of h.driverIds.filter((d) => d !== driverId)) {
    await h.driverStatusChanged(id, 'Away', { zonename: 'Central' });
  }

  const activeJobId = await h.createAsapJob('active-trip');
  await h.assignAccept(activeJobId, driverId);
  await h.stageJob(activeJobId, driverId, 'Picking');
  await h.stageJob(activeJobId, driverId, 'Arrived');
  await h.stageJob(activeJobId, driverId, 'Active');
  await h.poll(
    activeJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Active',
    { timeoutMs: 25000 },
  );

  const queuedJobId = await h.createAsapJob('queued-behind-active');
  await h.triggerAutoDispatch();
  await h.poll(
    queuedJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );

  const acceptQ = await h.acceptJob(queuedJobId, driverId);
  assert.equal(acceptQ.status, 200, JSON.stringify(acceptQ.body));
  assert.equal(acceptQ.body?.queued, true, JSON.stringify(acceptQ.body));

  await h.poll(
    queuedJobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued',
    { timeoutMs: 25000 },
  );

  const activeMid = await h.jobTrace(activeJobId);
  assert.equal(activeMid.jobStore.lifecycle.BookingStatus, 'Active');

  const seq = await h.readUpdateSeq(queuedJobId);
  const editRes = await h.bookingUpdate(
    queuedJobId,
    { DropAddress: 'Edited Drop 99 Test St', DropLocation: 'Edited Drop 99 Test St' },
    seq,
  );
  assert.equal(editRes.status, 200, JSON.stringify(editRes.body));
  assert.equal(editRes.body?.ok, true, JSON.stringify(editRes.body));

  const activeAfter = await h.jobTrace(activeJobId);
  assert.equal(activeAfter.jobStore.lifecycle.BookingStatus, 'Active');

  const queuedAfter = await h.poll(
    queuedJobId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      const drop = String(
        t.jobStore?.rawFlags?.DropAddress || t.firebase?.allbookings?.DropAddress || '',
      );
      return st === 'Queued' && drop.includes('Edited Drop 99');
    },
    { timeoutMs: 25000 },
  );
  assert.equal(queuedAfter.jobStore.lifecycle.BookingStatus, 'Queued');
  assert.equal(queuedAfter.firebase?.pendingjobs, null, 'queued edit must not write pendingjobs');

  assert.equal(
    jobTabForStatus({
      id: queuedJobId,
      status: 'Queued',
      driverId: String(driverId),
      pickAddress: 'pick',
      dropAddress: 'Edited Drop 99 Test St',
      passengerName: 'Regression Passenger',
      passengerPhone: '021',
      serviceType: 'taxi',
    }),
    'queue',
  );
  assert.equal(
    jobTabForStatus({
      id: activeJobId,
      status: 'Active',
      driverId: String(driverId),
      pickAddress: 'pick',
      dropAddress: 'drop',
      passengerName: 'Regression Passenger',
      passengerPhone: '021',
      serviceType: 'taxi',
    }),
    'active',
  );
});
