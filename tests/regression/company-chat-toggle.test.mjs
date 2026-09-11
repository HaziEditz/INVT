/**
 * Per-company chat kill-switch: hide dispatch Message nav + modal when disabled.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function isCompanyChatEnabled(val) {
  if (val == null || typeof val !== 'object') return true;
  if (val.chatEnabled === false) return false;
  const features = val.features;
  if (features && typeof features === 'object' && features.chatEnabled === false) return false;
  return true;
}

function visibleDispatchNavItems(items, chatEnabled) {
  if (chatEnabled) return [...items];
  return items.filter((n) => n.id !== 'messages');
}

test('chat defaults on; only explicit false hides it', () => {
  assert.equal(isCompanyChatEnabled(null), true);
  assert.equal(isCompanyChatEnabled({}), true);
  assert.equal(isCompanyChatEnabled({ features: { tmEnabled: true } }), true);
  assert.equal(isCompanyChatEnabled({ chatEnabled: false }), false);
  assert.equal(isCompanyChatEnabled({ features: { chatEnabled: false } }), false);
});

test('Message nav item is omitted rather than disabled', () => {
  const nav = [
    { id: 'acc', label: 'ACC' },
    { id: 'messages', label: 'Message' },
  ];
  assert.deepEqual(
    visibleDispatchNavItems(nav, true).map((n) => n.id),
    ['acc', 'messages'],
  );
  assert.deepEqual(
    visibleDispatchNavItems(nav, false).map((n) => n.id),
    ['acc'],
  );
});

test('dispatch Header omits Message when chat is off', () => {
  const src = readFileSync(join(root, 'src/components/layout/Header.tsx'), 'utf8');
  assert.match(src, /visibleDispatchNavItems/);
  assert.match(src, /companyChatEnabled/);
});

test('Messages modal is not mounted when chat is off', () => {
  const src = readFileSync(join(root, 'src/pages/Dispatch.tsx'), 'utf8');
  assert.match(src, /companyChatEnabled/);
  assert.match(src, /chatEnabled\s*\?\s*<MessagesModal/);
  assert.match(src, /s\.chatEnabled === 'boolean'/);
  assert.match(src, /setInterval/);
});

test('company settings map nested and flat chatEnabled', () => {
  const src = readFileSync(join(root, 'src/hooks/useSession.ts'), 'utf8');
  assert.match(src, /chatEnabled:\s*true/);
  assert.match(src, /chatEnabled:\s*isCompanyChatEnabled/);
  assert.match(src, /if\s*\(\s*!chatEnabled\s*\)/);
  assert.match(src, /s\.companyChatEnabled/);
  assert.match(src, /sessionMe/);
  assert.match(src, /setInterval\(\(\) => void pullChatFlag/);
  assert.doesNotMatch(src, /remove\(ref\(db,\s*`driverMsg/);
  const policy = readFileSync(join(root, 'src/lib/companyChatPolicy.ts'), 'utf8');
  assert.match(src, /isCompanyChatEnabled/);
  assert.match(policy, /export function isCompanyChatEnabled/);
  assert.match(policy, /export function visibleDispatchNavItems/);
});

test('HTTP session and driver endpoints carry chatEnabled; sends are gated', () => {
  const server = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(server, /\/api\/driver\/company-chat/);
  assert.match(server, /const chatEnabled = await _readCompanyChatEnabled/);
  assert.match(server, /_rejectIfCompanyChatDisabled/);
  assert.match(server, /chatMessages\/\$\{cid\}\/\$\{did\}/);
  assert.match(server, /messages\/\$\{cid\}\/\$\{did\}/);
  const sessionMe = server.slice(server.indexOf("urlPath === '/api/session/me'"));
  assert.match(sessionMe.slice(0, 2500), /chatEnabled/);
});

test('open conversation subscribes to shared chatMessages thread', () => {
  const modal = readFileSync(join(root, 'src/components/modals/MessagesModal.tsx'), 'utf8');
  assert.match(modal, /chatThreadDbPaths/);
  assert.match(modal, /firebaseChatValToRows/);
  assert.match(modal, /silent:\s*true/);
  assert.match(modal, /mergeConversationRows/);
  assert.match(modal, /ensureFirebaseAuth/);
  const server = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(server, /_chatPersistThreadIds/);
  const live = readFileSync(join(root, 'src/lib/chatLiveThread.ts'), 'utf8');
  assert.match(live, /export function chatDriverIdsMatch/);
  const rules = readFileSync(join(root, 'database.rules.json'), 'utf8');
  assert.match(rules, /"messages"/);
  assert.match(rules, /drivers'\).child\(\$companyId\)\.child\(auth\.uid\)/);
  assert.match(rules, /"notificationChat"/);
});
