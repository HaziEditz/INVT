/**
 * Ghost-presence sweeper must not pull online.json root (Firebase Downloads).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('ghost-presence sweeper uses per-cid online reads', () => {
  assert.match(src, /function _ghostPresenceScanCompany/);
  assert.match(src, /firebaseDbGet\(`online\/\$\{cid\}`/);
  assert.match(src, /_fixsCollectCompanyIds/);
  assert.match(src, /_ghostPresenceScanCompany\(cid, vehicles, _toKill\)/);
});

test('ghost-presence sweeper does not GET online.json root', () => {
  const idx = src.indexOf('function _ghostPresenceScanCompany');
  assert.ok(idx > 0);
  const slice = src.slice(idx, idx + 8000);
  // No REST/root pull — only per-cid firebaseDbGet
  assert.doesNotMatch(slice, /\/online\.json\?/);
  assert.doesNotMatch(slice, /\$\{FB_DB_URL\}\/online\.json/);
  assert.match(slice, /firebaseDbGet\(`online\/\$\{cid\}`/);
});

test('ghost-presence still retains on-job stale drivers', () => {
  assert.match(src, /_driverHasOnJobRetainPresence/);
  assert.match(src, /retain online\/\$\{cid\}\/\$\{vid\}/);
});
