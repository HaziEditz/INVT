import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('Client contract: SOS via driverId + companyId (no matching X-User-Key)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[0];

  await h.ensureDriverReady(driverId);

  const trigger = await h.triggerDriverSos(driverId, {
    appClient: true,
    userKey: 'wrong-global-passforlink',
    phone: '021 800 4242',
  });
  assert.equal(trigger.status, 200, JSON.stringify(trigger.body));
  assert.equal(trigger.body.ok, true);

  const path = `Emergency/${TEST_CID}/${driverId}`;
  await pollFirebasePeek(
    path,
    (n) => n && String(n.status || 'active') === 'active',
    { timeoutMs: 20000 },
  );

  await h.ensureDriverReady(driverId);
  const cancel = await h.cancelDriverSos(driverId, { appClient: true, userKey: 'wrong-global-passforlink' });
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
  assert.equal(cancel.body.ok, true);
  await pollFirebasePeek(path, (n) => n == null, { timeoutMs: 15000 });
});

test('Client contract: driver message via driverId + companyId (no matching X-User-Key)', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[1];
  const driverReply = `REGTEST app-client ${Date.now()}`;

  await h.ensureDriverReady(driverId);

  const reply = await h.sendDriverMessage(driverId, driverReply, {
    appClient: true,
    userKey: 'wrong-global-passforlink',
  });
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  assert.equal(reply.body.ok, true);

  const unread = await h.unreadCountForDriver(driverId);
  assert.ok(unread >= 1);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
