#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// BookaWaka Full-System Mock Integration Test
// Covers: Super Admin API · Session API · Dispatch Console · Owner Panel (server)
//         Driver-app flows · Passenger-app flows · BW Platform Features
//
// Usage:  node scripts/bwtest.js
// Requires server running on port 5000.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const http = require('http');

const BASE      = 'http://localhost:5000';
const ADMIN_KEY = process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026';
const TEST_CID  = 'bwtest'; // synthetic company used for all DataManager tests
const DP        = '/DataManager/Data.aspx/DataProcessor';
const DS        = '/DataManager/Data.aspx/DataSelector';
const DSL       = '/DataManager/Data.aspx/DataSelectorLess';
const DSR       = '/DataManager/Data.aspx/DataSelectorRide';

// ── result tracking ───────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const sections = [];
let currentSection = null;

// Shared state between sections (companyId + session cookie)
const state = { cookie: '', activeCid: '' };

function section(name) {
  currentSection = { name, p: 0, f: 0, s: 0 };
  sections.push(currentSection);
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(62));
}

function ok(name, cond, extra) {
  if (cond) {
    passed++; currentSection.p++;
    console.log(`  ✓  ${name}`);
  } else {
    failed++; currentSection.f++;
    const tail = extra !== undefined ? ' | ' + JSON.stringify(extra).slice(0, 150) : '';
    console.error(`  ✗  ${name}${tail}`);
  }
}

function skip(name, reason) {
  skipped++; currentSection.s++;
  console.log(`  ⊘  ${name}  [${reason}]`);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function rawPost(path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 5000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw), ...extraHeaders }
    };
    const req = http.request(opts, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out), raw: out, headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, body: out, raw: out, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

function rawGet(path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method: 'GET', headers: extraHeaders };
    const req = http.request(opts, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out), raw: out, headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, body: out, raw: out, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// DataManager POST — automatically injects X-BW-Test-Company header
function dpost(path, action, pairs = [], extraHeaders = {}) {
  const data = [];
  for (let i = 0; i < pairs.length; i += 2) data.push({ name: pairs[i], value: String(pairs[i+1]) });
  const headers = { 'X-BW-Test-Company': TEST_CID, ...extraHeaders };
  if (state.cookie) headers['Cookie'] = state.cookie;
  return rawPost(path, { action, data }, headers);
}

function parse(r) {
  if (r.body && r.body.d) { try { return JSON.parse(r.body.d); } catch(e) {} }
  return r.body;
}

// ── Seed helper — always uses TEST_CID ───────────────────────────────────────
async function seed(drivers, jobs) {
  const r = await rawPost(`/dev/loadtest/seed?drivers=${drivers}&jobs=${jobs}&cid=${TEST_CID}`, {});
  return r.body;
}

// Login with test company (only needed for Section 3 cookie tests)
async function loginTestCompany() {
  await rawPost(`/dev/loadtest/seed?drivers=1&jobs=1&cid=${TEST_CID}`, {}); // ensure reg exists
  const r = await rawPost('/api/session/login', { companyId: TEST_CID, uid: 'test-uid-bwtest' });
  if (r.status === 200) {
    const sc = r.headers['set-cookie'] || [];
    const c = sc.find(x => x.startsWith('BW_SID='));
    if (c) { state.cookie = c.split(';')[0]; state.activeCid = TEST_CID; }
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SERVER HEALTH
// ═══════════════════════════════════════════════════════════════════════════════
async function testHealth() {
  section('1 · SERVER HEALTH');
  const r = await rawGet('/dev/loadtest/status');
  ok('GET /dev/loadtest/status responds 200', r.status === 200, r.body);
  ok('body has totalDrivers field', typeof r.body.totalDrivers === 'number', r.body);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SUPER ADMIN API
// ═══════════════════════════════════════════════════════════════════════════════
async function testSuperAdmin() {
  section('2 · SUPER ADMIN API');

  // 2a — auth guard
  ok('GET /admin/registrations rejected without key', (await rawGet('/admin/registrations')).status === 401 || (await rawGet('/admin/registrations')).status === 403);
  ok('GET /admin/registrations rejected with wrong key',
    (await rawGet('/admin/registrations', { 'X-Admin-Key': 'wrong-key' })).status === 401 ||
    (await rawGet('/admin/registrations', { 'X-Admin-Key': 'wrong-key' })).status === 403);

  // 2b — list
  const list = await rawGet('/admin/registrations', { 'X-Admin-Key': ADMIN_KEY });
  ok('GET /admin/registrations OK with correct key', list.status === 200 && Array.isArray(list.body), list.body);

  // 2c — accounts
  const accounts = await rawGet('/admin/accounts', { 'X-Admin-Key': ADMIN_KEY });
  ok('GET /admin/accounts returns array', accounts.status === 200 && Array.isArray(accounts.body), accounts.body);

  // 2d — public signup
  const testEmail = `bwtest_${Date.now()}@example.com`;
  const regR = await rawPost('/DispatcherLogin.aspx/AccountRequest', {
    company: 'BW Test Co', name: 'Test Owner', email: testEmail,
    phone: '0210000001', password: 'TestPass123!',
    businessNumber: '12345678', fleetSize: '5', area: 'Auckland', country: 'NZ'
  });
  const regOk = regR.status === 200 || regR.status === 201;
  ok('POST /DispatcherLogin.aspx/AccountRequest creates pending reg', regOk, { status: regR.status });

  let regId = null;
  if (regOk) {
    const listAfter = await rawGet('/admin/registrations', { 'X-Admin-Key': ADMIN_KEY });
    const found = Array.isArray(listAfter.body) && listAfter.body.find(r => r.email === testEmail);
    regId = found && found.id;
    ok('New registration appears in list', !!regId, { email: testEmail });

    if (regId) {
      // 2e — get single
      const single = await rawGet(`/admin/registrations/${regId}`, { 'X-Admin-Key': ADMIN_KEY });
      ok('GET /admin/registrations/:id returns correct record', single.status === 200 && single.body.email === testEmail, single.body);

      // 2f — reject
      const rej = await rawPost(`/admin/registrations/${regId}/reject`, { reason: 'Test rejection' }, { 'X-Admin-Key': ADMIN_KEY });
      ok('POST /admin/registrations/:id/reject → 200', rej.status === 200, rej.body);
      const afterRej = await rawGet(`/admin/registrations/${regId}`, { 'X-Admin-Key': ADMIN_KEY });
      ok('Status is rejected after reject', afterRej.body && afterRej.body.status === 'rejected', afterRej.body);

      // 2g — second reg: approve → activate → deactivate lifecycle
      const testEmail2 = `bwtest2_${Date.now()}@example.com`;
      const reg2 = await rawPost('/DispatcherLogin.aspx/AccountRequest', {
        company: 'BW Test Co 2', name: 'Test Owner 2', email: testEmail2,
        phone: '0210000002', password: 'TestPass456!',
        businessNumber: '87654321', fleetSize: '3', area: 'Wellington', country: 'NZ'
      });
      ok('Second registration created', reg2.status === 200 || reg2.status === 201, reg2.body);

      const list2 = await rawGet('/admin/registrations', { 'X-Admin-Key': ADMIN_KEY });
      const found2 = Array.isArray(list2.body) && list2.body.find(r => r.email === testEmail2);
      const regId2 = found2 && found2.id;
      ok('Second reg appears in list', !!regId2, { email: testEmail2 });

      if (regId2) {
        const appr = await rawPost(`/admin/registrations/${regId2}/approve`, {}, { 'X-Admin-Key': ADMIN_KEY });
        // 200 = Firebase succeeded, 207 = partial (Firebase unavailable in sandbox)
        ok('POST /admin/registrations/:id/approve → 200/207', appr.status === 200 || appr.status === 207, { status: appr.status });

        const act = await rawPost(`/admin/registrations/${regId2}/activate`, {}, { 'X-Admin-Key': ADMIN_KEY });
        ok('POST /admin/registrations/:id/activate → 200', act.status === 200, act.body);

        const deact = await rawPost(`/admin/registrations/${regId2}/deactivate`, {}, { 'X-Admin-Key': ADMIN_KEY });
        ok('POST /admin/registrations/:id/deactivate → 200', deact.status === 200, deact.body);

        const afterDeact = await rawGet(`/admin/registrations/${regId2}`, { 'X-Admin-Key': ADMIN_KEY });
        ok('Status is deactivated after deactivate', afterDeact.body && afterDeact.body.status === 'deactivated', afterDeact.body);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SESSION API
// ═══════════════════════════════════════════════════════════════════════════════
async function testSessionApi() {
  section('3 · SESSION API');

  // 3a — no cookie
  const meNone = await rawGet('/api/session/me');
  ok('GET /api/session/me without cookie → 401', meNone.status === 401, meNone.body);

  // 3b — login with test company (seed ensures the bwtest registration exists)
  const loginR = await loginTestCompany();
  ok('POST /api/session/login with bwtest company → 200', loginR.status === 200, loginR.body);
  ok('Response sets BW_SID cookie', !!state.cookie, state.cookie);

  if (state.cookie) {
    // 3c — me with valid cookie
    const me = await rawGet('/api/session/me', { Cookie: state.cookie });
    ok('GET /api/session/me with valid BW_SID → 200', me.status === 200, me.body);
    ok('/api/session/me returns correct companyId', me.body && me.body.companyId === TEST_CID, me.body);

    // 3d — forged cookie rejected
    const meFake = await rawGet('/api/session/me', { Cookie: 'BW_SID=bwtest.thisisafakehmac' });
    ok('GET /api/session/me with forged cookie → 401', meFake.status === 401, meFake.body);
  }

  // 3e — unknown email
  const cbe = await rawGet('/api/session/company-by-email?email=nobody@example.com');
  ok('GET /api/session/company-by-email (not found) → 404', cbe.status === 404, cbe.body);

  // 3f — login blocked for deactivated company (use the company we deactivated in section 2)
  // We can't guarantee which companyId was deactivated, but we can test a non-existent company
  const loginBad = await rawPost('/api/session/login', { companyId: 'ZZZZZZ', uid: 'x' });
  ok('POST /api/session/login with unknown company → 403', loginBad.status === 403, loginBad.body);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DISPATCH CONSOLE — CORE FLOWS
// ═══════════════════════════════════════════════════════════════════════════════
async function testDispatchCore() {
  section('4 · DISPATCH CONSOLE — CORE FLOWS');

  const s = await seed(5, 20);
  ok('Seed 5 drivers + 20 jobs (companyId=bwtest)', s && s.drivers === 5 && s.jobs === 20 && s.companyId === TEST_CID, s);
  if (!s || !s.jobIds || !s.driverIds) { skipped += 14; return; }

  const [j1, j2, j3, j4, j5, j6, j7] = s.jobIds;
  const [d1, d2] = s.driverIds;

  // 4a — UA list
  const ua = await dpost(DS, '[UnAssignedJobsv3]', []);
  const uaD = parse(ua);
  ok('UnAssignedJobsv3 returns seeded jobs', ua.status === 200 && Array.isArray(uaD.dt1) && uaD.dt1.length >= 20, { count: uaD.dt1 && uaD.dt1.length });

  // 4b — VehiclesStatus
  const vs = await dpost(DS, 'VehiclesStatus', []);
  const vsD = parse(vs);
  ok('VehiclesStatus shows ≥5 drivers', vs.status === 200 && vsD.dt1 && vsD.dt1[0] && vsD.dt1[0].All >= 5, vsD.dt1);

  // 4c — Create job (web booking)
  const cj = await dpost(DP, 'InsertBookingv4', [
    'CustomerName', 'Test Passenger', 'Phone', '021 555 1234',
    'PickLocation', '1 Queen St, Auckland', 'DropLocation', 'Auckland Airport',
    'PassengersNo', '2', 'BagsNo', '1', 'VehicleType', 'Sedan',
    'BookingDateTime', '', 'Notes', 'BW test booking', 'DriverId', '0', 'Source', 'Web'
  ]);
  ok('InsertBookingv4 creates web booking', cj.status === 200, cj.body);

  // 4d — Full lifecycle: offer → accept → busy → available (complete)
  const rOffer = await dpost(DP, '[changeriddestatusforoffer]',
    ['bookingid', j1, 'ridestatus', 'Offered', 'driverid', d1, 'returnreason', '']);
  ok('Offer sent to driver (Offered)', rOffer.status === 200 && !parse(rOffer).blocked, parse(rOffer));

  const rAccept = await dpost(DP, '[changeriddestatusforoffer]',
    ['bookingid', j1, 'ridestatus', 'Assigned', 'driverid', d1, 'returnreason', '']);
  ok('Driver accepts (Assigned)', rAccept.status === 200, rAccept.body);

  const rBusy = await dpost(DS, '[DriverStatusChanged]',
    ['driverid', String(d1), 'newstatus', 'Busy', 'vehiclenumber', 'T1', 'drivername', 'Driver One', 'zonename', 'North', 'zonequeue', '1']);
  ok('Driver → Busy (job in Active)', rBusy.status === 200, rBusy.body);

  const rDone = await dpost(DS, '[DriverStatusChanged]',
    ['driverid', String(d1), 'newstatus', 'Available', 'vehiclenumber', 'T1', 'drivername', 'Driver One', 'zonename', 'North', 'zonequeue', '1']);
  ok('Driver → Available (trip complete)', rDone.status === 200, rDone.body);

  // 4e — Driver reject → back to Pending in UA
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', j2, 'ridestatus', 'Offered', 'driverid', d1, 'returnreason', '']);
  const rRej = await dpost(DP, '[changeriddestatusforoffer]',
    ['bookingid', j2, 'ridestatus', 'Pending', 'driverid', d1, 'returnreason', 'Driver rejected job']);
  ok('Driver reject → job back to Pending', rRej.status === 200 && !parse(rRej).blocked, parse(rRej));

  // 4f — Unreached timeout → Pending
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', j3, 'ridestatus', 'Offered', 'driverid', d2, 'returnreason', '']);
  const rUnr = await dpost(DP, '[changeriddestatusforoffer]',
    ['bookingid', j3, 'ridestatus', 'Unreached', 'driverid', '0', 'returnreason', 'No Response From Driver']);
  ok('Unreached timeout → Pending (back in UA)', rUnr.status === 200 && !parse(rUnr).blocked, parse(rUnr));

  // 4g — Cancel unassigned
  const rCxU = await dpost(DP, '[CancelUnAssignedJobStatusFromJobList]', ['BookingId', j4]);
  ok('Cancel unassigned job', rCxU.status === 200, rCxU.body);

  // 4h — Cancel assigned
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', j5, 'ridestatus', 'Offered', 'driverid', d1, 'returnreason', '']);
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', j5, 'ridestatus', 'Assigned', 'driverid', d1, 'returnreason', '']);
  const rCxA = await dpost(DS, '[CancelJobStatusFromJobList]', ['BookingId', j5]);
  ok('Cancel assigned job', rCxA.status === 200, rCxA.body);

  // 4i — Edit job
  const rEdit = await dpost(DP, '[ProcUpdateJobv6]', [
    'Id', j6, 'PickLocation', '99 Test St', 'DropLocation', 'Airport',
    'Name', 'Updated Passenger', 'PassengerId', '021 000 0000',
    'PassengersNo', '1', 'BagsNo', '0', 'VehicleType', 'Sedan', 'DId', '0', 'VId', '0'
  ]);
  ok('Edit job (ProcUpdateJobv6)', rEdit.status === 200, rEdit.body);

  // 4j — Search by passenger name (uses [SearchJobByName] which takes 'Id' as the search term)
  const rSrch = await dpost(DS, '[SearchJobByName]', ['Id', 'Alice']);
  const rSrchD = parse(rSrch);
  ok('Search by passenger name returns results', rSrch.status === 200 && Array.isArray(rSrchD) && rSrchD.length > 0, { count: Array.isArray(rSrchD) ? rSrchD.length : rSrchD });

  // 4k — Close ride (complete the job)
  const rClose = await dpost(DSR, '[closeRide]', ['bookingId', j6, 'fare', '25.50', 'distance', '12.3', 'duration', '1200']);
  ok('[closeRide] OK', rClose.status === 200, rClose.body);

  // 4l — ClosedJobs
  const rClosed = await dpost(DS, 'ClosedJobs', ['pageNo', '1', 'pageSize', '20', 'searchText', '', 'searchType', '']);
  const rClosedD = parse(rClosed);
  ok('ClosedJobs returns array', rClosed.status === 200 && rClosedD && Array.isArray(rClosedD.dt1), rClosedD);
  ok('ClosedJobs count ≥ 1', rClosedD && rClosedD.dt1 && rClosedD.dt1.length >= 1, { count: rClosedD && rClosedD.dt1 && rClosedD.dt1.length });

  console.log(`  UA: ${uaD.dt1 && uaD.dt1.length} | Drivers: ${vsD.dt1 && vsD.dt1[0] && vsD.dt1[0].All} | Closed: ${rClosedD && rClosedD.dt1 && rClosedD.dt1.length}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DRIVER APP SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════
async function testDriverApp() {
  section('5 · DRIVER APP SIMULATION');

  const s = await seed(3, 5);
  if (!s || !s.driverIds || !s.jobIds) { skipped += 9; return; }
  const [d1, d2, d3] = s.driverIds;
  const [j1] = s.jobIds;

  // 5a — Available
  const rAvail = await dpost(DS, '[DriverStatusChanged]',
    ['driverid', String(d1), 'newstatus', 'Available', 'vehiclenumber', 'T1', 'drivername', 'Alpha Driver', 'zonename', 'South', 'zonequeue', '2']);
  ok('Driver → Available', rAvail.status === 200, rAvail.body);

  // 5b — Away (away-lock)
  const rAway = await dpost(DS, '[DriverStatusChanged]',
    ['driverid', String(d1), 'newstatus', 'Away', 'vehiclenumber', 'T1', 'drivername', 'Alpha Driver', 'zonename', 'South', 'zonequeue', '2']);
  ok('Driver → Away (away-lock set)', rAway.status === 200, rAway.body);

  // 5c — Hail job
  const rHail = await dpost(DP, '[HailCreateJob]', [
    'driverid', String(d2), 'vehicleno', 'H2', 'drivername', 'Beta Driver', 'passengerno', '1'
  ]);
  ok('[HailCreateJob] responds 200', rHail.status === 200, rHail.body);

  // 5d — Suspend driver
  const rSusp = await dpost(DP, '[DispatcherKickUsers]',
    ['DriverId', String(d3), 'VehicleId', '0', 'DriverName', 'Gamma Driver', 'VehicleNumber', 'T3', 'VehicleType', 'Sedan', 'ZoneName', 'East']);
  ok('[DispatcherKickUsers] suspends driver', rSusp.status === 200, rSusp.body);

  // 5e — Suspended list
  const rSuspList = await dpost(DS, '[GetSuspendedDrivers]', []);
  const suspD = parse(rSuspList);
  // GetSuspendedDrivers returns {dt1:[...]} or array
  const suspArr = Array.isArray(suspD) ? suspD : (suspD && Array.isArray(suspD.dt1) ? suspD.dt1 : []);
  ok('[GetSuspendedDrivers] returns list', rSuspList.status === 200, suspD);
  ok('Suspended list contains kicked driver', suspArr.some(x => String(x.driverId || x.DriverId || x.driverid) === String(d3)), { suspArr: suspArr.slice(0, 3) });

  // 5f — Unsuspend
  const rUnsup = await dpost(DP, '[UnsuspendDriver]', ['driverid', String(d3)]);
  ok('[UnsuspendDriver] removes suspension', rUnsup.status === 200, rUnsup.body);

  // 5g — Direct assign
  const rDirect = await dpost(DP, '[changeriddestatusforoffer]',
    ['bookingid', j1, 'ridestatus', 'Assigned', 'driverid', d1, 'returnreason', '']);
  ok('Direct assign (no prior offer)', rDirect.status === 200, rDirect.body);

  // 5h — QuickSetNoOne
  const rQSN = await dpost(DP, '[QuickSetNoOne]', ['BookingId', j1, 'DriverId', String(d1)]);
  ok('[QuickSetNoOne] returns job to UA', rQSN.status === 200, rQSN.body);

  // 5i — confirm job in UA
  const uaAfter = await dpost(DS, '[UnAssignedJobsv3]', []);
  const uaD = parse(uaAfter);
  ok('Job visible in UA after QuickSetNoOne', Array.isArray(uaD.dt1) && uaD.dt1.some(x => String(x.BookingId) === String(j1)), { bookingId: j1 });

  console.log(`  Suspended: ${suspArr.length} | Hail: ${rHail.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PASSENGER APP SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════
async function testPassengerApp() {
  section('6 · PASSENGER APP SIMULATION');

  // 6a — Immediate booking
  const rBook = await dpost(DP, 'InsertBookingv4', [
    'CustomerName', 'Passenger Alice', 'Phone', '027 111 2222',
    'PickLocation', '55 High St, Christchurch', 'DropLocation', 'Christchurch Airport',
    'PassengersNo', '1', 'BagsNo', '2', 'VehicleType', 'Sedan',
    'BookingDateTime', '', 'Notes', 'Passenger app test', 'DriverId', '0', 'Source', 'App'
  ]);
  ok('Passenger app: create immediate booking', rBook.status === 200, rBook.body);

  // 6b — Pre-booking (2 hours ahead)
  const futureDt = new Date(Date.now() + 2 * 3600000)
    .toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' }).replace('T', ' ');
  const rPre = await dpost(DP, 'InsertBookingv4', [
    'CustomerName', 'Passenger Bob', 'Phone', '027 333 4444',
    'PickLocation', '10 Willis St, Wellington', 'DropLocation', 'Wellington Airport',
    'PassengersNo', '2', 'BagsNo', '0', 'VehicleType', 'Sedan',
    'BookingDateTime', futureDt, 'DispatchTimebefore', '30',
    'Notes', 'Pre-booking test', 'DriverId', '0', 'Source', 'App'
  ]);
  ok('Passenger app: create pre-booking (2h ahead)', rPre.status === 200, rPre.body);

  // 6c — Ride status update (server side: Assigned → Picking)
  const s = await seed(1, 1);
  if (s && s.jobIds && s.driverIds) {
    const jid = s.jobIds[0], did = s.driverIds[0];
    await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', jid, 'ridestatus', 'Assigned', 'driverid', did, 'returnreason', '']);
    const rUpd = await dpost(DSR, '[UpdateRideStatus]',
      ['bookingId', jid, 'driverId', String(did), 'statusFrom', 'Assigned', 'statusTo', 'Picking', 'lat', '-36.8485', 'lng', '174.7633']);
    ok('Ride status update (Assigned → Picking)', rUpd.status === 200, rUpd.body);
  }

  // Firebase-only flows
  skip('Passenger rideStatus foreground banner',        'requires live Firebase rideStatus/{cid}/{bookingId}');
  skip('Passenger Expo recall push notification',       'requires live Expo token + Firebase deviceUid');
  skip('RecallStatus:"Recalled" banner in passenger app', 'requires live Firebase rideStatus write');

  console.log('  Passenger HTTP flows done. Firebase-dependent flows skipped.');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. OWNER PANEL (server-testable)
// ═══════════════════════════════════════════════════════════════════════════════
async function testOwnerPanel() {
  section('7 · OWNER PANEL');

  const rSet = await dpost(DS, '[GetCompanySettings]', []);
  ok('[GetCompanySettings] responds', rSet.status === 200, rSet.body);

  const rTariff = await dpost(DS, '[GetTariffs]', []);
  ok('[GetTariffs] responds', rTariff.status === 200, rTariff.body);

  const rEst = await dpost(DS, '[DispatchEstimation]',
    ['PickLat', '-36.8485', 'PickLng', '174.7633', 'DropLat', '-36.900', 'DropLng', '174.800']);
  ok('[DispatchEstimation] price estimate responds', rEst.status === 200, rEst.body);

  const rZones = await dpost(DS, '[GetTariffZones]', []);
  ok('[GetTariffZones] responds', rZones.status === 200, rZones.body);

  const rBcast = await dpost(DP, '[BroadcastMessage]',
    ['MessageFrom', 'OwnerPanel', 'MessageBody', 'BW test broadcast', 'MessageType', 'broadcast']);
  ok('[BroadcastMessage] sends', rBcast.status === 200, rBcast.body);

  skip('Pending Driver Approvals list',         'requires live Firebase drivers/{cid} with approved:false');
  skip('approveDriver sets drivers/{uid}/approved:true', 'requires live Firebase auth + write');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. BW PLATFORM FEATURES — SERVER-TESTABLE
// ═══════════════════════════════════════════════════════════════════════════════
async function testBwFeatures() {
  section('8 · BW PLATFORM FEATURES (server-testable)');

  const s = await seed(5, 30);
  if (!s || !s.jobIds || !s.driverIds) { skipped += 14; return; }
  const jids = s.jobIds;
  const dids = s.driverIds;

  // ── Feature #95a: AutoDispatch time-gate blocks far-future jobs ──────────────
  const farFuture = new Date(Date.now() + 48 * 3600000)
    .toLocaleString('sv-SE', { timeZone: 'Pacific/Auckland' }).replace('T', ' ');
  await dpost(DP, 'InsertBookingv4', [
    'CustomerName', 'Far Future Passenger', 'Phone', '021 000 9999',
    'PickLocation', 'Future St', 'DropLocation', 'Future Drop',
    'PassengersNo', '1', 'BagsNo', '0', 'VehicleType', 'Sedan',
    'BookingDateTime', farFuture, 'DispatchTimebefore', '30',
    'Notes', 'FF_MARKER', 'DriverId', '0', 'Source', 'Web'
  ]);
  const rAd = await dpost(DS, 'AutoDispatchVehiclesallride', []);
  const adD = parse(rAd);
  const ffFound = Array.isArray(adD.dt1) && adD.dt1.some(j => (j.Notes || '').includes('FF_MARKER'));
  ok('Feature #95a: far-future job blocked from AutoDispatch pool', rAd.status === 200 && !ffFound, { ffFound, adCount: adD.dt1 && adD.dt1.length });

  // ── Feature #97a: QuickSetNoOne restores zone queue ───────────────────────────
  const [qa_j, qa_d] = [jids[0], dids[0]];
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', qa_j, 'ridestatus', 'Offered', 'driverid', qa_d, 'returnreason', '']);
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', qa_j, 'ridestatus', 'Assigned', 'driverid', qa_d, 'returnreason', '']);
  const rQSN97 = await dpost(DP, '[QuickSetNoOne]', ['BookingId', qa_j, 'DriverId', String(qa_d)]);
  ok('Feature #97a: [QuickSetNoOne] OK', rQSN97.status === 200, rQSN97.body);

  const uaQSND = parse(await dpost(DS, '[UnAssignedJobsv3]', []));
  ok('Feature #97a: job returns to UA after QuickSetNoOne', Array.isArray(uaQSND.dt1) && uaQSND.dt1.some(x => String(x.BookingId) === String(qa_j)), { bookingId: qa_j });

  // ── Feature #97a: CancelJobStatusFromJobList ──────────────────────────────────
  const [ca_j, ca_d] = [jids[1], dids[1]];
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', ca_j, 'ridestatus', 'Offered', 'driverid', ca_d, 'returnreason', '']);
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', ca_j, 'ridestatus', 'Assigned', 'driverid', ca_d, 'returnreason', '']);
  const rCxDS = await dpost(DS, '[CancelJobStatusFromJobList]', ['BookingId', ca_j]);
  ok('Feature #97a: [CancelJobStatusFromJobList] OK', rCxDS.status === 200, rCxDS.body);

  // ── Feature #97a: UnAssignJobStatusFromJobList ────────────────────────────────
  const [ua_j, ua_d] = [jids[2], dids[2]];
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', ua_j, 'ridestatus', 'Offered', 'driverid', ua_d, 'returnreason', '']);
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', ua_j, 'ridestatus', 'Assigned', 'driverid', ua_d, 'returnreason', '']);
  const rUA97 = await dpost(DP, '[UnAssignJobStatusFromJobList]', ['BookingId', ua_j, 'DriverId', String(ua_d)]);
  ok('Feature #97a: [UnAssignJobStatusFromJobList] OK', rUA97.status === 200, rUA97.body);

  const uaUAD = parse(await dpost(DS, '[UnAssignedJobsv3]', []));
  ok('Feature #97a: job returns to Pending after UnAssign', Array.isArray(uaUAD.dt1) && uaUAD.dt1.some(x => String(x.BookingId) === String(ua_j)), { bookingId: ua_j });

  // ── Feature #107: PromoteQueuedToAssigned (Busy driver pre-queue) ─────────────
  const [pq_j, pq_d] = [jids[3], dids[3]];
  await dpost(DS, '[DriverStatusChanged]', ['driverid', String(pq_d), 'newstatus', 'Busy', 'vehiclenumber', 'PQ1', 'drivername', 'PQ Driver', 'zonename', 'East', 'zonequeue', '1']);
  const rQ = await dpost(DS, '[QueueJob]', ['bookingId', pq_j, 'driverId', String(pq_d)]);
  ok('Feature #107: [QueueJob] queues job for Busy driver', rQ.status === 200, rQ.body);

  const rGQ = await dpost(DS, '[GetQueuedJobs]', []);
  const gqRaw = parse(rGQ);
  // GetQueuedJobs may return {dt1:[...]} or a plain array; field is 'Id' (not 'BookingId')
  const gqArr = Array.isArray(gqRaw) ? gqRaw : (gqRaw && Array.isArray(gqRaw.dt1) ? gqRaw.dt1 : []);
  ok('Feature #107: [GetQueuedJobs] shows queued job', rGQ.status === 200 && gqArr.some(x => String(x.Id || x.BookingId) === String(pq_j)), { gqArr: gqArr.slice(0, 2) });

  const rPQA = await dpost(DS, '[PromoteQueuedToAssigned]', ['bookingId', pq_j, 'driverId', String(pq_d)]);
  const pqaD = parse(rPQA);
  ok('Feature #107: [PromoteQueuedToAssigned] promotes without double-accept', rPQA.status === 200 && !pqaD.alreadyStatus, pqaD);

  const assD = parse(await dpost(DS, '[AssignedJobsv2]', []));
  ok('Feature #107: promoted job in Assigned tab', Array.isArray(assD.dt1) && assD.dt1.some(x => String(x.BookingId) === String(pq_j)), { sample: assD.dt1 && assD.dt1.slice(0, 2) });

  // ── Feature #97b: Double-offer guard ─────────────────────────────────────────
  const [dg_j1, dg_j2, dg_d] = [jids[4], jids[5], dids[4]];
  const [r1, r2] = await Promise.all([
    dpost(DP, '[changeriddestatusforoffer]', ['bookingid', dg_j1, 'ridestatus', 'Offered', 'driverid', dg_d, 'returnreason', '']),
    dpost(DP, '[changeriddestatusforoffer]', ['bookingid', dg_j2, 'ridestatus', 'Offered', 'driverid', dg_d, 'returnreason', ''])
  ]);
  const r1D = parse(r1), r2D = parse(r2);
  ok('Feature #97b: double-offer guard — only one offer goes through', (!r1D.blocked && r2D.blocked) || (r1D.blocked && !r2D.blocked), { j1Blocked: r1D.blocked, j2Blocked: r2D.blocked });

  // ── Messaging ─────────────────────────────────────────────────────────────────
  const [msg_d] = dids;
  const rMsg = await dpost(DP, '[DispatcherMessages]',
    ['MessageFrom', 'Dispatch', 'MessageTo', String(msg_d), 'MessageBody', 'BW feature test message', 'MessageType', 'private']);
  ok('Send private message to driver', rMsg.status === 200, rMsg.body);

  const rMsgR = await dpost(DS, '[RetrieveMessages]', ['driverId', String(msg_d)]);
  const msgD = parse(rMsgR);
  const msgArr = Array.isArray(msgD) ? msgD : (msgD && Array.isArray(msgD.dt1) ? msgD.dt1 : []);
  ok('Retrieve messages for driver (≥1 message)', rMsgR.status === 200 && msgArr.length >= 1, { count: msgArr.length });

  // ── Feature: Recall/unassign does NOT close job ───────────────────────────────
  const [rc_j, rc_d] = [jids[6], dids[0]];
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', rc_j, 'ridestatus', 'Offered', 'driverid', rc_d, 'returnreason', '']);
  await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', rc_j, 'ridestatus', 'Assigned', 'driverid', rc_d, 'returnreason', '']);
  const rRecall = await dpost(DP, '[changeriddestatusforoffer]',
    ['bookingid', rc_j, 'ridestatus', 'Pending', 'driverid', rc_d, 'returnreason', 'manually unassigned']);
  ok('Recall/unassign: job returns to UA (not closed)', rRecall.status === 200 && !parse(rRecall).blocked, parse(rRecall));

  const uaRC = parse(await dpost(DS, '[UnAssignedJobsv3]', []));
  ok('Recalled job visible in UA', Array.isArray(uaRC.dt1) && uaRC.dt1.some(x => String(x.BookingId) === String(rc_j)), { bookingId: rc_j });

  console.log(`  AD pool: ${adD.dt1 && adD.dt1.length} | Queued: ${gqArr.length} | Messages: ${msgArr.length}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. BW FEATURES — FIREBASE / BROWSER ONLY
// ═══════════════════════════════════════════════════════════════════════════════
async function testBwFeaturesBrowser() {
  section('9 · BW PLATFORM FEATURES — FIREBASE/BROWSER (no server to call)');

  skip('Feature 8: service badges from drivers/{uid}/allowedServices',  'browser Angular — needs live Firebase + driver app');
  skip('Feature 8: company module gate superClients/{cid}/modules',     'browser Angular — needs live Firebase superClients node');
  skip('Feature 8: _bwCanDriverDoService blocks wrong-service dispatch', 'browser Angular — no HTTP endpoint');
  skip('Feature 8: service filter bar All/Taxi/Food/Freight/TM',        'browser Angular ng-repeat — UI-only');

  skip('Feature 9: SHARED badge when driver.companyId ≠ SomeSession2', 'browser Angular — needs live Firebase drivers/{uid}');
  skip('Feature 9: _bwFetchDriverSharedStatus reads drivers/{uid}',     'browser Firebase read — no server proxy');
  skip('Feature 9: eager fetch on cars_Ref child_added',                'browser Firebase listener — needs live driver app');

  skip('_bwNotifyPassengerRecall: Expo push to deviceUid',              'browser fetch to exp.host — needs live Expo token');
  skip('_bwNotifyPassengerRecall: RecallStatus to rideStatus/{cid}/{bid}', 'browser Firebase write — needs live auth');
  skip('_bwNotifyPassengerRecall: Passengerjobs/{deviceUid} write',     'browser Firebase write — needs live auth');
  skip('⚠ Recalled badge on UA card with recall reason',               'browser Angular ng-if — needs live job data');
  skip('#tabRecalled filter shows only recalled jobs',                   'browser Angular — UI tab filter');

  skip('Owner Panel pendingDrivers from drivers/{cid} approved=false',  'browser Firebase once() — needs live Firebase');
  skip('approveDriver sets drivers/{uid}/approved:true',                'browser Firebase set() — needs live auth');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CONCURRENT LOAD SMOKE
// ═══════════════════════════════════════════════════════════════════════════════
async function testConcurrent() {
  section('10 · CONCURRENT LOAD SMOKE');

  const s = await seed(50, 200);
  ok('Seed 50 drivers + 200 jobs', s && s.drivers === 50 && s.jobs === 200, s);
  if (!s || !s.jobIds) { skipped += 3; return; }

  // 200 concurrent UA reads
  const start = Date.now();
  const reads = await Promise.all(Array.from({ length: 200 }, () => dpost(DS, '[UnAssignedJobsv3]', [])));
  const elapsed = Date.now() - start;
  ok('200 concurrent UA reads all return 200', reads.every(r => r.status === 200), { failCount: reads.filter(r => r.status !== 200).length });
  const rps = Math.round(200 / (elapsed / 1000));
  ok(`Throughput ≥ 50 req/s (got ${rps})`, rps >= 50, { rps, ms: elapsed });

  // 50 concurrent dispatch offers
  let ok50 = 0, fail50 = 0;
  await Promise.all(s.jobIds.slice(0, 50).map(async (jid, i) => {
    const did = s.driverIds[i % s.driverIds.length];
    try {
      const r = await dpost(DP, '[changeriddestatusforoffer]', ['bookingid', jid, 'ridestatus', 'Offered', 'driverid', did, 'returnreason', '']);
      parse(r).blocked ? fail50++ : ok50++;
    } catch(e) { fail50++; }
  }));
  ok(`50 concurrent dispatch offers (≥80% through)`, ok50 >= 40, { ok: ok50, fail: fail50 });

  console.log(`  UA: ${rps} req/s | Offers: ${ok50} ok / ${fail50} fail`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(62));
  console.log('  BookaWaka Full-System Mock Integration Test');
  console.log(`  Server: ${BASE}  |  Admin key: ${ADMIN_KEY.slice(0,6)}...  |  Test company: ${TEST_CID}`);
  console.log('═'.repeat(62));

  const run = async (fn) => { try { await fn(); } catch(e) { console.error(`SECTION ERROR: ${e.message}`); failed++; } };

  await run(testHealth);
  await run(testSuperAdmin);
  await run(testSessionApi);
  await run(testDispatchCore);
  await run(testDriverApp);
  await run(testPassengerApp);
  await run(testOwnerPanel);
  await run(testBwFeatures);
  await run(testBwFeaturesBrowser);
  await run(testConcurrent);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('  RESULTS BY SECTION');
  console.log('═'.repeat(62));
  for (const s of sections) {
    const icon = s.f > 0 ? '✗' : '✓';
    console.log(`  ${icon}  ${s.name.padEnd(52)} P:${String(s.p).padStart(3)}  F:${String(s.f).padStart(3)}  S:${String(s.s).padStart(3)}`);
  }

  const total = passed + failed;
  const pct   = total ? Math.round(passed / total * 100) : 0;
  console.log('\n' + '═'.repeat(62));
  console.log(`  TOTAL   ✓ ${passed}  ✗ ${failed}  ⊘ ${skipped} skipped   (${pct}% pass)`);
  console.log('  NOTE    ⊘ = requires live Firebase/mobile apps — cannot be server-tested');
  console.log('═'.repeat(62) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
