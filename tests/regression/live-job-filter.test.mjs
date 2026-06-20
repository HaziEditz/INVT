import test from 'node:test';
import assert from 'node:assert/strict';
import { TEST_CID } from '../lib/config.mjs';
import { fetchJobTrace } from '../lib/jobTrace.mjs';
import { getHarness } from '../lib/harness.mjs';
import {
  jobFromTraceLifecycle,
  jobTabDisplayLabel,
  searchLiveJobs,
} from '../lib/searchLiveJobs.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 1 live job filter: universal matcher finds U-A by partial address', async () => {
  const h = await getHarness();
  const driverId = h.driverIds[0];
  const vehicleId = `T${driverId}`;
  const uniqueAddr = `REGTEST FilterLane 88 ${Date.now()}`;

  const uaId = await h.createJobViaInsert({
    pick: uniqueAddr,
    drop: 'Invercargill Airport',
    notesSuffix: 'filter-regtest-ua',
  });

  const assignedId = await h.createJobViaInsert({
    pick: '50 Dee St Invercargill',
    notesSuffix: 'filter-regtest-assigned',
  });
  await h.assignAccept(assignedId, driverId);

  const uaTrace = await fetchJobTrace(uaId, TEST_CID);
  const asTrace = await fetchJobTrace(assignedId, TEST_CID);

  assert.equal(String(uaTrace.jobStore?.lifecycle?.BookingStatus || ''), 'Pending');
  assert.equal(String(asTrace.jobStore?.lifecycle?.BookingStatus || ''), 'Assigned');

  const jobs = [
    jobFromTraceLifecycle(uaTrace, TEST_CID),
    jobFromTraceLifecycle(asTrace, TEST_CID),
  ];

  const byAddr = searchLiveJobs(jobs, 'filterlane 88');
  assert.ok(byAddr.length >= 1, JSON.stringify(byAddr));
  assert.equal(byAddr[0].job.id, uaId);
  assert.equal(byAddr[0].tabLabel, 'U-A');

  const byId = searchLiveJobs(jobs, String(assignedId));
  assert.ok(byId.some((hit) => hit.job.id === assignedId));
  assert.equal(byId.find((hit) => hit.job.id === assignedId)?.tabLabel, 'Assign');

  assert.equal(jobTabDisplayLabel('ua'), 'U-A');
});

test('Phase 1 live job filter: assign and cancel APIs work on search hits without tab navigation', async () => {
  const h = await getHarness();
  const driverId = h.driverIds[1];
  const marker = `FilterApi ${Date.now()}`;

  const pendingId = await h.createJobViaInsert({
    pick: `${marker} Pickup Row`,
    notesSuffix: 'filter-api-pending',
  });

  const cancelId = await h.createJobViaInsert({
    pick: `${marker} Cancel Row`,
    notesSuffix: 'filter-api-cancel',
  });

  const tracePending = await fetchJobTrace(pendingId, TEST_CID);
  const traceCancel = await fetchJobTrace(cancelId, TEST_CID);
  const jobs = [
    jobFromTraceLifecycle(tracePending, TEST_CID),
    jobFromTraceLifecycle(traceCancel, TEST_CID),
  ];

  const hits = searchLiveJobs(jobs, marker.toLowerCase());
  assert.equal(hits.length, 2);

  const pendingHit = hits.find((x) => x.job.id === pendingId);
  assert.ok(pendingHit);
  assert.equal(pendingHit.tabLabel, 'U-A');

  await h.ensureDriverReady(driverId);
  const assignRes = await h.assignJob(pendingId, driverId, driverId);
  assert.equal(assignRes.status, 200, JSON.stringify(assignRes.body));

  await h.poll(
    pendingId,
    (t) => {
      const st = String(t.jobStore?.lifecycle?.BookingStatus || '');
      return st === 'Offered' || st === 'Assigned';
    },
    { timeoutMs: 30000 },
  );

  const cancelRes = await h.cancelUnassigned(cancelId);
  assert.equal(cancelRes.status, 200, JSON.stringify(cancelRes.body));

  await h.poll(
    cancelId,
    (t) => t.jobStore?.closedFound === true || !t.jobStore?.found,
    { timeoutMs: 20000 },
  );
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
