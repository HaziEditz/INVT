/**
 * Taxi Time — Dispatch System Load Test
 * ─────────────────────────────────────
 * Injects simulated drivers + jobs, hammers every major endpoint with
 * concurrent requests, then reports per-endpoint timing and throughput.
 *
 * Usage:
 *   node loadtest.js [--drivers N] [--jobs M] [--concurrency C] [--rounds R]
 *
 * Defaults:  --drivers 15  --jobs 30  --concurrency 20  --rounds 5
 *
 * Requires the server to be running on port 5000.
 */

'use strict';

const http = require('http');

// ── Parse CLI args ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argInt(flag, def) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? parseInt(argv[i + 1]) : def;
}
const N_DRIVERS     = argInt('--drivers',     15);
const N_JOBS        = argInt('--jobs',        30);
const CONCURRENCY   = argInt('--concurrency', 20);
const ROUNDS        = argInt('--rounds',       5);
const HOST          = '127.0.0.1';
const PORT          = 5000;

// ── HTTP helpers ───────────────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HOST, port: PORT, path, method,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-cache',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function post(path, body) { return request('POST', path, body); }
function get(path)        { return request('GET',  path, null); }

function action(selector, actionName, params) {
  const url = selector === 'Less'
    ? '/DataManager/Data.aspx/DataSelectorLess'
    : '/DataManager/Data.aspx/DataSelector';
  return post(url, { data: params || [], action: actionName });
}

// ── Timing ─────────────────────────────────────────────────────────────────
const results = {}; // { label: { ok, err, times:[] } }

async function timed(label, fn) {
  if (!results[label]) results[label] = { ok: 0, err: 0, times: [] };
  const t0 = Date.now();
  try {
    const r = await fn();
    results[label].times.push(Date.now() - t0);
    if (r.status >= 200 && r.status < 300) results[label].ok++;
    else results[label].err++;
    return r;
  } catch (e) {
    results[label].times.push(Date.now() - t0);
    results[label].err++;
    return null;
  }
}

async function concurrent(n, taskFactory) {
  const tasks = Array.from({ length: n }, (_, i) => taskFactory(i));
  return Promise.all(tasks);
}

// ── Report ─────────────────────────────────────────────────────────────────
function report() {
  const W = 42;
  console.log('\n' + '═'.repeat(80));
  console.log('  LOAD TEST RESULTS');
  console.log('═'.repeat(80));
  console.log(
    padR('Endpoint', W) +
    padL('Calls', 7) + padL('Err', 6) +
    padL('Min ms', 8) + padL('Avg ms', 8) + padL('Max ms', 8) + padL('p95 ms', 8)
  );
  console.log('─'.repeat(80));

  let totalCalls = 0, totalErrs = 0;
  for (const [label, r] of Object.entries(results)) {
    const times  = r.times.sort((a, b) => a - b);
    const avg    = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    const p95idx = Math.floor(times.length * 0.95);
    console.log(
      padR(label, W) +
      padL(r.ok + r.err, 7) +
      padL(r.err > 0 ? `${r.err}!` : '0', 6) +
      padL(times[0], 8) +
      padL(avg, 8) +
      padL(times[times.length - 1], 8) +
      padL(times[p95idx] || times[times.length - 1], 8)
    );
    totalCalls += r.ok + r.err;
    totalErrs  += r.err;
  }
  console.log('─'.repeat(80));
  console.log(`  Total requests: ${totalCalls}   Errors: ${totalErrs}   Config: ${N_DRIVERS} drivers / ${N_JOBS} jobs / ${CONCURRENCY} concurrent / ${ROUNDS} rounds`);
  console.log('═'.repeat(80) + '\n');
}

function padR(s, n) { return String(s).slice(0, n).padEnd(n); }
function padL(s, n) { return String(s).slice(0, n).padStart(n); }

// ── Phases ─────────────────────────────────────────────────────────────────

async function phase_seed() {
  console.log(`\n[1/5] Seeding ${N_DRIVERS} drivers + ${N_JOBS} jobs...`);
  const r = await post(`/dev/loadtest/seed?drivers=${N_DRIVERS}&jobs=${N_JOBS}`, {});
  const body = JSON.parse(r.body || '{}');
  if (!body.ok) { console.error('  Seed failed:', r.body); process.exit(1); }
  console.log(`  ✓ Drivers injected: ${body.drivers}   Jobs injected: ${body.jobs}`);
  return body;
}

async function phase_status(seedResult) {
  console.log('\n[2/5] Status check + job counts...');
  const sr = await get('/dev/loadtest/status');
  const st = JSON.parse(sr.body);
  console.log(`  Server state → totalDrivers:${st.totalDrivers}  testDrivers:${st.testDrivers}  totalJobs:${st.totalJobs}  testJobs:${st.testJobs}`);
}

async function phase_read_load() {
  console.log(`\n[3/5] Read-heavy load test — ${CONCURRENCY} concurrent × ${ROUNDS} rounds...`);

  for (let round = 0; round < ROUNDS; round++) {
    process.stdout.write(`  Round ${round + 1}/${ROUNDS} `);
    await concurrent(CONCURRENCY, async (i) => {
      const pick = i % 6;
      if (pick === 0) await timed('GET /UnAssignedJobsv3', () => action('', '[UnAssignedJobsv3]', []));
      else if (pick === 1) await timed('GET /AssignedJobsv2', () => action('', '[AssignedJobsv2]', []));
      else if (pick === 2) await timed('GET /ActiveJobsv3', () => action('Less', '[ActiveJobsv3]', []));
      else if (pick === 3) await timed('GET /VehiclesStatus', () => action('', 'VehiclesStatus', []));
      else if (pick === 4) await timed('GET /JobsCount', () => action('', 'JobsCount', []));
      else                 await timed('GET /AutoDispatch check', () => action('', 'AutoDispatchVehiclesallride', []));
    });
    process.stdout.write('✓\n');
  }
}

async function phase_write_load(seedResult) {
  console.log(`\n[4/5] Write load test — checkjobstatus, DriverStatusChanged, ClosedJobs search...`);

  const jobIds    = seedResult.jobIds    || [];
  const driverIds = seedResult.driverIds || [];
  if (!jobIds.length || !driverIds.length) {
    console.log('  (no test IDs returned, skipping write phase)');
    return;
  }

  for (let round = 0; round < ROUNDS; round++) {
    process.stdout.write(`  Round ${round + 1}/${ROUNDS} `);
    await concurrent(CONCURRENCY, async (i) => {
      const jid = jobIds[i % jobIds.length];
      const did = driverIds[i % driverIds.length];
      const pick = i % 5;

      if (pick === 0) {
        await timed('checkjobstatus', () => action('', '[checkjobstatus]', [
          { name: 'bookingid', Value: jid },
        ]));
      } else if (pick === 1) {
        await timed('DriverStatusChanged (Available)', () => action('', '[DriverStatusChanged]', [
          { name: 'vehicleid',   Value: did },
          { name: 'driverid',    Value: did },
          { name: 'newstatus',   Value: 'Available' },
          { name: 'zonename',    Value: 'Central' },
          { name: 'zonequeue',   Value: 1 },
          { name: 'lat',         Value: -46.41 },
          { name: 'long',        Value: 168.35 },
        ]));
      } else if (pick === 2) {
        await timed('ClosedJobs search', () => post('/DataManager/Data.aspx/DataSelectorLess', {
          data: [
            { name: 'DateFrom',   Value: '2025-01-01' },
            { name: 'DateTo',     Value: '2030-12-31' },
            { name: 'VehicleNo',  Value: '' },
          ],
          action: 'ClosedJobs',
        }));
      } else if (pick === 3) {
        await timed('SearchById', () => action('', '[SearchById]', [
          { name: 'Id', Value: jid },
        ]));
      } else {
        await timed('checkjobstatusv2', () => action('', '[checkjobstatusv2]', [
          { name: 'bookingid', Value: jid },
        ]));
      }
    });
    process.stdout.write('✓\n');
  }

  // Concurrent job-offer simulation (offer each test job once)
  console.log('\n  Simulating job offers (changeriddestatusforoffer)...');
  const offerBatch = jobIds.slice(0, Math.min(10, jobIds.length));
  await concurrent(offerBatch.length, async (i) => {
    const jid = offerBatch[i];
    const did = driverIds[i % driverIds.length];
    await timed('changeriddestatusforoffer', () => action('', '[changeriddestatusforoffer]', [
      { name: 'bookingid',    Value: jid },
      { name: 'ridestatus',   Value: 'Offered' },
      { name: 'returnreason', Value: '' },
      { name: 'driverid',     Value: did },
    ]));
  });
  console.log('  ✓ offer batch complete');
}

async function phase_clear() {
  console.log('\n[5/5] Clearing test data...');
  const r = await post('/dev/loadtest/clear', {});
  const body = JSON.parse(r.body || '{}');
  console.log(`  ✓ Removed ${body.driversRemoved} drivers, ${body.jobsRemoved} jobs`);
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       TAXI TIME — DISPATCH LOAD TEST             ║');
  console.log(`║  ${N_DRIVERS} drivers  ${N_JOBS} jobs  ${CONCURRENCY} concurrent  ${ROUNDS} rounds`.padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════╝');

  try {
    const seed = await phase_seed();
    await phase_status(seed);
    await phase_read_load();
    await phase_write_load(seed);
    await phase_clear();
    report();
  } catch (e) {
    console.error('\n[loadtest] Fatal error:', e.message);
    // Attempt cleanup even on failure
    try { await post('/dev/loadtest/clear', {}); } catch (_) {}
    process.exit(1);
  }
})();
