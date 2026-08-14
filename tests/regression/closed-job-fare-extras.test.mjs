/**
 * Closed Job Fare Breakdown must itemize driver extras (and TM transactionFee).
 * Evidence job #8692608153: meter $5.27 + eftposSurcharge $2 → Payment $7.27.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const detailSrc = readFileSync(join(root, 'src/lib/closedJobDetail.ts'), 'utf8');
const modalSrc = readFileSync(
  join(root, 'src/components/jobs/ClosedJobDetailModal.tsx'),
  'utf8',
);

// Mirror src/lib/closedJobDetail.ts parse helpers (keep in sync).
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function coerceRecord(v) {
  if (isPlainObject(v)) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(s);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '')
    .trim()
    .replace(/[$,]/g, '');
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

const EXTRA_FIELD_LABELS = [
  { key: 'eftposSurcharge', label: 'EFTPOS surcharge' },
  { key: 'airportFee', label: 'Airport fee' },
  { key: 'bikeCarry', label: 'Bike carry fee' },
  { key: 'tolls', label: 'Tolls' },
  { key: 'other', label: 'Other' },
];

function transactionFeeLabel(raw) {
  const method = String(
    raw.tmRemainderPaymentType || raw.paymentType || raw.PaymentType || raw.paymentMethod || '',
  ).trim();
  if (method === 'EFTPOS') return 'EFTPOS fee';
  if (method === 'Card') return 'Card fee';
  if (method === 'Cash') return 'Cash fee';
  if (method === 'Account') return 'Account fee';
  if (method === 'ACC') return 'ACC fee';
  return 'Transaction fee';
}

function parseClosedFareExtraLines(raw) {
  const lines = [];
  const extras = coerceRecord(raw.extras);
  if (extras) {
    for (const { key, label } of EXTRA_FIELD_LABELS) {
      const amount = num(extras[key]);
      if (amount == null || amount <= 0) continue;
      let displayLabel = label;
      if (key === 'other') {
        const note = String(extras.otherNote ?? '').trim();
        if (note) displayLabel = `Other (${note})`;
      }
      lines.push({ key, label: displayLabel, amount: +amount.toFixed(2) });
    }
  } else {
    for (const { key, label } of EXTRA_FIELD_LABELS) {
      const amount = num(raw[key]);
      if (amount == null || amount <= 0) continue;
      lines.push({ key, label, amount: +amount.toFixed(2) });
    }
  }
  const txFee = num(raw.transactionFee);
  if (txFee != null && txFee > 0) {
    lines.push({
      key: 'transactionFee',
      label: transactionFeeLabel(raw),
      amount: +txFee.toFixed(2),
    });
  }
  return lines;
}

function parseClosedFareBreakdown(raw) {
  const fb = coerceRecord(raw.fareBreakdown ?? raw.FareBreakdown);
  let meterParts = null;
  if (fb) {
    const parsed = {
      flagFall: num(fb.flagFall ?? fb.FlagFall),
      distanceKm: num(fb.distanceKm ?? fb.DistanceKm),
      waitingMinutes: num(fb.waitingMinutes ?? fb.WaitingMinutes),
      waitingCharge: num(fb.waitingCharge ?? fb.WaitingCharge ?? fb.waitingCost),
      distanceCharge: num(fb.distanceCharge ?? fb.DistanceCharge ?? fb.RideCost),
      total: num(fb.total ?? fb.Total ?? fb.totalFare ?? fb.TotalFare),
    };
    if (Object.values(parsed).some((v) => v != null)) meterParts = parsed;
  }
  if (!meterParts) {
    const fallback = {
      flagFall: num(raw.flagFall ?? raw.FlagFall),
      distanceKm: num(raw.distanceKm ?? raw.JobDistance ?? raw.distance),
      waitingMinutes: num(raw.waitingMinutes ?? raw.waitingMin ?? raw.WaitingTime),
      waitingCharge: num(raw.waitingCharge ?? raw.waitingCost ?? raw.WaitingCost),
      distanceCharge: num(raw.distanceCharge ?? raw.DistanceCharge ?? raw.RideCost),
    };
    const hasMeterComponents =
      fallback.flagFall != null ||
      fallback.distanceCharge != null ||
      fallback.waitingCharge != null ||
      fallback.distanceKm != null;
    if (hasMeterComponents) {
      const meterSum = [fallback.flagFall, fallback.distanceCharge, fallback.waitingCharge]
        .filter((v) => typeof v === 'number')
        .reduce((a, b) => a + b, 0);
      fallback.total = num(raw.meterFare) ?? (meterSum > 0 ? +meterSum.toFixed(2) : undefined);
      meterParts = fallback;
    } else {
      const onlyTotal = num(raw.meterFare ?? raw.totalFare ?? raw.TotalFare ?? raw.fare);
      if (onlyTotal != null) meterParts = { total: onlyTotal };
    }
  }
  const extras = parseClosedFareExtraLines(raw);
  if (!meterParts && extras.length === 0) return null;
  const meterTotal =
    meterParts?.meterTotal ??
    meterParts?.total ??
    ([meterParts?.flagFall, meterParts?.distanceCharge, meterParts?.waitingCharge]
      .filter((v) => typeof v === 'number')
      .reduce((a, b) => a + b, 0) ||
      undefined);
  const extrasSum = extras.reduce((s, e) => s + e.amount, 0);
  const storedGrand = num(raw.totalFare ?? raw.TotalFare ?? raw.fare);
  let grandTotal =
    meterTotal != null || extrasSum > 0 ? +((meterTotal ?? 0) + extrasSum).toFixed(2) : undefined;
  if (
    storedGrand != null &&
    extrasSum > 0 &&
    meterTotal != null &&
    Math.abs(storedGrand - (meterTotal + extrasSum)) < 0.02
  ) {
    grandTotal = +storedGrand.toFixed(2);
  } else if (storedGrand != null && extrasSum === 0 && meterTotal == null) {
    grandTotal = +storedGrand.toFixed(2);
  } else if (storedGrand != null && extrasSum === 0 && meterTotal != null) {
    grandTotal = +meterTotal.toFixed(2);
  }
  return {
    ...(meterParts || {}),
    meterTotal: meterTotal != null ? +Number(meterTotal).toFixed(2) : undefined,
    extras: extras.length ? extras : undefined,
    total: grandTotal ?? meterTotal,
  };
}

/** Live completedJobs/860869/8692608153 shape (hail, Tariff 1, not TM). */
const JOB_8692608153 = {
  paymentType: 'EFTPOS',
  fare: 7.27,
  totalFare: 7.27,
  extras: {
    airportFee: 0,
    bikeCarry: 0,
    eftposSurcharge: 2,
    other: 0,
    tolls: 0,
  },
  flagFall: 5,
  waitingCharge: 0.26666666666666666,
  distanceCharge: 0,
  fareBreakdown: {
    distanceCharge: 0,
    distanceKm: 0,
    flagFall: 5,
    total: 5.266666666666667,
    waitingCharge: 0.26666666666666666,
    waitingMinutes: 0.26666666666666666,
  },
  tariffName: 'Tarrif 1',
};

test('source: closedJobDetail parses extras + transactionFee into Fare Breakdown', () => {
  assert.match(detailSrc, /parseClosedFareExtraLines/);
  assert.match(detailSrc, /eftposSurcharge/);
  assert.match(detailSrc, /transactionFee/);
  assert.match(detailSrc, /meterTotal/);
  assert.match(modalSrc, /Meter subtotal/);
  assert.match(modalSrc, /extra\.label/);
});

test('8692608153: extras.eftposSurcharge is pre-existing Extra, not TM transactionFee', () => {
  assert.equal(JOB_8692608153.isTotalMobility, undefined);
  assert.equal(JOB_8692608153.transactionFee, undefined);
  const lines = parseClosedFareExtraLines(JOB_8692608153);
  assert.deepEqual(lines, [{ key: 'eftposSurcharge', label: 'EFTPOS surcharge', amount: 2 }]);
});

test('8692608153: Fare Breakdown Total includes EFTPOS surcharge line', () => {
  const fb = parseClosedFareBreakdown(JOB_8692608153);
  assert.ok(fb);
  assert.equal(fb.flagFall, 5);
  assert.ok(Math.abs((fb.meterTotal ?? 0) - 5.27) < 0.01);
  assert.ok(fb.extras?.some((e) => e.key === 'eftposSurcharge' && e.amount === 2));
  assert.ok(Math.abs((fb.total ?? 0) - 7.27) < 0.01);
});

test('TM transactionFee appears as its own Fare Breakdown line without changing meter', () => {
  const raw = {
    paymentType: 'Cash',
    tmRemainderPaymentType: 'Card',
    isTotalMobility: true,
    fareBreakdown: { flagFall: 6.49, distanceCharge: 0, waitingCharge: 0, total: 6.49 },
    totalFare: 6.49,
    tmPassengerPays: 2.27,
    tmCouncilPays: 4.22,
    transactionFee: 2,
    passengerCollectedTotal: 4.27,
  };
  const fb = parseClosedFareBreakdown(raw);
  assert.ok(fb);
  assert.ok(Math.abs((fb.meterTotal ?? 0) - 6.49) < 0.01);
  assert.deepEqual(
    fb.extras?.find((e) => e.key === 'transactionFee'),
    { key: 'transactionFee', label: 'Card fee', amount: 2 },
  );
  assert.ok(Math.abs((fb.total ?? 0) - 8.49) < 0.01);
});

test('itemization is payment-method agnostic — Cash/Account/Card/ACC/TM all surface extras', () => {
  // Source must not gate extras on paymentType === EFTPOS
  assert.doesNotMatch(
    detailSrc,
    /paymentType\s*===\s*['"]EFTPOS['"][\s\S]{0,120}parseClosedFareExtraLines|parseClosedFareExtraLines[\s\S]{0,200}paymentType\s*===\s*['"]EFTPOS['"]/,
  );
  assert.match(detailSrc, /for \(const \{ key, label \} of EXTRA_FIELD_LABELS\)/);

  const methods = ['Cash', 'Account', 'Card', 'ACC', 'EFTPOS'];
  for (const paymentType of methods) {
    const fb = parseClosedFareBreakdown({
      paymentType,
      fareBreakdown: { flagFall: 5, distanceCharge: 1, waitingCharge: 0, total: 6 },
      totalFare: 11,
      extras: {
        airportFee: 3,
        bikeCarry: 0,
        eftposSurcharge: 0,
        tolls: 2,
        other: 0,
      },
    });
    assert.ok(fb, paymentType);
    assert.equal(fb.meterTotal, 6, paymentType);
    assert.deepEqual(
      fb.extras,
      [
        { key: 'airportFee', label: 'Airport fee', amount: 3 },
        { key: 'tolls', label: 'Tolls', amount: 2 },
      ],
      paymentType,
    );
    assert.equal(fb.total, 11, paymentType);
  }

  // Live Cash + airportFee shape from closedJobs/860869/-OueUn1aqRn8sNa-ug-Q
  const cashAirport = parseClosedFareBreakdown({
    paymentType: 'Cash',
    totalFare: 10.71,
    extras: {
      airportFee: 5,
      bikeCarry: 0,
      eftposSurcharge: 0,
      other: 0,
      tolls: 0,
    },
    fareBreakdown: {
      distanceCharge: 0,
      distanceKm: 0,
      flagFall: 5,
      total: 5.706666666666667,
      waitingCharge: 0.7066666666666667,
      waitingMinutes: 0.7066666666666667,
    },
  });
  assert.deepEqual(cashAirport.extras, [
    { key: 'airportFee', label: 'Airport fee', amount: 5 },
  ]);
  assert.ok(Math.abs((cashAirport.total ?? 0) - 10.71) < 0.02);
});
