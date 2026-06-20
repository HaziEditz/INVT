import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Phase 3 zone queue G1: zoneQueues Firebase node synced when drivers go Available', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const d1 = h.driverIds[0];
  const d2 = h.driverIds[1];
  const zoneId = '1';

  await h.configureDriver(d1, { zoneid: zoneId, zonename: 'Central', vehiclestatus: 'Away' });
  await h.configureDriver(d2, { zoneid: zoneId, zonename: 'Central', vehiclestatus: 'Away' });

  await h.driverStatusChanged(d1, 'Available', { zonename: 'Central', zonequeue: 1 });
  await h.driverStatusChanged(d2, 'Available', { zonename: 'Central', zonequeue: 2 });

  const path = `zoneQueues/${TEST_CID}/${zoneId}`;
  const node = await pollFirebasePeek(
    path,
    (n) => n && Array.isArray(n.order) && n.order.length >= 2,
    { timeoutMs: 30000 },
  );

  assert.ok(Array.isArray(node.order), 'zoneQueues.order should be an array');
  assert.ok(node.order.length >= 2, `expected ≥2 drivers in queue, got ${node.order.length}`);
  assert.equal(String(node.zoneName || ''), 'Central');
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
