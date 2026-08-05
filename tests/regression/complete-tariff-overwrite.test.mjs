/**
 * Mid-trip tariff — complete must overwrite create-time TarriffType.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('complete payload applies final tariff aliases over create-time TarriffType', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /Final meter tariff must overwrite create-time TarriffType/);
  assert.match(src, /job\.TarriffType = _tariffFinal/);
  assert.match(src, /'TarriffType'/);
});

test('jobFromFirebase prefers camelCase tariffName for Closed Job label', () => {
  const src = readFileSync(join(root, 'src/types/job.ts'), 'utf8');
  assert.match(
    src,
    /tariffName:\s*String\(rec\.tariffName\s*\?\?\s*rec\.TarriffName/,
  );
});
