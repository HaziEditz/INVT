import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret, TEST_CID, DSL } from '../lib/config.mjs';
import { parseDataManager } from '../lib/http.mjs';
import { getHarness } from '../lib/harness.mjs';
import { pollFirebasePeek } from '../lib/jobTrace.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

async function pollUnreadCount(h, driverId, minCount, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    last = await h.unreadCountForDriver(driverId);
    if (last >= minCount) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`unread count for driver ${driverId} expected >= ${minCount}, last=${last}`);
}

test('Phase 1 messaging: dispatch send → Firebase chat → driver reply → unread count', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = h.driverIds[0];
  const dispatchText = `REGTEST dispatch ${Date.now()}`;
  const driverReply = `REGTEST driver reply ${Date.now()}`;

  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    passforlink: `regtest-key-${driverId}`,
    drivername: `Test Driver ${driverId}`,
  });

  assert.equal(await h.unreadCountForDriver(driverId), 0);

  const send = await h.sendDispatchMessage(driverId, dispatchText);
  assert.equal(send.status, 200, JSON.stringify(send.body));

  const chatNode = await pollFirebasePeek(
    `chat/${driverId}`,
    (n) =>
      n &&
      (String(n.content || '').includes(dispatchText) ||
        String(n.bookingid || '').includes(dispatchText)),
    { timeoutMs: 25000 },
  );
  assert.ok(String(chatNode.content || chatNode.bookingid || '').includes(dispatchText));

  await pollFirebasePeek(
    `messages/${TEST_CID}/${driverId}`,
    (n) => n && typeof n === 'object' && Object.keys(n).length > 0,
    { timeoutMs: 20000 },
  );

  const reply = await h.sendDriverMessage(driverId, driverReply);
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  assert.equal(reply.body.ok, true);

  const unreadCount = await pollUnreadCount(h, driverId, 1);
  assert.ok(unreadCount >= 1);

  const unreadRes = await h.dpost(DSL, '[DispatcherUnReadMessages]', ['Id', String(driverId)]);
  const unreadRows = parseDataManager(unreadRes.body);
  assert.ok(Array.isArray(unreadRows) && unreadRows.length >= 1);
  assert.ok(unreadRows.some((r) => String(r.Message || '').includes('REGTEST driver reply')));

  assert.equal(await h.unreadCountForDriver(driverId), 0);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
