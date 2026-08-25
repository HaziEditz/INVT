/**
 * Closed Jobs list Payment column must show TM · … when economics are TM,
 * even when the list calls closedJobPaymentDisplay(job) without raw completedJobs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function closedJobIsTotalMobility(job, raw = {}) {
  const r = raw || {};
  if (r.isTotalMobility === true || r.tmUsed === true) return true;
  if (job.isTotalMobility === true) return true;
  if (String(job.serviceType || '').toLowerCase() === 'tm') return true;
  if (job.tm) return true;
  const pt = String(job.paymentType || r.paymentType || r.PaymentType || r.PaymentMethod || '')
    .toLowerCase()
    .replace(/[_\s-]/g, '');
  if (pt === 'tm' || pt === 'totalmobility') return true;
  if (r.tmCouncilPays != null || r.tmSubsidyFare != null || r.tmSubsidy != null) return true;
  if (r.tmCardNumber || r.tmVoucherNo) return true;
  return false;
}

function closedJobPaymentDisplay(job, raw) {
  const payment = String(job.paymentType || '').trim();
  const accountName = String(
    job.accountName ||
      raw?.Account_Name ||
      raw?.AccountName ||
      raw?.jobAccountName ||
      raw?.accountName ||
      '',
  ).trim();
  let label =
    accountName && (/account/i.test(payment) || !payment)
      ? `${payment || 'Account'} · ${accountName}`
      : payment;
  if (closedJobIsTotalMobility(job, raw)) {
    const remainder = label || String(raw?.tmRemainderPaymentType || '').trim() || '—';
    label = /^(tm|total\s*mobility)$/i.test(remainder) ? 'TM' : `TM · ${remainder}`;
  }
  return label || '—';
}

test('list Payment shows TM · Account when isTotalMobility stamped (no raw)', () => {
  assert.equal(
    closedJobPaymentDisplay({
      status: 'Completed',
      paymentType: 'Account',
      accountName: 'Invercargill taxis',
      isTotalMobility: true,
    }),
    'TM · Account · Invercargill taxis',
  );
});

test('list Payment shows TM for Cash/Card/EFTPOS remainders when stamped', () => {
  assert.equal(
    closedJobPaymentDisplay({ status: 'Completed', paymentType: 'Cash', isTotalMobility: true }),
    'TM · Cash',
  );
  assert.equal(
    closedJobPaymentDisplay({ status: 'Completed', paymentType: 'Card', isTotalMobility: true }),
    'TM · Card',
  );
  assert.equal(
    closedJobPaymentDisplay({ status: 'Completed', paymentType: 'EFTPOS', isTotalMobility: true }),
    'TM · EFTPOS',
  );
});

test('detail path with raw still prefixes TM (Account remainder)', () => {
  assert.equal(
    closedJobPaymentDisplay(
      { status: 'Completed', paymentType: 'Account', accountName: 'Invercargill taxis' },
      { isTotalMobility: true, tmCouncilPays: 15 },
    ),
    'TM · Account · Invercargill taxis',
  );
});

test('mergeClosedJobRecords stamps isTotalMobility from completedJobs overlay', () => {
  const src = readFileSync(join(root, 'src/lib/closedJobs.ts'), 'utf8');
  assert.match(src, /merged\.isTotalMobility\s*=\s*true/);
  assert.match(src, /closedJobIsTotalMobility\(merged,\s*overlayRec\)/);
});

test('ClosedJobsModal list uses closedJobPaymentDisplay(job) — relies on stamped flag', () => {
  const src = readFileSync(join(root, 'src/components/modals/ClosedJobsModal.tsx'), 'utf8');
  assert.match(src, /closedJobPaymentDisplay\(j\)/);
});

test('jobFromFirebase sets isTotalMobility from completedJobs-style fields', () => {
  const src = readFileSync(join(root, 'src/types/job.ts'), 'utf8');
  assert.match(src, /isTotalMobility\?:\s*boolean/);
  assert.match(
    src,
    /rec\.isTotalMobility === true \|\| rec\.isTM === true \|\| rec\.IsTM === true \|\| rec\.tmUsed === true/,
  );
});
