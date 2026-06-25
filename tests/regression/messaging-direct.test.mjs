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
  assert.ok(Number(chatNode.timestamp) > 0, 'chat payload should include timestamp');
  assert.ok(String(chatNode.messageId || '').length > 0, 'chat payload should include messageId');

  const chatNotify = await pollFirebasePeek(
    `notificationChat/${driverId}`,
    (n) => n && String(n.eventType || n.type || '') === 'chat_message',
    { timeoutMs: 20000 },
  );
  assert.ok(String(chatNotify.content || '').includes(dispatchText));

  await pollFirebasePeek(
    `messages/${TEST_CID}/${driverId}`,
    (n) => n && typeof n === 'object' && Object.keys(n).length > 0,
    { timeoutMs: 20000 },
  );

  await h.ensureDriverReady(driverId);
  const reply = await h.sendDriverMessage(driverId, driverReply);
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  assert.equal(reply.body.ok, true);

  const unreadCount = await pollUnreadCount(h, driverId, 1);
  assert.ok(unreadCount >= 1);

  const unreadRes = await h.dpost(DSL, '[DispatcherUnReadMessages]', ['Id', String(driverId)]);
  const unreadRows = parseDataManager(unreadRes.body);
  assert.ok(Array.isArray(unreadRows) && unreadRows.length >= 1);
  assert.ok(unreadRows.some((r) => String(r.Message || '').includes('REGTEST driver reply')));

  const convRes = await h.dpost(DSL, '[DispatcherConversation]', ['Id', String(driverId)]);
  assert.equal(convRes.status, 200, JSON.stringify(convRes.body));
  const convPayload = parseDataManager(convRes.body);
  const convRows = convPayload?.dt2 ?? convPayload;
  assert.ok(Array.isArray(convRows), 'DispatcherConversation must return dt2 array via DataSelectorLess');
  assert.ok(
    convRows.some((r) => String(r.Message || '').includes('REGTEST driver reply')),
    `conversation thread empty: ${JSON.stringify(convRows).slice(0, 200)}`,
  );

  assert.equal(await h.unreadCountForDriver(driverId), 0);
});

test.after(async () => {
  const h = await getHarness();
  await h.cleanupAll();
});
