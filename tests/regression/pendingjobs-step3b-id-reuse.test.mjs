/**
 * Source-level guard: Step3b must not heal when pendingCreated > closedAt (ID reuse).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const serverJs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server.js'), 'utf8');

test('Step3b has fresh ID-reuse guard (pendingCreated > closedAt OR closedAt missing)', () => {
  assert.match(
    serverJs,
    /_isFreshIdReuse\s*=\s*\n?\s*!!_pendCreatedMs\s*&&\s*\(!_closedAtMs\s*\|\|\s*_pendCreatedMs\s*>\s*_closedAtMs\)/,
    'must treat known pendingCreated + missing/older closedAt as ID reuse',
  );
  assert.match(
    serverJs,
    /_isClosedTerminal\s*&&\s*_pendLooksLive\s*&&\s*!_isFreshIdReuse/,
    'Step3b heal must require !_isFreshIdReuse',
  );
});
