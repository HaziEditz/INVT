/**
 * Company-scoping for driver hail Account search + ACC verify.
 * Account/ACC are company-bound; body companyId must never widen the lookup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpRequest } from '../lib/http.mjs';
import { getHarness } from '../lib/harness.mjs';
import { ADMIN_KEY, requireFirebaseSecret, TEST_CID } from '../lib/config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FOREIGN_CID = '999999';

test('search-accounts + verify-acc source: company filter + verify-acc route', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /urlPath === '\/api\/driver\/search-accounts'/);
  assert.match(src, /String\(b\.companyId \|\| ''\) !== _saCid/);
  assert.match(src, /urlPath === '\/api\/driver\/verify-acc'/);
  assert.match(src, /accClients\/\$\{_vaCid\}/);
  assert.match(src, /Never trust body companyId alone/);
  assert.match(src, /urlPath === '\/dev\/loadtest\/seed-business-account'/);
  assert.match(src, /urlPath === '\/dev\/loadtest\/seed-acc-claim'/);
});

test('search-accounts returns only authenticated driver company accounts', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  const userKey = `regtest-key-${driverId}`;
  const code = `SCOPE${Date.now().toString().slice(-6)}`;

  const seedOwn = await httpRequest('POST', '/dev/loadtest/seed-business-account', {
    headers: { 'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: {
      companyId: TEST_CID,
      accountCode: code,
      name: 'Own-Company Scope Account',
      active: true,
    },
  });
  assert.equal(seedOwn.status, 200, JSON.stringify(seedOwn.body));

  const seedForeign = await httpRequest('POST', '/dev/loadtest/seed-business-account', {
    headers: { 'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: {
      companyId: FOREIGN_CID,
      accountCode: code,
      name: 'Foreign-Company Scope Account',
      active: true,
    },
  });
  assert.equal(seedForeign.status, 200, JSON.stringify(seedForeign.body));

  // Deliberately wrong body companyId — must still resolve to TEST_CID driver only
  const res = await httpRequest('POST', '/api/driver/search-accounts', {
    headers: { 'X-User-Key': userKey, 'Content-Type': 'application/json' },
    body: {
      query: code,
      driverId,
      companyId: FOREIGN_CID,
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body?.ok, true);
  const accounts = Array.isArray(res.body?.accounts) ? res.body.accounts : [];
  assert.ok(
    accounts.some((a) => String(a.AccountCode || '').toUpperCase() === code.toUpperCase()),
    `own-company ${code} should be visible`,
  );
  assert.ok(
    accounts.every((a) => String(a.Name || '') !== 'Foreign-Company Scope Account'),
    'foreign-company account must not appear',
  );

  const spoof = await httpRequest('POST', '/api/driver/search-accounts', {
    headers: { 'X-User-Key': 'not-a-real-driver-key', 'Content-Type': 'application/json' },
    body: { query: code, driverId, companyId: TEST_CID },
  });
  assert.equal(spoof.status, 401);
});

test('verify-acc rejects foreign company claim; accepts same-company claim', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  const driverId = String(h.driverIds[0]);
  const userKey = `regtest-key-${driverId}`;
  const claim = `DRV-ACC-${Date.now()}`;

  const seed = await httpRequest('POST', '/dev/loadtest/seed-acc-claim', {
    headers: { 'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: {
      companyId: TEST_CID,
      claim,
      name: 'Driver Scope Claimant',
    },
  });
  assert.equal(seed.status, 200, JSON.stringify(seed.body));

  // Seed identical claim under foreign company — must not validate for TEST_CID driver
  const seedForeign = await httpRequest('POST', '/dev/loadtest/seed-acc-claim', {
    headers: { 'X-Admin-Key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: {
      companyId: FOREIGN_CID,
      claim: `${claim}-FOREIGN`,
      name: 'Foreign Claimant',
    },
  });
  assert.equal(seedForeign.status, 200, JSON.stringify(seedForeign.body));

  const missing = await httpRequest('POST', '/api/driver/verify-acc', {
    headers: { 'X-User-Key': userKey, 'Content-Type': 'application/json' },
    body: { claim: 'NO-SUCH-CLAIM-XYZ', driverId, companyId: FOREIGN_CID },
  });
  assert.equal(missing.status, 200);
  assert.equal(missing.body?.valid, false);

  const unauth = await httpRequest('POST', '/api/driver/verify-acc', {
    headers: { 'X-User-Key': 'bad-key', 'Content-Type': 'application/json' },
    body: { claim, driverId },
  });
  assert.equal(unauth.status, 401);

  // Body companyId spoof must not matter — driver cid wins
  const ok = await httpRequest('POST', '/api/driver/verify-acc', {
    headers: { 'X-User-Key': userKey, 'Content-Type': 'application/json' },
    body: { claim, driverId, companyId: FOREIGN_CID },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body?.valid, true);
  assert.equal(ok.body?.companyId, TEST_CID);

  const foreignOnly = await httpRequest('POST', '/api/driver/verify-acc', {
    headers: { 'X-User-Key': userKey, 'Content-Type': 'application/json' },
    body: { claim: `${claim}-FOREIGN`, driverId, companyId: FOREIGN_CID },
  });
  assert.equal(foreignOnly.status, 200);
  assert.equal(foreignOnly.body?.valid, false);
});
