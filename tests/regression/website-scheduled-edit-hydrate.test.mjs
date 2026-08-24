/**
 * Website Scheduled jobs live in allbookings until release and may be absent
 * from jobStore after boot. Edit-lock / booking update must hydrate on demand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h).catch(() => undefined);
});

test('website Scheduled allbookings-only job hydrates for edit-lock and update', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  // Synthetic id that was never pushed into jobStore (website Later shape).
  const bookingId = 880000000 + (Date.now() % 100000);
  const schedMs = Date.now() + 4 * 60 * 60 * 1000;
  const patch = {
    BookingStatus: 'Scheduled',
    Status: 'Scheduled',
    BookingSource: 'Website',
    Source: 'Website',
    ScheduledFor: schedMs,
    ScheduledForMs: schedMs,
    NotifyDispatchAt: new Date(schedMs - 30 * 60 * 1000).toISOString(),
    DispatchTimebefore: 30,
    Dispatchbefore: 30,
    NotifyDispatchBeforeMinutes: 30,
    PickAddress: '1 Dee St, Invercargill',
    DropAddress: 'Invercargill Airport',
    Name: 'Web Scheduled Passenger',
    PhoneNo: '0215550199',
    PickLatLng: '-46.412,168.353',
    DropLatLng: '-46.413,168.340',
    companyId: h.companyId,
    CompanyId: h.companyId,
    Passengers: 1,
    PassengersNo: 1,
  };

  const fb = await post(
    '/dev/loadtest/set-firebase-booking',
    {
      bookingId,
      companyId: h.companyId,
      clearPendingjobs: true,
      patch,
    },
    h.adminHeaders,
  );
  assert.equal(fb.status, 200, JSON.stringify(fb.body));

  // Confirm not already in jobStore (boot hydrate may still race — remove if present).
  await post('/dev/loadtest/mutate-jobstore', { bookingId, removeFromStore: true }, h.adminHeaders).catch(
    () => undefined,
  );

  const before = await h.jobTrace(bookingId);
  // If boot hydrate already pulled it, remove once more then lock immediately.
  if (before.jobStore?.found) {
    const rm = await post(
      '/dev/loadtest/mutate-jobstore',
      { bookingId, removeFromStore: true },
      h.adminHeaders,
    );
    assert.equal(rm.body?.removed, true, JSON.stringify(rm.body));
  }

  const lock = await post(
    '/api/job/edit-lock',
    {
      bookingId,
      locked: true,
      source: 'dispatcher',
      actorName: 'regtest',
      sessionId: h.sessionId,
    },
    h.dispatcherHeaders,
  );
  assert.equal(lock.status, 200, JSON.stringify(lock.body));
  assert.equal(lock.body?.ok, true, JSON.stringify(lock.body));

  const hydrated = await h.poll(
    bookingId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Scheduled',
    { timeoutMs: 20000 },
  );
  assert.equal(String(hydrated.jobStore.lifecycle.BookingStatus), 'Scheduled');

  const seq = await h.readUpdateSeq(bookingId);
  const upd = await h.bookingUpdate(
    bookingId,
    { Info: 'web-scheduled-edit-ok', Notes: 'web-scheduled-edit-ok' },
    seq,
  );
  assert.equal(upd.body?.ok, true, JSON.stringify(upd.body));

  await post(
    '/api/job/edit-lock',
    {
      bookingId,
      locked: false,
      source: 'dispatcher',
      actorName: 'regtest',
      sessionId: h.sessionId,
      forceRelease: true,
    },
    h.dispatcherHeaders,
  ).catch(() => undefined);

  await post('/dev/loadtest/mutate-jobstore', { bookingId, removeFromStore: true }, h.adminHeaders);
  const upd2 = await post(
    '/api/booking/update',
    {
      bookingId,
      by: 'dispatcher',
      changes: { Info: 'web-scheduled-edit-ok-2' },
      sessionId: h.sessionId,
      actorName: 'regtest',
    },
    h.dispatcherHeaders,
  );
  assert.equal(upd2.status, 200, JSON.stringify(upd2.body));
  assert.equal(upd2.body?.ok, true, `second update after remove should hydrate: ${JSON.stringify(upd2.body)}`);

  await h.cancelUnassigned(bookingId).catch(() => undefined);
  if (Array.isArray(h.createdJobIds)) h.createdJobIds.push(bookingId);
});
