/**
 * Direct/Inbox must read as a normal messaging thread: chronological order,
 * dispatcher on one side, driver on the other.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function isDispatcherSenderId(senderId) {
  const sid = String(senderId ?? '').trim();
  if (!sid || sid === '0') return true;
  return /^dispatcher/i.test(sid);
}

function conversationSortMs(row) {
  const created = Number(row.createdAt) || 0;
  if (created > 1e12) return created;
  if (created > 1e9 && created < 1e12) return created * 1000;
  const date = String(row.Date ?? '').trim();
  const time = String(row.Time ?? '').trim();
  if (date) {
    const clock = time.length >= 8 ? time : time.length >= 5 ? `${time}:00` : '00:00:00';
    const parsed = Date.parse(`${date}T${clock}`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const id = Number(row.Id) || 0;
  if (id > 1e12) return id;
  return id;
}

function conversationBodyKey(row) {
  const sender = String(row.SenderID ?? '').trim().toLowerCase();
  const text = String(row.Message ?? '').trim();
  return `${sender}|${text}|${Math.floor(conversationSortMs(row) / 5000)}`;
}

function mergeConversationRows(primary, incoming) {
  const persistent = new Map();
  const rest = [];
  for (const row of [...primary, ...incoming]) {
    const id = Number(row.Id) || 0;
    if (id > 0 && id < 1e12) {
      const prev = persistent.get(id);
      if (!prev || conversationSortMs(row) >= conversationSortMs(prev)) persistent.set(id, row);
    } else {
      rest.push(row);
    }
  }
  const used = new Set([...persistent.values()].map(conversationBodyKey));
  const extras = [];
  for (const row of rest) {
    const key = conversationBodyKey(row);
    if (used.has(key)) continue;
    used.add(key);
    extras.push(row);
  }
  return [...persistent.values(), ...extras].sort(
    (a, b) => conversationSortMs(a) - conversationSortMs(b) || (Number(a.Id) || 0) - (Number(b.Id) || 0),
  );
}

test('live SPA used strict SenderID match and createdAt||0 sort (the layout bug)', () => {
  function isOutboundBefore(row, driverId) {
    const sid = String(row.SenderID);
    if (sid === '0' || sid === 'Dispatcher') return true;
    return sid !== String(driverId);
  }
  // Sidebar key is a vehicle callsign; persist SenderID is D001.
  assert.equal(isOutboundBefore({ SenderID: 'D001', Message: 'hi' }, 'T201'), true);
  assert.equal(isDispatcherSenderId('D001'), false);

  const hi = {
    Id: 5,
    SenderID: 'D001',
    Message: 'hi',
    Date: '2026-09-11',
    Time: '14:00',
    createdAt: Date.parse('2026-09-11T14:00:30'),
  };
  const reply = {
    Id: Date.now(),
    SenderID: 'Dispatcher',
    Message: 'hello',
    Date: '2026-09-11',
    Time: '14:01',
  };
  const naive = [hi, reply].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.Id - b.Id);
  assert.equal(naive[0].Message, 'hello', 'old sort put the dispatcher reply above the live hi');
  const fixed = [hi, reply].sort((a, b) => conversationSortMs(a) - conversationSortMs(b));
  assert.deepEqual(fixed.map((m) => m.Message), ['hi', 'hello']);
});

test('1:1 thread: dispatcher outbound, driver inbound regardless of vehicle vs D-id', () => {
  assert.equal(isDispatcherSenderId('Dispatcher'), true);
  assert.equal(isDispatcherSenderId('0'), true);
  assert.equal(isDispatcherSenderId('Dispatcher (Broadcast)'), true);
  assert.equal(isDispatcherSenderId('D001'), false);
  assert.equal(isDispatcherSenderId('T201'), false);
});

test('merge drops optimistic Date.now() id once the persisted row arrives', () => {
  const optimistic = {
    Id: Date.now(),
    SenderID: 'Dispatcher',
    Message: 'hello',
    Date: '2026-09-11',
    Time: '14:01',
    createdAt: Date.parse('2026-09-11T14:01:00'),
  };
  const persisted = {
    Id: 6,
    SenderID: 'Dispatcher',
    Message: 'hello',
    Date: '2026-09-11',
    Time: '14:01',
    createdAt: Date.parse('2026-09-11T14:01:01'),
  };
  const hi = {
    Id: 5,
    SenderID: 'D001',
    Message: 'hi',
    Date: '2026-09-11',
    Time: '14:00',
    createdAt: Date.parse('2026-09-11T14:00:30'),
  };
  const merged = mergeConversationRows([hi, optimistic], [persisted]);
  assert.deepEqual(merged.map((m) => m.Message), ['hi', 'hello']);
  assert.equal(merged[1].Id, 6);
});

test('dispatch source uses chronological merge, dispatcher-side check, and You/Driver labels', () => {
  const live = readFileSync(join(root, 'src/lib/chatLiveThread.ts'), 'utf8');
  assert.match(live, /export function conversationSortMs/);
  assert.match(live, /export function isDispatcherSenderId/);
  assert.match(live, /export function mergeConversationRows/);
  assert.match(live, /id > 0 && id < 1e12/);
  assert.doesNotMatch(live, /\(a\.createdAt \|\| 0\) - \(b\.createdAt \|\| 0\)/);

  const api = readFileSync(join(root, 'src/lib/messagesApi.ts'), 'utf8');
  assert.match(api, /return isDispatcherSenderId\(row\.SenderID\)/);
  assert.doesNotMatch(api, /sid !== String\(driverId\)/);

  const modal = readFileSync(join(root, 'src/components/modals/MessagesModal.tsx'), 'utf8');
  assert.match(modal, /justify-end/);
  assert.match(modal, /justify-start/);
  assert.match(modal, /out \? 'You' : \(m\.User \|\| 'Driver'\)/);
  assert.match(modal, /createdAt: Date\.now\(\)/);
  assert.match(modal, /mergeConversationRows\(prev,/);

  const server = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(server, /function _conversationSortMs/);
  assert.match(server, /dt2\.sort\(\(a, b\) => _conversationSortMs/);
  assert.match(server, /if \(msg && !msg\.createdAt\) msg\.createdAt = Date\.now\(\)/);
});
