#!/usr/bin/env node
// Comprehensive load + integration test for Taxi Time dispatch server.
// Tests every flow: create, dispatch, accept, active, close, cancel, update,
// no-show, search, pre-queue (Queued), driver cancel, auto-dispatch, messaging.
//
// Usage:
//   node scripts/loadtest.js [--drivers N] [--jobs M] [--concurrency C]
//   Default: 500 drivers, 2000 jobs, concurrency 20

'use strict';

const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const getArg    = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? parseInt(args[i+1]) : def; };
const N_DRIVERS = getArg('--drivers',     500);
const N_JOBS    = getArg('--jobs',       2000);
const CONCUR    = getArg('--concurrency',  20);
const BASE      = 'http://localhost:5000';

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const errors = [];

function post(path, action, data = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, data });
    const options = {
      hostname: 'localhost', port: 5000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = http.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    }).on('error', reject);
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const req = http.request({ hostname:'localhost', port:5000, path, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)} }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
        catch(e) { resolve({ status: res.statusCode, body: out }); }
      });
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

function assert(name, cond, extra) {
  if (cond) {
    passed++;
  } else {
    failed++;
    const msg = `FAIL: ${name}` + (extra ? ` | ${JSON.stringify(extra)}` : '');
    errors.push(msg);
    console.error('  ' + msg);
  }
}

function p(name, params) {
  return params.map(v => ({ name, value: v }));
}
function params(...pairs) {
  const out = [];
  for (let i = 0; i < pairs.length; i += 2) out.push({ name: pairs[i], value: pairs[i+1] });
  return out;
}

// Run at most `concur` promises at a time
async function pool(items, concur, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const item = items[idx++];
      results.push(await fn(item));
    }
  }
  const workers = Array.from({ length: Math.min(concur, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Test sections ──────────────────────────────────────────────────────────────
async function testSeed() {
  console.log(`\n── SEED: ${N_DRIVERS} drivers + ${N_JOBS} jobs ──`);
  const r = await httpPost(`/dev/loadtest/seed?drivers=${N_DRIVERS}&jobs=${N_JOBS}`, {});
  assert('seed OK',           r.status === 200,                      r.body);
  assert('seed drivers count', r.body.drivers === N_DRIVERS,          r.body);
  assert('seed jobs count',    r.body.jobs === N_JOBS,                r.body);
  console.log(`  Seeded: ${r.body.drivers} drivers, ${r.body.jobs} jobs`);
  return r.body;
}

async function testStatus() {
  console.log('\n── STATUS endpoint ──');
  const r = await get('/dev/loadtest/status');
  assert('status OK',           r.status === 200, r.body);
  assert('status testDrivers',  r.body.testDrivers === N_DRIVERS, r.body);
  assert('status testJobs',     r.body.testJobs === N_JOBS, r.body);
  console.log(`  Total drivers: ${r.body.totalDrivers}, total jobs: ${r.body.totalJobs}`);
}

async function testJobListRead() {
  console.log('\n── JOB LIST READS (all angles) ──');
  const DS = '/DataManager/Data.aspx/DataSelector';
  const DSL = '/DataManager/Data.aspx/DataSelectorLess';

  // UnAssigned
  const ua = await post(DS, '[UnAssignedJobsv3]', []);
  assert('UnAssignedJobsv3 OK',     ua.status === 200, ua.body);
  const uaObj = ua.body.d ? JSON.parse(ua.body.d) : ua.body;
  assert('UnAssigned has dt1',      Array.isArray(uaObj.dt1), uaObj);
  assert('UnAssigned count > 0',    uaObj.dt1.length > 0, uaObj.dt4);

  // Assigned
  const as = await post(DS, '[AssignedJobsv2]', []);
  assert('AssignedJobsv2 OK',       as.status === 200, as.body);
  const asObj = as.body.d ? JSON.parse(as.body.d) : as.body;
  assert('Assigned has dt1',        Array.isArray(asObj.dt1), asObj);

  // Active
  const ac = await post(DSL, '[ActiveJobsv3]', []);
  assert('ActiveJobsv3 OK',         ac.status === 200, ac.body);
  const acArr = ac.body.d ? JSON.parse(ac.body.d) : ac.body;
  assert('Active is array',         Array.isArray(acArr), acArr);

  // VehiclesStatus
  const vs = await post(DS, 'VehiclesStatus', []);
  assert('VehiclesStatus OK',       vs.status === 200, vs.body);
  const vsObj = vs.body.d ? JSON.parse(vs.body.d) : vs.body;
  assert('VehiclesStatus has dt1',  Array.isArray(vsObj.dt1), vsObj);
  assert('VehiclesStatus All > 0',  vsObj.dt1[0] && vsObj.dt1[0].All >= N_DRIVERS, vsObj.dt1);

  // JobsCount
  const jc = await post(DS, 'JobsCount', []);
  assert('JobsCount OK',            jc.status === 200, jc.body);

  // AutoDispatchVehiclesallride
  const ad = await post(DS, 'AutoDispatchVehiclesallride', []);
  assert('AutoDispatch OK',         ad.status === 200, ad.body);
  const adObj = ad.body.d ? JSON.parse(ad.body.d) : ad.body;
  assert('AutoDispatch has dt1',    Array.isArray(adObj.dt1), adObj);
  assert('AutoDispatch pending > 0', adObj.dt1.length > 0, adObj.dt1);

  // AutoDispatchVehiclesv2 — zone filter
  const av2 = await post(DS, 'AutoDispatchVehiclesv2', params('ZoneId','1'));
  assert('AutoDispatchV2 OK',       av2.status === 200, av2.body);
  const av2Obj = av2.body.d ? JSON.parse(av2.body.d) : av2.body;
  assert('AutoDispatchV2 has dt2',  Array.isArray(av2Obj.dt2), av2Obj);

  // Delivery jobs
  const dy = await post(DS, '[deviUnAssignedJobsv2]', []);
  assert('DeliveryJobs OK',         dy.status === 200, dy.body);

  console.log(`  UA: ${uaObj.dt1.length} jobs | Assigned: ${asObj.dt1.length} | Active: ${acArr.length} | AD: ${adObj.dt1.length} pending`);
}

async function testCreateAndDispatch(seedData) {
  console.log('\n── CREATE + DISPATCH + ACCEPT + ACTIVE + COMPLETE (concurrent flows) ──');
  const DP  = '/DataManager/Data.aspx/DataProcessor';
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const DSR = '/DataManager/Data.aspx/DataSelectorRide';

  // Grab some test job IDs from the seed
  const jobIds = seedData.jobIds.slice(0, Math.min(100, seedData.jobIds.length));
  const driverIds = seedData.driverIds.slice(0, Math.min(100, seedData.driverIds.length));

  // Full lifecycle test for a batch of jobs concurrently
  let lifecycleOk = 0, lifecycleFail = 0;
  await pool(jobIds, CONCUR, async (jid) => {
    const did = driverIds[Math.floor(Math.random() * driverIds.length)];
    try {
      // 1. Offer job to driver
      const r1 = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
      const r1obj = r1.body.d ? JSON.parse(r1.body.d) : r1.body;
      if (r1.status !== 200 || r1obj.blocked) { lifecycleFail++; return; }

      // 2. Driver accepts (Assigned)
      const r2 = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Assigned', 'driverid', did, 'returnreason', ''));
      if (r2.status !== 200) { lifecycleFail++; return; }

      // 3. Driver goes Busy → Active (DriverStatusChanged)
      const r3 = await post(DS, '[DriverStatusChanged]', params('driverid', String(did), 'newstatus', 'Busy', 'vehiclenumber', 'T' + did, 'drivername', 'Test Driver ' + did, 'zonename', 'North', 'zonequeue', '1'));
      if (r3.status !== 200) { lifecycleFail++; return; }

      // 4. Driver finishes → Available → Completed
      const r4 = await post(DS, '[DriverStatusChanged]', params('driverid', String(did), 'newstatus', 'Available', 'vehiclenumber', 'T' + did, 'drivername', 'Test Driver ' + did, 'zonename', 'North', 'zonequeue', '1'));
      if (r4.status !== 200) { lifecycleFail++; return; }

      lifecycleOk++;
    } catch(e) {
      lifecycleFail++;
    }
  });
  assert('lifecycle flows ok (≥80%)', lifecycleOk >= Math.floor(jobIds.length * 0.8), `ok=${lifecycleOk} fail=${lifecycleFail}`);
  console.log(`  Lifecycle: ${lifecycleOk} ok / ${lifecycleFail} failed out of ${jobIds.length}`);
}

async function testCancelFlow(seedData) {
  console.log('\n── CANCEL FLOW (dispatcher cancel, driver cancel, no-show) ──');
  const DP = '/DataManager/Data.aspx/DataProcessor';
  const DS = '/DataManager/Data.aspx/DataSelector';
  const jobIds = seedData.jobIds.slice(100, 145);
  const driverIds = seedData.driverIds.slice(0, 10);

  // Dispatcher cancel (unassigned)
  let cancelOk = 0;
  for (const jid of jobIds.slice(0, 10)) {
    const r = await post(DP, '[CancelUnAssignedJobStatusFromJobList]', params('BookingId', jid));
    if (r.status === 200) cancelOk++;
  }
  assert('dispatcher cancel unassigned', cancelOk === 10, `ok=${cancelOk}`);

  // Assigned job cancel (via CancelJobStatusFromJobList)
  let cancelAssignedOk = 0;
  for (const jid of jobIds.slice(10, 20)) {
    const did = driverIds[cancelAssignedOk % driverIds.length];
    // First assign
    await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
    await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Assigned', 'driverid', did, 'returnreason', ''));
    // Then cancel
    const r = await post(DS, '[CancelJobStatusFromJobList]', params('BookingId', jid));
    if (r.status === 200) cancelAssignedOk++;
  }
  assert('cancel assigned job', cancelAssignedOk === 10, `ok=${cancelAssignedOk}`);

  // Driver cancel after accepting (explicit reject)
  let driverCancelOk = 0;
  for (const jid of jobIds.slice(20, 30)) {
    const did = driverIds[driverCancelOk % driverIds.length];
    await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
    await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Assigned', 'driverid', did, 'returnreason', ''));
    const r = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Pending', 'driverid', did, 'returnreason', 'Driver rejected job'));
    const rObj = r.body.d ? JSON.parse(r.body.d) : r.body;
    if (r.status === 200 && !rObj.blocked) driverCancelOk++;
  }
  assert('driver cancel after accepting', driverCancelOk === 10, `ok=${driverCancelOk}`);

  // No-response timeout (Unreached → Pending)
  let unreachedOk = 0;
  for (const jid of jobIds.slice(30, 40)) {
    const did = driverIds[unreachedOk % driverIds.length];
    await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
    const r = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Unreached', 'driverid', '0', 'returnreason', 'No Response From Driver'));
    const rObj = r.body.d ? JSON.parse(r.body.d) : r.body;
    if (r.status === 200 && !rObj.blocked) unreachedOk++;
  }
  assert('unreached timeout returns to Pending', unreachedOk === 10, `ok=${unreachedOk}`);

  console.log(`  Cancel: ${cancelOk} | CancelAssigned: ${cancelAssignedOk} | DriverCancel: ${driverCancelOk} | Unreached: ${unreachedOk}`);
}

async function testUpdateRide(seedData) {
  console.log('\n── UPDATE RIDE ──');
  const DP = '/DataManager/Data.aspx/DataProcessor';
  const jid = seedData.jobIds[200];
  if (!jid) { console.log('  No jobs for update test'); skipped++; return; }

  const r = await post(DP, '[ProcUpdateJobv6]', params(
    'Id', jid,
    'PickLocation', '99 Update St, Invercargill',
    'DropLocation', 'Airport Updated',
    'Name', 'Updated Passenger',
    'PassengerId', '021 999 9999',
    'PassengersNo', '2',
    'BagsNo', '1',
    'VehicleType', 'SUV',
    'DId', '0',
    'VId', '0'
  ));
  assert('update ride OK', r.status === 200, r.body);

  // Verify update via Editjobv4
  const DS = '/DataManager/Data.aspx/DataSelector';
  const e = await post(DS, '[Editjobv4]', params('Id', jid));
  assert('editjob OK', e.status === 200, e.body);
  const eObj = e.body.d ? JSON.parse(e.body.d) : e.body;
  const job = eObj.dt1 && eObj.dt1[0];
  assert('update persisted pickup', job && job.PickAddress === '99 Update St, Invercargill', job);
  assert('update persisted name',   job && job.Name === 'Updated Passenger', job);
  console.log(`  Updated job #${jid}: pickup="${job && job.PickAddress}" name="${job && job.Name}"`);
}

async function testCloseRide(seedData) {
  console.log('\n── CLOSE RIDE (UpdateBooking → Closed + ClosedJobs search) ──');
  const DP  = '/DataManager/Data.aspx/DataProcessor';
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const DSR = '/DataManager/Data.aspx/DataSelectorRide';
  const jid = seedData.jobIds[300];
  const did = seedData.driverIds[0];
  if (!jid) { console.log('  No jobs for close test'); skipped++; return; }

  // Assign → Active → Close
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Assigned', 'driverid', did, 'returnreason', ''));
  await post(DS, '[DriverStatusChanged]', params('driverid', String(did), 'newstatus', 'Busy', 'vehiclenumber', 'T' + did));

  const r = await post(DSR, 'UpdateBooking', params(
    'BookingId', jid, 'DropLocation', 'Queens Park', 'Distance', '5.2', 'Cost', '12.50', 'RideCost', '12.50'
  ));
  assert('UpdateBooking OK', r.status === 200, r.body);

  // Verify it shows in ClosedJobs
  const today = new Date().toISOString().slice(0, 10);
  const cj = await post(DS, 'ClosedJobs', params('BookingStatus', 'closed', 'FromDate', today, 'ToDate', today, 'DriverId', '', 'VehicleId', ''));
  assert('ClosedJobs OK', cj.status === 200, cj.body);
  const cjObj = cj.body.d ? JSON.parse(cj.body.d) : cj.body;
  const found = cjObj.dt1 && cjObj.dt1.some(j => String(j.Id) === String(jid));
  assert('closed job visible', found, `looking for ${jid}, found ids: ${cjObj.dt1 && cjObj.dt1.map(j=>j.Id).slice(0,5)}`);
  console.log(`  Closed job #${jid}. ClosedJobs count today: ${cjObj.dt1 && cjObj.dt1.length}`);
}

async function testHailFlow(seedData) {
  console.log('\n── HAIL (driver goes Busy with no job → hail created) ──');
  const DS = '/DataManager/Data.aspx/DataSelector';
  const DSL = '/DataManager/Data.aspx/DataSelectorLess';
  const did = seedData.driverIds[10] || '9010';

  // Go Busy → hail job created
  const r1 = await post(DS, '[DriverStatusChanged]', params(
    'driverid', String(did), 'newstatus', 'Busy',
    'vehiclenumber', 'T' + did, 'drivername', 'Hail Driver',
    'lat', '-46.4120', 'lng', '168.3538',
    'zonename', 'Central', 'zonequeue', '1'
  ));
  assert('hail Busy OK', r1.status === 200, r1.body);

  // Active jobs should now include a Hail entry
  const ac = await post(DSL, '[ActiveJobsv3]', []);
  assert('active after hail OK', ac.status === 200, ac.body);
  const acArr = ac.body.d ? JSON.parse(ac.body.d) : ac.body;
  const hail = acArr.find(j => String(j.DriverId) === String(did) && j.BookingSource === 'Hail');
  assert('hail job in active list', !!hail, `active count: ${acArr.length}`);

  // Finish hail → Available → job completed
  const r2 = await post(DS, '[DriverStatusChanged]', params(
    'driverid', String(did), 'newstatus', 'Available',
    'vehiclenumber', 'T' + did, 'drivername', 'Hail Driver',
    'zonename', 'Central', 'zonequeue', '1'
  ));
  assert('hail Available OK', r2.status === 200, r2.body);
  console.log(`  Hail job created: ${hail ? hail.Id : 'not found'} for driver ${did}`);
}

async function testQueuedFlow(seedData) {
  console.log('\n── PRE-QUEUE FLOW (Busy driver accepts → Queued → Assign tab) ──');
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const DP  = '/DataManager/Data.aspx/DataProcessor';
  const did = seedData.driverIds[20] || '9020';
  const jid = seedData.jobIds[400];
  if (!jid) { console.log('  No jobs for queue test'); skipped++; return; }

  // Put driver on a hail
  await post(DS, '[DriverStatusChanged]', params('driverid', String(did), 'newstatus', 'Busy', 'vehiclenumber', 'T'+did, 'drivername', 'Queue Driver', 'zonename', 'North'));

  // Offer job silently (would normally go to notification, here just set Offered)
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));

  // Busy driver accepts → QueueJob
  const r1 = await post(DS, '[QueueJob]', params('bookingid', jid, 'driverid', String(did)));
  assert('[QueueJob] OK', r1.status === 200, r1.body);
  const r1Obj = r1.body.d ? JSON.parse(r1.body.d) : r1.body;
  assert('[QueueJob] ok=true', r1Obj.ok === true, r1Obj);

  // Queued job must appear in AssignedJobsv2 (Assign tab)
  const as = await post(DS, '[AssignedJobsv2]', []);
  const asObj = as.body.d ? JSON.parse(as.body.d) : as.body;
  const queuedInAssign = asObj.dt1 && asObj.dt1.some(j => String(j.Id) === String(jid) && j.BookingStatus === 'Queued');
  assert('Queued job visible in Assign tab', queuedInAssign, `looking for ${jid}, statuses: ${asObj.dt1 && asObj.dt1.map(j=>j.BookingStatus)}`);

  // GetQueuedJobs
  const gq = await post(DS, '[GetQueuedJobs]', []);
  const gqObj = gq.body.d ? JSON.parse(gq.body.d) : gq.body;
  const foundInQueue = gqObj.dt1 && gqObj.dt1.some(j => String(j.Id) === String(jid));
  assert('[GetQueuedJobs] contains job', foundInQueue, gqObj.dt1);

  // RecallQueuedJob → Pending
  const r2 = await post(DS, '[RecallQueuedJob]', params('bookingid', jid));
  assert('[RecallQueuedJob] OK', r2.status === 200, r2.body);
  const r2Obj = r2.body.d ? JSON.parse(r2.body.d) : r2.body;
  assert('[RecallQueuedJob] ok=true', r2Obj.ok === true, r2Obj);

  // Driver finishes hail → Available
  await post(DS, '[DriverStatusChanged]', params('driverid', String(did), 'newstatus', 'Available', 'vehiclenumber', 'T'+did, 'zonename', 'North'));
  console.log(`  Pre-queue flow: job ${jid} queued for driver ${did}, then recalled OK`);
}

async function testSearchFlows(seedData) {
  console.log('\n── SEARCH (by ID, name, phone, date, date range) ──');
  const DSL = '/DataManager/Data.aspx/DataSelectorLess';
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const testJobId = seedData.jobIds[0];

  const byId = await post(DSL, '[SearchById]', params('Id', testJobId));
  assert('SearchById OK', byId.status === 200, byId.body);
  const byIdArr = byId.body.d ? JSON.parse(byId.body.d) : byId.body;
  assert('SearchById finds job', Array.isArray(byIdArr) && byIdArr.some(j => String(j.Id) === String(testJobId)), byIdArr.slice(0,2));

  const byName = await post(DSL, '[SearchJobByName]', params('Id', 'Alice'));
  assert('SearchByName OK', byName.status === 200, byName.body);
  const byNameArr = byName.body.d ? JSON.parse(byName.body.d) : byName.body;
  assert('SearchByName finds results', Array.isArray(byNameArr) && byNameArr.length > 0, byNameArr.length);

  const byPhone = await post(DSL, '[SearchByPhoneNo]', params('Id', '021 9'));
  assert('SearchByPhone OK', byPhone.status === 200, byPhone.body);
  const byPhoneArr = byPhone.body.d ? JSON.parse(byPhone.body.d) : byPhone.body;
  assert('SearchByPhone finds results', Array.isArray(byPhoneArr) && byPhoneArr.length > 0, byPhoneArr.length);

  const today = new Date().toISOString().slice(0, 10);
  const byDate = await post(DSL, '[SearchByAfterDate]', params('Id', today));
  assert('SearchByAfterDate OK', byDate.status === 200, byDate.body);
  const byDateArr = byDate.body.d ? JSON.parse(byDate.body.d) : byDate.body;
  assert('SearchByAfterDate finds today', Array.isArray(byDateArr) && byDateArr.length > 0, byDateArr.length);

  const dateRange = await post(DS, 'SearchJobDateBetween', params('From', today, 'To', today));
  assert('SearchDateBetween OK', dateRange.status === 200, dateRange.body);

  const details = await post(DSL, 'JobDetails', params('Id', testJobId));
  assert('JobDetails OK', details.status === 200, details.body);
  const detArr = details.body.d ? JSON.parse(details.body.d) : details.body;
  assert('JobDetails finds job', Array.isArray(detArr) && detArr.length > 0, detArr);

  console.log(`  SearchById: found. ByName "Alice": ${byNameArr.length}. ByPhone: ${byPhoneArr.length}. ByDate: ${byDateArr.length}`);
}

async function testDriverAdminFlows(seedData) {
  console.log('\n── DRIVER ADMIN (suspend, unsuspend, kick, queue update) ──');
  const DP = '/DataManager/Data.aspx/DataProcessor';
  const did = seedData.driverIds[30] || '9030';

  // Suspend
  const r1 = await post(DP, '[DispatcherKickUsers]', params('DriverId', String(did), 'VehicleId', String(did), 'SuspendedUntil', ''));
  assert('suspend driver OK', r1.status === 200, r1.body);

  // GetSuspendedDrivers
  const r2 = await post(DP, '[GetSuspendedDrivers]', []);
  assert('GetSuspendedDrivers OK', r2.status === 200, r2.body);
  const r2Obj = r2.body.d ? JSON.parse(r2.body.d) : r2.body;
  const susp = r2Obj.dt1 && r2Obj.dt1.some(s => String(s.driverId) === String(did));
  assert('driver in suspended list', susp, r2Obj.dt1 && r2Obj.dt1.length);

  // Unsuspend
  const r3 = await post(DP, '[UnsuspendDriver]', params('DriverId', String(did), 'VehicleId', String(did)));
  assert('unsuspend driver OK', r3.status === 200, r3.body);

  // Queue update
  const r4 = await post(DP, '[UpdateQueueNo]', params('VehicleId', String(did), 'QueueNo', '5'));
  assert('UpdateQueueNo OK', r4.status === 200, r4.body);

  // Kick
  const r5 = await post(DP, '[KickDriver]', params('DriverId', String(seedData.driverIds[31]), 'VehicleId', String(seedData.driverIds[31])));
  assert('KickDriver OK', r5.status === 200, r5.body);

  console.log(`  Suspend/unsuspend driver ${did} OK. Kick driver ${seedData.driverIds[31]} OK`);
}

async function testMessaging(seedData) {
  console.log('\n── MESSAGING (send, receive, broadcast, group, delete) ──');
  const DP  = '/DataManager/Data.aspx/DataProcessor';
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const DSL = '/DataManager/Data.aspx/DataSelectorLess';
  const did = seedData.driverIds[40] || '9040';
  const now = new Date().toISOString().slice(0, 19);

  const r1 = await post(DP, '[MessageInsert]', params('RecieverId', String(did), 'SenderId', 'Dispatcher', 'Message', 'Test message', 'DateTime', now));
  assert('MessageInsert OK', r1.status === 200, r1.body);

  const r2 = await post(DP, '[BroadcastMessage]', params('Message', 'All drivers please note', 'DateTime', now));
  assert('BroadcastMessage OK', r2.status === 200, r2.body);

  const r3 = await post(DP, '[GroupMessage]', params('Message', 'North zone drivers', 'Zone', 'North', 'VehicleType', '', 'DateTime', now));
  assert('GroupMessage OK', r3.status === 200, r3.body);

  const r4 = await post(DSL, '[RetrieveMessages]', []);
  assert('RetrieveMessages OK', r4.status === 200, r4.body);
  const r4Arr = r4.body.d ? JSON.parse(r4.body.d) : r4.body;
  assert('RetrieveMessages is array', Array.isArray(r4Arr), r4Arr);

  const r5 = await post(DS, '[DispatcherConversation]', params('Id', String(did)));
  assert('DispatcherConversation OK', r5.status === 200, r5.body);
  const r5Obj = r5.body.d ? JSON.parse(r5.body.d) : r5.body;
  assert('Conversation has dt2', Array.isArray(r5Obj.dt2), r5Obj);
  assert('Sent message in convo', r5Obj.dt2 && r5Obj.dt2.some(m => m.Message === 'Test message'), r5Obj.dt2 && r5Obj.dt2.length);

  console.log(`  Messaging: send, broadcast, group, retrieve, convo all OK. Convo msgs: ${r5Obj.dt2 && r5Obj.dt2.length}`);
}

async function testAwayLock(seedData) {
  console.log('\n── AWAY LOCK (reject/timeout → Away locked, genuine Available unlocks) ──');
  const DP = '/DataManager/Data.aspx/DataProcessor';
  const DS = '/DataManager/Data.aspx/DataSelector';
  const did = String(seedData.driverIds[50] || '9050');
  const jid = seedData.jobIds[500];
  if (!jid) { console.log('  No jobs for away-lock test'); skipped++; return; }

  // Offer + Unreached (driver didn't respond) → driver should be Away locked
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Unreached', 'driverid', '0', 'returnreason', 'No Response From Driver'));

  // Driver sends Available without Away first → should be blocked
  const r1 = await post(DS, '[DriverStatusChanged]', params('driverid', did, 'newstatus', 'Available', 'vehiclenumber', 'T'+did));
  assert('available blocked (no away ack)', r1.status === 200, r1.body);
  const r1Obj = r1.body.d ? JSON.parse(r1.body.d) : r1.body;
  assert('awayLocked=true in response', r1Obj.awayLocked === true, r1Obj);

  // Driver sends Away (acknowledgement)
  const r2 = await post(DS, '[DriverStatusChanged]', params('driverid', did, 'newstatus', 'Away', 'vehiclenumber', 'T'+did));
  assert('Away ack OK', r2.status === 200, r2.body);

  // Now Available should succeed
  const r3 = await post(DS, '[DriverStatusChanged]', params('driverid', did, 'newstatus', 'Available', 'vehiclenumber', 'T'+did, 'zonename', 'North'));
  assert('Available after Away ack OK', r3.status === 200, r3.body);
  const r3Obj = r3.body.d ? JSON.parse(r3.body.d) : r3.body;
  assert('not awayLocked after ack', !r3Obj.awayLocked, r3Obj);

  console.log(`  Away lock: driver ${did} locked, ack, unlocked OK`);
}

async function testDuplicateOfferGuard(seedData) {
  console.log('\n── DOUBLE OFFER GUARD (race condition — two dispatchers) ──');
  const DP = '/DataManager/Data.aspx/DataProcessor';
  const jid = seedData.jobIds[600];
  const did1 = String(seedData.driverIds[60] || '9060');
  const did2 = String(seedData.driverIds[61] || '9061');
  if (!jid) { console.log('  No jobs for double-offer test'); skipped++; return; }

  // First offer succeeds
  const r1 = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did1, 'returnreason', ''));
  assert('first offer OK', r1.status === 200, r1.body);

  // Second offer to different driver — must be blocked
  const r2 = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did2, 'returnreason', ''));
  assert('second offer OK (HTTP)', r2.status === 200, r2.body);
  const r2Obj = r2.body.d ? JSON.parse(r2.body.d) : r2.body;
  assert('second offer blocked', r2Obj.blocked === true, r2Obj);

  console.log(`  Double-offer guard: job ${jid} offered to ${did1}, second offer to ${did2} BLOCKED correctly`);
}

async function testDowngradeGuard(seedData) {
  console.log('\n── DOWNGRADE GUARD (timeout cannot cancel Assigned job) ──');
  const DP = '/DataManager/Data.aspx/DataProcessor';
  const jid = seedData.jobIds[700];
  const did = String(seedData.driverIds[70] || '9070');
  if (!jid) { console.log('  No jobs for downgrade guard test'); skipped++; return; }

  // Offer → Assigned (driver accepted)
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', ''));
  await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Assigned', 'driverid', did, 'returnreason', ''));

  // Stale timeout fires → must be blocked
  const r = await post(DP, '[changeriddestatusforoffer]', params('bookingid', jid, 'ridestatus', 'Unreached', 'driverid', '0', 'returnreason', 'No Response From Driver'));
  assert('timeout downgrade blocked', r.status === 200, r.body);
  const rObj = r.body.d ? JSON.parse(r.body.d) : r.body;
  assert('blocked=true', rObj.blocked === true, rObj);

  // Verify job still Assigned
  const DS = '/DataManager/Data.aspx/DataSelector';
  const as = await post(DS, '[AssignedJobsv2]', []);
  const asObj = as.body.d ? JSON.parse(as.body.d) : as.body;
  const stillAssigned = asObj.dt1 && asObj.dt1.some(j => String(j.Id) === String(jid));
  assert('job still in Assigned after blocked downgrade', stillAssigned, `job ${jid}`);

  console.log(`  Downgrade guard: job ${jid} stays Assigned after stale timeout`);
}

async function testNoShowAndQuickSetNoOne(seedData) {
  console.log('\n── NO SHOW + QUICK SET NO ONE ──');
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const DSL = '/DataManager/Data.aspx/DataSelectorLess';

  const jid1 = seedData.jobIds[800];
  const jid2 = seedData.jobIds[801];
  if (!jid1 || !jid2) { console.log('  No jobs for no-show test'); skipped++; return; }

  // QuickSetNoOne
  const r1 = await post(DSL, '[QuickSetNoOne]', params('BookingId', jid1));
  assert('[QuickSetNoOne] OK', r1.status === 200, r1.body);

  // Verify job shows as No One in UA list
  const ua = await post(DS, '[UnAssignedJobsv3]', []);
  const uaObj = ua.body.d ? JSON.parse(ua.body.d) : ua.body;
  const noOne = uaObj.dt1 && uaObj.dt1.find(j => String(j.Id) === String(jid1));
  assert('No One job in UA list', noOne && noOne.BookingStatus === 'No One', noOne && noOne.BookingStatus);

  console.log(`  No One: job ${jid1} → "No One" in UA list`);
}

async function testCreateJobAllSources() {
  console.log('\n── CREATE JOB (all sources: dispatch console, app, phone) ──');
  const DSR = '/DataManager/Data.aspx/DataSelectorRide';
  const DP  = '/DataManager/Data.aspx/DataProcessor';

  const sources = [
    { path: DSR, action: 'InsertBookingv4', source: 'Dispatch Console' },
    { path: DP,  action: 'InsertBookingv4', source: 'App'              },
    { path: DP,  action: '[AddBookingConsole]', source: 'Phone'        },
  ];

  for (const s of sources) {
    const r = await post(s.path, s.action, params(
      'PickLocation', '1 Test St, Invercargill',
      'DropLocation', 'Airport',
      'Name', 'Test Passenger',
      'PassengerId', '021 555 0000',
      'PassengersNo', '1',
      'BagsNo', '0',
      'VehicleType', 'Sedan',
      'DId', '0',
      'VId', '0',
      'Source', s.source
    ));
    assert(`InsertBooking (${s.source}) OK`, r.status === 200, r.body);
    const rArr = r.body.d ? JSON.parse(r.body.d) : r.body;
    assert(`InsertBooking (${s.source}) has BookingId`, rArr[0] && rArr[0].BookingId > 0, rArr[0]);
  }
  console.log(`  Create via all 3 sources: OK`);
}

async function testTariffAndEstimation() {
  console.log('\n── TARIFF SYNC + DISPATCH ESTIMATION ──');
  const DS  = '/DataManager/Data.aspx/DataSelector';
  const DSL = '/DataManager/Data.aspx/DataSelectorLess';

  // Sync tariffs
  const tariffs = JSON.stringify([
    { Id: 1, TariffName: 'Standard', StartPrice: 5.00, DistanceRate: 3.50, WaitingRate: 1.0, MinimumFare: 5.00, CurrencyName: 'NZD' },
    { Id: 2, TariffName: 'Airport',  StartPrice: 8.00, DistanceRate: 4.00, WaitingRate: 0.5, MinimumFare: 8.00, CurrencyName: 'NZD' },
  ]);
  const r1 = await post(DS, '[TariffSync]', params('tariffs', tariffs));
  assert('[TariffSync] OK', r1.status === 200, r1.body);
  const r1Obj = r1.body.d ? JSON.parse(r1.body.d) : r1.body;
  assert('[TariffSync] count=2', r1Obj.count === 2, r1Obj);

  // DispatchEstimation
  const r2 = await post(DSL, 'DispatchEstimation', params('TariffId', '2'));
  assert('DispatchEstimation OK', r2.status === 200, r2.body);
  const r2Arr = r2.body.d ? JSON.parse(r2.body.d) : r2.body;
  assert('Estimation returns Airport tariff', r2Arr[0] && r2Arr[0].TariffName === 'Airport', r2Arr[0]);
  assert('Estimation StartPrice=8', r2Arr[0] && r2Arr[0].StartPrice === 8.00, r2Arr[0]);

  // DispatcherSettings includes synced tariffs
  const r3 = await post(DS, '[DispatcherSettings]', []);
  assert('[DispatcherSettings] OK', r3.status === 200, r3.body);
  const r3Obj = r3.body.d ? JSON.parse(r3.body.d) : r3.body;
  assert('Settings has 2 tariffs in dt4', r3Obj.dt4 && r3Obj.dt4.length === 2, r3Obj.dt4);

  console.log(`  TariffSync synced 2 tariffs. DispatchEstimation for Airport: SP=$${r2Arr[0] && r2Arr[0].StartPrice}`);
}

async function testConcurrentLoad(seedData) {
  console.log(`\n── CONCURRENT LOAD TEST (${CONCUR} concurrent, 200 requests each endpoint) ──`);
  const DS = '/DataManager/Data.aspx/DataSelector';
  const reqs = Array.from({ length: 200 }, (_, i) => i);

  const t0 = Date.now();
  const results = await pool(reqs, CONCUR, async () => {
    const r = await post(DS, '[UnAssignedJobsv3]', []);
    return r.status === 200;
  });
  const t1 = Date.now();
  const ok = results.filter(Boolean).length;
  assert(`200 concurrent UA reads all OK`, ok === 200, `ok=${ok}/200`);
  console.log(`  200 concurrent job-list reads: ${ok}/200 OK in ${t1-t0}ms (${Math.round(200000/(t1-t0))} req/s)`);

  // Also stress VehiclesStatus
  const t2 = Date.now();
  const vsRes = await pool(reqs, CONCUR, async () => {
    const r = await post(DS, 'VehiclesStatus', []);
    return r.status === 200;
  });
  const t3 = Date.now();
  const vsOk = vsRes.filter(Boolean).length;
  assert(`200 concurrent VehiclesStatus all OK`, vsOk === 200, `ok=${vsOk}/200`);
  console.log(`  200 concurrent VehiclesStatus: ${vsOk}/200 OK in ${t3-t2}ms`);
}

async function testClearAndVerify() {
  console.log('\n── CLEAR load test data ──');
  const r = await httpPost('/dev/loadtest/clear', {});
  assert('clear OK', r.status === 200, r.body);
  console.log(`  Removed: ${r.body.driversRemoved} drivers, ${r.body.jobsRemoved} jobs`);

  const s = await get('/dev/loadtest/status');
  assert('testDrivers=0 after clear', s.body.testDrivers === 0, s.body);
  assert('testJobs=0 after clear',    s.body.testJobs === 0,    s.body);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(60));
  console.log(`Taxi Time — Full Load & Integration Test`);
  console.log(`Drivers: ${N_DRIVERS} | Jobs: ${N_JOBS} | Concurrency: ${CONCUR}`);
  console.log('='.repeat(60));

  try {
    const seedData = await testSeed();
    await testStatus();
    await testJobListRead();
    await testCreateJobAllSources();
    await testCreateAndDispatch(seedData);
    await testCancelFlow(seedData);
    await testUpdateRide(seedData);
    await testCloseRide(seedData);
    await testHailFlow(seedData);
    await testQueuedFlow(seedData);
    await testSearchFlows(seedData);
    await testDriverAdminFlows(seedData);
    await testMessaging(seedData);
    await testAwayLock(seedData);
    await testDuplicateOfferGuard(seedData);
    await testDowngradeGuard(seedData);
    await testNoShowAndQuickSetNoOne(seedData);
    await testTariffAndEstimation();
    await testConcurrentLoad(seedData);
    await testClearAndVerify();
  } catch (e) {
    console.error('\nFATAL ERROR:', e.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed | ${failed} failed | ${skipped} skipped`);
  if (errors.length) {
    console.log('\nFailed assertions:');
    errors.forEach(e => console.log('  ' + e));
  }
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})();
