/**
 * Concurrent hail create with same clientTripId must mint one job only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  withClientTripIdCreateLock,
  _resetClientTripIdCreateLocksForTests,
} = require(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'clientTripIdCreateLock.cjs'));

test.beforeEach(() => {
  _resetClientTripIdCreateLocksForTests();
});

test('overlapping creates with same clientTripId allocate once', async () => {
  const store = [];
  let allocateCalls = 0;
  const cid = '860869';
  const ctid = 'ct-concurrent-test-1';

  const findExisting = () => store.find((j) => j.clientTripId === ctid) || null;

  const createOnce = async () => {
    return withClientTripIdCreateLock(cid, ctid, findExisting, async () => {
      allocateCalls += 1;
      // Simulate slow allocateCompanyJobId (the race window).
      await new Promise((r) => setTimeout(r, 40));
      const job = { Id: 1000 + allocateCalls, clientTripId: ctid, companyId: cid };
      store.push(job);
      return job;
    });
  };

  const [a, b, c] = await Promise.all([createOnce(), createOnce(), createOnce()]);
  assert.equal(allocateCalls, 1);
  assert.equal(store.length, 1);
  assert.equal(a.value.Id, b.value.Id);
  assert.equal(a.value.Id, c.value.Id);
  assert.equal(a.fromExisting, false);
  assert.equal(b.fromExisting, true);
  assert.equal(c.fromExisting, true);
});

test('different clientTripIds still allocate separately', async () => {
  const store = [];
  let allocateCalls = 0;
  const cid = '860869';

  const run = (ctid, id) =>
    withClientTripIdCreateLock(
      cid,
      ctid,
      () => store.find((j) => j.clientTripId === ctid) || null,
      async () => {
        allocateCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        const job = { Id: id, clientTripId: ctid, companyId: cid };
        store.push(job);
        return job;
      },
    );

  const [a, b] = await Promise.all([run('ct-a', 2001), run('ct-b', 2002)]);
  assert.equal(allocateCalls, 2);
  assert.notEqual(a.value.Id, b.value.Id);
  assert.equal(store.length, 2);
});

test('upsert closedJobs uses deterministic job_ key (source gate)', () => {
  const { readFileSync } = require('node:fs');
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'upsertCompletedJobFromDispatch.cjs'),
    'utf8',
  );
  assert.match(src, /job_\$\{bookingId\}|job_" \+|`closedJobs\/\$\{companyId\}\/job_/);
  assert.match(src, /closedJobsPushed/);
});
