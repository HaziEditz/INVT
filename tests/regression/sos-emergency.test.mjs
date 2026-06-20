import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';
import { getHarness } from '../lib/harness.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test('SOS emergency: driver trigger → Firebase with phone → dispatcher ack → resolve', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[0];
  const testPhone = '021 800 1234';

  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    passforlink: `regtest-key-${driverId}`,
    phone: testPhone,
    lat: -46.412,
    lng: 168.353,
  });

  const trigger = await h.triggerDriverSos(driverId, { phone: testPhone });
  assert.equal(trigger.status, 200, JSON.stringify(trigger.body));
  assert.equal(trigger.body.ok, true);
  assert.equal(String(trigger.body.sosId), String(driverId));

  const path = `Emergency/${TEST_CID}/${driverId}`;
  const node = await pollFirebasePeek(
    path,
    (n) => n && String(n.status || 'active') === 'active' && String(n.driverPhone || '') === testPhone,
    { timeoutMs: 25000 },
  );

  assert.equal(String(node.status || 'active'), 'active');
  assert.equal(String(node.driverPhone), testPhone);
  assert.ok(String(node.driverName || '').length > 0);
  assert.ok(Number(node.lat) !== 0 || Number(node.lng) !== 0);

  const ack = await h.acknowledgeSos(String(driverId));
  assert.equal(ack.status, 200, JSON.stringify(ack.body));
  assert.equal(ack.body.ok, true);

  const ackNode = await pollFirebasePeek(
    path,
    (n) => n && String(n.status) === 'acknowledged',
    { timeoutMs: 15000 },
  );
  assert.equal(String(ackNode.status), 'acknowledged');

  const resolved = await h.resolveSos(String(driverId));
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));

  await pollFirebasePeek(path, (n) => n == null, { timeoutMs: 15000 });
});

test('SOS emergency: driver can cancel active SOS', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[1];

  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, { passforlink: `regtest-key-${driverId}`, phone: '021 800 5678' });

  const trigger = await h.triggerDriverSos(driverId);
  assert.equal(trigger.status, 200, JSON.stringify(trigger.body));

  const path = `Emergency/${TEST_CID}/${driverId}`;
  await pollFirebasePeek(path, (n) => n && String(n.status || 'active') === 'active', { timeoutMs: 20000 });

  const cancel = await h.cancelDriverSos(driverId);
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
  assert.equal(cancel.body.ok, true);

  await pollFirebasePeek(path, (n) => n == null, { timeoutMs: 15000 });
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
