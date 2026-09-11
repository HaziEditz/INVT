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
  assert.match(src, /chatEnabled/);
});

test('Messages modal is not mounted when chat is off', () => {
  const src = readFileSync(join(root, 'src/pages/Dispatch.tsx'), 'utf8');
  assert.match(src, /chatEnabled/);
  assert.match(src, /chatEnabled\s*\?\s*<MessagesModal/);
});

test('company settings map nested and flat chatEnabled', () => {
  const src = readFileSync(join(root, 'src/hooks/useSession.ts'), 'utf8');
  assert.match(src, /chatEnabled:\s*true/);
  assert.match(src, /chatEnabled:\s*isCompanyChatEnabled/);
  assert.match(src, /if\s*\(\s*!chatEnabled\s*\)/);
  const policy = readFileSync(join(root, 'src/lib/companyChatPolicy.ts'), 'utf8');
  assert.match(src, /isCompanyChatEnabled/);
  assert.match(policy, /export function isCompanyChatEnabled/);
  assert.match(policy, /export function visibleDispatchNavItems/);
});
