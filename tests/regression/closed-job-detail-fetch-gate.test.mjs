/**
 * Gate for Closed Job detail fetch — must not require companyId.
 * Empty companyId previously skipped GET /api/closed-job-detail entirely.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const gateSrc = readFileSync(join(root, 'src/lib/closedJobDetailFetchGate.ts'), 'utf8');
const hookSrc = readFileSync(join(root, 'src/hooks/useClosedJobDetail.ts'), 'utf8');
const storeSrc = readFileSync(join(root, 'src/store/uiStore.ts'), 'utf8');
const detailModalSrc = readFileSync(join(root, 'src/components/jobs/ClosedJobDetailModal.tsx'), 'utf8');

/** Mirror of shouldFetchClosedJobDetail (keep in sync with src). */
function shouldFetchClosedJobDetail(opts) {
  if (!opts.enabled) return false;
  const id = Number(opts.jobId);
  return Number.isFinite(id) && id > 0;
}

test('fetch gate: jobId alone is enough (companyId not required)', () => {
  assert.equal(shouldFetchClosedJobDetail({ enabled: true, jobId: 86926080521 }), true);
  assert.equal(shouldFetchClosedJobDetail({ enabled: true, jobId: '86926080521' }), true);
});

test('fetch gate: rejects missing/invalid jobId or disabled', () => {
  assert.equal(shouldFetchClosedJobDetail({ enabled: false, jobId: 86926080521 }), false);
  assert.equal(shouldFetchClosedJobDetail({ enabled: true, jobId: null }), false);
  assert.equal(shouldFetchClosedJobDetail({ enabled: true, jobId: 0 }), false);
  assert.equal(shouldFetchClosedJobDetail({ enabled: true, jobId: -1 }), false);
});

test('source: hook uses shouldFetchClosedJobDetail (not !companyId hard gate)', () => {
  assert.match(hookSrc, /shouldFetchClosedJobDetail/);
  assert.match(gateSrc, /companyId is only used after the response/i);
  // Old bug: early-return when !companyId before calling fetch
  assert.doesNotMatch(
    hookSrc,
    /if\s*\(\s*!enabled\s*\|\|\s*!companyId\s*\|\|\s*!jobId\s*\)/,
  );
});

test('source: detail opens via stacked closedJobDetailId (keeps Closed Jobs open)', () => {
  assert.match(storeSrc, /closedJobDetailId/);
  assert.match(storeSrc, /openClosedJobDetail/);
  assert.match(detailModalSrc, /closedJobDetailId/);
  assert.doesNotMatch(detailModalSrc, /openModal === 'closedJobDetail'/);
});
