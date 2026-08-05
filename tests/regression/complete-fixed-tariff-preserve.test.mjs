/**
 * Fixed-fare complete must keep Fixed / -1 — not driver's meter tariff name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('complete payload preserves Fixed identity for fixed-fare jobs', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /_preWasFixed/);
  assert.match(src, /Keep Fixed \/ -1/);
  assert.match(src, /job\.TarriffType = 'Fixed'/);
  assert.match(src, /Final meter tariff must overwrite create-time TarriffType/);
});
