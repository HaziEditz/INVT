/**
 * After accept+recall, leftover jobStore DriverAcceptedAt made the stale-offer
 * watchdog silently reclassify Offered as Assigned (no Firebase write, no
 * bookingEvent). Pool restore must clear the stamp so expired-offer cleanup
 * returns a genuine Pending row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireFirebaseSecret, ADMIN_KEY } from '../lib/config.mjs';
import { post } from '../lib/http.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');
const STALE_OFFER_MS = 3 * 60 * 1000;

function acceptStamp(trace) {
  const lc = trace?.jobStore?.lifecycle || {};
  const rf = trace?.jobStore?.rawFlags || {};
  return String(
    lc.DriverAcceptedAt || lc.AcceptedAt || lc.driverAcceptedAt
    || rf.DriverAcceptedAt || rf.AcceptedAt || rf.driverAcceptedAt || '',
  ).trim();
}

function sliceFn(name) {
  const start = src.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} missing`);
  const end = src.indexOf('\nfunction ', start + 10);
  return src.slice(start, end > start ? end : start + 2500);
}

async function parkExtras(h, sole) {
  for (const did of h.driverIds) {
    if (String(did) === String(sole)) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
}

async function readyDriver(h, driverId) {
  await h.ensureDriverReady(driverId);
  await h.driverStatusChanged(driverId, 'Available', { lat: -46.412, lng: 168.353 }).catch(() => undefined);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
    zoneid: '1',
    zonename: 'Central',
  });
}

test('source: pool restore and SOAP queued recall clear leftover accept stamps', () => {
  assert.ok(/function _clearJobAcceptStamp\s*\(/.test(src), 'missing _clearJobAcceptStamp');
  assert.ok(/function _jobHasAcceptStamp\s*\(/.test(src), 'missing _jobHasAcceptStamp');
  const apply = sliceFn('_applyPoolStatusFields');
  assert.ok(/_clearJobAcceptStamp\(job\)/.test(apply), '_applyPoolStatusFields must clear accept stamp');
  const rqStart = src.indexOf("action === '[RecallQueuedJob]'");
  assert.ok(rqStart >= 0, 'RecallQueuedJob action missing');
  const rq = src.slice(rqStart, rqStart + 2500);
  assert.ok(/_clearJobAcceptStamp\(_rqJob\)/.test(rq), 'RecallQueuedJob must clear accept stamp');
  assert.ok(src.includes('skip mid-offer bounce — job #${job.Id} already accepted'), 'accept-hold heal path must stay');
});

test('recall after accept is a clean pool row; stale-offer heal returns Pending not silent Assigned', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const sole = String(h.driverIds[0]);
  await parkExtras(h, sole);
  await readyDriver(h, sole);

  const jobId = await h.createAsapJob('recall-clears-accept-stamp');
  let assignRes = await h.assignJob(jobId, sole, sole);
  if (!assignRes.body?.ok) {
    await readyDriver(h, sole);
    assignRes = await h.assignJob(jobId, sole, sole);
  }
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered', {
    timeoutMs: 25000,
  });

  const acc = await h.acceptJob(jobId, sole);
  assert.equal(acc.body?.ok, true, JSON.stringify(acc.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned', {
    timeoutMs: 25000,
  });
  const afterAccept = await h.jobTrace(jobId);
  assert.ok(acceptStamp(afterAccept), `accept must stamp DriverAcceptedAt: ${JSON.stringify(afterAccept.jobStore)}`);

  const recallRes = await post(
    '/api/job/recall',
    { bookingId: jobId, driverId: sole },
    { 'X-Admin-Key': ADMIN_KEY },
  );
  assert.equal(recallRes.body?.ok, true, JSON.stringify(recallRes.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending', {
    timeoutMs: 25000,
  });
  const afterRecall = await h.jobTrace(jobId);
  assert.equal(
    acceptStamp(afterRecall),
    '',
    `recall must clear accept stamp: ${JSON.stringify({
      lifecycle: afterRecall.jobStore?.lifecycle,
      rawFlags: afterRecall.jobStore?.rawFlags,
    })}`,
  );

  await parkExtras(h, sole);
  await readyDriver(h, sole);
  let reoffer = await h.assignJob(jobId, sole, sole);
  if (!reoffer.body?.ok) {
    await readyDriver(h, sole);
    reoffer = await h.assignJob(jobId, sole, sole);
  }
  assert.equal(reoffer.body?.ok, true, JSON.stringify(reoffer.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered', {
    timeoutMs: 25000,
  });
  const afterReoffer = await h.jobTrace(jobId);
  assert.equal(
    acceptStamp(afterReoffer),
    '',
    `re-offer after recall must stay stamp-free: ${JSON.stringify(afterReoffer.jobStore?.lifecycle)}`,
  );

  await h.mutateJobStore(jobId, { offeredAt: Date.now() - STALE_OFFER_MS });
  await h.configureDriver(sole, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });
  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  const afterHeal = await h.jobTrace(jobId);
  const st = String(afterHeal.jobStore?.lifecycle?.BookingStatus || '');
  assert.notEqual(
    st,
    'Assigned',
    `stale-offer heal must not silently reclassify a recalled job as Assigned: ${JSON.stringify(afterHeal.jobStore?.lifecycle)}`,
  );
  assert.equal(
    st,
    'Pending',
    `expired offer after recall must return to Pending, got ${st}: ${JSON.stringify(afterHeal.jobStore?.lifecycle)}`,
  );
  assert.equal(acceptStamp(afterHeal), '');
});

test('SOAP RecallQueuedJob also clears accept stamp so stale Offered heals to Pending', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[2]);
  await h.ensureDriverReady(driverId);
  const jobId = await h.createAsapJob('recall-queued-clears-accept');

  await h.driverStatusChanged(driverId, 'Busy', { zonename: 'North' });
  await h.configureDriver(driverId, {
    vehiclestatus: 'Busy',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
    zonename: 'North',
  });

  const assign = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assign.status, 200, JSON.stringify(assign.body));
  const acceptRes = await h.acceptJob(jobId, driverId);
  assert.equal(acceptRes.body?.ok, true, JSON.stringify(acceptRes.body));
  assert.equal(acceptRes.body?.queued, true, JSON.stringify(acceptRes.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Queued', {
    timeoutMs: 25000,
  });
  // Busy-pool queue does not stamp until promote-to-Assigned. Plant the leftover
  // marker SOAP recall must still wipe (same fields _jobHasAcceptStamp reads).
  await h.mutateJobStore(jobId, { DriverAcceptedAt: new Date().toISOString() });
  const queued = await h.jobTrace(jobId);
  assert.ok(acceptStamp(queued), `planted accept stamp missing before SOAP recall: ${JSON.stringify(queued.jobStore?.lifecycle)}`);

  const recallRes = await h.recallQueuedJob(jobId);
  assert.equal(recallRes.status, 200, JSON.stringify(recallRes.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending', {
    timeoutMs: 45000,
  });
  const afterRecall = await h.jobTrace(jobId);
  assert.equal(
    acceptStamp(afterRecall),
    '',
    `SOAP queued recall must clear accept stamp: ${JSON.stringify(afterRecall.jobStore)}`,
  );

  // Park everyone so auto-dispatch cannot re-offer after heal (we only want the stale-offer cleanup).
  for (const did of h.driverIds) {
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
  }
  await h.mutateJobStore(jobId, {
    BookingStatus: 'Offered',
    DriverId: driverId,
    offeredAt: Date.now() - STALE_OFFER_MS,
  });
  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  const afterHeal = await h.jobTrace(jobId);
  const st = String(afterHeal.jobStore?.lifecycle?.BookingStatus || '');
  assert.notEqual(st, 'Assigned', `SOAP-recalled leftover Offered became Assigned: ${JSON.stringify(afterHeal.jobStore?.lifecycle)}`);
  assert.equal(
    st,
    'Pending',
    `SOAP-recalled stale Offered must heal to Pending, got ${st}: ${JSON.stringify(afterHeal.jobStore?.lifecycle)}`,
  );
});

test('genuine in-flight accept stamp still holds: stale Offered heals to Assigned, not pool', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = String(h.driverIds[0]);
  await parkExtras(h, driverId);
  await readyDriver(h, driverId);

  const jobId = await h.createAsapJob('accept-hold-stale-offer-untouched');
  let assignRes = await h.assignJob(jobId, driverId, driverId);
  if (!assignRes.body?.ok) {
    await readyDriver(h, driverId);
    assignRes = await h.assignJob(jobId, driverId, driverId);
  }
  assert.equal(assignRes.body?.ok, true, JSON.stringify(assignRes.body));
  const acc = await h.acceptJob(jobId, driverId);
  assert.equal(acc.body?.ok, true, JSON.stringify(acc.body));
  await h.poll(jobId, (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Assigned', {
    timeoutMs: 25000,
  });

  await h.mutateJobStore(jobId, {
    BookingStatus: 'Offered',
    offeredAt: Date.now() - STALE_OFFER_MS,
  });
  await h.configureDriver(driverId, {
    vehiclestatus: 'Assigned',
    lastSeen: Date.now(),
  });
  await h.triggerAutoDispatch();
  await h.triggerAutoDispatch();

  const after = await h.jobTrace(jobId);
  assert.equal(
    String(after.jobStore?.lifecycle?.BookingStatus || ''),
    'Assigned',
    `genuine accept stamp must still skip stale-offer pool release: ${JSON.stringify(after.jobStore?.lifecycle)}`,
  );
  assert.ok(acceptStamp(after), 'genuine accept stamp must survive heal');
});
