/**
 * Fix B — pre-offer stale gate grace for background GPS cadence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'server.js'), 'utf8');

test('NETWORK_OFFER_STALE_MS is 45s (above idle heartbeat, below extreme)', () => {
  assert.match(src, /const NETWORK_OFFER_STALE_MS\s*=\s*45\s*\*\s*1000/);
  assert.doesNotMatch(src, /const NETWORK_OFFER_STALE_MS\s*=\s*25\s*\*\s*1000/);
});
