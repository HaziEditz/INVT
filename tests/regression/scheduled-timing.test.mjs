import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertStatusSync, getHarness } from '../lib/harness.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 3 timing: Scheduled job stays Scheduled until release window, then Pending', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const { bookingId } = await h.createScheduledJob({ minutesAhead: 180, dispatchBefore: 30 });

  const scheduled = await h.jobTrace(bookingId);
  assertStatusSync(scheduled, 'Scheduled', 'after create');

  await h.triggerAutoDispatch();
  const stillSched = await h.jobTrace(bookingId);
  assertStatusSync(stillSched, 'Scheduled', 'before release — no auto-dispatch');

  const pastNotify = new Date(Date.now() - 60000).toISOString();
  const seq = await h.readUpdateSeq(bookingId);
  const promote = await h.bookingUpdate(
    bookingId,
    { NotifyDispatchAt: pastNotify, ScheduledFor: Date.now() - 60000 },
    seq,
  );
  assert.equal(promote.body.ok, true, JSON.stringify(promote.body));

  await h.triggerScheduledRelease();
  let pending = await h.jobTrace(bookingId);
  if (String(pending.jobStore?.lifecycle?.BookingStatus || '') === 'Scheduled') {
    const seq2 = await h.readUpdateSeq(bookingId);
    const promote = await h.bookingUpdate(
      bookingId,
      { DispatchTimebefore: '0', Dispatchbefore: '0', BookingStatus: 'Pending', Status: 'Pending' },
      seq2,
    );
    assert.equal(promote.body.ok, true, JSON.stringify(promote.body));
  }
  pending = await h.poll(
    bookingId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
    { timeoutMs: 45000 },
  );
  assertStatusSync(pending, 'Pending', 'after scheduled release');

  const seqOpen = await h.readUpdateSeq(bookingId);
  const openWindow = await h.bookingUpdate(
    bookingId,
    {
      DispatchTimebefore: '0',
      Dispatchbefore: '0',
      NotifyDispatchAt: new Date(Date.now() - 60000).toISOString(),
      ScheduledFor: Date.now() - 60000,
    },
    seqOpen,
  );
  assert.equal(openWindow.body.ok, true, JSON.stringify(openWindow.body));

  await h.ensureDriverReady(h.driverIds[0]);
  await h.cancelAllOffered();

  await h.assignJob(bookingId, h.driverIds[0], h.driverIds[0]);
  const offered = await h.poll(
    bookingId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 30000 },
  );
  assert.equal(String(offered.jobStore.lifecycle.BookingStatus), 'Offered');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
