/**
 * Closed Jobs list must not rely solely on client RTDB reads.
 * completedJobs is driver-only; allbookings needs adminAccess — silent empty → "0 of 0".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const serverSrc = readFileSync(join(root, 'server.js'), 'utf8');
const hookSrc = readFileSync(join(root, 'src/hooks/useJobs.ts'), 'utf8');

test('server exposes GET /api/closed-jobs gated on dispatch session', () => {
  assert.match(serverSrc, /urlPath === '\/api\/closed-jobs'/);
  assert.match(serverSrc, /getSessionCompanyId\(req\)/);
  assert.match(serverSrc, /firebaseDbGet\(`allbookings\/\$\{cid\}`/);
  assert.match(serverSrc, /firebaseDbGet\(`completedJobs\/\$\{cid\}`/);
});

test('useClosedJobs loads via /api/closed-jobs and has RTDB error fallbacks', () => {
  assert.match(hookSrc, /export function useClosedJobs/);
  assert.match(hookSrc, /fetch\('\/api\/closed-jobs'/);
  assert.match(hookSrc, /allbookings RTDB listener error/);
  assert.match(hookSrc, /completedJobs RTDB listener error/);
  assert.match(hookSrc, /ensureAdminAccess/);
});
