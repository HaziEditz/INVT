// ─── Timezone standards (BookaWaka multi-tenant) ──────────────────────────────
// Rule: Store timestamps as UTC ISO  →  new Date().toISOString()
// Rule: "today's date"              →  _tzTodayStr(tz)         (en-CA locale = YYYY-MM-DD)
// Rule: "midnight"                  →  _tzTodayStart(tz)
// Rule: display a time              →  _tzDisplay(ts, tz)
//
// Per-company IANA timezone map.  Add new companies here as they onboard.
const companyTZMap = {
  '620611': 'Pacific/Auckland',   // BookaWaka NZ (default tenant)
};
function getCompanyTZ(cid) {
  return (cid && companyTZMap[String(cid)]) || 'Pacific/Auckland';
}
// "YYYY-MM-DD" in the company's local timezone — use this everywhere "today's date" matters.
function _tzTodayStr(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'Pacific/Auckland' });
}
// Date object for midnight (start of today) in the company's timezone.
// Uses Intl-based offset so it is correct even when the server runs in UTC.
function _tzTodayStart(tz) {
  const tzStr = tz || 'Pacific/Auckland';
  const today = _tzTodayStr(tzStr);          // "YYYY-MM-DD" in tz
  // Probe: what local date/time does "today 00:00 UTC" appear as in tz?
  const probeUTC = new Date(today + 'T00:00:00Z');
  // toLocaleString with 'sv' locale returns "YYYY-MM-DD HH:MM:SS" (ISO-like, no ambiguity)
  const localAtProbe = probeUTC.toLocaleString('sv', { timeZone: tzStr });
  // Treat that local string as a UTC ms value so we can compute the diff
  const localAtProbeMs = new Date(localAtProbe.replace(' ', 'T') + 'Z').getTime();
  // offsetMs = (UTC ms) - (local ms when treated as UTC) = UTC-local offset in ms
  const offsetMs = probeUTC.getTime() - localAtProbeMs;
  // Midnight in tz = local midnight (treated as UTC) + offset
  const localMidnightMs = new Date(today + 'T00:00:00Z').getTime();
  return new Date(localMidnightMs + offsetMs);
}
// Format a stored UTC ISO timestamp for display in the company's timezone.
function _tzDisplay(ts, tz) {
  if (!ts && ts !== 0) return '';
  const d = new Date(typeof ts === 'number' ? ts : String(ts).replace(/\.$/, '').trim());
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-NZ', { timeZone: tz || 'Pacific/Auckland' });
}
// LEGACY display helper — kept for backwards compat (display only, not for storage).
// For new code use _tzDisplay(ts, getCompanyTZ(cid)) instead.
function nowNZ() {
  return new Date().toLocaleString('sv', { timeZone: 'Pacific/Auckland' }).replace('T', ' ').slice(0, 19);
}

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException — keeping alive:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection — keeping alive:', reason && reason.message ? reason.message : String(reason));
});

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Stripe = require('stripe');

// Stripe initialised lazily so missing key only errors on first charge attempt
function getStripe() {
  const sk = process.env.STRIPE_SECRET_KEY || '';
  if (!sk) throw new Error('STRIPE_SECRET_KEY not configured');
  return Stripe(sk);
}
const STRIPE_PK = process.env.STRIPE_PUBLISHABLE_KEY || '';

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
const ACC_MANAGERS_FILE         = path.join(DATA_DIR, 'acc_managers.json');
const ACC_CLIENTS_FILE          = path.join(DATA_DIR, 'acc_clients.json');
const ACC_APPROVALS_FILE        = path.join(DATA_DIR, 'acc_approvals.json');
const BUSINESS_ACCOUNTS_FILE    = path.join(DATA_DIR, 'business_accounts.json');
const PASSENGERS_FILE           = path.join(DATA_DIR, 'passengers.json');
const STRIPE_PAYMENTS_FILE      = path.join(DATA_DIR, 'stripe_payments.json');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }

// ─── Registration / account request store ────────────────────────────────────
// status: pending | approved | rejected | trial | active | grace | deactivated
// plan:   free_trial | starter | pro
// serviceType: taxi | restaurant | freight | all
let registrationStore = [];
try {
  if (fs.existsSync(REGISTRATIONS_FILE)) {
    registrationStore = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf8')) || [];
    console.log(`[persist] loaded ${registrationStore.length} registration request(s) from disk`);
  }
} catch(e) { console.log('[persist] registrations load error:', e.message); }

// ── ACC & Business Account stores ──────────────────────────────────────────
let accManagerStore   = [];
let accClientStore    = [];
let accApprovalStore  = [];
let businessAccStore  = [];
let passengerStore    = [];
let accNextMgrId  = 1;
let accNextCliId  = 1;
let accNextAppId  = 1;
let baccNextId    = 1;
let pasNextId     = 1;
function loadJsonStore(file, arr, label) {
  try { if (fs.existsSync(file)) { const d = JSON.parse(fs.readFileSync(file,'utf8')); if(Array.isArray(d)){arr.push(...d);} console.log('[persist] loaded '+arr.length+' '+label); } } catch(e) { console.log('[persist] '+label+' load error:',e.message); }
}
function saveJsonStore(file, arr) { try { fs.writeFileSync(file, JSON.stringify(arr, null, 2)); } catch(e) { console.error('[persist] saveJsonStore error writing', file + ':', e.message); } }
loadJsonStore(ACC_MANAGERS_FILE,  accManagerStore,  'ACC manager(s)');
loadJsonStore(ACC_CLIENTS_FILE,   accClientStore,   'ACC client(s)');
loadJsonStore(ACC_APPROVALS_FILE, accApprovalStore, 'ACC approval(s)');
loadJsonStore(BUSINESS_ACCOUNTS_FILE, businessAccStore, 'business account(s)');
loadJsonStore(PASSENGERS_FILE,    passengerStore,   'passenger(s)');

// ── Stripe payment record store ───────────────────────────────────────────────
// Persists every [InsertPassengerBalance] call so SA can audit charges server-side.
// Schema: { id, companyId, phone, amount, chargeId, paidAt, method }
let stripePaymentStore = [];
let stripePayNextId = 1;
loadJsonStore(STRIPE_PAYMENTS_FILE, stripePaymentStore, 'Stripe payment(s)');
if (stripePaymentStore.length) stripePayNextId = Math.max(...stripePaymentStore.map(r => r.id || 0)) + 1;
if (accManagerStore.length)  accNextMgrId  = Math.max(...accManagerStore.map(r=>r.id||0))  + 1;
if (accClientStore.length)   accNextCliId  = Math.max(...accClientStore.map(r=>r.id||0))   + 1;
if (accApprovalStore.length) accNextAppId  = Math.max(...accApprovalStore.map(r=>r.id||0)) + 1;
if (businessAccStore.length) baccNextId    = Math.max(...businessAccStore.map(r=>r.id||0)) + 1;
if (passengerStore.length)   pasNextId     = Math.max(...passengerStore.map(r=>r.id||0))   + 1;

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
      if (r.ownerUid && r.companyId && r._rawPassword) {
        firebaseSignIn(r.email, r._rawPassword)
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

// Server-side Firebase anonymous auth — used for polling pendingjobs when
// BW_FIREBASE_SECRET is not set. Rules require auth != null; anonymous satisfies this.
let _fbServerToken    = null;
let _fbServerTokenExp = 0;
async function getFirebaseServerToken() {
  if (process.env.BW_FIREBASE_SECRET) return process.env.BW_FIREBASE_SECRET;
  if (_fbServerToken && Date.now() < _fbServerTokenExp - 120000) return _fbServerToken;
  try {
    const r = await fbRequest(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_API_KEY}`,
      'POST', { returnSecureToken: true }
    );
    if (r.status === 200 && r.body && r.body.idToken) {
      _fbServerToken    = r.body.idToken;
      _fbServerTokenExp = Date.now() + (parseInt(r.body.expiresIn || '3600')) * 1000;
      console.log('[firebase] server anonymous auth OK (token expires in ' + r.body.expiresIn + 's)');
      return _fbServerToken;
    }
    console.log('[firebase] anonymous auth failed:', r.body);
  } catch(e) {
    console.log('[firebase] anonymous auth error:', e.message);
  }
  return null;
}

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

async function firebaseDbPatch(path, value, idToken) {
  const r = await fbRequest(
    `${FB_DB_URL}/${path}.json?auth=${fbAuthToken(idToken)}`,
    'PATCH', value
  );
  if (r.status !== 200) throw new Error(`Firebase DB patch failed: ${JSON.stringify(r.body)}`);
  return r.body;
}

async function firebaseDbGet(path, idToken) {
  const r = await fbRequest(
    `${FB_DB_URL}/${path}.json?auth=${fbAuthToken(idToken)}`,
    'GET', null
  );
  if (r.status !== 200) throw new Error(`Firebase DB read failed: ${JSON.stringify(r.body)}`);
  return r.body;
}

async function firebaseDbPush(path, value, idToken) {
  const r = await fbRequest(
    `${FB_DB_URL}/${path}.json?auth=${fbAuthToken(idToken)}`,
    'POST', value
  );
  if (r.status !== 200) throw new Error(`Firebase DB push failed: ${JSON.stringify(r.body)}`);
  return r.body; // { name: "-Os7EhxblNgbMg2B0D6G" }
}

// ── Firebase cleanup on terminal job state ─────────────────────────────────
// When a job reaches a terminal state (Completed / Cancelled / Closed) we MUST
// clear every Firebase path that could resurrect it, otherwise:
//   - stale /pendingjobs/{cid}/{bookingId} entries with Status='Assigned' get
//     re-ingested by the dispatcher console on reload
//   - stale /jobs/{cid}/{vehId}/{drvId} entries trigger the offer watchdog,
//     which resets the job back to Pending with returnReason="No Response …",
//     and auto-dispatch immediately re-offers it (= the resurrection bug)
//   - the driver app keeps the trip card visible because online/{cid}/{vehId}/current
//     still has jobpickup/jobdropoff populated
//
// Called from every site that pushes a job into closedJobStore — covers ALL
// booking sources (Dispatch console, Website, Passenger app, Rental, ACC,
// Business Account) and ALL payment types (Cash, Card, Account, TM, Stripe).
async function _bwClearJobFromFirebase(cid, bookingId, vehId, drvId, finalStatus) {
  try {
    if (!cid || !bookingId) return;
    const _cid     = String(cid);
    const _bId     = String(bookingId);
    const _vId     = vehId ? String(vehId).trim() : '';
    const _dId     = drvId ? String(drvId).trim() : '';
    const _final   = (finalStatus === 'Cancelled') ? 'Cancelled' : 'Completed';
    const _tag     = `[FBcleanup #${_bId}]`;
    const tok = await getFirebaseServerToken();
    if (!tok) { console.warn(`${_tag} no firebase token — skipped`); return; }
    const auth = encodeURIComponent(tok);
    const nowIso = new Date().toISOString();
    const stamp  = (_final === 'Cancelled')
      ? { cancelledAt: nowIso }
      : { completedAt: nowIso };

    const tasks = [];

    // 1. /pendingjobs/{cid}/{bookingId} — PATCH to terminal status (kept for
    //    SA portal + passenger-app trip history). [IngestPassengerJob] only
    //    re-creates from Scheduled/Waiting/Pending so this prevents resurrection.
    tasks.push(
      fbRequest(`${FB_DB_URL}/pendingjobs/${_cid}/${_bId}.json?auth=${auth}`,
        'PATCH', Object.assign({ Status: _final, BookingStatus: _final }, stamp))
        .then(r => console.log(`${_tag} pendingjobs/${_cid}/${_bId} → ${_final} [${r.status}]`))
        .catch(e => console.warn(`${_tag} pendingjobs PATCH failed: ${e && e.message}`))
    );

    // 2. /jobs/{cid}/{vehId}/{drvId} — DELETE acceptance/offer listener path.
    //    This is the path the offer watchdog reads; without removal it can
    //    reset the job to Pending and auto-dispatch will re-offer it.
    if (_vId && _dId) {
      tasks.push(
        fbRequest(`${FB_DB_URL}/jobs/${_cid}/${_vId}/${_dId}.json?auth=${auth}`, 'DELETE', null)
          .then(r => console.log(`${_tag} jobs/${_cid}/${_vId}/${_dId} deleted [${r.status}]`))
          .catch(e => console.warn(`${_tag} jobs DELETE failed: ${e && e.message}`))
      );
    }

    // 3. /joback/{bookingId} — DELETE offer-back ack node (driver app offer screen).
    tasks.push(
      fbRequest(`${FB_DB_URL}/joback/${_bId}.json?auth=${auth}`, 'DELETE', null)
        .then(r => console.log(`${_tag} joback/${_bId} deleted [${r.status}]`))
        .catch(e => console.warn(`${_tag} joback DELETE failed: ${e && e.message}`))
    );

    // 4. /notification/{drvId} — DELETE only if it still references THIS booking
    //    (driver may have a newer notification for a different job).
    if (_dId) {
      tasks.push((async () => {
        try {
          const g = await fbRequest(`${FB_DB_URL}/notification/${_dId}.json?auth=${auth}`, 'GET', null);
          const n = g.body || {};
          const refId = String(n.BookingId || n.bookingId || n.jobId || n._jobId || n.Id || '');
          if (refId && refId === _bId) {
            const d = await fbRequest(`${FB_DB_URL}/notification/${_dId}.json?auth=${auth}`, 'DELETE', null);
            console.log(`${_tag} notification/${_dId} deleted [${d.status}]`);
          } else if (refId) {
            console.log(`${_tag} notification/${_dId} kept (refs job #${refId}, not #${_bId})`);
          }
        } catch(e) { console.warn(`${_tag} notification check failed: ${e && e.message}`); }
      })());
    }

    // 5. /online/{cid}/{vehId}/current — PATCH-clear job fields ONLY if currently
    //    pointing at this booking. Driver stays online.
    if (_vId) {
      tasks.push((async () => {
        try {
          const g = await fbRequest(`${FB_DB_URL}/online/${_cid}/${_vId}/current.json?auth=${auth}`, 'GET', null);
          const c = g.body || {};
          const cur = String(c.currentJobId || c.jobId || c.joboffer || '');
          if (cur && cur === _bId) {
            await fbRequest(`${FB_DB_URL}/online/${_cid}/${_vId}/current.json?auth=${auth}`,
              'PATCH', { currentJobId: null, jobId: null, joboffer: 0,
                         jobpickup: '', jobdropoff: '', JobphoneNo: '', jobname: '' });
            console.log(`${_tag} online/${_cid}/${_vId}/current cleared`);
          }
        } catch(e) { console.warn(`${_tag} online clear failed: ${e && e.message}`); }
      })());
    }

    // 6. /rideStatus/{cid}/{bookingId} — PATCH terminal status for any consumers.
    tasks.push(
      fbRequest(`${FB_DB_URL}/rideStatus/${_cid}/${_bId}.json?auth=${auth}`,
        'PATCH', Object.assign({ status: _final }, stamp))
        .then(r => console.log(`${_tag} rideStatus/${_cid}/${_bId} → ${_final} [${r.status}]`))
        .catch(e => console.warn(`${_tag} rideStatus PATCH failed: ${e && e.message}`))
    );

    await Promise.allSettled(tasks);
    console.log(`${_tag} cleanup complete (${_final})`);
  } catch(e) {
    console.warn(`[FBcleanup #${bookingId}] cleanup failed: ${e && e.message}`);
  }
}

// ─── In-memory job store ──────────────────────────────────────────────────────
// Legacy booking ID format: DDMMYYYY + 3-digit daily sequence → e.g. 18042026001
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

// Central job ID format: {last3OfCompanyId}{YY}{MM}{DD}{seq}
// e.g. company 620611 → prefix "611"; 1 May 2026, job 1 → "6112605011" (10 digits)
// Sequence is per-company per-day, resets at midnight, no zero-padding.
const _companyJobSeq = {}; // key: "611-260501" → count
function newCompanyJobId(companyId) {
  const _cidRaw = String(companyId || '').trim();
  // Guard: companyId must be purely numeric (e.g. "620611").
  // A company name like "Auckland Cabs" → slice(-3) = "abs" → parseInt("abs...") = NaN,
  // producing a broken job ID that fails downstream /^\d{9,}$/ checks in syncOfflineTrip
  // and leaves j.Id === NaN in the store — completely broken.
  if (!_cidRaw || !/^\d+$/.test(_cidRaw)) {
    const _cidErr = new Error(
      `newCompanyJobId: companyId must be a non-empty numeric string — received: "${_cidRaw}". ` +
      `Pass the numeric company ID (e.g. "620611"), not the company name.`
    );
    console.error('[newCompanyJobId] INVALID companyId:', _cidErr.message);
    throw _cidErr;
  }
  const prefix = _cidRaw.slice(-3);
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seqKey = `${prefix}-${yy}${mm}${dd}`;
  _companyJobSeq[seqKey] = (_companyJobSeq[seqKey] || 0) + 1;
  const seq = _companyJobSeq[seqKey];
  return parseInt(`${prefix}${yy}${mm}${dd}${seq}`, 10); // always a number so j.Id === parseInt(...) comparisons work
}

// Valid booking sources accepted by POST /api/job/create
const BOOKING_SOURCES = new Set(['dispatch', 'hail', 'passenger', 'web', 'food', 'freight']);

// ─── In-memory message store ──────────────────────────────────────────────────
let nextMsgId = 100;
const messageStore = [];

function buildDriverChatList(cid) {
  const drivers = cid ? ZONE_DRIVERS.filter(d => !d.companyId || d.companyId === cid) : ZONE_DRIVERS;
  const msgs    = cid ? messageStore.filter(m => !m.companyId || m.companyId === cid)  : messageStore;
  // Deduplicate: same vehiclenumber OR same drivername means the same physical
  // driver appeared twice in ZONE_DRIVERS (e.g. once from the driver app's
  // [DriverStatusChanged] call and once from the Firebase child_added listener).
  const seenVehicle = new Set();
  const seenName    = new Set();
  const unique = [];
  drivers.forEach(d => {
    const vkey  = String(d.vehiclenumber || d.VehicleId || '').toLowerCase();
    const nkey  = String(d.drivername || '').trim().toLowerCase();
    if (vkey && seenVehicle.has(vkey)) return;
    if (nkey && seenName.has(nkey))    return;
    if (vkey) seenVehicle.add(vkey);
    if (nkey) seenName.add(nkey);
    unique.push(d);
  });
  return unique.map(d => {
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

// Safely convert a BookingDateTime/JobCompleteTime value to a string suitable
// for passing to new Date(). Handles ISO strings, numeric timestamps, and nulls.
function _toDateStr(v) {
  if (!v && v !== 0) return '';
  if (typeof v === 'number') return new Date(v).toISOString();
  return String(v).replace(/\.$/, '').trim();
}

// Parse a "YYYY-MM-DD HH:mm:ss" string that is in the company's LOCAL timezone and
// return the equivalent UTC millisecond timestamp.  Required because the dispatcher
// browser runs in NZ, constructs a local-time string, and sends it as-is — the server
// (running UTC) must not parse it naively as UTC or every time will be 12 hours wrong.
function _parseLocalDT(dtStr, companyId) {
  if (!dtStr) return null;
  const tz = getCompanyTZ(companyId);
  const clean = String(dtStr).replace(/\.$/, '').trim();
  // Already has timezone info — parse directly.
  if (/Z$|[+-]\d{2}:\d{2}$/.test(clean)) return new Date(clean).getTime();
  // Naive parse treats string as UTC.
  const naiveMs = new Date(clean.replace(' ', 'T') + 'Z').getTime();
  if (isNaN(naiveMs)) return null;
  // Find the UTC offset at this naive moment in the company's timezone.
  // toLocaleString with 'sv' gives "YYYY-MM-DD HH:MM:SS" (ISO-like, no ambiguity).
  const localStr = new Date(naiveMs).toLocaleString('sv', { timeZone: tz });
  const localMs  = new Date(localStr.replace(' ', 'T') + 'Z').getTime();
  // offsetMs > 0 for UTC+ zones (e.g. NZ = +12h = +43200000)
  const offsetMs = localMs - naiveMs;
  // Real UTC = the local time value minus the zone offset
  return naiveMs - offsetMs;
}

// Calculate minutes from now until the job's pickup time.
// Accepts either a job object (preferred — uses ScheduledFor when available for
// accurate UTC arithmetic) or a raw BookingDateTime string (legacy).
function calcJobMins(jobOrStr) {
  let ms;
  if (jobOrStr && typeof jobOrStr === 'object') {
    const sf = jobOrStr.ScheduledFor;
    if (sf) {
      // Pre-booked jobs: ScheduledFor is always UTC ms — use directly.
      ms = typeof sf === 'number' ? sf : new Date(_toDateStr(sf)).getTime();
    } else if (typeof jobOrStr.createdAt === 'number' && jobOrStr.createdAt > 0) {
      // Book-now jobs: createdAt (Date.now() at creation) is always UTC ms and
      // is unambiguous.  BookingDateTime is a naive "YYYY-MM-DD HH:mm:ss" string
      // whose timezone is ambiguous — the server TZ=Pacific/Auckland makes
      // new Date("2026-05-07 10:25:00") parse as NZ local = UTC−12h, turning a
      // just-created job into "722m overdue".  Prefer createdAt here.
      ms = jobOrStr.createdAt;
    } else {
      // Fallback for legacy jobs without createdAt (e.g. old closed-job records,
      // Firebase-ingested passenger jobs).  ISO strings with 'Z' parse correctly;
      // naive strings are accepted as NZ local time (correct for ASP.NET backend jobs).
      ms = new Date(_toDateStr(jobOrStr.BookingDateTime || '')).getTime();
    }
  } else {
    ms = new Date(_toDateStr(String(jobOrStr || ''))).getTime();
  }
  return Math.round((ms - Date.now()) / 60000);
}

// Sort jobs newest-first: prefer JobCompleteTime (for closed jobs), then BookingDateTime.
function sortByRecent(jobs) {
  return [...jobs].sort((a, b) => {
    const ta = new Date(_toDateStr(a.JobCompleteTime || a.BookingDateTime || '')).getTime() || 0;
    const tb = new Date(_toDateStr(b.JobCompleteTime || b.BookingDateTime || '')).getTime() || 0;
    return tb - ta;
  });
}

// Add UI-friendly field aliases to a job object so Angular ng-repeat bindings work
// (template uses BookingDate, BookingTime, PassengerId, TarriffType, bookingidx)
function enrichSearchResult(j) {
  const rawDT = _toDateStr(j.BookingDateTime || '');
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

// Format a Date object as the "YYYY-MM-DD HH:MM:SS." string the client expects.
// Uses the Intl API (toLocaleString 'sv') so the result is always in NZ local time
// regardless of whether process.env.TZ was successfully applied by the runtime.
function fmtDT(dt) {
  const nz = dt.toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
  return nz.substring(0, 16).replace('T', ' ') + ':00.';
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

// Sync _companyJobSeq from saved jobs so new IDs don't collide after restart.
// New ID format: {last3OfCompanyId}{YY}{MM}{DD}{seq} — e.g. 6112605011
(function syncCompanyJobSeq() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`; // e.g. "260501"
  jobStore.forEach(j => {
    const idStr = String(j.Id || '');
    // Must be exactly 9+ chars and contain today's datePart at positions 3-8
    if (idStr.length >= 9 && idStr.slice(3, 9) === datePart) {
      const prefix = idStr.slice(0, 3);
      const seq = parseInt(idStr.slice(9), 10);
      const key = `${prefix}-${datePart}`;
      if (!isNaN(seq) && seq > (_companyJobSeq[key] || 0)) {
        _companyJobSeq[key] = seq;
      }
    }
  });
})();

// Self-heal: remove duplicate job IDs (keep the most-recent duplicate by index).
(function healDuplicateIds() {
  const seen = new Map();
  const toRemove = [];
  jobStore.forEach((j, i) => {
    const key = String(j.Id);
    if (seen.has(key)) toRemove.push(seen.get(key)); // keep last occurrence
    seen.set(key, i);
  });
  if (toRemove.length > 0) {
    toRemove.sort((a, b) => b - a).forEach(i => jobStore.splice(i, 1));
    try { fs.writeFileSync(JOB_STORE_FILE, JSON.stringify(jobStore, null, 2)); } catch(e) {}
    console.log(`[self-heal] removed ${toRemove.length} duplicate job(s) from store`);
  }
})();

// Self-heal: coerce any string Id fields to numbers.
// Job IDs like "6112605021" were stored as strings in an earlier version; all lookup
// code uses parseInt so the comparison always failed. Convert once on load.
(function healStringIds() {
  let fixed = 0;
  jobStore.forEach(j => {
    if (typeof j.Id === 'string') {
      const n = parseInt(j.Id, 10);
      if (!isNaN(n)) { j.Id = n; fixed++; }
    }
  });
  if (fixed > 0) {
    try { fs.writeFileSync(JOB_STORE_FILE, JSON.stringify(jobStore, null, 2)); } catch(e) {}
    console.log(`[self-heal] coerced ${fixed} job Id(s) from string → number`);
  }
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
  // BUG13 — cap closed job store to prevent unbounded disk/memory growth.
  // Keeps the most-recent CLOSED_JOB_CAP records globally; oldest are trimmed.
  const CLOSED_JOB_CAP = 2000;
  if (closedJobStore.length > CLOSED_JOB_CAP) {
    const trimmed = closedJobStore.length - CLOSED_JOB_CAP;
    closedJobStore.splice(0, trimmed);
    console.log(`[persist] closedjobstore trimmed ${trimmed} oldest record(s) → ${closedJobStore.length} remaining`);
  }
  fs.writeFile(CLOSED_JOB_STORE_FILE, JSON.stringify(closedJobStore, null, 2), (err) => {
    if (err) console.log('[persist] closedjobstore save error:', err.message);
  });
}

// ─── Rental completion patch ──────────────────────────────────────────────────
// Patches rentalTaxiRequests/{key} to status:'completed' when any completion path
// fires for a rental-sourced job. Retries once after 4 s so a transient network
// hiccup doesn't leave the SA portal permanently stuck at status:'confirmed'.
function _patchRentalComplete(job) {
  const _rKey = job && job.rentalRequestId;
  if (!_rKey) return;
  const _rId         = job.Id;
  const _completedAt = (job.JobCompleteTime || new Date().toISOString()).replace(/\.$/, '');
  function _doRentalPatch(attempt) {
    getFirebaseServerToken().then(token => {
      if (!token) {
        console.error('[rental-complete] Firebase patch failed after retry — no auth token',
          { rentalKey: _rKey, jobId: _rId, completedAt: _completedAt, attempt });
        return;
      }
      firebaseDbPatch(`rentalTaxiRequests/${_rKey}`,
        { status: 'completed', completedAt: _completedAt, jobId: _rId }, token
      ).then(() => {
        console.log(`  [rental] rentalTaxiRequests/${_rKey} → completed (job #${_rId})`);
      }).catch(err => {
        if (attempt === 1) {
          console.warn(`  [rental] completion patch attempt 1 failed for ${_rKey} — retrying in 4 s:`, err && err.message);
          setTimeout(() => _doRentalPatch(2), 4000);
        } else {
          console.error('[rental-complete] Firebase patch failed after retry',
            { rentalKey: _rKey, jobId: _rId, completedAt: _completedAt, error: err && err.message });
        }
      });
    });
  }
  _doRentalPatch(1);
}

// ─── Firebase rentalTaxiRequests polling (Ride-to-Rental) ────────────────────
// Polls rentalTaxiRequests for status="pending" entries written by the SA Portal
// when a customer books a rental car and wants a taxi to the pickup depot.
// On each match: creates a standard Pending job in jobStore (visible in U-A tab),
// then stamps Firebase with jobId + status="dispatching" to avoid double-ingestion.
async function pollRentalTaxiRequests() {
  try {
    const token = await getFirebaseServerToken();
    if (!token) return;
    const r = await fbRequest(
      `${FB_DB_URL}/rentalTaxiRequests.json?orderBy="status"&equalTo="pending"&auth=${encodeURIComponent(token)}`,
      'GET', null
    );
    if (r.status !== 200 || !r.body || typeof r.body !== 'object') return;
    for (const [key, data] of Object.entries(r.body)) {
      // Idempotency: skip if already in live or closed job store
      if (jobStore.some(j => j.rentalRequestId === key)) continue;
      if (closedJobStore.some(j => j.rentalRequestId === key)) continue;

      // Normalise scheduledAt to the server's datetime string format (NZ local time).
      let scheduledAt = data.scheduledAt;
      if (typeof scheduledAt === 'number') {
        scheduledAt = fmtDT(new Date(scheduledAt));
      } else {
        scheduledAt = scheduledAt ? String(scheduledAt) : fmtDT(new Date());
      }

      const promoNote = data.promoCode
        ? `[Rental] Promo: ${data.promoCode} (${data.discountPercent || 0}% off). `
        : '[Rental] Ride-to-Rental. ';

      const newId = newJobId();
      const newJob = {
        Id: newId,
        AccountId: '', VehicleNo: null, CallSign: null,
        useremail: null, usertype: null, webstatus: '0',
        Name: data.customerName || 'Rental Customer',
        PhoneNo: data.customerPhone || '',
        passengername: data.customerName || '',
        BookingDateTime: scheduledAt,
        Pickingtime: scheduledAt,
        Recieve_payment: '', DispatchTimebefore: '0',
        VehicleId: 0, DriverId: 0,
        DispatcherName: 'System (Rental)',
        Nextstop: '0', nextstopdata: '',
        Passengers: 1,
        PickLatLng: '0,0', DropLatLng: '0,0',
        Bags: 0, WheelChairs: 0, VehiclesReguired: 1,
        Acc_job_id: '', Account_id: '', Acc_claim_id: '',
        PickAddress: data.pickup || '',
        DropAddress: data.destination || '',
        EntitiesDetails: '', U_id: null,
        BookingSource: 'Rental',
        BookingStatus: 'Pending',
        VehicleType: '', serviceType: 'taxi',
        Urgent: 'No', CornerAddress: '',
        Notes: promoNote,
        DispatchNotes: promoNote,
        EstimatedDistance: '0', EstimatedTime: '0',
        TarriffType: 'Automatic',
        companyId: data.companyId || data.CompanyId || String(data.companyid || '') || '',
        rentalRequestId: key,    // link back to Firebase for status sync
        promoCode: data.promoCode || '',
        discountPercent: data.discountPercent || 0,
      };
      jobStore.push(newJob);
      saveJobStore();
      console.log(`[rental] ingested rentalTaxiRequests/${key} → job #${newId} pickup="${data.pickup}"`);

      // Stamp Firebase so SA Portal knows it's been picked up and won't re-trigger
      firebaseDbPatch(`rentalTaxiRequests/${key}`, { jobId: newId, status: 'dispatching' }, token)
        .catch(e => console.log(`[rental] Firebase stamp failed for ${key}:`, e.message));
    }
  } catch(e) {
    console.log('[rental] polling error:', e.message);
  }
}
setInterval(pollRentalTaxiRequests, 30000);
pollRentalTaxiRequests(); // run immediately on startup

// ─── Firebase pendingjobs polling ────────────────────────────────────────────
// Polls pendingjobs/{companyId} for passenger-app bookings (Waiting/Cancelled).
// Scheduled bookings now ingest directly as Pending — no separate holding store.

// ── Dispatch lead-time estimation ──────────────────────────────────────────
// Matches the client-side updateDispatchSuggestion formula exactly:
//   3 min per km, minimum 5 min, snapped to the assign_notice select options.
// Used at ingest time for Scheduled (pre-booked) jobs so DispatchTimebefore
// is set to a sensible value without waiting for a dispatcher to edit the job.

// Haversine great-circle distance in km (same as client distance() with unit='K')
function _haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Company base / depot location — used as the "from" point for distance estimation.
// Checks the registration record for baseLat/baseLng (SA portal can set these).
// Falls back to known NZ city defaults, then Auckland.
// SA portal should write baseLat / baseLng to the registration record to improve accuracy.
function _companyBaseLocation(companyId) {
  const reg = registrationStore.find(r => String(r.companyId) === String(companyId));
  if (reg && reg.baseLat && reg.baseLng) return { lat: Number(reg.baseLat), lng: Number(reg.baseLng) };
  const knownCenters = {
    '620611': { lat: -46.4127, lng: 168.3538 }, // Invercargill city center
    // Add more companyId → lat/lng as new companies register
  };
  return knownCenters[String(companyId)] || { lat: -36.8485, lng: 174.7633 }; // Auckland fallback
}

// Estimate dispatch lead time in minutes from company base to pickup coordinates.
// Returns a value snapped to the options available in the #assign_notice select:
//   [0, 5, 10, 15, 20, 30, 45, 60, 75, 90, 120]
function _estimateDispatchLeadMins(companyId, pickLat, pickLng) {
  if (!pickLat || !pickLng || pickLat === 0 || pickLng === 0) return 30; // no GPS — safe default
  const base      = _companyBaseLocation(companyId);
  const dist      = _haversineKm(base.lat, base.lng, pickLat, pickLng);
  const rawMins   = Math.max(5, Math.ceil(dist * 3)); // 3 min/km, min 5 min
  const opts      = [0, 5, 10, 15, 20, 30, 45, 60, 75, 90, 120];
  return opts.reduce((p, c) => Math.abs(c - rawMins) < Math.abs(p - rawMins) ? c : p);
}
// ── End dispatch lead-time estimation ──────────────────────────────────────

// Normalise a Firebase passenger-app job object to server internal field names.
// Firebase uses PickupAddress/PickupLat/PickupLng and DropoffAddress/DropoffLat/DropoffLng
// (both CamelCase and camelCase variants).
function _normFbJob(job) {
  // Nested location objects written by web booking portal and passenger app:
  //   pickupLocation: { lat, lng, address }  /  dropoffLocation: { lat, lng, address }
  const _pLoc = job.pickupLocation  || job.PickupLocation  || {};
  const _dLoc = job.dropoffLocation || job.DropoffLocation || {};
  const pickLat = job.PickupLat  || job.pickupLat  || job.PickLat  || job.pickLat  || _pLoc.lat  || 0;
  const pickLng = job.PickupLng  || job.pickupLng  || job.PickLng  || job.pickLng  || _pLoc.lng  || 0;
  const dropLat = job.DropoffLat || job.dropoffLat || job.DropLat  || job.dropLat  || _dLoc.lat  || 0;
  const dropLng = job.DropoffLng || job.dropoffLng || job.DropLng  || job.dropLng  || _dLoc.lng  || 0;
  // Normalise serviceType: passenger app may send 'taxi','food','freight','tm'
  const _rawSvc = (job.serviceType || job.ServiceType || job.bookingType || job.BookingType || '').toLowerCase().trim();
  const _svcMap = { taxi:'taxi', food:'food', freight:'freight', tm:'tm', delivery:'freight', restaurant:'food' };
  const serviceType = _svcMap[_rawSvc] || (_rawSvc || 'taxi');
  return {
    name:        job.PassengerName  || job.passengerName  || job.name || '',
    phone:       job.PhoneNo        || job.phoneNo        || job.phone || '',
    pickAddress: job.PickupAddress  || job.pickupAddress  || job.PickAddress  || job.pickAddress  || '',
    pickLatLng:  job.pickLatLng || job.PickLatLng
                   ? (job.pickLatLng || job.PickLatLng)
                   : (pickLat && pickLng ? `${pickLat},${pickLng}` : '0,0'),
    dropAddress: job.DropoffAddress || job.dropoffAddress || job.DropAddress  || job.dropAddress  || '',
    dropLatLng:  job.dropLatLng || job.DropLatLng
                   ? (job.dropLatLng || job.DropLatLng)
                   : (dropLat && dropLng ? `${dropLat},${dropLng}` : '0,0'),
    vehicleType:    job.VehicleType    || job.vehicleType    || '',
    paymentMethod:  job.PaymentMethod  || job.paymentMethod  || 'cash',
    estimatedFare:  parseFloat(job.EstimatedFare || job.estimatedFare || 0),
    notes:       job.notes || job.Notes || '',
    passengers:  parseInt(job.passengers || job.Passengers || '1') || 1,
    createdAt:   (function() {
      const raw = job.createdAt || job.CreatedAt || '';
      if (!raw) return '';
      if (typeof raw === 'number') return new Date(raw).toISOString();
      return String(raw);
    })(),
    // ScheduledFor from web portal is an ISO string ("2026-05-07T02:00:00.000Z").
    // parseInt() of an ISO string extracts only the year (2026) — wrong.
    // Fix: prefer ScheduledForMs (Unix ms already written by web portal), then
    //      parse ISO string with new Date(), then fall back to parseInt for legacy numeric strings.
    scheduledFor: (function() {
      const ms = job.ScheduledForMs || job.scheduledForMs;
      if (ms && typeof ms === 'number') return ms;
      const raw = job.ScheduledFor || job.scheduledFor || 0;
      if (!raw) return 0;
      if (typeof raw === 'number') return raw;
      const parsed = new Date(raw).getTime();
      return isNaN(parsed) ? (parseInt(raw) || 0) : parsed;
    })(),
    scheduledAt:  job.ScheduledAt || '',
    serviceType,
    bookingType: job.bookingType || job.BookingType || '',
    // Total Mobility fields — passenger app writes tmVoucherNumbers (array);
    // normalise to tmVoucherNo (string) so dispatcher display + driver offer both work.
    paymentStatus:     (job.paymentStatus || job.PaymentStatus || '').toLowerCase(),
    paymentType:       job.paymentType       || job.PaymentType       || '',
    tmVoucherNo:       Array.isArray(job.tmVoucherNumbers) ? (job.tmVoucherNumbers[0] || '')
                         : (job.tmVoucherNumbers || job.tmVoucherNo || job.TmVoucherNo || ''),
    tmPassengerName:   job.tmPassengerName   || job.TmPassengerName   || '',
    tmCardExpiry:      job.tmCardExpiry      || job.TmCardExpiry      || '',
    tmSubsidy:         job.tmSubsidy         != null ? Number(job.tmSubsidy)         : (job.TmSubsidy         != null ? Number(job.TmSubsidy)         : null),
    tmSubsidyHoist:    job.tmSubsidyHoist    != null ? Number(job.tmSubsidyHoist)    : (job.TmSubsidyHoist    != null ? Number(job.TmSubsidyHoist)    : null),
    tmPassengerPays:   job.tmPassengerPays   != null ? Number(job.tmPassengerPays)   : (job.TmPassengerPays   != null ? Number(job.TmPassengerPays)   : null),
    tmHoistRequired:   !!(job.tmHoistRequired   || job.TmHoistRequired),
    tmHoistCount:      parseInt(job.tmHoistCount || job.TmHoistCount || 0) || 0,
    tmPaymentMethod:   job.tmPaymentMethod   || job.TmPaymentMethod   || '',
    councilId:         job.councilId         || job.CouncilId         || '',
  };
}


// Live drivers come from Firebase (driverdatarealx/{companyId} or online/{companyId}).
// This array is kept as an empty structure so dependent code paths don't crash.
const ZONE_DRIVERS = [];

// Used by VehiclesStatus to skip driver-ID sync during the first 90 s after restart
// (ZONE_DRIVERS may be incomplete while Firebase re-delivers child_added events).
const SERVER_START_TIME = Date.now();

// Guard: only send the "confirmed zero" clear-board signal (dt6=null) once at least
// one driver has connected in THIS server session.  Before that, return dt6=[] so the
// dispatcher board keeps any Firebase-sourced drivers visible after a server restart.
let _firstDriverSeenAfterStart = false;

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

// Tracks drivers whose Away was silently ignored because they had an Assigned job
// (usually from Firebase onDisconnect firing on an app crash).
// When they later send Available we know it is a reconnect, NOT a deliberate cancel.
// Each entry: { ts: <epoch ms> }  — auto-expires after 15 minutes.
const DRIVER_RECONNECT_PENDING = {};
const DRIVER_RECONNECT_TTL_MS  = 15 * 60 * 1000;
function markDriverReconnectPending(driverId) {
  DRIVER_RECONNECT_PENDING[String(driverId)] = { ts: Date.now() };
}
function consumeDriverReconnectPending(driverId) {
  const key = String(driverId);
  const entry = DRIVER_RECONNECT_PENDING[key];
  if (!entry) return false;
  if (Date.now() - entry.ts > DRIVER_RECONNECT_TTL_MS) {
    delete DRIVER_RECONNECT_PENDING[key];
    return false; // expired
  }
  delete DRIVER_RECONNECT_PENDING[key];
  return true;
}
function isDriverReconnectPending(driverId) {
  const key = String(driverId);
  const entry = DRIVER_RECONNECT_PENDING[key];
  if (!entry) return false;
  if (Date.now() - entry.ts > DRIVER_RECONNECT_TTL_MS) { delete DRIVER_RECONNECT_PENDING[key]; return false; }
  return true;
}

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
  // §103 — 'Scheduled' pre-booked web jobs live in the Unassigned tab with a Sched badge
  //         until their NotifyDispatchAt timer promotes them to 'Pending' for auto-dispatch.
  const PENDING_ST = new Set(['Pending', 'Scheduled', 'Offered', 'Reject', 'Unreached', 'No One']);
  const isOrphaned = j => j.BookingStatus === 'Assigned' && (!j.DriverId || String(j.DriverId) === '0');
  const pendingJobs = allNonTerminal.filter(j => PENDING_ST.has(j.BookingStatus) || isOrphaned(j));
  const dt1 = pendingJobs.map(j => ({ ...j, JobMins: calcJobMins(j) }));
  const activeJobs = allNonTerminal.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking');
  return {
    dt1,
    dt2: [{ AssignedCount: allNonTerminal.filter(j => j.BookingStatus === 'Assigned' && !isOrphaned(j)).length }],
    dt3: [{ ActiveCount: activeJobs.length }],
    dt4: [{ UnAssignedCount: pendingJobs.filter(j => j.BookingStatus === 'Pending' || j.BookingStatus === 'Scheduled' || j.BookingStatus === 'Unreached' || j.BookingStatus === 'No One' || isOrphaned(j)).length }],
    dt5: [{ PublicKey: STRIPE_PK }],
    dt6: activeJobs.map(j => ({ ...j, BookingId: j.Id })),
  };
}

// Build delivery (DY tab) response — mirrors buildJobListResponse with deUnAssignedCount
function buildDeliveryResponse(jobs) {
  // Match food/freight jobs regardless of how they were created:
  //   - legacy delivery apps set BookingType='Delivery' or BookingSource='Delivery App'
  //   - passenger/web/food-app flows set serviceType='food' or 'freight'
  const deliveryJobs = jobs.filter(j =>
    j.BookingType === 'Delivery' ||
    j.BookingSource === 'Delivery App' ||
    j.serviceType === 'food' ||
    j.serviceType === 'freight'
  );
  const dt1 = deliveryJobs.map(j => ({ ...j, JobMins: calcJobMins(j) }));
  return {
    dt1,
    dt2: [{ AssignedCount: 0 }],
    dt3: [{ ActiveCount: 0 }],
    dt4: [{ deUnAssignedCount: dt1.length }],
    dt5: [{ PublicKey: STRIPE_PK }],
  };
}

function buildAssignedResponse(jobs) {
  // 'Offered' = dispatcher sent the job, driver hasn't accepted yet → stays in Pending/Offered tab
  // 'Assigned' = driver accepted → shows in Assigned tab
  // 'Queued'   = Busy driver accepted a pre-queue offer → shown exclusively in the orange Queued
  //              section (fed by [GetQueuedJobs]), NOT in this dt1 list. This prevents the job
  //              appearing twice and keeps AssignedCount accurate (true Assigned jobs only).
  // Exclude orphaned jobs (Assigned but no real driver: DriverId=0 or -1) — those appear in Unassigned tab instead.
  const assigned = jobs.filter(j =>
    j.BookingStatus === 'Assigned' &&
    j.DriverId && String(j.DriverId) !== '0' && String(j.DriverId) !== '-1'
  );
  // §99 — WaitMins: minutes since job was created (for wait-timer display on assigned tab)
  const dt1 = assigned.map(j => ({
    ...j,
    BookingId: j.Id,
    JobMins:  calcJobMins(j),
    WaitMins: j.createdAt ? Math.floor((Date.now() - j.createdAt) / 60000) : null,
  }));
  const activeCount = jobs.filter(j => j.BookingStatus === 'Active' || j.BookingStatus === 'Picking').length;
  return {
    dt1,
    dt2: [{ AssignedCount: dt1.length }],
    dt3: [{ ActiveCount: activeCount }],
    dt4: [{ UnAssignedCount: jobs.filter(j => j.BookingStatus === 'Pending' || j.BookingStatus === 'Unreached' || j.BookingStatus === 'No One').length }],
    dt5: [{ PublicKey: STRIPE_PK }],
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
      const now = Date.now();
      const accounts = registrationStore.filter(r =>
        ['approved','trial','active','grace','deactivated'].includes(r.status)
      ).map(r => {
        const cid         = r.companyId;
        const activeJobs  = jobStore.filter(j => j.companyId === cid);
        const closedJobs  = closedJobStore.filter(j => j.companyId === cid);
        const forceDone   = closedJobs.filter(j => (j.CompletedBy || '').includes('force complete'));
        const offlineDone = closedJobs.filter(j => (j.CompletedBy || '').includes('offline'));
        const allClosed   = closedJobs.sort((a,b) => (b.CompletedAt || b.ClosedAt || 0) - (a.CompletedAt || a.ClosedAt || 0));
        const lastJob     = allClosed[0];
        return {
          id: r.id, companyId: cid, company: r.company, name: r.name,
          email: r.email, phone: r.phone, country: r.country, area: r.area,
          fleetSize: r.fleetSize, status: r.status,
          serviceType: r.serviceType || 'taxi',
          plan: r.plan || 'free_trial', planLabel: r.planLabel || 'Free Trial',
          planPrice: r.planPrice || 0, trialDays: r.trialDays || 0,
          approvedAt: r.approvedAt, trialStart: r.trialStart, trialEnd: r.trialEnd,
          graceEnd: r.graceEnd,
          daysLeft: r.trialEnd ? Math.max(0, Math.ceil((r.trialEnd - now) / 86400000)) : null,
          // ── Job stats (new) ───────────────────────────────────────────────
          stats: {
            activeJobs:       activeJobs.length,
            closedJobs:       closedJobs.length,
            forceCompleted:   forceDone.length,
            offlineSynced:    offlineDone.length,
            lastJobAt:        lastJob ? (lastJob.CompletedAt || lastJob.ClosedAt || null) : null,
            lastJobId:        lastJob ? lastJob.Id : null,
          }
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(accounts));
      return;
    }

    // GET /admin/jobs/:companyId — full job history visible to super admin
    // Returns active + closed jobs for the company with dispatcher name, CompletedBy flag,
    // and highlights for force-complete and offline-synced trips.
    const _adminJobsMatch = urlPath.match(/^\/admin\/jobs\/([^/]+)$/);
    if (_adminJobsMatch && req.method === 'GET') {
      const _ajCid    = _adminJobsMatch[1];
      const _qs       = new URL('http://x' + req.url).searchParams;
      const _limit    = Math.min(parseInt(_qs.get('limit') || '200', 10), 500);
      const _status   = (_qs.get('status') || '').toLowerCase(); // 'active','closed','force','offline'
      const _since    = parseInt(_qs.get('since') || '0', 10);   // Unix ms — filter by ClosedAt/CompletedAt

      let _active = jobStore.filter(j => j.companyId === _ajCid)
        .map(j => ({ ...j, _jobGroup: 'active' }));
      let _closed = closedJobStore.filter(j => j.companyId === _ajCid)
        .map(j => {
          const _cb = (j.CompletedBy || '').toLowerCase();
          return {
            ...j,
            _jobGroup:       _cb.includes('force complete') ? 'force_complete'
                           : _cb.includes('offline')        ? 'offline_sync'
                           : 'closed',
          };
        });

      if (_since > 0) {
        _active = _active.filter(j => (j.CreatedAt || 0) >= _since);
        _closed = _closed.filter(j => (j.CompletedAt || j.ClosedAt || 0) >= _since);
      }

      let _all = [..._active, ..._closed];
      if (_status === 'active')   _all = _active;
      if (_status === 'closed')   _all = _closed;
      if (_status === 'force')    _all = _closed.filter(j => j._jobGroup === 'force_complete');
      if (_status === 'offline')  _all = _closed.filter(j => j._jobGroup === 'offline_sync');

      // Sort newest first, cap at limit
      _all.sort((a, b) => (b.CompletedAt || b.ClosedAt || b.CreatedAt || 0)
                         - (a.CompletedAt || a.ClosedAt || a.CreatedAt || 0));
      _all = _all.slice(0, _limit);

      // Return a concise summary per job — keep it readable for the admin
      const _summary = _all.map(j => ({
        id:            j.Id,
        status:        j.BookingStatus,
        group:         j._jobGroup,
        passenger:     ((j.UserFName || '') + ' ' + (j.UserLName || '')).trim() || j.Name || '',
        phone:         j.PhoneNo || '',
        pickup:        j.PickAddress || '',
        drop:          j.DropAddress || '',
        fare:          j.TotalFare   || j.Fare || 0,
        payment:       j.PaymentMethod || j.PaymentType || '',
        dispatcher:    j.DispatcherName || '',
        driver:        j.UserFName || j.drivername || '',
        completedBy:   j.CompletedBy || '',
        notes:         j.DispatchNotes || j.Notes || '',
        createdAt:     j.CreatedAt  || j.BookingDateTime || null,
        completedAt:   j.CompletedAt || j.ClosedAt || null,
      }));

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ companyId: _ajCid, total: _summary.length, jobs: _summary }));
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
            ({ idToken } = await firebaseSignIn(reg.email, reg._rawPassword));
          } else {
            // Fallback: Firebase user wasn't created at registration — create it now
            const created = await firebaseCreateUser(reg.email, reg._rawPassword);
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

        const trialDays = reg.trialDays || 14;
        reg.status     = 'trial';
        reg.companyId  = companyId;
        reg.ownerUid   = ownerUid;
        reg.approvedAt = now;
        reg.trialStart = now;
        reg.trialEnd   = trialDays > 0 ? now + trialDays * 24 * 60 * 60 * 1000 : null;
        reg.graceEnd   = null;
        saveRegistrations();
        console.log(`[admin] approved registration ${regId} → companyId=${companyId}, uid=${ownerUid}, plan=${reg.plan || 'free_trial'}, trial until ${reg.trialEnd ? new Date(reg.trialEnd).toISOString() : 'n/a'}`);
        jsonReply(res, {
          ok: true, companyId, ownerUid, trialEnd: reg.trialEnd,
          plan: reg.plan, planLabel: reg.planLabel,
          message: `Approved. ${trialDays > 0 ? trialDays + '-day trial starts now.' : 'Account is active.'}`,
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
        if (reg.ownerUid && reg.companyId && reg._rawPassword) {
          firebaseSignIn(reg.email, reg._rawPassword)
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
        if (reg.ownerUid && reg.companyId && reg._rawPassword) {
          firebaseSignIn(reg.email, reg._rawPassword)
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
        if (!reg.companyId || !reg._rawPassword) {
          jsonReply(res, { error: 'Account is missing companyId or password — cannot repair.' });
          return;
        }
        let fbError = null;
        let uid = reg.ownerUid || null;
        try {
          // If uid missing, try sign-in first; if that fails, create the user
          let idToken;
          if (uid) {
            ({ idToken } = await firebaseSignIn(reg.email, reg._rawPassword));
          } else {
            try {
              ({ idToken } = await firebaseSignIn(reg.email, reg._rawPassword));
              // Sign-in succeeded — get uid from the token response
              const tokenData = JSON.parse(Buffer.from(idToken.split('.')[1] + '==', 'base64').toString());
              uid = tokenData.user_id || tokenData.sub || uid;
            } catch(_) {
              // Sign-in failed — create the Firebase user
              const created = await firebaseCreateUser(reg.email, reg._rawPassword);
              uid = created.uid;
              idToken = created.idToken;
            }
          }
          if (!uid) {
            // Get uid from fresh sign-in token
            ({ idToken } = await firebaseSignIn(reg.email, reg._rawPassword));
          }
          // Re-sign in to get a fresh idToken (needed if uid was recovered above)
          const fresh = await firebaseSignIn(reg.email, reg._rawPassword);
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

    // POST /admin/deploy-firebase-rules — push database.rules.json to Firebase RTDB
    // Requires BW_FIREBASE_SECRET to be set.  Call once after adding the secret.
    if (urlPath === '/admin/deploy-firebase-rules' && req.method === 'POST') {
      const dbSecret = process.env.BW_FIREBASE_SECRET || '';
      if (!dbSecret) {
        jsonReply(res, { ok: false, error: 'BW_FIREBASE_SECRET is not set — add it in Replit Secrets and restart the server, then call this endpoint again.' });
        return;
      }
      try {
        const fs = require('fs');
        const rulesJson = fs.readFileSync('./database.rules.json', 'utf8');
        const dr = await fbRequest(
          `${FB_DB_URL}/.settings/rules.json?auth=${dbSecret}`,
          'PUT', JSON.parse(rulesJson)
        );
        if (dr.status === 200) {
          console.log('[firebase] database.rules.json deployed successfully');
          jsonReply(res, { ok: true, message: 'Firebase rules deployed successfully' });
        } else {
          console.log('[firebase] rules deploy failed:', dr.status, JSON.stringify(dr.body));
          jsonReply(res, { ok: false, error: 'Firebase returned ' + dr.status, detail: dr.body });
        }
      } catch(e) {
        jsonReply(res, { ok: false, error: e.message });
      }
      return;
    }

    // Unknown admin route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown admin endpoint' }));
    return;
  }

  // POST …/Default.aspx/DispatchChargeing — Stripe charge via token (Stripe.js v2)
  // Called by StripeTokenCreation.js after card tokenisation succeeds in the browser.
  // Expects JSON body: { Token: "tok_xxx", Amout: "25" }  (note original typo "Amout")
  if (urlPath.includes('/Default.aspx/DispatchChargeing') && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      let body = {};
      try { body = JSON.parse(rawBody); } catch (e) {}
      const token  = (body.Token  || '').trim();
      const amtStr = (body.Amout  || body.Amount || '0').toString().trim();
      const amountDollars = parseFloat(amtStr) || 0;
      if (!token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ d: 'error: no token provided' }));
        return;
      }
      if (amountDollars <= 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ d: 'error: invalid amount' }));
        return;
      }
      const stripe = getStripe();
      const amountCents = Math.round(amountDollars * 100);
      const charge = await stripe.charges.create({
        amount:   amountCents,
        currency: 'nzd',
        source:   token,
        description: 'BookaWaka taxi fare',
      });
      console.log(`[Stripe] charge ${charge.id} ${charge.status} $${amountDollars} NZD`);
      const status = charge.status === 'succeeded' ? 'succeeded' : charge.status;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ d: status }));
    } catch (err) {
      console.log('[Stripe] charge error:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ d: 'error: ' + err.message }));
    }
    return;
  }

  // POST /DispatcherLogin.aspx/AccountRequest — public signup / registration
  if (urlPath === '/DispatcherLogin.aspx/AccountRequest' && req.method === 'POST') {
    const rawBody = await readBody(req);
    let reqBody = {};
    try { reqBody = JSON.parse(rawBody); } catch (e) {}
    const reqCompany     = (reqBody.company        || '').trim();
    const reqName        = (reqBody.name           || '').trim();
    const reqEmail       = (reqBody.email          || '').trim().toLowerCase();
    const reqPhone       = (reqBody.phone          || '').trim();
    const reqPass        = (reqBody.password       || '').trim();
    const reqBizNum      = (reqBody.businessNumber || '').trim();
    const reqFleet       = (reqBody.fleetSize      || '').trim();
    const reqArea        = (reqBody.area           || '').trim();
    const reqCountry     = (reqBody.country        || 'NZ').trim();
    const reqServiceType = (reqBody.serviceType    || 'taxi').trim();
    const reqPlan        = (reqBody.plan           || 'free_trial').trim();

    // Plan config — source of truth for trial lengths and pricing
    const PLAN_CONFIG = {
      free_trial: { label: 'Free Trial',  trialDays: 14, priceMonthly: 0,   autoApprove: true  },
      starter:    { label: 'Starter',     trialDays: 0,  priceMonthly: 99,  autoApprove: false },
      pro:        { label: 'Pro',         trialDays: 0,  priceMonthly: 199, autoApprove: false },
    };
    const VALID_SERVICE_TYPES = ['taxi', 'restaurant', 'freight', 'all'];

    if (!reqCompany || !reqName || !reqEmail) {
      jsonReply(res, { error: 'Company name, your name and email are all required.' });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(reqEmail)) {
      jsonReply(res, { error: 'Please provide a valid email address.' });
      return;
    }
    if (!PLAN_CONFIG[reqPlan]) {
      jsonReply(res, { error: 'Invalid plan selected.' });
      return;
    }
    if (!VALID_SERVICE_TYPES.includes(reqServiceType)) {
      jsonReply(res, { error: 'Invalid service type selected.' });
      return;
    }
    if (registrationStore.some(r => r.email === reqEmail && r.status !== 'rejected')) {
      jsonReply(res, { error: 'An account request with this email already exists. Our team will be in touch.' });
      return;
    }

    const planCfg = PLAN_CONFIG[reqPlan];
    const newReg = {
      id:             'REG-' + Date.now(),
      status:         'pending',
      submittedAt:    Date.now(),
      company:        reqCompany,
      name:           reqName,
      email:          reqEmail,
      phone:          reqPhone,
      _rawPassword:   reqPass,   // plaintext — needed for Firebase sign-in during approval; remove when switching to server-token-only flow
      businessNumber: reqBizNum,
      fleetSize:      reqFleet,
      area:           reqArea,
      country:        reqCountry,
      serviceType:    reqServiceType,
      plan:           reqPlan,
      planLabel:      planCfg.label,
      planPrice:      planCfg.priceMonthly,
      trialDays:      planCfg.trialDays,
      companyId:      null,
      ownerUid:       null,
      approvedAt:     null,
      trialStart:     null,
      trialEnd:       null,
      graceEnd:       null,
      rejectedAt:     null,
      rejectedReason: null,
    };
    registrationStore.push(newReg);
    saveRegistrations();
    console.log(`200: POST ${urlPath} -> new registration [${newReg.id}] plan=${reqPlan} serviceType=${reqServiceType} from "${reqEmail}" (${reqCompany})`);

    // Create Firebase Auth account immediately so the UID is ready for approval.
    // Best-effort — registration succeeds even if Firebase fails.
    try {
      const { uid } = await firebaseCreateUser(reqEmail, reqPass);
      newReg.ownerUid = uid;
      saveRegistrations();
      console.log(`[registration] Firebase Auth created for ${reqEmail}: uid=${uid}`);
    } catch(fbRegErr) {
      console.log(`[registration] Firebase Auth creation note for ${reqEmail}: ${fbRegErr.message}`);
    }

    // ── Free Trial: auto-approve immediately ────────────────────────────────
    if (planCfg.autoApprove) {
      const now = Date.now();
      const companyId = generateCompanyId();
      let ownerUid = newReg.ownerUid || null;
      let fbError  = null;
      try {
        let idToken;
        if (ownerUid) {
          ({ idToken } = await firebaseSignIn(reqEmail, reqPass));
        } else {
          const created = await firebaseCreateUser(reqEmail, reqPass);
          ownerUid = created.uid;
          idToken  = created.idToken;
        }
        await firebaseDbSet(`adminAccess/${companyId}/${ownerUid}`, true, idToken);
        await firebaseDbSet(`users/${ownerUid}/companyId`,   companyId,      idToken);
        await firebaseDbSet(`users/${ownerUid}/companyName`, reqCompany || '', idToken);
        console.log(`[registration] Free trial auto-approved: uid=${ownerUid} companyId=${companyId}`);
      } catch(e) {
        fbError = e.message;
        console.log(`[registration] Firebase provisioning warning for free trial ${reqEmail}: ${e.message}`);
      }

      newReg.status     = 'trial';
      newReg.companyId  = companyId;
      newReg.ownerUid   = ownerUid;
      newReg.approvedAt = now;
      newReg.trialStart = now;
      newReg.trialEnd   = now + planCfg.trialDays * 24 * 60 * 60 * 1000;
      newReg.graceEnd   = null;
      saveRegistrations();
      console.log(`[registration] Free trial live: ${reqEmail} companyId=${companyId} trialEnd=${new Date(newReg.trialEnd).toISOString()}`);

      jsonReply(res, {
        ok:          true,
        autoApproved: true,
        companyId:   companyId,
        trialEnd:    newReg.trialEnd,
        trialDays:   planCfg.trialDays,
        message:     `Your free trial is live! Log in now with your email and password. Your company ID is ${companyId}.`,
        fbWarning:   fbError || undefined,
      });
      return;
    }

    // ── Paid plan: stays pending, super admin reviews ───────────────────────
    jsonReply(res, {
      ok:      true,
      pending: true,
      plan:    reqPlan,
      message: 'Request received. Our team will review your application and be in touch within 1 business day.',
    });
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
    res.end(JSON.stringify({ ok: true, companyId, company: reg.company, status: reg.status, ownerName: reg.name || '' }));
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
      ownerName: reg.name || '',
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
        BookingDateTime: new Date().toISOString(),
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

  // ── GET/POST /dev/smoketest — end-to-end data pipeline smoke test ────────────
  // Writes synthetic data through every Firebase path in the booking lifecycle,
  // then reads back from all three report consumers and verifies field presence.
  // Cleans up all test data on completion.
  // Protected by BW_ADMIN_KEY.
  // Usage: GET /dev/smoketest?adminKey=<key>&cid=<companyId>&driverId=<id>
  if (urlPath === '/dev/smoketest' && (req.method === 'GET' || req.method === 'POST')) {
    const _stQs       = new URL('http://x' + req.url).searchParams;
    const _stKey      = (req.headers['x-admin-key'] || _stQs.get('adminKey') || '').trim();
    const _stCid      = (_stQs.get('cid')      || '620611').trim();
    const _stDriverId = (_stQs.get('driverId') || 'smoketest_driver_1').trim();
    const _stVehicleId= (_stQs.get('vehicleId')|| 'smoketest_vehicle_1').trim();

    if (_stKey !== (process.env.BW_ADMIN_KEY || 'bookawaka-admin-2026')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden — pass ?adminKey=<key>');
      return;
    }

    // ── Test identifiers ────────────────────────────────────────────────────
    const _stJobId   = 'ST' + Date.now(); // unique per run
    const _stTripId  = _stJobId;
    const _stFare    = 18.50;
    const _stNow     = new Date().toISOString();

    const results = []; // { step, path, field, expected, got, pass }
    const writtenPaths = []; // for cleanup

    function check(step, path, field, expected, got) {
      const pass = (got !== null && got !== undefined && got !== '' && got !== false)
                   ? (expected === '__present__' ? true : String(got) === String(expected))
                   : false;
      results.push({ step, path, field, expected: expected === '__present__' ? '(present)' : expected, got: got == null ? 'null/missing' : got, pass });
      return pass;
    }

    // Helper: attempt a Firebase write; on failure push an error check result but continue
    async function fbWrite(token, stepLabel, path, data) {
      try {
        await firebaseDbSet(path, data, token);
        writtenPaths.push(path);
        return true;
      } catch(e) {
        results.push({ step: stepLabel, path, field: 'WRITE', expected: 'ok', got: `WRITE FAILED: ${e.message}`, pass: false });
        return false;
      }
    }
    async function fbRead(token, url) {
      try {
        const r = await fbRequest(`${url}?auth=${encodeURIComponent(token)}`, 'GET', null);
        return r.body || {};
      } catch(e) { return {}; }
    }

    let token;
    try {
      token = await getFirebaseServerToken();
      if (!token) throw new Error('Could not obtain Firebase server token — check BW_FIREBASE_SECRET or Firebase rules');
    } catch(e) {
      results.push({ step: 'FATAL', path: '', field: '', expected: '', got: e.message, pass: false });
    }

    if (token) {
      // ── STEP 1: Passenger app writes booking to pendingjobs ───────────────
      const _pendingJob = {
        PassengerName:    'Smoke Test Passenger',
        phoneNo:          '021 999 000',
        pickupAddress:    '1 Test St, Invercargill',
        pickupLat:        -46.41,
        pickupLng:        168.35,
        dropoffAddress:   'Invercargill Airport',
        dropoffLat:       -46.42,
        dropoffLng:       168.33,
        serviceType:      'taxi',
        paymentMethod:    'cash',
        estimatedFare:    _stFare,
        passengers:       1,
        createdAt:        _stNow,
        scheduledFor:     0,
        _smoketest:       true,
      };
      await fbWrite(token, '1-ingest', `pendingjobs/${_stCid}/${_stJobId}`, _pendingJob);

      // Verify _normFbJob normalisation (local — no Firebase needed)
      const _normed = _normFbJob(_pendingJob);
      check('1-ingest', `pendingjobs/${_stCid}/${_stJobId}`, 'name',        '__present__', _normed.name);
      check('1-ingest', `pendingjobs/${_stCid}/${_stJobId}`, 'pickAddress', '__present__', _normed.pickAddress);
      check('1-ingest', `pendingjobs/${_stCid}/${_stJobId}`, 'serviceType', 'taxi',        _normed.serviceType);
      check('1-ingest', `pendingjobs/${_stCid}/${_stJobId}`, 'pickLatLng',  '__present__', _normed.pickLatLng);

      // ── STEP 2: Passenger app writes to allbookings (long-term store) ─────
      const _allBooking = Object.assign({}, _pendingJob, { bookingId: _stJobId, status: 'Pending' });
      const _s2ok = await fbWrite(token, '2-allbookings', `allbookings/${_stCid}/${_stJobId}`, _allBooking);
      if (_s2ok) {
        const _ab = await fbRead(token, `${FB_DB_URL}/allbookings/${_stCid}/${_stJobId}.json`);
        check('2-allbookings', `allbookings/${_stCid}/${_stJobId}`, 'bookingId', _stJobId,  _ab.bookingId);
        check('2-allbookings', `allbookings/${_stCid}/${_stJobId}`, 'status',    'Pending', _ab.status);
      }

      // ── STEP 3: Dispatcher sends job offer → notification + jobDetails + rideStatus
      const _fullPayload = {
        bookingid:      `${_stJobId},Offered,${_stDriverId},,Dispatcher`,
        content:        'You have offered new Job please view details',
        joboffer:       String(_stJobId),
        jobpickup:      '1 Test St, Invercargill',
        jobdropoff:     'Invercargill Airport',
        JobphoneNo:     '021 999 000',
        jobname:        'Smoke Test Passenger',
        jobbags:        '0',
        jobpassengers:  '1',
        jobvehicletype: 'Sedan',
        jobinfo:        '',
        jobFare:        String(_stFare),
        jobCount:       1,
        jobServiceType: 'taxi',
        jobBookingSrc:  'Dispatcher',
        vehicleId:      String(_stVehicleId),
        companyId:      String(_stCid),
      };

      const _s3notifOk = await fbWrite(token, '3-offer/notification', `notification/${_stDriverId}`, _fullPayload);
      if (_s3notifOk) {
        const _nb = await fbRead(token, `${FB_DB_URL}/notification/${_stDriverId}.json`);
        check('3-offer', `notification/${_stDriverId}`, 'vehicleId',  String(_stVehicleId), _nb.vehicleId);
        check('3-offer', `notification/${_stDriverId}`, 'companyId',  String(_stCid),       _nb.companyId);
        check('3-offer', `notification/${_stDriverId}`, 'joboffer',   String(_stJobId),     _nb.joboffer);
        check('3-offer', `notification/${_stDriverId}`, 'JobphoneNo', '__present__',         _nb.JobphoneNo);
      }

      const _s3jdOk = await fbWrite(token, '3-offer/jobDetails', `jobDetails/${_stCid}/${_stJobId}`, _fullPayload);
      if (_s3jdOk) {
        const _jdb = await fbRead(token, `${FB_DB_URL}/jobDetails/${_stCid}/${_stJobId}.json`);
        check('3-jobDetails', `jobDetails/${_stCid}/${_stJobId}`, 'vehicleId', String(_stVehicleId), _jdb.vehicleId);
        check('3-jobDetails', `jobDetails/${_stCid}/${_stJobId}`, 'companyId', String(_stCid),       _jdb.companyId);
      }

      const _rideStatusData = {
        status:      'Offered',
        driverId:    String(_stDriverId),
        vehicleId:   String(_stVehicleId),
        companyId:   String(_stCid),
        bookingId:   String(_stJobId),
        pickup:      '1 Test St, Invercargill',
        dropoff:     'Invercargill Airport',
        vehicleType: 'Sedan',
        updatedAt:   Date.now(),
      };
      const _s3rsOk = await fbWrite(token, '3-offer/rideStatus', `rideStatus/${_stCid}/${_stJobId}`, _rideStatusData);
      if (_s3rsOk) {
        const _rsb = await fbRead(token, `${FB_DB_URL}/rideStatus/${_stCid}/${_stJobId}.json`);
        check('3-rideStatus', `rideStatus/${_stCid}/${_stJobId}`, 'vehicleId', String(_stVehicleId), _rsb.vehicleId);
        check('3-rideStatus', `rideStatus/${_stCid}/${_stJobId}`, 'driverId',  String(_stDriverId),  _rsb.driverId);
      }

      // ── STEP 4: Driver completes job → dispatcher writes completedJobs (SA-MasterReport reads this)
      const _completedNode = {
        fare:        _stFare,
        paymentType: 'cash',
        completedAt: _stNow,
        driverId:    String(_stDriverId),
        pickup:      '1 Test St, Invercargill',
        dropoff:     'Invercargill Airport',
      };
      const _s4ok = await fbWrite(token, '4-completedJobs', `completedJobs/${_stCid}/${_stTripId}`, _completedNode);
      if (_s4ok) {
        const _cjb = await fbRead(token, `${FB_DB_URL}/completedJobs/${_stCid}/${_stTripId}.json`);
        check('4-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTripId}`, 'fare',        String(_stFare),     _cjb.fare);
        check('4-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTripId}`, 'paymentType', 'cash',              _cjb.paymentType);
        check('4-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTripId}`, 'completedAt', '__present__',       _cjb.completedAt);
        check('4-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTripId}`, 'driverId',    String(_stDriverId), _cjb.driverId);
        check('4-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTripId}`, 'pickup',      '__present__',       _cjb.pickup);
        check('4-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTripId}`, 'dropoff',     '__present__',       _cjb.dropoff);
      }

      // ── STEP 5: Dispatcher writes driverEarnings (SA-Payouts + Owner portal read this)
      const _earningsNode = {
        driverName:    'Smoke Test Driver',
        totalEarned:   _stFare,
        pendingAmount: _stFare,
        tripCount:     1,
        lastPaidAt:    null,
        updatedAt:     Date.now(),
      };
      const _s5ok = await fbWrite(token, '5-driverEarnings', `driverEarnings/taxi/${_stCid}/${_stDriverId}`, _earningsNode);
      if (_s5ok) {
        const _deb = await fbRead(token, `${FB_DB_URL}/driverEarnings/taxi/${_stCid}/${_stDriverId}.json`);
        check('5-driverEarnings [SA-Payouts]',   `driverEarnings/taxi/${_stCid}/${_stDriverId}`, 'totalEarned',   String(_stFare), _deb.totalEarned);
        check('5-driverEarnings [SA-Payouts]',   `driverEarnings/taxi/${_stCid}/${_stDriverId}`, 'pendingAmount', String(_stFare), _deb.pendingAmount);
        check('5-driverEarnings [SA-Payouts]',   `driverEarnings/taxi/${_stCid}/${_stDriverId}`, 'tripCount',     '1',             _deb.tripCount);
        check('5-driverEarnings [Owner-portal]', `driverEarnings/taxi/${_stCid}/${_stDriverId}`, 'driverName',    '__present__',   _deb.driverName);
        check('5-driverEarnings [Owner-portal]', `driverEarnings/taxi/${_stCid}/${_stDriverId}`, 'updatedAt',     '__present__',   _deb.updatedAt);
      }

      // ── STEP 6: TM job — notification.extras + completedJobs TM fields ────
      const _stTmJobId = _stJobId + '_TM';
      const _tmPayload = Object.assign({}, _fullPayload, {
        joboffer: _stTmJobId,
        extras: {
          tmVoucherNo:     'TM-SMOKE-001',
          tmPassengerName: 'TM Test Passenger',
          tmCardExpiry:    '12/2026',
          tmSubsidy:       12.00,
          tmPassengerPays: 3.00,
          tmHoistRequired: false,
          tmHoistCount:    0,
          tmPaymentMethod: 'cash',
        },
      });
      const _s6notifOk = await fbWrite(token, '6-TM/notification', `notification/${_stDriverId}_TM`, _tmPayload);
      if (_s6notifOk) {
        const _tmnb = (await fbRead(token, `${FB_DB_URL}/notification/${_stDriverId}_TM.json`)).extras || {};
        check('6-TM-offer [driver-app extras]', `notification/${_stDriverId}_TM`, 'extras.tmVoucherNo',     'TM-SMOKE-001', _tmnb.tmVoucherNo);
        check('6-TM-offer [driver-app extras]', `notification/${_stDriverId}_TM`, 'extras.tmSubsidy',       '12',           _tmnb.tmSubsidy);
        check('6-TM-offer [driver-app extras]', `notification/${_stDriverId}_TM`, 'extras.tmPassengerPays', '3',            _tmnb.tmPassengerPays);
      }

      const _tmCompletedNode = Object.assign({}, _completedNode, {
        paymentType:     'total_mobility',
        tmSubsidy:       12.00,
        tmSubsidyHoist:  0,
        tmPassengerPays: 3.00,
        councilId:       'INV',
      });
      const _s6cjOk = await fbWrite(token, '6-TM/completedJobs', `completedJobs/${_stCid}/${_stTmJobId}`, _tmCompletedNode);
      if (_s6cjOk) {
        const _tmcjb = await fbRead(token, `${FB_DB_URL}/completedJobs/${_stCid}/${_stTmJobId}.json`);
        check('6-TM-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTmJobId}`, 'paymentType',     'total_mobility', _tmcjb.paymentType);
        check('6-TM-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTmJobId}`, 'tmSubsidy',       '12',             _tmcjb.tmSubsidy);
        check('6-TM-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTmJobId}`, 'tmPassengerPays', '3',              _tmcjb.tmPassengerPays);
        check('6-TM-completedJobs [SA-MasterReport]', `completedJobs/${_stCid}/${_stTmJobId}`, 'councilId',       'INV',            _tmcjb.councilId);
      }

      // ── STEP 7: allbookings gap — SA master report ONLY reads completedJobs ─
      results.push({
        step: '7-gap [SA-MasterReport]',
        path: `allbookings/${_stCid}/${_stJobId}`,
        field: 'coverage',
        expected: 'completedJobs',
        got: 'allbookings ONLY — dispatched trips not in SA-MasterReport (known gap)',
        pass: null,
      });
    }

    // ── Cleanup: delete all written test paths ──────────────────────────────
    const cleanupErrors = [];
    try {
      const _cleanToken = await getFirebaseServerToken();
      if (_cleanToken) {
        await Promise.all(writtenPaths.map(p =>
          firebaseDbDelete(p, _cleanToken).catch(e => cleanupErrors.push(`${p}: ${e.message}`))
        ));
      }
    } catch(e) { cleanupErrors.push('cleanup error: ' + e.message); }

    // ── Build HTML report ───────────────────────────────────────────────────
    const passed  = results.filter(r => r.pass === true).length;
    const failed  = results.filter(r => r.pass === false).length;
    const gaps    = results.filter(r => r.pass === null).length;
    const total   = results.filter(r => r.pass !== null).length;
    const allPass = failed === 0;

    const rowsHtml = results.map(r => {
      const bg  = r.pass === true  ? '#e8f5e9'
                : r.pass === false ? '#ffebee'
                :                    '#fff8e1';
      const icon = r.pass === true  ? '✅'
                 : r.pass === false ? '❌'
                 :                    '⚠️';
      return `<tr style="background:${bg}">
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;">${icon}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;">${r.step}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;font-size:11px;">${r.path}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;font-size:11px;">${r.field}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;">${r.expected}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;">${r.got}</td>
      </tr>`;
    }).join('');

    const headerBg = allPass ? '#2e7d32' : '#c62828';
    const headerTxt = allPass
      ? `✅ ALL ${total} CHECKS PASSED — pipeline is clean`
      : `❌ ${failed} of ${total} checks FAILED — see rows below`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>BW Smoke Test — ${new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</title>
<style>body{font-family:sans-serif;margin:24px;} table{border-collapse:collapse;width:100%;} th{background:#333;color:#fff;padding:8px 10px;text-align:left;font-size:12px;} </style>
</head><body>
<h2 style="margin-bottom:4px;">BookaWaka End-to-End Smoke Test</h2>
<p style="color:#555;margin-top:0;">companyId: <b>${_stCid}</b> &nbsp;|&nbsp; jobId: <b>${_stJobId}</b> &nbsp;|&nbsp; driverId: <b>${_stDriverId}</b> &nbsp;|&nbsp; ran: <b>${new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</b></p>
<div style="background:${headerBg};color:#fff;padding:14px 18px;border-radius:6px;font-size:15px;font-weight:bold;margin-bottom:18px;">${headerTxt}${gaps > 0 ? ` &nbsp;(${gaps} known gap${gaps > 1 ? 's' : ''})` : ''}</div>
<table>
  <thead><tr>
    <th width="32"></th>
    <th width="220">Step</th>
    <th width="300">Firebase Path</th>
    <th width="180">Field</th>
    <th width="120">Expected</th>
    <th>Got</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
${cleanupErrors.length ? `<p style="color:#b71c1c;margin-top:16px;">⚠ Cleanup errors: ${cleanupErrors.join('; ')}</p>` : '<p style="color:#555;margin-top:16px;font-size:12px;">✓ All test data cleaned up from Firebase.</p>'}
${failed > 0 ? `<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:12px 16px;margin-top:8px;font-size:12px;color:#555;">
  <b>WRITE FAILED = Permission denied?</b> Rules for <code>rideStatus</code> and <code>driverEarnings</code> were added to <code>database.rules.json</code> but
  have not been deployed to Firebase yet. Fix: run <code>firebase deploy --only database</code>. Alternatively, set the
  <code>BW_FIREBASE_SECRET</code> environment variable (Legacy DB Secret) — this bypasses all rules and will make all checks pass immediately.
</div>` : ''}
<details style="margin-top:16px;"><summary style="cursor:pointer;color:#555;font-size:12px;">What this test covers</summary>
<ul style="font-size:12px;color:#333;">
  <li><b>Step 1</b>: Passenger app writes to <code>pendingjobs/{cid}/{id}</code> → <code>_normFbJob()</code> normalises all fields correctly</li>
  <li><b>Step 2</b>: Passenger app writes to <code>allbookings/{cid}/{id}</code> → data readable back</li>
  <li><b>Step 3</b>: Dispatcher sends job offer → <code>notification/{driverId}</code> has <code>vehicleId</code> + <code>companyId</code>; <code>jobDetails/{cid}/{id}</code> written with companyId scope; <code>rideStatus/{cid}/{id}</code> has GPS anchor fields for passenger tracking</li>
  <li><b>Step 4</b>: Completion writes <code>completedJobs/{cid}/{id}</code> → <b>SA-MasterReport.aspx</b> readable (fare, paymentType, completedAt, driverId, pickup, dropoff)</li>
  <li><b>Step 5</b>: <code>driverEarnings/taxi/{cid}/{driverId}</code> → <b>SA-Payouts.aspx</b> + <b>Owner portal</b> readable (totalEarned, pendingAmount, tripCount)</li>
  <li><b>Step 6</b>: TM booking — <code>notification.extras.tmVoucherNo</code> present for driver app; <code>completedJobs</code> has tmSubsidy, tmPassengerPays, councilId for SA subsidy chain</li>
  <li><b>Step 7</b>: Known gap — <code>allbookings/{cid}</code> dispatched trips do NOT appear in SA-MasterReport (reads completedJobs only)</li>
</ul>
</details>
</body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // ── POST /api/syncOfflineTrip — driver app uploads offline trip data ────────
  // Called by the driver app when it reconnects after completing a job offline.
  // Accepts a full event journal + trip summary, runs all status transitions in
  // order, saves fare/payment/time fields, and marks the job Completed.
  // Auth: X-Admin-Key header OR body.adminKey field (driver app uses the latter).
  if (urlPath === '/api/syncOfflineTrip' && req.method === 'POST') {
    const _sotBody = await readBody(req);
    let _sotData = {};
    try { _sotData = JSON.parse(_sotBody); } catch(e) {}
    const _sotKey    = (req.headers['x-admin-key'] || _sotData.adminKey || '').toString().trim();
    const _sotJobId  = parseInt(_sotData.jobId) || 0;
    const _sotCid    = (_sotData.companyId || '').toString().trim();
    const _sotDrvId  = (_sotData.driverId  || '').toString().trim();
    const _sotVehId  = (_sotData.vehicleId || '').toString().trim();
    const _sotEvents = Array.isArray(_sotData.events) ? _sotData.events : [];
    const _sotSummary= _sotData.tripSummary || {};

    // Auth check
    if (_sotKey !== ADMIN_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorised — invalid adminKey' }));
      return;
    }
    if (!_sotJobId || !_sotCid || !_sotDrvId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'jobId, companyId and driverId are required' }));
      return;
    }

    // Find the job — it might be in active jobStore (still Assigned/Active)
    // or already in closedJobStore (driver app re-sending a previously synced trip)
    let _sotJob = jobStore.find(j =>
      j.Id === _sotJobId &&
      (String(j.companyId || j.CompanyId || '') === _sotCid || _sotCid === 'test')
    );
    const _sotAlreadyClosed = !_sotJob &&
      closedJobStore.find(j => j.Id === _sotJobId);

    if (_sotAlreadyClosed) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, jobId: _sotJobId, status: 'AlreadyClosed',
        message: 'Job was already completed — no changes made.' }));
      return;
    }
    if (!_sotJob) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Job not found: ' + _sotJobId }));
      return;
    }

    // Process events in chronological order to drive status transitions
    const _sotSorted = _sotEvents.slice().sort((a, b) =>
      new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    let _sotPickupTime = null, _sotDropoffTime = null;
    for (const _ev of _sotSorted) {
      const _evType = (_ev.type || _ev.eventType || '').toString();
      const _evTs   = _ev.timestamp || null;
      if (_evType === 'Accepted'  && _sotJob.BookingStatus === 'Pending')   _sotJob.BookingStatus = 'Assigned';
      if (_evType === 'EnRoute'   && _sotJob.BookingStatus === 'Pending')   _sotJob.BookingStatus = 'Assigned';
      if (_evType === 'Arrived'   && !_sotJob.ArrivedAt)    _sotJob.ArrivedAt    = _evTs;
      if (_evType === 'PickedUp'  || _evType === 'MeterOn') {
        if (!_sotPickupTime) _sotPickupTime = _evTs;
        if (!_sotJob.PickingAt) _sotJob.PickingAt = _evTs;
        if (_sotJob.BookingStatus === 'Assigned' || _sotJob.BookingStatus === 'Offered' || _sotJob.BookingStatus === 'Pending')
          _sotJob.BookingStatus = 'Active';
        if (!_sotJob.ActiveAt) _sotJob.ActiveAt = _evTs;
      }
      if (_evType === 'MeterOff'  && !_sotDropoffTime)  _sotDropoffTime  = _evTs;
      if (_evType === 'Completed' || _evType === 'Done') {
        if (!_sotDropoffTime) _sotDropoffTime = _evTs;
        _sotJob.BookingStatus  = 'Completed';
        _sotJob.JobCompleteTime= (_evTs || new Date().toISOString()) + '.';
        _sotJob.newcompelete   = _sotJob.JobCompleteTime;
      }
      if (_evType === 'Cancelled' || _evType === 'Cancel') {
        _sotJob.BookingStatus  = 'Cancelled';
        _sotJob.CancelledBy    = 'Driver';
        _sotJob.JobCompleteTime= (_evTs || new Date().toISOString()) + '.';
      }
    }

    // If events didn't include a Completed event but summary says Completed
    if (_sotSummary.status === 'Completed' && _sotJob.BookingStatus !== 'Completed') {
      _sotJob.BookingStatus   = 'Completed';
      _sotJob.JobCompleteTime = (_sotSummary.dropoffTime || new Date().toISOString()) + '.';
      _sotJob.newcompelete    = _sotJob.JobCompleteTime;
    }

    // Write trip summary data into the job record
    if (_sotSummary.pickupTime)    _sotJob.PickingAt        = _sotSummary.pickupTime;
    if (_sotSummary.dropoffTime)   _sotJob.JobCompleteTime  = _sotSummary.dropoffTime + '.';
    if (_sotSummary.duration_mins) _sotJob.JobDuration      = _sotSummary.duration_mins;
    if (_sotSummary.distance_km)   _sotJob.JobDistance      = _sotSummary.distance_km;
    if (_sotSummary.route_polyline)_sotJob.RoutePolyline    = _sotSummary.route_polyline;
    if (_sotSummary.fare) {
      const _f = _sotSummary.fare;
      _sotJob.FareBase        = _f.base       || 0;
      _sotJob.FareDistance    = _f.distanceCharge || 0;
      _sotJob.FareTime        = _f.timeCharge || 0;
      _sotJob.FareExtras      = _f.extras     || 0;
      _sotJob.TotalFare       = _f.total      || 0;
      _sotJob.FareCurrency    = _f.currency   || 'NZD';
      _sotJob.Fare            = _f.total      || 0;
    }
    if (_sotSummary.payment) {
      const _p = _sotSummary.payment;
      _sotJob.Recieve_payment = _p.method     || '';
      _sotJob.PaymentReceived = _p.received   || 0;
      _sotJob.PaymentChange   = _p.change     || 0;
      _sotJob.ReceiptNo       = _p.receiptNo  || '';
      if (_p.cardLast4)       _sotJob.CardLast4 = _p.cardLast4;
    }
    _sotJob.driverId         = _sotJob.driverId      || _sotDrvId;
    _sotJob.VehicleId        = _sotJob.VehicleId     || _sotVehId;
    _sotJob.OfflineSynced    = true;
    _sotJob.OfflineSyncedAt  = new Date().toISOString();
    _sotJob.CompletedBy      = _sotJob.CompletedBy || 'Driver (offline)';

    // Move to closedJobStore if terminal, otherwise leave in jobStore
    const _sotTerminal = ['Completed','Cancelled'].includes(_sotJob.BookingStatus);
    if (_sotTerminal) {
      const _sotIdx = jobStore.indexOf(_sotJob);
      if (_sotIdx !== -1) jobStore.splice(_sotIdx, 1);
      closedJobStore.push(_sotJob);
      saveJobStore();
      saveClosedJobStore();
      if (_sotJob.BookingStatus === 'Completed') _patchRentalComplete(_sotJob);
      // §FBcleanup — driver-app offline-sync completion/cancellation.
      _bwClearJobFromFirebase(_sotJob.companyId || sessionCompanyId, _sotJob.Id,
        _sotVehId || _sotJob.VehicleNo || _sotJob.CallSign || '',
        _sotDrvId || _sotJob.DriverId || '', _sotJob.BookingStatus);
      // Release the driver in ZONE_DRIVERS
      const _sotZd = ZONE_DRIVERS.find(d =>
        String(d.driverid) === _sotDrvId || String(d.VehicleId) === _sotDrvId ||
        String(d.driverid) === _sotVehId || String(d.VehicleId) === _sotVehId);
      if (_sotZd) {
        const _sotQ = calcRestoredQueue(_sotDrvId, _sotZd.zonename || '');
        _sotZd.vehiclestatus  = 'Available';
        _sotZd.zonequeue      = _sotQ;
        _sotZd.queueWaitSince = Date.now();
        _sotZd.jobpickup = ''; _sotZd.jobdropoff = ''; _sotZd.JobphoneNo = '';
      }
      clearAwayLock(_sotDrvId);
      clearDriverHomeState(_sotDrvId);
    } else {
      saveJobStore();
    }

    console.log(`[syncOfflineTrip] job #${_sotJobId} → ${_sotJob.BookingStatus} (${_sotSorted.length} events, fare=${_sotJob.TotalFare || 0})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true, jobId: _sotJobId, status: _sotJob.BookingStatus,
      fare: _sotJob.TotalFare || 0,
      message: 'Offline trip synced successfully.'
    }));
    return;
  }

  // ── POST /api/job/create — central job creation for all apps ───────────────
  // Creates a Pending job in jobStore and returns the canonical job ID.
  // No auth key required — companyId is the tenant identifier.
  // CORS pre-flight OPTIONS is handled globally at the top of the request handler.
  if (urlPath === '/api/job/create' && req.method === 'POST') {
    const _cjBody = await readBody(req);
    let _cjData = {};
    try { _cjData = JSON.parse(_cjBody); } catch(e) {}

    const _cjCid     = ((_cjData.companyId) || '').toString().trim();
    const _cjSource  = ((_cjData.source)    || 'dispatch').toString().toLowerCase().trim();
    const _cjPax     = _cjData.passenger || {};
    const _cjPick    = _cjData.pickup    || {};
    const _cjDrop    = _cjData.dropoff   || {};
    const _cjTariff  = ((_cjData.tariffId) || '').toString().trim();
    const _cjNotes   = ((_cjData.notes)    || '').toString().trim();
    const _cjPickDT  = ((_cjData.pickupTime) || '').toString().trim(); // optional scheduled pickup

    // Validate
    if (!_cjCid) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'companyId is required' }));
      return;
    }
    // Guard: companyId must be purely numeric. A company name (e.g. "Auckland Cabs")
    // produces a letter-prefixed job ID ("abs2605...") which syncOfflineTrip rejects.
    if (!/^\d+$/.test(_cjCid)) {
      console.error(`[/api/job/create] INVALID companyId — received: "${_cjCid}". ` +
        `Expected a numeric string like "620611". Fix the web booking site configuration.`);
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        ok: false,
        error: `companyId must be a numeric string (received: "${_cjCid}"). ` +
          `If you are passing a company name instead of a numeric company ID, fix the calling configuration.`,
        receivedCompanyId: _cjCid,
      }));
      return;
    }
    if (!BOOKING_SOURCES.has(_cjSource)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `source must be one of: ${[...BOOKING_SOURCES].join(' | ')}` }));
      return;
    }

    const _cjIdStr   = newCompanyJobId(_cjCid);
    const _cjIdNum   = Number(_cjIdStr); // safe: fits in JS float exactly
    const _cjCreated = Date.now();
    const _cjNow     = new Date().toISOString();

    const _cjJob = {
      Id:                 _cjIdNum,
      companyId:          _cjCid,
      BookingStatus:      'Pending',
      BookingSource:      _cjSource,
      source:             _cjSource,
      Name:               ((_cjPax.name)   || '').toString().trim(),
      PhoneNo:            ((_cjPax.phone)  || '').toString().trim(),
      PickAddress:        ((_cjPick.address) || '').toString().trim(),
      PickLatLng:         `${_cjPick.lat || 0},${_cjPick.lng || 0}`,
      DropAddress:        ((_cjDrop.address) || '').toString().trim(),
      DropLatLng:         `${_cjDrop.lat || 0},${_cjDrop.lng || 0}`,
      TariffId:           _cjTariff,
      Notes:              _cjNotes,
      BookingDateTime:    _cjNow,
      Pickingtime:        _cjPickDT || _cjNow,
      DriverId:           0,
      VehicleId:          0,
      Passengers:         parseInt(_cjData.passengers || '1') || 1,
      Bags:               parseInt(_cjData.bags       || '0') || 0,
      WheelChairs:        parseInt(_cjData.wheelchairs || '0') || 0,
      DispatchTimebefore: '0',
      VehiclesReguired:   1,
      EstimatedDistance:  ((_cjData.distance) || '0').toString(),
      EstimatedTime:      ((_cjData.duration) || '0').toString(),
      AccountId:          '',
      VehicleNo:          null,
      CallSign:           null,
      webstatus:          '0',
      createdAt:          _cjCreated,
      createdVia:         '/api/job/create',
    };

    // For "dispatch" source, InsertBookingv4 is called immediately after with the full
    // form data — it will create the actual job entry using ExternalJobId.
    // Only push to jobStore for non-dispatch sources (hail, passenger, web, etc.)
    // where the caller passes complete data and there is no follow-up InsertBookingv4.
    if (_cjSource !== 'dispatch') {
      jobStore.push(_cjJob);
      saveJobStore();
    }

    console.log(`200: POST /api/job/create -> reserved job #${_cjIdStr} companyId=${_cjCid} source=${_cjSource} pax="${_cjJob.Name}"`);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, jobId: _cjIdStr, createdAt: _cjCreated }));
    return;
  }

  // ── POST /api/payment/confirm — Stripe / web-portal payment confirmation ────
  // Called by the SA portal (or a Stripe webhook adapter) once Stripe confirms a
  // successful payment for a web booking.
  //
  // Effect 1 — Updates the in-memory jobStore entry with paymentStatus:'paid' so
  //   the auto-dispatch payment gate (BUG 7) lifts on the very next 10-s cycle.
  //
  // Effect 2 — Writes a schema-COMPLETE record to Firebase pendingjobs/{cid}/{jobId}
  //   with every field the dispatcher pipeline (_normFbJob / _doSend) needs:
  //   BookingSource, WebBooking, paymentStatus, PickAddress, DropAddress, etc.
  //   Root cause of Bug 1: the SA portal's Stripe webhook spread the raw allbookings
  //   record into pendingjobs — allbookings can omit or mis-case these fields —
  //   so the dispatcher silently skipped the job or built a broken notification.
  //   We build the record explicitly here to close that gap permanently.
  //
  // Auth: X-Admin-Key header (same secret used by /api/syncOfflineTrip etc.)
  // Body (JSON): { jobId, companyId, paymentStatus?, paymentMethod?, stripeChargeId?,
  //               pickupLocation?: {address,lat,lng},
  //               dropoffLocation?: {address,lat,lng},
  //               passengerName?, phone?, notes? }
  if (urlPath === '/api/payment/confirm' && req.method === 'POST') {
    const _pcRaw = await readBody(req);
    let _pcBody = {};
    try { _pcBody = JSON.parse(_pcRaw); } catch(e) {}

    const _pcKey      = (req.headers['x-admin-key'] || _pcBody.adminKey || '').toString().trim();
    const _pcJobId    = (_pcBody.jobId     || '').toString().trim();
    const _pcCid      = (_pcBody.companyId || '').toString().trim();
    const _pcStatus   = (_pcBody.paymentStatus  || 'paid').toString().toLowerCase().trim();
    const _pcMethod   = (_pcBody.paymentMethod  || 'card').toString().trim();
    const _pcChargeId = (_pcBody.stripeChargeId || _pcBody.chargeId || '').toString().trim();
    const _pcPickup   = _pcBody.pickupLocation  || {};
    const _pcDropoff  = _pcBody.dropoffLocation || {};

    if (_pcKey !== ADMIN_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorised — invalid adminKey' }));
      return;
    }
    if (!_pcJobId || !_pcCid) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'jobId and companyId are required' }));
      return;
    }
    if (!/^\d+$/.test(_pcCid)) {
      console.error(`[/api/payment/confirm] INVALID companyId: "${_pcCid}"`);
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: `companyId must be numeric — received: "${_pcCid}"`, receivedCompanyId: _pcCid }));
      return;
    }

    // 1. Update in-memory jobStore — lifts payment gate for auto-dispatch immediately
    const _pcJobIdNum = parseInt(_pcJobId, 10) || 0;
    const _pcJob = jobStore.find(j =>
      (j.Id === _pcJobIdNum || String(j.Id) === _pcJobId || j._fbKey === _pcJobId) &&
      String(j.companyId || '') === _pcCid
    );
    if (_pcJob) {
      _pcJob.paymentStatus = _pcStatus;
      if (_pcPickup.address  && !_pcJob.PickAddress) _pcJob.PickAddress = _pcPickup.address;
      if (_pcDropoff.address && !_pcJob.DropAddress) _pcJob.DropAddress = _pcDropoff.address;
      if (_pcPickup.lat  && !_pcJob.PickLatLng) _pcJob.PickLatLng  = `${_pcPickup.lat},${_pcPickup.lng  || 0}`;
      if (_pcDropoff.lat && !_pcJob.DropLatLng) _pcJob.DropLatLng  = `${_pcDropoff.lat},${_pcDropoff.lng || 0}`;
      if (!_pcJob.BookingSource || _pcJob.BookingSource === 'passenger') _pcJob.BookingSource = 'Website';
      saveJobStore();
      console.log(`[payment/confirm] jobStore job #${_pcJobId} → paymentStatus:'${_pcStatus}' BookingSource:'${_pcJob.BookingSource}'`);
    } else {
      console.warn(`[payment/confirm] job #${_pcJobId} (cid=${_pcCid}) not found in jobStore — Firebase-only update`);
    }

    // 2. Build a schema-complete pendingjobs record.
    //    Every field the dispatcher pipeline needs is set EXPLICITLY — no raw spread
    //    of allbookings which may have different casing or missing fields (Bug 1 root cause).
    const _pcFbJob = {
      BookingId:      _pcJobId,
      companyId:      _pcCid,
      CompanyId:      _pcCid,
      Status:         'Pending',
      status:         'pending',
      BookingSource:  'Website',
      WebBooking:     true,
      paymentStatus:  _pcStatus,
      PaymentStatus:  _pcStatus,
      paymentMethod:  _pcMethod,
      PaymentMethod:  _pcMethod,
      stripeChargeId: _pcChargeId || null,
      // Address fields — top-level keys the dispatcher reads directly
      PickAddress:    (_pcPickup.address  || (_pcJob && _pcJob.PickAddress)  || ''),
      DropAddress:    (_pcDropoff.address || (_pcJob && _pcJob.DropAddress) || ''),
      PickLatLng:     _pcPickup.lat  ? `${_pcPickup.lat},${_pcPickup.lng  || 0}` : ((_pcJob && _pcJob.PickLatLng)  || ''),
      DropLatLng:     _pcDropoff.lat ? `${_pcDropoff.lat},${_pcDropoff.lng || 0}` : ((_pcJob && _pcJob.DropLatLng) || ''),
      // Passenger / booking details
      Name:           (_pcJob && _pcJob.Name)    || _pcBody.passengerName || '',
      PassengerName:  (_pcJob && _pcJob.Name)    || _pcBody.passengerName || '',
      PhoneNo:        (_pcJob && _pcJob.PhoneNo) || _pcBody.phone         || '',
      VehicleType:    (_pcJob && _pcJob.VehicleType) || 'Not Specified',
      ServiceType:    (_pcJob && _pcJob.serviceType) || 'taxi',
      BookingDateTime: (_pcJob && _pcJob.BookingDateTime) || new Date().toISOString(),
      ScheduledFor:   (_pcJob && _pcJob.ScheduledFor)  || 0,
      ScheduledForMs: (_pcJob && _pcJob.ScheduledFor)  || 0,
      Notes:          (_pcJob && _pcJob.Notes) || _pcBody.notes || '',
      Passengers:     (_pcJob && _pcJob.Passengers)    || 1,
      DispatchTimebefore: (_pcJob && _pcJob.DispatchTimebefore) || '0',
      updatedAt:      new Date().toISOString(),
    };

    // Fire-and-forget — do not block the HTTP response on Firebase writes
    getFirebaseServerToken().then(tok => {
      if (!tok) return Promise.resolve();
      return Promise.all([
        firebaseDbPatch(`pendingjobs/${_pcCid}/${_pcJobId}`, _pcFbJob, tok),
        firebaseDbPatch(`allbookings/${_pcCid}/${_pcJobId}`, {
          paymentStatus:  _pcStatus,
          PaymentStatus:  _pcStatus,
          BookingSource:  'Website',
          WebBooking:     true,
          stripeChargeId: _pcChargeId || null,
          updatedAt:      new Date().toISOString(),
        }, tok),
      ]);
    }).then(() => {
      console.log(`  [payment/confirm] Firebase pendingjobs+allbookings/${_pcCid}/${_pcJobId} updated`);
    }).catch(e => {
      console.warn(`  [payment/confirm] Firebase update failed (non-fatal): ${e.message}`);
    });

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, jobId: _pcJobId, paymentStatus: _pcStatus }));
    return;
  }

  // ── POST /api/stripe/webhook — Stripe payment event receiver (SA portal) ─────
  //
  // Stripe fires this when a Checkout session or Payment Intent completes.
  // This IS the SA portal's webhook handler — the SA portal and dispatch server are
  // the same process (server.js). There is no separate HTTP call to /api/payment/confirm;
  // the same Firebase update logic runs directly here.
  //
  // ┌─ Required Stripe dashboard configuration ──────────────────────────────────┐
  // │  Webhook URL:                                                               │
  // │    Dev:  https://{REPLIT_DEV_DOMAIN}/api/stripe/webhook                    │
  // │    Prod: https://{DEPLOYED_DOMAIN}/api/stripe/webhook                      │
  // │                                                                             │
  // │  Current dev URL:                                                           │
  // │    https://01067f31-afeb-4a32-a195-60c80223accf-00-dgff2mfkeoci.riker.replit.dev/api/stripe/webhook
  // │                                                                             │
  // │  Events to enable:                                                          │
  // │    checkout.session.completed                                               │
  // │    payment_intent.succeeded   (fallback for non-Checkout flows)             │
  // │                                                                             │
  // │  Signing secret: set STRIPE_WEBHOOK_SECRET env var (whsec_xxx from         │
  // │  Stripe dashboard → Developers → Webhooks → your endpoint → Signing secret) │
  // └─────────────────────────────────────────────────────────────────────────────┘
  //
  // Required session metadata (set when creating the Stripe Checkout session):
  //   metadata.bookingId    — the Firebase/dispatch booking key (numeric string)
  //   metadata.companyId    — the numeric company ID (e.g. "620611") — NOT the name
  //   metadata.eventType    — "booking_payment" (to skip rental/subscription events)
  //   metadata.pickupAddress, metadata.dropoffAddress  (optional — fill schema)
  //   metadata.pickupLat, metadata.pickupLng, metadata.dropoffLat, metadata.dropoffLng
  //
  // Out of scope: rental/towing Stripe flows, subscription invoice events.
  if (urlPath === '/api/stripe/webhook' && req.method === 'POST') {
    // Must read the raw body for Stripe signature verification (before any JSON.parse)
    const _swRawBody = await readBody(req);
    const _swSig     = req.headers['stripe-signature'] || '';
    const _swSecret  = process.env.STRIPE_WEBHOOK_SECRET || '';

    let _swEvent = null;
    if (_swSecret) {
      // Verify Stripe signature — protects against spoofed webhook calls
      try {
        const _swStripe = getStripe();
        _swEvent = _swStripe.webhooks.constructEvent(_swRawBody, _swSig, _swSecret);
      } catch (e) {
        console.error(`[stripe/webhook] Signature verification FAILED: ${e.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Webhook signature verification failed' }));
        return;
      }
    } else {
      // No signing secret — accept without verification (development only)
      console.warn('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set — processing without signature check. Set this env var in production.');
      try { _swEvent = JSON.parse(_swRawBody); } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    }

    // Stripe requires a 200 response within 30 s — acknowledge immediately before
    // any async work. If we time out, Stripe will retry the webhook (up to 3 days).
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));

    const _swType = (_swEvent && _swEvent.type) || '';
    const _swObj  = (_swEvent && _swEvent.data && _swEvent.data.object) || {};
    const _swMeta = _swObj.metadata || {};

    console.log(`[stripe/webhook] event=${_swType} id=${(_swEvent && _swEvent.id) || '?'}`);

    // Only process booking_payment events — skip rental, subscription, etc.
    // Accept events that have metadata.bookingId OR metadata.eventType === 'booking_payment'
    const _swIsBookingPmt = _swMeta.eventType === 'booking_payment' || !!(_swMeta.bookingId || _swMeta.booking_id);
    if (!_swIsBookingPmt) {
      console.log(`[stripe/webhook] Skipping non-booking-payment event: ${_swType}`);
      return;
    }
    if (_swType !== 'checkout.session.completed' && _swType !== 'payment_intent.succeeded') {
      console.log(`[stripe/webhook] Unhandled event type for booking_payment: ${_swType} — add handler if needed`);
      return;
    }

    // Extract booking details from Stripe session/intent metadata
    const _swBookingId = (_swMeta.bookingId  || _swMeta.booking_id  || '').toString().trim();
    const _swCid       = (_swMeta.companyId  || _swMeta.company_id  || '').toString().trim();
    const _swChargeId  = (_swObj.payment_intent || _swObj.id         || '').toString().trim();
    const _swPickAddr  = (_swMeta.pickupAddress  || _swMeta.pickup_address  || '').toString().trim();
    const _swDropAddr  = (_swMeta.dropoffAddress || _swMeta.dropoff_address || '').toString().trim();
    const _swPickLat   = parseFloat(_swMeta.pickupLat  || _swMeta.pickup_lat  || '0') || 0;
    const _swPickLng   = parseFloat(_swMeta.pickupLng  || _swMeta.pickup_lng  || '0') || 0;
    const _swDropLat   = parseFloat(_swMeta.dropoffLat || _swMeta.dropoff_lat || '0') || 0;
    const _swDropLng   = parseFloat(_swMeta.dropoffLng || _swMeta.dropoff_lng || '0') || 0;
    const _swPaxName   = (_swMeta.passengerName || (_swObj.customer_details && _swObj.customer_details.name)  || '').toString().trim();
    const _swPhone     = (_swMeta.phone         || (_swObj.customer_details && _swObj.customer_details.phone) || '').toString().trim();
    const _swAmountPaid= ((_swObj.amount_total || _swObj.amount || 0) / 100); // cents → dollars

    if (!_swBookingId || !_swCid) {
      console.error(
        `[stripe/webhook] MISSING METADATA — bookingId="${_swBookingId}" companyId="${_swCid}" ` +
        `event=${_swType} stripeId=${(_swEvent && _swEvent.id) || '?'}. ` +
        `Add metadata.bookingId and metadata.companyId when creating the Stripe session.`
      );
      return;
    }
    if (!/^\d+$/.test(_swCid)) {
      console.error(
        `[stripe/webhook] companyId is NOT numeric: "${_swCid}" — ` +
        `pass the numeric company ID (e.g. "620611"), not the company name.`
      );
      return;
    }

    // 1. Update in-memory jobStore — lifts auto-dispatch BUG-7 payment gate immediately
    const _swJobIdNum = parseInt(_swBookingId, 10) || 0;
    const _swJob = jobStore.find(j =>
      (j.Id === _swJobIdNum || String(j.Id) === _swBookingId || j._fbKey === _swBookingId) &&
      String(j.companyId || '') === _swCid
    );
    if (_swJob) {
      _swJob.paymentStatus = 'paid';
      if (_swPickAddr && !_swJob.PickAddress) _swJob.PickAddress = _swPickAddr;
      if (_swDropAddr && !_swJob.DropAddress) _swJob.DropAddress = _swDropAddr;
      if (_swPickLat && !_swJob.PickLatLng)   _swJob.PickLatLng  = `${_swPickLat},${_swPickLng}`;
      if (_swDropLat && !_swJob.DropLatLng)   _swJob.DropLatLng  = `${_swDropLat},${_swDropLng}`;
      if (!_swJob.BookingSource || _swJob.BookingSource === 'passenger') _swJob.BookingSource = 'Website';
      saveJobStore();
      console.log(`[stripe/webhook] jobStore job #${_swBookingId} → paymentStatus:'paid' (charge=${_swChargeId} $${_swAmountPaid})`);
    } else {
      console.warn(`[stripe/webhook] job #${_swBookingId} (cid=${_swCid}) not found in jobStore — Firebase-only update`);
    }

    // 2. Write schema-complete pendingjobs record.
    //    Replaces the old "spread raw allbookings into pendingjobs" pattern that was
    //    the root cause of Bug 1 — every dispatcher-required field is set explicitly.
    const _swFbJob = {
      BookingId:      _swBookingId,
      companyId:      _swCid,
      CompanyId:      _swCid,
      Status:         'Pending',
      status:         'pending',
      BookingSource:  'Website',
      WebBooking:     true,
      paymentStatus:  'paid',
      PaymentStatus:  'paid',
      paymentMethod:  'card',
      PaymentMethod:  'card',
      stripeChargeId: _swChargeId || null,
      amountPaid:     _swAmountPaid || null,
      PickAddress:    (_swPickAddr || (_swJob && _swJob.PickAddress)  || ''),
      DropAddress:    (_swDropAddr || (_swJob && _swJob.DropAddress) || ''),
      PickLatLng:     _swPickLat ? `${_swPickLat},${_swPickLng}` : ((_swJob && _swJob.PickLatLng) || ''),
      DropLatLng:     _swDropLat ? `${_swDropLat},${_swDropLng}` : ((_swJob && _swJob.DropLatLng) || ''),
      Name:           (_swPaxName || (_swJob && _swJob.Name)   || ''),
      PassengerName:  (_swPaxName || (_swJob && _swJob.Name)   || ''),
      PhoneNo:        (_swPhone   || (_swJob && _swJob.PhoneNo) || ''),
      VehicleType:    ((_swJob && _swJob.VehicleType) || 'Not Specified'),
      ServiceType:    ((_swJob && _swJob.serviceType) || 'taxi'),
      BookingDateTime:((_swJob && _swJob.BookingDateTime) || new Date().toISOString()),
      ScheduledFor:   ((_swJob && _swJob.ScheduledFor)  || 0),
      ScheduledForMs: ((_swJob && _swJob.ScheduledFor)  || 0),
      Notes:          ((_swJob && _swJob.Notes)          || ''),
      Passengers:     ((_swJob && _swJob.Passengers)     || 1),
      DispatchTimebefore: ((_swJob && _swJob.DispatchTimebefore) || '0'),
      updatedAt:      new Date().toISOString(),
    };

    // 3. allbookings update — keep existing write in place per task spec step 3.
    //    Only patches payment fields; does not overwrite address/name data.
    const _swAbPatch = {
      paymentStatus:  'paid',
      PaymentStatus:  'paid',
      Status:         'Pending',
      BookingSource:  'Website',
      WebBooking:     true,
      stripeChargeId: _swChargeId || null,
      amountPaid:     _swAmountPaid || null,
      updatedAt:      new Date().toISOString(),
    };

    getFirebaseServerToken().then(tok => {
      if (!tok) return Promise.resolve();
      return Promise.all([
        firebaseDbPatch(`pendingjobs/${_swCid}/${_swBookingId}`, _swFbJob, tok),
        firebaseDbPatch(`allbookings/${_swCid}/${_swBookingId}`, _swAbPatch, tok),
      ]);
    }).then(() => {
      console.log(`  [stripe/webhook] Firebase pendingjobs+allbookings/${_swCid}/${_swBookingId} updated`);
    }).catch(e => {
      // Must not throw — webhook response already sent; Stripe would re-deliver on timeout
      console.error(`  [stripe/webhook] Firebase update FAILED for booking #${_swBookingId}: ${e.message}`);
    });
    return;
  }

  // ── GET /api/driver/myjob — driver app startup recovery ────────────────────
  // Called by the driver app on launch to check if they have an active/assigned job
  // waiting from before a crash.  Returns the job details if found, or { found: false }.
  // Auth: X-Admin-Key header or ?adminKey= query param.
  if (urlPath === '/api/driver/myjob' && req.method === 'GET') {
    const _dmjQs = new URL('http://x' + req.url).searchParams;
    const _dmjKey = (req.headers['x-admin-key'] || _dmjQs.get('adminKey') || '').toString().trim();
    if (_dmjKey !== ADMIN_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorised' }));
      return;
    }
    const _dmjDriverId  = (_dmjQs.get('driverId') || _dmjQs.get('driverid') || '').toString().trim();
    const _dmjVehicleId = (_dmjQs.get('vehicleId') || _dmjQs.get('vehicleid') || '').toString().trim();
    const _dmjCompanyId = (_dmjQs.get('companyId') || _dmjQs.get('companyid') || '').toString().trim();
    if (!_dmjDriverId && !_dmjVehicleId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'driverId or vehicleId is required' }));
      return;
    }
    const ACTIVE_ST = new Set(['Offered','Assigned','Active','Picking','Arrived']);
    const _dmjJob = jobStore.find(j => {
      const companyMatch = !_dmjCompanyId || String(j.companyId || j.CompanyId || '') === _dmjCompanyId;
      const driverMatch  = (String(j.DriverId) === _dmjDriverId || String(j.VehicleId) === _dmjDriverId ||
                            String(j.DriverId) === _dmjVehicleId || String(j.VehicleId) === _dmjVehicleId);
      return companyMatch && driverMatch && ACTIVE_ST.has(j.BookingStatus);
    });
    if (_dmjJob) {
      // Driver has a live job — clear any stale reconnect flag so it doesn't interfere
      consumeDriverReconnectPending(_dmjDriverId || _dmjVehicleId);
      console.log(`200: GET /api/driver/myjob — driver ${_dmjDriverId||_dmjVehicleId} has job #${_dmjJob.Id} (${_dmjJob.BookingStatus})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        found:        true,
        jobId:        _dmjJob.Id,
        status:       _dmjJob.BookingStatus,
        pickAddress:  _dmjJob.PickAddress  || '',
        dropAddress:  _dmjJob.DropAddress  || '',
        passengerName: _dmjJob.Name || _dmjJob.passengername || '',
        bookingDateTime: _dmjJob.BookingDateTime || '',
        passengers:   _dmjJob.Passengers || 1,
        fare:         _dmjJob.Fare || _dmjJob.TotalFare || 0,
        paymentType:  _dmjJob.PaymentType || _dmjJob.paymentType || 'cash',
      }));
    } else {
      console.log(`200: GET /api/driver/myjob — driver ${_dmjDriverId||_dmjVehicleId} has no active job`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ found: false }));
    }
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
      '[changeriddestatusforoffer]', '[DriverStatusChanged]', '[BwForceDriver]',
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
      'GetStripePayments',
      // Messaging
      '[MessageInsert]', '[DriverMessageInsert]', '[BroadcastMessage]',
      '[GroupMessage]', '[DeleteMessage]',
      // Admin
      '[KickDriver]', '[DispatcherKickUsers]', '[GetSuspendedDrivers]', '[UnsuspendDriver]', '[UpdateSuspensionTime]', '[UpdateQueueNo]',
      '[ZonesListUpdate]', '[payment_percentage]', '[storeemergency]',
      '[CancelJobStatusFromJobList]', '[QuickSetNoOne]',
      '[TariffSync]',
      '[QueueJob]', '[RecallQueuedJob]', '[GetQueuedJobs]', '[PromoteQueuedToAssigned]',
      // Payments
      '[InsertPassengerBalance]', '[GetPassengerBalance]',
      // Web / Passenger bookings — all handled locally
      '[IngestPassengerJob]', '[UpdateScheduledLeadTime]',
      // ACC / Business Account / Passenger — all local storage, never proxy
      '[searchmulti]',
      'Manager_ACC_ADD', 'Client_ACC_ADD',
      'ACC_Approval_add', 'ACC_Approval_update', 'ACC_Extend', 'ACC_TripUsed',
      'Business_Account_ADD', 'Business_Account_GET', 'Passenger_ADD',
      'checkmanagername', 'checkmanageremail', 'checkmanagerphone', 'checkpassengernumber',
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
        const newId = parseInt(param('ExternalJobId') || '', 10) || newCompanyJobId(sessionCompanyId || '000');
        const pickAddr = param('PickLocation') || param('PickAddress') || 'Unknown pickup';
        const dropAddr = param('DropLocation') || param('DropAddress') || '';
        const pickLatLng = param('PickLatLng') || '-46.4120,168.3538';
        const dropLatLng = param('DropLatLng') || '0,0';
        // Client sends the pickup time as { name:"DateTime", Value:"YYYY-MM-DD HH:mm:ss" }
        // where the string is the COMPANY'S LOCAL TIME (NZ).  Check both field names.
        const _dtRaw1   = param('DateTime') || param('BookingDateTime') || '';
        // Parse the local-time string → UTC ms so ScheduledFor is correct for calcJobMins.
        const _scheduledMs1 = _parseLocalDT(_dtRaw1, sessionCompanyId);
        const bookingDT = _dtRaw1 || fmtDT(new Date());
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
        const serviceType = (['taxi','food','freight','tm'].includes((param('serviceType') || '').toLowerCase()))
          ? param('serviceType').toLowerCase() : 'taxi';

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
          Acc_job_id: param('Acc_job_id') || '', Account_id: param('Account_id') || '', Acc_claim_id: param('Acc_claim_id') || '',
          Account_Name: (() => { const _aid = param('Account_id') || ''; if (!_aid) return ''; const _ba = businessAccStore.find(b => String(b.id) === String(_aid) && b.companyId === sessionCompanyId); return _ba ? (_ba.name || '') : ''; })(),
          PickAddress: pickAddr, DropAddress: dropAddr,
          EntitiesDetails: entitiesDetails, U_id: u_id,
          BookingSource: param('Source') || 'Dispatch Console',
          BookingStatus: bookstatus,
          VehicleType: vehicleType,
          serviceType: serviceType,
          Urgent: param('Urgent') || 'No',
          CornerAddress: param('CornerAddress') || '',
          Notes: (param('Urgent') === 'Yes' ? '⚡ URGENT JOB ⚡ ' : '') + (param('Notes') || param('notes') || ''),
          DispatchNotes: (param('Urgent') === 'Yes' ? '⚡ URGENT JOB ⚡ ' : '') + (param('Notes') || param('notes') || ''),
          EstimatedDistance: param('Distance') || '0',
          EstimatedTime: param('Time') || '0',
          TarriffType: 'Automatic',
          companyId: sessionCompanyId || '',
          // §99 — createdAt (Unix ms) so wait-timer formula works: Math.floor((Date.now()-createdAt)/60000)
          createdAt: Date.now(),
          // ScheduledFor (UTC ms) for pre-booked jobs — used by calcJobMins so the
          // displayed countdown is correct regardless of server/client timezone.
          ...(_scheduledMs1 && dispatchBefore > 0 ? { ScheduledFor: _scheduledMs1 } : {}),
        };
        // Server-side past-date guard — prevents bookings set in the past from being
        // silently treated as ASAP.  Allow 90 s grace for clock skew / submit delay.
        if (_scheduledMs1 && dispatchBefore > 0 && _scheduledMs1 < Date.now() - 90000) {
          arrayD(res, [{ Result: 'Error: The pickup time is already in the past. Please choose a future date and time.', Error: true }]);
          return;
        }
        // Resolve tariff and custom price from dispatcher form
        { const _tId = String(param('TarriffId') || '').trim();
          const _tName = String(param('TarriffName') || '').trim();
          const _cRate = String(param('CustomeRate') || '').trim();
          if (_tId === '-1') {
            newJob.TarriffType = 'Fixed';
            if (_cRate) { newJob.CustomeRate = _cRate; newJob.RideCost = _cRate; newJob.EstimatedFare = _cRate; }
          } else if (_tName && _tName !== 'Automatic') {
            newJob.TarriffType = _tName;
            newJob.TariffId    = _tId;
          } }
        jobStore.push(newJob);
        saveJobStore();
        // §97 — Write to Firebase pendingjobs so the auto-assign engine can find console jobs.
        // Fire-and-forget: do not block the HTTP response on the Firebase write.
        if (sessionCompanyId) {
          const _fbPendingJob1 = {
            BookingId:        String(newId),
            CompanyId:        String(sessionCompanyId),
            Status:           bookstatus === 'Pending' ? 'Pending' : bookstatus,
            ServiceType:      newJob.serviceType || 'taxi',
            Name:             newJob.Name || '',
            PassengerName:    newJob.Name || '',
            PhoneNo:          newJob.PhoneNo || '',
            PickAddress:      newJob.PickAddress || '',
            DropAddress:      newJob.DropAddress || '',
            PickLatLng:       newJob.PickLatLng || '',
            DropLatLng:       newJob.DropLatLng || '',
            BookingDateTime:  newJob.BookingDateTime || '',
            ScheduledFor:     newJob.ScheduledFor || 0,
            ScheduledForMs:   newJob.ScheduledFor || 0,
            DispatchTimebefore: String(newJob.DispatchTimebefore || '0'),
            VehicleType:      newJob.VehicleType || 'Not Specified',
            BookingSource:    newJob.BookingSource || 'Dispatch Console',
            ZoneId:           0,
            // §99 — createdAt as Unix ms so wait-timer formula works correctly
            createdAt:        newJob.createdAt,
            CreatedAt:        new Date(newJob.createdAt).toISOString(),
            WebBooking:       false,
          };
          getFirebaseServerToken().then(tok => {
            if (!tok) return;
            // Write to pendingjobs AND allbookings (§99)
            return Promise.all([
              firebaseDbSet(`pendingjobs/${sessionCompanyId}/${newId}`, _fbPendingJob1, tok),
              firebaseDbSet(`allbookings/${sessionCompanyId}/${newId}`, _fbPendingJob1, tok),
            ]);
          }).then(() => {
            console.log(`  [InsertBookingv4] Firebase pendingjobs+allbookings/${sessionCompanyId}/${newId} written`);
          }).catch(e => {
            console.warn(`  [InsertBookingv4] Firebase pendingjobs/allbookings write failed (non-fatal): ${e.message}`);
          });
        }
        console.log(`200: POST ${urlPath} [action=InsertBookingv4] -> created job #${newId} (${bookingDT} → sched ${_scheduledMs1 ? new Date(_scheduledMs1).toISOString() : 'ASAP'}) companyId=${sessionCompanyId}`);
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
          if (!job.CompleteAt) job.CompleteAt  = new Date().toISOString();
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
          _patchRentalComplete(job);
          // §FBcleanup — clear all Firebase paths so the trip cannot be resurrected
          // by stale entries (pendingjobs, jobs, online/current, joback, notification).
          _bwClearJobFromFirebase(sessionCompanyId, closeId,
            job.VehicleNo || job.CallSign || '', closingDriverId || '', 'Completed');
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
        const newId = parseInt(param('ExternalJobId') || '', 10) || newCompanyJobId(sessionCompanyId || '000');
        const pickAddr = param('PickLocation') || param('PickAddress') || 'Unknown pickup';
        const dropAddr = param('DropLocation') || param('DropAddress') || '';
        const pickLatLng = param('PickLatLng') || '-46.4120,168.3538';
        const dropLatLng = param('DropLatLng') || '0,0';
        // Client sends the pickup time as { name:"DateTime", Value:"YYYY-MM-DD HH:mm:ss" }
        // where the string is the COMPANY'S LOCAL TIME (NZ).  Check both field names.
        const _dtRaw2   = param('DateTime') || param('BookingDateTime') || '';
        const _scheduledMs2 = _parseLocalDT(_dtRaw2, sessionCompanyId);
        const bookingDT = _dtRaw2 || (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00.`;
        })();
        const pickingDT = param('PickingDateTime') || bookingDT;
        const vehicleType = param('VehicleType') || 'Not Specified';
        const _rawDId2   = parseInt(param('DId') || '0') || 0;
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
        const serviceType2 = (['taxi','food','freight','tm'].includes((param('serviceType') || '').toLowerCase()))
          ? param('serviceType').toLowerCase() : 'taxi';
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
          Acc_job_id: param('Acc_job_id') || '', Account_id: param('Account_id') || '', Acc_claim_id: param('Acc_claim_id') || '',
          Account_Name: (() => { const _aid = param('Account_id') || ''; if (!_aid) return ''; const _ba = businessAccStore.find(b => String(b.id) === String(_aid) && b.companyId === sessionCompanyId); return _ba ? (_ba.name || '') : ''; })(),
          PickAddress: pickAddr, DropAddress: dropAddr,
          EntitiesDetails: entitiesDetails, U_id: u_id,
          BookingSource: param('Source') || 'Dispatch Console',
          BookingStatus: bookstatus,
          VehicleType: vehicleType,
          serviceType: serviceType2,
          Urgent: param('Urgent') || 'No',
          CornerAddress: param('CornerAddress') || '',
          Notes: (param('Urgent') === 'Yes' ? '⚡ URGENT JOB ⚡ ' : '') + (param('Notes') || param('notes') || ''),
          DispatchNotes: (param('Urgent') === 'Yes' ? '⚡ URGENT JOB ⚡ ' : '') + (param('Notes') || param('notes') || ''),
          EstimatedDistance: param('Distance') || '0',
          EstimatedTime: param('Time') || '0',
          TarriffType: 'Automatic',
          companyId: sessionCompanyId || '',
          // §99 — createdAt (Unix ms) so wait-timer formula works: Math.floor((Date.now()-createdAt)/60000)
          createdAt: Date.now(),
          // ScheduledFor (UTC ms) for pre-booked jobs — used by calcJobMins so the
          // displayed countdown is correct regardless of server/client timezone.
          ...(_scheduledMs2 && dispatchBefore > 0 ? { ScheduledFor: _scheduledMs2 } : {}),
        };
        // Server-side past-date guard — prevents bookings set in the past from being
        // silently treated as ASAP.  Allow 90 s grace for clock skew / submit delay.
        if (_scheduledMs2 && dispatchBefore > 0 && _scheduledMs2 < Date.now() - 90000) {
          arrayD(res, [{ Result: 'Error: The pickup time is already in the past. Please choose a future date and time.', Error: true }]);
          return;
        }
        // Resolve tariff and custom price from dispatcher form
        { const _tId2 = String(param('TarriffId') || '').trim();
          const _tName2 = String(param('TarriffName') || '').trim();
          const _cRate2 = String(param('CustomeRate') || '').trim();
          if (_tId2 === '-1') {
            newJob.TarriffType = 'Fixed';
            if (_cRate2) { newJob.CustomeRate = _cRate2; newJob.RideCost = _cRate2; newJob.EstimatedFare = _cRate2; }
          } else if (_tName2 && _tName2 !== 'Automatic') {
            newJob.TarriffType = _tName2;
            newJob.TariffId    = _tId2;
          } }
        jobStore.push(newJob);
        saveJobStore();
        // §97 — Write to Firebase pendingjobs so the auto-assign engine can find console jobs.
        // Fire-and-forget: do not block the HTTP response on the Firebase write.
        if (sessionCompanyId) {
          const _fbPendingJob2 = {
            BookingId:        String(newId),
            CompanyId:        String(sessionCompanyId),
            Status:           bookstatus === 'Pending' ? 'Pending' : bookstatus,
            ServiceType:      newJob.serviceType || 'taxi',
            Name:             newJob.Name || '',
            PassengerName:    newJob.Name || '',
            PhoneNo:          newJob.PhoneNo || '',
            PickAddress:      newJob.PickAddress || '',
            DropAddress:      newJob.DropAddress || '',
            PickLatLng:       newJob.PickLatLng || '',
            DropLatLng:       newJob.DropLatLng || '',
            BookingDateTime:  newJob.BookingDateTime || '',
            ScheduledFor:     newJob.ScheduledFor || 0,
            ScheduledForMs:   newJob.ScheduledFor || 0,
            DispatchTimebefore: String(newJob.DispatchTimebefore || '0'),
            VehicleType:      newJob.VehicleType || 'Not Specified',
            BookingSource:    newJob.BookingSource || 'Dispatch Console',
            ZoneId:           0,
            // §99 — createdAt as Unix ms so wait-timer formula works correctly
            createdAt:        newJob.createdAt,
            CreatedAt:        new Date(newJob.createdAt).toISOString(),
            WebBooking:       false,
          };
          getFirebaseServerToken().then(tok => {
            if (!tok) return;
            // Write to pendingjobs AND allbookings (§99)
            return Promise.all([
              firebaseDbSet(`pendingjobs/${sessionCompanyId}/${newId}`, _fbPendingJob2, tok),
              firebaseDbSet(`allbookings/${sessionCompanyId}/${newId}`, _fbPendingJob2, tok),
            ]);
          }).then(() => {
            console.log(`  [${action}] Firebase pendingjobs+allbookings/${sessionCompanyId}/${newId} written`);
          }).catch(e => {
            console.warn(`  [${action}] Firebase pendingjobs/allbookings write failed (non-fatal): ${e.message}`);
          });
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> created job #${newId} (${bookingDT} → sched ${_scheduledMs2 ? new Date(_scheduledMs2).toISOString() : 'ASAP'}) companyId=${sessionCompanyId}`);
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
          if (_newDT) {
            job.BookingDateTime = _newDT;
            job.Pickingtime = _newDT;
            // Re-derive ScheduledFor so calcJobMins stays accurate after an edit.
            const _editedMs = _parseLocalDT(_newDT, job.companyId || sessionCompanyId);
            if (_editedMs) job.ScheduledFor = _editedMs; else delete job.ScheduledFor;
          }
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
          // Tariff and custom price
          const _uTId   = String(param('TarriffId')   || '').trim();
          const _uTName = String(param('TarriffName')  || '').trim();
          const _uCRate = String(param('CustomeRate')  || '').trim();
          if (_uTId === '-1') {
            job.TarriffType = 'Fixed';
            if (_uCRate) { job.CustomeRate = _uCRate; job.RideCost = _uCRate; job.EstimatedFare = _uCRate; }
          } else if (_uTName && _uTName !== 'Automatic') {
            job.TarriffType = _uTName;
            job.TariffId    = _uTId;
          } else if (_uTId === '0' || _uTName === 'Automatic') {
            job.TarriffType = 'Automatic';
          }
          if (param('Recieve_payment') !== undefined) job.Recieve_payment = String(param('Recieve_payment') || '');
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
          job.JobCompleteTime = new Date().toISOString();
          closedJobStore.push(job);
          jobStore.splice(idx, 1);
          saveJobStore();
          saveClosedJobStore();
          // §FBcleanup — clear Firebase paths so cancelled job cannot be resurrected.
          _bwClearJobFromFirebase(sessionCompanyId, job.Id,
            job.VehicleNo || job.CallSign || '', job.DriverId || '', 'Cancelled');
          // Sync cancellation back to Firebase for Rental jobs
          if (job.rentalRequestId) {
            const _rKey = job.rentalRequestId, _rId = job.Id;
            getFirebaseServerToken().then(token => {
              if (token) firebaseDbPatch(`rentalTaxiRequests/${_rKey}`,
                { status: 'cancelled', cancelledAt: new Date().toISOString(), jobId: _rId }, token
              ).catch(() => {});
            });
          }
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
            job.assignedAt = Date.now();
            job.DriverId = driverId;
            if (driverId > 0) job.VehicleId = driverId;
            const zd = ZONE_DRIVERS.find(d => d.driverid === driverId || d.VehicleId === driverId);
            if (zd) {
              // Save home zone/queue BEFORE the driver is taken off the queue
              saveDriverHomeState(driverId, zd);
              // Capture vehicle number on the job so it persists after the driver goes offline
              if (!job.VehicleNo && zd.vehiclenumber) job.VehicleNo = zd.vehiclenumber;
              if (!job.CallSign  && zd.vehiclenumber) job.CallSign  = zd.vehiclenumber;
              if (!job.UserFName && zd.drivername)   job.UserFName = zd.drivername.split(/\s+/)[0] || '';
              if (!job.UserLName && zd.drivername)   job.UserLName = zd.drivername.split(/\s+/).slice(1).join(' ') || '';
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
          // Sync assignment back to Firebase for Rental jobs
          if (job.rentalRequestId && (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]')) {
            const _rKey = job.rentalRequestId, _rId = job.Id, _rDrv = driverId;
            getFirebaseServerToken().then(token => {
              if (token) firebaseDbPatch(`rentalTaxiRequests/${_rKey}`,
                { status: 'confirmed', assignedDriverId: _rDrv, assignedAt: new Date().toISOString(), jobId: _rId }, token
              ).catch(() => {});
            });
          }
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

      } else if (action === 'Business_Account_ADD') {
        const _baccPayload = {
          name:         (param('name')||'').trim(),
          contact:      (param('contact_name')||param('contact')||'').trim(),
          phone:        (param('phone')||'').trim(),
          email:        (param('email')||'').trim(),
          address:      (param('address')||'').trim(),
          notes:        (param('notes')||'').trim(),
          accountCode:  (param('accountCode')||'').trim(),
          paymentTerms: (param('paymentTerms')||'').trim(),
          active:       true,
          createdAt:    new Date().toISOString(),
        };
        const _baccCid = sessionCompanyId;
        getFirebaseServerToken().then(function(tok) {
          return firebaseDbPush('businessAccounts/' + _baccCid, _baccPayload, tok);
        }).then(function(pushed) {
          const _fbKey = (pushed && pushed.name) ? pushed.name : String(baccNextId++);
          const bacc = Object.assign({ id: _fbKey, companyId: _baccCid, contact_name: _baccPayload.contact }, _baccPayload);
          businessAccStore.push(bacc);
          saveJsonStore(BUSINESS_ACCOUNTS_FILE, businessAccStore);
          console.log(`200: POST ${urlPath} [action=${action}] -> business account "${_fbKey}" "${bacc.name}" saved to Firebase`);
          successD(res, 'Account saved');
        }).catch(function(e) {
          console.warn(`[Business_Account_ADD/DP] Firebase push failed (${e.message}) — saving locally only`);
          const bacc = Object.assign({ id: String(baccNextId++), companyId: _baccCid, contact_name: _baccPayload.contact }, _baccPayload);
          businessAccStore.push(bacc);
          saveJsonStore(BUSINESS_ACCOUNTS_FILE, businessAccStore);
          successD(res, 'Account saved');
        });

      } else if (action === 'InsertAlarm') {
        successD(res, 'Alarm Saved Successfully');
      } else if (action === 'UpdateAlarm' || action === 'UpdateAlarts' || action === 'UpdateAlerts') {
        successD(res, 'Operation Successfully Performed');
      } else if (action === 'storeemergency') {
        successD(res, 'Emergency Stored');

      } else if (action === 'ACC_Approval_add') {
        const app = {
          id: accNextAppId++,
          companyId: sessionCompanyId,
          manager_id:            parseInt(param('manager_id')||'0')||0,
          client_id:             parseInt(param('client_id')||'0')||0,
          acc_id:                (param('acc_id')||'').trim(),
          claim_number:          (param('claim_number')||'').trim(),
          purchase_order_number: (param('purchase_order_number')||'').trim(),
          client_services_code:  (param('client_services_code')||'').trim(),
          trip_from_date:        (param('trip_from_date')||'').trim(),
          trip_to_date:          (param('trip_to_date')||'').trim(),
          trip_status:           (param('trip_status')||'One Way').trim(),
          trip_days_approved:    parseInt(param('trip_days_approved')||'0')||0,
          trip_description:      (param('trip_description')||'').trim(),
          max_price_per_trip:    parseFloat(param('max_price_per_trip')||'0')||0,
          approved_pickup_address:  (param('approved_pickup_address')||'').trim(),
          approved_dropoff_address: (param('approved_dropoff_address')||'').trim(),
          wheelchair:            (param('wheelchair')||'0')==='1',
          created_at:            new Date().toISOString(),
        };
        // derive client details for display
        const _appCli = accClientStore.find(c=>c.id===app.client_id && c.companyId===sessionCompanyId);
        const _appMgr = accManagerStore.find(m=>m.id===app.manager_id && m.companyId===sessionCompanyId);
        app.client_name  = _appCli ? _appCli.client_name  : '';
        app.client_phone = _appCli ? _appCli.client_phone : '';
        app.manager_name  = _appMgr ? _appMgr.manager_name  : '';
        app.manager_email = _appMgr ? _appMgr.manager_email : '';
        app.manager_phone = _appMgr ? _appMgr.manager_phone : '';
        app.trip_days_left = app.trip_days_approved;
        accApprovalStore.push(app);
        saveJsonStore(ACC_APPROVALS_FILE, accApprovalStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval #${app.id} saved`);
        successD(res, 'Approval successfully Saved');

      } else if (action === 'ACC_Approval_update') {
        const updId = parseInt(param('id')||'0')||0;
        const upd = accApprovalStore.find(a=>a.id===updId && a.companyId===sessionCompanyId);
        if (upd) {
          if (param('acc_id'))                upd.acc_id                = (param('acc_id')||'').trim();
          if (param('claim_number'))          upd.claim_number          = (param('claim_number')||'').trim();
          if (param('purchase_order_number')) upd.purchase_order_number = (param('purchase_order_number')||'').trim();
          if (param('client_services_code'))  upd.client_services_code  = (param('client_services_code')||'').trim();
          if (param('trip_from_date'))        upd.trip_from_date        = (param('trip_from_date')||'').trim();
          if (param('trip_to_date'))          upd.trip_to_date          = (param('trip_to_date')||'').trim();
          if (param('trip_status'))           upd.trip_status           = (param('trip_status')||'').trim();
          if (param('trip_days_approved'))    upd.trip_days_approved    = parseInt(param('trip_days_approved')||'0')||0;
          if (param('trip_description'))      upd.trip_description      = (param('trip_description')||'').trim();
          if (param('max_price_per_trip'))    upd.max_price_per_trip    = parseFloat(param('max_price_per_trip')||'0')||0;
          if (param('approved_pickup_address'))  upd.approved_pickup_address  = (param('approved_pickup_address')||'').trim();
          if (param('approved_dropoff_address')) upd.approved_dropoff_address = (param('approved_dropoff_address')||'').trim();
          saveJsonStore(ACC_APPROVALS_FILE, accApprovalStore);
          console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval #${updId} updated`);
          successD(res, 'Approval successfully update');
        } else {
          successD(res, 'Approval not found');
        }

      } else if (action === 'ACC_Extend') {
        // Dispatcher quick-action: extend trips remaining and/or end date only
        const extId = parseInt(param('id')||'0')||0;
        const ext = accApprovalStore.find(a=>a.id===extId && a.companyId===sessionCompanyId);
        if (ext) {
          const addTrips = parseInt(param('add_trips')||'0')||0;
          const newToDate = (param('new_to_date')||'').trim();
          if (addTrips > 0) {
            ext.trip_days_approved += addTrips;
            ext.trip_days_left     = (ext.trip_days_left||0) + addTrips;
          }
          if (newToDate) ext.trip_to_date = newToDate;
          saveJsonStore(ACC_APPROVALS_FILE, accApprovalStore);
          console.log(`200: POST ${urlPath} [action=${action}] -> ACC approval #${extId} extended (+${addTrips} trips, to=${newToDate||'unchanged'})`);
          successD(res, 'Extended successfully');
        } else {
          successD(res, 'Approval not found');
        }

      } else if (action === 'ACC_TripUsed') {
        // Called when a job with an ACC approval is completed — decrements trips_left
        const tuId = parseInt(param('approval_id')||param('id')||'0')||0;
        const tu = accApprovalStore.find(a=>a.id===tuId && a.companyId===sessionCompanyId);
        if (tu && (tu.trip_days_left||0) > 0) {
          tu.trip_days_left = (tu.trip_days_left||0) - 1;
          saveJsonStore(ACC_APPROVALS_FILE, accApprovalStore);
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> trips_left now ${tu?tu.trip_days_left:'?'}`);
        successD(res, 'Trip recorded');

      } else if (action === 'Client_ACC_ADD') {
        const cli = {
          id:                accNextCliId++,
          companyId:         sessionCompanyId,
          manager_id:        parseInt(param('manager_id')||'0')||0,
          client_name:       (param('client_name')||'').trim(),
          client_phone:      (param('client_phone')||'').trim(),
          client_address:    (param('client_address')||'').trim(),
          registration_date: (param('registration_date')||param('client_registration_Date')||'').trim(),
          wheelchair:        (param('wheelchair')||'0')==='1',
          notes:             (param('notes')||'').trim(),
          created_at:        new Date().toISOString(),
        };
        accClientStore.push(cli);
        saveJsonStore(ACC_CLIENTS_FILE, accClientStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC client #${cli.id} "${cli.client_name}" saved`);
        successD(res, 'Client successfully Saved');

      } else if (action === 'Manager_ACC_ADD') {
        const mgr = {
          id:                   accNextMgrId++,
          companyId:            sessionCompanyId,
          manager_name:         (param('manager_name')||'').trim(),
          manager_branch_code:  (param('manager_branch_code')||'').trim(),
          manager_city:         (param('manager_city')||param('manager_branch_code')||'').trim(),
          manager_address:      (param('manager_address')||'').trim(),
          po_box:               (param('po_box')||'').trim(),
          manager_country:      (param('manager_country')||'New Zealand').trim(),
          manager_phone:        (param('manager_phone')||'').trim(),
          manager_phone_ext:    (param('manager_phone_ext')||'').trim(),
          manager_email:        (param('manager_email')||'').trim(),
          registration_date:    (param('registration_date')||'').trim(),
          created_at:           new Date().toISOString(),
        };
        accManagerStore.push(mgr);
        saveJsonStore(ACC_MANAGERS_FILE, accManagerStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> ACC manager #${mgr.id} "${mgr.manager_name}" saved`);
        successD(res, 'Manager successfully Saved');

      } else if (action === 'Business_Account_ADD') {
        const _baccPayload2 = {
          name:         (param('name')||'').trim(),
          contact:      (param('contact_name')||param('contact')||'').trim(),
          phone:        (param('phone')||'').trim(),
          email:        (param('email')||'').trim(),
          address:      (param('address')||'').trim(),
          notes:        (param('notes')||'').trim(),
          accountCode:  (param('accountCode')||'').trim(),
          paymentTerms: (param('paymentTerms')||'').trim(),
          active:       true,
          createdAt:    new Date().toISOString(),
        };
        const _baccCid2 = sessionCompanyId;
        getFirebaseServerToken().then(function(tok) {
          return firebaseDbPush('businessAccounts/' + _baccCid2, _baccPayload2, tok);
        }).then(function(pushed) {
          const _fbKey2 = (pushed && pushed.name) ? pushed.name : String(baccNextId++);
          const bacc2 = Object.assign({ id: _fbKey2, companyId: _baccCid2, contact_name: _baccPayload2.contact }, _baccPayload2);
          businessAccStore.push(bacc2);
          saveJsonStore(BUSINESS_ACCOUNTS_FILE, businessAccStore);
          console.log(`200: POST ${urlPath} [action=${action}] -> business account "${_fbKey2}" "${bacc2.name}" saved to Firebase`);
          successD(res, 'Account saved');
        }).catch(function(e) {
          console.warn(`[Business_Account_ADD/DS] Firebase push failed (${e.message}) — saving locally only`);
          const bacc2 = Object.assign({ id: String(baccNextId++), companyId: _baccCid2, contact_name: _baccPayload2.contact }, _baccPayload2);
          businessAccStore.push(bacc2);
          saveJsonStore(BUSINESS_ACCOUNTS_FILE, businessAccStore);
          successD(res, 'Account saved');
        });

      } else if (action === 'Business_Account_GET') {
        const baccAll = businessAccStore.filter(b=>b.companyId===sessionCompanyId && b.active!==false);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${baccAll.length} business accounts`);
        arrayD(res, baccAll);

      } else if (action === 'Passenger_ADD') {
        const existing = passengerStore.find(p=>p.companyId===sessionCompanyId && p.phone===(param('phone')||'').trim());
        if (!existing) {
          const pas = { id: pasNextId++, companyId: sessionCompanyId, Name: (param('name')||param('Name')||'').trim(), PhoneNo: (param('phone')||'').trim(), Email: (param('email')||'').trim(), Address: (param('address')||'').trim(), created_at: new Date().toISOString() };
          passengerStore.push(pas);
          saveJsonStore(PASSENGERS_FILE, passengerStore);
        }
        successD(res, 'Passenger saved');

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
            companyId:     restored.companyId || sessionCompanyId || '',
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
          // Per-driver double-offer guard: block if this driver already has ANY other job
          // currently in Offered state. The 1-second window was too narrow — a second
          // _sadTrigger fire 1-2 s later could slip through and offer a second job to the
          // same driver, leaving both permanently stuck in Offered.
          if (newStatus === 'Offered' && incomingDriverId) {
            const _existingOffer = jobStore.find(j =>
              j.BookingStatus === 'Offered' &&
              String(j.DriverId) === String(incomingDriverId) &&
              j.Id !== bookingId
            );
            if (_existingOffer) {
              const _age = _existingOffer.offeredAt ? Math.round((Date.now() - _existingOffer.offeredAt) / 1000) : '?';
              console.log(`  [changeriddestatusforoffer/DP] BLOCKED per-driver double-offer: driver ${incomingDriverId} already has job #${_existingOffer.Id} Offered (${_age}s ago), blocking job #${bookingId}`);
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
          // Protect Queued jobs — only [RecallQueuedJob] or [PromoteQueuedToAssigned] may change them.
          // acknowledgemethodx (stale popup path) must never overwrite Queued → Offered.
          if (currentStatus === 'Queued') {
            console.log(`  [changeriddestatusforoffer/DP] BLOCKED: job #${bookingId} is Queued — only RecallQueuedJob/PromoteQueuedToAssigned may change it (attempted: ${newStatus})`);
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
              job.JobCompleteTime = new Date().toISOString();
              const _dcIdx = jobStore.indexOf(job);
              if (_dcIdx !== -1) jobStore.splice(_dcIdx, 1);
              closedJobStore.push(job);
              saveJobStore();
              saveClosedJobStore();
              // §FBcleanup
              _bwClearJobFromFirebase(sessionCompanyId, job.Id,
                job.VehicleNo || job.CallSign || '', _dcDriverId || job.DriverId || '', 'Cancelled');
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
          { const _ts = new Date().toISOString();
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
            if (zdOffer) {
              saveDriverHomeState(incomingDriverId, zdOffer);
              // Capture vehicle number on the job so it persists after the driver goes offline
              if (!job.VehicleNo && zdOffer.vehiclenumber) job.VehicleNo = zdOffer.vehiclenumber;
              if (!job.CallSign  && zdOffer.vehiclenumber) job.CallSign  = zdOffer.vehiclenumber;
              if (!job.UserFName && zdOffer.drivername)   job.UserFName = zdOffer.drivername.split(/\s+/)[0] || '';
              if (!job.UserLName && zdOffer.drivername)   job.UserLName = zdOffer.drivername.split(/\s+/).slice(1).join(' ') || '';
            }
          }
          if (effectiveStatus === 'Assigned') {
            // incomingDriverId already parsed above (handles both '1212' and 'D001' string IDs)
            if (incomingDriverId && incomingDriverId !== '0' && incomingDriverId !== 0) {
              job.DriverId = incomingDriverId; job.VehicleId = incomingDriverId;
              const zdAssign = ZONE_DRIVERS.find(d => d.driverid === incomingDriverId || d.VehicleId === incomingDriverId);
              if (zdAssign) {
                if (!job.VehicleNo && zdAssign.vehiclenumber) job.VehicleNo = zdAssign.vehiclenumber;
                if (!job.CallSign  && zdAssign.vehiclenumber) job.CallSign  = zdAssign.vehiclenumber;
                if (!job.UserFName && zdAssign.drivername)   job.UserFName = zdAssign.drivername.split(/\s+/)[0] || '';
                if (!job.UserLName && zdAssign.drivername)   job.UserLName = zdAssign.drivername.split(/\s+/).slice(1).join(' ') || '';
              }
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
          // Patch Firebase pendingjobs so driver app sees 'Offered' status.
          // Without this, a stale 'Assigned' entry from a previous session causes
          // the driver app to skip the offer screen (it thinks the job is already theirs).
          if (newStatus === 'Offered' && sessionCompanyId) {
            (async () => {
              try {
                const _tok = await getFirebaseServerToken();
                if (_tok) {
                  const _pjUrl = `${FB_DB_URL}/pendingjobs/${sessionCompanyId}/${bookingId}.json?auth=${encodeURIComponent(_tok)}`;
                  const _pjParseLatLng = s => { const p = (s||'').split(','); return p.length===2?{lat:parseFloat(p[0]),lng:parseFloat(p[1])}:null; };
                  const _pjPickLL = _pjParseLatLng(job.PickLatLng);
                  const _pjDropLL = _pjParseLatLng(job.DropLatLng);
                  const _pjPatch = {
                    BookingId:      String(bookingId),
                    Status:         'Offered',
                    BookingStatus:  'Offered',
                    DriverId:       String(incomingDriverId || ''),
                    AssignedDriver: String(incomingDriverId || ''),
                    offeredAt:      Date.now(),
                    PickAddress:    job.PickAddress  || '',
                    DropAddress:    job.DropAddress  || '',
                    PassengerName:  job.Name         || job.UserFName || '',
                    PassengerPhone: job.PhoneNo      || '',
                    Fare:           String(job.EstimatedFare || job.RideCost || job.CustomeRate || ''),
                    CompanyId:      String(sessionCompanyId),
                    ServiceType:    job.serviceType  || 'taxi',
                    BookingSource:  job.BookingSource|| 'Dispatch Console',
                    WebBooking:     false
                  };
                  if (_pjPickLL) _pjPatch.pickupLocation  = { address: job.PickAddress || '', lat: _pjPickLL.lat, lng: _pjPickLL.lng };
                  if (_pjDropLL) _pjPatch.dropoffLocation = { address: job.DropAddress || '', lat: _pjDropLL.lat, lng: _pjDropLL.lng };
                  await fbRequest(_pjUrl, 'PATCH', _pjPatch);
                  console.log(`  [changeriddestatusforoffer/DP] pendingjobs/${sessionCompanyId}/${bookingId} patched → Offered (full payload)`);
                  // Also write jobpickup/jobdropoff to online/{cid}/{vehicleId}/current so
                  // the driver app can display them in the offer screen.
                  const _pjVeh = (job.VehicleNo || job.CallSign || '').toString().trim();
                  if (_pjVeh) {
                    const _ocUrl = `${FB_DB_URL}/online/${sessionCompanyId}/${_pjVeh}/current.json?auth=${encodeURIComponent(_tok)}`;
                    await fbRequest(_ocUrl, 'PATCH', {
                      joboffer:   bookingId,
                      jobpickup:  job.PickAddress  || '',
                      jobdropoff: job.DropAddress  || '',
                      JobphoneNo: job.PhoneNo       || '',
                      jobname:    job.Name          || job.UserFName || '',
                      currentJobId: String(bookingId),
                      jobId:        String(bookingId)
                    });
                    console.log(`  [changeriddestatusforoffer/DP] online/${sessionCompanyId}/${_pjVeh}/current → jobpickup/dropoff written`);
                  }
                }
              } catch(_e) { console.warn('  [changeriddestatusforoffer/DP] pendingjobs patch failed:', _e && _e.message); }
            })();
          }
          // When Unreached: clear job fields from online/{cid}/{vehicleId}/current so the
          // driver app doesn't think the job is still assigned and skips future offer screens.
          if (newStatus === 'Unreached' && sessionCompanyId) {
            const _unrVeh = (job.VehicleNo || job.CallSign || '').toString().trim();
            if (_unrVeh) {
              (async () => {
                try {
                  const _tok2 = await getFirebaseServerToken();
                  if (_tok2) {
                    const _ocUrl2 = `${FB_DB_URL}/online/${sessionCompanyId}/${_unrVeh}/current.json?auth=${encodeURIComponent(_tok2)}`;
                    await fbRequest(_ocUrl2, 'PATCH', { currentJobId: null, jobId: null, joboffer: 0, jobpickup: '', jobdropoff: '', JobphoneNo: '', jobname: '' });
                    console.log(`  [changeriddestatusforoffer/DP] online/${sessionCompanyId}/${_unrVeh}/current cleared (Unreached)`);
                  }
                } catch(_e2) { console.warn('  [changeriddestatusforoffer/DP] online/current clear failed:', _e2 && _e2.message); }
              })();
            }
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} status=${newStatus || 'unchanged'} reason=${returnReason || '-'}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _newQueueNo });

      } else if (action === '[BwForceDriver]') {
        // Force a driver online/offline in ZONE_DRIVERS without needing the Firebase driver app.
        // Used for testing dispatching when the driver app cannot go on shift.
        // Params: driverid (required unless vehiclenumber given), vehiclenumber, drivername,
        //         vehicletype, lat, lng, zonename, online ('false' = force offline).
        const _fdId     = (param('driverid')      || '').toString().trim();
        const _fdVehNo  = (param('vehiclenumber') || '').toString().trim();
        const _fdName   = (param('drivername')    || '').toString().trim();
        const _fdType   = (param('vehicletype')   || 'Sedan').toString().trim();
        const _fdLat    = (param('lat')           || '').toString().trim();
        const _fdLng    = (param('lng')           || '').toString().trim();
        const _fdZone   = (param('zonename')      || '').toString().trim();
        const _fdOnline = param('online') !== 'false';
        const _fdKey    = _fdId || _fdVehNo;
        if (!_fdKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'driverid or vehiclenumber required' }));
          return;
        }
        if (!_fdOnline) {
          const _kept = ZONE_DRIVERS.filter(d =>
            String(d.driverid) !== _fdKey && String(d.vehiclenumber) !== _fdKey && String(d.VehicleId) !== _fdKey
          );
          ZONE_DRIVERS.length = 0;
          _kept.forEach(d => ZONE_DRIVERS.push(d));
          console.log(`[BwForceDriver] forced OFFLINE: ${_fdKey} — ZONE_DRIVERS now ${ZONE_DRIVERS.length}`);
          objectD(res, { dt1: [{ ok: true, action: 'offline', driverid: _fdKey }], dt2: [], dt3: [], dt4: [], dt5: [] });
          return;
        }
        let _fdZd = ZONE_DRIVERS.find(d =>
          String(d.driverid) === _fdKey || String(d.VehicleId) === _fdKey ||
          (_fdVehNo && String(d.vehiclenumber) === _fdVehNo)
        );
        if (_fdZd) {
          _fdZd.vehiclestatus = 'Available';
          if (_fdVehNo) _fdZd.vehiclenumber = _fdVehNo;
          if (_fdName)  _fdZd.drivername    = _fdName;
          if (_fdType)  _fdZd.vehicletype   = _fdType;
          if (_fdZone)  _fdZd.zonename      = _fdZone;
          if (_fdLat)   _fdZd.lat           = _fdLat;
          if (_fdLng)   _fdZd.lng           = _fdLng;
        } else {
          const _maxQ = companyDrivers(ZONE_DRIVERS).reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
          _fdZd = {
            driverid:       _fdKey,
            VehicleId:      _fdId || _fdKey,
            vehiclenumber:  _fdVehNo || _fdKey,
            drivername:     _fdName || _fdVehNo || _fdKey,
            vehicletype:    _fdType,
            vehiclestatus:  'Available',
            lat:            _fdLat,
            lng:            _fdLng,
            zonename:       _fdZone,
            zonequeue:      _maxQ + 1,
            queueWaitSince: Date.now(),
            companyId:      sessionCompanyId,
            _forcedOnline:  true,
          };
          ZONE_DRIVERS.push(_fdZd);
        }
        _firstDriverSeenAfterStart = true;
        console.log(`[BwForceDriver] forced ONLINE: ${_fdKey} (${_fdVehNo || ''}) vehicletype=${_fdType} zone=${_fdZone || '-'} — ZONE_DRIVERS now ${ZONE_DRIVERS.length}`);
        objectD(res, { dt1: [{ ok: true, action: 'online', driverid: _fdKey, vehiclenumber: _fdVehNo || _fdKey, drivername: _fdName || _fdVehNo || _fdKey }], dt2: [], dt3: [], dt4: [], dt5: [] });

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
        let _dscQueueNo = null;         // new queue number to return to client for Firebase write
        let _dscDriverCancelled = null; // set when driver cancels an accepted/assigned job
        let _dscDriverRecalled  = null; // set when driver recalls (job returned to Pending)
        let _dscReconnectJob    = null; // set when crash-reconnect is detected — job kept Assigned
        if (driverId && newStatus) {
          // ── Suspension gate ───────────────────────────────────────────────────
          const _suspCheck = SUSPENDED_DRIVERS.find(s =>
            String(s.driverId) === driverId || String(s.vehicleId) === driverId ||
            (vehiclenumber && (String(s.driverId) === vehiclenumber || String(s.vehicleId) === vehiclenumber))
          );
          if (_suspCheck) {
            const _stillSusp = !_suspCheck.suspendedUntil || new Date(_suspCheck.suspendedUntil).getTime() > Date.now();
            if (_stillSusp) {
              const _untilStr = _suspCheck.suspendedUntil ? new Date(_suspCheck.suspendedUntil).toLocaleString('en-NZ', { timeZone: getCompanyTZ(sessionCompanyId) }) : 'further notice';
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
              // Away from a crash/onDisconnect while driver still has an Assigned job.
              // Record this so when they reconnect and send Available we know NOT to
              // treat it as a deliberate cancel and wipe the job.
              markDriverReconnectPending(driverId);
              console.log(`  [DriverStatusChanged/DP] driver ${driverId} Away IGNORED — driver has an active/assigned job (crash-reconnect pending flagged)`);
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
          // Away status re-registration: if driver sends Away but isn't in ZONE_DRIVERS
          // (e.g. after a server restart), add them so VehiclesStatus includes them.
          // Without this, VehiclesStatus returns null → client clears Away drivers from
          // the board every 30 s → Firebase re-adds them → constant flicker.
          if (newStatus === 'Away' && !zdSync) {
            const _savedZnAw = getSavedZone(driverId);
            ZONE_DRIVERS.push({
              driverid:      driverId,
              VehicleId:     vehiclenumber || driverId,
              drivername:    drivername    || driverId,
              vehiclenumber: vehiclenumber || driverId,
              vehicletype:   (param('vehicletype') || '').toString().trim() || '',
              zonename:      zonename || (_savedZnAw && _savedZnAw.zonename) || '',
              zoneid:        (_savedZnAw && _savedZnAw.zoneid) || '',
              vehiclestatus: 'Away',
              zonequeue:     0,
              lat:           lat || '',
              lng:           lng || '',
              companyId:     sessionCompanyId || '',
            });
            console.log(`  [DriverStatusChanged/DP] driver ${driverId} re-added to ZONE_DRIVERS as Away (post-restart recovery)`);
          }
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
              const hailId = newCompanyJobId(sessionCompanyId || '000');
              const now = new Date().toISOString();
              const pickAddr = (lat && lng) ? `Hail - ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : 'Hail / Street Pickup';
              // Resolve driver name — prefer param, fall back to ZONE_DRIVERS
              const _hailZd = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
              const _hailFullName = drivername || (_hailZd && _hailZd.drivername) || '';
              const _hailParts = _hailFullName.trim().split(/\s+/);
              const _hailNow = new Date().toISOString();
              jobStore.push({
                Id: hailId, BookingStatus: 'Active',
                companyId: sessionCompanyId || '',
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
              console.log(`  [DriverStatusChanged] Hail job #${hailId} created for driver ${driverId} (${vehiclenumber}) companyId=${sessionCompanyId} at ${pickAddr}`);
            }
          }
          // Re-query after potential hail insertion so Available can complete a just-created job
          const allDriverJobs = jobStore.filter(matchesDriver);
          // Only activate ONE job when driver goes Busy (the highest-priority live one).
          // Activating all non-terminal jobs at once causes mass-completion when the
          // driver later goes Available, which is the "accidental cancel" bug.
          let activatedOne = false;
          let _dscCompletedJob = null; // populated when a job is genuinely Completed
          // Pre-compute: if driver has an Active job AND an Assigned job simultaneously,
          // Available = trip completion (not a driver cancel of the Assigned job).
          // This protects a dispatcher-assigned job when driver completes a Hail/street pickup.
          const _hasActiveBeforeAvailable = newStatus === 'Available' &&
            allDriverJobs.some(j => j.BookingStatus === 'Active');
          // §FIX-STALE-AVAIL: pre-compute whether this driver recently completed another job (≤120 s).
          // Used in the Available+Assigned recall branch to detect stale Available signals
          // arriving after the driver accepted a new job (completing prior trip ≠ abandoning new one).
          const _staleAvailNow = Date.now();
          const _priorCompletedMs = newStatus === 'Available' ? (closedJobStore.find(function(cj) {
            return String(cj.DriverId || cj.driverId || '') === String(driverId) &&
                   cj.completedAtMs > 0 && (_staleAvailNow - cj.completedAtMs) < 120000;
          }) || {}).completedAtMs || 0 : 0;
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
              job.assignedAt = Date.now();
              if (!job.AcceptedAt) job.AcceptedAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned`);
            } else if (newStatus === 'Busy' && !activatedOne &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphaned))) {
              // Pending + Busy: driver skipped the Accept step (e.g. Away→Busy after dispatch timeout)
              // but the job's DriverId still matches — activate it so dispatch shows Active.
              job.BookingStatus = 'Active';
              activatedOne = true;
              if (!job.ActiveAt) job.ActiveAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Assigned';
              job.assignedAt = Date.now();
              if (!job.PickingAt) job.PickingAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Assigned (Picking)`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Trip genuinely finished — mark Completed, move to closedJobStore
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = new Date().toISOString();
                job.completedAtMs  = Date.now();
                _stampDriverName(job);
                const _cIdx = jobStore.indexOf(job);
                if (_cIdx !== -1) jobStore.splice(_cIdx, 1);
                closedJobStore.push(job);
                saveJobStore();
                saveClosedJobStore();
                _patchRentalComplete(job);
                // §FBcleanup
                _bwClearJobFromFirebase(sessionCompanyId, job.Id,
                  vehiclenumber || job.VehicleNo || job.CallSign || '',
                  driverId || job.DriverId || '', 'Completed');
                // Capture for Firebase write by the client
                // §108d — resolve paymentType correctly for web (card) bookings.
                // Web booking jobs carry paymentMethod:'card' + paymentStatus:'paid' but
                // do NOT have PaymentType/paymentType (those are TM-specific fields).
                // Priority: PaymentType > paymentType > paymentMethod > PaymentMethod > 'cash'
                const _cjPayMethod = (
                  job.PaymentType   || job.paymentType   ||
                  job.PaymentMethod || job.paymentMethod || 'cash'
                ).toLowerCase();
                _dscCompletedJob = {
                  tripId:      String(job.Id),
                  bookingId:   String(job.Id),        // stored as field — SA portal queries orderByChild('bookingId')
                  bookingRef:  String(job.Id),
                  companyId:   String(sessionCompanyId || ''),
                  driverId:    String(driverId),
                  driverName:  drivername || (job.UserFName ? ((job.UserFName || '') + ' ' + (job.UserLName || '')).trim() : ''),
                  vehicleId:   vehiclenumber || String(job.VehicleNo || job.VehicleId || ''),
                  vehicleNo:   vehiclenumber || String(job.VehicleNo || job.VehicleId || ''),
                  fare:        job.Fare != null ? Number(job.Fare) : (job.TotalFare != null ? Number(job.TotalFare) : 0),
                  paymentType:   _cjPayMethod,
                  paymentMethod: _cjPayMethod,
                  paymentStatus: job.paymentStatus || job.PaymentStatus || '',
                  stripeChargeId: job.stripeChargeId || job.StripeChargeId || null,
                  completedAt: job.completedAtMs,
                  status:      'Completed',
                  source:      'dispatch',
                  pickup:      job.PickAddress || '',
                  dropoff:     job.DropAddress || '',
                  pickupAddress: job.PickAddress || '',
                  dropAddress:   job.DropAddress || '',
                  distanceKm:  job.JobDistance != null ? Number(job.JobDistance)
                               : (job.EstimatedDistance != null ? Number(job.EstimatedDistance)
                               : (job.Distance != null ? Number(job.Distance) : 0)),
                  tmSubsidy:        job.tmSubsidy        != null ? Number(job.tmSubsidy)        : null,
                  tmSubsidyHoist:   job.tmSubsidyHoist   != null ? Number(job.tmSubsidyHoist)   : null,
                  tmPassengerPays:  job.tmPassengerPays  != null ? Number(job.tmPassengerPays)  : null,
                  totalCouncilPays: job.totalCouncilPays != null ? Number(job.totalCouncilPays) : null,
                  councilId:        job.councilId || null,
                  businessAccountId: job.Account_id || '',
                };
                // §108d — patch allbookings at completion so SA portal gets correct
                // paymentMethod and Status regardless of which path created the record.
                // Use getFirebaseServerToken so this fires even without a client auth session.
                (function _patchAllbookingsCompletion(j, cid, pm) {
                  getFirebaseServerToken().then(function(tok) {
                    if (!tok || !cid || !j.Id) return;
                    const _abPatch = {
                      Status:        'Completed',
                      paymentMethod: pm,
                      PaymentMethod: pm,
                      completedAt:   j.JobCompleteTime || new Date().toISOString(),
                    };
                    if (j.paymentStatus || j.PaymentStatus) {
                      _abPatch.paymentStatus = j.paymentStatus || j.PaymentStatus;
                      _abPatch.PaymentStatus = j.paymentStatus || j.PaymentStatus;
                    }
                    if (j.stripeChargeId || j.StripeChargeId) {
                      _abPatch.stripeChargeId = j.stripeChargeId || j.StripeChargeId;
                    }
                    firebaseDbPatch(`allbookings/${cid}/${j.Id}`, _abPatch, tok)
                      .then(function() {
                        console.log(`  [§108d] allbookings/${cid}/${j.Id} → Completed paymentMethod=${pm}`);
                      })
                      .catch(function(e) {
                        console.warn(`  [§108d] allbookings patch failed for job #${j.Id}:`, e && e.message);
                      });
                  });
                })(job, sessionCompanyId, _cjPayMethod);
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
                } else if (consumeDriverReconnectPending(driverId)) {
                  // Driver's Away was previously ignored (crash/onDisconnect pattern).
                  // Their Available now is a reconnect, NOT a deliberate cancel.
                  // Keep the job Assigned so it shows up when the driver app restarts.
                  const _zdRecon = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
                  if (_zdRecon) {
                    // Mark the driver as Picking so dispatchers can see they have a live job.
                    _zdRecon.vehiclestatus = 'Picking';
                  }
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (${prev}) PROTECTED — driver ${driverId} reconnected after crash (reconnect-pending flag consumed)`);
                  // Return the job details in the response so the driver app can restore the screen.
                  _dscReconnectJob = {
                    jobId:       job.Id,
                    status:      job.BookingStatus,
                    pickAddress: job.PickAddress  || '',
                    dropAddress: job.DropAddress  || '',
                    passengerName: job.Name || job.passengername || '',
                    driverId,
                  };
                } else if (_priorCompletedMs > 0 && job.assignedAt && (_staleAvailNow - job.assignedAt) < 120000) {
                  // §FIX-STALE-AVAIL: Available is from completing a prior job (not abandoning this one).
                  // Driver completed job A, then accepted job B; the Available from finishing A
                  // must not recall B. Both timestamps must be within 120 s of now.
                  console.log(`  [DriverStatusChanged/DP] Job #${job.Id} (${prev}) PROTECTED — stale Available (job assigned ${Math.round((_staleAvailNow - job.assignedAt) / 1000)}s ago, prior job completed ${Math.round((_staleAvailNow - _priorCompletedMs) / 1000)}s ago)`);
                } else {
                  // Driver went Available while still Assigned/Picking (no other Active job)
                  // and no crash-reconnect flag set → treat as deliberate driver recall/cancel.
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
                    job.JobCompleteTime = new Date().toISOString();
                    const _cIdxDp = jobStore.indexOf(job);
                    if (_cIdxDp !== -1) jobStore.splice(_cIdxDp, 1);
                    closedJobStore.push(job);
                    saveJobStore();
                    saveClosedJobStore();
                    // §FBcleanup
                    _bwClearJobFromFirebase(sessionCompanyId, job.Id,
                      vehiclenumber || job.VehicleNo || job.CallSign || '',
                      driverId || job.DriverId || '', 'Cancelled');
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
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dscQueueNo, queueWaitSince: _dscQueueNo ? Date.now() : null, driverCancelled: _dscDriverCancelled || null, driverRecalled: _dscDriverRecalled || null, zoneOnly: zoneOnly || false, completedJob: _dscCompletedJob || null, reconnectJob: _dscReconnectJob || null });

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
          _cjJob.JobCompleteTime = new Date().toISOString();
          closedJobStore.push(_cjJob);
          jobStore.splice(_cjIdx, 1);
          saveJobStore();
          saveClosedJobStore();
          // §FBcleanup
          _bwClearJobFromFirebase(sessionCompanyId, _cjJob.Id,
            _cjJob.VehicleNo || _cjJob.CallSign || '', _cjDriverId || '', 'Cancelled');
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> cancelled job #${_cjBookingId}, driver ${_cjDriverId} -> moved to closedJobStore`);
        arrayD(res, [{ Result: 'Job Cancelled Successfully', DriverId: _cjDriverId }]);

      } else if (action === '[InsertPassengerBalance]') {
        // Records a successful Stripe payment against the passenger's phone number.
        const _pbPhone    = (param('PhoneNo') || param('phoneno') || '').toString().trim();
        const _pbAmount   = parseFloat(param('Amount') || param('amount') || '0') || 0;
        const _pbChargeId = (param('ChargeId') || param('chargeId') || param('chargeid') || '').toString().trim();
        const _pbEntry = {
          id:        stripePayNextId++,
          companyId: sessionCompanyId,
          phone:     _pbPhone,
          amount:    _pbAmount,
          chargeId:  _pbChargeId,
          paidAt:    new Date().toISOString(),
          method:    'Stripe',
        };
        stripePaymentStore.push(_pbEntry);
        saveJsonStore(STRIPE_PAYMENTS_FILE, stripePaymentStore);
        console.log(`200: POST ${urlPath} [action=${action}] -> recorded & persisted Stripe payment $${_pbAmount} for ${_pbPhone} (id=${_pbEntry.id})`);
        objectD(res, { dt1: [_pbEntry], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[GetPassengerBalance]') {
        const _gbPhone = (param('PhoneNo') || param('phoneno') || '').toString().trim();
        console.log(`200: POST ${urlPath} [action=${action}] -> balance lookup for ${_gbPhone}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === 'GetStripePayments') {
        // SA-facing query — returns persisted Stripe payment records for this company.
        // Optional filters: phone, fromDate (ISO), toDate (ISO).
        const _spPhone    = (param('phone') || param('Phone') || '').toString().trim();
        const _spFrom     = (param('fromDate') || param('FromDate') || '').toString().trim();
        const _spTo       = (param('toDate') || param('ToDate') || '').toString().trim();
        let _spResults = stripePaymentStore.filter(r => r.companyId === sessionCompanyId);
        if (_spPhone)  _spResults = _spResults.filter(r => r.phone === _spPhone);
        if (_spFrom)   _spResults = _spResults.filter(r => r.paidAt >= _spFrom);
        if (_spTo)     _spResults = _spResults.filter(r => r.paidAt <= _spTo);
        _spResults = _spResults.slice().sort((a, b) => (b.paidAt > a.paidAt ? 1 : -1));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${_spResults.length} Stripe payment(s) companyId=${sessionCompanyId}`);
        objectD(res, { dt1: _spResults, dt2: [], dt3: [], dt4: [], dt5: [] });

      } else if (action === '[ForceCompleteJob]') {
        // Dispatcher manually marks a stuck Assigned/Active job as Completed.
        // Used when the driver completed a trip offline and data didn't sync automatically.
        const _fcJobId    = parseInt(param('bookingid') || param('BookingId')) || 0;
        const _fcNotes    = (param('notes') || '').toString().trim();
        const _fcFare     = parseFloat(param('fare') || '0') || 0;
        const _fcPayment  = (param('paymentMethod') || 'Cash').toString().trim();
        const _fcIdx      = jobStore.findIndex(j => j.Id === _fcJobId);
        if (_fcIdx === -1) {
          objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], error: 'Job not found' });
        } else {
          const _fcJob = jobStore[_fcIdx];
          const _fcDrvId = String(_fcJob.DriverId || '0');
          // Transition through Active if still Assigned (so completion is clean)
          if (_fcJob.BookingStatus === 'Assigned' || _fcJob.BookingStatus === 'Picking') {
            _fcJob.BookingStatus = 'Active';
            if (!_fcJob.ActiveAt) _fcJob.ActiveAt = new Date().toISOString();
          }
          _fcJob.BookingStatus   = 'Completed';
          _fcJob.JobCompleteTime = new Date().toISOString();
          _fcJob.newcompelete    = _fcJob.JobCompleteTime;
          _fcJob.CompletedBy     = 'Dispatcher (force complete)';
          _fcJob.DispatcherNotes = _fcNotes || 'Manually completed — offline trip recovery';
          if (_fcFare > 0)      _fcJob.TotalFare = _fcFare;
          if (_fcFare > 0)      _fcJob.Fare      = _fcFare;
          if (_fcPayment)       _fcJob.Recieve_payment = _fcPayment;
          // Release the driver
          const _fcZd = ZONE_DRIVERS.find(d =>
            String(d.driverid) === _fcDrvId || String(d.VehicleId) === _fcDrvId);
          if (_fcZd && _fcDrvId !== '0') {
            const _fcQ = calcRestoredQueue(_fcDrvId, _fcZd.zonename || '');
            _fcZd.vehiclestatus  = 'Available';
            _fcZd.zonequeue      = _fcQ;
            _fcZd.queueWaitSince = Date.now();
            _fcZd.jobpickup = ''; _fcZd.jobdropoff = ''; _fcZd.JobphoneNo = '';
            clearAwayLock(_fcDrvId);
            clearDriverHomeState(_fcDrvId);
            console.log(`  [ForceCompleteJob] driver ${_fcDrvId} → Available q=${_fcQ}`);
          }
          jobStore.splice(_fcIdx, 1);
          closedJobStore.push(_fcJob);
          saveJobStore();
          saveClosedJobStore();
          _patchRentalComplete(_fcJob);
          // §FBcleanup
          _bwClearJobFromFirebase(sessionCompanyId, _fcJob.Id,
            _fcJob.VehicleNo || _fcJob.CallSign || '', _fcDrvId || '', 'Completed');
          console.log(`200: POST ${urlPath} [action=${action}] -> job #${_fcJobId} force-completed by dispatcher`);
          objectD(res, { dt1: [{ Result: 'Job force-completed', jobId: _fcJobId }], dt2: [], dt3: [], dt4: [], dt5: [] });
        }

      } else {
        console.log(`200: POST ${urlPath} [action=${action}] -> "Operation Successfully Performed"`);
        successD(res, 'Operation Successfully Performed');
      }
      return;
    }

    // ── /DataSelectorLess — primary read path (with some intentional write side-effects) ───
    // NOTE (BUG9): [QuickSetNoOne], [CancelJobStatusFromJobList] and [DispatcherUnReadMessages]
    // live here because the frontend hardcodes /DataSelectorLess for those calls.
    // They go through the same session/company auth as /DataSelector and are safe,
    // but any future read-only middleware on this path must explicitly exclude them.
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
        const activeWithId = active.map(j => {
          const isHail = j.BookingSource === 'Hail' || j.booking_type === 'Hail';
          let pickAddr = j.PickAddress || '';
          if (isHail) {
            if (pickAddr.startsWith('Hail - ')) {
              pickAddr = 'Hail Pickup (' + pickAddr.slice('Hail - '.length).trim() + ')';
            } else if (!pickAddr || pickAddr === 'Hail / Street Pickup') {
              pickAddr = 'Hail / Street Pickup';
            }
          }
          return { ...j, BookingId: j.Id, PickAddress: pickAddr || j.PickAddress || '' };
        });
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
          // Look up vehicle info for CallSign and VehicleType.
          // Also try by driver username so historical jobs with VehicleId="0" can still resolve.
          const _jdVid = v => v && String(v) !== '0' && parseInt(v) !== 0;
          const zdV = ZONE_DRIVERS.find(d =>
            (_jdVid(job.VehicleId) && (String(d.VehicleId) === String(job.VehicleId) || String(d.driverid) === String(job.VehicleId))) ||
            (_jdVid(job.DriverId)  && (String(d.driverid)  === String(job.DriverId)  || String(d.VehicleId) === String(job.DriverId)))  ||
            (job.UserFName && d.drivername && d.drivername.toLowerCase() === (job.UserFName || '').toLowerCase())
          ) || null;
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
            JobMins:       calcJobMins(job),
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
            drivername:    job.drivername || (zdV ? zdV.drivername : '') || '',
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

      // ── ACC / Accident Claim handlers (real persistent storage) ───────────
      } else if (action === 'Manager_ACC_GET') {
        const mgrs = accManagerStore.filter(m=>m.companyId===sessionCompanyId);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${mgrs.length} ACC managers`);
        arrayD(res, mgrs);

      } else if (action === 'Client_ACC_GET') {
        const managerId = parseInt(param('manager_id')||'0')||0;
        const clis = accClientStore.filter(c=>c.companyId===sessionCompanyId && (!managerId || c.manager_id===managerId));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${clis.length} ACC clients`);
        arrayD(res, clis);

      } else if (action === 'Client_ACC_ALL') {
        const allClis = accClientStore.filter(c=>c.companyId===sessionCompanyId).map(c=>{
          const mgr = accManagerStore.find(m=>m.id===c.manager_id);
          return { ...c, manager_name: mgr ? mgr.manager_name : '' };
        });
        console.log(`200: POST ${urlPath} [action=${action}] -> ${allClis.length} all ACC clients`);
        arrayD(res, allClis);

      } else if (action === 'Approve_ACC_GET') {
        const clientId = parseInt(param('client_id')||param('id')||'0')||0;
        const apps = accApprovalStore.filter(a=>a.companyId===sessionCompanyId && (!clientId || a.client_id===clientId || a.id===clientId));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${apps.length} approvals`);
        arrayD(res, apps);

      } else if (action === 'ACC_All_approval') {
        const allApps = accApprovalStore.filter(a=>a.companyId===sessionCompanyId);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${allApps.length} all approvals`);
        arrayD(res, allApps);

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
          job.JobCompleteTime = new Date().toISOString();
          closedJobStore.push(job);
          jobStore.splice(idx, 1);
          saveJobStore();
          saveClosedJobStore();
          // §FBcleanup
          _bwClearJobFromFirebase(sessionCompanyId, job.Id,
            job.VehicleNo || job.CallSign || '', driverId || '', 'Cancelled');
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> cancelled job #${bookingId}, driver ${driverId} -> moved to closedJobStore`);
        arrayD(res, [{ Result: 'Job Cancelled Successfully', DriverId: driverId }]);

      } else if (action === 'Business_Account_GET') {
        const baccAll = businessAccStore.filter(b=>b.companyId===sessionCompanyId && b.active!==false);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${baccAll.length} business accounts`);
        arrayD(res, baccAll);

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
      if (action === '[searchmulti]') {
        // Dispatcher Create Job — Customer Search: ACC clients (active POs), business accounts, passengers
        const q = ((param('claim_number')||param('value')||param('searchtext')||'')).toLowerCase().trim();
        const todayStr = _tzTodayStr(getCompanyTZ(sessionCompanyId));
        const accResults = accClientStore
          .filter(c => c.companyId===sessionCompanyId && (!q || c.client_name.toLowerCase().includes(q) || (c.client_phone||'').includes(q)))
          .map(c => {
            const activeApp = accApprovalStore.find(a => a.client_id===c.id && a.companyId===sessionCompanyId && a.trip_to_date >= todayStr && (a.trip_days_left||0) > 0) || null;
            return { id: c.id, client_name: c.client_name, client_phone: c.client_phone, client_address: c.client_address,
              claim_number: activeApp ? activeApp.claim_number : '', trip_days_left: activeApp ? activeApp.trip_days_left : 0,
              acc_approval_id: activeApp ? activeApp.id : null, manager_id: activeApp ? activeApp.manager_id : c.manager_id,
              trip_status: activeApp ? activeApp.trip_status : '' };
          });
        const baccResults = businessAccStore
          .filter(b => b.companyId===sessionCompanyId && b.active!==false && (!q || b.name.toLowerCase().includes(q) || (b.phone||'').includes(q) || String(b.id).includes(q) || (b.accountCode && b.accountCode.toLowerCase().includes(q)) || (parseInt(q,10)>0 && b.id===parseInt(q,10))))
          .map(b => ({ Id: b.id, Name: b.name, PhoneNo: b.phone, Email: b.email, AccountCode: b.accountCode||'', Type: 'Account' }));
        const pasResults = passengerStore
          .filter(p => p.companyId===sessionCompanyId && (!q || (p.Name||'').toLowerCase().includes(q) || (p.PhoneNo||'').includes(q) || (p.Email||'').toLowerCase().includes(q)))
          .slice(0, 20).map(p => ({ Id: p.id, Name: p.Name, PhoneNo: p.PhoneNo, Email: p.Email }));
        const multiResult = { dt1: accResults, dt2: baccResults, dt3: pasResults };
        console.log(`200: POST ${urlPath} [action=${action}] q="${q}" -> ACC:${accResults.length} Biz:${baccResults.length} Pax:${pasResults.length}`);
        jsonReply(res, { d: JSON.stringify(multiResult) });

      } else if (action === '[GetSuspendedDrivers]') {
        const _mysSuspendedDS = companySuspended(SUSPENDED_DRIVERS);
        console.log(`200: POST ${urlPath} [action=[GetSuspendedDrivers]] -> ${_mysSuspendedDS.length} suspended driver(s) (companyId=${sessionCompanyId})`);
        objectD(res, { dt1: _mysSuspendedDS, dt2: [], dt3: [], dt4: [], dt5: [] });
        return;

      } else if (action === 'RetrieveAlarms' || action === 'AllAlarms' || action === 'RetrieveAlarts' || action === 'RetrieveAlerts' || action === 'GetAlarms' || action === 'GetAlerts') {
        console.log(`200: POST ${urlPath} [action=${action}] -> []`);
        jsonReply(res, { d: '[]' });

      } else if (action === '[Editjobv4]') {
        const idParam = param('Id');
        const jobId = idParam !== undefined ? parseInt(idParam) : 0;
        const job = jobStore.find(j => j.Id === jobId);
        const jobWithMins = job ? { ...job, JobMins: calcJobMins(job) } : null;
        const resp = {
          dt1: jobWithMins ? [jobWithMins] : [],
          dt2: [{ AssignedCount: 0 }],
          dt3: [{ ActiveCount: 0 }],
          dt4: [{ UnAssignedCount: jobStore.length }],
          dt5: [{ PublicKey: STRIPE_PK }],
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
              j.DriverId = 0;
              j.VehicleId = 0;
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
            const pickupMs = _parseLocalDT(pickupRef, sessionCompanyId);
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
        // Priority order:
        //   1. ASAP jobs (DispatchTimebefore=0) AND overdue pre-books (pickup time has passed)
        //   2. Future pre-books sorted by how soon their dispatch window opens
        // Once a pre-book's pickup time passes it is treated identically to an ASAP job.
        const _nowMs = Date.now();
        function _isEffectivelyASAP(j) {
          const db = parseInt(j.DispatchTimebefore || '0') || 0;
          if (db === 0) return true;
          const ref = _toDateStr(j.Pickingtime || j.BookingDateTime || '');
          if (!ref) return true;
          const pickupMs = _parseLocalDT(ref, sessionCompanyId);
          return pickupMs !== null && _nowMs > pickupMs; // pickup passed → treat as ASAP
        }
        autoJobs.sort((a, b) => {
          const aASAP = _isEffectivelyASAP(a);
          const bASAP = _isEffectivelyASAP(b);
          if (aASAP && !bASAP) return -1;
          if (!aASAP && bASAP) return 1;
          const da = parseInt(a.DispatchTimebefore || '0') || 0;
          const db2 = parseInt(b.DispatchTimebefore || '0') || 0;
          const refA = _toDateStr(a.Pickingtime || a.BookingDateTime || '');
          const refB = _toDateStr(b.Pickingtime || b.BookingDateTime || '');
          if (aASAP && bASAP) {
            // Both effectively ASAP — sort by pickup time ascending (most overdue first)
            const tA = refA ? (_parseLocalDT(refA, sessionCompanyId) || _nowMs) : _nowMs;
            const tB = refB ? (_parseLocalDT(refB, sessionCompanyId) || _nowMs) : _nowMs;
            return tA - tB;
          }
          // Both future pre-books — sort by dispatch window open time (earliest first)
          const winA = refA ? (_parseLocalDT(refA, sessionCompanyId) || Infinity) - da * 60000 : Infinity;
          const winB = refB ? (_parseLocalDT(refB, sessionCompanyId) || Infinity) - db2 * 60000 : Infinity;
          return winA - winB;
        });
        const dt1 = autoJobs.map(j => ({
          Id: j.Id,
          ZoneId: j.ZoneId || 1,
          VehicleType: j.VehicleType || 'Not Specified',
          Passengers: j.PassengersNo || 1,
          PickLatLng: j.PickLatLng || '0,0',
          // serviceType and BookingSource are required by smartAutoDispatch on the client:
          // _bwCanDriverDoService(dvId, job.serviceType) gates which drivers see food/freight jobs.
          // BUG FIX: previously omitted — all food jobs were silently treated as 'taxi'.
          serviceType:    j.serviceType    || 'taxi',
          BookingSource:  j.BookingSource  || '',
          // paymentStatus needed for BUG 7 web-booking payment gate
          paymentStatus:  j.paymentStatus  || '',
          prepaid:        j.prepaid        || false,
          // DispatchTimebefore + BookingDateTime needed for BUG 2 client-side window check
          DispatchTimebefore: j.DispatchTimebefore || '0',
          BookingDateTime:    j.BookingDateTime    || '',
        }));
        console.log(`200: POST ${urlPath} [action=${action}] -> ${dt1.length} pending job(s) for auto-dispatch (sorted by priority)`);
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
        const _dsReg = registrationStore.find(r => r.companyId === sessionCompanyId);
        const _dsCompanyName = (_dsReg && _dsReg.company) ? _dsReg.company : (sessionCompanyId || '');
        const settings = {
          dt1: [{
            CompanyName: _dsCompanyName,
            Timezone: getCompanyTZ(sessionCompanyId),
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
          dt5: [{ PublicKey: STRIPE_PK }],
        };
        console.log(`200: POST ${urlPath} [action=${action}] -> dispatcher settings (CompanyName="${_dsCompanyName}")`);
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
        // §QueueCap — enforce max 1 queued job per driver. If the driver already
        // has another job in 'Queued' state, reject so the driver app can decline
        // the 2nd offer instead of silently overwriting the first.
        const _qExisting = jobStore.find(j =>
          j.BookingStatus === 'Queued' &&
          String(j.DriverId) === String(_qDriverId) &&
          String(j.Id) !== String(_qBookingId)
        );
        if (!_qJob) { objectD(res, { ok: false, msg: 'job not found' }); }
        else if (_qExisting) {
          console.log(`[QueueJob] BLOCKED job #${_qBookingId} → driver ${_qDriverId} already has queued job #${_qExisting.Id}`);
          objectD(res, { ok: false, msg: 'queue full', existingJobId: _qExisting.Id });
        }
        else if (_qJob.BookingStatus !== 'Offered' && _qJob.BookingStatus !== 'Pending' && _qJob.BookingStatus !== 'No One') {
          objectD(res, { ok: false, msg: `cannot queue job with status ${_qJob.BookingStatus}` });
        } else {
          // Remember the pre-queue status so [RecallQueuedJob] can restore to the right state.
          // e.g. 'No One' jobs should return to 'No One', not 'Pending'.
          _qJob._origStatus  = _qJob.BookingStatus;
          _qJob.BookingStatus = 'Queued';
          _qJob.DriverId     = _qDriverId;
          _qJob.queuedAt     = Date.now();
          saveJobStore();
          console.log(`[QueueJob] job #${_qBookingId} (was ${_qJob._origStatus}) → Queued for driver ${_qDriverId}`);
          objectD(res, { ok: true, origStatus: _qJob._origStatus });
        }

      } else if (action === '[RecallQueuedJob]') {
        const _rqBookingId = param('bookingid');
        const _rqDriverId  = (param('driverid') || '').toString().trim(); // driver who recalled
        const _rqJob = jobStore.find(j => String(j.Id) === String(_rqBookingId));
        if (!_rqJob) { objectD(res, { ok: false, msg: 'job not found' }); }
        else {
          const _prevSt = _rqJob.BookingStatus;
          // Restore to the original pre-queue status (Pending or No One), not always Pending.
          const _restoreSt = _rqJob._origStatus || 'Pending';
          _rqJob.BookingStatus = _restoreSt;
          // Use -2 sentinel (same as driver-recalled Assigned jobs) so UI shows recall badge.
          _rqJob.DriverId      = -2;
          _rqJob.VehicleId     = 0;
          _rqJob.queuedAt      = null;
          _rqJob.returnReason  = _rqDriverId ? `Recalled by ${_rqDriverId}` : 'Recalled by Driver';
          delete _rqJob._origStatus;
          saveJobStore();
          console.log(`[RecallQueuedJob] job #${_rqBookingId} (was ${_prevSt}) → ${_restoreSt} (driver ${_rqDriverId || '?'} recalled)`);
          objectD(res, { ok: true, restoredStatus: _restoreSt });
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
          _pqaJob.assignedAt = Date.now();
          _pqaJob.queuedAt = null;
          saveJobStore();
          console.log(`[PromoteQueuedToAssigned] job #${_pqaBookingId} Queued → Assigned (driver ${_pqaDriverId})`);
          objectD(res, { ok: true, driverId: _pqaDriverId });
        }

      } else if (action === '[GetQueuedJobs]') {
        const _gqJobs = jobStore.filter(j => j.BookingStatus === 'Queued');
        const _gqAllDrivers = companyDrivers(ZONE_DRIVERS);
        const _gqDt1  = _gqJobs.map(j => {
          const _gqDrv = _gqAllDrivers.find(d =>
            String(d.driverid) === String(j.DriverId) ||
            String(d.VehicleId) === String(j.DriverId)
          ) || {};
          return {
            Id:              j.Id,
            BookingId:       j.Id,
            DriverId:        j.DriverId        || '',
            drivername:      _gqDrv.drivername || j.DriverId || '',
            VehicleNo:       _gqDrv.vehiclenumber || '',
            passengername:   j.passengername   || ((j.UserFName || '') + ' ' + (j.UserLName || '')).trim() || j.Name || '',
            PickAddress:     j.PickAddress     || j.PickLocation  || '',
            DropAddress:     j.DropAddress     || j.DropLocation  || '',
            BookingDateTime: j.BookingDateTime || '',
            UserFName:       j.UserFName       || '',
            UserLName:       j.UserLName       || '',
            VehicleType:     j.VehicleType     || '',
            BookingSource:   j.BookingSource   || '',
            PhoneNo:         j.PhoneNo         || '',
            JobMins:         j.JobMins         || 0,
            queuedAt:        j.queuedAt        || 0,
          };
        });
        console.log(`[GetQueuedJobs] → ${_gqDt1.length} queued job(s)`);
        objectD(res, { dt1: _gqDt1 });

      } else if (action === 'VehiclesStatus') {
        const _myDrivers = companyDrivers(ZONE_DRIVERS);
        // Once any driver appears in ZONE_DRIVERS, mark the session as "seen a real driver".
        // After that point, an empty ZONE_DRIVERS is a genuine "all signed out" state.
        if (_myDrivers.length > 0) _firstDriverSeenAfterStart = true;
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
        // dt6=null (clear board) is only safe once we've seen at least one driver connect
        // in this server session.  Before that, Firebase-sourced drivers should be left
        // alone — the server's ZONE_DRIVERS is simply not yet warmed up.
        const _canClear = _serverAgeMs > 90000 && _firstDriverSeenAfterStart;
        const _onlineIds = _canClear
          ? (_myDrivers.length > 0
              ? _myDrivers.map(d => ({
                  id:     String(d.driverid  || ''),
                  vid:    String(d.VehicleId || ''),
                  zone:   d.zonename  || '',
                  zoneq:  d.zonequeue || 0,
                  status: d.vehiclestatus || 'Available',
                }))
              : null)   // confirmed empty — signal client to clear board
          : [];         // warm-up or no driver yet seen — don't clear anything
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
            const ds = _toDateStr(j.JobCompleteTime || j.BookingDateTime || '');
            return ds.substring(0, 10) >= fromDate;
          });
          console.log(`  [ClosedJobs] after fromDate '${fromDate}': ${jobs.length} jobs`);
        }
        if (toDate) {
          jobs = jobs.filter(j => {
            const ds = _toDateStr(j.JobCompleteTime || j.BookingDateTime || '');
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
          // Look up in ZONE_DRIVERS by driverId, vehicleId, or UserFName (for jobs
          // where VehicleId was recorded as 0 but the driver name is known)
          const _validId = v => v && String(v) !== '0' && parseInt(v) !== 0;
          const zdN = ZONE_DRIVERS.find(d =>
            (_validId(j.DriverId)  && (String(d.driverid) === String(j.DriverId)  || String(d.VehicleId) === String(j.DriverId)))  ||
            (_validId(j.VehicleId) && (String(d.driverid) === String(j.VehicleId) || String(d.VehicleId) === String(j.VehicleId))) ||
            (j.UserFName && d.drivername && d.drivername.toLowerCase() === (j.UserFName || '').toLowerCase())
          ) || null;
          const vehicleNo = j.VehicleNo || (zdN ? zdN.vehiclenumber : null) || null;
          const callSign  = j.CallSign  || (zdN ? zdN.vehiclenumber : null) || null;
          if (j.UserFName !== undefined && j.UserFName !== null) {
            // UserFName already set — also enrich drivername from ZONE_DRIVERS so the
            // browser can prefer the real display name over a Firebase username/handle.
            const _zdName = zdN ? zdN.drivername : null;
            return { ...j, PickAddress: pickAddr, DropAddress: dropAddr, VehicleNo: vehicleNo, CallSign: callSign,
                     drivername: j.drivername || _zdName || '' };
          }
          let fName = '', lName = '';
          if (zdN && zdN.drivername) {
            const parts = zdN.drivername.trim().split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ') || '';
          }
          return { ...j, UserFName: fName, UserLName: lName, PickAddress: pickAddr, DropAddress: dropAddr, VehicleNo: vehicleNo, CallSign: callSign };
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
        // §98 — Zone 0 = catch-all (no zones configured, zones/{cid} is null).
        // Include zone-0 drivers for any zone request so they are never skipped.
        const avail = ZONE_DRIVERS.filter(d => d.vehiclestatus === 'Available' && (!zoneId || String(d.zoneid) === zoneId || String(d.zoneid) === '0'));
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
            const _bMs = new Date(_toDateStr(_job.BookingDateTime)).getTime();
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
          // BUG11 — use same string-safe pattern as DP path so 'D001'-style IDs are preserved.
          const _rawDriverId2 = (param('driverid') || '').toString().trim();
          const incomingDriverId2 = parseInt(_rawDriverId2) > 0 ? parseInt(_rawDriverId2) : (_rawDriverId2 || 0);
          if (newStatus === 'Offered' && currentStatus2 === 'Offered' && job.DriverId && String(job.DriverId) !== String(incomingDriverId2)) {
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
          // Protect Queued jobs — only [RecallQueuedJob] or [PromoteQueuedToAssigned] may change them.
          if (currentStatus2 === 'Queued') {
            console.log(`  [changeriddestatusforoffer/DS] BLOCKED: job #${bookingId} is Queued — only RecallQueuedJob/PromoteQueuedToAssigned may change it (attempted: ${newStatus})`);
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
          { const _ts2 = new Date().toISOString();
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
            // BUG11 — preserve string driver IDs (e.g. 'D001') instead of parseInt→0
            const _rawAcceptId2 = (param('driverid') || '').toString().trim();
            const acceptDriverId2 = parseInt(_rawAcceptId2) > 0 ? parseInt(_rawAcceptId2) : (_rawAcceptId2 || 0);
            if (acceptDriverId2) { job.DriverId = acceptDriverId2; job.VehicleId = acceptDriverId2; }
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
          // Patch Firebase pendingjobs so driver app sees 'Offered' status.
          // Without this, a stale 'Assigned' entry from a previous session causes
          // the driver app to skip the offer screen (it thinks the job is already theirs).
          if (newStatus === 'Offered' && sessionCompanyId) {
            (async () => {
              try {
                const _tok = await getFirebaseServerToken();
                if (_tok) {
                  const _pjUrl = `${FB_DB_URL}/pendingjobs/${sessionCompanyId}/${bookingId}.json?auth=${encodeURIComponent(_tok)}`;
                  const _pjParseLatLng2 = s => { const p = (s||'').split(','); return p.length===2?{lat:parseFloat(p[0]),lng:parseFloat(p[1])}:null; };
                  const _pjPickLL2 = _pjParseLatLng2(job.PickLatLng);
                  const _pjDropLL2 = _pjParseLatLng2(job.DropLatLng);
                  const _pjPatch2 = {
                    BookingId:      String(bookingId),
                    Status:         'Offered',
                    BookingStatus:  'Offered',
                    DriverId:       String(incomingDriverId2 || ''),
                    AssignedDriver: String(incomingDriverId2 || ''),
                    offeredAt:      Date.now(),
                    PickAddress:    job.PickAddress  || '',
                    DropAddress:    job.DropAddress  || '',
                    PassengerName:  job.Name         || job.UserFName || '',
                    PassengerPhone: job.PhoneNo      || '',
                    Fare:           String(job.EstimatedFare || job.RideCost || job.CustomeRate || ''),
                    CompanyId:      String(sessionCompanyId),
                    ServiceType:    job.serviceType  || 'taxi',
                    BookingSource:  job.BookingSource|| 'Dispatch Console',
                    WebBooking:     false
                  };
                  if (_pjPickLL2) _pjPatch2.pickupLocation  = { address: job.PickAddress || '', lat: _pjPickLL2.lat, lng: _pjPickLL2.lng };
                  if (_pjDropLL2) _pjPatch2.dropoffLocation = { address: job.DropAddress || '', lat: _pjDropLL2.lat, lng: _pjDropLL2.lng };
                  await fbRequest(_pjUrl, 'PATCH', _pjPatch2);
                  console.log(`  [changeriddestatusforoffer/DS] pendingjobs/${sessionCompanyId}/${bookingId} patched → Offered (full payload)`);
                  const _pjVeh2 = (job.VehicleNo || job.CallSign || '').toString().trim();
                  if (_pjVeh2) {
                    const _ocUrl3 = `${FB_DB_URL}/online/${sessionCompanyId}/${_pjVeh2}/current.json?auth=${encodeURIComponent(_tok)}`;
                    await fbRequest(_ocUrl3, 'PATCH', {
                      joboffer:   bookingId,
                      jobpickup:  job.PickAddress  || '',
                      jobdropoff: job.DropAddress  || '',
                      JobphoneNo: job.PhoneNo       || '',
                      jobname:    job.Name          || job.UserFName || '',
                      currentJobId: String(bookingId),
                      jobId:        String(bookingId)
                    });
                    console.log(`  [changeriddestatusforoffer/DS] online/${sessionCompanyId}/${_pjVeh2}/current → jobpickup/dropoff written`);
                  }
                }
              } catch(_e) { console.warn('  [changeriddestatusforoffer/DS] pendingjobs patch failed:', _e && _e.message); }
            })();
          }
          if (newStatus === 'Unreached' && sessionCompanyId) {
            const _unrVeh2 = (job.VehicleNo || job.CallSign || '').toString().trim();
            if (_unrVeh2) {
              (async () => {
                try {
                  const _tok3 = await getFirebaseServerToken();
                  if (_tok3) {
                    const _ocUrl4 = `${FB_DB_URL}/online/${sessionCompanyId}/${_unrVeh2}/current.json?auth=${encodeURIComponent(_tok3)}`;
                    await fbRequest(_ocUrl4, 'PATCH', { currentJobId: null, jobId: null, joboffer: 0, jobpickup: '', jobdropoff: '', JobphoneNo: '', jobname: '' });
                    console.log(`  [changeriddestatusforoffer/DS] online/${sessionCompanyId}/${_unrVeh2}/current cleared (Unreached)`);
                  }
                } catch(_e3) { console.warn('  [changeriddestatusforoffer/DS] online/current clear failed:', _e3 && _e3.message); }
              })();
            }
          }
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
        let _dscCompletedJobDS  = null;
        if (driverId && newStatus) {
          // ── Suspension gate ───────────────────────────────────────────────────
          const _suspCheckDS = SUSPENDED_DRIVERS.find(s =>
            String(s.driverId) === driverId || String(s.vehicleId) === driverId ||
            (vehiclenumber && (String(s.driverId) === vehiclenumber || String(s.vehicleId) === vehiclenumber))
          );
          if (_suspCheckDS) {
            const _stillSuspDS = !_suspCheckDS.suspendedUntil || new Date(_suspCheckDS.suspendedUntil).getTime() > Date.now();
            if (_stillSuspDS) {
              const _untilStrDS = _suspCheckDS.suspendedUntil ? new Date(_suspCheckDS.suspendedUntil).toLocaleString('en-NZ', { timeZone: getCompanyTZ(sessionCompanyId) }) : 'further notice';
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
          // Away status re-registration (DS path): same fix as DP path — if driver
          // sends Away but isn't in ZONE_DRIVERS (e.g. post-restart), add them so
          // VehiclesStatus includes them and the 30-second board-clear doesn't flicker.
          if (newStatus === 'Away' && !zdSyncDS) {
            const _savedZnAwDS = getSavedZone(driverId);
            ZONE_DRIVERS.push({
              driverid:      driverId,
              VehicleId:     vehiclenumber || driverId,
              drivername:    drivername    || driverId,
              vehiclenumber: vehiclenumber || driverId,
              vehicletype:   (param('vehicletype') || '').toString().trim() || '',
              zonename:      zonenameDS || (_savedZnAwDS && _savedZnAwDS.zonename) || '',
              zoneid:        (_savedZnAwDS && _savedZnAwDS.zoneid) || '',
              vehiclestatus: 'Away',
              zonequeue:     0,
              lat:           lat || '',
              lng:           lng || '',
              companyId:     sessionCompanyId || '',
            });
            console.log(`  [DriverStatusChanged/DS] driver ${driverId} re-added to ZONE_DRIVERS as Away (post-restart recovery)`);
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
                companyId:     sessionCompanyId || '',
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
              const hailId = newCompanyJobId(sessionCompanyId || '000');
              const now = new Date().toISOString();
              const pickAddr = (lat && lng) ? `Hail - ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : 'Hail / Street Pickup';
              // Resolve driver name — prefer param, fall back to ZONE_DRIVERS
              const _hailZdDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
              const _hailFullNameDS = drivername || (_hailZdDS && _hailZdDS.drivername) || '';
              const _hailPartsDS = _hailFullNameDS.trim().split(/\s+/);
              jobStore.push({
                Id: hailId, BookingStatus: 'Active',
                companyId: sessionCompanyId || '',
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
              console.log(`  [DriverStatusChanged/DS] Hail job #${hailId} for driver ${driverId} (${vehiclenumber}) companyId=${sessionCompanyId} at ${pickAddr}`);
            }
          }
          const allDriverJobs = jobStore.filter(matchesDriverDS);
          let activatedOneDS = false;
          // Protect Assigned jobs when driver completes a simultaneous Active (Hail) job.
          const _hasActiveBeforeAvailableDS = newStatus === 'Available' &&
            allDriverJobs.some(j => j.BookingStatus === 'Active');
          // §FIX-STALE-AVAIL: pre-compute whether this driver recently completed another job (≤120 s).
          const _staleAvailNowDS = Date.now();
          const _priorCompletedMsDS = newStatus === 'Available' ? (closedJobStore.find(function(cj) {
            return String(cj.DriverId || cj.driverId || '') === String(driverId) &&
                   cj.completedAtMs > 0 && (_staleAvailNowDS - cj.completedAtMs) < 120000;
          }) || {}).completedAtMs || 0 : 0;
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
              job.assignedAt = Date.now();
              if (!job.AcceptedAt) job.AcceptedAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Assigned`);
            } else if (newStatus === 'Busy' && !activatedOneDS &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphanedDS))) {
              job.BookingStatus = 'Active';
              activatedOneDS = true;
              if (!job.ActiveAt) job.ActiveAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Assigned';
              job.assignedAt = Date.now();
              if (!job.PickingAt) job.PickingAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Assigned (Picking)`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Trip genuinely finished — mark Completed, move to closedJobStore
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = new Date().toISOString();
                _stampDriverNameDS(job);
                const _cIdxDS = jobStore.indexOf(job);
                if (_cIdxDS !== -1) jobStore.splice(_cIdxDS, 1);
                closedJobStore.push(job);
                saveJobStore();
                saveClosedJobStore();
                _patchRentalComplete(job);
                // §FBcleanup
                _bwClearJobFromFirebase(sessionCompanyId, job.Id,
                  vehiclenumber || job.VehicleNo || job.CallSign || '',
                  driverId || job.DriverId || '', 'Completed');
                // §108d — patch allbookings so SA portal gets correct Status and paymentMethod.
                // Mirror of the DP path fix; without this, DS-path completions showed wrong data.
                const _cjPayMethodDS = (
                  job.PaymentType   || job.paymentType   ||
                  job.PaymentMethod || job.paymentMethod || 'cash'
                ).toLowerCase();
                _dscCompletedJobDS = {
                  tripId:      String(job.Id),
                  bookingId:   String(job.Id),
                  companyId:   String(sessionCompanyId || ''),
                  driverId:    String(driverId),
                  driverName:  drivername || (job.UserFName ? ((job.UserFName || '') + ' ' + (job.UserLName || '')).trim() : ''),
                  vehicleId:   vehiclenumber || String(job.VehicleNo || job.VehicleId || ''),
                  vehicleNo:   vehiclenumber || String(job.VehicleNo || job.VehicleId || ''),
                  fare:        job.Fare != null ? Number(job.Fare) : (job.TotalFare != null ? Number(job.TotalFare) : 0),
                  paymentType:    _cjPayMethodDS,
                  paymentMethod:  _cjPayMethodDS,
                  paymentStatus:  job.paymentStatus || job.PaymentStatus || '',
                  stripeChargeId: job.stripeChargeId || job.StripeChargeId || null,
                  completedAt: Date.now(),
                  status:      'Completed',
                  source:      'dispatch',
                  pickup:      job.PickAddress || '',
                  dropoff:     job.DropAddress || '',
                  businessAccountId: job.Account_id || '',
                };
                (function _patchAllbookingsCompletionDS(j, cid, pm) {
                  getFirebaseServerToken().then(function(tok) {
                    if (!tok || !cid || !j.Id) return;
                    const _abPatchDS = {
                      Status:        'Completed',
                      paymentMethod: pm,
                      PaymentMethod: pm,
                      completedAt:   j.JobCompleteTime || new Date().toISOString(),
                    };
                    if (j.paymentStatus || j.PaymentStatus) {
                      _abPatchDS.paymentStatus = j.paymentStatus || j.PaymentStatus;
                      _abPatchDS.PaymentStatus = j.paymentStatus || j.PaymentStatus;
                    }
                    if (j.stripeChargeId || j.StripeChargeId) {
                      _abPatchDS.stripeChargeId = j.stripeChargeId || j.StripeChargeId;
                    }
                    firebaseDbPatch(`allbookings/${cid}/${j.Id}`, _abPatchDS, tok)
                      .then(function() { console.log(`  [§108d/DS] allbookings/${cid}/${j.Id} → Completed paymentMethod=${pm}`); })
                      .catch(function(e) { console.warn(`  [§108d/DS] allbookings patch failed for job #${j.Id}:`, e && e.message); });
                  });
                })(job, sessionCompanyId, _cjPayMethodDS);
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
                } else if (consumeDriverReconnectPending(driverId)) {
                  // Driver's Away was previously ignored (crash/onDisconnect pattern).
                  // Their Available now is a reconnect, NOT a deliberate cancel.
                  // Keep the job Assigned so it shows up when the driver app restarts.
                  const _zdReconDS = ZONE_DRIVERS.find(d => String(d.driverid) === driverId || String(d.VehicleId) === driverId);
                  if (_zdReconDS) _zdReconDS.vehiclestatus = 'Picking';
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (${prev}) PROTECTED — driver ${driverId} reconnected after crash (reconnect-pending flag consumed)`);
                } else if (_priorCompletedMsDS > 0 && job.assignedAt && (_staleAvailNowDS - job.assignedAt) < 120000) {
                  // §FIX-STALE-AVAIL: Available is from completing a prior job (not abandoning this one).
                  // Driver completed job A, then accepted job B; the Available from finishing A
                  // must not recall B. Both timestamps must be within 120 s of now.
                  console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (${prev}) PROTECTED — stale Available (job assigned ${Math.round((_staleAvailNowDS - job.assignedAt) / 1000)}s ago, prior job completed ${Math.round((_staleAvailNowDS - _priorCompletedMsDS) / 1000)}s ago)`);
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
                    job.JobCompleteTime = new Date().toISOString();
                    const _cIdxDs = jobStore.indexOf(job);
                    if (_cIdxDs !== -1) jobStore.splice(_cIdxDs, 1);
                    closedJobStore.push(job);
                    saveJobStore();
                    saveClosedJobStore();
                    // §FBcleanup
                    _bwClearJobFromFirebase(sessionCompanyId, job.Id,
                      vehiclenumber || job.VehicleNo || job.CallSign || '',
                      driverId || job.DriverId || '', 'Cancelled');
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
                companyId:     sessionCompanyId || '',
              });
              if (_useZoneDS) saveZoneAssignment(driverId, _useZoneDS, _useZoneIdDS);
              console.log(`  [DriverStatusChanged/DS] NEW driver ${driverId} (${vehiclenumber}) added to ZONE_DRIVERS q=${_dssQueueNo} zone="${_useZoneDS}"`);
            }
          }
          saveJobStore();
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dssQueueNo, queueWaitSince: _dssQueueNo ? Date.now() : null, driverCancelled: _dssDriverCancelled || null, driverRecalled: _dssDriverRecalled || null, zoneOnly: zoneOnlyDS || false, completedJob: _dscCompletedJobDS || null });

      } else if (action === '[UnAssignedJobsv3]') {
        const _cJobs = companyJobs(jobStore);
        const resp = buildJobListResponse(_cJobs);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${_cJobs.length} jobs (${resp.dt4[0].UnAssignedCount} unassigned) companyId=${sessionCompanyId}`);
        objectD(res, resp);

      } else if (action === '[IngestPassengerJob]') {
        // Client-side Firebase listener detected a new passenger booking and relays it here.
        // Handles Scheduled (→ regular jobStore as Pending with ScheduledFor field),
        //         Waiting   (→ regular jobStore as Pending), and
        //         Cancelled (→ remove from jobStore if still pending).
        let _ipjJob = {};
        try { _ipjJob = JSON.parse(param('job') || '{}'); } catch(e) {}
        const _ipjStatus = (_ipjJob.Status || _ipjJob.status || '').toString().trim();
        const _ipjFbKey  = (_ipjJob._fbKey || '').toString().trim();
        const _ipjJobId  = (_ipjJob._jobId || (_ipjFbKey.includes(':') ? _ipjFbKey.split(':').slice(1).join(':') : _ipjFbKey)).toString();

        if (_ipjStatus === 'Scheduled') {
          // Scheduled bookings land directly in the Unassigned queue as Pending.
          // ScheduledFor is preserved so the 📅 Sched badge shows on the job card.
          const _ipjNumIdSch = parseInt(_ipjJobId, 10) || 0;
          const already = jobStore.find(j => j._fbKey === _ipjFbKey || (_ipjNumIdSch > 0 && j.Id === _ipjNumIdSch));
          const alreadyClosed = closedJobStore.find(j => j._fbKey === _ipjFbKey || (_ipjNumIdSch > 0 && j.Id === _ipjNumIdSch));
          // Stamp _fbKey onto an existing dispatch-console job so future lookups hit by key too.
          if (already && !already._fbKey) already._fbKey = _ipjFbKey;
          if (!already && !alreadyClosed) {
            const _sCid = String(sessionCompanyId);
            const _sn = _normFbJob(_ipjJob);
            // §103 Bug 1 — use 'Website' for web-portal bookings, not 'passenger'
            const _isWebBk = !!(_ipjJob.WebBooking || _ipjJob.webBooking || _ipjJob.CreatedBy === 'WEB' || _ipjJob.CreatedBy === 'web' || (_ipjJob.BookingSource || '').toLowerCase() === 'website');
            // _normFbJob now resolves ScheduledForMs → ISO parse → parseInt correctly.
            // _sn.scheduledFor is the Unix ms of the scheduled pickup time (or 0 for ASAP).
            const _sMs = _sn.scheduledFor || null;
            // BookingDateTime = the actual pickup time the passenger chose, not the booking
            // creation time. For Scheduled jobs the pickup time IS ScheduledFor.
            const _bdt = _sMs ? new Date(_sMs).toISOString() : (_sn.createdAt || new Date().toISOString());
            // DispatchTimebefore: how many minutes before pickup to start offering.
            // Estimated using Haversine distance from company base to pickup coords —
            // same formula as the client-side updateDispatchSuggestion function.
            // Dispatcher can override this at any time via the job edit form.
            const _pickParts = (_sn.pickLatLng || '0,0').split(',');
            const _pickLat   = parseFloat(_pickParts[0]) || 0;
            const _pickLng   = parseFloat(_pickParts[1]) || 0;
            const _minsToPickup = _sMs ? Math.round((_sMs - Date.now()) / 60000) : 0;
            // Only estimate if pickup is more than 5 min away; otherwise offer immediately.
            const _estMins = (_sMs && _minsToPickup > 5)
              ? _estimateDispatchLeadMins(_sCid, _pickLat, _pickLng)
              : 0;
            const _dtb = String(_estMins);
            // Use the passenger app's own BookingId as our internal Id to avoid
            // collisions with the external ASP.NET system's sequential job IDs.
            // _ipjJobId is the Firebase key (e.g. "6206112605071") — safe as a JS integer.
            const _sId = parseInt(_ipjJobId, 10) || newCompanyJobId(_sCid);
            // §103 — store as 'Scheduled' so it shows in Unassigned with the Sched badge.
            // NotifyDispatchAt timer (client) will promote to 'Pending' at dispatch time.
            jobStore.push({
              _fbKey: _ipjFbKey, Id: _sId, companyId: _sCid,
              BookingStatus: 'Scheduled', BookingSource: _isWebBk ? 'Website' : 'passenger',
              Name:          _sn.name,
              PhoneNo:       _sn.phone,
              PickAddress:   _sn.pickAddress,
              PickLatLng:    _sn.pickLatLng,
              DropAddress:   _sn.dropAddress,
              DropLatLng:    _sn.dropLatLng,
              VehicleType:   _sn.vehicleType,
              PaymentMethod: _sn.paymentMethod,
              EstimatedFare: _sn.estimatedFare,
              BookingDateTime: _bdt,
              ScheduledFor:  _sMs,
              Notes: _sn.notes, Passengers: _sn.passengers,
              serviceType: _sn.serviceType, bookingType: _sn.bookingType,
              paymentStatus: _sn.paymentStatus || '',
              DriverId: 0, VehicleId: 0, DispatchTimebefore: _dtb,
              NotifyDispatchAt: (function() {
                const _na = _ipjJob.NotifyDispatchAt || _ipjJob.notifyDispatchAt || '';
                if (_na) return _na;
                if (_sMs) return new Date(_sMs - (_estMins || 15) * 60000).toISOString();
                return null;
              })(),
              NotifyDispatchBeforeMinutes: parseInt(_ipjJob.NotifyDispatchBeforeMinutes || _ipjJob.notifyDispatchBeforeMinutes || '0') || _estMins || 15,
            });
            saveJobStore();
            console.log(`[passenger] Scheduled job ${_ipjFbKey} stored as Scheduled (svc=${_sn.serviceType}) — ${_sn.name} from ${_sn.pickAddress}`);
          }
          objectD(res, { ok: true, action: 'pending' });

        } else if (_ipjStatus === 'Waiting' || _ipjStatus === 'Pending') {
          // 'Pending' written by some external dispatch apps — treated same as 'Waiting' (book-now).
          // Also fired by the client-side NotifyDispatchAt timer to promote a Scheduled job.
          // FIX — also match by numeric Id so dispatch-console jobs (no _fbKey yet) are recognised.
          const _ipjNumId = parseInt(_ipjJobId, 10) || 0;
          const already = jobStore.find(j => j._fbKey === _ipjFbKey || (_ipjNumId > 0 && j.Id === _ipjNumId));
          const alreadyClosed = closedJobStore.find(j => j._fbKey === _ipjFbKey || (_ipjNumId > 0 && j.Id === _ipjNumId));
          // Stamp _fbKey onto an existing dispatch-console job so future lookups hit by key too.
          if (already && !already._fbKey) { already._fbKey = _ipjFbKey; saveJobStore(); }
          // §103 Bug 2 — promote an existing Scheduled job to Pending (NotifyDispatchAt fired).
          // Only if not already manually assigned/offered by a dispatcher.
          if (already && already.BookingStatus === 'Scheduled') {
            already.BookingStatus = 'Pending';
            saveJobStore();
            console.log(`[passenger] Scheduled job ${_ipjFbKey} promoted → Pending (NotifyDispatchAt)`);
            // fall through to the objectD below
          } else if (!already && !alreadyClosed) {
            const _wCid = String(sessionCompanyId);
            const _wn = _normFbJob(_ipjJob);
            // §103 Bug 1 — use 'Website' for web-portal bookings, not 'passenger'
            const _isWebBkW = !!(_ipjJob.WebBooking || _ipjJob.webBooking || _ipjJob.CreatedBy === 'WEB' || _ipjJob.CreatedBy === 'web' || (_ipjJob.BookingSource || '').toLowerCase() === 'website');
            // Use the passenger app's own BookingId as our internal Id to avoid
            // collisions with the external ASP.NET system's sequential job IDs.
            const _wId = parseInt(_ipjJobId, 10) || newCompanyJobId(_wCid);
            // §104 — if ScheduledFor is >30 min in the future, treat as a pre-booked
            // Scheduled job even when the website sends Status='Waiting' for all bookings.
            const _wSf = _wn.scheduledFor || 0;
            const _wTreatSched = _wSf > Date.now() + 30 * 60 * 1000;
            const _wPickParts  = (_wn.pickLatLng || '0,0').split(',');
            const _wPickLat    = parseFloat(_wPickParts[0]) || 0;
            const _wPickLng    = parseFloat(_wPickParts[1]) || 0;
            const _wEstMins    = _wTreatSched ? _estimateDispatchLeadMins(_wCid, _wPickLat, _wPickLng) : 0;
            const _wNotifyAt   = _wTreatSched
              ? (_ipjJob.NotifyDispatchAt || _ipjJob.notifyDispatchAt
                  || new Date(_wSf - (_wEstMins || 15) * 60000).toISOString())
              : null;
            const _wBdt = _wSf ? new Date(_wSf).toISOString() : (_wn.createdAt || new Date().toISOString());
            jobStore.push({
              _fbKey: _ipjFbKey, Id: _wId, companyId: _wCid,
              BookingStatus: _wTreatSched ? 'Scheduled' : 'Pending',
              BookingSource: _isWebBkW ? 'Website' : 'passenger',
              Name:          _wn.name,
              PhoneNo:       _wn.phone,
              PickAddress:   _wn.pickAddress,
              PickLatLng:    _wn.pickLatLng,
              DropAddress:   _wn.dropAddress,
              DropLatLng:    _wn.dropLatLng,
              VehicleType:   _wn.vehicleType,
              PaymentMethod: _wn.paymentMethod,
              EstimatedFare: _wn.estimatedFare,
              BookingDateTime: _wBdt,
              ..._wSf ? { ScheduledFor: _wSf } : {},
              ..._wNotifyAt ? { NotifyDispatchAt: _wNotifyAt, NotifyDispatchBeforeMinutes: _wEstMins || 15 } : {},
              Notes: _wn.notes, Passengers: _wn.passengers,
              serviceType: _wn.serviceType, bookingType: _wn.bookingType,
              paymentStatus: _wn.paymentStatus || '',
              DriverId: 0, VehicleId: 0, DispatchTimebefore: _wTreatSched ? String(_wEstMins) : '0',
            });
            saveJobStore();
            console.log(`[passenger] ${_wTreatSched ? 'Scheduled' : 'Waiting'} job ${_ipjFbKey} ingested (svc=${_wn.serviceType}) — ${_wn.name} from ${_wn.pickAddress}${_wTreatSched ? ' [auto-promoted to Scheduled, notifyAt=' + _wNotifyAt + ']' : ''}`);
          }
          objectD(res, { ok: true, action: 'pending' });

        } else if (_ipjStatus === 'Cancelled') {
          // Remove from jobStore only if the job has NOT yet been assigned/dispatched.
          // If a dispatcher has already assigned the job (Assigned/Active/Picking/Offered),
          // the passenger cancel arrives too late — don't silently delete an in-progress trip.
          // FIX — also match by numeric Id so dispatch-console jobs (no _fbKey yet) are found.
          const _ipjNumIdC = parseInt(_ipjJobId, 10) || 0;
          const _cIdx = jobStore.findIndex(j => j._fbKey === _ipjFbKey || (_ipjNumIdC > 0 && j.Id === _ipjNumIdC));
          if (_cIdx !== -1) {
            const _cJob = jobStore[_cIdx];
            const _safeToRemove = new Set(['Pending', 'Scheduled', 'No One', 'Unreached', '']);
            if (_safeToRemove.has(_cJob.BookingStatus || '')) {
              jobStore.splice(_cIdx, 1);
              saveJobStore();
              console.log(`[passenger] Cancelled job ${_ipjFbKey} removed from queue (was ${_cJob.BookingStatus})`);
            } else {
              console.log(`[passenger] Cancelled job ${_ipjFbKey} NOT removed — already in state "${_cJob.BookingStatus}" (dispatcher must handle)`);
            }
          }
          objectD(res, { ok: true, action: 'cancelled' });

        } else {
          objectD(res, { ok: false, error: 'unhandled status: ' + _ipjStatus });
        }

      } else if (action === '[UpdateScheduledLeadTime]') {
        // §103 — dispatcher adjusts NotifyDispatchBeforeMinutes on a scheduled web job.
        // Recalculates NotifyDispatchAt = ScheduledFor − newMins, saves, returns new values
        // so the client can reschedule the Firebase-promotion timer.
        const _ustJobId = (param('jobId') || '').toString().trim();
        const _ustMins  = Math.max(0, Math.min(180, parseInt(param('notifyBeforeMinutes') || '15') || 15));
        const _ustJob   = companyJobs(jobStore).find(j => String(j.Id) === _ustJobId && j.BookingStatus === 'Scheduled');
        if (!_ustJob) {
          objectD(res, { ok: false, error: 'scheduled job not found: ' + _ustJobId });
        } else {
          _ustJob.NotifyDispatchBeforeMinutes = _ustMins;
          if (_ustJob.ScheduledFor) {
            _ustJob.NotifyDispatchAt = new Date(_ustJob.ScheduledFor - _ustMins * 60000).toISOString();
          }
          saveJobStore();
          console.log(`[UpdateScheduledLeadTime] job #${_ustJobId} lead → ${_ustMins} min, notifyAt=${_ustJob.NotifyDispatchAt}`);
          objectD(res, { ok: true, notifyDispatchAt: _ustJob.NotifyDispatchAt, notifyBeforeMinutes: _ustMins });
        }

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
      const mockCid = mockReg ? Number(mockReg.companyId) : 0;
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

    // ── Account / access request — handled earlier in file (line ~1184).
    // This block is a fallback in case routing reaches here via the DS path.
    if (urlPath.includes('/DispatcherLogin.aspx/AccountRequest')) {
      jsonReply(res, { error: 'Please use the signup form on the login page.' });
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
  // .aspx files embed all JavaScript inline — use no-store so browsers always fetch
  // fresh code after a server restart rather than running stale cached JS.
  const _cc = ext === '.aspx' ? 'no-store, must-revalidate' : 'no-cache';
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': _cc,
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

// Independent stale-offer watchdog — runs every 90 s regardless of whether
// AutoDispatchVehiclesallride is being polled (e.g. tab closed mid-offer).
// If a job has been stuck in Offered for > 2 minutes, the 27-s browser timer
// that was tracking it died (page refresh / tab close).  Reset to Pending so
// the next auto-dispatch cycle or dispatcher action can re-offer it.
setInterval(() => {
  const STALE_MS = 2 * 60 * 1000;
  const now = Date.now();
  let changed = false;
  jobStore.forEach(j => {
    if (j.BookingStatus !== 'Offered') return;
    const age = j.offeredAt ? (now - j.offeredAt) : STALE_MS + 1;
    if (age > STALE_MS) {
      console.log(`[stale-offer watchdog] job #${j.Id} stuck as Offered for ${Math.round(age/1000)}s (driver ${j.DriverId}) — resetting to Pending`);
      j.BookingStatus = 'Pending';
      j.offeredAt     = null;
      j.DriverId      = 0;
      j.VehicleId     = 0;
      j.returnReason  = 'Offer expired (dispatcher reconnected)';
      changed = true;
    }
  });
  if (changed) saveJobStore();
}, 90 * 1000);

// ── pendingjobs Firebase normalizer — runs every 30 s ─────────────────────────
// Two responsibilities:
//
// Step 3 (stale-pending cleanup) — Delete Firebase pendingjobs records for jobs
//   that are already in closedJobStore. This handles the edge case where the
//   dispatcher successfully completed/assigned a trip but the rideStatus write
//   (which normally cleans up pendingjobs on the driver-app side) never happened —
//   leaving a stuck 'pending' record that prevents the slot being reused.
//   The existing normalizer only acted on status==='assigned'; this covers status==='pending'.
//
// Step 4 (schema patch) — For pendingjobs records missing any of the dispatcher-
//   required fields (PickAddress, DropAddress, BookingSource, WebBooking), patch
//   them in from the corresponding jobStore entry if found. Acts as a 30-second
//   auto-heal safety net so future schema gaps close without manual intervention.
//
// Fire-and-forget on Firebase; errors are logged but never surface to callers.
setInterval(async () => {
  let token;
  try { token = await getFirebaseServerToken(); } catch(e) { return; }
  if (!token) return;

  // Collect all distinct companyIds from registrationStore + jobStore
  const _normCids = new Set([
    ...(registrationStore || []).map(r => r.companyId).filter(Boolean),
    ...jobStore.map(j => String(j.companyId || '')).filter(Boolean),
  ]);
  if (!_normCids.size) return;

  for (const cid of _normCids) {
    try {
      const _normResp = await fetch(
        `${FB_DB_URL}/pendingjobs/${cid}.json?auth=${encodeURIComponent(token)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!_normResp.ok) continue;
      const _normData = await _normResp.json();
      if (!_normData || typeof _normData !== 'object') continue;

      for (const [key, rec] of Object.entries(_normData)) {
        if (!rec || typeof rec !== 'object') continue;
        const _normIdNum = parseInt(key, 10) ||
          parseInt(rec.BookingId || rec.bookingId || '', 10) || 0;

        // ── Step 3: stale-pending cleanup ──────────────────────────────────
        // If this pendingjobs key corresponds to a job that is already closed
        // AND is not currently live in jobStore, delete it so it doesn't
        // permanently block that slot.  The jobStore check is critical: the
        // same numeric ID can appear in closedJobStore from a prior session
        // while a brand-new job with that ID is actively running — in that
        // case we must not delete the live Firebase entry.
        if (_normIdNum) {
          const _normLive = jobStore.find(j =>
            j.Id === _normIdNum && String(j.companyId || '') === cid
          );
          if (!_normLive) {
            const _normClosed = closedJobStore.find(j =>
              j.Id === _normIdNum && String(j.companyId || '') === cid
            );
            if (_normClosed) {
              firebaseDbDelete(`pendingjobs/${cid}/${key}`, token).catch(() => {});
              console.log(`[pendingjobs-normalizer] Deleted stale pendingjobs/${cid}/${key} (job closed in store)`);
              continue;
            }
          }
        }

        // ── Step 4: schema patch ───────────────────────────────────────────
        // If the record is missing dispatcher-required fields, patch from
        // the corresponding jobStore entry (which may have been built correctly
        // by [IngestPassengerJob] or /api/payment/confirm).
        const _needsPatch = (!rec.PickAddress || !rec.DropAddress ||
          !rec.BookingSource || rec.WebBooking === undefined);
        if (!_needsPatch) continue;

        const _normJob = _normIdNum
          ? jobStore.find(j => j.Id === _normIdNum && String(j.companyId || '') === cid)
          : null;
        if (!_normJob) continue;

        const _patch = {};
        if (!rec.PickAddress  && _normJob.PickAddress)  _patch.PickAddress  = _normJob.PickAddress;
        if (!rec.DropAddress  && _normJob.DropAddress)  _patch.DropAddress  = _normJob.DropAddress;
        if (!rec.BookingSource && _normJob.BookingSource) _patch.BookingSource = _normJob.BookingSource;
        if (rec.WebBooking === undefined) {
          _patch.WebBooking = !!(
            _normJob.BookingSource === 'Website' || _normJob.BookingSource === 'web' ||
            _normJob.WebBooking === true
          );
        }
        if (Object.keys(_patch).length) {
          firebaseDbPatch(`pendingjobs/${cid}/${key}`, _patch, token).catch(() => {});
          console.log(`[pendingjobs-normalizer] Patched pendingjobs/${cid}/${key}: ${Object.keys(_patch).join(', ')}`);
        }
      }
    } catch (e) {
      console.warn(`[pendingjobs-normalizer] Error scanning cid=${cid}: ${e.message}`);
    }
  }
}, 30 * 1000);

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

// ─── Startup: seed ZONE_DRIVERS from Firebase ────────────────────────────────
// On server restart ZONE_DRIVERS is empty. Auto-dispatch would see 0 drivers
// until each driver app sends its next heartbeat — which could be minutes away
// for idle drivers. This reads the live `online/{companyId}` nodes from Firebase
// and pre-populates ZONE_DRIVERS so dispatching works immediately after restart.
// Entries are marked _fbSeeded=true so they can be identified; the first real
// heartbeat from each driver app overwrites them with fresh data.
async function _seedZoneDriversFromFirebase() {
  try {
    const token = await getFirebaseServerToken();
    if (!token) { console.warn('[seed-drivers] no Firebase token — skipping startup seed'); return; }

    const r = await fbRequest(
      `${FB_DB_URL}/online.json?auth=${encodeURIComponent(token)}`, 'GET', null
    );
    if (r.status !== 200 || !r.body || typeof r.body !== 'object') {
      console.log('[seed-drivers] online/ node empty or unavailable — skipping');
      return;
    }

    const _OFFLINE = new Set(['Offline','offline','LoggedOut','loggedout','logoff','inactive']);
    let seeded = 0;

    for (const [cid, vehicles] of Object.entries(r.body)) {
      if (!vehicles || typeof vehicles !== 'object') continue;
      for (const [vehicleId, node] of Object.entries(vehicles)) {
        if (!node || typeof node !== 'object') continue;

        // Driver fields may be flat on the node or nested under current/
        const cur = (node.current && typeof node.current === 'object') ? node.current : {};

        const status = node.vehiclestatus || cur.vehiclestatus || cur.currentstatus || '';
        // Skip offline / logged-out drivers — they are genuinely not available
        if (!status || _OFFLINE.has(status)) continue;

        const driverId     = String(cur.driverid  || cur.driverId  || node.driverid  || vehicleId);
        const drivername   = cur.drivername   || cur.driverName   || node.drivername   || '';
        const vehiclenumber= cur.vehiclenumber|| cur.vehicleNumber|| node.vehiclenumber|| vehicleId;
        const vehicletype  = cur.vehicletype  || cur.vehicleType  || node.vehicletype  || '';
        const zonename     = cur.zonename     || cur.zoneName     || node.zonename     || '';
        const zonequeue    = parseInt(cur.zonequeue || cur.zoneQueue || node.zonequeue || '0') || 0;
        const lat          = cur.lat || node.lat || '';
        const lng          = cur.lng || node.lng || '';

        // Don't overwrite an entry that the driver app has already re-registered
        const already = ZONE_DRIVERS.find(d =>
          String(d.driverid) === driverId || String(d.VehicleId) === vehicleId
        );
        if (already) continue;

        const maxQ = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
        ZONE_DRIVERS.push({
          driverid:      driverId,
          VehicleId:     vehicleId,
          drivername,
          vehiclenumber,
          vehicletype,
          vehiclestatus: status,
          zonename,
          zonequeue:     zonequeue || maxQ + 1,
          queueWaitSince: Date.now(),
          lat,
          lng,
          companyId:     cid,
          _fbSeeded:     true,  // replaced by real heartbeat on driver's next update
        });
        seeded++;
      }
    }
    console.log(`[seed-drivers] seeded ${seeded} driver(s) from Firebase online/ into ZONE_DRIVERS`);
  } catch (e) {
    console.warn('[seed-drivers] startup seed failed (non-fatal):', e.message);
  }
}

async function _syncBizAccountsFromFirebase() {
  try {
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const cids = [...new Set(registrationStore.map(r => r.companyId).filter(Boolean))];
    // Always include default companyId even if no registrations yet
    if (!cids.includes('620611')) cids.push('620611');
    let added = 0;
    for (const cid of cids) {
      let snap;
      try { snap = await firebaseDbGet(`businessAccounts/${cid}`, tok); } catch(e) {
        console.warn(`[sync-biz-accounts] Firebase read failed for cid=${cid}: ${e.message}`);
        continue;
      }
      console.log(`[sync-biz-accounts] cid=${cid} snap type=${typeof snap} isNull=${snap===null} keys=${snap && typeof snap==='object' ? Object.keys(snap).join(',') : 'n/a'}`);
      if (!snap || typeof snap !== 'object') continue;
      Object.entries(snap).forEach(([key, val]) => {
        if (!val || val.active === false) return;
        const _existing = businessAccStore.find(b => b.id === key && b.companyId === cid);
        if (_existing) {
          // Refresh fields that may have been added after the account was first persisted
          if (val.accountCode)  _existing.accountCode  = val.accountCode;
          if (val.paymentTerms) _existing.paymentTerms = val.paymentTerms;
          if (val.name)         _existing.name         = val.name;
          return;
        }
        businessAccStore.push({
          id:           key,
          companyId:    cid,
          name:         val.name         || '',
          contact_name: val.contact      || '',
          contact:      val.contact      || '',
          phone:        val.phone        || '',
          email:        val.email        || '',
          address:      val.address      || '',
          notes:        val.notes        || '',
          accountCode:  val.accountCode  || '',
          paymentTerms: val.paymentTerms || '',
          active:       val.active !== false,
          created_at:   val.createdAt    || new Date().toISOString(),
        });
        added++;
      });
    }
    if (added) saveJsonStore(BUSINESS_ACCOUNTS_FILE, businessAccStore);
    console.log(`[sync-biz-accounts] synced ${added} account(s) from Firebase (total: ${businessAccStore.length})`);
  } catch (e) {
    console.warn('[sync-biz-accounts] startup sync failed (non-fatal):', e.message);
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}`);
  // Seed ZONE_DRIVERS from Firebase so auto-dispatch works immediately after restart,
  // without waiting for each driver app to send its next heartbeat.
  _seedZoneDriversFromFirebase();
  // Sync business accounts from Firebase businessAccounts/{cid} so the local store
  // reflects any accounts created or managed outside this console (e.g. Dispatch HQ).
  _syncBizAccountsFromFirebase();
});
