/**
 * Account payment auth — Firebase Bearer + driverId fallback on search-accounts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpRequest } from '../lib/http.mjs';
import { getHarness } from '../lib/harness.mjs';
import { requireFirebaseSecret } from '../lib/config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('search-accounts source includes Firebase Bearer fallback', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /urlPath === '\/api\/driver\/search-accounts'/);
  assert.match(src, /_extractBearerToken/);
  assert.match(src, /_resolveZoneDriverForFirebaseBearer/);
  assert.match(src, /\[search-accounts\/bearer\]/);
});

test('search-accounts Bearer without driverId stays unauthorized', async () => {
  requireFirebaseSecret();
  await getHarness();
  const res = await httpRequest('POST', '/api/driver/search-accounts', {
    headers: {
      Authorization: 'Bearer not-a-real-token',
    },
    body: { query: 'taxi' },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body?.ok, false);
});

test('search-accounts Bearer + driverId with invalid token stays unauthorized', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  const res = await httpRequest('POST', '/api/driver/search-accounts', {
    headers: {
      Authorization: 'Bearer not-a-real-token',
    },
    body: { query: 'taxi', driverId, companyId: h.companyId },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body?.error_code || res.body?.error, 'auth_failed');
});
