import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';
import { post } from '../lib/http.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('admin cleanupStaleJobs: dry-run then terminate stale orphan allbookings', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const orphanId = 8692599001;
  const staleMs = Date.now() - 48 * 60 * 60 * 1000;

  await h.setFirebaseBooking(
    orphanId,
    {
      BookingStatus: 'Pending',
      Status: 'Pending',
      createdAt: staleMs,
      CreatedAt: staleMs,
      PickupAddress: 'Stale orphan regression',
      DriverId: '0',
    },
    h.companyId,
    { preserveTimestamps: true },
  );

  const peekBefore = await h.firebasePeek(`allbookings/${h.companyId}/${orphanId}`);
  assert.equal(String(peekBefore?.BookingStatus || peekBefore?.Status), 'Pending');

  const dry = await post(
    '/admin/cleanupStaleJobs',
    { companyId: h.companyId, dryRun: true },
    h.adminHeaders,
  );
  assert.equal(dry.status, 200, JSON.stringify(dry.body));
  assert.equal(dry.body.ok, true);
  assert.ok(
    (dry.body.cleaned || []).some((row) => row.bookingId === orphanId),
    `expected orphan #${orphanId} in dry-run cleaned list: ${JSON.stringify(dry.body.cleaned)}`,
  );

  const run = await post(
    '/admin/cleanupStaleJobs',
    { companyId: h.companyId, dryRun: false },
    h.adminHeaders,
  );
  assert.equal(run.status, 200, JSON.stringify(run.body));
  assert.equal(run.body.ok, true);
  assert.ok(run.body.cleanedCount >= 1);

  const peekAfter = await h.firebasePeek(`allbookings/${h.companyId}/${orphanId}`);
  assert.equal(String(peekAfter?.BookingStatus || peekAfter?.Status), 'Cancelled');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
