// Must be set before any Date operations — forces all new Date() calls to use NZ time
// so BookingDateTime, JobMins, and dispatch timestamps match the dispatcher's local clock.
process.env.TZ = 'Pacific/Auckland';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'taxitime.co.nz', 'Dispatchthree');

const mimeTypes = {
  '.html': 'text/html',
  '.aspx': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

// ─── Persistent data directory ────────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, '.data');
const JOB_STORE_FILE  = path.join(DATA_DIR, 'jobstore.json');
const COOKIE_FILE     = path.join(DATA_DIR, 'session.txt');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }

// ─── In-memory job store ──────────────────────────────────────────────────────
// Booking ID format: DDMMYYYY + 3-digit daily sequence → e.g. 18042026001
let _idSeqDate = '';
let _idSeqCounter = 0;
function newJobId() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const today = dd + mm + yyyy;
  if (today !== _idSeqDate) { _idSeqDate = today; _idSeqCounter = 0; }
  _idSeqCounter++;
  return parseInt(today + String(_idSeqCounter).padStart(3, '0'));
}

// ─── In-memory message store ──────────────────────────────────────────────────
let nextMsgId = 100;
const messageStore = [];

function buildDriverChatList() {
  return ZONE_DRIVERS.map(d => {
    const did = String(d.driverid || d.VehicleId || '');
    const unread = messageStore.filter(m => String(m.SenderId) === did && !m.IsRead).length;
    const dn = d.drivername || '';
  return { Id: d.driverid || d.VehicleId, UserFName: dn.split(' ')[0], UserLName: dn.split(' ').slice(1).join(' '), Count: unread, PlayerId: '' };
  });
}

// ─── Closed job store (historical demo data) ──────────────────────────────────
// Closed job demo records — dates are kept within the past 7 days so they
// survive the client-side "DateFrom = today" filter in the ClosedJobs search.
function _closedDate(daysAgo, time) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd} ${time}.`;
}
const closedJobStore = [
  { Id: 937100, BookingDateTime: _closedDate(0, '09:00:00'), JobCompleteTime: _closedDate(0, '09:28:00'), PickAddress: '12 Dee St, Invercargill', DropAddress: 'Invercargill Hospital, Kew Rd', Name: 'Alice Brown', PhoneNo: '021 400 1001', VehicleNo: 'T201', UserFName: 'Michael', UserLName: 'Johnson', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 101, VehicleId: 201 },
  { Id: 937101, BookingDateTime: _closedDate(0, '11:15:00'), JobCompleteTime: _closedDate(0, '11:47:00'), PickAddress: '88 Tay St, Invercargill', DropAddress: 'Invercargill Airport', Name: 'Brian Clark', PhoneNo: '021 400 1002', VehicleNo: 'T202', UserFName: 'Sarah', UserLName: 'Wilson', BookingSource: 'Dispatch Console', BookingStatus: 'Dispatched', DriverId: 102, VehicleId: 202 },
  { Id: 937102, BookingDateTime: _closedDate(1, '13:30:00'), JobCompleteTime: '', PickAddress: '5 Don St, Invercargill', DropAddress: 'Waikiwi Mall', Name: 'Carol Evans', PhoneNo: '021 400 1003', VehicleNo: 'T203', UserFName: 'David', UserLName: 'Thompson', BookingSource: 'Phone', BookingStatus: 'Cancel', DriverId: 103, VehicleId: 203 },
  { Id: 937103, BookingDateTime: _closedDate(1, '07:45:00'), JobCompleteTime: _closedDate(1, '08:05:00'), PickAddress: '200 Elles Rd, Invercargill', DropAddress: '14 Yarrow St, Invercargill', Name: 'Daniel Ford', PhoneNo: '021 400 1004', VehicleNo: 'T204', UserFName: 'Emma', UserLName: 'Davies', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 104, VehicleId: 204 },
  { Id: 937104, BookingDateTime: _closedDate(2, '16:00:00'), JobCompleteTime: '', PickAddress: '3 Leven St, Invercargill', DropAddress: 'Queens Park, Invercargill', Name: 'Eve Green', PhoneNo: '021 400 1005', VehicleNo: 'T205', UserFName: 'James', UserLName: 'Brown', BookingSource: 'Dispatch Console', BookingStatus: 'No Show', DriverId: 105, VehicleId: 205 },
  { Id: 937105, BookingDateTime: _closedDate(2, '10:00:00'), JobCompleteTime: _closedDate(2, '10:22:00'), PickAddress: 'Invercargill Airport', DropAddress: '56 Gala St, Invercargill', Name: 'Frank Harris', PhoneNo: '021 400 1006', VehicleNo: 'T201', UserFName: 'Michael', UserLName: 'Johnson', BookingSource: 'App', BookingStatus: 'Dispatched', DriverId: 101, VehicleId: 201 },
];

function calcJobMins(bookingDateTimeStr) {
  const bdt = new Date(bookingDateTimeStr.replace(/\.$/, '').trim());
  const now = new Date();
  return Math.round((bdt - now) / 60000);
}

// Sort jobs newest-first: prefer JobCompleteTime (for closed jobs), then BookingDateTime.
function sortByRecent(jobs) {
  return [...jobs].sort((a, b) => {
    const ta = new Date((a.JobCompleteTime || a.BookingDateTime || '').replace(/\.$/, '').trim()).getTime() || 0;
    const tb = new Date((b.JobCompleteTime || b.BookingDateTime || '').replace(/\.$/, '').trim()).getTime() || 0;
    return tb - ta;
  });
}

// Add UI-friendly field aliases to a job object so Angular ng-repeat bindings work
// (template uses BookingDate, BookingTime, PassengerId, TarriffType, bookingidx)
function enrichSearchResult(j) {
  const rawDT = (j.BookingDateTime || '').replace(/\.$/, '').trim();
  const [datePart = '', timePart = ''] = rawDT.split(' ');
  return {
    ...j,
    bookingidx:   j.Id,
    BookingDate:  datePart,
    BookingTime:  timePart,
    PassengerId:  j.Name || j.PassengerId || '',
    TarriffType:  j.TarriffType || j.BookingSource || '',
  };
}

// Format a Date object as the "YYYY-MM-DD HH:MM:SS." string the client expects
function fmtDT(dt) {
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:00.`;
}

// Live job store — loaded from disk on startup, saved on every mutation
let _savedJobStore = [];
try {
  if (fs.existsSync(JOB_STORE_FILE)) {
    _savedJobStore = JSON.parse(fs.readFileSync(JOB_STORE_FILE, 'utf8')) || [];
    console.log(`[persist] loaded ${_savedJobStore.length} jobs from disk`);
  }
} catch(e) { console.log('[persist] jobstore load error:', e.message); }

const jobStore = _savedJobStore;

// Sync the daily sequence counter so new IDs don't collide with saved ones.
// Existing IDs in the new DDMMYYYY+seq format start with today's date prefix.
(function syncIdSequence() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const prefix = dd + mm + yyyy;   // e.g. "18042026"
  const prefixNum = parseInt(prefix + '000');
  const maxSeq = jobStore.reduce((mx, j) => {
    const id = j.Id || 0;
    if (id >= prefixNum && id < prefixNum + 1000) {
      const seq = id - prefixNum;
      return Math.max(mx, seq);
    }
    return mx;
  }, 0);
  if (maxSeq > 0) { _idSeqDate = prefix; _idSeqCounter = maxSeq; }
})();

// Self-heal: any job that is Assigned but has no driver (DriverId=0) got orphaned.
// Recover it to Pending so the dispatcher can re-offer it.
(function healOrphanedJobs() {
  let healed = 0;
  jobStore.forEach(j => {
    if (j.BookingStatus === 'Assigned' && (!j.DriverId || String(j.DriverId) === '0')) {
      j.BookingStatus = 'Pending';
      j.returnReason = j.returnReason || 'Driver returned job (went available)';
      healed++;
    }
  });
  if (healed > 0) {
    try { fs.writeFileSync(JOB_STORE_FILE, JSON.stringify(jobStore, null, 2)); } catch(e) {}
    console.log(`[self-heal] recovered ${healed} orphaned Assigned job(s) -> Pending`);
  }
})();

function saveJobStore() {
  // Async write — avoids blocking the event loop on every job status change.
  fs.writeFile(JOB_STORE_FILE, JSON.stringify(jobStore, null, 2), (err) => {
    if (err) console.log('[persist] jobstore save error:', err.message);
  });
}

// Live drivers come exclusively from Firebase (online/1216).
// This array is kept as an empty structure so dependent code paths don't crash.
const ZONE_DRIVERS = [];

// Load-test tracking sets — track injected test driver/job IDs so /dev/loadtest/clear
// can remove exactly them without affecting real data.
const LT_DRIVER_IDS = new Set();
const LT_JOB_IDS    = new Set();

// Drivers locked to Away because they didn't accept / rejected a job.
// Format: { "driverId": { ts: <ms>, ackAway: <bool> } }
//
// Lock is cleared ONLY when:
//   1. Driver gets a new job (Busy / Assigned / Picking).
//   2. Driver's app sends an Away heartbeat (ackAway → true), proving the phone
//      showed Away mode, AND then sends Available (genuine manual press).
//   3. Safety timeout: 3 minutes, so drivers are never locked forever if the
//      driver app never sends an Away heartbeat.
//
// Pure Available heartbeats are BLOCKED while locked — they do NOT clear the lock.
const AWAY_LOCKED = {};
const AWAY_LOCK_TTL_MS = 3 * 60 * 1000; // 3-minute safety net

// Suspended drivers — removed from live board but restorable by the dispatcher.
// Each entry: { driverId, vehicleId, drivername, vehiclenumber, vehicletype, zonename, suspendedAt }
const SUSPENDED_DRIVERS = [];

// Track jobs the dispatcher has deliberately recalled so [DriverStatusChanged] never
// mis-classifies the resulting driver Available signal as a driver-initiated cancel.
const DISPATCHER_RECALLED = {}; // jobId → expiry timestamp
const DISPATCHER_RECALLED_TTL_MS = 10 * 1000; // 10 s window covers any network race
function markDispatcherRecalled(jobId) {
  DISPATCHER_RECALLED[String(jobId)] = Date.now() + DISPATCHER_RECALLED_TTL_MS;
}
function isDispatcherRecalled(jobId) {
  const exp = DISPATCHER_RECALLED[String(jobId)];
  if (!exp) return false;
  if (Date.now() > exp) { delete DISPATCHER_RECALLED[String(jobId)]; return false; }
  return true;
}
function clearDispatcherRecalled(jobId) {
  delete DISPATCHER_RECALLED[String(jobId)];
}

function setAwayLock(driverId) {
  if (!driverId || String(driverId) === '0') return;
  AWAY_LOCKED[String(driverId)] = { ts: Date.now(), ackAway: false };
  console.log(`  [awayLock] driver ${driverId} LOCKED Away`);
}
function clearAwayLock(driverId) {
  if (AWAY_LOCKED[String(driverId)]) {
    delete AWAY_LOCKED[String(driverId)];
    console.log(`  [awayLock] driver ${driverId} lock CLEARED`);
  }
}
function acknowledgeAway(driverId) {
  const lock = AWAY_LOCKED[String(driverId)];
  if (lock && !lock.ackAway) {
    lock.ackAway = true;
    console.log(`  [awayLock] driver ${driverId} Away ACKNOWLEDGED — next Available will unlock`);
  }
}
function isAwayLocked(driverId) {
  const lock = AWAY_LOCKED[String(driverId)];
  if (!lock) return false;
  if (Date.now() - lock.ts > AWAY_LOCK_TTL_MS) {
    delete AWAY_LOCKED[String(driverId)];
    console.log(`  [awayLock] driver ${driverId} lock auto-expired (3 min safety)`);
    return false;
  }
  return true;
}
// Returns true when a genuine manual Available press should clear the lock.
// Only true after driver app sent an Away heartbeat (ackAway), proving the phone
// switched to Away mode and the driver manually pressed Available afterwards.
function canUnlockWithAvailable(driverId) {
  const lock = AWAY_LOCKED[String(driverId)];
  return !!(lock && lock.ackAway);
}

// ─── Driver Zone Memory ────────────────────────────────────────────────────────
// Tracks each driver's zone + queue position so we can intelligently restore
// their slot when a job finishes or is cancelled.
//
// Rules:
//   1. Available after Away (reject/timeout)     → end of queue in current zone
//   2. Job cancelled, driver still in same zone  → restore original slot number
//   3. Job cancelled, driver in a different zone → queue #1 in that (new) zone
//   4. Driver zone changes back to home zone     → restore home queue position
//
const DRIVER_ZONE_MEMORY = {};

// Save a driver's current zone & queue position as their "home state".
// Call this when they are Available and before they are dispatched.
function saveDriverHomeState(driverId, zd) {
  if (!driverId || !zd) return;
  const id = String(driverId);
  DRIVER_ZONE_MEMORY[id] = Object.assign(DRIVER_ZONE_MEMORY[id] || {}, {
    homeZone:     zd.zonename  || '',
    homeZoneId:   zd.zoneid    || '',
    homeQueuePos: parseInt(zd.zonequeue) || 999,
    savedAt:      Date.now(),
  });
  console.log(`  [zoneMemory] driver ${driverId} home saved → zone="${zd.zonename}" q=${zd.zonequeue}`);
}

function getDriverHomeState(driverId) {
  return DRIVER_ZONE_MEMORY[String(driverId)] || null;
}

function clearDriverHomeState(driverId) {
  delete DRIVER_ZONE_MEMORY[String(driverId)];
}

// Return the queue number at the end of a zone's Available list.
// (excludeDriverId skips the driver being repositioned so they don't count themselves.)
function nextQueueInZone(zoneName, excludeDriverId) {
  const zone = (zoneName || '').toLowerCase().trim();
  const inZone = ZONE_DRIVERS.filter(d => {
    const dz = (d.zonename || '').toLowerCase().trim();
    return dz === zone &&
           d.vehiclestatus === 'Available' &&
           String(d.driverid || d.VehicleId) !== String(excludeDriverId);
  });
  if (!inZone.length) return 1;
  const maxQ = Math.max(...inZone.map(d => parseInt(d.zonequeue) || 0));
  return maxQ + 1;
}

// Given a driver's current zone and their zone-memory record, return the correct
// queue position to assign when they go Available.
//   • Same zone as home → restore their saved slot (or end if slot is now taken)
//   • Different zone    → #1 (they arrived to serve a cross-zone job, reward them)
//   • No memory         → end of current zone queue
function calcRestoredQueue(driverId, currentZone) {
  const mem = getDriverHomeState(driverId);
  const czLower = (currentZone || '').toLowerCase().trim();
  if (!mem) {
    return nextQueueInZone(currentZone, driverId);
  }
  const homeZoneLower = (mem.homeZone || '').toLowerCase().trim();
  if (czLower === homeZoneLower && czLower !== '') {
    // Same zone: restore original slot (clamp to actual end if others filled it)
    const endPos = nextQueueInZone(currentZone, driverId);
    return Math.min(mem.homeQueuePos, endPos);
  } else {
    // Different zone: reward with pole position
    return 1;
  }
}

// Build full job-list DataSelector response
function buildJobListResponse(jobs) {
  // Terminal statuses — jobs in these states are done and must NOT appear in the dispatcher queue
  const TERMINAL = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
  const allNonTerminal = jobs.filter(j => !TERMINAL.has(j.BookingStatus));
  // dt1 = jobs that belong in the Unassigned/Pending tab.
  // 'Unreached' = driver didn't respond; 'No One' = auto-dispatch found no driver.
  // Assigned+DriverId=0 is an orphaned job (driver left without completing) — treat as Pending.
  const PENDING_ST = new Set(['Pending', 'Offered', 'Reject', 'Unreached', 'No One']);
  const isOrphaned = j => j.BookingStatus === 'Assigned' && (!j.DriverId || String(j.DriverId) === '0');
  const pendingJobs = allNonTerminal.filter(j => PENDING_ST.has(j.BookingStatus) || isOrphaned(j));
  const dt1 = pendingJobs.map(j => ({ ...j, JobMins: calcJobMins(j.BookingDateTime) }));
  return {
    dt1,
    dt2: [{ AssignedCount: allNonTerminal.filter(j => j.BookingStatus === 'Assigned' && !isOrphaned(j)).length }],
    dt3: [{ ActiveCount: allNonTerminal.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking').length }],
    dt4: [{ UnAssignedCount: pendingJobs.filter(j => j.BookingStatus === 'Pending' || j.BookingStatus === 'Unreached' || j.BookingStatus === 'No One' || isOrphaned(j)).length }],
    dt5: [{ PublicKey: '' }],
  };
}

// Build delivery (DY tab) response — mirrors buildJobListResponse with deUnAssignedCount
function buildDeliveryResponse(jobs) {
  const deliveryJobs = jobs.filter(j => j.BookingType === 'Delivery' || j.BookingSource === 'Delivery App');
  const dt1 = deliveryJobs.map(j => ({ ...j, JobMins: calcJobMins(j.BookingDateTime) }));
  return {
    dt1,
    dt2: [{ AssignedCount: 0 }],
    dt3: [{ ActiveCount: 0 }],
    dt4: [{ deUnAssignedCount: dt1.length }],
    dt5: [{ PublicKey: '' }],
  };
}

function buildAssignedResponse(jobs) {
  // 'Offered' = dispatcher sent the job, driver hasn't accepted yet → stays in Pending/Offered tab
  // 'Assigned' = driver accepted → shows in Assigned tab only
  // Exclude orphaned jobs (Assigned but DriverId=0) — those appear in Unassigned tab instead.
  const assigned = jobs.filter(j => j.BookingStatus === 'Assigned' && j.DriverId && String(j.DriverId) !== '0');
  const dt1 = assigned.map(j => ({ ...j, BookingId: j.Id, JobMins: calcJobMins(j.BookingDateTime) }));
  const activeCount = jobs.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking').length;
  return {
    dt1,
    dt2: [{ AssignedCount: dt1.length }],
    dt3: [{ ActiveCount: activeCount }],
    dt4: [{ UnAssignedCount: jobs.filter(j => j.BookingStatus === 'Pending' || j.BookingStatus === 'Unreached' || j.BookingStatus === 'No One').length }],
    dt5: [{ PublicKey: '' }],
  };
}

// ─── Real-backend proxy ───────────────────────────────────────────────────────
// Forwards DataManager AJAX calls to the live taxitime.co.nz ASP.NET backend,
// including cookie passthrough so ASP.NET sessions work end-to-end.
const REAL_BACKEND_HOST = 'taxitime.co.nz';
const REAL_BACKEND_PREFIX = '/Dispatchthree';

// Server-side session cache: once any request successfully authenticates with the
// production backend, store the resulting ASP.NET session cookie here.  Subsequent
// proxy requests merge this cookie in, so every browser tab benefits from a single
// successful login without needing its own session cookie.
// Load previously-cached session cookie from disk (survives server restarts)
let _cachedProductionCookies = '';
try {
  if (fs.existsSync(COOKIE_FILE)) {
    _cachedProductionCookies = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
    if (_cachedProductionCookies) console.log('[persist] loaded session cookie from disk');
  }
} catch(e) { console.log('[persist] cookie load error:', e.message); }

// Merge a Set-Cookie header value into the cached cookie jar (key=value pairs only)
function _cacheCookiesFromHeader(rawCookies) {
  if (!rawCookies) return;
  const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  const jar = {};
  // Seed jar with already-cached values
  _cachedProductionCookies.split(';').forEach(pair => {
    const [k, v] = pair.trim().split('=');
    if (k) jar[k.trim()] = (v || '').trim();
  });
  // Overlay new cookies from response
  cookies.forEach(c => {
    const kv = c.split(';')[0].trim();
    const [k, v] = kv.split('=');
    if (k) jar[k.trim()] = (v || '').trim();
  });
  _cachedProductionCookies = Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ');
  console.log(`[proxy] updated server-side session cookie (${Object.keys(jar).length} keys)`);
  // Persist to disk so the session survives server restarts
  try { fs.writeFileSync(COOKIE_FILE, _cachedProductionCookies); } catch(e) { console.log('[persist] cookie save error:', e.message); }
}

// Strip domain/SameSite attrs and return browser-safe Set-Cookie strings
function _sanitiseCookiesForBrowser(rawCookies) {
  if (!rawCookies) return [];
  const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
  return cookies.map(c =>
    c.replace(/;\s*domain=[^;,]*/gi, '').replace(/;\s*samesite=[^;,]*/gi, '')
  );
}

function proxyToRealBackend(urlPath, method, body, incomingCookies) {
  return new Promise((resolve, reject) => {
    const targetPath = REAL_BACKEND_PREFIX + urlPath;
    const bodyBuf    = Buffer.from(body || '');

    // Merge browser cookies with the server-side cached production session cookie
    // so requests succeed even when the browser's own session cookie is missing.
    const mergedCookies = (() => {
      const jar = {};
      const add = str => (str || '').split(';').forEach(pair => {
        const [k, v] = pair.trim().split('=');
        if (k && k.trim()) jar[k.trim()] = (v || '').trim();
      });
      add(_cachedProductionCookies);  // cached first (lower priority)
      add(incomingCookies);           // browser cookie overrides
      return Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; ');
    })();

    const options = {
      hostname: REAL_BACKEND_HOST,
      port: 443,
      path: targetPath,
      method: method,
      headers: {
        'Content-Type':   'application/json; charset=utf-8',
        'Content-Length': bodyBuf.length,
        'Cookie':         mergedCookies,
        'User-Agent':     'Mozilla/5.0 (compatible; TaxiTimeDispatch/1.0)',
        'Accept':         'application/json, text/javascript, */*',
        'Origin':         'https://taxitime.co.nz',
        'Referer':        'https://taxitime.co.nz/Dispatchthree/',
      },
      timeout: 8000,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => {
        resolve({
          statusCode: proxyRes.statusCode,
          headers:    proxyRes.headers,
          body:       Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    proxyReq.on('timeout', () => { proxyReq.destroy(); reject(new Error('proxy timeout')); });
    proxyReq.on('error',   reject);
    if (bodyBuf.length) proxyReq.write(bodyBuf);
    proxyReq.end();
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Access-Control-Allow-Origin': '*',
};

function jsonReply(res, obj) {
  res.writeHead(200, JSON_HEADERS);
  res.end(JSON.stringify(obj));
}

function successD(res, msg) {
  jsonReply(res, { d: msg });
}

function arrayD(res, arr) {
  jsonReply(res, { d: JSON.stringify(arr) });
}

function objectD(res, obj) {
  jsonReply(res, { d: JSON.stringify(obj) });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

function resolveFilePath(urlPath) {
  const candidates = [
    path.join(ROOT, urlPath),
    path.join(ROOT, urlPath + '.html'),
    path.join(ROOT, urlPath, 'Default.aspx'),
    path.join(ROOT, urlPath, 'index.html'),
  ];
  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch (e) {}
  }
  return null;
}

const SILENT_OK_PATTERNS = ['/cdn-cgi/', '/%7B%7B', '/{{'];

// ─── Request handler ──────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/Default.aspx';

  if (SILENT_OK_PATTERNS.some(p => urlPath.startsWith(p))) {
    res.writeHead(200, JSON_HEADERS);
    res.end('{}');
    return;
  }

  // Serve a minimal transparent 1×1 favicon to silence the 404 log noise
  if (urlPath === '/favicon.ico') {
    const favicon = Buffer.from(
      'AAABAAEAAQEAAAEAGAAwAAAAFgAAACgAAAABAAAAAgAAAAEAGAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAA',
      'base64'
    );
    res.writeHead(200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' });
    res.end(favicon);
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── Dev / Load-test endpoints ────────────────────────────────────────────
  // POST /dev/loadtest/seed?drivers=N&jobs=M
  //   Injects N simulated Available drivers into ZONE_DRIVERS and M Pending
  //   jobs into jobStore so the load test script can exercise auto-dispatch,
  //   polling, and status-change endpoints without needing a real driver app.
  // POST /dev/loadtest/clear
  //   Removes all injected test data (drivers whose id starts with 9000,
  //   jobs whose Id is in the LT_JOB_IDS set).
  if (urlPath === '/dev/loadtest/seed' && req.method === 'POST') {
    const qs   = new URL('http://x' + req.url).searchParams;
    const nD   = Math.min(parseInt(qs.get('drivers') || '10'), 100);
    const nJ   = Math.min(parseInt(qs.get('jobs')    || '20'), 200);
    const zones = ['Central','North','South','East','West'];
    LT_DRIVER_IDS.clear();
    LT_JOB_IDS.clear();
    // Inject fake drivers
    for (let i = 0; i < nD; i++) {
      const did = 9000 + i;
      LT_DRIVER_IDS.add(String(did));
      // Remove any stale entry first
      const ei = ZONE_DRIVERS.findIndex(d => String(d.driverid) === String(did));
      if (ei !== -1) ZONE_DRIVERS.splice(ei, 1);
      ZONE_DRIVERS.push({
        driverid:      did,
        VehicleId:     did,
        drivername:    `Test Driver ${i + 1}`,
        vehiclestatus: 'Available',
        zonename:      zones[i % zones.length],
        zoneid:        String(i % zones.length + 1),
        zonequeue:     i + 1,
        queueWaitSince: Date.now(),
        lat:           -46.40 + (Math.random() * 0.1),
        lng:           168.35 + (Math.random() * 0.1),
        _isLoadTest:   true,
      });
    }
    // Inject fake jobs
    const pickAddrs  = ['1 Dee St','2 Tay St','3 Kelvin St','4 Esk St','5 Don St'];
    const dropAddrs  = ['Invercargill Airport','ILT Stadium','Southland Hospital','Queens Park','The Warehouse'];
    const names      = ['Alice T','Bob M','Carol W','Dave R','Eve S'];
    for (let j = 0; j < nJ; j++) {
      const jid = newJobId();
      LT_JOB_IDS.add(String(jid));
      jobStore.push({
        Id: jid, BookingId: jid,
        BookingDateTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
        PickAddress:  pickAddrs[j % pickAddrs.length] + ', Invercargill',
        DropAddress:  dropAddrs[j % dropAddrs.length],
        Name:         names[j % names.length],
        PhoneNo:      `021 ${900000 + j}`,
        BookingStatus: 'Pending',
        DriverId: 0, VehicleId: 0, VehicleNo: '',
        Passengers: 1, Bags: 0,
        returnReason: '',
        _isLoadTest: true,
      });
    }
    console.log(`[loadtest] seeded ${nD} drivers, ${nJ} jobs`);
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({ ok: true, drivers: nD, jobs: nJ,
      driverIds: [...LT_DRIVER_IDS], jobIds: [...LT_JOB_IDS] }));
    return;
  }
  if (urlPath === '/dev/loadtest/clear' && req.method === 'POST') {
    let driversRemoved = 0, jobsRemoved = 0;
    for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
      if (ZONE_DRIVERS[i]._isLoadTest) { ZONE_DRIVERS.splice(i, 1); driversRemoved++; }
    }
    for (let i = jobStore.length - 1; i >= 0; i--) {
      if (jobStore[i]._isLoadTest) { jobStore.splice(i, 1); jobsRemoved++; }
    }
    LT_DRIVER_IDS.clear();
    LT_JOB_IDS.clear();
    saveJobStore();
    console.log(`[loadtest] cleared ${driversRemoved} drivers, ${jobsRemoved} jobs`);
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({ ok: true, driversRemoved, jobsRemoved }));
    return;
  }
  if (urlPath === '/dev/loadtest/status' && req.method === 'GET') {
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({
      totalDrivers:    ZONE_DRIVERS.length,
      testDrivers:     ZONE_DRIVERS.filter(d => d._isLoadTest).length,
      totalJobs:       jobStore.length,
      testJobs:        jobStore.filter(j => j._isLoadTest).length,
      awayLocked:      Object.keys(AWAY_LOCKED).length,
      zoneMemory:      Object.keys(DRIVER_ZONE_MEMORY).length,
    }));
    return;
  }

  // ── DataManager POST routing ────────────────────────────────────────────────
  if (req.method === 'POST' && urlPath.includes('/DataManager/')) {
    const body = await readBody(req);
    let parsed = {};
    try { parsed = JSON.parse(body); } catch (e) {}
    const action = (parsed.action || '').toString();
    const dataArr = Array.isArray(parsed.data) ? parsed.data : [];

    // Helper: find a param value by name (case-insensitive, trims trailing spaces)
    function param(name) {
      const n = name.toLowerCase().trim();
      const found = dataArr.find(p => (p.name || '').toLowerCase().trim() === n);
      return found ? (found.value !== undefined ? found.value : found.Value) : undefined;
    }

    // Helper: filter a job list by the UI status selector value.
    // The UI uses 'Closed' for all terminal jobs and 'Open' for all live jobs.
    // The real backend stores completed rides as 'Dispatched'; our mock uses 'Completed'.
    // Both are treated as terminal/closed.
    function applyStatusFilter(jobs, statusFilter) {
      const sf = (statusFilter || '').toLowerCase().trim();
      if (!sf || sf === 'all') return jobs;
      const CLOSED_ST = new Set(['dispatched','completed','done','closed','cancel','cancelled','no show','noshow','reject']);
      const OPEN_ST   = new Set(['pending','offered','assigned','picking','active']);
      let matchSet;
      if (sf === 'closed')     matchSet = CLOSED_ST;
      else if (sf === 'open')  matchSet = OPEN_ST;
      else if (sf === 'dispatched') matchSet = new Set(['dispatched','completed','done','closed']);
      else                     matchSet = new Set([sf]);
      return jobs.filter(j => matchSet.has((j.BookingStatus || '').toLowerCase()));
    }

    // ── Proxy to real taxitime.co.nz backend ───────────────────────────────
    // Actions that are custom additions to this demo — real backend won't know them,
    // so skip the proxy and go straight to local mock handlers for these.
    const LOCAL_ONLY_ACTIONS = new Set([
      // Job list reads — served entirely from local store
      '[UnAssignedJobsv3]', '[deviUnAssignedJobsv2]',
      '[AssignedJobsv2]', '[ActiveJobsv3]',
      // Job write / status changes — both plain and v2 are handled locally; v2 does background sync
      '[AssignJobStatusFromJobList]', '[AssignJobStatusFromJobListv2]',
      '[UnAssignJobStatusFromJobList]', '[CancelUnAssignedJobStatusFromJobList]',
      '[changeriddestatusforoffer]', '[DriverStatusChanged]',
      '[checkjobstatus]', '[checkjobstatusv2]',
      // Ride-status gate checks — mock-only, must NOT proxy to real backend
      'checkriddestatusforoffer', 'checkriddestatusforautodispatch', 'checkriddestatus',
      // Closed / search — served from local store + static demo records
      'ClosedJobs', 'SearchJobs', 'SearchJobDateBetween',
      '[SearchJobByName]', '[SearchById]', '[SearchByPhoneNo]',
      '[SearchByAfterDate]', '[SearchByBeforeDate]',
      // Read-only mock data — no real-backend equivalent in demo mode
      'VehiclesStatus', 'JobsCount', 'AutoDispatchVehiclesallride',
      'AutoDispatchVehiclesv2', 'ZoneCoordinates', 'DispatchEstimation',
      'JobDetails', '[VehicleInfov2]', '[DispatcherSettings]', '[Editjobv4]',
      '[checkjobstatusv2]', '[DispatcherConversation]', '[DispatcherUnReadMessages]',
      'Manager_ACC_GET', 'Client_ACC_GET', 'Client_ACC_ALL',
      'Approve_ACC_GET', 'ACC_All_approval',
      // Messaging
      '[MessageInsert]', '[DriverMessageInsert]', '[BroadcastMessage]',
      '[GroupMessage]', '[DeleteMessage]',
      // Admin
      '[KickDriver]', '[DispatcherKickUsers]', '[GetSuspendedDrivers]', '[UnsuspendDriver]', '[UpdateQueueNo]',
      '[ZonesListUpdate]', '[payment_percentage]', '[storeemergency]',
      '[CancelJobStatusFromJobList]', '[QuickSetNoOne]',
    ]);

    if (!LOCAL_ONLY_ACTIONS.has(action)) {
      try {
        const proxied = await proxyToRealBackend(
          urlPath, req.method, body, req.headers['cookie'] || ''
        );
        const bodyText = (proxied.body || '').trim();
        const isSessionExpired = bodyText.includes('Session is experied') || bodyText.includes('Session is expired');

        // Always cache any Set-Cookie headers the production backend sends back
        // (even for failed/non-JSON responses) so the session stays alive.
        if (proxied.headers['set-cookie'] && !isSessionExpired) {
          _cacheCookiesFromHeader(proxied.headers['set-cookie']);
        }

        // Special case: LoginSelector — just forward the cookies and return success.
        // The production login endpoint may return a plain string or non-JSON body;
        // we don't care about the body — we just need the session cookie set.
        if (action === 'LoginSelector' && proxied.statusCode === 200 && !isSessionExpired) {
          const replyHeaders = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };
          const sanitised = _sanitiseCookiesForBrowser(proxied.headers['set-cookie']);
          if (sanitised.length) replyHeaders['Set-Cookie'] = sanitised;
          res.writeHead(200, replyHeaders);
          res.end(JSON.stringify({ d: 'Login OK' }));
          console.log(`200: PROXY→REAL LoginSelector — session cookie acquired`);
          return;
        }

        // For all other actions: use proxy response only if it is valid JSON and
        // not a session-expired message (which would cause an infinite logout loop).
        if (proxied.statusCode === 200 && !isSessionExpired && (bodyText.startsWith('{') || bodyText.startsWith('['))) {
          const replyHeaders = {
            'Content-Type': proxied.headers['content-type'] || 'application/json',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };
          // Forward sanitised cookies (domain stripped) so browser stores them
          const sanitised = _sanitiseCookiesForBrowser(proxied.headers['set-cookie']);
          if (sanitised.length) replyHeaders['Set-Cookie'] = sanitised;
          res.writeHead(200, replyHeaders);
          res.end(proxied.body);
          console.log(`200: PROXY→REAL ${urlPath} [action=${action}] (${bodyText.length} bytes)`);
          return;
        }
        if (isSessionExpired) {
          console.log(`proxy ${action}: real backend has no session → falling back to mock`);
        } else {
          console.log(`proxy ${action}: status=${proxied.statusCode}, falling back to mock`);
        }
      } catch (proxyErr) {
        console.log(`proxy ${action}: ${proxyErr.message} — falling back to mock`);
      }
    }

    // ── /DataSelectorRide — booking write operations ────────────────────────
    if (urlPath.includes('/DataSelectorRide')) {
      if (action === 'InsertBookingv4') {
        const newId = newJobId();
        const pickAddr = param('PickLocation') || param('PickAddress') || 'Unknown pickup';
        const dropAddr = param('DropLocation') || param('DropAddress') || '';
        const pickLatLng = param('PickLatLng') || '-46.4120,168.3538';
        const dropLatLng = param('DropLatLng') || '0,0';
        const bookingDT = param('BookingDateTime') || (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00.`;
        })();
        const pickingDT = param('PickingDateTime') || bookingDT;
        const vehicleType = param('VehicleType') || 'Not Specified';
        const driverId  = parseInt(param('DId') || '0') || 0;
        // VehicleId is a string call-sign (e.g. "T201") — do NOT parseInt it or 'T201' becomes 0.
        const vehicleId = param('VId') || '0';
        const passengers = parseInt(param('PassengersNo') || '1') || 1;
        const bags = parseInt(param('BagsNo') || '0') || 0;
        const wheelchairs = parseInt(param('WheelChairsNo') || '0') || 0;
        const name = param('Name') || '';
        const phone = param('PassengerId') || '';
        const entitiesDetails = param('EntitiesDetails') || '';
        const _dbRaw = param('DispatchBefore') !== undefined ? param('DispatchBefore') : param('Dispatchbefore');
        const dispatchBefore = _dbRaw !== undefined && _dbRaw !== null ? (parseInt(_dbRaw) || 0) : 10;
        const bookingType = param('Bookingtype') || 'Normal Ride';
        const quenumber = param('quenumber') || 0;
        const dispatcherName = param('DispatcherName') || 'Dispatcher';
        const u_id = param('u_id') || param('U_id') || null;

        const bookstatus = driverId > 0 ? 'Offered' : (driverId === -1 ? 'No One' : 'Pending');
        const newJob = {
          Id: newId, AccountId: '', VehicleNo: null, CallSign: null,
          useremail: null, usertype: null, webstatus: '0',
          Name: name, PhoneNo: phone,
          BookingDateTime: bookingDT,
          Pickingtime: pickingDT,
          Recieve_payment: param('Recieve_payment') || '',
          DispatchTimebefore: String(dispatchBefore),
          VehicleId: vehicleId, DriverId: driverId,
          DispatcherName: dispatcherName,
          Nextstop: String(param('nextstop') || '0'), nextstopdata: param('nextstopdata') || '',
          Passengers: passengers, passengername: '',
          PickLatLng: pickLatLng, DropLatLng: dropLatLng,
          Bags: bags, WheelChairs: wheelchairs, VehiclesReguired: parseInt(param('VRequired') || '1') || 1,
          Acc_job_id: param('Acc_job_id') || '', Account_id: param('Account_id') || '',
          PickAddress: pickAddr, DropAddress: dropAddr,
          EntitiesDetails: entitiesDetails, U_id: u_id,
          BookingSource: param('Source') || 'Dispatch Console',
          BookingStatus: bookstatus,
          VehicleType: vehicleType,
          EstimatedDistance: param('Distance') || '0',
          EstimatedTime: param('Time') || '0',
          TarriffType: 'Automatic',
        };
        jobStore.push(newJob);
        saveJobStore();
        console.log(`200: POST ${urlPath} [action=InsertBookingv4] -> created job #${newId}`);
        arrayD(res, [{ Result: 'Booking Information Successfully Submitted', BookingStatus: bookstatus, BookingId: newId }]);
      } else if (action === 'UpdateBooking') {
        // Called by cancelactivejob / close-ride flow.
        // Marks the job as Closed, moves it to closedJobStore, and releases the driver.
        const closeId = parseInt(param('BookingId') || '0') || 0;
        const dropLoc  = param('DropLocation')  || '';
        const distance = param('Distance')  || '0';
        const cost     = param('Cost')      || '0';
        const rideCost = param('RideCost')  || '0';
        const jobIdx   = jobStore.findIndex(j => j.Id === closeId);
        if (jobIdx !== -1) {
          const job = jobStore[jobIdx];
          job.BookingStatus = 'Closed';
          if (dropLoc)  job.DropAddress = dropLoc;
          if (distance) job.EstimatedDistance = distance;
          if (cost)     job.Cost = cost;
          if (rideCost) job.RideCost = rideCost;
          // Release the driver back to Available
          const closingDriverId = job.DriverId;
          const zd = ZONE_DRIVERS.find(d => d.driverid === closingDriverId || d.VehicleId === closingDriverId);
          if (zd) { zd.vehiclestatus = 'Available'; zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0; }
          // Move to closed store
          closedJobStore.push(job);
          jobStore.splice(jobIdx, 1);
          saveJobStore();
          console.log(`200: POST ${urlPath} [action=UpdateBooking] -> closed job #${closeId}, driver ${closingDriverId} released`);
          arrayD(res, [{ Result: 'Ride Ended Successfully', BookingId: closeId }]);
        } else {
          // Job may already be closed or not found
          console.log(`200: POST ${urlPath} [action=UpdateBooking] -> job #${closeId} not found (may be already closed)`);
          arrayD(res, [{ Result: 'Ride Ended Successfully', BookingId: closeId }]);
        }
      } else {
        console.log(`200: POST ${urlPath} [action=${action}] -> OK`);
        successD(res, 'Operation Successfully Performed');
      }
      return;
    }

    // ── /DataProcessor — all write operations ──────────────────────────────
    if (urlPath.includes('/DataProcessor')) {
      if (action === 'InsertBookingv4' || action === '[AddBookingConsole]') {
        const newId = newJobId();
        const pickAddr = param('PickLocation') || param('PickAddress') || 'Unknown pickup';
        const dropAddr = param('DropLocation') || param('DropAddress') || '';
        const pickLatLng = param('PickLatLng') || '-46.4120,168.3538';
        const dropLatLng = param('DropLatLng') || '0,0';
        const bookingDT = param('BookingDateTime') || (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00.`;
        })();
        const pickingDT = param('PickingDateTime') || bookingDT;
        const vehicleType = param('VehicleType') || 'Not Specified';
        const driverId  = parseInt(param('DId') || '0') || 0;
        // VehicleId is a string call-sign (e.g. "T201") — do NOT parseInt it or 'T201' becomes 0.
        const vehicleId = param('VId') || '0';
        const passengers = parseInt(param('PassengersNo') || '1') || 1;
        const bags = parseInt(param('BagsNo') || '0') || 0;
        const wheelchairs = parseInt(param('WheelChairsNo') || '0') || 0;
        const name = param('Name') || '';
        const phone = param('PassengerId') || '';
        const entitiesDetails = param('EntitiesDetails') || '';
        const _dbRaw = param('DispatchBefore') !== undefined ? param('DispatchBefore') : param('Dispatchbefore');
        const dispatchBefore = _dbRaw !== undefined && _dbRaw !== null ? (parseInt(_dbRaw) || 0) : 10;
        const bookingType = param('Bookingtype') || 'Normal Ride';
        const dispatcherName = param('DispatcherName') || 'Dispatcher';
        const u_id = param('u_id') || param('U_id') || null;
        const bookstatus = driverId > 0 ? 'Offered' : (driverId === -1 ? 'No One' : 'Pending');
        const newJob = {
          Id: newId, AccountId: '', VehicleNo: null, CallSign: null,
          useremail: null, usertype: null, webstatus: '0',
          Name: name, PhoneNo: phone,
          BookingDateTime: bookingDT,
          Pickingtime: pickingDT,
          Recieve_payment: param('Recieve_payment') || '',
          DispatchTimebefore: String(dispatchBefore),
          VehicleId: vehicleId, DriverId: driverId,
          DispatcherName: dispatcherName,
          Nextstop: String(param('nextstop') || '0'), nextstopdata: param('nextstopdata') || '',
          Passengers: passengers, passengername: '',
          PickLatLng: pickLatLng, DropLatLng: dropLatLng,
          Bags: bags, WheelChairs: wheelchairs, VehiclesReguired: parseInt(param('VRequired') || '1') || 1,
          Acc_job_id: param('Acc_job_id') || '', Account_id: param('Account_id') || '',
          PickAddress: pickAddr, DropAddress: dropAddr,
          EntitiesDetails: entitiesDetails, U_id: u_id,
          BookingSource: param('Source') || 'Dispatch Console',
          BookingStatus: bookstatus,
          VehicleType: vehicleType,
          EstimatedDistance: param('Distance') || '0',
          EstimatedTime: param('Time') || '0',
          TarriffType: 'Automatic',
        };
        jobStore.push(newJob);
        saveJobStore();
        console.log(`200: POST ${urlPath} [action=${action}] -> created job #${newId} (${bookingDT})`);
        arrayD(res, [{ Result: 'Booking Information Successfully Submitted', BookingStatus: bookstatus, BookingId: newId }]);

      } else if (action === '[ProcUpdateJobv6]') {
        const jobId = parseInt(param('Id')) || 0;
        const job = jobStore.find(j => j.Id === jobId);
        if (job) {
          const driverId  = parseInt(param('DId') || '0') || 0;
          const vehicleId = parseInt(param('VId') || '0') || 0;
          if (param('PickLocation'))    job.PickAddress    = param('PickLocation');
          if (param('DropLocation'))    job.DropAddress    = param('DropLocation');
          if (param('PickLatLng'))      job.PickLatLng     = param('PickLatLng');
          if (param('DropLatLng'))      job.DropLatLng     = param('DropLatLng');
          if (param('Name'))            job.Name           = param('Name');
          if (param('PassengerId'))     job.PhoneNo        = param('PassengerId');
          if (param('PassengersNo'))    job.Passengers     = parseInt(param('PassengersNo'));
          if (param('BagsNo'))          job.Bags           = parseInt(param('BagsNo')) || 0;
          if (param('WheelChairsNo'))   job.WheelChairs    = parseInt(param('WheelChairsNo')) || 0;
          if (param('EntitiesDetails')) job.EntitiesDetails= param('EntitiesDetails');
          if (param('VehicleType'))     job.VehicleType    = param('VehicleType');
          job.VehicleId = vehicleId;
          job.DriverId  = driverId;
          // Persist booking time and dispatch notice — sent by both updateride and updateride2.
          // Dispatchbefore=0 means ASAP; >0 means pre-booked (advance notice in minutes).
          // Must use explicit undefined check because 0 is falsy but is a valid ASAP value.
          const _dbRaw = param('Dispatchbefore');
          if (_dbRaw !== undefined) job.DispatchTimebefore = String(parseInt(_dbRaw) || 0);
          const _newDT = param('DateTime');
          if (_newDT) { job.BookingDateTime = _newDT; job.Pickingtime = _newDT; }
          // Only change status for jobs that are still in a pre-dispatch state.
          // Never overwrite Active/Assigned — editing a live job must not cancel it.
          const editableStatuses = new Set(['Pending','Offered','Unreached','No One','']);
          if (editableStatuses.has(job.BookingStatus || '')) {
            if (driverId > 0)       job.BookingStatus = 'Offered';
            else if (driverId === -1) job.BookingStatus = 'No One';
            else                     job.BookingStatus = 'Pending';
          }
          if (job.BookingStatus === 'Offered') job.returnReason = '';
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> "Booking Details Update Successfully"`);
        successD(res, 'Booking Details Update Successfully');

      } else if (action === '[checkjobstatus]') {
        // Gate check before dispatching — return 'true' (job is free to dispatch)
        // so the frontend proceeds with [AssignJobStatusFromJobListv2]
        const bookingId = parseInt(param('bookingsID') || param('BookingId') || '0') || 0;
        const alreadyOffered = bookingId > 0 && jobStore.some(j => j.Id === bookingId && j.BookingStatus === 'Offered');
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} alreadyOffered=${alreadyOffered}`);
        jsonReply(res, { d: alreadyOffered ? 'false' : 'true' });

      } else if (action === '[CancelUnAssignedJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const idx = jobStore.findIndex(j => j.Id === bookingId);
        if (idx !== -1) {
          const job = jobStore[idx];
          job.BookingStatus = 'Cancel';
          job.CancelledBy   = 'Dispatcher';
          job.JobCompleteTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
          closedJobStore.push(job);
          jobStore.splice(idx, 1);
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> cancelled job #${bookingId} -> moved to closedJobStore`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]' || action === '[UnAssignJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const job = jobStore.find(j => j.Id === bookingId);
        const driverId = parseInt(param('reternVehicleid') || param('VehicleId') || '0') || 0;
        if (job) {
          if (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]') {
            job.BookingStatus = 'Assigned';
            job.DriverId = driverId;
            if (driverId > 0) job.VehicleId = driverId;
            const zd = ZONE_DRIVERS.find(d => d.driverid === driverId || d.VehicleId === driverId);
            if (zd) {
              zd.vehiclestatus = 'Picking';
              zd.JobphoneNo = job.PhoneNo || '';
              zd.jobpickup  = job.PickAddress || '';
              zd.jobdropoff = job.DropAddress || '';
              zd.jobCount   = 1;
            }
          } else {
            // Unassign — restore demo driver to Available
            const prevDriverId = job.DriverId || 0;
            job.BookingStatus = 'Pending';
            job.DriverId = 0;
            job.VehicleId = 0;
            const zd = ZONE_DRIVERS.find(d => d.driverid === prevDriverId || d.VehicleId === prevDriverId);
            if (zd) {
              zd.vehiclestatus = 'Available';
              zd.JobphoneNo = '';
              zd.jobpickup  = '';
              zd.jobdropoff = '';
              zd.jobCount   = 0;
            }
          }
          saveJobStore();
        }
        // Fire-and-forget: also update the real taxitime.co.nz backend so that
        // [AssignedJobsv2] (which proxies to real backend) reflects this assignment.
        if (action === '[AssignJobStatusFromJobListv2]' && bookingId > 0 && driverId > 0) {
          const realBody = JSON.stringify({
            action: '[AssignJobStatusFromJobList]',
            data: [
              { name: 'BookingId', Value: bookingId },
              { name: 'VehicleId', Value: driverId },
              { name: 'reternVehicleid', Value: 0 },
              { name: 'reterndriverId',  Value: 0  },
            ]
          });
          proxyToRealBackend('/DataManager/Data.aspx/DataProcessor', 'POST', realBody, req.headers['cookie'] || '')
            .then(r => console.log(`[sync] [AssignJobStatusFromJobList] job #${bookingId} → real backend: ${r.statusCode}`))
            .catch(e => console.log(`[sync] [AssignJobStatusFromJobList] job #${bookingId} → real backend failed: ${e.message}`));
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> "Operation Successfully Performed"`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === 'InsertAlarm') {
        successD(res, 'Alarm Saved Successfully');
      } else if (action === 'UpdateAlarm' || action === 'UpdateAlarts' || action === 'UpdateAlerts') {
        successD(res, 'Operation Successfully Performed');
      } else if (action === 'storeemergency') {
        successD(res, 'Emergency Stored');

      } else if (action === 'ACC_Approval_add') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval saved`);
        successD(res, 'Approval successfully Saved');

      } else if (action === 'ACC_Approval_update') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval updated`);
        successD(res, 'Approval successfully update');

      } else if (action === 'Client_ACC_ADD') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC client added`);
        successD(res, 'Client successfully Saved');

      } else if (action === 'Manager_ACC_ADD') {
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC manager added`);
        successD(res, 'Manager successfully Saved');

      } else if (action === 'checkmanagername' || action === 'checkmanageremail' || action === 'checkmanagerphone' || action === 'checkpassengernumber') {
        console.log(`200: POST ${urlPath} [action=${action}] -> remote validation ok`);
        jsonReply(res, { d: 'true' });

      } else if (action === '[storeemergency]') {
        console.log(`200: POST ${urlPath} [action=${action}] -> emergency stored`);
        successD(res, 'Emergency Stored');

      } else if (action === '[MessageInsert]') {
        const receiverId = (param('RecieverId') || param('ReceiverId') || '').trim();
        const message    = param('Message') || '';
        const dateTime   = param('DateTime') || '';
        const datePart   = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart   = dateTime.substring(11) || '';
        if (message.trim() && receiverId) {
          const msg = { Id: nextMsgId++, SenderId: 'Dispatcher', ReceiverId: receiverId, SenderName: 'Dispatcher', Message: message, Date: datePart, Time: timePart, IsRead: true };
          messageStore.push(msg);
          console.log(`200: POST ${urlPath} [action=${action}] -> message saved to driver #${receiverId}`);
        }
        successD(res, 'Message Saved');

      } else if (action === '[DriverMessageInsert]') {
        // Incoming message FROM a driver → dispatcher (sent via Firebase, stored here for history)
        const senderId  = (param('SenderId') || '').toString().trim();
        const message   = param('Message') || '';
        const dateTime  = param('DateTime') || '';
        const datePart  = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart  = dateTime.substring(11) || '';
        const driver    = ZONE_DRIVERS.find(d => String(d.driverid) === senderId || String(d.VehicleId) === senderId) || { drivername: 'Driver ' + senderId };
        if (message.trim()) {
          const msg = { Id: nextMsgId++, SenderId: senderId, ReceiverId: 'Dispatcher', SenderName: driver.drivername || ('Driver ' + senderId), Message: message, Date: datePart, Time: timePart, IsRead: false };
          messageStore.push(msg);
          console.log(`200: POST ${urlPath} [action=${action}] -> message stored from driver #${senderId}`);
        }
        successD(res, 'Message stored');

      } else if (action === '[BroadcastMessage]') {
        const message  = param('Message') || '';
        const dateTime = param('DateTime') || '';
        const datePart = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart = dateTime.substring(11) || '';
        if (message.trim()) {
          ZONE_DRIVERS.forEach(d => {
            messageStore.push({ Id: nextMsgId++, SenderId: 0, ReceiverId: d.driverid, SenderName: 'Dispatcher (Broadcast)', Message: message, Date: datePart, Time: timePart, IsRead: true });
          });
          console.log(`200: POST ${urlPath} [action=${action}] -> broadcast to ${ZONE_DRIVERS.length} drivers`);
        }
        successD(res, 'Broadcast sent successfully');

      } else if (action === '[GroupMessage]') {
        const message   = param('Message') || '';
        const zone      = (param('Zone') || '').toLowerCase();
        const vtype     = (param('VehicleType') || '').toLowerCase();
        const dateTime  = param('DateTime') || '';
        const datePart  = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart  = dateTime.substring(11) || '';
        let targets = [...ZONE_DRIVERS];
        if (zone) targets = targets.filter(d => d.zonename.toLowerCase().includes(zone));
        if (vtype) targets = targets.filter(d => d.vehicletype.toLowerCase().includes(vtype));
        if (message.trim()) {
          targets.forEach(d => {
            messageStore.push({ Id: nextMsgId++, SenderId: 0, ReceiverId: d.driverid, SenderName: 'Dispatcher (Group)', Message: message, Date: datePart, Time: timePart, IsRead: true });
          });
          console.log(`200: POST ${urlPath} [action=${action}] -> group message to ${targets.length} drivers`);
        }
        successD(res, `Group message sent to ${targets.length} drivers`);

      } else if (action === '[DeleteMessage]') {
        const msgId = parseInt(param('Id') || '0') || 0;
        const idx = messageStore.findIndex(m => m.Id === msgId);
        if (idx !== -1) messageStore.splice(idx, 1);
        console.log(`200: POST ${urlPath} [action=${action}] -> deleted message #${msgId}`);
        successD(res, 'Message Deleted');

      } else if (action === '[KickDriver]') {
        const driverId  = param('DriverId') || '';
        const vehicleId = param('VehicleId') || '';
        // Remove driver from demo roster so they disappear from the dispatch board
        const beforeLen = ZONE_DRIVERS.length;
        for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
          if (String(ZONE_DRIVERS[i].driverid) === driverId || String(ZONE_DRIVERS[i].VehicleId) === vehicleId) {
            ZONE_DRIVERS.splice(i, 1);
          }
        }
        console.log(`200: POST ${urlPath} [action=[KickDriver]] -> driver ${driverId} kicked (removed ${beforeLen - ZONE_DRIVERS.length} entries)`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[DispatcherKickUsers]') {
        const driverId  = (param('DriverId')  || '').toString().trim();
        const vehicleId = (param('VehicleId') || '').toString().trim();
        const vehicleIdNum = parseInt(vehicleId) || 0;
        // Save driver info before removing so it can be restored later
        const _suspZd = ZONE_DRIVERS.find(d =>
          String(d.driverid) === driverId || String(d.VehicleId) === vehicleId ||
          (vehicleIdNum > 0 && (d.driverid === vehicleIdNum || d.VehicleId === vehicleIdNum))
        );
        if (_suspZd) {
          // Remove any previous suspension record for this driver first
          const _prevIdx = SUSPENDED_DRIVERS.findIndex(s => String(s.driverId) === String(_suspZd.driverid) || String(s.vehicleId) === String(_suspZd.VehicleId));
          if (_prevIdx !== -1) SUSPENDED_DRIVERS.splice(_prevIdx, 1);
          SUSPENDED_DRIVERS.push({
            driverId:      String(_suspZd.driverid),
            vehicleId:     String(_suspZd.VehicleId),
            drivername:    _suspZd.drivername    || '',
            vehiclenumber: _suspZd.vehiclenumber || '',
            vehicletype:   _suspZd.vehicletype   || '',
            zonename:      _suspZd.zonename      || '',
            suspendedAt:   new Date().toISOString(),
          });
        }
        const beforeLen2 = ZONE_DRIVERS.length;
        for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
          const d = ZONE_DRIVERS[i];
          if (String(d.driverid) === driverId || String(d.VehicleId) === vehicleId ||
              (vehicleIdNum > 0 && (d.driverid === vehicleIdNum || d.VehicleId === vehicleIdNum))) {
            ZONE_DRIVERS.splice(i, 1);
          }
        }
        console.log(`200: POST ${urlPath} [action=[DispatcherKickUsers]] -> driver ${driverId}/${vehicleId} suspended (removed ${beforeLen2 - ZONE_DRIVERS.length} entries, suspended list: ${SUSPENDED_DRIVERS.length})`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[GetSuspendedDrivers]') {
        console.log(`200: POST ${urlPath} [action=[GetSuspendedDrivers]] -> ${SUSPENDED_DRIVERS.length} suspended driver(s)`);
        objectD(res, { dt1: SUSPENDED_DRIVERS, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[UnsuspendDriver]') {
        const _unsDrvId  = (param('DriverId')  || '').toString().trim();
        const _unsVehId  = (param('VehicleId') || '').toString().trim();
        const _unsIdx = SUSPENDED_DRIVERS.findIndex(s => String(s.driverId) === _unsDrvId || String(s.vehicleId) === _unsVehId);
        let restored = null;
        if (_unsIdx !== -1) {
          restored = SUSPENDED_DRIVERS[_unsIdx];
          SUSPENDED_DRIVERS.splice(_unsIdx, 1);
          // Re-add to ZONE_DRIVERS as Available at end of queue
          const maxQ = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
          ZONE_DRIVERS.push({
            driverid:      restored.driverId,
            VehicleId:     restored.vehicleId,
            drivername:    restored.drivername,
            vehiclenumber: restored.vehiclenumber,
            vehicletype:   restored.vehicletype,
            zonename:      restored.zonename,
            vehiclestatus: 'Away',
            zonequeue:     maxQ + 1,
            queueWaitSince: Date.now(),
          });
        }
        console.log(`200: POST ${urlPath} [action=[UnsuspendDriver]] -> ${restored ? 'restored ' + _unsDrvId : 'not found ' + _unsDrvId}`);
        objectD(res, { dt1: restored ? [restored] : [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[UpdateQueueNo]') {
        const vehicleId = param('VehicleId') || '';
        const queueNo   = parseInt(param('QueueNo') || '1') || 1;
        const driver = ZONE_DRIVERS.find(d => String(d.VehicleId) === vehicleId);
        if (driver) {
          driver.zonequeue = queueNo; // fix: was driver.QueueNo (wrong field)
          console.log(`200: POST ${urlPath} [action=[UpdateQueueNo]] -> vehicle ${vehicleId} queue → ${queueNo}`);
        } else {
          console.log(`200: POST ${urlPath} [action=[UpdateQueueNo]] -> vehicle ${vehicleId} not found (no-op)`);
        }
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[changeriddestatusforoffer]') {
        // Called via Action() → DataProcessor URL. Update a job's booking status.
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const newStatus = param('ridestatus') || '';
        const returnReason = (param('returnreason') || '').toString().trim();
        const job = jobStore.find(j => j.Id === bookingId);
        let _newQueueNo = null; // hoisted — available even when (job && newStatus) is falsy
        if (job && newStatus) {
          // Safety guard: never let a fallback/timeout downgrade an already-accepted job.
          // Assigned = driver accepted. Active = trip in progress.
          // Only allow Assigned→Pending if the driver explicitly rejected (returnReason says so).
          const currentStatus = job.BookingStatus || '';
          // Atomic double-offer guard: if two dispatch sessions race, the first one to arrive
          // sets status=Offered. The second must be blocked — job already belongs to another driver.
          const incomingDriverId = parseInt(param('driverid') || '0') || 0;
          if (newStatus === 'Offered' && currentStatus === 'Offered' && job.DriverId && job.DriverId !== incomingDriverId) {
            console.log(`  [changeriddestatusforoffer/DP] BLOCKED duplicate offer: job #${bookingId} already Offered to driver ${job.DriverId}, ignoring request for driver ${incomingDriverId}`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
            return;
          }
          const isAccepted = currentStatus === 'Assigned' || currentStatus === 'Active' || currentStatus === 'Picking';
          const isDowngrade = newStatus === 'Unreached' || newStatus === 'Pending' || newStatus === 'Cancelled' || newStatus === 'Unassigned';
          const rr = returnReason.toLowerCase();
          // Timeout reasons (dispatch window expired, no-response) must NEVER cancel an already-accepted job.
          // Only a genuine driver reject or dispatcher manual-unassign can downgrade Assigned/Active/Picking.
          const isTimeoutReason = rr.includes('no response') || rr.includes('not accepted');
          const isExplicitReject = (rr.includes('reject') && !isTimeoutReason) || rr.includes('manually unassigned');
          const hasNoDriver = !job.DriverId || job.DriverId === 0;
          if (isAccepted && isDowngrade && (!isExplicitReject || isTimeoutReason) && !hasNoDriver) {
            console.log(`  [changeriddestatusforoffer/DP] BLOCKED downgrade: job #${bookingId} is ${currentStatus}, refusing to set ${newStatus} (reason: "${returnReason}")`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
            return;
          }
          // Special case: driver explicitly rejected/cancelled an ACCEPTED (Assigned/Picking) job.
          // This is a driver-initiated cancel, not a pre-acceptance rejection and not a timeout.
          // Move to closed jobs as Cancelled and notify dispatcher.
          const isDriverPostAcceptCancel = isExplicitReject && !isTimeoutReason && !hasNoDriver &&
            !rr.includes('manually unassigned') &&
            (currentStatus === 'Assigned' || currentStatus === 'Picking') &&
            (newStatus === 'Pending' || newStatus === 'Cancelled' || newStatus === 'Unreached');
          if (isDriverPostAcceptCancel) {
            const _dcDriverId = job.DriverId;
            job.BookingStatus = 'Cancelled';
            job.CancelledBy   = 'Driver';
            job.returnReason  = 'Driver cancelled after accepting';
            job.JobCompleteTime = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
            const _dcIdx = jobStore.indexOf(job);
            if (_dcIdx !== -1) jobStore.splice(_dcIdx, 1);
            closedJobStore.push(job);
            // Driver cancelled (e.g. no-show / not at address) — return to Available immediately
            const _dcZd = ZONE_DRIVERS.find(d => d.driverid === _dcDriverId || d.VehicleId === _dcDriverId);
            let _dcQueueNo = null;
            if (_dcZd) {
              _dcQueueNo = calcRestoredQueue(_dcDriverId, _dcZd.zonename || '');
              _dcZd.vehiclestatus = 'Available';
              _dcZd.zonequeue     = _dcQueueNo;
              _dcZd.queueWaitSince = Date.now();
            }
            clearAwayLock(_dcDriverId);
            clearDriverHomeState(_dcDriverId);
            saveJobStore();
            console.log(`  [changeriddestatusforoffer/DP] Job #${bookingId} -> Cancelled (driver ${_dcDriverId} cancelled after accepting → Available q=${_dcQueueNo})`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverCancelled: { jobId: bookingId, driverId: _dcDriverId }, newQueueNo: _dcQueueNo });
            return;
          }
          // If the dispatcher manually unassigned this job, flag it so [DriverStatusChanged]
          // won't misread the driver's resulting Available heartbeat as a driver-initiated cancel.
          if (rr.includes('manually unassigned') && bookingId > 0) markDispatcherRecalled(bookingId);
          // Unreached (no response timeout) → skip the holding state, land straight on Pending
          // so the job is immediately re-dispatchable. returnReason badge still shows "No Response".
          const effectiveStatus = newStatus === 'Unreached' ? 'Pending' : newStatus;
          job.BookingStatus = effectiveStatus;
          if (returnReason) job.returnReason = returnReason;
          // Track which driver has the current offer so the double-offer guard can compare.
          // Also set DriverId when driver accepts so the job appears correctly in Assigned tab.
          if (effectiveStatus === 'Offered' && incomingDriverId > 0) {
            job.DriverId = incomingDriverId; job.VehicleId = incomingDriverId;
            job.offeredAt = Date.now(); // stale-offer watchdog uses this
            // Save home zone & queue before the driver is dispatched
            const zdOffer = ZONE_DRIVERS.find(d => d.driverid === incomingDriverId || d.VehicleId === incomingDriverId);
            if (zdOffer) saveDriverHomeState(incomingDriverId, zdOffer);
          }
          if (effectiveStatus === 'Assigned') {
            const acceptDriverId = parseInt(param('driverid') || '0') || 0;
            if (acceptDriverId > 0) { job.DriverId = acceptDriverId; job.VehicleId = acceptDriverId; }
          }
          const releaseStatuses = new Set(['Unreached', 'Pending', 'Cancelled', 'Unassigned', 'NoShow', 'No Show']);
          if (releaseStatuses.has(newStatus)) {
            const _releaseDriverId = job.DriverId;
            const zd = ZONE_DRIVERS.find(d => d.driverid === _releaseDriverId || d.VehicleId === _releaseDriverId);
            // Away if: driver didn't respond (Unreached), OR driver explicitly rejected/not accepted.
            // Available only if: job was manually cancelled/unassigned by dispatcher (no driver fault).
            const _driverFault = newStatus === 'Unreached' || isExplicitReject;
            const _cancelByDispatcher = (newStatus === 'Cancelled' || newStatus === 'Unassigned') && !isExplicitReject;
            const newDriverStatus = (_driverFault && !_cancelByDispatcher) ? 'Away' : 'Available';
            if (zd) {
              // For Available returns: calculate smart queue position based on zone rules
              if (newDriverStatus === 'Available') {
                _newQueueNo = calcRestoredQueue(_releaseDriverId, zd.zonename);
                zd.zonequeue = _newQueueNo;
                zd.queueWaitSince = Date.now();
              }
              zd.vehiclestatus = newDriverStatus;
              zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0;
            }
            if (newDriverStatus === 'Away') setAwayLock(_releaseDriverId);
            else {
              clearAwayLock(_releaseDriverId);
              clearDriverHomeState(_releaseDriverId); // home state consumed
            }
            console.log(`  [changeriddestatusforoffer/DP] driver ${_releaseDriverId} → ${newDriverStatus} q=${_newQueueNo || '-'} zone="${zd && zd.zonename}" (newStatus=${newStatus} driverFault=${_driverFault})`);
            // Clear job's DriverId when:
            //   (a) client explicitly sends driverid=0 (manual unassign / timeout), OR
            //   (b) newStatus is Unreached (auto-dispatch timeout — job must be re-offerable)
            const _rawDrv = param('driverid');
            const _clearDrv = (newStatus === 'Unreached') ||
                              (_rawDrv !== undefined && _rawDrv !== null && parseInt(_rawDrv) === 0);
            if (_clearDrv) { job.DriverId = 0; job.VehicleId = 0; }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} status=${newStatus || 'unchanged'} reason=${returnReason || '-'}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _newQueueNo });

      } else if (action === '[DriverStatusChanged]') {
        // Called via Action() → DataProcessor URL when Firebase vehiclestatus changes.
        // Busy: any non-terminal job → Active. Picking: Offered/Pending → Assigned. Available: Active → Completed.
        // Hail: if driver goes Busy with NO live job, auto-create a street-pickup hail entry.
        const driverId      = (param('driverid') || param('DriverId') || '').toString().trim();
        const newStatus     = (param('newstatus') || param('NewStatus') || '').toString().trim();
        const vehiclenumber = (param('vehiclenumber') || '').toString().trim();
        const drivername    = (param('drivername') || '').toString().trim();
        const lat           = (param('lat') || '').toString().trim();
        const lng           = (param('lng') || '').toString().trim();
        const zonename      = (param('zonename') || '').toString().trim();
        const zonequeue     = parseInt(param('zonequeue') || '0') || 0;
        const TERM = new Set(['Dispatched','Done','Cancel','Cancelled','Closed','Completed','No Show','NoShow','Reject']);
        // Match jobs by DriverId, VehicleId, OR VehicleNo so numeric/string IDs and
        // vehicle numbers (e.g. "1212" vs "T201") all resolve correctly.
        function matchesDriver(j) {
          const vid = vehiclenumber;
          return String(j.DriverId) === driverId || String(j.VehicleId) === driverId ||
                 (vid && (String(j.VehicleNo) === vid || String(j.VehicleId) === vid || String(j.DriverId) === vid));
        }
        let _dscQueueNo = null;      // new queue number to return to client for Firebase write
        let _dscDriverCancelled = null; // set when driver cancels an accepted/assigned job
        if (driverId && newStatus) {
          // Sync zone data into ZONE_DRIVERS if provided by client
          const zdSync = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
          if (zdSync && zonename) zdSync.zonename = zonename;
          if (zdSync && zonequeue) zdSync.zonequeue = zonequeue;

          // ── Away-lock logic ──────────────────────────────────────────────────
          // Guard: if an Away signal arrives for a driver who already has an
          // Assigned/Picking/Active job, it is a stale Fix-#106 acknowledge that
          // lost the race against the driver's own Accept signal.  Ignore it
          // entirely so we don't overwrite a genuine acceptance.
          if (newStatus === 'Away') {
            const _staleAwayCheck = jobStore.some(j =>
              matchesDriver(j) && (j.BookingStatus === 'Assigned' || j.BookingStatus === 'Picking' || j.BookingStatus === 'Active')
            );
            if (_staleAwayCheck) {
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} Away IGNORED — driver has an active/assigned job (stale Fix-#106 ack)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], staleAway: true });
              return;
            }
          }
          // Step 1: If locked driver sends Away heartbeat, record acknowledgement.
          //         This proves the driver's phone switched to Away mode.
          if (newStatus === 'Away' && isAwayLocked(driverId)) {
            acknowledgeAway(driverId);
          }
          // Step 2: If locked driver sends Available, only clear if their phone
          //         previously confirmed Away (ackAway=true). Otherwise it's just
          //         a stale heartbeat from before the phone received our Away write.
          if (newStatus === 'Available' && isAwayLocked(driverId)) {
            if (canUnlockWithAvailable(driverId)) {
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} genuine Available after Away ack — lock cleared`);
              clearAwayLock(driverId);
              // fall through and process Available normally
            } else {
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} Available BLOCKED (no Away ack yet — stale heartbeat)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], awayLocked: true });
              return;
            }
          }
          // Step 3: New job received — clear lock regardless.
          if (newStatus === 'Busy' || newStatus === 'Assigned' || newStatus === 'Picking') {
            clearAwayLock(driverId);
            // Save home zone/queue before driver heads off to a job
            if (zdSync) saveDriverHomeState(driverId, zdSync);
          }
          const driverJobs = jobStore.filter(matchesDriver);
          // Hail / street pickup: driver went Busy with no pre-booked live job
          if (newStatus === 'Busy') {
            const hasLive = driverJobs.some(j =>
              ['Offered','Pending','Assigned','Picking','Active'].includes(j.BookingStatus)
            );
            if (!hasLive) {
              const hailId = newJobId();
              const now = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
              const pickAddr = (lat && lng) ? `Hail - ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : 'Hail / Street Pickup';
              jobStore.push({
                Id: hailId, BookingStatus: 'Active',
                DriverId: driverId,
                VehicleId: vehiclenumber || driverId,
                VehicleNo: vehiclenumber || driverId,
                Name: 'Street Pickup', PhoneNo: '',
                PickAddress: pickAddr, DropAddress: '',
                PickLatLng: (lat && lng) ? `${lat},${lng}` : '',
                DropLatLng: '',
                BookingDateTime: now, JobCompleteTime: '',
                BookingSource: 'Hail', booking_type: 'Hail',
                JobMins: 0, UserFName: drivername, UserLName: '',
                Route: '', bookingidx: hailId,
              });
              saveJobStore();
              console.log(`  [DriverStatusChanged] Hail job #${hailId} created for driver ${driverId} (${vehiclenumber}) at ${pickAddr}`);
            }
          }
          // Re-query after potential hail insertion so Available can complete a just-created job
          const allDriverJobs = jobStore.filter(matchesDriver);
          // Only activate ONE job when driver goes Busy (the highest-priority live one).
          // Activating all non-terminal jobs at once causes mass-completion when the
          // driver later goes Available, which is the "accidental cancel" bug.
          let activatedOne = false;
          allDriverJobs.forEach(function(job) {
            const prev = job.BookingStatus;
            // Guard: if job has no driver (orphaned) skip the Assigned transition so
            // we don't re-lock an already-released job into Assigned again.
            const orphaned = !job.DriverId || String(job.DriverId) === '0';
            if (newStatus === 'Assigned' && !TERM.has(job.BookingStatus) && !orphaned) {
              job.BookingStatus = 'Assigned';
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned`);
            } else if (newStatus === 'Busy' && !activatedOne &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphaned))) {
              // Pending + Busy: driver skipped the Accept step (e.g. Away→Busy after dispatch timeout)
              // but the job's DriverId still matches — activate it so dispatch shows Active.
              job.BookingStatus = 'Active';
              activatedOne = true;
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Assigned';
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned (Picking)`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Trip genuinely finished — mark Completed
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
                console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Completed`);
              } else if (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking') {
                if (isDispatcherRecalled(job.Id)) {
                  // Dispatcher-initiated recall: driver's Available is a side-effect of FnCancelRide.
                  // [changeriddestatusforoffer] will set job to Pending; just leave it or set Pending here.
                  job.BookingStatus = 'Pending';
                  job.DriverId = 0; job.VehicleId = 0;
                  job.returnReason = 'Manually unassigned';
                  clearDispatcherRecalled(job.Id);
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (was ${prev}) -> Pending (dispatcher recall — not a driver cancel)`);
                } else {
                  // Driver went Available while still Assigned — driver cancelled after accepting.
                  job.BookingStatus = 'Cancelled';
                  job.CancelledBy   = 'Driver';
                  job.returnReason  = 'Driver cancelled after accepting';
                  job.JobCompleteTime = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
                  const idx = jobStore.indexOf(job);
                  if (idx !== -1) jobStore.splice(idx, 1);
                  closedJobStore.push(job);
                  _dscDriverCancelled = { jobId: job.Id, driverId, drivername, vehiclenumber };
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (was ${prev}) -> Cancelled (driver cancelled after accepting)`);
                }
              }
              // Offered/Unreached/Pending: driver going Available — leave as-is
            }
          });
          // When driver goes Available: calculate their new queue position and update ZONE_DRIVERS
          if (newStatus === 'Available') {
            const zdAvail = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
            if (zdAvail) {
              const currentZone = zdAvail.zonename || zonename || '';
              _dscQueueNo = calcRestoredQueue(driverId, currentZone);
              zdAvail.zonequeue = _dscQueueNo;
              zdAvail.vehiclestatus = 'Available';
              zdAvail.queueWaitSince = Date.now();
              clearDriverHomeState(driverId); // home state consumed
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} Available → zone="${currentZone}" newQueue=${_dscQueueNo}`);
            }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus} (${jobStore.filter(j=>j.BookingStatus==='Active').length} active now)`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dscQueueNo, queueWaitSince: _dscQueueNo ? Date.now() : null, driverCancelled: _dscDriverCancelled || null });

      } else {
        console.log(`200: POST ${urlPath} [action=${action}] -> "Operation Successfully Performed"`);
        successD(res, 'Operation Successfully Performed');
      }
      return;
    }

    // ── /DataSelectorLess — read operations ───────────────────────────────
    if (urlPath.includes('/DataSelectorLess')) {
      if (action === 'RetrieveAlarms' || action === 'AllAlarms' || action === 'RetrieveAlarts' || action === 'RetrieveAlerts' || action === 'GetAlarms' || action === 'GetAlerts') {
        console.log(`200: POST ${urlPath} [action=${action}] -> []`);
        jsonReply(res, { d: '[]' });
      } else if (action === '[ZonesListUpdate]') {
        // Real driver zone data comes from Firebase (driverdatarealx).
        // This fallback is only hit when Firebase has no live drivers,
        // so return empty — no cars online means no zone queue entries.
        console.log(`200: POST ${urlPath} [action=${action}] -> 0 drivers (Firebase is source of truth)`);
        arrayD(res, []);

      } else if (action === '[payment_percentage]') {
        // Payment percentage and per-transaction charge — return zeros (no surcharges)
        console.log(`200: POST ${urlPath} [action=${action}] -> 0%`);
        arrayD(res, [{ paymentpercent: 0, chargepertra: 0 }]);

      } else if (action === 'DispatchEstimation') {
        // Return tariff pricing so trip cost can be calculated in the booking form.
        const TARIFFS = {
          1:  { StartPrice: 3.50, DistanceRate: 2.20, CurrencyName: 'NZD' },
          2:  { StartPrice: 5.00, DistanceRate: 2.50, CurrencyName: 'NZD' },
          3:  { StartPrice: 4.50, DistanceRate: 2.40, CurrencyName: 'NZD' },
          '-1': { StartPrice: 0,  DistanceRate: 0,    CurrencyName: 'NZD' },
        };
        const tid = String(param('TariffId') || '1');
        const tariff = TARIFFS[tid] || TARIFFS['1'];
        console.log(`200: POST ${urlPath} [action=${action}] -> tariff id ${tid}`);
        arrayD(res, [tariff]);

      } else if (action === '[ActiveJobsv3]') {
        const active = jobStore.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking');
        const activeWithId = active.map(j => ({ ...j, BookingId: j.Id }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${active.length} active`);
        arrayD(res, activeWithId);

      // ── Search actions ───────────────────────────────────────────────────────
      // Helper: add UI-friendly aliases so Angular ng-repeat bindings work
      } else if (action === '[SearchById]') {
        const searchId = parseInt(param('Id') || param('id') || '0') || 0;
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchId > 0 ? allJobs.filter(j => j.Id === searchId) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchJobByName]') {
        const searchName = (param('Id') || '').toLowerCase();
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchName ? allJobs.filter(j => (j.Name || '').toLowerCase().includes(searchName)) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByPhoneNo]') {
        const searchPhone = (param('Id') || '').replace(/\s/g, '');
        const allJobs = [...jobStore, ...closedJobStore];
        let results = searchPhone ? allJobs.filter(j => (j.PhoneNo || '').replace(/\s/g, '').includes(searchPhone)) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByAfterDate]') {
        const dateStr = param('Id') || '';
        const allJobs = [...jobStore, ...closedJobStore];
        let results = dateStr ? allJobs.filter(j => (j.BookingDateTime || '').substring(0, 10) >= dateStr) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByBeforeDate]') {
        const dateStr = param('Id') || '';
        const allJobs = [...jobStore, ...closedJobStore];
        let results = dateStr ? allJobs.filter(j => (j.BookingDateTime || '').substring(0, 10) <= dateStr) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === 'SearchJobDateBetween') {
        const fromStr = param('From') || '';
        const toStr   = param('To') || '';
        const allJobs = [...jobStore, ...closedJobStore];
        let results = allJobs.filter(j => {
          const jDate = (j.BookingDateTime || '').substring(0, 10);
          return (!fromStr || jDate >= fromStr) && (!toStr || jDate <= toStr);
        });
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === 'JobDetails') {
        const jobId = parseInt(param('Id') || '0') || 0;
        const allJobs = [...jobStore, ...closedJobStore];
        const job = allJobs.find(j => j.Id === jobId);
        const result = job ? [{ ...job, bookingidx: job.Id, Route: '', JobMins: calcJobMins(job.BookingDateTime) }] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${jobId}`);
        arrayD(res, result);

      // ── Messaging read actions ───────────────────────────────────────────────
      } else if (action === '[RetrieveMessages]') {
        const chatList = buildDriverChatList();
        console.log(`200: POST ${urlPath} [action=${action}] -> ${chatList.length} drivers`);
        arrayD(res, chatList);

      } else if (action === '[DispatcherUnReadMessages]') {
        const driverId = (param('Id') || '').toString().trim();
        const unread = messageStore.filter(m => String(m.SenderId) === driverId && !m.IsRead);
        unread.forEach(m => { m.IsRead = true; });
        const mapped = unread.map(m => ({
          Id: m.Id, SenderID: m.SenderId, User: m.SenderName,
          Message: m.Message, Date: m.Date, Time: m.Time,
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${mapped.length} unread from driver #${driverId}`);
        arrayD(res, mapped);

      // ── ACC / Accident Claim handlers ──────────────────────────────────────
      } else if (action === 'Manager_ACC_GET') {
        const demoManagers = [
          { id: 1, manager_name: 'ACC Head Office', manager_branch_code: 'ACC001', manager_email: 'head@acc.co.nz' },
          { id: 2, manager_name: 'Southland Branch', manager_branch_code: 'ACC002', manager_email: 'south@acc.co.nz' },
          { id: 3, manager_name: 'Otago Branch',    manager_branch_code: 'ACC003', manager_email: 'otago@acc.co.nz' },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${demoManagers.length} ACC managers`);
        arrayD(res, demoManagers);

      } else if (action === 'Client_ACC_GET') {
        const managerId = parseInt(param('manager_id') || '0') || 0;
        const demoClients = [
          { id: 1, client_name: 'John Smith',   manager_id: 1, phone: '021 111 0001', address: '12 Main St, Invercargill' },
          { id: 2, client_name: 'Mary Johnson', manager_id: 1, phone: '021 111 0002', address: '45 Tay St, Invercargill'  },
          { id: 3, client_name: 'Paul Davis',   manager_id: 2, phone: '021 111 0003', address: '78 Dee St, Invercargill'  },
        ];
        const filtered = managerId ? demoClients.filter(c => c.manager_id === managerId) : demoClients;
        console.log(`200: POST ${urlPath} [action=${action}] -> ${filtered.length} ACC clients`);
        arrayD(res, filtered);

      } else if (action === 'Client_ACC_ALL') {
        const demoClients = [
          { id: 1, client_name: 'John Smith',   manager_id: 1, manager_name: 'ACC Head Office', phone: '021 111 0001', address: '12 Main St, Invercargill' },
          { id: 2, client_name: 'Mary Johnson', manager_id: 1, manager_name: 'ACC Head Office', phone: '021 111 0002', address: '45 Tay St, Invercargill'  },
          { id: 3, client_name: 'Paul Davis',   manager_id: 2, manager_name: 'Southland Branch', phone: '021 111 0003', address: '78 Dee St, Invercargill'  },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${demoClients.length} all ACC clients`);
        arrayD(res, demoClients);

      } else if (action === 'Approve_ACC_GET') {
        const clientId = parseInt(param('client_id') || param('id') || '0') || 0;
        const demoApprovals = [
          { id: 1, acc_id: 'ACC-2026-001', client_id: 1, client_name: 'John Smith',  manager_name: 'ACC Head Office', manager_email: 'head@acc.co.nz', manager_phone: '03 214 0001', client_phone: '021 111 0001', registration_date: '2025-01-15', claim_number: 'CLM001', purchase_order_number: 'PO-001', client_services_code: 'SVC-01', trip_from_date: '2026-04-01', trip_to_date: '2026-06-30', trip_status: 'Round Trip', trip_days_approved: 30, trip_days_left: 22, trip_description: 'Post-surgery transport to physiotherapy' },
          { id: 2, acc_id: 'ACC-2026-002', client_id: 2, client_name: 'Mary Johnson', manager_name: 'ACC Head Office', manager_email: 'head@acc.co.nz', manager_phone: '03 214 0001', client_phone: '021 111 0002', registration_date: '2025-02-20', claim_number: 'CLM002', purchase_order_number: 'PO-002', client_services_code: 'SVC-02', trip_from_date: '2026-03-15', trip_to_date: '2026-05-15', trip_status: 'One Way', trip_days_approved: 20, trip_days_left: 5,  trip_description: 'Transport to outpatient appointments' },
        ];
        const filtered = (clientId && clientId > 0) ? demoApprovals.filter(a => a.id === clientId || a.client_id === clientId) : demoApprovals;
        console.log(`200: POST ${urlPath} [action=${action}] -> ${filtered.length} approvals`);
        arrayD(res, filtered);

      } else if (action === 'ACC_All_approval') {
        const demoApprovals = [
          { id: 1, acc_id: 'ACC-2026-001', client_name: 'John Smith',  manager_name: 'ACC Head Office', claim_number: 'CLM001', trip_from_date: '2026-04-01', trip_to_date: '2026-06-30', trip_days_approved: 30, trip_days_left: 22, trip_description: 'Post-surgery transport to physiotherapy' },
          { id: 2, acc_id: 'ACC-2026-002', client_name: 'Mary Johnson', manager_name: 'ACC Head Office', claim_number: 'CLM002', trip_from_date: '2026-03-15', trip_to_date: '2026-05-15', trip_days_approved: 20, trip_days_left: 5,  trip_description: 'Transport to outpatient appointments' },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${demoApprovals.length} all approvals`);
        arrayD(res, demoApprovals);

      } else if (action === '[QuickSetNoOne]') {
        // Quick dispatcher action: mark job as "No One" from card dropdown.
        // Works regardless of current status (Pending/Offered/Assigned/Unreached/No One).
        // Releases any currently-assigned driver back to Available.
        const bookingId = parseInt(param('BookingId')) || 0;
        const job = jobStore.find(j => j.Id === bookingId);
        if (job) {
          const preActiveSt = new Set(['Pending','Offered','Assigned','Unreached','No One','Reject','']);
          if (preActiveSt.has(job.BookingStatus || '')) {
            const prevDriverId = job.DriverId || 0;
            job.BookingStatus = 'No One';
            job.DriverId  = 0;
            job.VehicleId = 0;
            if (prevDriverId > 0) {
              const zd = ZONE_DRIVERS.find(d => d.driverid === prevDriverId || d.VehicleId === prevDriverId);
              if (zd) {
                zd.vehiclestatus = 'Available';
                zd.JobphoneNo = '';
                zd.jobpickup  = '';
                zd.jobdropoff = '';
                zd.jobCount   = 0;
              }
            }
            saveJobStore();
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} set to No One`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[CancelJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const idx = jobStore.findIndex(j => j.Id === bookingId);
        let driverId = '0';
        if (idx !== -1) {
          const job = jobStore[idx];
          driverId = String(job.DriverId || '0');
          if (job.DriverId && job.DriverId > 0) {
            const zd = ZONE_DRIVERS.find(d => d.driverid === job.DriverId || d.VehicleId === job.DriverId);
            if (zd) {
              zd.vehiclestatus = 'Available';
              zd.JobphoneNo = '';
              zd.jobpickup  = '';
              zd.jobdropoff = '';
              zd.jobCount   = 0;
            }
          }
          job.BookingStatus = 'Cancel';
          job.CancelledBy   = 'Dispatcher';
          job.JobCompleteTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
          closedJobStore.push(job);
          jobStore.splice(idx, 1);
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> cancelled job #${bookingId}, driver ${driverId} -> moved to closedJobStore`);
        arrayD(res, [{ Result: 'Job Cancelled Successfully', DriverId: driverId }]);

      } else {
        const filePath = resolveFilePath(urlPath);
        if (filePath) {
          console.log(`200: POST ${urlPath} -> ${filePath.replace(ROOT, '')}`);
          res.writeHead(200, JSON_HEADERS);
          fs.createReadStream(filePath).pipe(res);
        } else {
          console.log(`200: POST ${urlPath} [action=${action}] -> []`);
          jsonReply(res, { d: '[]' });
        }
      }
      return;
    }

    // ── /DataSelector — read operations with action routing ───────────────
    if (urlPath.includes('/DataSelector') && !urlPath.includes('/DataSelectorLess') && !urlPath.includes('/DataSelectorRide')) {
      if (action === 'RetrieveAlarms' || action === 'AllAlarms' || action === 'RetrieveAlarts' || action === 'RetrieveAlerts' || action === 'GetAlarms' || action === 'GetAlerts') {
        console.log(`200: POST ${urlPath} [action=${action}] -> []`);
        jsonReply(res, { d: '[]' });

      } else if (action === '[Editjobv4]') {
        const idParam = param('Id');
        const jobId = idParam !== undefined ? parseInt(idParam) : 0;
        let job = jobStore.find(j => j.Id === jobId);
        if (!job) job = jobStore[0];
        const jobWithMins = job ? { ...job, JobMins: calcJobMins(job.BookingDateTime) } : null;
        const resp = {
          dt1: jobWithMins ? [jobWithMins] : [],
          dt2: [{ AssignedCount: 0 }],
          dt3: [{ ActiveCount: 0 }],
          dt4: [{ UnAssignedCount: jobStore.length }],
          dt5: [{ PublicKey: '' }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${jobId}`);
        objectD(res, resp);

      } else if (action === '[checkjobstatusv2]') {
        // Return empty dt1 so dispatch goes straight through without "taking job from driver" error
        console.log(`200: POST ${urlPath} [action=${action}] -> empty dt1`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[AssignedJobsv2]') {
        console.log(`200: POST ${urlPath} [action=${action}] -> assigned jobs`);
        objectD(res, buildAssignedResponse(jobStore));

      } else if (action === 'AutoDispatchVehiclesallride') {
        // Stale-offer watchdog: if a job has been stuck in "Offered" for more than 2 minutes,
        // the browser that was tracking it must have closed/refreshed without resolving it.
        // Reset it to Pending so auto-dispatch can re-offer it to the next available driver.
        const STALE_OFFER_MS = 2 * 60 * 1000; // 2 minutes
        const now = Date.now();
        jobStore.forEach(j => {
          if (j.BookingStatus === 'Offered') {
            // If no offeredAt recorded (pre-watchdog jobs), treat as stale immediately.
            const age = j.offeredAt ? (now - j.offeredAt) : STALE_OFFER_MS + 1;
            if (age > STALE_OFFER_MS) {
              console.log(`  [AutoDispatch] stale-offer watchdog: resetting job #${j.Id} (offered to driver ${j.DriverId}, age ${Math.round(age/1000)}s) → Pending`);
              j.BookingStatus = 'Pending';
              j.offeredAt = null;
              j.DriverId = null;
              j.VehicleId = null;
            }
          }
        });
        // Return jobs that need auto-dispatch: Pending only.
        // "No One" jobs are explicitly excluded — dispatcher flagged them as manual-only.
        const autoJobs = jobStore.filter(j => j.BookingStatus === 'Pending');
        const dt1 = autoJobs.map(j => ({
          Id: j.Id,
          ZoneId: j.ZoneId || 1,
          VehicleType: j.VehicleType || 'Not Specified',
          Passengers: j.PassengersNo || 1,
          PickLatLng: j.PickLatLng || '0,0',
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${dt1.length} pending job(s) for auto-dispatch`);
        objectD(res, { dt1, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === 'ZoneCoordinates') {
        // Return an NZ-wide bounding polygon so any NZ address passes zone validation.
        // The front-end checks if the pickup lat/lng is inside at least one zone polygon.
        const zoneData = {
          dt1: [{ ZoneId: 1, ZoneName: 'New Zealand', No: 4 }],
          dt2: [
            { Lat: -34.0, Lng: 166.3 },
            { Lat: -47.4, Lng: 166.3 },
            { Lat: -47.4, Lng: 178.6 },
            { Lat: -34.0, Lng: 178.6 },
          ],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> NZ zone polygon`);
        objectD(res, zoneData);

      } else if (action === '[DispatcherSettings]') {
        // Return company settings, vehicle types (dt3), tariff list (dt4).
        const settings = {
          dt1: [{
            CompanyName: 'Taxi Time',
            DirectBookingIsAllowed: '1',
            JobAllowedToAssignToaDriver: '1',
            AutoDispatch: '0',
            EditZoneQueue: '1',
            DispatcherKickUsers: '1',
            DispatchShows: '1',
            ColorJobs: '1',
            DispatchAlerts: '0',
            DispatchSounds: '1',
            RespectShiftEnd: '0',
            Radius: '50',
          }],
          dt2: [],
          dt3: [
            { Id: 1, VehicleName: 'Sedan' },
            { Id: 2, VehicleName: 'SUV' },
            { Id: 3, VehicleName: 'Van' },
            { Id: 4, VehicleName: 'Wheelchair' },
          ],
          dt4: [
            { Id: 1, TariffName: 'Standard',  StartPrice: 3.50, DistanceRate: 2.20, CurrencyName: 'NZD' },
            { Id: 2, TariffName: 'Airport',   StartPrice: 5.00, DistanceRate: 2.50, CurrencyName: 'NZD' },
            { Id: 3, TariffName: 'Evening',   StartPrice: 4.50, DistanceRate: 2.40, CurrencyName: 'NZD' },
            { Id: -1, TariffName: 'Custom',   StartPrice: 0,    DistanceRate: 0,    CurrencyName: 'NZD' },
          ],
          dt5: [{ PublicKey: '' }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> dispatcher settings`);
        objectD(res, settings);

      } else if (action === 'VehiclesStatus') {
        const busyCount  = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Busy').length;
        const freeCount  = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Available').length;
        const awayCount  = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Away').length;
        const vehicleStatus = {
          dt1: [{ All: ZONE_DRIVERS.length }],
          dt2: [{ Busy: busyCount }],
          dt3: [{ Free: freeCount }],
          dt4: [{ Picking: ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Picking').length }],
          dt5: [{ Away: awayCount }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> ${ZONE_DRIVERS.length} vehicles`);
        objectD(res, vehicleStatus);

      } else if (action === 'JobsCount') {
        const _TERM = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
        const closedCount  = [...jobStore, ...closedJobStore].filter(j => _TERM.has(j.BookingStatus)).length;
        const cancelCount  = [...jobStore, ...closedJobStore].filter(j => j.BookingStatus === 'Cancelled' || j.BookingStatus === 'Cancel').length;
        const noShowCount  = [...jobStore, ...closedJobStore].filter(j => j.BookingStatus === 'No Show' || j.BookingStatus === 'NoShow').length;
        const jobCounts = {
          dt1: [{ ClosedCount: closedCount }],
          dt2: [{ CancelledCount: cancelCount }],
          dt3: [{ NoShownCount: noShowCount }],
          dt4: [{ AllCount: jobStore.length }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> job counts`);
        objectD(res, jobCounts);

      } else if (action === 'ClosedJobs') {
        const statusFilter = (param('BookingStatus') || '').toLowerCase();
        const fromDate = (param('FromDate') || param('FromDate ') || '').toString().trim();
        const toDate   = (param('ToDate')   || param('ToDate ')   || '').toString().trim();
        const driverFilterRaw  = (param('DriverId')  || '').toString().trim();
        const vehicleFilterRaw = (param('VehicleId') || param('VehicleId ') || '').toString().trim();
        const driverFilter  = parseInt(driverFilterRaw)  || 0;
        const vehicleFilter = parseInt(vehicleFilterRaw) || 0;
        console.log(`  [ClosedJobs] params: status='${statusFilter}' from='${fromDate}' to='${toDate}' driver='${driverFilterRaw}' vehicle='${vehicleFilterRaw}'`);
        // Terminal statuses — include these from the live jobStore as well as the static store
        // 'Completed' is our mock convention; 'Dispatched' is the real-backend convention for done rides.
        // Treat both as closed. When status filter is 'dispatched', also include 'completed'.
        const TERMINAL = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
        const liveTerminal = jobStore.filter(j => TERMINAL.has(j.BookingStatus));
        let jobs = [...closedJobStore, ...liveTerminal];
        console.log(`  [ClosedJobs] before filters: ${jobs.length} jobs (${closedJobStore.length} static + ${liveTerminal.length} live)`);
        if (statusFilter && statusFilter !== 'all') {
          jobs = applyStatusFilter(jobs, statusFilter);
          console.log(`  [ClosedJobs] after status filter '${statusFilter}': ${jobs.length} jobs`);
        }
        if (fromDate) {
          jobs = jobs.filter(j => (j.BookingDateTime || '').substring(0, 10) >= fromDate);
          console.log(`  [ClosedJobs] after fromDate '${fromDate}': ${jobs.length} jobs`);
        }
        if (toDate) {
          jobs = jobs.filter(j => (j.BookingDateTime || '').substring(0, 10) <= toDate);
          console.log(`  [ClosedJobs] after toDate '${toDate}': ${jobs.length} jobs`);
        }
        if (driverFilter > 0) {
          jobs = jobs.filter(j => String(j.DriverId) === String(driverFilter));
          console.log(`  [ClosedJobs] after driverFilter ${driverFilter}: ${jobs.length} jobs`);
        }
        if (vehicleFilter > 0) {
          jobs = jobs.filter(j => String(j.VehicleId) === String(vehicleFilter) || String(j.VehicleNo) === String(vehicleFilter));
          console.log(`  [ClosedJobs] after vehicleFilter ${vehicleFilter}: ${jobs.length} jobs`);
        }
        // Build driver/vehicle lists from the actual job results for the filter dropdowns
        const seenDrivers = new Map(), seenVehicles = new Map();
        jobs.forEach(j => {
          if (j.DriverId && !seenDrivers.has(j.DriverId)) {
            seenDrivers.set(j.DriverId, { Id: j.DriverId, DriveName: (j.UserFName || '') + ' ' + (j.UserLName || '') });
          }
          if (j.VehicleId && !seenVehicles.has(j.VehicleId)) {
            seenVehicles.set(j.VehicleId, { Id: j.VehicleId, VehicleNo: j.VehicleNo || String(j.VehicleId) });
          }
        });
        const dt2 = [...seenDrivers.values()];
        const dt3 = [...seenVehicles.values()];
        jobs = sortByRecent(jobs);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${jobs.length} closed jobs (${liveTerminal.length} live)`);
        objectD(res, { dt1: jobs, dt2, dt3 });

      } else if (action === '[VehicleInfov2]') {
        // Vehicle IDs can be alphanumeric call signs ("T201") or numeric ("1212") — never parseInt
        const vehicleIdStr = (param('Id') || param('id') || '').toString().trim();
        const vehicleIdNum = parseInt(vehicleIdStr) || 0;
        // Look up driver in ZONE_DRIVERS (demo) or from jobStore assigned driver
        const zd = ZONE_DRIVERS.find(d =>
          String(d.VehicleId) === vehicleIdStr ||
          String(d.driverid)  === vehicleIdStr ||
          (vehicleIdNum > 0 && (d.VehicleId === vehicleIdNum || d.driverid === vehicleIdNum))
        );
        const assignedJob = jobStore.find(j =>
          String(j.VehicleId) === vehicleIdStr ||
          String(j.DriverId)  === vehicleIdStr ||
          (vehicleIdNum > 0 && (j.VehicleId === vehicleIdNum || j.DriverId === vehicleIdNum))
        );
        const dt1 = zd ? [{
          DriverId: zd.driverid,
          Lat:  '-46.4227',
          Lng:  '168.3767',
          PlayerId: '',
          VehicleName: zd.vehicletype,
          CallSign: zd.vehiclenumber,
          VehicleNo: zd.vehiclenumber,
          BookingId: assignedJob ? assignedJob.Id : '',
          UserFName: (zd.drivername || '').split(' ')[0] || '',
          UserLName: (zd.drivername || '').split(' ').slice(1).join(' ') || '',
          VehicleImage: '',
        }] : [];
        const dt2 = assignedJob ? [{
          BookingStatus:      assignedJob.BookingStatus,
          BookingDateTime:    assignedJob.BookingDateTime,
          PassengerId:        assignedJob.Name || assignedJob.passengername || '',
          PickAddress:        assignedJob.PickAddress || '',
          DropAddress:        assignedJob.DropAddress || '',
          Passengers:         assignedJob.Passengers || 1,
          Bags:               assignedJob.Bags || 0,
          WheelChairs:        assignedJob.WheelChairs || 0,
          EstimatedDistance:  assignedJob.EstimatedDistance || '0',
          EstimatedTime:      assignedJob.EstimatedTime || '0',
        }] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> vehicle #${vehicleId} (${dt1.length ? zd.drivername : 'not found'}), ${dt2.length} job(s)`);
        objectD(res, { dt1, dt2, dt3: [], dt4: [], dt5: [] });

      } else if (action === 'AutoDispatchVehiclesv2') {
        // Return available drivers in the requested zone
        const zoneId = parseInt(param('ZoneId') || '0') || 0;
        const avail = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Available' && (!zoneId || d.zoneid === zoneId));
        const dt2 = avail.map(d => ({
          VehicleId: d.VehicleId, driverid: d.driverid, drivername: d.drivername,
          vehiclenumber: d.vehiclenumber, vehicletype: d.vehicletype,
          zoneid: d.zoneid, zonename: d.zonename, zonequeue: d.zonequeue,
          PlayerId: '',
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${dt2.length} available drivers`);
        objectD(res, { dt1: [], dt2, dt3: [], dt4: [], dt5: [] });

      } else if (action === 'checkriddestatusforautodispatch' || action === 'checkriddestatusforoffer' || action === 'checkriddestatus') {
        // Return the specific job if it is still in a dispatchable / modifiable state.
        // 'checkriddestatusforoffer'       — manual dispatch / offer timeout / rejection guard
        // 'checkriddestatusforautodispatch' — auto-dispatch loop gate check
        // 'checkriddestatus'               — auto-dispatch queue eligibility check
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const allJobs   = [...jobStore, ...closedJobStore];
        const job = bookingId > 0 ? allJobs.find(j => j.Id === bookingId) : null;
        // For the offer / rejection / acceptance gate we also allow 'Assigned' so that
        // a driver who rejects after accepting can still return the job to 'Pending'.
        // Auto-dispatch checks use a tighter set (only truly unassigned jobs).
        const DISPATCHABLE = action === 'checkriddestatusforoffer'
          ? new Set(['Offered','Pending','Unreached','No One','Assigned'])
          : new Set(['Offered','Pending','Unreached','No One']);
        const eligible = job && DISPATCHABLE.has(job.BookingStatus) ? [job] : [];
        // dt2 carries the driver list for auto-dispatch (empty in mock — Firebase is source of truth)
        console.log(`200: POST ${urlPath} [action=${action}] -> ${eligible.length} eligible (status=${job ? job.BookingStatus : 'none'})`);
        objectD(res, { dt1: eligible, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[changeriddestatusforoffer]') {
        // Update a job's booking status (e.g. mark as Unreached after failed dispatch)
        const bookingId = parseInt(param('bookingid') || '0') || 0;
        const newStatus = param('ridestatus') || '';
        const returnReason = (param('returnreason') || '').toString().trim();
        const job = jobStore.find(j => j.Id === bookingId);
        let _newQueueNo2 = null; // hoisted — available even when (job && newStatus) is falsy
        if (job && newStatus) {
          // Safety guard: never let a fallback/timeout downgrade an already-accepted job.
          const currentStatus2 = job.BookingStatus || '';
          // Atomic double-offer guard: block second offer if job is already Offered to a different driver.
          const incomingDriverId2 = parseInt(param('driverid') || '0') || 0;
          if (newStatus === 'Offered' && currentStatus2 === 'Offered' && job.DriverId && job.DriverId !== incomingDriverId2) {
            console.log(`  [changeriddestatusforoffer/DS] BLOCKED duplicate offer: job #${bookingId} already Offered to driver ${job.DriverId}, ignoring request for driver ${incomingDriverId2}`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
            return;
          }
          const isAccepted2 = currentStatus2 === 'Assigned' || currentStatus2 === 'Active' || currentStatus2 === 'Picking';
          const isDowngrade2 = newStatus === 'Unreached' || newStatus === 'Pending' || newStatus === 'Cancelled' || newStatus === 'Unassigned';
          const rr2 = returnReason.toLowerCase();
          // Timeout reasons (dispatch window expired, no-response) must NEVER cancel an already-accepted job.
          // Only a genuine driver reject or dispatcher manual-unassign can downgrade Assigned/Active/Picking.
          const isTimeoutReason2 = rr2.includes('no response') || rr2.includes('not accepted');
          const isExplicitReject2 = (rr2.includes('reject') && !isTimeoutReason2) || rr2.includes('manually unassigned');
          const hasNoDriver2 = !job.DriverId || job.DriverId === 0;
          if (isAccepted2 && isDowngrade2 && (!isExplicitReject2 || isTimeoutReason2) && !hasNoDriver2) {
            console.log(`  [changeriddestatusforoffer/DS] BLOCKED downgrade: job #${bookingId} is ${currentStatus2}, refusing to set ${newStatus} (reason: "${returnReason}")`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
            return;
          }
          // Special case: driver explicitly rejected/cancelled an ACCEPTED (Assigned/Picking) job.
          // Not a timeout fire — a genuine driver-side cancel after accepting (Fix #108).
          const isDriverPostAcceptCancel2 = isExplicitReject2 && !isTimeoutReason2 && !hasNoDriver2 &&
            !rr2.includes('manually unassigned') &&
            (currentStatus2 === 'Assigned' || currentStatus2 === 'Picking') &&
            (newStatus === 'Pending' || newStatus === 'Cancelled' || newStatus === 'Unreached');
          if (isDriverPostAcceptCancel2) {
            const _dcDriverId2 = job.DriverId;
            job.BookingStatus = 'Cancelled';
            job.CancelledBy   = 'Driver';
            job.returnReason  = 'Driver cancelled after accepting';
            job.JobCompleteTime = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
            const _dcIdx2 = jobStore.indexOf(job);
            if (_dcIdx2 !== -1) jobStore.splice(_dcIdx2, 1);
            closedJobStore.push(job);
            // Driver cancelled (no-show / not at pickup) — return to Available immediately
            const _dcZd2 = ZONE_DRIVERS.find(d => d.driverid === _dcDriverId2 || d.VehicleId === _dcDriverId2);
            let _dcQueueNo2 = null;
            if (_dcZd2) {
              _dcQueueNo2 = calcRestoredQueue(_dcDriverId2, _dcZd2.zonename || '');
              _dcZd2.vehiclestatus = 'Available';
              _dcZd2.zonequeue     = _dcQueueNo2;
              _dcZd2.queueWaitSince = Date.now();
            }
            clearAwayLock(_dcDriverId2);
            clearDriverHomeState(_dcDriverId2);
            saveJobStore();
            console.log(`  [changeriddestatusforoffer/DS] Job #${bookingId} -> Cancelled (driver ${_dcDriverId2} cancelled after accepting → Available q=${_dcQueueNo2})`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverCancelled: { jobId: bookingId, driverId: _dcDriverId2 }, newQueueNo: _dcQueueNo2 });
            return;
          }
          // If the dispatcher manually unassigned this job, flag it so [DriverStatusChanged]
          // won't misread the driver's resulting Available heartbeat as a driver-initiated cancel.
          if (rr2.includes('manually unassigned') && bookingId > 0) markDispatcherRecalled(bookingId);
          // Unreached (no response timeout) → skip the holding state, land straight on Pending
          // so the job is immediately re-dispatchable. returnReason badge still shows "No Response".
          const effectiveStatus2 = newStatus === 'Unreached' ? 'Pending' : newStatus;
          job.BookingStatus = effectiveStatus2;
          if (returnReason) job.returnReason = returnReason;
          // Track which driver has the current offer so the double-offer guard can compare.
          if (effectiveStatus2 === 'Offered' && incomingDriverId2 > 0) {
            job.DriverId = incomingDriverId2; job.VehicleId = incomingDriverId2;
            job.offeredAt = Date.now(); // stale-offer watchdog uses this
            // Save home zone & queue before the driver is dispatched
            const zdOffer2 = ZONE_DRIVERS.find(d => d.driverid === incomingDriverId2 || d.VehicleId === incomingDriverId2);
            if (zdOffer2) saveDriverHomeState(incomingDriverId2, zdOffer2);
          }
          // When driver accepts, set DriverId/VehicleId so the job appears correctly in Assigned tab.
          if (effectiveStatus2 === 'Assigned') {
            const acceptDriverId2 = parseInt(param('driverid') || '0') || 0;
            if (acceptDriverId2 > 0) { job.DriverId = acceptDriverId2; job.VehicleId = acceptDriverId2; }
          }
          // Only release (reset) the driver when the job is being cancelled/unassigned.
          // 'Assigned' means the driver accepted — keep them Busy until they complete the ride.
          const releaseStatuses2 = new Set(['Unreached', 'Pending', 'Cancelled', 'Unassigned', 'NoShow', 'No Show']);
          if (releaseStatuses2.has(newStatus)) {
            const _releaseDriverId2 = job.DriverId;
            const zd = ZONE_DRIVERS.find(d => d.driverid === _releaseDriverId2 || d.VehicleId === _releaseDriverId2);
            // Away if driver didn't respond or explicitly rejected. Available only if dispatcher cancelled.
            const _driverFault2 = newStatus === 'Unreached' || isExplicitReject2;
            const _cancelByDispatcher2 = (newStatus === 'Cancelled' || newStatus === 'Unassigned') && !isExplicitReject2;
            const newDriverStatus2 = (_driverFault2 && !_cancelByDispatcher2) ? 'Away' : 'Available';
            if (zd) {
              if (newDriverStatus2 === 'Available') {
                _newQueueNo2 = calcRestoredQueue(_releaseDriverId2, zd.zonename);
                zd.zonequeue = _newQueueNo2;
                zd.queueWaitSince = Date.now();
              }
              zd.vehiclestatus = newDriverStatus2;
              zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0;
            }
            if (newDriverStatus2 === 'Away') setAwayLock(_releaseDriverId2);
            else {
              clearAwayLock(_releaseDriverId2);
              clearDriverHomeState(_releaseDriverId2);
            }
            console.log(`  [changeriddestatusforoffer/DS] driver ${_releaseDriverId2} → ${newDriverStatus2} q=${_newQueueNo2 || '-'} zone="${zd && zd.zonename}" (newStatus=${newStatus} driverFault=${_driverFault2})`);
            // Clear job's DriverId when:
            //   (a) client explicitly sends driverid=0 (manual unassign / timeout), OR
            //   (b) newStatus is Unreached (auto-dispatch timeout — job must be re-offerable)
            const _rawDrv2 = param('driverid');
            const _clearDrv2 = (newStatus === 'Unreached') ||
                               (_rawDrv2 !== undefined && _rawDrv2 !== null && parseInt(_rawDrv2) === 0);
            if (_clearDrv2) { job.DriverId = 0; job.VehicleId = 0; }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} status=${newStatus || 'unchanged'}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _newQueueNo2 });

      } else if (action === '[DriverStatusChanged]') {
        // Auto-transition job status when a driver's Firebase vehiclestatus changes.
        // Hail: if driver goes Busy with no live job, auto-create a street-pickup entry.
        const driverId      = (param('driverid') || '').toString().trim();
        const newStatus     = (param('newstatus') || '').toString().trim();
        const vehiclenumber = (param('vehiclenumber') || '').toString().trim();
        const drivername    = (param('drivername') || '').toString().trim();
        const lat           = (param('lat') || '').toString().trim();
        const lng           = (param('lng') || '').toString().trim();
        const zonenameDS    = (param('zonename') || '').toString().trim();
        const zonequeueDS   = parseInt(param('zonequeue') || '0') || 0;
        const TERMINAL = new Set(['Dispatched','Done','Cancel','Cancelled','Closed','Completed','No Show','NoShow','Reject']);
        function matchesDriverDS(j) {
          const vid = vehiclenumber;
          return String(j.DriverId) === driverId || String(j.VehicleId) === driverId ||
                 (vid && (String(j.VehicleNo) === vid || String(j.VehicleId) === vid || String(j.DriverId) === vid));
        }
        let _dssQueueNo = null;
        let _dssDriverCancelled = null;
        if (driverId && newStatus) {
          // Sync zone data from client into ZONE_DRIVERS
          const zdSyncDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
          if (zdSyncDS && zonenameDS) zdSyncDS.zonename = zonenameDS;
          if (zdSyncDS && zonequeueDS) zdSyncDS.zonequeue = zonequeueDS;

          // ── Away-lock logic ──────────────────────────────────────────────────
          // Guard: stale Fix-#106 Away acknowledge that lost the race against
          // the driver's own Accept signal — ignore it so a genuine acceptance
          // is never overwritten by a late dispatcher-side Away.
          if (newStatus === 'Away') {
            const _staleAwayCheckDS = jobStore.some(j =>
              matchesDriverDS(j) && (j.BookingStatus === 'Assigned' || j.BookingStatus === 'Picking' || j.BookingStatus === 'Active')
            );
            if (_staleAwayCheckDS) {
              console.log(`  [DriverStatusChanged/DS] driver ${driverId} Away IGNORED — driver has an active/assigned job (stale Fix-#106 ack)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], staleAway: true });
              return;
            }
          }
          // Step 1: Away heartbeat from driver app → record acknowledgement.
          if (newStatus === 'Away' && isAwayLocked(driverId)) {
            acknowledgeAway(driverId);
          }
          // Step 2: Available while locked — only let through if driver's phone
          //         already confirmed Away mode (ackAway). Otherwise it's a stale
          //         heartbeat from before the phone received our Away write.
          if (newStatus === 'Available' && isAwayLocked(driverId)) {
            if (canUnlockWithAvailable(driverId)) {
              console.log(`  [DriverStatusChanged/DS] driver ${driverId} genuine Available after Away ack — lock cleared`);
              clearAwayLock(driverId);
              // fall through and process Available normally
            } else {
              console.log(`  [DriverStatusChanged/DS] driver ${driverId} Available BLOCKED (no Away ack yet — stale heartbeat)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], awayLocked: true });
              return;
            }
          }
          // Step 3: New job received — clear lock regardless.
          if (newStatus === 'Busy' || newStatus === 'Assigned' || newStatus === 'Picking') {
            clearAwayLock(driverId);
            if (zdSyncDS) saveDriverHomeState(driverId, zdSyncDS);
          }
          const driverJobs = jobStore.filter(matchesDriverDS);
          // Hail / street pickup: driver went Busy with no pre-booked live job
          if (newStatus === 'Busy') {
            const hasLive = driverJobs.some(j =>
              ['Offered','Pending','Assigned','Picking','Active'].includes(j.BookingStatus)
            );
            if (!hasLive) {
              const hailId = newJobId();
              const now = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
              const pickAddr = (lat && lng) ? `Hail - ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : 'Hail / Street Pickup';
              jobStore.push({
                Id: hailId, BookingStatus: 'Active',
                DriverId: driverId,
                VehicleId: vehiclenumber || driverId,
                VehicleNo: vehiclenumber || driverId,
                Name: 'Street Pickup', PhoneNo: '',
                PickAddress: pickAddr, DropAddress: '',
                PickLatLng: (lat && lng) ? `${lat},${lng}` : '',
                DropLatLng: '',
                BookingDateTime: now, JobCompleteTime: '',
                BookingSource: 'Hail', booking_type: 'Hail',
                JobMins: 0, UserFName: drivername, UserLName: '',
                Route: '', bookingidx: hailId,
              });
              saveJobStore();
              console.log(`  [DriverStatusChanged/DS] Hail job #${hailId} for driver ${driverId} (${vehiclenumber}) at ${pickAddr}`);
            }
          }
          const allDriverJobs = jobStore.filter(matchesDriverDS);
          let activatedOneDS = false;
          allDriverJobs.forEach(function(job) {
            const prev = job.BookingStatus;
            const orphanedDS = !job.DriverId || String(job.DriverId) === '0';
            if (newStatus === 'Assigned' && !TERMINAL.has(job.BookingStatus) && !orphanedDS) {
              job.BookingStatus = 'Assigned';
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Assigned`);
            } else if (newStatus === 'Busy' && !activatedOneDS &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphanedDS))) {
              job.BookingStatus = 'Active';
              activatedOneDS = true;
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Assigned';
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Assigned (Picking)`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
                console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Completed`);
              } else if (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking') {
                if (isDispatcherRecalled(job.Id)) {
                  job.BookingStatus = 'Pending';
                  job.DriverId = 0; job.VehicleId = 0;
                  job.returnReason = 'Manually unassigned';
                  clearDispatcherRecalled(job.Id);
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Pending (dispatcher recall — not a driver cancel)`);
                } else {
                  // Driver cancelled after accepting — move to closed jobs
                  job.BookingStatus = 'Cancelled';
                  job.CancelledBy   = 'Driver';
                  job.returnReason  = 'Driver cancelled after accepting';
                  job.JobCompleteTime = new Date().toISOString().replace('T',' ').slice(0,19) + '.';
                  const idxDS = jobStore.indexOf(job);
                  if (idxDS !== -1) jobStore.splice(idxDS, 1);
                  closedJobStore.push(job);
                  _dssDriverCancelled = { jobId: job.Id, driverId, drivername, vehiclenumber };
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Cancelled (driver cancelled after accepting)`);
                }
              }
              // Offered/Unreached/Pending: driver going Available — leave job as-is
            }
          });
          // When driver goes Available: calculate their new queue position
          if (newStatus === 'Available') {
            const zdAvailDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
            if (zdAvailDS) {
              const currentZoneDS = zdAvailDS.zonename || zonenameDS || '';
              _dssQueueNo = calcRestoredQueue(driverId, currentZoneDS);
              zdAvailDS.zonequeue = _dssQueueNo;
              zdAvailDS.vehiclestatus = 'Available';
              zdAvailDS.queueWaitSince = Date.now();
              clearDriverHomeState(driverId);
              console.log(`  [DriverStatusChanged/DS] driver ${driverId} Available → zone="${currentZoneDS}" newQueue=${_dssQueueNo}`);
            }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dssQueueNo, queueWaitSince: _dssQueueNo ? Date.now() : null, driverCancelled: _dssDriverCancelled || null });

      } else if (action === '[UnAssignedJobsv3]') {
        const resp = buildJobListResponse(jobStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${jobStore.length} jobs (${resp.dt4[0].UnAssignedCount} unassigned)`);
        objectD(res, resp);

      } else if (action === '[deviUnAssignedJobsv2]') {
        const resp = buildDeliveryResponse(jobStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${resp.dt1.length} delivery jobs`);
        objectD(res, resp);

      } else if (action === '[DispatcherConversation]') {
        const driverId = (param('Id') || '').toString().trim();
        const dt1 = [{ PlayerId: '' }];
        const convo = messageStore.filter(m => String(m.SenderId) === driverId || String(m.ReceiverId) === driverId);
        convo.forEach(m => { if (String(m.SenderId) === driverId) m.IsRead = true; });
        const dt2 = convo.map(m => ({
          Id: m.Id, SenderID: m.SenderId, User: m.SenderName,
          Message: m.Message, Date: m.Date, Time: m.Time,
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${dt2.length} messages for driver #${driverId}`);
        objectD(res, { dt1, dt2 });

      } else {
        // Default: return live job list from in-memory store
        const allJobs = buildJobListResponse(jobStore);
        console.log(`200: POST ${urlPath} [action=${action || 'default'}] -> ${jobStore.length} jobs`);
        objectD(res, allJobs);
      }
      return;
    }

    // ── LoginSelector — dispatcher authentication ──────────────────────────
    if (urlPath.includes('/LoginSelector')) {
      const username = param('Username') || param('Email') || param('UserEmail') || '';
      const password = param('Password') || param('Pass') || '';
      if (!username.trim()) {
        console.log(`200: POST ${urlPath} [LoginSelector] -> missing credentials`);
        successD(res, 'Please enter your username and password.');
        return;
      }

      // ── Try to authenticate against the real taxitime.co.nz backend ──────
      // If successful, the ASP.NET session cookie is forwarded to the browser
      // so that all subsequent proxy calls carry a valid session and return
      // real production data (jobs, messages, drivers, etc.).
      if (password && password !== 'mock') {
        try {
          const proxied = await proxyToRealBackend(
            urlPath, req.method, body, req.headers['cookie'] || ''
          );
          const bodyText = (proxied.body || '').trim();
          const isSessionError = bodyText.includes('Session is experied') || bodyText.includes('Session is expired');
          if (proxied.statusCode === 200 && !isSessionError && (bodyText.startsWith('{') || bodyText.startsWith('['))) {
            // Real backend accepted the credentials — forward its session cookies
            const replyHeaders = {
              'Content-Type': proxied.headers['content-type'] || 'application/json',
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*',
            };
            if (proxied.headers['set-cookie']) {
              const rawCookies = proxied.headers['set-cookie'];
              const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
              replyHeaders['Set-Cookie'] = cookies.map(c =>
                c.replace(/;\s*domain=[^;,]*/gi, '').replace(/;\s*samesite=[^;,]*/gi, '')
              );
            }
            console.log(`200: LoginSelector → REAL backend auth OK for "${username}"`);
            res.writeHead(200, replyHeaders);
            res.end(proxied.body);
            return;
          }
          console.log(`LoginSelector: real backend rejected credentials for "${username}" (status=${proxied.statusCode}) — using mock session`);
        } catch (e) {
          console.log(`LoginSelector: real backend unreachable (${e.message}) — using mock session`);
        }
      }

      // ── Fallback: mock session (Firebase-only users or real backend down) ─
      console.log(`200: POST ${urlPath} [LoginSelector] -> mock session for "${username}"`);
      arrayD(res, [{
        Id: 1051,
        UserFName: username.split('@')[0] || 'Dispatcher',
        UserLName: '',
        UserEmail: username,
        CompanyId: 1216,
        Country: 'NZ',
        Role: 'Dispatcher',
        UserStatus: 'Active',
      }]);
      return;
    }

    // ── Logout ──────────────────────────────────────────────────────────────
    if (urlPath.includes('/DispatcherLogin.aspx/Logout')) {
      console.log(`200: POST ${urlPath} -> logout OK`);
      jsonReply(res, { d: 'DispatcherLogin.aspx' });
      return;
    }

    // ── Account / access request (Stripe-ready) ─────────────────────────────
    if (urlPath.includes('/DispatcherLogin.aspx/AccountRequest')) {
      let reqBody = {};
      try { reqBody = JSON.parse(body); } catch (e) {}
      const reqName    = reqBody.name    || param('name')    || '';
      const reqEmail   = reqBody.email   || param('email')   || '';
      const reqPhone   = reqBody.phone   || param('phone')   || '';
      const reqCompany = reqBody.company || param('company') || '';
      const reqRole    = reqBody.role    || param('role')    || 'Dispatcher';
      console.log(`200: POST ${urlPath} -> access request from "${reqEmail}" (${reqName})`);
      jsonReply(res, { d: 'Request received. Our team will contact you within 1 business day.', stripe_ready: true });
      return;
    }

    // ── GeneralSelector — vehicle types, zones, etc. ───────────────────────
    if (urlPath.includes('/GeneralSelector')) {
      if (action === 'VehicleTypes' || action === '[VehicleTypes]') {
        const types = [
          { Id: 1, VehicleName: 'Sedan' }, { Id: 2, VehicleName: 'SUV' },
          { Id: 3, VehicleName: 'Van'   }, { Id: 4, VehicleName: 'Wheelchair' },
        ];
        console.log(`200: POST ${urlPath} [action=${action}] -> ${types.length} vehicle types`);
        arrayD(res, types);
      } else {
        console.log(`200: POST ${urlPath} [action=${action}] (GeneralSelector) -> []`);
        jsonReply(res, { d: '[]' });
      }
      return;
    }

    // ── Other DataManager requests ──────────────────────────────────────────
    const filePath = resolveFilePath(urlPath);
    if (filePath) {
      console.log(`200: POST ${urlPath} -> ${filePath.replace(ROOT, '')}`);
      res.writeHead(200, JSON_HEADERS);
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    console.log(`200: POST ${urlPath} [action=${action}] -> silent []`);
    jsonReply(res, { d: '[]' });
    return;
  }

  // ── Static file serving ─────────────────────────────────────────────────────
  const filePath = resolveFilePath(urlPath);
  if (!filePath) {
    console.log(`404: ${req.method} ${urlPath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${urlPath}`);
    return;
  }

  console.log(`200: ${req.method} ${urlPath} -> ${filePath.replace(ROOT, '')}`);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
});

// ─── Periodic in-memory map cleanup ──────────────────────────────────────────
// AWAY_LOCKED, DISPATCHER_RECALLED, and DRIVER_ZONE_MEMORY all grow unbounded
// if drivers disconnect without going through a clean status transition.
// Run a sweep every 10 minutes to remove expired / stale entries.
setInterval(() => {
  const now = Date.now();
  // AWAY_LOCKED: entries older than 5 minutes (TTL is 3 min, this catches edge cases)
  for (const id of Object.keys(AWAY_LOCKED)) {
    if (now - AWAY_LOCKED[id].ts > 5 * 60 * 1000) {
      delete AWAY_LOCKED[id];
      console.log(`[cleanup] AWAY_LOCKED stale entry removed for driver ${id}`);
    }
  }
  // DISPATCHER_RECALLED: entries are self-expiring (isDispatcherRecalled deletes them
  // on read), but sweep any that were never read.
  for (const jobId of Object.keys(DISPATCHER_RECALLED)) {
    if (now > DISPATCHER_RECALLED[jobId]) {
      delete DISPATCHER_RECALLED[jobId];
    }
  }
  // DRIVER_ZONE_MEMORY: remove entries for drivers not seen in the last 8 hours.
  // Zone memory is only useful for the current shift window.
  for (const id of Object.keys(DRIVER_ZONE_MEMORY)) {
    const entry = DRIVER_ZONE_MEMORY[id];
    if (entry && entry.savedAt && now - entry.savedAt > 8 * 60 * 60 * 1000) {
      delete DRIVER_ZONE_MEMORY[id];
      console.log(`[cleanup] DRIVER_ZONE_MEMORY stale entry removed for driver ${id}`);
    }
  }
}, 10 * 60 * 1000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Killing existing process and retrying...`);
    const { execSync } = require('child_process');
    try { execSync(`fuser -k ${PORT}/tcp`); } catch (e) {}
    setTimeout(() => {
      server.close();
      server.listen(PORT, HOST, () => console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`));
    }, 1000);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
