import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { requireFirebaseSecret } from '../lib/config.mjs';

const require = createRequire(import.meta.url);
const {
  PRODUCTION_TARIFF_GUARD_CID,
  isForbiddenPlaceholderTariffName,
  filterForbiddenTariffRows,
  collectTariffNamesFromMergedPayload,
  parseTariffRecordForTest,
} = require('../../lib/tariffGuard.cjs');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('tariff guard: Standard is a forbidden placeholder name', () => {
  assert.equal(isForbiddenPlaceholderTariffName('Standard'), true);
  assert.equal(isForbiddenPlaceholderTariffName('standard'), true);
  assert.equal(isForbiddenPlaceholderTariffName('Tarrif 1'), false);
  assert.equal(isForbiddenPlaceholderTariffName('Total Mobility'), false);
});

test('tariff guard: filterForbiddenTariffRows drops Standard', () => {
  const rows = [
    { Id: 1, TariffName: 'Standard', StartPrice: 3.5 },
    { Id: 2, TariffName: 'Total Mobility', StartPrice: 15 },
  ];
  const filtered = filterForbiddenTariffRows(rows);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].TariffName, 'Total Mobility');
});

test('tariff guard: parseTariffRecord rejects Standard (dispatch)', () => {
  const parsed = parseTariffRecordForTest('1', {
    TariffName: 'Standard',
    StartPrice: 5,
    DistanceRate: 3,
  });
  assert.equal(parsed, null, 'Standard placeholder must not parse as a live tariff');
  const ok = parseTariffRecordForTest('2', {
    TariffName: 'Total Mobility',
    StartPrice: 15,
    DistanceRate: 6.5,
  });
  assert.ok(ok);
  assert.equal(ok.name, 'Total Mobility');
});

test('tariff guard: useTariffs must not reintroduce DEFAULT_TARIFF Standard', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/hooks/useTariffs.ts'), 'utf8');
  assert.ok(!src.includes("name: 'Standard'"), 'useTariffs must not hardcode Standard');
  assert.ok(!src.includes('DEFAULT_TARIFF'), 'useTariffs must not define DEFAULT_TARIFF fallback');
});

test(`tariff guard: company ${PRODUCTION_TARIFF_GUARD_CID} live API has no Standard names`, async () => {
  requireFirebaseSecret();
  const base = process.env.REGRESSION_BASE_URL || 'http://127.0.0.1:5099';
  const r = await fetch(
    `${base}/api/company-tariffs?companyId=${encodeURIComponent(PRODUCTION_TARIFF_GUARD_CID)}`,
  );
  const data = await r.json().catch(() => ({}));
  assert.equal(r.ok, true, `company-tariffs HTTP ${r.status}`);
  assert.equal(data.ok, true, JSON.stringify(data));
  const names = collectTariffNamesFromMergedPayload(data.tariffs);
  assert.ok(names.length > 0, `company ${PRODUCTION_TARIFF_GUARD_CID} must expose at least one tariff`);
  for (const name of names) {
    assert.equal(
      isForbiddenPlaceholderTariffName(name),
      false,
      `forbidden placeholder tariff "${name}" returned for company ${PRODUCTION_TARIFF_GUARD_CID}`,
    );
  }
});

test('tariff guard: DispatcherSettings dt4 filters Standard placeholder', async () => {
  const base = process.env.REGRESSION_BASE_URL || 'http://127.0.0.1:5099';
  const login = await fetch(`${base}/api/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId: 'bwtest', uid: 'tariff-guard-test' }),
  });
  assert.equal(login.ok, true);
  const cookie = login.headers.get('set-cookie') || '';
  const r = await fetch(`${base}/DataManager/Data.aspx/DataSelector`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ data: [], action: '[DispatcherSettings]' }),
  });
  const json = await r.json().catch(() => ({}));
  assert.equal(r.ok, true);
  const payload = JSON.parse(json.d || '{}');
  const dt4 = payload.dt4 || [];
  for (const row of dt4) {
    const name = String(row.TariffName ?? row.name ?? '').trim();
    if (!name) continue;
    assert.equal(isForbiddenPlaceholderTariffName(name), false, `dt4 leaked "${name}"`);
  }
});
