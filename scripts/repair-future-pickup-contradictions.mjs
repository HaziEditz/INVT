#!/usr/bin/env node
/**
 * Repair Pending/No One jobs with future pickup but no Later metadata.
 *
 *   node scripts/repair-future-pickup-contradictions.mjs --cid=860869 --dry-run
 *   node scripts/repair-future-pickup-contradictions.mjs --ids=8692607136 --cid=860869
 *
 * Env: REGRESSION_BASE_URL (default production), BW_ADMIN_KEY
 */
import process from 'node:process';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const base = process.env.REGRESSION_BASE_URL || 'https://invt-production.up.railway.app';
const adminKey = process.env.BW_ADMIN_KEY || '';
const companyId = args.cid || args.companyId || '';
const dryRun = args['dry-run'] === true || args.dryRun === true || args.dryrun === true;
const ids = String(args.ids || '')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter(Boolean);

if (!adminKey) {
  console.error('BW_ADMIN_KEY is required.');
  process.exit(1);
}

const body = {
  companyId: companyId || undefined,
  dryRun,
  ...(ids.length ? { bookingIds: ids } : {}),
};

const res = await fetch(`${base}/admin/repairFuturePickupJobs`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Key': adminKey,
  },
  body: JSON.stringify(body),
});

const report = await res.json();
console.log(JSON.stringify(report, null, 2));
process.exit(res.ok && report.ok !== false ? 0 : 1);
