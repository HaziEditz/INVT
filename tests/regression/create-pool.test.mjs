import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { assertFirebaseHealthy, assertStatusSync } from '../lib/harness.mjs';
import { getHarness } from '../lib/harness.mjs';

test('Phase 1 create: ASAP job lands in jobStore and Firebase pool', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const jobId = await h.createAsapJob('create-pool');

  const trace = await h.poll(
    jobId,
    (t) =>
      t.jobStore?.found === true &&
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Pending' &&
      (t.firebase?.allbookings != null || t.firebase?.pendingjobs != null),
    { timeoutMs: 20000 },
  );

  assertStatusSync(trace, 'Pending', 'after create');
  assert.equal(trace.jobStore.lifecycle.companyId, h.companyId);
  assertFirebaseHealthy(trace, 'after create');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
