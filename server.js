// Must be set before any Date operations — forces all new Date() calls to use NZ time
// so BookingDateTime, JobMins, and dispatch timestamps match the dispatcher's local clock.
process.env.TZ = 'Pacific/Auckland';

// Returns current NZ local time as "YYYY-MM-DD HH:mm:ss" — same format and timezone
// as BookingDateTime values that come from the browser form.
// NOTE: toISOString() always returns UTC regardless of TZ env, so we must use this helper.
function nowNZ() {
  return new Date().toLocaleString('sv', { timeZone: 'Pacific/Auckland' }).replace('T', ' ').slice(0, 19);
}

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const DATA_DIR                  = path.join(__dirname, '.data');
const JOB_STORE_FILE            = path.join(DATA_DIR, 'jobstore.json');
const SUSPENDED_DRIVERS_FILE    = path.join(DATA_DIR, 'suspended_drivers.json');
const COOKIE_FILE               = path.join(DATA_DIR, 'session.txt');
const ZONE_ASSIGNMENTS_FILE     = path.join(DATA_DIR, 'zone_assignments.json');
const TARIFF_STORE_FILE         = path.join(DATA_DIR, 'tariffs.json');
const REGISTRATIONS_FILE        = path.join(DATA_DIR, 'registrationRequests.json');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }

// ─── Registration / account request store ────────────────────────────────────
// status: pending | approved | rejected | trial | active | grace | deactivated
let registrationStore = [];
try {
  if (fs.existsSync(REGISTRATIONS_FILE)) {
    registrationStore = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf8')) || [];
    console.log(`[persist] loaded ${registrationStore.length} registration request(s) from disk`);
  }
} catch(e) { console.log('[persist] registrations load error:', e.message); }

function saveRegistrations() {
  fs.writeFile(REGISTRATIONS_FILE, JSON.stringify(registrationStore, null, 2), err => {
    if (err) console.log('[persist] registrations save error:', err.message);
  });
}

// Run every 10 minutes — expire trials, move to grace period, then deactivate
setInterval(() => {
  const now = Date.now();
  let changed = false;
  registrationStore.forEach(r => {
    if (r.status === 'trial' && r.trialEnd && now > r.trialEnd) {
      r.status = 'grace';
      r.graceEnd = r.trialEnd + 24 * 60 * 60 * 1000;
      console.log(`[accounts] ${r.email} trial expired → grace period until ${new Date(r.graceEnd).toISOString()}`);
      changed = true;
    } else if (r.status === 'grace' && r.graceEnd && now > r.graceEnd) {
      r.status = 'deactivated';
      console.log(`[accounts] ${r.email} grace expired → deactivated`);
      // Revoke Firebase adminAccess async
      if (r.ownerUid && r.companyId && r.passwordHash) {
        firebaseSignIn(r.email, r.passwordHash)
          .then(({ idToken }) => firebaseDbDelete(`adminAccess/${r.companyId}/${r.ownerUid}`, idToken))
          .then(() => console.log(`[accounts] Firebase: revoked adminAccess/${r.companyId}/${r.ownerUid}`))
          .catch(e => console.log(`[accounts] Firebase revoke warning (auto-deactivate) for ${r.email}: ${e.message}`));
      }
      changed = true;
    }
  });
  if (changed) saveRegistrations();
}, 10 * 60 * 1000);

// Super-admin key — set BW_ADMIN_KEY env var in Replit Secrets to secure the endpoints
const ADMIN_KEY = process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026';

// ─── Session token helpers ─────────────────────────────────────────────────────
// Stateless signed cookies: companyId.expiry.hmac — survives server restarts.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function createSessionToken(companyId) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `${companyId}.${expiry}`;
  const sig = crypto.createHmac('sha256', ADMIN_KEY).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
function parseSessionToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [companyId, expiry, sig] = parts;
  const payload = `${companyId}.${expiry}`;
  const expected = crypto.createHmac('sha256', ADMIN_KEY).update(payload).digest('hex');
  if (sig !== expected) return null;
  if (Date.now() > parseInt(expiry, 10)) return null;
  return companyId;
}
function parseCookieString(str) {
  const out = {};
  (str || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return out;
}
function getSessionCompanyId(req) {
  const cookies = parseCookieString(req.headers.cookie || '');
  return parseSessionToken(cookies['BW_SID'] || '') || null;
}

// ─── Collision-proof company ID generator ─────────────────────────────────────
function generateCompanyId() {
  const existing = new Set(
    (registrationStore || []).map(r => r.companyId).filter(Boolean)
  );
  let id;
  do {
    id = String(100000 + Math.floor(Math.random() * 900000)); // 6-digit, 100000-999999
  } while (existing.has(id));
  return id;
}

// ─── Firebase REST helpers ────────────────────────────────────────────────────
const FB_API_KEY  = 'AIzaSyBhcA7J8ZefAwlzhuYUNDIf_W3Yzy_16gA';
const FB_DB_URL   = 'https://taxilatest.firebaseio.com';

function fbRequest(url, method, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function firebaseCreateUser(email, password) {
  const r = await fbRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_API_KEY}`,
    'POST', { email, password, returnSecureToken: true }
  );
  if (r.status !== 200) {
    const code = r.body?.error?.message || 'UNKNOWN';
    // If email already exists, sign in instead so we still get uid+token
    if (code === 'EMAIL_EXISTS') return firebaseSignIn(email, password);
    throw new Error(`Firebase createUser failed: ${code}`);
  }
  return { uid: r.body.localId, idToken: r.body.idToken };
}

async function firebaseSignIn(email, password) {
  const r = await fbRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_API_KEY}`,
    'POST', { email, password, returnSecureToken: true }
  );
  if (r.status !== 200) {
    const code = r.body?.error?.message || 'UNKNOWN';
    throw new Error(`Firebase signIn failed: ${code}`);
  }
  return { uid: r.body.localId, idToken: r.body.idToken };
}

// If BW_FIREBASE_SECRET env var is set, use it as admin token (bypasses rules).
// Get it from: Firebase Console → Project Settings → Service Accounts → Database Secrets.
// Otherwise falls back to the user's own ID token (requires rules to be deployed).
function fbAuthToken(idToken) {
  return process.env.BW_FIREBASE_SECRET || idToken;
}

async function firebaseDbSet(path, value, idToken) {
  const r = await fbRequest(
    `${FB_DB_URL}/${path}.json?auth=${fbAuthToken(idToken)}`,
    'PUT', value
  );
  if (r.status !== 200) throw new Error(`Firebase DB write failed: ${JSON.stringify(r.body)}`);
  return r.body;
}

async function firebaseDbDelete(path, idToken) {
  const r = await fbRequest(
    `${FB_DB_URL}/${path}.json?auth=${fbAuthToken(idToken)}`,
    'DELETE', null
  );
  if (r.status !== 200 && r.status !== 204) throw new Error(`Firebase DB delete failed: ${JSON.stringify(r.body)}`);
  return true;
}

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

function buildDriverChatList(cid) {
  const drivers = cid ? ZONE_DRIVERS.filter(d => !d.companyId || d.companyId === cid) : ZONE_DRIVERS;
  const msgs    = cid ? messageStore.filter(m => !m.companyId || m.companyId === cid)  : messageStore;
  return drivers.map(d => {
    const did = String(d.driverid || d.VehicleId || '');
    const unread = msgs.filter(m => String(m.SenderId) === did && !m.IsRead).length;
    const dn = d.drivername || '';
    return { Id: d.driverid || d.VehicleId, UserFName: dn.split(' ')[0], UserLName: dn.split(' ').slice(1).join(' '), Count: unread, PlayerId: '' };
  });
}

// ─── Closed job store ─────────────────────────────────────────────────────────
// Persisted to disk so real completed jobs survive server restarts.
const CLOSED_JOB_STORE_FILE = path.join(DATA_DIR, 'closedjobstore.json');

let _savedClosedJobStore = [];
try {
  if (fs.existsSync(CLOSED_JOB_STORE_FILE)) {
    const _rawClosed = JSON.parse(fs.readFileSync(CLOSED_JOB_STORE_FILE, 'utf8')) || [];
    _savedClosedJobStore = _rawClosed.filter(j => j.companyId);
    const _droppedClosed = _rawClosed.length - _savedClosedJobStore.length;
    if (_droppedClosed > 0) console.log(`[persist] dropped ${_droppedClosed} untagged closed jobs (no companyId — pre-isolation data)`);
    console.log(`[persist] loaded ${_savedClosedJobStore.length} closed jobs from disk`);
  }
} catch(e) { console.log('[persist] closedjobstore load error:', e.message); }

const closedJobStore = _savedClosedJobStore;

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
    const _rawJobs = JSON.parse(fs.readFileSync(JOB_STORE_FILE, 'utf8')) || [];
    _savedJobStore = _rawJobs.filter(j => j.companyId);
    const _droppedJobs = _rawJobs.length - _savedJobStore.length;
    if (_droppedJobs > 0) console.log(`[persist] dropped ${_droppedJobs} untagged jobs (no companyId — pre-isolation data)`);
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

function saveClosedJobStore() {
  fs.writeFile(CLOSED_JOB_STORE_FILE, JSON.stringify(closedJobStore, null, 2), (err) => {
    if (err) console.log('[persist] closedjobstore save error:', err.message);
  });
}

// Live drivers come exclusively from Firebase (online/1216).
// This array is kept as an empty structure so dependent code paths don't crash.
const ZONE_DRIVERS = [];

// Used by VehiclesStatus to skip driver-ID sync during the first 90 s after restart
// (ZONE_DRIVERS may be incomplete while Firebase re-delivers child_added events).
const SERVER_START_TIME = Date.now();

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
// Each entry: { driverId, vehicleId, drivername, vehiclenumber, vehicletype, zonename, suspendedAt, suspendedUntil }
// suspendedUntil: ISO string — when null/undefined the suspension is indefinite.
// Loaded from disk on startup so suspensions survive server restarts.
let _savedSuspendedDrivers = [];
try {
  if (fs.existsSync(SUSPENDED_DRIVERS_FILE)) {
    const _rawSusp = JSON.parse(fs.readFileSync(SUSPENDED_DRIVERS_FILE, 'utf8')) || [];
    _savedSuspendedDrivers = _rawSusp.filter(d => d.companyId);
    const _droppedSusp = _rawSusp.length - _savedSuspendedDrivers.length;
    if (_droppedSusp > 0) console.log(`[persist] dropped ${_droppedSusp} untagged suspended drivers (no companyId — pre-isolation data)`);
    console.log(`[persist] loaded ${_savedSuspendedDrivers.length} suspended driver(s) from disk`);
  }
} catch(e) { console.log('[persist] suspended_drivers load error:', e.message); }

const SUSPENDED_DRIVERS = _savedSuspendedDrivers;

function saveSuspendedDrivers() {
  fs.writeFile(SUSPENDED_DRIVERS_FILE, JSON.stringify(SUSPENDED_DRIVERS, null, 2), (err) => {
    if (err) console.log('[persist] suspended_drivers save error:', err.message);
  });
}

// ─── Persisted zone assignments ──────────────────────────────────────────────
// Maps driverId → { zonename, zoneid } so zone survives server restarts.
// Saved every time a driver's zone is confirmed (Available with non-empty zone).
let ZONE_ASSIGNMENTS = {};
try {
  if (fs.existsSync(ZONE_ASSIGNMENTS_FILE)) {
    ZONE_ASSIGNMENTS = JSON.parse(fs.readFileSync(ZONE_ASSIGNMENTS_FILE, 'utf8')) || {};
    console.log(`[persist] loaded zone assignments for ${Object.keys(ZONE_ASSIGNMENTS).length} driver(s)`);
  }
} catch(e) { console.log('[persist] zone_assignments load error:', e.message); }

function saveZoneAssignment(driverId, zonename, zoneid) {
  if (!driverId || !zonename) return;
  ZONE_ASSIGNMENTS[String(driverId)] = { zonename, zoneid: zoneid || '' };
  fs.writeFile(ZONE_ASSIGNMENTS_FILE, JSON.stringify(ZONE_ASSIGNMENTS, null, 2), (err) => {
    if (err) console.log('[persist] zone_assignments save error:', err.message);
  });
}

function getSavedZone(driverId) {
  return ZONE_ASSIGNMENTS[String(driverId)] || null;
}

// ─── Persisted tariff store ───────────────────────────────────────────────────
// Mirrors the real tariff list from Firebase so the driver app and fare
// estimator always use the company's actual rates instead of hardcoded defaults.
// The dispatch console pushes an update via [TariffSync] whenever it reads the
// tariffZones Firebase node.
const _DEFAULT_TARIFFS = [
  { Id: 1, TariffName: 'Standard',  StartPrice: 3.50, DistanceRate: 2.20, WaitingRate: 0, MinimumFare: 0, CurrencyName: 'NZD' },
];
let TARIFF_STORE = _DEFAULT_TARIFFS;
try {
  if (fs.existsSync(TARIFF_STORE_FILE)) {
    const _loaded = JSON.parse(fs.readFileSync(TARIFF_STORE_FILE, 'utf8'));
    if (Array.isArray(_loaded) && _loaded.length > 0) {
      TARIFF_STORE = _loaded;
      console.log(`[persist] loaded ${TARIFF_STORE.length} tariff(s) from disk`);
    }
  }
} catch(e) { console.log('[persist] tariffs load error:', e.message); }

function saveTariffStore() {
  fs.writeFile(TARIFF_STORE_FILE, JSON.stringify(TARIFF_STORE, null, 2), (err) => {
    if (err) console.log('[persist] tariffs save error:', err.message);
  });
}

// Auto-expire suspended drivers: check every 60 s, restore any whose suspendedUntil has passed.
setInterval(function() {
  const now = Date.now();
  for (let i = SUSPENDED_DRIVERS.length - 1; i >= 0; i--) {
    const s = SUSPENDED_DRIVERS[i];
    if (s.suspendedUntil && new Date(s.suspendedUntil).getTime() <= now) {
      SUSPENDED_DRIVERS.splice(i, 1);
      const maxQ = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
      ZONE_DRIVERS.push({
        driverid: s.driverId, VehicleId: s.vehicleId,
        drivername: s.drivername, vehiclenumber: s.vehiclenumber,
        vehicletype: s.vehicletype, zonename: s.zonename,
        vehiclestatus: 'Away', zonequeue: maxQ + 1, queueWaitSince: Date.now(),
        companyId: s.companyId || '',
      });
      console.log(`[AutoExpire] Driver ${s.driverId}/${s.vehicleId} suspension expired — restored to Away`);
      saveSuspendedDrivers();
    }
  }
}, 60000);

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
  // 'Assigned' = driver accepted → shows in Assigned tab
  // 'Queued'   = Busy driver accepted a pre-queue offer → shows in Assigned tab (no Recall button)
  // Exclude orphaned jobs (Assigned but no real driver: DriverId=0 or -1) — those appear in Unassigned tab instead.
  const assigned = jobs.filter(j =>
    (j.BookingStatus === 'Assigned' || j.BookingStatus === 'Queued') &&
    j.DriverId && String(j.DriverId) !== '0' && String(j.DriverId) !== '-1'
  );
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

  // ── Proxy /__mockup/ to the mockup sandbox Vite dev server (port 23636) ──
  if (urlPath.startsWith('/__mockup/')) {
    const proxyReq = http.request(
      { hostname: '127.0.0.1', port: 23636, path: req.url, method: req.method, headers: req.headers },
      proxyRes => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );
    proxyReq.on('error', () => { res.writeHead(502); res.end('Mockup sandbox not running'); });
    req.pipe(proxyReq, { end: true });
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/Default.aspx';

  // Server-side auth guard for the dispatch console.
  // If the browser has no valid BW_SID cookie, redirect to the login page at the HTTP level
  // so the client never receives Default.aspx and no client-side redirect loop occurs.
  if (urlPath === '/Default.aspx' && req.method === 'GET') {
    const companyId = getSessionCompanyId(req);
    if (!companyId) {
      res.writeHead(302, { Location: '/DispatcherLogin.aspx' });
      res.end();
      return;
    }
    // Also check the company's current status — deactivated/deleted companies must not load the console
    const _gateReg = registrationStore.find(r => r.companyId === companyId);
    const _gateAllowed = ['trial', 'active', 'grace'];
    if (!_gateReg || !_gateAllowed.includes(_gateReg.status)) {
      console.log(`[gate] Default.aspx blocked: companyId=${companyId} status=${_gateReg ? _gateReg.status : 'not found'}`);
      // Expire the cookie so the browser won't re-use it
      res.writeHead(302, {
        Location: '/DispatcherLogin.aspx?reason=account_inactive',
        'Set-Cookie': 'BW_SID=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0',
      });
      res.end();
      return;
    }
  }

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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    });
    res.end();
    return;
  }

  // ── BookaWaka Admin API (for super-admin Replit) ─────────────────────────
  // All endpoints require header:  X-Admin-Key: <BW_ADMIN_KEY>
  //
  // GET  /admin/registrations               → list all registration requests
  // GET  /admin/registrations/:id           → single request detail
  // POST /admin/registrations/:id/approve   → approve → starts 10-day trial
  // POST /admin/registrations/:id/reject    → reject with optional reason
  // POST /admin/registrations/:id/activate  → move from grace to active (paid)
  // POST /admin/registrations/:id/deactivate → manually deactivate
  // GET  /admin/accounts                    → list all approved accounts (status, trial dates, etc.)
  if (urlPath.startsWith('/admin/')) {
    const adminKey = req.headers['x-admin-key'] || '';
    if (adminKey !== ADMIN_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorised — invalid admin key' }));
      return;
    }

    // GET /admin/registrations
    if (urlPath === '/admin/registrations' && req.method === 'GET') {
      const filter = new URL('http://x' + req.url).searchParams.get('status');
      const list = filter ? registrationStore.filter(r => r.status === filter) : registrationStore;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(list));
      return;
    }

    // GET /admin/accounts  (approved / trial / active / grace / deactivated)
    if (urlPath === '/admin/accounts' && req.method === 'GET') {
      const accounts = registrationStore.filter(r =>
        ['approved','trial','active','grace','deactivated'].includes(r.status)
      ).map(r => ({
        id: r.id, companyId: r.companyId, company: r.company, name: r.name,
        email: r.email, phone: r.phone, country: r.country, area: r.area,
        fleetSize: r.fleetSize, status: r.status,
        approvedAt: r.approvedAt, trialStart: r.trialStart, trialEnd: r.trialEnd,
        graceEnd: r.graceEnd,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(accounts));
      return;
    }

    // Single-registration actions — parse /admin/registrations/:id[/action]
    const regMatch = urlPath.match(/^\/admin\/registrations\/([^/]+)(\/[\w-]+)?$/);
    if (regMatch) {
      const regId  = regMatch[1];
      const action = (regMatch[2] || '').replace('/', '');
      const reg    = registrationStore.find(r => r.id === regId);

      if (!reg) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Registration ${regId} not found` }));
        return;
      }

      // GET /admin/registrations/:id
      if (!action && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(reg));
        return;
      }

      // POST /admin/registrations/:id/approve
      if (action === 'approve' && req.method === 'POST') {
        if (!['pending','rejected'].includes(reg.status)) {
          jsonReply(res, { error: `Cannot approve a registration with status "${reg.status}"` });
          return;
        }
        const now = Date.now();
        const companyId = generateCompanyId();

        // Grant Firebase access: use the UID captured at registration time (best path),
        // or fall back to creating/signing-in to get the UID now.
        let ownerUid = reg.ownerUid || null;
        let fbError  = null;
        try {
          let idToken;
          if (ownerUid) {
            // UID already set at registration — sign in to get a fresh idToken
            ({ idToken } = await firebaseSignIn(reg.email, reg.passwordHash));
          } else {
            // Fallback: Firebase user wasn't created at registration — create it now
            const created = await firebaseCreateUser(reg.email, reg.passwordHash);
            ownerUid = created.uid;
            idToken  = created.idToken;
          }
          // adminAccess: lets the admin/owner panel verify company membership
          await firebaseDbSet(`adminAccess/${companyId}/${ownerUid}`, true, idToken);
          // users/{uid}: dispatch console login reads companyId from here
          await firebaseDbSet(`users/${ownerUid}/companyId`,   companyId,      idToken);
          await firebaseDbSet(`users/${ownerUid}/companyName`, reg.company || '', idToken);
          console.log(`[admin] Firebase: uid=${ownerUid} — wrote adminAccess & users/${ownerUid}/companyId=${companyId}`);
        } catch(e) {
          fbError = e.message;
          console.log(`[admin] Firebase provisioning warning for ${reg.email}: ${e.message}`);
        }

        reg.status     = 'trial';
        reg.companyId  = companyId;
        reg.ownerUid   = ownerUid;
        reg.approvedAt = now;
        reg.trialStart = now;
        reg.trialEnd   = now + 10 * 24 * 60 * 60 * 1000;
        reg.graceEnd   = null;
        saveRegistrations();
        console.log(`[admin] approved registration ${regId} → companyId=${companyId}, uid=${ownerUid}, trial until ${new Date(reg.trialEnd).toISOString()}`);
        jsonReply(res, {
          ok: true, companyId, ownerUid, trialEnd: reg.trialEnd,
          message: 'Approved. 10-day trial starts now.',
          fbWarning: fbError || undefined,
        });
        return;
      }

      // POST /admin/registrations/:id/reject
      if (action === 'reject' && req.method === 'POST') {
        const _rb = await readBody(req);
        let rb = {};
        try { rb = JSON.parse(_rb); } catch(e) {}
        reg.status         = 'rejected';
        reg.rejectedAt     = Date.now();
        reg.rejectedReason = rb.reason || '';
        saveRegistrations();
        console.log(`[admin] rejected registration ${regId}`);
        jsonReply(res, { ok: true, message: 'Registration rejected.' });
        return;
      }

      // POST /admin/registrations/:id/activate  (mark as paid / fully active)
      if (action === 'activate' && req.method === 'POST') {
        reg.status   = 'active';
        reg.graceEnd = null;
        saveRegistrations();
        console.log(`[admin] activated account ${regId} (${reg.email})`);
        jsonReply(res, { ok: true, message: 'Account activated.' });
        return;
      }

      // POST /admin/registrations/:id/deactivate
      if (action === 'deactivate' && req.method === 'POST') {
        reg.status = 'deactivated';
        saveRegistrations();
        // Remove Firebase adminAccess node if we have the uid and password
        if (reg.ownerUid && reg.companyId && reg.passwordHash) {
          firebaseSignIn(reg.email, reg.passwordHash)
            .then(({ idToken }) => firebaseDbDelete(`adminAccess/${reg.companyId}/${reg.ownerUid}`, idToken))
            .then(() => console.log(`[admin] Firebase: deleted adminAccess/${reg.companyId}/${reg.ownerUid}`))
            .catch(e => console.log(`[admin] Firebase revoke warning for ${reg.email}: ${e.message}`));
        }
        console.log(`[admin] deactivated account ${regId} (${reg.email})`);
        jsonReply(res, { ok: true, message: 'Account deactivated.' });
        return;
      }

      // DELETE /admin/registrations/:id  ─OR─  POST /admin/registrations/:id/delete
      // Permanently removes the company from the store so they can never log in again.
      // Also revokes Firebase adminAccess so the owner can't reach other Repls.
      const isDelete = (req.method === 'DELETE' && !action) || (action === 'delete' && req.method === 'POST');
      if (isDelete) {
        const idx = registrationStore.findIndex(r => r.id === regId);
        if (idx !== -1) registrationStore.splice(idx, 1);
        saveRegistrations();
        // Revoke Firebase access asynchronously
        if (reg.ownerUid && reg.companyId && reg.passwordHash) {
          firebaseSignIn(reg.email, reg.passwordHash)
            .then(({ idToken }) => firebaseDbDelete(`adminAccess/${reg.companyId}/${reg.ownerUid}`, idToken))
            .then(() => console.log(`[admin] Firebase: revoked adminAccess/${reg.companyId}/${reg.ownerUid}`))
            .catch(e => console.log(`[admin] Firebase revoke warning (delete) for ${reg.email}: ${e.message}`));
        }
        console.log(`[admin] DELETED account ${regId} companyId=${reg.companyId || '?'} (${reg.email})`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, message: 'Account permanently deleted.' }));
        return;
      }

      // POST /admin/registrations/:id/fix-firebase
      // Repair: write users/{uid}/companyId to Firebase for already-approved accounts
      // that were approved before this fix was deployed. Safe to call multiple times.
      if (action === 'fix-firebase' && req.method === 'POST') {
        if (!reg.companyId || !reg.passwordHash) {
          jsonReply(res, { error: 'Account is missing companyId or password hash — cannot repair.' });
          return;
        }
        let fbError = null;
        let uid = reg.ownerUid || null;
        try {
          // If uid missing, try sign-in first; if that fails, create the user
          let idToken;
          if (uid) {
            ({ idToken } = await firebaseSignIn(reg.email, reg.passwordHash));
          } else {
            try {
              ({ idToken } = await firebaseSignIn(reg.email, reg.passwordHash));
              // Sign-in succeeded — get uid from the token response
              const tokenData = JSON.parse(Buffer.from(idToken.split('.')[1] + '==', 'base64').toString());
              uid = tokenData.user_id || tokenData.sub || uid;
            } catch(_) {
              // Sign-in failed — create the Firebase user
              const created = await firebaseCreateUser(reg.email, reg.passwordHash);
              uid = created.uid;
              idToken = created.idToken;
            }
          }
          if (!uid) {
            // Get uid from fresh sign-in token
            ({ idToken } = await firebaseSignIn(reg.email, reg.passwordHash));
          }
          // Re-sign in to get a fresh idToken (needed if uid was recovered above)
          const fresh = await firebaseSignIn(reg.email, reg.passwordHash);
          idToken = fresh.idToken;
          uid = uid || fresh.uid;
          await firebaseDbSet(`adminAccess/${reg.companyId}/${uid}`, true, idToken);
          await firebaseDbSet(`users/${uid}/companyId`,   reg.companyId,     idToken);
          await firebaseDbSet(`users/${uid}/companyName`, reg.company || '', idToken);
          // Persist the uid if we just recovered it
          if (!reg.ownerUid) { reg.ownerUid = uid; saveRegistrations(); }
          console.log(`[admin] fix-firebase: wrote users/${uid}/companyId=${reg.companyId} for ${reg.email}`);
        } catch(e) {
          fbError = e.message;
          console.log(`[admin] fix-firebase error for ${reg.email}: ${e.message}`);
        }
        jsonReply(res, { ok: !fbError, companyId: reg.companyId, uid, fbError: fbError || undefined });
        return;
      }
    }

    // Unknown admin route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown admin endpoint' }));
    return;
  }

  // POST /DispatcherLogin.aspx/AccountRequest — public signup / registration
  if (urlPath === '/DispatcherLogin.aspx/AccountRequest' && req.method === 'POST') {
    const rawBody = await readBody(req);
    let reqBody = {};
    try { reqBody = JSON.parse(rawBody); } catch (e) {}
    const reqCompany = (reqBody.company        || '').trim();
    const reqName    = (reqBody.name           || '').trim();
    const reqEmail   = (reqBody.email          || '').trim().toLowerCase();
    const reqPhone   = (reqBody.phone          || '').trim();
    const reqPass    = (reqBody.password       || '').trim();
    const reqBizNum  = (reqBody.businessNumber || '').trim();
    const reqFleet   = (reqBody.fleetSize      || '').trim();
    const reqArea    = (reqBody.area           || '').trim();
    const reqCountry = (reqBody.country        || 'NZ').trim();

    if (!reqCompany || !reqName || !reqEmail) {
      jsonReply(res, { error: 'Company name, your name and email are all required.' });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(reqEmail)) {
      jsonReply(res, { error: 'Please provide a valid email address.' });
      return;
    }
    if (registrationStore.some(r => r.email === reqEmail && r.status !== 'rejected')) {
      jsonReply(res, { error: 'An account request with this email already exists. Our team will be in touch.' });
      return;
    }

    const newReg = {
      id:             'REG-' + Date.now(),
      status:         'pending',
      submittedAt:    Date.now(),
      company:        reqCompany,
      name:           reqName,
      email:          reqEmail,
      phone:          reqPhone,
      passwordHash:   reqPass,
      businessNumber: reqBizNum,
      fleetSize:      reqFleet,
      area:           reqArea,
      country:        reqCountry,
      companyId:      null,
      ownerUid:       null,  // set below after Firebase Auth creation
      approvedAt:     null,
      trialStart:     null,
      trialEnd:       null,
      graceEnd:       null,
      rejectedAt:     null,
      rejectedReason: null,
    };
    registrationStore.push(newReg);
    saveRegistrations();
    console.log(`200: POST ${urlPath} -> new registration [${newReg.id}] from "${reqEmail}" (${reqCompany})`);

    // Create Firebase Auth account immediately so the UID is already known when the
    // super admin approves. Best-effort — registration succeeds even if Firebase fails.
    try {
      const { uid } = await firebaseCreateUser(reqEmail, reqPass);
      newReg.ownerUid = uid;
      saveRegistrations();
      console.log(`[registration] Firebase Auth created for ${reqEmail}: uid=${uid}`);
    } catch(fbRegErr) {
      console.log(`[registration] Firebase Auth creation note for ${reqEmail}: ${fbRegErr.message}`);
    }

    jsonReply(res, { ok: true, message: 'Request received. Our team will review and contact you within 1 business day.' });
    return;
  }

  // POST /api/session/login  — called by dispatch console after Firebase auth
  // Body: { companyId, uid }  (both from localStorage / Firebase)
  // Sets an HttpOnly signed session cookie so every subsequent DataManager request
  // carries the company ID without needing it in every POST body.
  if (urlPath === '/api/session/login' && req.method === 'POST') {
    let body = {};
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw);
    } catch(e) { /* empty body */ }

    const companyId = String(body.companyId || '').trim();
    const uid       = String(body.uid       || '').trim();

    if (!companyId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'companyId is required' }));
      return;
    }

    // Verify this companyId exists in our store (prevents spoofing)
    const reg = registrationStore.find(r => r.companyId === companyId);
    if (!reg) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown company' }));
      return;
    }

    // Block login for any company that is not currently active
    const LOGIN_ALLOWED_STATUSES = ['trial', 'active', 'grace'];
    if (!LOGIN_ALLOWED_STATUSES.includes(reg.status)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      const msg = reg.status === 'deactivated' || reg.status === 'deleted'
        ? 'This account has been deactivated. Please contact BookaWaka support.'
        : reg.status === 'pending'
          ? 'This account is awaiting approval.'
          : reg.status === 'rejected'
            ? 'This account application was not approved.'
            : 'Account access is not available.';
      res.end(JSON.stringify({ error: msg, status: reg.status }));
      console.log(`[session] login BLOCKED: companyId=${companyId} status=${reg.status}`);
      return;
    }

    // Sync: if a Firebase uid was supplied, write it back to the registration record.
    // This keeps Firebase auth (uid) and the local store (email→companyId) in sync —
    // next login can look up by uid directly, not just by email.
    if (uid && reg.ownerUid !== uid) {
      reg.ownerUid = uid;
      saveRegistrations();
      console.log(`[session] synced ownerUid=${uid} → companyId=${companyId}`);
    }

    const token = createSessionToken(companyId);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `BW_SID=${token}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    });
    res.end(JSON.stringify({ ok: true, companyId, company: reg.company, status: reg.status }));
    console.log(`[session] login: companyId=${companyId} company="${reg.company}" uid=${uid}`);
    return;
  }

  // GET /api/session/me — returns the authenticated company ID from the BW_SID cookie.
  // Called by Default.aspx on page load to verify/correct any stale localStorage value.
  if (urlPath === '/api/session/me' && req.method === 'GET') {
    const cid = getSessionCompanyId(req);
    if (!cid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No valid session' }));
      return;
    }
    const ACTIVE_STATUSES = ['active', 'trial', 'grace'];
    const reg = registrationStore.find(r => r.companyId === cid);
    if (!reg) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Company not found' }));
      return;
    }
    // If company has been deactivated/deleted since the cookie was issued, block them
    if (!ACTIVE_STATUSES.includes(reg.status)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Account is not active', status: reg.status }));
      console.log(`[session/me] blocked: companyId=${cid} status=${reg.status}`);
      return;
    }
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                  || req.socket?.remoteAddress
                  || 'unknown';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok:        true,
      companyId: reg.companyId,
      company:   reg.company,
      status:    reg.status,
      isActive:  true,
      email:     reg.email || reg.ownerEmail || '',
      ip:        clientIp,
    }));
    return;
  }

  // GET /api/session/company-by-uid?uid=<firebaseUid>
  // Used by the login page as a reliable uid-based lookup after a successful Firebase auth.
  // Works because /api/session/login syncs the ownerUid field back to the registration record.
  if (urlPath === '/api/session/company-by-uid' && req.method === 'GET') {
    const qs  = new URL('http://x' + req.url).searchParams;
    const uid = (qs.get('uid') || '').trim();
    if (!uid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'uid is required' }));
      return;
    }
    const ACTIVE_STATUSES = ['active', 'trial', 'grace'];
    const reg = registrationStore.find(r =>
      r.ownerUid && r.ownerUid === uid &&
      r.companyId &&
      ACTIVE_STATUSES.includes(r.status)
    );
    if (!reg) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active account found for this uid' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, companyId: reg.companyId, company: reg.company, status: reg.status }));
    return;
  }

  // GET /api/session/company-by-email?email=<email>
  // Used by the login page when Firebase DB doesn't have the companyId (e.g. DB write failed at approval).
  // Returns the companyId for an active/trial company matched by owner email.
  if (urlPath === '/api/session/company-by-email' && req.method === 'GET') {
    const qs    = new URL('http://x' + req.url).searchParams;
    const email = (qs.get('email') || '').toLowerCase().trim();
    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'email is required' }));
      return;
    }
    const ACTIVE_STATUSES = ['active', 'trial', 'grace'];
    const reg = registrationStore.find(r =>
      r.email && r.email.toLowerCase() === email &&
      r.companyId &&
      ACTIVE_STATUSES.includes(r.status)
    );
    if (!reg) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active account found for this email' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, companyId: reg.companyId, company: reg.company, status: reg.status }));
    return;
  }

  // GET /api/account-status?email=...&companyId=...
  // Used by dispatch console, admin/owner panel, and driver app to check access
  if (urlPath === '/api/account-status' && req.method === 'GET') {
    const qs        = new URL('http://x' + req.url).searchParams;
    const qEmail    = (qs.get('email')     || '').toLowerCase();
    const qCompany  = (qs.get('companyId') || '');
    const reg = registrationStore.find(r =>
      (qEmail    && r.email     === qEmail)    ||
      (qCompany  && r.companyId === qCompany)
    );
    if (!reg) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ found: false, status: null }));
      return;
    }
    const now = Date.now();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      found:      true,
      status:     reg.status,
      companyId:  reg.companyId,
      company:    reg.company,
      trialEnd:   reg.trialEnd,
      graceEnd:   reg.graceEnd,
      daysLeft:   reg.trialEnd ? Math.max(0, Math.ceil((reg.trialEnd - now) / 86400000)) : null,
      hoursLeft:  reg.graceEnd ? Math.max(0, Math.ceil((reg.graceEnd - now) / 3600000))  : null,
      canAccess:  ['trial','active','grace'].includes(reg.status),
    }));
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
    const nD   = Math.min(parseInt(qs.get('drivers') || '10'), 500);
    const nJ   = Math.min(parseInt(qs.get('jobs')    || '20'), 2000);
    // Optional companyId tag for isolation-aware tests.
    // If ?cid=X is supplied (or defaults to 'bwtest'), all seeded data is tagged
    // with that companyId and a synthetic active registration is guaranteed to exist.
    const ltCid = (qs.get('cid') || 'bwtest').trim();
    // Ensure a registration entry exists for this test company so /api/session/login works.
    const existsReg = registrationStore.find(r => r.companyId === ltCid);
    if (!existsReg) {
      registrationStore.push({
        id: 'loadtest-reg-' + ltCid,
        companyId: ltCid,
        company:   'LoadTest Company',
        name:      'Test User',
        email:     `loadtest+${ltCid}@bwtest.internal`,
        status:    'active',
        submittedAt: new Date().toISOString(),
        approvedAt:  new Date().toISOString(),
        _isLoadTest: true,
      });
    } else if (existsReg.status !== 'active' && existsReg.status !== 'trial') {
      existsReg.status = 'active'; // restore if a previous test deactivated it
    }
    const zones = ['Central','North','South','East','West'];
    LT_DRIVER_IDS.clear();
    LT_JOB_IDS.clear();
    // Clear any stale jobs from previous seed runs for this company (prevents ID collision on server restart)
    const _staleCount = jobStore.filter(j => j.companyId === ltCid && j._isLoadTest).length;
    if (_staleCount > 0) {
      const _before = jobStore.length;
      for (let _i = jobStore.length - 1; _i >= 0; _i--) {
        if (jobStore[_i].companyId === ltCid && jobStore[_i]._isLoadTest) jobStore.splice(_i, 1);
      }
      console.log(`[loadtest/seed] cleared ${_staleCount} stale ${ltCid} jobs before re-seed`);
      saveJobStore();
    }
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
        companyId:     ltCid,
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
        BookingDateTime: nowNZ(),
        PickAddress:  pickAddrs[j % pickAddrs.length] + ', Invercargill',
        DropAddress:  dropAddrs[j % dropAddrs.length],
        Name:         names[j % names.length],
        PhoneNo:      `021 ${900000 + j}`,
        BookingStatus: 'Pending',
        DriverId: 0, VehicleId: 0, VehicleNo: '',
        Passengers: 1, Bags: 0,
        returnReason: '',
        companyId:  ltCid,
        _isLoadTest: true,
      });
    }
    console.log(`[loadtest] seeded ${nD} drivers, ${nJ} jobs (companyId=${ltCid})`);
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({ ok: true, drivers: nD, jobs: nJ, companyId: ltCid,
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

    // Company ID for this request — read from the signed session cookie set by /api/session/login.
    // Falls back to a param in the data array (for driver-app / legacy callers that include it).
    // Dev-only: X-BW-Test-Company header overrides session (used by bwtest.js integration tests).
    const _testCidHeader = process.env.NODE_ENV !== 'production' ? (req.headers['x-bw-test-company'] || '') : '';
    const sessionCompanyId = _testCidHeader
      || getSessionCompanyId(req)
      || (dataArr.find(p => (p.name||'').toLowerCase() === 'companyid') || {}).value
      || null;

    // Log session company for every DataSelector call so we can verify isolation in console
    console.log(`[isolation] ${req.method} ${urlPath} action=${action} sessionCompanyId=${sessionCompanyId || 'NONE (no valid BW_SID cookie)'}`);

    // Helper: return only the jobs that belong to the requesting company.
    // STRICT — records with no companyId are NEVER returned to any authenticated caller.
    // If there is no session, return an empty array so unauthenticated callers get nothing.
    function companyJobs(store) {
      if (!sessionCompanyId) return [];
      return store.filter(j => j.companyId === sessionCompanyId);
    }
    // Helper: return only drivers belonging to this company.
    function companyDrivers(store) {
      if (!sessionCompanyId) return [];
      return store.filter(d => d.companyId === sessionCompanyId);
    }
    // Helper: return only suspended-driver records for this company.
    function companySuspended(store) {
      if (!sessionCompanyId) return [];
      return store.filter(d => d.companyId === sessionCompanyId);
    }
    // Helper: return only messages belonging to this company.
    function companyMessages(store) {
      if (!sessionCompanyId) return [];
      return store.filter(m => m.companyId === sessionCompanyId);
    }

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
      const OPEN_ST   = new Set(['pending','offered','assigned','picking','active','queued']);
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
      '[KickDriver]', '[DispatcherKickUsers]', '[GetSuspendedDrivers]', '[UnsuspendDriver]', '[UpdateSuspensionTime]', '[UpdateQueueNo]',
      '[ZonesListUpdate]', '[payment_percentage]', '[storeemergency]',
      '[CancelJobStatusFromJobList]', '[QuickSetNoOne]',
      '[TariffSync]',
      '[QueueJob]', '[RecallQueuedJob]', '[GetQueuedJobs]', '[PromoteQueuedToAssigned]',
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
        const _rawDId   = parseInt(param('DId') || '0') || 0;
        // Clamp stale sentinels (e.g. -2 "recalled") to 0 (Pending/no driver). Only -1 ("No One") is intentional.
        const driverId  = (_rawDId === -1) ? -1 : Math.max(0, _rawDId);
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
          companyId: sessionCompanyId || '',
        };
        jobStore.push(newJob);
        saveJobStore();
        console.log(`200: POST ${urlPath} [action=InsertBookingv4] -> created job #${newId} companyId=${sessionCompanyId}`);
        arrayD(res, [{ Result: 'Booking Information Successfully Submitted', BookingStatus: bookstatus, BookingId: newId }]);
      } else if (action === 'UpdateBooking') {
        // Called by cancelactivejob / close-ride flow.
        // Marks the job as Closed, moves it to closedJobStore, and releases the driver.
        const closeId = parseInt(param('BookingId') || '0') || 0;
        const dropLoc     = param('DropLocation')  || '';
        const distance    = param('Distance')      || '0';
        const cost        = param('Cost')          || '0';
        const rideCost    = param('RideCost')      || '0';
        const waitingCost = param('WaitingCost')   || '';
        const waitingTime = param('WaitingTime')   || '';
        const driverCost  = param('DriverCost')    || '';
        const dropLatLng  = param('DropLatLng')    || '';
        const jobIdx   = jobStore.findIndex(j => j.Id === closeId);
        if (jobIdx !== -1) {
          const job = jobStore[jobIdx];
          job.BookingStatus = 'Closed';
          if (dropLoc)     job.DropAddress     = dropLoc;
          if (distance)    job.EstimatedDistance = distance;
          if (cost)        job.Cost            = cost;
          if (rideCost)    job.RideCost        = rideCost;
          if (waitingCost) job.WaitingCost     = waitingCost;
          if (waitingTime) job.WaitingTime     = waitingTime;
          if (driverCost)  job.DriverCost      = driverCost;
          if (dropLatLng)  job.DropLatLng      = dropLatLng;
          if (!job.CompleteAt) job.CompleteAt  = nowNZ();
          // Release the driver back to Available
          const closingDriverId = job.DriverId;
          const zd = ZONE_DRIVERS.find(d =>
            String(d.driverid) === String(closingDriverId) || String(d.VehicleId) === String(closingDriverId));
          if (zd) { zd.vehiclestatus = 'Available'; zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0; }
          // Enrich UserFName/UserLName from ZONE_DRIVERS if not already set
          if ((job.UserFName === undefined || job.UserFName === null) && zd && zd.drivername) {
            const _parts = zd.drivername.trim().split(/\s+/);
            job.UserFName = _parts[0] || '';
            job.UserLName = _parts.slice(1).join(' ') || '';
          } else {
            if (job.UserFName === undefined) job.UserFName = '';
            if (job.UserLName === undefined) job.UserLName = '';
          }
          // Move to closed store
          closedJobStore.push(job);
          jobStore.splice(jobIdx, 1);
          saveJobStore();
          saveClosedJobStore();
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
        const _rawDId2  = parseInt(param('DId') || '0') || 0;
        // Clamp stale sentinels (e.g. -2 "recalled") to 0 (Pending/no driver). Only -1 ("No One") is intentional.
        const driverId  = (_rawDId2 === -1) ? -1 : Math.max(0, _rawDId2);
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
          companyId: sessionCompanyId || '',
        };
        jobStore.push(newJob);
        saveJobStore();
        console.log(`200: POST ${urlPath} [action=${action}] -> created job #${newId} (${bookingDT}) companyId=${sessionCompanyId}`);
        arrayD(res, [{ Result: 'Booking Information Successfully Submitted', BookingStatus: bookstatus, BookingId: newId }]);

      } else if (action === '[ProcUpdateJobv6]') {
        const jobId = parseInt(param('Id')) || 0;
        const job = jobStore.find(j => j.Id === jobId);
        if (job) {
          const _rawDId3  = parseInt(param('DId') || '0') || 0;
          const driverId  = (_rawDId3 === -1) ? -1 : Math.max(0, _rawDId3);
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
          // Persist booking time and dispatch notice — sent by both updateride and updateride2.
          // Dispatchbefore=0 means ASAP; >0 means pre-booked (advance notice in minutes).
          // Must use explicit undefined check because 0 is falsy but is a valid ASAP value.
          const _dbRaw = param('Dispatchbefore');
          if (_dbRaw !== undefined) job.DispatchTimebefore = String(parseInt(_dbRaw) || 0);
          const _newDT = param('DateTime');
          if (_newDT) { job.BookingDateTime = _newDT; job.Pickingtime = _newDT; }
          // Only change status and driver assignment for jobs that are still in a pre-dispatch state.
          // Never overwrite DriverId/VehicleId/BookingStatus for Assigned/Active/Picking jobs —
          // the edit form sends DId:-1 (no driver selected) which would corrupt a live assignment.
          const editableStatuses = new Set(['Pending','Offered','Unreached','No One','']);
          if (editableStatuses.has(job.BookingStatus || '')) {
            job.VehicleId = vehicleId;
            job.DriverId  = driverId;
            if (driverId > 0)       job.BookingStatus = 'Offered';
            else if (driverId === -1) job.BookingStatus = 'No One';
            else                     job.BookingStatus = 'Pending';
          }
          // Dispatcher explicitly edited this job — always clear any previous offer-attempt reason
          // (e.g. 'No Response', 'Recalled by Driver') so the badge doesn't linger after a re-edit.
          job.returnReason = '';
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
          job.BookingStatus = 'Cancelled';
          job.CancelledBy   = 'Dispatcher';
          job.JobCompleteTime = nowNZ();
          closedJobStore.push(job);
          jobStore.splice(idx, 1);
          saveJobStore();
          saveClosedJobStore();
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
              // Save home zone/queue BEFORE the driver is taken off the queue
              saveDriverHomeState(driverId, zd);
              zd.vehiclestatus = 'Picking';
              zd.JobphoneNo = job.PhoneNo || '';
              zd.jobpickup  = job.PickAddress || '';
              zd.jobdropoff = job.DropAddress || '';
              zd.jobCount   = 1;
            }
          } else {
            // Unassign — restore driver to Available at their original queue position
            const prevDriverId = job.DriverId || 0;
            job.BookingStatus = 'Pending';
            job.DriverId = 0;
            job.VehicleId = 0;
            const zd = ZONE_DRIVERS.find(d => d.driverid === prevDriverId || d.VehicleId === prevDriverId);
            if (zd) {
              const _restoreQ = calcRestoredQueue(prevDriverId, zd.zonename);
              zd.zonequeue      = _restoreQ;
              zd.queueWaitSince = Date.now();
              zd.vehiclestatus  = 'Available';
              zd.JobphoneNo = '';
              zd.jobpickup  = '';
              zd.jobdropoff = '';
              zd.jobCount   = 0;
              console.log(`  [UnAssignJobStatusFromJobList] driver ${prevDriverId} → Available q=${_restoreQ} zone="${zd.zonename}"`);
            }
            clearAwayLock(prevDriverId);
            clearDriverHomeState(prevDriverId);
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
        const senderId   = (param('SenderId') || 'Dispatcher').toString().trim();
        const message    = param('Message') || '';
        const dateTime   = param('DateTime') || '';
        const datePart   = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart   = dateTime.substring(11) || '';
        if (message.trim() && receiverId) {
          // Resolve sender name from ZONE_DRIVERS if it's a driver ID (not 'Dispatcher')
          let senderName = 'Dispatcher';
          if (senderId && senderId !== 'Dispatcher') {
            const zdSend = ZONE_DRIVERS.find(d => String(d.driverid) === senderId || String(d.VehicleId) === senderId);
            senderName = (zdSend && zdSend.drivername) || ('Driver ' + senderId);
          }
          const msg = { Id: nextMsgId++, SenderId: senderId, ReceiverId: receiverId, SenderName: senderName, Message: message, Date: datePart, Time: timePart, IsRead: true, companyId: sessionCompanyId || '' };
          messageStore.push(msg);
          console.log(`200: POST ${urlPath} [action=${action}] -> message from ${senderName} to driver #${receiverId}`);
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
          const msg = { Id: nextMsgId++, SenderId: senderId, ReceiverId: 'Dispatcher', SenderName: driver.drivername || ('Driver ' + senderId), Message: message, Date: datePart, Time: timePart, IsRead: false, companyId: sessionCompanyId || '' };
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
          const _bcastDrivers = companyDrivers(ZONE_DRIVERS);
          _bcastDrivers.forEach(d => {
            messageStore.push({ Id: nextMsgId++, SenderId: 0, ReceiverId: d.driverid, SenderName: 'Dispatcher (Broadcast)', Message: message, Date: datePart, Time: timePart, IsRead: true, companyId: sessionCompanyId || '' });
          });
          console.log(`200: POST ${urlPath} [action=${action}] -> broadcast to ${_bcastDrivers.length} drivers`);
        }
        successD(res, 'Broadcast sent successfully');

      } else if (action === '[GroupMessage]') {
        const message   = param('Message') || '';
        const zone      = (param('Zone') || '').toLowerCase();
        const vtype     = (param('VehicleType') || '').toLowerCase();
        const dateTime  = param('DateTime') || '';
        const datePart  = dateTime.substring(0, 10) || new Date().toISOString().substring(0, 10);
        const timePart  = dateTime.substring(11) || '';
        let targets = [...companyDrivers(ZONE_DRIVERS)];
        if (zone) targets = targets.filter(d => d.zonename.toLowerCase().includes(zone));
        if (vtype) targets = targets.filter(d => d.vehicletype.toLowerCase().includes(vtype));
        if (message.trim()) {
          targets.forEach(d => {
            messageStore.push({ Id: nextMsgId++, SenderId: 0, ReceiverId: d.driverid, SenderName: 'Dispatcher (Group)', Message: message, Date: datePart, Time: timePart, IsRead: true, companyId: sessionCompanyId || '' });
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
        // Remove driver from roster — only kick drivers belonging to this company
        const beforeLen = ZONE_DRIVERS.length;
        for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
          const _kd = ZONE_DRIVERS[i];
          if (!sessionCompanyId || !_kd.companyId || _kd.companyId === sessionCompanyId) {
            if (String(_kd.driverid) === driverId || String(_kd.VehicleId) === vehicleId) {
              ZONE_DRIVERS.splice(i, 1);
            }
          }
        }
        console.log(`200: POST ${urlPath} [action=[KickDriver]] -> driver ${driverId} kicked (removed ${beforeLen - ZONE_DRIVERS.length} entries)`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[DispatcherKickUsers]') {
        const driverId  = (param('DriverId')  || '').toString().trim();
        const vehicleId = (param('VehicleId') || '').toString().trim();
        const vehicleIdNum = parseInt(vehicleId) || 0;
        // Try to find full driver record in this company's ZONE_DRIVERS; fall back to request params if not found
        const _suspZd = companyDrivers(ZONE_DRIVERS).find(d =>
          String(d.driverid) === driverId || String(d.VehicleId) === vehicleId ||
          (vehicleIdNum > 0 && (d.driverid === vehicleIdNum || d.VehicleId === vehicleIdNum))
        );
        const _suspUntilRaw = (param('SuspendedUntil') || '').toString().trim();
        const _suspUntil = _suspUntilRaw ? new Date(_suspUntilRaw).toISOString() : null;
        // Always record the suspension — use ZONE_DRIVERS data if found, else use request params
        const _prevIdx = SUSPENDED_DRIVERS.findIndex(s => String(s.driverId) === driverId || String(s.vehicleId) === vehicleId);
        if (_prevIdx !== -1) SUSPENDED_DRIVERS.splice(_prevIdx, 1);
        SUSPENDED_DRIVERS.push({
          driverId:      driverId,
          vehicleId:     vehicleId,
          drivername:    (_suspZd && _suspZd.drivername)    || param('DriverName')    || '',
          vehiclenumber: (_suspZd && _suspZd.vehiclenumber) || param('VehicleNumber') || vehicleId,
          vehicletype:   (_suspZd && _suspZd.vehicletype)   || param('VehicleType')   || '',
          zonename:      (_suspZd && _suspZd.zonename)      || param('ZoneName')      || '',
          suspendedAt:   new Date().toISOString(),
          suspendedUntil: _suspUntil,
          companyId:     sessionCompanyId || '',
        });
        saveSuspendedDrivers();
        const beforeLen2 = ZONE_DRIVERS.length;
        for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
          const d = ZONE_DRIVERS[i];
          if (!sessionCompanyId || !d.companyId || d.companyId === sessionCompanyId) {
            if (String(d.driverid) === driverId || String(d.VehicleId) === vehicleId ||
                (vehicleIdNum > 0 && (d.driverid === vehicleIdNum || d.VehicleId === vehicleIdNum))) {
              ZONE_DRIVERS.splice(i, 1);
            }
          }
        }
        console.log(`200: POST ${urlPath} [action=[DispatcherKickUsers]] -> driver ${driverId}/${vehicleId} suspended (removed ${beforeLen2 - ZONE_DRIVERS.length} entries, suspended list: ${SUSPENDED_DRIVERS.length})`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[GetSuspendedDrivers]') {
        const _mysSuspended = companySuspended(SUSPENDED_DRIVERS);
        console.log(`200: POST ${urlPath} [action=[GetSuspendedDrivers]] -> ${_mysSuspended.length} suspended driver(s) (companyId=${sessionCompanyId})`);
        objectD(res, { dt1: _mysSuspended, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[UnsuspendDriver]') {
        const _unsDrvId  = (param('DriverId')  || '').toString().trim();
        const _unsVehId  = (param('VehicleId') || '').toString().trim();
        const _unsIdx = SUSPENDED_DRIVERS.findIndex(s => String(s.driverId) === _unsDrvId || String(s.vehicleId) === _unsVehId);
        let restored = null;
        if (_unsIdx !== -1) {
          restored = SUSPENDED_DRIVERS[_unsIdx];
          SUSPENDED_DRIVERS.splice(_unsIdx, 1);
          saveSuspendedDrivers();
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

      } else if (action === '[UpdateSuspensionTime]') {
        const _updDrvId  = (param('DriverId')       || '').toString().trim();
        const _updVehId  = (param('VehicleId')      || '').toString().trim();
        const _updUntil  = (param('SuspendedUntil') || '').toString().trim();
        const _updEntry  = SUSPENDED_DRIVERS.find(s => String(s.driverId) === _updDrvId || String(s.vehicleId) === _updVehId);
        if (_updEntry) {
          _updEntry.suspendedUntil = _updUntil ? new Date(_updUntil).toISOString() : null;
          saveSuspendedDrivers();
        }
        console.log(`200: POST ${urlPath} [action=[UpdateSuspensionTime]] -> ${_updEntry ? 'updated ' + _updDrvId + ' until ' + _updEntry.suspendedUntil : 'not found'}`);
        objectD(res, { dt1: _updEntry ? [_updEntry] : [], dt2: [], dt3: [], dt4: [], dt5: [] });

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
          // Accept both numeric IDs (1212) and string IDs ('D001', 'T201') from driver app.
          const _rawDriverId = (param('driverid') || '').toString().trim();
          const incomingDriverId = parseInt(_rawDriverId) > 0 ? parseInt(_rawDriverId) : (_rawDriverId || 0);
          if (newStatus === 'Offered' && currentStatus === 'Offered' && job.DriverId && String(job.DriverId) !== String(incomingDriverId)) {
            console.log(`  [changeriddestatusforoffer/DP] BLOCKED duplicate offer: job #${bookingId} already Offered to driver ${job.DriverId}, ignoring request for driver ${incomingDriverId}`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
            return;
          }
          // Per-driver double-offer guard: block if this driver already has a DIFFERENT job in Offered state
          // that was set very recently (within 1 second — concurrent race window only).
          if (newStatus === 'Offered' && incomingDriverId) {
            const _offerWindow = 1000; // ms — only block truly concurrent duplicate offers
            const _now = Date.now();
            const _existingOffer = jobStore.find(j =>
              j.BookingStatus === 'Offered' &&
              String(j.DriverId) === String(incomingDriverId) &&
              j.Id !== bookingId &&
              j.offeredAt && (_now - j.offeredAt) < _offerWindow
            );
            if (_existingOffer) {
              console.log(`  [changeriddestatusforoffer/DP] BLOCKED per-driver double-offer: driver ${incomingDriverId} already has job #${_existingOffer.Id} Offered (${_now - _existingOffer.offeredAt}ms ago), blocking job #${bookingId}`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
              return;
            }
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
            const _dcZd = ZONE_DRIVERS.find(d => d.driverid === _dcDriverId || d.VehicleId === _dcDriverId);
            let _dcQueueNo = null;
            if (_dcZd) {
              _dcQueueNo = calcRestoredQueue(_dcDriverId, _dcZd.zonename || '');
              _dcZd.vehiclestatus  = 'Available';
              _dcZd.zonequeue      = _dcQueueNo;
              _dcZd.queueWaitSince = Date.now();
            }
            clearAwayLock(_dcDriverId);
            clearDriverHomeState(_dcDriverId);
            if (currentStatus === 'Picking') {
              // Driver cancelled at pickup (arrived, passenger no-show or trip cancelled).
              // Close the job as Cancelled — do NOT return to Pending for re-dispatch.
              job.BookingStatus   = 'Cancelled';
              job.CancelledBy     = 'Driver';
              job.JobCompleteTime = nowNZ() + '.';
              const _dcIdx = jobStore.indexOf(job);
              if (_dcIdx !== -1) jobStore.splice(_dcIdx, 1);
              closedJobStore.push(job);
              saveJobStore();
              saveClosedJobStore();
              console.log(`  [changeriddestatusforoffer/DP] Job #${bookingId} -> Cancelled (driver ${_dcDriverId} cancelled at pickup → Available q=${_dcQueueNo})`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverCancelled: { jobId: bookingId, driverId: _dcDriverId }, newQueueNo: _dcQueueNo });
            } else {
              // Assigned state: driver recalled before arriving — return to Pending for re-dispatch.
              job.BookingStatus = 'Pending';
              job.DriverId      = -2;
              job.VehicleId     = 0;
              job.returnReason  = 'Recalled by Driver';
              delete job.CancelledBy;
              delete job.JobCompleteTime;
              saveJobStore();
              console.log(`  [changeriddestatusforoffer/DP] Job #${bookingId} -> Pending (driver ${_dcDriverId} recalled after accepting → Available q=${_dcQueueNo})`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverRecalled: { jobId: bookingId, driverId: _dcDriverId }, newQueueNo: _dcQueueNo });
            }
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
          { const _ts = nowNZ();
            if (effectiveStatus === 'Offered'  && !job.OfferedAt)  job.OfferedAt  = _ts;
            if (effectiveStatus === 'Assigned' && !job.AcceptedAt) job.AcceptedAt = _ts;
            if (effectiveStatus === 'Picking'  && !job.PickingAt)  job.PickingAt  = _ts; }
          // Track which driver has the current offer so the double-offer guard can compare.
          // Also set DriverId when driver accepts so the job appears correctly in Assigned tab.
          if (effectiveStatus === 'Offered' && incomingDriverId && incomingDriverId !== '0' && incomingDriverId !== 0) {
            job.DriverId = incomingDriverId; job.VehicleId = incomingDriverId;
            job.offeredAt = Date.now(); // stale-offer watchdog uses this
            // Save home zone & queue before the driver is dispatched
            const zdOffer = ZONE_DRIVERS.find(d => d.driverid === incomingDriverId || d.VehicleId === incomingDriverId);
            if (zdOffer) saveDriverHomeState(incomingDriverId, zdOffer);
          }
          if (effectiveStatus === 'Assigned') {
            // incomingDriverId already parsed above (handles both '1212' and 'D001' string IDs)
            if (incomingDriverId && incomingDriverId !== '0' && incomingDriverId !== 0) {
              job.DriverId = incomingDriverId; job.VehicleId = incomingDriverId;
            }
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
        const zoneOnly      = param('zoneOnly') === 'true';
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
        let _dscDriverRecalled  = null; // set when driver recalls (job returned to Pending)
        if (driverId && newStatus) {
          // ── Suspension gate ───────────────────────────────────────────────────
          const _suspCheck = SUSPENDED_DRIVERS.find(s =>
            String(s.driverId) === driverId || String(s.vehicleId) === driverId ||
            (vehiclenumber && (String(s.driverId) === vehiclenumber || String(s.vehicleId) === vehiclenumber))
          );
          if (_suspCheck) {
            const _stillSusp = !_suspCheck.suspendedUntil || new Date(_suspCheck.suspendedUntil).getTime() > Date.now();
            if (_stillSusp) {
              const _untilStr = _suspCheck.suspendedUntil ? new Date(_suspCheck.suspendedUntil).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }) : 'further notice';
              const _suspMsg  = `Your account is suspended until ${_untilStr}. Please contact your dispatcher.`;
              console.log(`  [DriverStatusChanged/DP] BLOCKED — driver ${driverId} is suspended until ${_suspCheck.suspendedUntil || 'further notice'}`);
              objectD(res, { dt1: [{ suspended: true, message: _suspMsg, suspendedUntil: _suspCheck.suspendedUntil || null }], dt2: [], dt3: [], dt4: [], dt5: [] });
              return;
            }
          }
          // ── Logout ──────────────────────────────────────────────────────────
          // Driver app explicitly signed off. Remove from ZONE_DRIVERS so the
          // server no longer offers them jobs. The dispatcher's Firebase listener
          // handles the visual removal on the board side.
          const _logoutStatuses = ['Offline', 'offline', 'LoggedOut', 'loggedout', 'logoff'];
          if (_logoutStatuses.indexOf(newStatus) !== -1) {
            const _beforeLen = ZONE_DRIVERS.length;
            const _kept = ZONE_DRIVERS.filter(d => {
              const sameCompany = !sessionCompanyId || !d.companyId || d.companyId === sessionCompanyId;
              if (!sameCompany) return true; // different company — don't touch
              return String(d.driverid) !== driverId && String(d.VehicleId) !== driverId &&
                (!vehiclenumber || (String(d.driverid) !== vehiclenumber && String(d.VehicleId) !== vehiclenumber));
            });
            ZONE_DRIVERS.length = 0;
            _kept.forEach(d => ZONE_DRIVERS.push(d));
            console.log(`200: POST ${urlPath} [action=[DriverStatusChanged]] -> driver ${driverId} logged out (removed ${_beforeLen - ZONE_DRIVERS.length} from ZONE_DRIVERS)`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });
            return;
          }

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
            if (zdSync) {
              // Save home zone/queue before driver heads off, then mark them Busy/Picking/Assigned
              // so dt6 (VehiclesStatus) always includes them and the ghost sweep never fires.
              saveDriverHomeState(driverId, zdSync);
              zdSync.vehiclestatus = newStatus;
              if (lat) zdSync.lat = lat;
              if (lng) zdSync.lng = lng;
            } else {
              // Driver not in ZONE_DRIVERS — server was restarted during their trip.
              // Add them now so dt6 includes them and the ghost sweep doesn't delete
              // their Firebase presence node (which would show "removed from system").
              const _savedZnDP = getSavedZone(driverId);
              ZONE_DRIVERS.push({
                driverid:      driverId,
                VehicleId:     vehiclenumber || driverId,
                drivername:    drivername    || driverId,
                vehiclenumber: vehiclenumber || driverId,
                vehicletype:   (param('vehicletype') || '').toString().trim() || '',
                zonename:      zonename || (_savedZnDP && _savedZnDP.zonename) || '',
                zoneid:        (_savedZnDP && _savedZnDP.zoneid) || '',
                vehiclestatus: newStatus,
                zonequeue:     0,
                lat:           lat || '',
                lng:           lng || '',
                companyId:     sessionCompanyId || '',
              });
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} re-added to ZONE_DRIVERS as ${newStatus} (post-restart recovery)`);
            }
          }
          const driverJobs = jobStore.filter(matchesDriver);
          // Hail / street pickup: driver went Busy with no pre-booked live job
          if (newStatus === 'Busy') {
            const hasLive = driverJobs.some(j =>
              ['Offered','Pending','Assigned','Picking','Active'].includes(j.BookingStatus)
            );
            if (!hasLive) {
              const hailId = newJobId();
              const now = nowNZ() + '.';
              const pickAddr = (lat && lng) ? `Hail - ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : 'Hail / Street Pickup';
              // Resolve driver name — prefer param, fall back to ZONE_DRIVERS
              const _hailZd = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
              const _hailFullName = drivername || (_hailZd && _hailZd.drivername) || '';
              const _hailParts = _hailFullName.trim().split(/\s+/);
              const _hailNow = nowNZ();
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
                AcceptedAt: _hailNow, ActiveAt: _hailNow,
                JobMins: 0, UserFName: _hailParts[0] || '', UserLName: _hailParts.slice(1).join(' ') || '',
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
          // Pre-compute: if driver has an Active job AND an Assigned job simultaneously,
          // Available = trip completion (not a driver cancel of the Assigned job).
          // This protects a dispatcher-assigned job when driver completes a Hail/street pickup.
          const _hasActiveBeforeAvailable = newStatus === 'Available' &&
            allDriverJobs.some(j => j.BookingStatus === 'Active');
          allDriverJobs.forEach(function(job) {
            const prev = job.BookingStatus;
            // Guard: if job has no driver (orphaned) skip the Assigned transition so
            // we don't re-lock an already-released job into Assigned again.
            const orphaned = !job.DriverId || String(job.DriverId) === '0';
            // Helper: stamp driver name on the job from the drivername param or ZONE_DRIVERS
            function _stampDriverName(j) {
              if (j.UserFName && String(j.UserFName).trim()) return; // already set
              const zdN = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
              const fullName = (zdN && zdN.drivername) ? zdN.drivername : (drivername || '');
              if (fullName) {
                const parts = fullName.trim().split(/\s+/);
                j.UserFName = parts[0] || '';
                j.UserLName = parts.slice(1).join(' ') || '';
              } else {
                if (j.UserFName === undefined) j.UserFName = '';
                if (j.UserLName === undefined) j.UserLName = '';
              }
            }
            if (newStatus === 'Assigned' && !TERM.has(job.BookingStatus) && !orphaned) {
              job.BookingStatus = 'Assigned';
              if (!job.AcceptedAt) job.AcceptedAt = nowNZ();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned`);
            } else if (newStatus === 'Busy' && !activatedOne &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphaned))) {
              // Pending + Busy: driver skipped the Accept step (e.g. Away→Busy after dispatch timeout)
              // but the job's DriverId still matches — activate it so dispatch shows Active.
              job.BookingStatus = 'Active';
              activatedOne = true;
              if (!job.ActiveAt) job.ActiveAt = nowNZ();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Assigned';
              if (!job.PickingAt) job.PickingAt = nowNZ();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned (Picking)`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Trip genuinely finished — mark Completed, move to closedJobStore
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = nowNZ() + '.';
                _stampDriverName(job);
                const _cIdx = jobStore.indexOf(job);
                if (_cIdx !== -1) jobStore.splice(_cIdx, 1);
                closedJobStore.push(job);
                saveJobStore();
                saveClosedJobStore();
                console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Completed`);
              } else if (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking') {
                if (_hasActiveBeforeAvailable) {
                  // Driver completed a Hail/active job — the Assigned job is a SEPARATE
                  // dispatcher-booked job that must not be touched.
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (Assigned) protected — driver completed a different Active job`);
                } else if (isDispatcherRecalled(job.Id)) {
                  // Dispatcher-initiated recall: driver's Available is a side-effect of FnCancelRide.
                  // [changeriddestatusforoffer] will set job to Pending; just leave it or set Pending here.
                  job.BookingStatus = 'Pending';
                  job.DriverId = 0; job.VehicleId = 0;
                  job.returnReason = 'Manually unassigned';
                  clearDispatcherRecalled(job.Id);
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (was ${prev}) -> Pending (dispatcher recall — not a driver cancel)`);
                } else if (zoneOnly) {
                  // GPS zone-only update — status has not actually changed.
                  // Treating this as a recall would incorrectly cancel an active assignment,
                  // so we skip recall/cancel detection entirely.
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (${prev}) zone-only update — skipping recall detection`);
                } else {
                  // Driver went Available while still Assigned/Picking (no other Active job).
                  // This happens when the driver recalls/cancels via the app (status flip, no joback).
                  const _zdRec = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
                  if (_zdRec) {
                    _dscQueueNo = calcRestoredQueue(driverId, _zdRec.zonename || '');
                    _zdRec.vehiclestatus  = 'Available';
                    _zdRec.zonequeue      = _dscQueueNo;
                    _zdRec.queueWaitSince = Date.now();
                  }
                  clearAwayLock(driverId);
                  clearDriverHomeState(driverId);
                  if (prev === 'Picking') {
                    // Driver arrived at pickup then cancelled — close as Cancelled (terminal).
                    job.BookingStatus   = 'Cancelled';
                    job.CancelledBy     = 'Driver';
                    job.JobCompleteTime = nowNZ() + '.';
                    const _cIdxDp = jobStore.indexOf(job);
                    if (_cIdxDp !== -1) jobStore.splice(_cIdxDp, 1);
                    closedJobStore.push(job);
                    saveJobStore();
                    saveClosedJobStore();
                    _dscDriverCancelled = { jobId: job.Id, driverId, drivername, vehiclenumber, newQueueNo: _dscQueueNo };
                    console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (was ${prev}) -> Cancelled (driver cancelled at pickup, q=${_dscQueueNo})`);
                  } else {
                    // Assigned state: driver recalled before arriving — return to Pending for re-dispatch.
                    job.BookingStatus = 'Pending';
                    job.DriverId      = -2;
                    job.VehicleId     = 0;
                    job.returnReason  = 'Recalled by Driver';
                    delete job.CancelledBy;
                    delete job.JobCompleteTime;
                    saveJobStore();
                    _dscDriverRecalled = { jobId: job.Id, driverId, drivername, vehiclenumber, newQueueNo: _dscQueueNo };
                    console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (was ${prev}) -> Pending (driver recalled — returned to queue, q=${_dscQueueNo})`);
                  }
                }
              }
              // Offered/Unreached/Pending: driver going Available — leave as-is
            }
          });
          // When driver goes Available: calculate their new queue position and update ZONE_DRIVERS.
          // If the driver isn't in ZONE_DRIVERS yet (first login), add them so dt6 (VehiclesStatus)
          // can accurately report who is online and detect logouts on the next poll.
          if (newStatus === 'Available') {
            const zdAvail = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
            if (zdAvail) {
              // Apply new zone if client sent one (GPS-detected zone change)
              const incomingZone = zonename || '';
              if (incomingZone && incomingZone !== zdAvail.zonename) {
                console.log(`  [DriverStatusChanged/DP] driver ${driverId} zone change ${zdAvail.zonename} → ${incomingZone}`);
                zdAvail.zonename = incomingZone;
                if (param('zoneid')) zdAvail.zoneid = (param('zoneid') || '').toString().trim();
              }
              const currentZone = zdAvail.zonename || '';
              _dscQueueNo = calcRestoredQueue(driverId, currentZone);
              zdAvail.zonequeue = _dscQueueNo;
              zdAvail.vehiclestatus = 'Available';
              zdAvail.queueWaitSince = Date.now();
              if (lat) zdAvail.lat = lat;
              if (lng) zdAvail.lng = lng;
              if (currentZone) saveZoneAssignment(driverId, currentZone, zdAvail.zoneid || '');
              clearDriverHomeState(driverId); // home state consumed
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} Available → zone="${currentZone}" newQueue=${_dscQueueNo}`);
            } else {
              // First time this driver is seen — add them to ZONE_DRIVERS.
              // Restore last-known zone from disk if the request has no zone info.
              const _savedZn = getSavedZone(driverId);
              const _useZone   = zonename || (_savedZn && _savedZn.zonename) || '';
              const _useZoneId = (param('zoneid') || '').toString().trim() || (_savedZn && _savedZn.zoneid) || '';
              if (_savedZn && !zonename) console.log(`  [DriverStatusChanged/DP] driver ${driverId} zone restored from disk: "${_useZone}"`);
              const maxQ = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
              _dscQueueNo = maxQ + 1;
              ZONE_DRIVERS.push({
                driverid:      driverId,
                VehicleId:     vehiclenumber || driverId,
                drivername:    drivername || driverId,
                vehiclenumber: vehiclenumber || driverId,
                vehicletype:   (param('vehicletype') || '').toString().trim() || '',
                zonename:      _useZone,
                zoneid:        _useZoneId,
                vehiclestatus: 'Available',
                zonequeue:     _dscQueueNo,
                lat:           lat || '',
                lng:           lng || '',
                queueWaitSince: Date.now(),
                companyId:     sessionCompanyId || '',
              });
              console.log(`  [DriverStatusChanged/DP] NEW driver ${driverId} (${vehiclenumber}) added to ZONE_DRIVERS q=${_dscQueueNo} zone="${zonename}"`);
            }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus} (${jobStore.filter(j=>j.BookingStatus==='Active').length} active now)`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dscQueueNo, queueWaitSince: _dscQueueNo ? Date.now() : null, driverCancelled: _dscDriverCancelled || null, driverRecalled: _dscDriverRecalled || null, zoneOnly: zoneOnly || false });

      } else if (action === '[QuickSetNoOne]') {
        // Quick dispatcher action: mark job as "No One" from card dropdown.
        // Releases any currently-assigned driver back to Available at original queue position.
        const _qsnBookingId = parseInt(param('BookingId')) || 0;
        const _qsnJob = jobStore.find(j => j.Id === _qsnBookingId);
        if (_qsnJob) {
          const _qsnActiveSt = new Set(['Pending','Offered','Assigned','Unreached','No One','Reject','']);
          if (_qsnActiveSt.has(_qsnJob.BookingStatus || '')) {
            const _qsnPrevDrv = _qsnJob.DriverId || 0;
            _qsnJob.BookingStatus = 'No One';
            _qsnJob.DriverId  = 0;
            _qsnJob.VehicleId = 0;
            if (_qsnPrevDrv > 0) {
              const _qsnZd = ZONE_DRIVERS.find(d => d.driverid === _qsnPrevDrv || d.VehicleId === _qsnPrevDrv);
              if (_qsnZd) {
                const _qsnQ = calcRestoredQueue(_qsnPrevDrv, _qsnZd.zonename);
                _qsnZd.zonequeue      = _qsnQ;
                _qsnZd.queueWaitSince = Date.now();
                _qsnZd.vehiclestatus  = 'Available';
                _qsnZd.JobphoneNo = '';
                _qsnZd.jobpickup  = '';
                _qsnZd.jobdropoff = '';
                _qsnZd.jobCount   = 0;
                console.log(`  [QuickSetNoOne/DP] driver ${_qsnPrevDrv} → Available q=${_qsnQ} zone="${_qsnZd.zonename}"`);
              }
              clearAwayLock(_qsnPrevDrv);
              clearDriverHomeState(_qsnPrevDrv);
            }
            saveJobStore();
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${_qsnBookingId} set to No One`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[CancelJobStatusFromJobList]') {
        const _cjBookingId = parseInt(param('BookingId')) || 0;
        const _cjIdx = jobStore.findIndex(j => j.Id === _cjBookingId);
        let _cjDriverId = '0';
        if (_cjIdx !== -1) {
          const _cjJob = jobStore[_cjIdx];
          _cjDriverId = String(_cjJob.DriverId || '0');
          if (_cjJob.DriverId && _cjJob.DriverId > 0) {
            const _cjDrvId = _cjJob.DriverId;
            const _cjZd = ZONE_DRIVERS.find(d => d.driverid === _cjDrvId || d.VehicleId === _cjDrvId);
            if (_cjZd) {
              const _cjQ = calcRestoredQueue(_cjDrvId, _cjZd.zonename);
              _cjZd.zonequeue      = _cjQ;
              _cjZd.queueWaitSince = Date.now();
              _cjZd.vehiclestatus  = 'Available';
              _cjZd.JobphoneNo = '';
              _cjZd.jobpickup  = '';
              _cjZd.jobdropoff = '';
              _cjZd.jobCount   = 0;
              console.log(`  [CancelJobStatusFromJobList/DP] driver ${_cjDrvId} → Available q=${_cjQ} zone="${_cjZd.zonename}"`);
            }
            clearAwayLock(_cjDrvId);
            clearDriverHomeState(_cjDrvId);
          }
          _cjJob.BookingStatus = 'Cancelled';
          _cjJob.CancelledBy   = 'Dispatcher';
          _cjJob.JobCompleteTime = nowNZ();
          closedJobStore.push(_cjJob);
          jobStore.splice(_cjIdx, 1);
          saveJobStore();
          saveClosedJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> cancelled job #${_cjBookingId}, driver ${_cjDriverId} -> moved to closedJobStore`);
        arrayD(res, [{ Result: 'Job Cancelled Successfully', DriverId: _cjDriverId }]);

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
        // Use the live TARIFF_STORE (synced from Firebase by the dispatch console).
        const tid = String(param('TariffId') || '');
        let tariff = tid ? TARIFF_STORE.find(t => String(t.Id) === tid) : null;
        if (!tariff) tariff = TARIFF_STORE[0] || { StartPrice: 0, DistanceRate: 0, WaitingRate: 0, MinimumFare: 0, CurrencyName: 'NZD' };
        console.log(`200: POST ${urlPath} [action=${action}] -> tariff id ${tid || 'default'} "${tariff.TariffName}" SP=${tariff.StartPrice} DR=${tariff.DistanceRate}`);
        arrayD(res, [tariff]);

      } else if (action === '[ActiveJobsv3]') {
        const active = companyJobs(jobStore).filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking');
        const activeWithId = active.map(j => ({ ...j, BookingId: j.Id }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${active.length} active companyId=${sessionCompanyId}`);
        arrayD(res, activeWithId);

      // ── Search actions ───────────────────────────────────────────────────────
      // Helper: add UI-friendly aliases so Angular ng-repeat bindings work
      } else if (action === '[SearchById]') {
        const searchId = parseInt(param('Id') || param('id') || '0') || 0;
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results = searchId > 0 ? allJobs.filter(j => j.Id === searchId) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchJobByName]') {
        const searchName = (param('Id') || '').toLowerCase();
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results = searchName ? allJobs.filter(j => (j.Name || '').toLowerCase().includes(searchName)) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByPhoneNo]') {
        const searchPhone = (param('Id') || '').replace(/\s/g, '');
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results = searchPhone ? allJobs.filter(j => (j.PhoneNo || '').replace(/\s/g, '').includes(searchPhone)) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByAfterDate]') {
        const dateStr = param('Id') || '';
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results = dateStr ? allJobs.filter(j => (j.BookingDateTime || '').substring(0, 10) >= dateStr) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchByBeforeDate]') {
        const dateStr = param('Id') || '';
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results = dateStr ? allJobs.filter(j => (j.BookingDateTime || '').substring(0, 10) <= dateStr) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === 'SearchJobDateBetween') {
        const fromStr = param('From') || '';
        const toStr   = param('To') || '';
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
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
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        const job = allJobs.find(j => j.Id === jobId);
        let result = [];
        if (job) {
          const isHail = job.BookingSource === 'Hail' || job.booking_type === 'Hail';
          // Look up tariff name from TARIFF_STORE if we have a TariffId
          const tariffId = String(job.TariffId || '');
          const tariffRec = tariffId ? TARIFF_STORE.find(t => String(t.Id) === tariffId) : null;
          const tariffName = job.TarriffType || (tariffRec ? tariffRec.TariffName : '') || (isHail ? 'Hail' : '');
          // Enrich hail pick/drop for the details popup (same as ClosedJobs table)
          let pickAddr = job.PickAddress || '';
          let dropAddr = job.DropAddress || '';
          if (isHail) {
            if (pickAddr.startsWith('Hail - ')) {
              pickAddr = 'Hail Pickup (' + pickAddr.slice('Hail - '.length).trim() + ')';
            } else if (!pickAddr) {
              pickAddr = 'Hail / Street Pickup';
            }
            if (!dropAddr.trim()) dropAddr = 'Street Pickup (no destination)';
          }
          // The Job Details template uses different field names than the stored job:
          //   ppname      ← Name (passenger name)
          //   AccountId   ← PhoneNo (passenger phone)
          //   newcompelete← JobCompleteTime (shown as "Job Complete Time" in the second occurrence)
          //   TarriffType ← derived above
          //   Passengers  ← TotalPassengers
          //   Bags        ← TotalBags
          //   WheelChairs ← WheelChairs (same name ✓)
          // Look up vehicle info for CallSign and VehicleType
          const zdV = job.VehicleId
            ? ZONE_DRIVERS.find(d => String(d.VehicleId) === String(job.VehicleId) || String(d.vehiclenumber) === String(job.VehicleNo))
            : null;
          const callSign   = job.CallSign   || (zdV ? zdV.vehiclenumber  : '') || job.VehicleNo || '';
          const vehicleType= job.VehicleType|| (zdV ? zdV.vehicletype    : '') || '';
          // Normalize raw driver-app status values to what the UI expects.
          // 'Dispatched' and 'Closed' and 'Done' all mean the trip finished successfully.
          // 'Cancel' is an older spelling of 'Cancelled'.
          const RAW_STATUS = job.BookingStatus || '';
          const STATUS_MAP = { Dispatched: 'Completed', Closed: 'Completed', Done: 'Completed', Cancel: 'Cancelled' };
          const normStatus = STATUS_MAP[RAW_STATUS] || RAW_STATUS;
          result = [{
            ...job,
            bookingidx:    job.Id,
            Route:         '',
            JobMins:       calcJobMins(job.BookingDateTime),
            BookingStatus: normStatus,
            ppname:        job.ppname        || job.Name        || '',
            AccountId:     job.AccountId     || job.PhoneNo     || '',
            newcompelete:  job.newcompelete  || job.JobCompleteTime || '',
            TarriffType:   tariffName,
            Passengers:    job.Passengers    || job.TotalPassengers || '',
            Bags:          job.Bags          || job.TotalBags        || '',
            PickAddress:   pickAddr,
            DropAddress:   dropAddr,
            CallSign:      callSign,
            VehicleType:   vehicleType,
          }];
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${jobId}`);
        arrayD(res, result);

      // ── Messaging read actions ───────────────────────────────────────────────
      } else if (action === '[RetrieveMessages]') {
        const chatList = buildDriverChatList(sessionCompanyId);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${chatList.length} drivers`);
        arrayD(res, chatList);

      } else if (action === '[DispatcherUnReadMessages]') {
        const driverId = (param('Id') || '').toString().trim();
        const unread = companyMessages(messageStore).filter(m => String(m.SenderId) === driverId && !m.IsRead);
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
                const _restoreQ = calcRestoredQueue(prevDriverId, zd.zonename);
                zd.zonequeue      = _restoreQ;
                zd.queueWaitSince = Date.now();
                zd.vehiclestatus  = 'Available';
                zd.JobphoneNo = '';
                zd.jobpickup  = '';
                zd.jobdropoff = '';
                zd.jobCount   = 0;
                console.log(`  [QuickSetNoOne] driver ${prevDriverId} → Available q=${_restoreQ} zone="${zd.zonename}"`);
              }
              clearAwayLock(prevDriverId);
              clearDriverHomeState(prevDriverId);
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
            const _cancelDriverId = job.DriverId;
            const zd = ZONE_DRIVERS.find(d => d.driverid === _cancelDriverId || d.VehicleId === _cancelDriverId);
            if (zd) {
              const _restoreQ = calcRestoredQueue(_cancelDriverId, zd.zonename);
              zd.zonequeue      = _restoreQ;
              zd.queueWaitSince = Date.now();
              zd.vehiclestatus  = 'Available';
              zd.JobphoneNo = '';
              zd.jobpickup  = '';
              zd.jobdropoff = '';
              zd.jobCount   = 0;
              console.log(`  [CancelJobStatusFromJobList] driver ${_cancelDriverId} → Available q=${_restoreQ} zone="${zd.zonename}"`);
            }
            clearAwayLock(_cancelDriverId);
            clearDriverHomeState(_cancelDriverId);
          }
          job.BookingStatus = 'Cancelled';
          job.CancelledBy   = 'Dispatcher';
          job.JobCompleteTime = nowNZ();
          closedJobStore.push(job);
          jobStore.splice(idx, 1);
          saveJobStore();
          saveClosedJobStore();
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
      if (action === '[GetSuspendedDrivers]') {
        console.log(`200: POST ${urlPath} [action=[GetSuspendedDrivers]] -> ${SUSPENDED_DRIVERS.length} suspended driver(s)`);
        objectD(res, { dt1: SUSPENDED_DRIVERS, dt2: [], dt3: [], dt4: [], dt5: [] });
        return;

      } else if (action === 'RetrieveAlarms' || action === 'AllAlarms' || action === 'RetrieveAlarts' || action === 'RetrieveAlerts' || action === 'GetAlarms' || action === 'GetAlerts') {
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
        const _assignedResp = buildAssignedResponse(companyJobs(jobStore));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${_assignedResp.dt1.length} assigned (ids: ${_assignedResp.dt1.map(j=>j.Id).join(',')||'none'}) companyId=${sessionCompanyId}`);
        objectD(res, _assignedResp);

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
          // Orphaned-job watchdog: Assigned status but no driver assigned (DriverId=0/null).
          // These jobs were orphaned mid-session (e.g. page reload while driver was Busy →
          // Available, or a status-update race that set Assigned without a driverId).
          // The startup self-heal catches jobs at boot; this catches runtime orphans so they
          // are re-dispatchable without requiring a server restart.
          if (j.BookingStatus === 'Assigned' && (!j.DriverId || String(j.DriverId) === '0' || String(j.DriverId) === '-1')) {
            console.log(`  [AutoDispatch] orphan watchdog: job #${j.Id} is Assigned with no driver (DriverId=${j.DriverId}) — resetting to Pending`);
            j.BookingStatus = 'Pending';
            j.DriverId      = 0;
            j.VehicleId     = 0;
            j.returnReason  = j.returnReason || 'Recovered (orphaned Assigned)';
            saveJobStore();
          }
        });
        // Return jobs that need auto-dispatch: Pending only, AND within their dispatch window.
        // "No One" jobs are explicitly excluded — dispatcher flagged them as manual-only.
        // Later-tab jobs carry DispatchTimebefore (minutes before pickup to start dispatching).
        // Dispatch window uses Pickingtime (desired pickup time), NOT BookingDateTime (when booked).
        // A job should NOT be offered until:
        //   now  >=  Pickingtime  -  DispatchTimebefore minutes
        // Jobs with DispatchTimebefore == 0 (or missing) are treated as "dispatch immediately".
        const autoJobs = jobStore.filter(j => {
          if (j.BookingStatus !== 'Pending') return false;
          const dispBefore = parseInt(j.DispatchTimebefore || '0') || 0;
          const pickupRef = j.Pickingtime || j.BookingDateTime;
          if (dispBefore > 0 && pickupRef) {
            const pickupMs = new Date(
              pickupRef.replace(/\.$/, '').trim()
            ).getTime();
            if (!isNaN(pickupMs)) {
              const windowOpenMs = pickupMs - dispBefore * 60 * 1000;
              if (Date.now() < windowOpenMs) {
                const minsLeft = Math.round((windowOpenMs - Date.now()) / 60000);
                console.log(`  [AutoDispatch] job #${j.Id} withheld: dispatch window opens in ${minsLeft} min (pickup ${pickupRef})`);
                return false;
              }
            }
          }
          return true;
        });
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
            CompanyName: 'BookaWaka',
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
          dt4: TARIFF_STORE,
          dt5: [{ PublicKey: '' }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> dispatcher settings`);
        objectD(res, settings);

      } else if (action === '[TariffSync]') {
        // The dispatch console pushes the real tariff list from Firebase here.
        // Accepts a JSON array of tariff objects via the 'tariffs' param.
        // Format: [{Id, TariffName, StartPrice, DistanceRate, WaitingRate, MinimumFare, CurrencyName}]
        try {
          const _raw = (param('tariffs') || '').toString().trim();
          const _arr = JSON.parse(_raw);
          if (Array.isArray(_arr) && _arr.length > 0) {
            TARIFF_STORE = _arr;
            saveTariffStore();
            console.log(`200: POST ${urlPath} [action=${action}] -> synced ${_arr.length} tariff(s): ${_arr.map(t => '"' + t.TariffName + '"').join(', ')}`);
            objectD(res, { ok: true, count: _arr.length });
          } else {
            objectD(res, { ok: false, error: 'empty or invalid array' });
          }
        } catch(e) {
          console.log(`[TariffSync] parse error:`, e.message);
          objectD(res, { ok: false, error: e.message });
        }

      } else if (action === '[QueueJob]') {
        const _qBookingId = param('bookingid');
        const _qDriverId  = (param('driverid') || '').toString().trim();
        const _qJob = jobStore.find(j => String(j.Id) === String(_qBookingId));
        if (!_qJob) { objectD(res, { ok: false, msg: 'job not found' }); }
        else if (_qJob.BookingStatus !== 'Offered' && _qJob.BookingStatus !== 'Pending') {
          objectD(res, { ok: false, msg: `cannot queue job with status ${_qJob.BookingStatus}` });
        } else {
          _qJob.BookingStatus = 'Queued';
          _qJob.DriverId = _qDriverId;
          _qJob.queuedAt = Date.now();
          saveJobStore();
          console.log(`[QueueJob] job #${_qBookingId} → Queued for driver ${_qDriverId}`);
          objectD(res, { ok: true });
        }

      } else if (action === '[RecallQueuedJob]') {
        const _rqBookingId = param('bookingid');
        const _rqJob = jobStore.find(j => String(j.Id) === String(_rqBookingId));
        if (!_rqJob) { objectD(res, { ok: false, msg: 'job not found' }); }
        else {
          const _prevSt = _rqJob.BookingStatus;
          _rqJob.BookingStatus = 'Pending';
          _rqJob.DriverId  = null;
          _rqJob.VehicleId = null;
          _rqJob.queuedAt  = null;
          saveJobStore();
          console.log(`[RecallQueuedJob] job #${_rqBookingId} (was ${_prevSt}) → Pending`);
          objectD(res, { ok: true });
        }

      } else if (action === '[PromoteQueuedToAssigned]') {
        // Called when a Busy driver who accepted a pre-queue offer finishes their current
        // trip and goes Available.  Instead of recalling the job back to Pending and
        // sending a second popup offer (which causes the Assigned tab to flicker and
        // forces the driver to accept the same job twice), this endpoint promotes the
        // job directly from Queued → Assigned while keeping DriverId intact.
        const _pqaBookingId = param('bookingid');
        const _pqaJob = jobStore.find(j => String(j.Id) === String(_pqaBookingId));
        if (!_pqaJob) {
          objectD(res, { ok: false, msg: 'job not found' });
        } else if (_pqaJob.BookingStatus !== 'Queued') {
          // Race-condition safety: if the job is no longer Queued (already promoted,
          // recalled, or cancelled by dispatcher), report the current status so the
          // client can decide what to do without corrupting state.
          objectD(res, { ok: false, alreadyStatus: _pqaJob.BookingStatus, driverId: _pqaJob.DriverId });
        } else {
          const _pqaDriverId = _pqaJob.DriverId;
          _pqaJob.BookingStatus = 'Assigned';
          _pqaJob.queuedAt = null;
          saveJobStore();
          console.log(`[PromoteQueuedToAssigned] job #${_pqaBookingId} Queued → Assigned (driver ${_pqaDriverId})`);
          objectD(res, { ok: true, driverId: _pqaDriverId });
        }

      } else if (action === '[GetQueuedJobs]') {
        const _gqJobs = jobStore.filter(j => j.BookingStatus === 'Queued');
        const _gqDt1  = _gqJobs.map(j => ({
          Id:              j.Id,
          BookingId:       j.Id,
          DriverId:        j.DriverId   || '',
          PickAddress:     j.PickAddress  || j.PickLocation  || '',
          DropAddress:     j.DropAddress  || j.DropLocation  || '',
          BookingDateTime: j.BookingDateTime || '',
          UserFName:       j.UserFName   || '',
          UserLName:       j.UserLName   || '',
          VehicleType:     j.VehicleType || '',
          BookingSource:   j.BookingSource || '',
          PhoneNo:         j.PhoneNo     || '',
          queuedAt:        j.queuedAt    || 0,
        }));
        console.log(`[GetQueuedJobs] → ${_gqDt1.length} queued job(s)`);
        objectD(res, { dt1: _gqDt1 });

      } else if (action === 'VehiclesStatus') {
        const _myDrivers = companyDrivers(ZONE_DRIVERS);
        const busyCount  = _myDrivers.filter(d => d.vehiclestatus === 'Busy').length;
        const freeCount  = _myDrivers.filter(d => d.vehiclestatus === 'Available').length;
        const awayCount  = _myDrivers.filter(d => d.vehiclestatus === 'Away').length;
        // dt6: list of currently-online driver IDs so the dispatcher can immediately
        // remove drivers who have logged out via the server path but whose Firebase
        // node hasn't been cleaned up yet (screen-off onDisconnect delay).
        // Authoritative after 90 s warm-up (avoids wiping valid drivers on fresh restart).
        const _serverAgeMs = Date.now() - SERVER_START_TIME;
        // Only send the authoritative online list (dt6) when at least one driver is known
        // to ZONE_DRIVERS AND the server has been up > 90 s.  Both guards are needed:
        //  • The age guard avoids wiping valid drivers on a fresh server restart.
        //  • The length guard avoids wiping drivers who are in Firebase but haven't
        //    sent a [DriverStatusChanged] yet (idle drivers after server restart).
        // The last-driver sign-out case (ZONE_DRIVERS → empty after all leave) is
        // handled by the 30-second child_removed fallback timer in the frontend.
        // dt6 semantics:
        //   Array with entries → server knows these drivers are online; remove any not in list
        //   null              → server has been running > 90 s and confirms NO drivers are online; clear board
        //   []                → server just started (< 90 s warm-up); don't remove anyone yet
        const _onlineIds = _serverAgeMs > 90000
          ? (_myDrivers.length > 0
              ? _myDrivers.map(d => ({
                  id:    String(d.driverid  || ''),
                  vid:   String(d.VehicleId || ''),
                  zone:  d.zonename  || '',
                  zoneq: d.zonequeue || 0,
                }))
              : null)   // confirmed empty — signal client to clear board
          : [];         // warm-up period — don't act yet
        const vehicleStatus = {
          dt1: [{ All: _myDrivers.length }],
          dt2: [{ Busy: busyCount }],
          dt3: [{ Free: freeCount }],
          dt4: [{ Picking: _myDrivers.filter(d => d.vehiclestatus === 'Picking').length }],
          dt5: [{ Away: awayCount }],
          dt6: _onlineIds,
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> ${_myDrivers.length} vehicles (companyId=${sessionCompanyId})`);
        objectD(res, vehicleStatus);

      } else if (action === 'JobsCount') {
        const _TERM = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
        const _allMyJobs   = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        const closedCount  = _allMyJobs.filter(j => _TERM.has(j.BookingStatus)).length;
        const cancelCount  = _allMyJobs.filter(j => j.BookingStatus === 'Cancelled' || j.BookingStatus === 'Cancel').length;
        const noShowCount  = _allMyJobs.filter(j => j.BookingStatus === 'No Show' || j.BookingStatus === 'NoShow').length;
        const jobCounts = {
          dt1: [{ ClosedCount: closedCount }],
          dt2: [{ CancelledCount: cancelCount }],
          dt3: [{ NoShownCount: noShowCount }],
          dt4: [{ AllCount: companyJobs(jobStore).length }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> job counts`);
        objectD(res, jobCounts);

      } else if (action === 'ClosedJobs') {
        const statusFilter = (param('BookingStatus') || '').toLowerCase();
        const fromDate = (param('FromDate') || param('FromDate ') || '').toString().trim();
        const toDate   = (param('ToDate')   || param('ToDate ')   || '').toString().trim();
        const driverFilterRaw  = (param('DriverId')  || '').toString().trim();
        const vehicleFilterRaw = (param('VehicleId') || param('VehicleId ') || '').toString().trim();
        // Support both numeric and string (e.g. "D001") driver/vehicle IDs
        const driverFilter  = parseInt(driverFilterRaw)  || 0;
        const vehicleFilter = parseInt(vehicleFilterRaw) || 0;
        const driverFilterStr  = driverFilterRaw;
        const vehicleFilterStr = vehicleFilterRaw;
        console.log(`  [ClosedJobs] params: status='${statusFilter}' from='${fromDate}' to='${toDate}' driver='${driverFilterRaw}' vehicle='${vehicleFilterRaw}'`);
        // Terminal statuses — include these from the live jobStore as well as the static store
        // 'Completed' is our mock convention; 'Dispatched' is the real-backend convention for done rides.
        // Treat both as closed. When status filter is 'dispatched', also include 'completed'.
        const TERMINAL = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
        const liveTerminal = companyJobs(jobStore).filter(j => TERMINAL.has(j.BookingStatus));
        let jobs = [...companyJobs(closedJobStore), ...liveTerminal];
        console.log(`  [ClosedJobs] before filters: ${jobs.length} jobs (${closedJobStore.length} static + ${liveTerminal.length} live)`);
        if (statusFilter && statusFilter !== 'all') {
          jobs = applyStatusFilter(jobs, statusFilter);
          console.log(`  [ClosedJobs] after status filter '${statusFilter}': ${jobs.length} jobs`);
        }
        if (fromDate) {
          jobs = jobs.filter(j => {
            const ds = (j.JobCompleteTime || j.BookingDateTime || '').replace(/\.$/, '').trim();
            return ds.substring(0, 10) >= fromDate;
          });
          console.log(`  [ClosedJobs] after fromDate '${fromDate}': ${jobs.length} jobs`);
        }
        if (toDate) {
          jobs = jobs.filter(j => {
            const ds = (j.JobCompleteTime || j.BookingDateTime || '').replace(/\.$/, '').trim();
            return ds.substring(0, 10) <= toDate;
          });
          console.log(`  [ClosedJobs] after toDate '${toDate}': ${jobs.length} jobs`);
        }
        if (driverFilterStr) {
          const dfNum = parseInt(driverFilterStr) || 0;
          jobs = jobs.filter(j =>
            String(j.DriverId) === driverFilterStr ||
            (dfNum > 0 && String(j.DriverId) === String(dfNum))
          );
          console.log(`  [ClosedJobs] after driverFilter ${driverFilterStr}: ${jobs.length} jobs`);
        }
        if (vehicleFilterStr) {
          const vfNum = parseInt(vehicleFilterStr) || 0;
          jobs = jobs.filter(j =>
            String(j.VehicleId) === vehicleFilterStr ||
            String(j.VehicleNo)  === vehicleFilterStr ||
            (vfNum > 0 && (String(j.VehicleId) === String(vfNum) || String(j.VehicleNo) === String(vfNum)))
          );
          console.log(`  [ClosedJobs] after vehicleFilter ${vehicleFilterStr}: ${jobs.length} jobs`);
        }
        // Enrich UserFName/UserLName: dispatcher client does `UserFName + UserLName` and
        // shows "undefined" when these fields are missing.  Resolve from ZONE_DRIVERS or
        // fall back to DriverId so the column is always a readable string.
        // Also enrich hail jobs so Pick/Drop columns show meaningful text:
        //   - PickAddress "Hail - lat,lng" → "Hail Pickup (lat, lng)" for readability
        //   - DropAddress "" on hail → "Street Pickup" so the cell is never blank
        jobs = jobs.map(j => {
          const isHail = j.BookingSource === 'Hail' || j.booking_type === 'Hail';
          let pickAddr = j.PickAddress || '';
          let dropAddr = j.DropAddress || '';
          // Reformat coordinate-style pickup to be clearly labelled
          if (isHail && pickAddr.startsWith('Hail - ')) {
            const coords = pickAddr.slice('Hail - '.length).trim();
            pickAddr = 'Hail Pickup (' + coords + ')';
          } else if (isHail && (!pickAddr || pickAddr === 'Hail / Street Pickup')) {
            pickAddr = 'Hail / Street Pickup';
          }
          // Fill blank drop-off for hail jobs
          if (isHail && !dropAddr.trim()) {
            dropAddr = 'Street Pickup (no destination)';
          }
          if (j.UserFName !== undefined && j.UserFName !== null) {
            // UserFName already set — only update address fields if needed
            if (isHail) return { ...j, PickAddress: pickAddr, DropAddress: dropAddr };
            return j;
          }
          const zdN = j.DriverId ? ZONE_DRIVERS.find(d =>
            String(d.driverid) === String(j.DriverId) || String(d.VehicleId) === String(j.DriverId)) : null;
          let fName = '', lName = '';
          if (zdN && zdN.drivername) {
            const parts = zdN.drivername.trim().split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ') || '';
          }
          return { ...j, UserFName: fName, UserLName: lName, PickAddress: pickAddr, DropAddress: dropAddr };
        });
        // Build driver/vehicle lists from the actual job results for the filter dropdowns
        const seenDrivers = new Map(), seenVehicles = new Map();
        jobs.forEach(j => {
          if (j.DriverId && !seenDrivers.has(j.DriverId)) {
            const dname = ((j.UserFName || '') + ' ' + (j.UserLName || '')).trim() || String(j.DriverId);
            seenDrivers.set(j.DriverId, { Id: j.DriverId, DriveName: dname });
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
        // Only treat a job as active if it's in a current working state — not completed/cancelled
        const ACTIVE_STATUSES = new Set(['Offered','Assigned','Active','Picking','Arrived']);
        // Collect ALL jobs for this driver (supports pre-queue: driver may have 2 assigned jobs)
        const driverJobs = jobStore.filter(j => {
          const matchV = String(j.VehicleId) === vehicleIdStr || (vehicleIdNum > 0 && j.VehicleId === vehicleIdNum);
          const matchD = String(j.DriverId)  === vehicleIdStr || (vehicleIdNum > 0 && j.DriverId  === vehicleIdNum);
          return (matchV || matchD) && ACTIVE_STATUSES.has(j.BookingStatus);
        });
        // Primary job (most recent active) for the ActiveBookingId field
        const activeJob = driverJobs.length > 0 ? driverJobs[driverJobs.length - 1] : null;
        // Always return a dt1 record so the client can set lblDriverId / lblBookingHeadId
        // correctly — even if this driver is not yet in ZONE_DRIVERS (e.g. Firebase-only drivers).
        // When not found, use the vehicleIdStr as both DriverId and BookingId so kick/suspend
        // targets exactly the vehicle the dispatcher clicked.
        const dt1 = [{
          DriverId:        zd ? zd.driverid : vehicleIdStr,
          Lat:             '',
          Lng:             '',
          PlayerId:        '',
          VehicleName:     zd ? zd.vehicletype   : '',
          CallSign:        zd ? zd.vehiclenumber  : vehicleIdStr,
          VehicleNo:       zd ? zd.vehiclenumber  : vehicleIdStr,
          BookingId:       vehicleIdStr,
          ActiveBookingId: activeJob ? String(activeJob.Id) : '',
          UserFName:       zd ? (zd.drivername || '').split(' ')[0] : '',
          UserLName:       zd ? (zd.drivername || '').split(' ').slice(1).join(' ') : '',
          VehicleImage:    '',
          JobCount:        driverJobs.length,
        }];
        const dt2 = driverJobs.map(j => ({
          Id:                 j.Id,
          BookingStatus:      j.BookingStatus,
          BookingDateTime:    j.BookingDateTime,
          PassengerId:        j.Name || j.passengername || '',
          PickAddress:        j.PickAddress || '',
          DropAddress:        j.DropAddress || '',
          Passengers:         j.Passengers || 1,
          Bags:               j.Bags || 0,
          WheelChairs:        j.WheelChairs || 0,
          EstimatedDistance:  j.EstimatedDistance || '0',
          EstimatedTime:      j.EstimatedTime || '0',
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> vehicle #${vehicleIdStr} (${zd ? zd.drivername : 'not in roster'}), ${dt2.length} job(s)`);
        objectD(res, { dt1, dt2, dt3: [], dt4: [], dt5: [] });

      } else if (action === 'AutoDispatchVehiclesv2') {
        // Return available drivers in the requested zone
        const zoneId = (param('ZoneId') || '').toString().trim();
        const avail = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Available' && (!zoneId || String(d.zoneid) === zoneId));
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
        let eligible = job && DISPATCHABLE.has(job.BookingStatus) ? [job] : [];
        // For auto-dispatch only (not manual offer): enforce the dispatch-before-time window.
        // If the job's booking time is more than DispatchTimebefore minutes away, it is not
        // yet eligible for auto-dispatch and must be withheld until the window opens.
        if (eligible.length > 0 && action !== 'checkriddestatusforoffer') {
          const _job = eligible[0];
          const _dispBefore = parseInt(_job.DispatchTimebefore || '0') || 0;
          if (_dispBefore > 0 && _job.BookingDateTime) {
            const _bMs = new Date(_job.BookingDateTime.replace(/\.$/, '').trim()).getTime();
            if (!isNaN(_bMs) && Date.now() < _bMs - _dispBefore * 60 * 1000) {
              eligible = []; // window not yet open — block auto-dispatch
              console.log(`  [${action}] Job #${bookingId} withheld: dispatch window opens in ${Math.round((_bMs - _dispBefore*60000 - Date.now())/60000)} min`);
            }
          }
        }
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
            // Driver recalled the job (cancelled after accepting) — return to unassigned queue as Pending
            job.BookingStatus = 'Pending';
            job.DriverId      = -2;
            job.VehicleId     = 0;
            job.returnReason  = 'Recalled by Driver';
            delete job.CancelledBy;
            delete job.JobCompleteTime;
            // Keep in jobStore so the job can be re-dispatched
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
            console.log(`  [changeriddestatusforoffer/DS] Job #${bookingId} -> Pending (driver ${_dcDriverId2} recalled after accepting → Available q=${_dcQueueNo2})`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverRecalled: { jobId: bookingId, driverId: _dcDriverId2 }, newQueueNo: _dcQueueNo2 });
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
          { const _ts2 = nowNZ();
            if (effectiveStatus2 === 'Offered'  && !job.OfferedAt)  job.OfferedAt  = _ts2;
            if (effectiveStatus2 === 'Assigned' && !job.AcceptedAt) job.AcceptedAt = _ts2;
            if (effectiveStatus2 === 'Picking'  && !job.PickingAt)  job.PickingAt  = _ts2; }
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
        const zoneOnlyDS    = param('zoneOnly') === 'true';
        const TERMINAL = new Set(['Dispatched','Done','Cancel','Cancelled','Closed','Completed','No Show','NoShow','Reject']);
        function matchesDriverDS(j) {
          const vid = vehiclenumber;
          return String(j.DriverId) === driverId || String(j.VehicleId) === driverId ||
                 (vid && (String(j.VehicleNo) === vid || String(j.VehicleId) === vid || String(j.DriverId) === vid));
        }
        let _dssQueueNo = null;
        let _dssDriverCancelled = null;
        let _dssDriverRecalled  = null;
        if (driverId && newStatus) {
          // ── Suspension gate ───────────────────────────────────────────────────
          const _suspCheckDS = SUSPENDED_DRIVERS.find(s =>
            String(s.driverId) === driverId || String(s.vehicleId) === driverId ||
            (vehiclenumber && (String(s.driverId) === vehiclenumber || String(s.vehicleId) === vehiclenumber))
          );
          if (_suspCheckDS) {
            const _stillSuspDS = !_suspCheckDS.suspendedUntil || new Date(_suspCheckDS.suspendedUntil).getTime() > Date.now();
            if (_stillSuspDS) {
              const _untilStrDS = _suspCheckDS.suspendedUntil ? new Date(_suspCheckDS.suspendedUntil).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' }) : 'further notice';
              const _suspMsgDS  = `Your account is suspended until ${_untilStrDS}. Please contact your dispatcher.`;
              console.log(`  [DriverStatusChanged/DS] BLOCKED — driver ${driverId} is suspended until ${_suspCheckDS.suspendedUntil || 'further notice'}`);
              objectD(res, { dt1: [{ suspended: true, message: _suspMsgDS, suspendedUntil: _suspCheckDS.suspendedUntil || null }], dt2: [], dt3: [], dt4: [], dt5: [] });
              return;
            }
          }
          // ── Logout ──────────────────────────────────────────────────────────
          const _logoutStatusesDS = ['Offline', 'offline', 'LoggedOut', 'loggedout', 'logoff'];
          if (_logoutStatusesDS.indexOf(newStatus) !== -1) {
            const _beforeLenDS = ZONE_DRIVERS.length;
            const _keptDS = ZONE_DRIVERS.filter(d => {
              // Only remove entries belonging to this company (by companyId match or if no company set on either side)
              const sameCompany = !sessionCompanyId || !d.companyId || d.companyId === sessionCompanyId;
              if (!sameCompany) return true; // keep — different company
              return String(d.driverid) !== driverId && String(d.VehicleId) !== driverId &&
                (!vehiclenumber || (String(d.driverid) !== vehiclenumber && String(d.VehicleId) !== vehiclenumber));
            });
            ZONE_DRIVERS.length = 0;
            _keptDS.forEach(d => ZONE_DRIVERS.push(d));
            console.log(`200: POST ${urlPath} [action=[DriverStatusChanged]] -> driver ${driverId} logged out (DS path, removed ${_beforeLenDS - ZONE_DRIVERS.length} from ZONE_DRIVERS)`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });
            return;
          }

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
            if (zdSyncDS) {
              saveDriverHomeState(driverId, zdSyncDS);
              zdSyncDS.vehiclestatus = newStatus;
              if (lat) zdSyncDS.lat = lat;
              if (lng) zdSyncDS.lng = lng;
            } else {
              // Driver not in ZONE_DRIVERS — server restarted during their trip.
              // Add them now so dt6 always includes them and ghost sweep never fires.
              const _savedZnDS = getSavedZone(driverId);
              ZONE_DRIVERS.push({
                driverid:      driverId,
                VehicleId:     vehiclenumber || driverId,
                drivername:    drivername    || driverId,
                vehiclenumber: vehiclenumber || driverId,
                vehicletype:   (param('vehicletype') || '').toString().trim() || '',
                zonename:      zonenameDS || (_savedZnDS && _savedZnDS.zonename) || '',
                zoneid:        (_savedZnDS && _savedZnDS.zoneid) || '',
                vehiclestatus: newStatus,
                zonequeue:     0,
                lat:           lat || '',
                lng:           lng || '',
              });
              console.log(`  [DriverStatusChanged/DS] driver ${driverId} re-added to ZONE_DRIVERS as ${newStatus} (post-restart recovery)`);
            }
          }
          const driverJobs = jobStore.filter(matchesDriverDS);
          // Hail / street pickup: driver went Busy with no pre-booked live job
          if (newStatus === 'Busy') {
            const hasLive = driverJobs.some(j =>
              ['Offered','Pending','Assigned','Picking','Active'].includes(j.BookingStatus)
            );
            if (!hasLive) {
              const hailId = newJobId();
              const now = nowNZ() + '.';
              const pickAddr = (lat && lng) ? `Hail - ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : 'Hail / Street Pickup';
              // Resolve driver name — prefer param, fall back to ZONE_DRIVERS
              const _hailZdDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
              const _hailFullNameDS = drivername || (_hailZdDS && _hailZdDS.drivername) || '';
              const _hailPartsDS = _hailFullNameDS.trim().split(/\s+/);
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
                JobMins: 0, UserFName: _hailPartsDS[0] || '', UserLName: _hailPartsDS.slice(1).join(' ') || '',
                Route: '', bookingidx: hailId,
              });
              saveJobStore();
              console.log(`  [DriverStatusChanged/DS] Hail job #${hailId} for driver ${driverId} (${vehiclenumber}) at ${pickAddr}`);
            }
          }
          const allDriverJobs = jobStore.filter(matchesDriverDS);
          let activatedOneDS = false;
          // Protect Assigned jobs when driver completes a simultaneous Active (Hail) job.
          const _hasActiveBeforeAvailableDS = newStatus === 'Available' &&
            allDriverJobs.some(j => j.BookingStatus === 'Active');
          // Helper: stamp driver name onto a job using param or ZONE_DRIVERS fallback
          function _stampDriverNameDS(j) {
            if (j.UserFName && String(j.UserFName).trim()) return;
            const zdNameDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
            const fullNameDS = (zdNameDS && zdNameDS.drivername) ? zdNameDS.drivername : (drivername || '');
            const pDS = fullNameDS.trim().split(/\s+/);
            j.UserFName = pDS[0] || '';
            j.UserLName = pDS.slice(1).join(' ') || '';
          }
          allDriverJobs.forEach(function(job) {
            const prev = job.BookingStatus;
            const orphanedDS = !job.DriverId || String(job.DriverId) === '0';
            if (newStatus === 'Assigned' && !TERMINAL.has(job.BookingStatus) && !orphanedDS) {
              job.BookingStatus = 'Assigned';
              if (!job.AcceptedAt) job.AcceptedAt = nowNZ();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Assigned`);
            } else if (newStatus === 'Busy' && !activatedOneDS &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphanedDS))) {
              job.BookingStatus = 'Active';
              activatedOneDS = true;
              if (!job.ActiveAt) job.ActiveAt = nowNZ();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Assigned';
              if (!job.PickingAt) job.PickingAt = nowNZ();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Assigned (Picking)`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Trip genuinely finished — mark Completed, move to closedJobStore
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = nowNZ() + '.';
                _stampDriverNameDS(job);
                const _cIdxDS = jobStore.indexOf(job);
                if (_cIdxDS !== -1) jobStore.splice(_cIdxDS, 1);
                closedJobStore.push(job);
                saveJobStore();
                saveClosedJobStore();
                console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Completed`);
              } else if (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking') {
                if (_hasActiveBeforeAvailableDS) {
                  // Driver completed a Hail/active job — the Assigned job is a separate
                  // dispatcher-booked trip that must not be cancelled.
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (Assigned) protected — driver completed a different Active job`);
                } else if (isDispatcherRecalled(job.Id)) {
                  job.BookingStatus = 'Pending';
                  job.DriverId = 0; job.VehicleId = 0;
                  job.returnReason = 'Manually unassigned';
                  clearDispatcherRecalled(job.Id);
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Pending (dispatcher recall — not a driver cancel)`);
                } else if (zoneOnlyDS) {
                  // GPS zone-only update — status has not actually changed.
                  // Treating this as a recall would incorrectly cancel an active assignment,
                  // so we skip recall/cancel detection entirely.
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (${prev}) zone-only update — skipping recall detection`);
                } else {
                  // Driver went Available while still Assigned/Picking (no other Active job).
                  // This happens when the driver recalls/cancels via the app (status flip, no joback).
                  const _zdRecDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
                  if (_zdRecDS) {
                    _dssQueueNo = calcRestoredQueue(driverId, _zdRecDS.zonename || '');
                    _zdRecDS.vehiclestatus  = 'Available';
                    _zdRecDS.zonequeue      = _dssQueueNo;
                    _zdRecDS.queueWaitSince = Date.now();
                  }
                  clearAwayLock(driverId);
                  clearDriverHomeState(driverId);
                  if (prev === 'Picking') {
                    // Driver arrived at pickup then cancelled — close as Cancelled (terminal).
                    job.BookingStatus   = 'Cancelled';
                    job.CancelledBy     = 'Driver';
                    job.JobCompleteTime = nowNZ() + '.';
                    const _cIdxDs = jobStore.indexOf(job);
                    if (_cIdxDs !== -1) jobStore.splice(_cIdxDs, 1);
                    closedJobStore.push(job);
                    saveJobStore();
                    saveClosedJobStore();
                    _dssDriverCancelled = { jobId: job.Id, driverId, drivername, vehiclenumber, newQueueNo: _dssQueueNo };
                    console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Cancelled (driver cancelled at pickup, q=${_dssQueueNo})`);
                  } else {
                    // Assigned state: driver recalled before arriving — return to Pending for re-dispatch.
                    job.BookingStatus = 'Pending';
                    job.DriverId      = -2;
                    job.VehicleId     = 0;
                    job.returnReason  = 'Recalled by Driver';
                    delete job.CancelledBy;
                    delete job.JobCompleteTime;
                    saveJobStore();
                    _dssDriverRecalled = { jobId: job.Id, driverId, drivername, vehiclenumber, newQueueNo: _dssQueueNo };
                    console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Pending (driver recalled — returned to queue, q=${_dssQueueNo})`);
                  }
                }
              }
              // Offered/Unreached/Pending: driver going Available — leave job as-is
            }
          });
          // When driver goes Available: calculate their new queue position.
          // If the driver isn't in ZONE_DRIVERS yet (first login), add them so dt6 is accurate.
          if (newStatus === 'Available') {
            const zdAvailDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
            if (zdAvailDS) {
              // Apply new zone if client sent one (GPS-detected zone change)
              const incomingZoneDS = zonenameDS || '';
              if (incomingZoneDS && incomingZoneDS !== zdAvailDS.zonename) {
                console.log(`  [DriverStatusChanged/DS] driver ${driverId} zone change ${zdAvailDS.zonename} → ${incomingZoneDS}`);
                zdAvailDS.zonename = incomingZoneDS;
                if (param('zoneid')) zdAvailDS.zoneid = (param('zoneid') || '').toString().trim();
              }
              const currentZoneDS = zdAvailDS.zonename || '';
              _dssQueueNo = calcRestoredQueue(driverId, currentZoneDS);
              zdAvailDS.zonequeue = _dssQueueNo;
              zdAvailDS.vehiclestatus = 'Available';
              zdAvailDS.queueWaitSince = Date.now();
              if (lat) zdAvailDS.lat = lat;
              if (lng) zdAvailDS.lng = lng;
              if (currentZoneDS) saveZoneAssignment(driverId, currentZoneDS, zdAvailDS.zoneid || '');
              clearDriverHomeState(driverId);
              console.log(`  [DriverStatusChanged/DS] driver ${driverId} Available → zone="${currentZoneDS}" newQueue=${_dssQueueNo}`);
            } else {
              // First time this driver is seen — add them to ZONE_DRIVERS.
              // Restore last-known zone from disk if the request has no zone info.
              const _savedZnDS = getSavedZone(driverId);
              const _useZoneDS   = zonenameDS || (_savedZnDS && _savedZnDS.zonename) || '';
              const _useZoneIdDS = (param('zoneid') || '').toString().trim() || (_savedZnDS && _savedZnDS.zoneid) || '';
              if (_savedZnDS && !zonenameDS) console.log(`  [DriverStatusChanged/DS] driver ${driverId} zone restored from disk: "${_useZoneDS}"`);
              const maxQDS = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
              _dssQueueNo = maxQDS + 1;
              ZONE_DRIVERS.push({
                driverid:      driverId,
                VehicleId:     vehiclenumber || driverId,
                drivername:    drivername || driverId,
                vehiclenumber: vehiclenumber || driverId,
                vehicletype:   (param('vehicletype') || '').toString().trim() || '',
                zonename:      _useZoneDS,
                zoneid:        _useZoneIdDS,
                vehiclestatus: 'Available',
                zonequeue:     _dssQueueNo,
                lat:           lat || '',
                lng:           lng || '',
                queueWaitSince: Date.now(),
              });
              if (_useZoneDS) saveZoneAssignment(driverId, _useZoneDS, _useZoneIdDS);
              console.log(`  [DriverStatusChanged/DS] NEW driver ${driverId} (${vehiclenumber}) added to ZONE_DRIVERS q=${_dssQueueNo} zone="${_useZoneDS}"`);
            }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dssQueueNo, queueWaitSince: _dssQueueNo ? Date.now() : null, driverCancelled: _dssDriverCancelled || null, driverRecalled: _dssDriverRecalled || null, zoneOnly: zoneOnlyDS || false });

      } else if (action === '[UnAssignedJobsv3]') {
        const _cJobs = companyJobs(jobStore);
        const resp = buildJobListResponse(_cJobs);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${_cJobs.length} jobs (${resp.dt4[0].UnAssignedCount} unassigned) companyId=${sessionCompanyId}`);
        objectD(res, resp);

      } else if (action === '[deviUnAssignedJobsv2]') {
        const resp = buildDeliveryResponse(companyJobs(jobStore));
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

      } else if (action === '[SearchJobByName]') {
        const searchName = (param('Id') || '').toLowerCase();
        const allJobs = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results = searchName ? allJobs.filter(j => (j.Name || '').toLowerCase().includes(searchName)) : allJobs;
        results = applyStatusFilter(results, param('JobStatus'));
        results = sortByRecent(results.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results.length} results`);
        arrayD(res, results);

      } else if (action === '[SearchById]') {
        const searchId2 = parseInt(param('Id') || param('id') || '0') || 0;
        const allJobs2 = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results2 = searchId2 > 0 ? allJobs2.filter(j => j.Id === searchId2) : allJobs2;
        results2 = applyStatusFilter(results2, param('JobStatus'));
        results2 = sortByRecent(results2.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results2.length} results`);
        arrayD(res, results2);

      } else if (action === '[SearchByPhoneNo]') {
        const searchPhone = (param('Id') || '').toLowerCase();
        const allJobs3 = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results3 = searchPhone ? allJobs3.filter(j => (j.PhoneNo || j.Phone || '').toLowerCase().includes(searchPhone)) : allJobs3;
        results3 = applyStatusFilter(results3, param('JobStatus'));
        results3 = sortByRecent(results3.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results3.length} results`);
        arrayD(res, results3);

      } else if (action === '[SearchByDate]' || action === '[SearchByDateFrom]' || action === '[SearchByDateRange]') {
        const dateFrom = (param('DateFrom') || param('dateFrom') || param('Id') || '').trim();
        const dateTo   = (param('DateTo')   || param('dateTo')   || '').trim();
        const allJobs4 = [...companyJobs(jobStore), ...companyJobs(closedJobStore)];
        let results4 = allJobs4.filter(j => {
          const jd = (j.BookingDateTime || '').slice(0, 10);
          if (dateFrom && dateTo) return jd >= dateFrom && jd <= dateTo;
          if (dateFrom) return jd >= dateFrom;
          return true;
        });
        results4 = applyStatusFilter(results4, param('JobStatus'));
        results4 = sortByRecent(results4.map(enrichSearchResult));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${results4.length} results`);
        arrayD(res, results4);

      } else {
        // Default: return live job list from in-memory store
        const allJobs = buildJobListResponse(companyJobs(jobStore));
        console.log(`200: POST ${urlPath} [action=${action || 'default'}] -> ${companyJobs(jobStore).length} jobs companyId=${sessionCompanyId}`);
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
      // Look up the real companyId from the registration store by email so that
      // tenants who exist only in our store (no real backend record) can log in.
      const ALLOWED_LOGIN = ['trial', 'active', 'grace'];
      const mockReg = registrationStore.find(r =>
        r.email && r.email.toLowerCase() === username.toLowerCase() &&
        r.companyId && ALLOWED_LOGIN.includes(r.status)
      );
      const mockCid = mockReg ? Number(mockReg.companyId) : 1216;
      console.log(`200: POST ${urlPath} [LoginSelector] -> mock session for "${username}" companyId=${mockCid}`);
      arrayD(res, [{
        Id: 1051,
        UserFName: (mockReg && mockReg.name) ? mockReg.name.split(' ')[0] : username.split('@')[0] || 'Dispatcher',
        UserLName:  (mockReg && mockReg.name) ? (mockReg.name.split(' ')[1] || '') : '',
        UserEmail: username,
        CompanyId: mockCid,
        Country: (mockReg && mockReg.country) || 'NZ',
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

    // ── Account / access request ─────────────────────────────────────────────
    if (urlPath.includes('/DispatcherLogin.aspx/AccountRequest')) {
      let reqBody = {};
      try { reqBody = JSON.parse(body); } catch (e) {}
      const reqCompany = (reqBody.company        || '').trim();
      const reqName    = (reqBody.name           || '').trim();
      const reqEmail   = (reqBody.email          || '').trim().toLowerCase();
      const reqPhone   = (reqBody.phone          || '').trim();
      const reqPass    = (reqBody.password       || '').trim();
      const reqBizNum  = (reqBody.businessNumber || '').trim();
      const reqFleet   = (reqBody.fleetSize      || '').trim();
      const reqArea    = (reqBody.area           || '').trim();
      const reqCountry = (reqBody.country        || 'NZ').trim();

      if (!reqCompany || !reqName || !reqEmail) {
        jsonReply(res, { error: 'Company name, your name and email are all required.' });
        return;
      }
      if (!/\S+@\S+\.\S+/.test(reqEmail)) {
        jsonReply(res, { error: 'Please provide a valid email address.' });
        return;
      }
      if (registrationStore.some(r => r.email === reqEmail && r.status !== 'rejected')) {
        jsonReply(res, { error: 'An account request with this email already exists. Our team will be in touch.' });
        return;
      }

      const newReg = {
        id:             'REG-' + Date.now(),
        status:         'pending',
        submittedAt:    Date.now(),
        company:        reqCompany,
        name:           reqName,
        email:          reqEmail,
        phone:          reqPhone,
        passwordHash:   reqPass,
        businessNumber: reqBizNum,
        fleetSize:      reqFleet,
        area:           reqArea,
        country:        reqCountry,
        companyId:      null,
        ownerUid:       null,  // set below after Firebase Auth creation
        approvedAt:     null,
        trialStart:     null,
        trialEnd:       null,
        graceEnd:       null,
        rejectedAt:     null,
        rejectedReason: null,
      };
      registrationStore.push(newReg);
      saveRegistrations();
      console.log(`200: POST ${urlPath} -> new registration request [${newReg.id}] from "${reqEmail}" (${reqCompany})`);

      // Create Firebase Auth account immediately so the UID is already known when the
      // super admin approves. Best-effort — registration succeeds even if Firebase fails.
      try {
        const { uid } = await firebaseCreateUser(reqEmail, reqPass);
        newReg.ownerUid = uid;
        saveRegistrations();
        console.log(`[registration] Firebase Auth created for ${reqEmail}: uid=${uid}`);
      } catch(fbRegErr) {
        console.log(`[registration] Firebase Auth creation note for ${reqEmail}: ${fbRegErr.message}`);
      }

      jsonReply(res, { ok: true, message: 'Request received. Our team will review and contact you within 1 business day.' });
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
    console.error(`Port ${PORT} is in use. Freeing port and retrying...`);
    const { execSync } = require('child_process');
    // Kill only the process holding the port — NOT the current process.
    // pkill -f "node server.js" would self-terminate; fuser targets the port holder.
    try { execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`); } catch (e) {}
    setTimeout(() => {
      server.listen(PORT, HOST, () => console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`));
    }, 1500);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
