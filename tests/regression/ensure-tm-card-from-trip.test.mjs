/**
 * ensureTmCardFromTrip — normalize / validate / create-if-absent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const {
  normalizeTmCardNumber,
  isPlausibleTmCardNumber,
  isValidTmCardholderName,
  expiryMmYyToIsoDate,
  buildTmCardCreatePayload,
  isDriverHoistConfirmed,
  collectTmCardCandidatesFromJob,
  ensureTmCardFromTrip,
  ensureTmCardsFromJob,
} = require('../../lib/ensureTmCardFromTrip.cjs');

test('normalize strips spaces/hyphens to digits-only', () => {
  assert.equal(normalizeTmCardNumber('448183-03'), '44818303');
  assert.equal(normalizeTmCardNumber(' 4481 8303 '), '44818303');
});

test('rejects OCR-junk cardholder names', () => {
  assert.equal(isValidTmCardholderName('TIMES WHEN USING TOTAL MOBILITY'), false);
  assert.equal(isValidTmCardholderName('Total Mobility'), false);
  assert.equal(isValidTmCardholderName('Jennifer Joy Anderson'), true);
  assert.equal(isValidTmCardholderName('Jen'), false);
});

test('plausible card numbers reject too-short / all-same', () => {
  assert.equal(isPlausibleTmCardNumber('44818303'), true);
  assert.equal(isPlausibleTmCardNumber('123'), false);
  assert.equal(isPlausibleTmCardNumber('00000000'), false);
});

test('MM/YY converts to last day of month ISO', () => {
  assert.equal(expiryMmYyToIsoDate('03/26'), '2026-03-31');
  assert.equal(expiryMmYyToIsoDate('12/25'), '2025-12-31');
  assert.equal(expiryMmYyToIsoDate('2026-03-15'), '2026-03-15');
  assert.equal(expiryMmYyToIsoDate('bad'), null);
});

test('build payload leaves council fields null', () => {
  const built = buildTmCardCreatePayload({
    cardNumber: '448183-03',
    passengerName: 'Jennifer Joy Anderson',
    expiry: '03/26',
    councilId: 'icc-test',
    now: 1000,
  });
  assert.equal(built.ok, true);
  assert.equal(built.cardNumber, '44818303');
  assert.equal(built.payload.expiryDate, '2026-03-31');
  assert.equal(built.payload.cardRegion, null);
  assert.equal(built.payload.usageLimitMonthly, null);
  assert.equal(built.payload.notes, null);
  assert.equal(built.payload.active, true);
  assert.equal(built.payload.source, 'driver_scan');
});

test('build rejects TIMES WHEN USING TOTAL MOBILITY junk', () => {
  const built = buildTmCardCreatePayload({
    cardNumber: '448183-03',
    passengerName: 'TIMES WHEN USING TOTAL MOBILITY',
    expiry: '03/26',
    councilId: 'icc-test',
  });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'bad_passenger_name');
});

test('hoist cards only when driver hoist confirmed', () => {
  assert.equal(
    isDriverHoistConfirmed({
      hoistCount: 1,
      tmHoists: [{ cardNumber: '99999999', cardName: 'Jane Doe' }],
      hoistUsedConfirmed: true,
    }),
    true,
  );
  assert.equal(
    isDriverHoistConfirmed({
      tmHoistRequired: true,
      tmHoists: [{ cardNumber: '99999999', cardName: 'Jane Doe' }],
    }),
    false,
  );
  const withHoist = collectTmCardCandidatesFromJob({
    tmCardNumber: '44818303',
    tmCardName: 'Jennifer Joy Anderson',
    tmCardExpiry: '03/26',
    hoistUsedConfirmed: true,
    hoistCount: 1,
    tmHoists: [{ cardNumber: '99112233', cardName: 'Sam Other' }],
  });
  assert.equal(withHoist.length, 2);
  const noHoist = collectTmCardCandidatesFromJob({
    tmCardNumber: '44818303',
    tmCardName: 'Jennifer Joy Anderson',
    tmHoists: [{ cardNumber: '99112233', cardName: 'Sam Other' }],
  });
  assert.equal(noHoist.length, 1);
  assert.equal(noHoist[0].cardNumber, '44818303');
});

test('ensure create-if-absent never overwrites existing', async () => {
  const store = {
    'tmCards/44818303': {
      passengerName: 'Council Set Name',
      cardRegion: 'Southland',
      usageLimitMonthly: 20,
      notes: 'keep me',
      active: false,
    },
  };
  const deps = {
    get: async (p) => store[p] || null,
    set: async (p, v) => {
      store[p] = v;
    },
  };
  const exists = await ensureTmCardFromTrip(
    {
      cardNumber: '44818303',
      passengerName: 'Jennifer Joy Anderson',
      expiry: '03/26',
      councilId: 'icc',
    },
    deps,
  );
  assert.equal(exists.action, 'exists');
  assert.equal(store['tmCards/44818303'].cardRegion, 'Southland');
  assert.equal(store['tmCards/44818303'].active, false);

  const created = await ensureTmCardFromTrip(
    {
      cardNumber: '55667788',
      passengerName: 'New Passenger Name',
      expiry: '01/27',
      councilId: 'icc',
    },
    deps,
  );
  assert.equal(created.action, 'created');
  assert.equal(store['tmCards/55667788'].passengerName, 'New Passenger Name');
  assert.equal(store['tmCards/55667788'].expiryDate, '2027-01-31');
});

test('ensureTmCardsFromJob creates primary + confirmed hoist only', async () => {
  const store = {};
  const deps = {
    get: async (p) => store[p] || null,
    set: async (p, v) => {
      store[p] = v;
    },
  };
  const results = await ensureTmCardsFromJob(
    {
      tmCardNumber: '44818303',
      tmCardName: 'Jennifer Joy Anderson',
      tmCardExpiry: '03/26',
      councilId: 'icc',
      hoistUsedConfirmed: true,
      hoistCount: 2,
      tmHoists: [
        { cardNumber: '44818303', cardName: 'Jennifer Joy Anderson' },
        { cardNumber: '99112233', cardName: 'Sam Other Person' },
      ],
    },
    deps,
    { source: 'test' },
  );
  assert.equal(results.filter((r) => r.action === 'created').length, 2);
  assert.ok(store['tmCards/44818303']);
  assert.ok(store['tmCards/99112233']);
});

test('server.js wires ensure into complete + syncOfflineTrip', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /ensureTmCardFromTrip\.cjs/);
  assert.match(src, /_scheduleEnsureTmCardsFromJob/);
  assert.match(src, /hoistUsedConfirmed/);
  assert.match(src, /_sotMergeTmFieldsOntoJob/);
  assert.match(src, /syncOfflineTrip\/late/);
  assert.match(src, /tmCards created/);
});
