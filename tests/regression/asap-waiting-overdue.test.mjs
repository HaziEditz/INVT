/**
 * Prove ASAP overdue alert treats passenger-app Waiting like Pending.
 * Run: node --test tests/regression/asap-waiting-overdue.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeJobStatus } from '../lib/jobStatusAuthority.mjs';

// Mirror of INVT/src/types/job.ts helpers used by appearance/alert (minimal).
const ASAP_OVERDUE_MS = 10 * 60_000;

function isUnassignedForDispatch(job) {
  const drv = String(job.driverId ?? '').trim();
  const hasRealDriver = drv !== '' && drv !== '0' && drv !== '-1' && drv !== '-2';
  if (hasRealDriver) return false;
  const st = normalizeJobStatus(job.status);
  return st === 'Pending' || st === 'No One' || st === 'Scheduled' || String(job.status || '') === 'Waiting';
}

function isPreBookedJob(job) {
  if ((job.dispatchBeforeMinutes ?? 0) > 0) return true;
  if (job.notifyDispatchAt) return true;
  if (normalizeJobStatus(job.status) === 'Scheduled') return true;
  if (job.scheduledFor && job.scheduledFor > Date.now() + 60_000) return true;
  return false;
}

function isAsapOverdueUnassigned(job, now = new Date()) {
  if (!isUnassignedForDispatch(job)) return false;
  if (isPreBookedJob(job, now)) return false;
  const created = job.createdAt ? new Date(job.createdAt) : null;
  if (!created) return false;
  return now.getTime() - created.getTime() >= ASAP_OVERDUE_MS;
}

test('Waiting passenger ASAP overdue → alert eligible (live bug repro)', () => {
  const now = new Date('2026-08-18T16:10:00Z');
  const job = {
    id: 8607057799718,
    status: 'Waiting', // raw Firebase Status — was excluded before normalizeWaiting→Pending
    driverId: '',
    createdAt: Date.parse('2026-08-18T12:56:39.718Z'), // ~194 min earlier
    scheduledFor: 0,
  };
  assert.equal(normalizeJobStatus('Waiting'), 'Pending');
  assert.equal(isUnassignedForDispatch(job), true);
  assert.equal(isPreBookedJob(job), false);
  assert.equal(isAsapOverdueUnassigned(job, now), true);
});

test('Pending ASAP overdue still eligible', () => {
  const now = new Date();
  const job = {
    id: 1,
    status: 'Pending',
    driverId: '',
    createdAt: now.getTime() - 15 * 60_000,
    scheduledFor: 0,
  };
  assert.equal(isAsapOverdueUnassigned(job, now), true);
});

test('Waiting under 10 min is not overdue yet', () => {
  const now = new Date();
  const job = {
    id: 2,
    status: 'Waiting',
    driverId: '',
    createdAt: now.getTime() - 5 * 60_000,
    scheduledFor: 0,
  };
  assert.equal(isUnassignedForDispatch(job), true);
  assert.equal(isAsapOverdueUnassigned(job, now), false);
});
