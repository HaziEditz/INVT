require('dotenv').config();

// CRITICAL: must be set BEFORE any Date object is constructed so that all
// `new Date()` / `toString()` / `toLocaleString()` calls without an explicit
// timezone argument resolve to NZ local time.  Without this the Replit
// container runs in UTC and every dispatch timestamp is 12-13 h off.
process.env.TZ = 'Pacific/Auckland';

// ─── Timezone standards (BookaWaka multi-tenant) ──────────────────────────────
// Rule: Store timestamps as UTC ISO  →  new Date().toISOString()
// Rule: "today's date"              →  _tzTodayStr(tz)         (en-CA locale = YYYY-MM-DD)
// Rule: "midnight"                  →  _tzTodayStart(tz)
// Rule: display a time              →  _tzDisplay(ts, tz)
//
// Per-company IANA timezone map.  Add new companies here as they onboard.
const companyTZMap = {
  '620611': 'Pacific/Auckland',   // Legacy Invercargill tenant
  '860869': 'Pacific/Auckland',   // Invercargill Taxis Southland Limited (active test)
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

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'taxitime.co.nz', 'Dispatchthree');
const DIST_DIR = path.join(__dirname, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const REACT_SPA_ROUTES = new Set(['/login', '/dispatch', '/dispatch/map']);

if (!fs.existsSync(DIST_INDEX)) {
  console.warn('[server] dist/index.html missing — run: npm install && npm run build');
} else {
  console.log('[server] React dispatch UI ready at dist/index.html');
}

function serveDistAsset(res, urlPath) {
  const rel = urlPath.replace(/^\//, '');
  const fp = path.join(DIST_DIR, rel);
  if (!fp.startsWith(DIST_DIR) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) return false;
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(fp).pipe(res);
  return true;
}

function serveSpaIndex(res) {
  if (!fs.existsSync(DIST_INDEX)) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Dispatch UI not built — run: npm install && npm run build');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, must-revalidate' });
  fs.createReadStream(DIST_INDEX).pipe(res);
}

async function gateDispatchAccess(req, res) {
  const companyId = getSessionCompanyId(req);
  if (!companyId) {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return false;
  }
  const _gateReg = registrationStore.find(r => r.companyId === companyId);
  const _gateAccess = _gateReg ? await resolveCompanyAccessAsync(_gateReg) : { loginBlocked: true };
  if (!_gateReg || _gateAccess.loginBlocked) {
    const reason = _gateAccess.blockMessage === SUBSCRIPTION_EXPIRED_MSG ? 'subscription_expired' : 'account_inactive';
    res.writeHead(302, {
      Location: `/login?reason=${reason}`,
      'Set-Cookie': 'BW_SID=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0',
    });
    res.end();
    return false;
  }
  return true;
}

function normalizeUrlPath(urlPath) {
  let p = String(urlPath || '/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/** Routes handled by server.js APIs or legacy ASPX — not React Router */
function isBackendRoute(urlPath) {
  return urlPath.startsWith('/api/') ||
    urlPath.startsWith('/admin/') ||
    urlPath.startsWith('/DataManager/') ||
    urlPath.startsWith('/dev/') ||
    urlPath.startsWith('/__mockup/');
}

async function tryServeReactSpa(req, res, urlPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (isBackendRoute(urlPath)) return false;

  const spaPath = normalizeUrlPath(urlPath);

  // Vite /assets/* — dist only; never fall through to legacy Dispatchthree/assets/
  if (urlPath.startsWith('/assets/')) {
    if (serveDistAsset(res, urlPath)) return true;
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${urlPath}`);
    return true;
  }

  // Other static files shipped in dist/ (e.g. favicon)
  if (urlPath !== '/' && !REACT_SPA_ROUTES.has(spaPath) && serveDistAsset(res, urlPath)) {
    return true;
  }

  // React Router entry points
  if (spaPath === '/login' || REACT_SPA_ROUTES.has(spaPath)) {
    if (spaPath === '/dispatch' || spaPath === '/dispatch/map') {
      if (!(await gateDispatchAccess(req, res))) return true;
    }
    serveSpaIndex(res);
    return true;
  }

  return false;
}

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
const COMPANY_JOB_SEQ_FILE      = path.join(DATA_DIR, 'companyJobSeq.json');
const STRIPE_PAYMENTS_FILE      = path.join(DATA_DIR, 'stripe_payments.json');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {} }

// ─── Registration / account request store ────────────────────────────────────
// status: pending | approved | rejected | trial | active | grace | deactivated
// plan:   free_trial | starter | pro
// serviceType: taxi | restaurant | freight | all
const DEFAULT_GRACE_PERIOD_DAYS = 7;
const SUBSCRIPTION_EXPIRED_MSG = 'Your subscription has expired. Please contact your administrator to renew.';

let registrationStore = [];
try {
  if (fs.existsSync(REGISTRATIONS_FILE)) {
    registrationStore = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf8')) || [];
    console.log(`[persist] loaded ${registrationStore.length} registration request(s) from disk`);
  }
} catch(e) { console.log('[persist] registrations load error:', e.message); }

// Pre-cutover company IDs — keep in local .data for history but never auto-stamp base
// coordinates or mirror geo updates for them. All live Firebase I/O uses bookawaka2026-564e1 only.
const _LEGACY_COMPANY_IDS = new Set(['620611']);
function _skipBaseGeoForRegistration(reg) {
  const cid = String(reg && reg.companyId || '').trim();
  return !cid || _LEGACY_COMPANY_IDS.has(cid);
}

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
  // Best-effort mirror to Firebase so the Super Admin portal (separate Replit)
  // sees signups in real time. Fire-and-forget — failure here must never
  // break local registration.
  try { mirrorAllRegistrationsToFirebase(); } catch(_) {}
}

// ── Firebase mirror: onboardRequests/{regId} ──────────────────────────────
// The Super Admin portal (separate Replit) reads signups from
// onboardRequests/{id}, with this field schema:
//   businessName, contactName, email, phone, city (=area), country, regNo
//   (=businessNumber), fleetSize, serviceType, plan, planLabel, planPrice,
//   status, submittedAt, companyId, uid (=ownerUid), approvedAt, trialStart,
//   trialEnd, rejectedAt, rejectionNote, activatedAt, deactivatedAt
// Strips _rawPassword and any other secrets — only safe fields are mirrored.
function _safeSignupSnapshot(r) {
  if (!r || !r.id) return null;
  return {
    id:             r.id,
    status:         r.status || 'pending',
    submittedAt:    r.submittedAt || null,
    // Portal field names ↓ (renamed from local schema in parentheses)
    businessName:   r.company || '',          // ← company
    contactName:    r.name || '',             // ← name
    email:          r.email || '',
    phone:          r.phone || '',
    regNo:          r.businessNumber || '',   // ← businessNumber
    fleetSize:      r.fleetSize || '',
    city:           r.area || '',             // ← area
    country:        r.country || '',
    serviceType:    r.serviceType || 'taxi',
    plan:           r.plan || '',
    planLabel:      r.planLabel || '',
    planPrice:      r.planPrice || 0,
    trialDays:      r.trialDays || 0,
    companyId:      r.companyId || null,
    uid:            r.ownerUid || null,       // ← ownerUid
    approvedAt:     r.approvedAt || null,
    trialStart:     r.trialStart || null,
    trialEnd:       r.trialEnd || null,
    graceEnd:       r.graceEnd || null,
    rejectedAt:     r.rejectedAt || null,
    rejectionNote:  r.rejectedReason || '',   // ← rejectedReason
    activatedAt:    r.activatedAt || null,
    deactivatedAt:  r.deactivatedAt || null,
    baseLat:        r.baseLat != null ? Number(r.baseLat) : null,
    baseLng:        r.baseLng != null ? Number(r.baseLng) : null,
    baseGeoSource:  r.baseGeoSource || null,
    source:         'dispatch',
    mirroredAt:     Date.now(),
  };
}
// Production Firebase rules already allow auth!=null read/write on
// onboardRequests/{$refId}. Server-side writes use BW_FIREBASE_SECRET (legacy
// secret) which bypasses rules entirely; without it the mirror silently no-ops
// and we warn at boot.
async function mirrorRegistrationToFirebase(reg) {
  if (!reg || !reg.id) return;
  if (!process.env.BW_FIREBASE_SECRET) return;
  const snapshot = _safeSignupSnapshot(reg);
  try {
    await firebaseDbSet(`onboardRequests/${reg.id}`, snapshot, null);
  } catch(e) {
    console.log(`[saMirror] write onboardRequests/${reg.id} failed: ${e.message}`);
  }
}
async function deleteRegistrationFromFirebase(regId) {
  if (!regId) return;
  if (!process.env.BW_FIREBASE_SECRET) return;
  try {
    await firebaseDbDelete(`onboardRequests/${regId}`, null);
  } catch(e) {
    console.log(`[saMirror] delete onboardRequests/${regId} failed: ${e.message}`);
  }
}
// Mirror every record — runs after every saveRegistrations() and at boot.
function mirrorAllRegistrationsToFirebase() {
  if (!process.env.BW_FIREBASE_SECRET) return;
  registrationStore.forEach(r => { mirrorRegistrationToFirebase(r); });
}

const ONBOARD_SYNC_STATUSES = new Set(['trial', 'active', 'grace']);

function mapOnboardRequestToRegistration(remoteId, v) {
  return {
    id:             v.id || remoteId,
    status:         v.status || 'pending',
    submittedAt:    v.submittedAt || null,
    company:        v.businessName || v.companyName || '',
    name:           v.contactName || v.ownerName || '',
    email:          v.email || '',
    phone:          v.phone || '',
    businessNumber: v.regNo || '',
    fleetSize:      v.fleetSize || '',
    area:           v.city  || '',
    country:        v.country || '',
    serviceType:    v.serviceType || 'taxi',
    plan:           v.plan || '',
    planLabel:      v.planLabel || '',
    planPrice:      v.planPrice || 0,
    trialDays:      v.trialDays || 0,
    companyId:      v.companyId ? String(v.companyId) : null,
    ownerUid:       v.uid || v.authUid || null,
    approvedAt:     v.approvedAt || null,
    trialStart:     v.trialStart || null,
    trialEnd:       v.trialEnd || null,
    graceEnd:       v.graceEnd || null,
    rejectedAt:     v.rejectedAt || null,
    rejectedReason: v.rejectionNote || null,
    activatedAt:    v.activatedAt || null,
    deactivatedAt:  v.deactivatedAt || null,
  };
}

function upsertRegistrationFromOnboard(remoteId, v) {
  if (!v || typeof v !== 'object') return false;
  const companyId = v.companyId ? String(v.companyId) : '';
  if (!companyId || !ONBOARD_SYNC_STATUSES.has(v.status)) return false;

  const mapped = mapOnboardRequestToRegistration(remoteId, v);
  let idx = registrationStore.findIndex(r => r.id === remoteId);
  if (idx === -1) idx = registrationStore.findIndex(r => r.companyId === companyId);

  if (idx === -1) {
    registrationStore.push(mapped);
    if (mapped.companyId) void _stampRegistrationBaseCoords(mapped, 'onboard-sync/new');
    return true;
  }

  const existing = registrationStore[idx];
  let changed = false;
  for (const [key, val] of Object.entries(mapped)) {
    if (val != null && val !== '' && existing[key] !== val) {
      existing[key] = val;
      changed = true;
    }
  }
  if (changed && existing.companyId) void _stampRegistrationBaseCoords(existing, 'onboard-sync/update');
  return changed;
}

function syncApprovedOnboardRequests(remote) {
  if (!remote || typeof remote !== 'object') return 0;
  let updated = 0;
  for (const [remoteId, v] of Object.entries(remote)) {
    if (upsertRegistrationFromOnboard(remoteId, v)) updated++;
  }
  if (updated) {
    try { fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(registrationStore, null, 2), 'utf8'); } catch(_) {}
    console.log(`[onboard-sync] synced ${updated} approved registration(s) from onboardRequests`);
  }
  return updated;
}

function handleOnboardStreamEvent(payload) {
  if (!payload || typeof payload !== 'object') return;
  const p = payload.path || '/';
  const data = payload.data;

  if (p === '/' && data && typeof data === 'object') {
    syncApprovedOnboardRequests(data);
    return;
  }

  const match = String(p).match(/^\/([^/]+)$/);
  if (match && data && typeof data === 'object') {
    if (upsertRegistrationFromOnboard(match[1], data)) saveRegistrations();
  }
}

async function connectOnboardRequestsStream() {
  let token = process.env.BW_FIREBASE_SECRET || null;
  if (!token) {
    try { token = await getFirebaseServerToken(); } catch (_) { token = null; }
  }
  if (!token) {
    console.warn('[onboard-sync] no Firebase auth token — onboardRequests listener disabled');
    return;
  }

  const url = new URL(`${FB_DB_URL}/onboardRequests.json`);
  url.searchParams.set('auth', token);

  const req = https.request(url, { method: 'GET', headers: { Accept: 'text/event-stream' } }, (res) => {
    if (res.statusCode !== 200) {
      console.warn(`[onboard-sync] stream HTTP ${res.statusCode} — retry in 30s`);
      res.resume();
      setTimeout(connectOnboardRequestsStream, 30000);
      return;
    }
    console.log('[onboard-sync] listening to onboardRequests (Firebase REST stream)');
    let buf = '';
    res.on('data', (chunk) => {
      buf += chunk.toString();
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        const dataMatch = part.match(/data:\s*(.+)/);
        if (!dataMatch) continue;
        try {
          handleOnboardStreamEvent(JSON.parse(dataMatch[1]));
        } catch (e) {
          console.warn('[onboard-sync] stream parse error:', e.message);
        }
      }
    });
    res.on('end', () => {
      console.log('[onboard-sync] stream ended — reconnecting in 5s');
      setTimeout(connectOnboardRequestsStream, 5000);
    });
  });
  req.on('error', (err) => {
    console.warn('[onboard-sync] stream error:', err.message, '— retry in 30s');
    setTimeout(connectOnboardRequestsStream, 30000);
  });
  req.end();
}

function startOnboardRequestsListener() {
  connectOnboardRequestsStream().catch((err) => {
    console.warn('[onboard-sync] listener start failed:', err.message);
    setTimeout(startOnboardRequestsListener, 30000);
  });
}
// Startup reconciliation: BACKFILL-ONLY. We do NOT prune Firebase based on
// what's in local store, because production deployments on Replit autoscale
// can have ephemeral `.data/` — a restart with a stale bundled
// registrationRequests.json would otherwise wipe legitimate signups that
// were written between restarts. Firebase is treated as durable storage;
// deletions only happen via the explicit admin DELETE endpoint.
//
// Additionally, we now PULL approved onboardRequests from Firebase on boot and
// via a live REST stream listener so SA/website approvals sync into registrationStore.
async function reconcileDispatchSignupsOnBoot() {
  if (!process.env.BW_FIREBASE_SECRET) {
    console.log('[saMirror] BW_FIREBASE_SECRET not set — Super Admin mirror disabled. Set the secret to enable.');
    return;
  }
  try {
    // 1. PULL: hydrate any dispatch-sourced records from Firebase into local
    //    store. This protects against the autoscale ephemeral-disk problem.
    const remote = await firebaseDbGet('onboardRequests', null);
    if (remote && typeof remote === 'object') {
      syncApprovedOnboardRequests(remote);
    }
    // 2. PUSH: backfill anything local that isn't (yet) in Firebase.
    if (registrationStore.length) {
      console.log(`[saMirror] backfilling ${registrationStore.length} registration(s) to Firebase onboardRequests/`);
      mirrorAllRegistrationsToFirebase();
    }
    // NOTE: prune step removed. See block comment above.
  } catch(e) {
    console.log(`[saMirror] reconcile failed: ${e.message}`);
  }
}
setTimeout(reconcileDispatchSignupsOnBoot, 3000);
setTimeout(startOnboardRequestsListener, 5000);
setTimeout(() => { _healMissingRegistrationBaseCoords('boot'); }, 8000);

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
// Use BW_SESSION_SECRET (stable across deploys) — NOT BW_ADMIN_KEY which may rotate.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_HMAC_KEY = process.env.BW_SESSION_SECRET || process.env.BW_ADMIN_KEY || ADMIN_KEY;
function createSessionToken(companyId) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `${companyId}.${expiry}`;
  const sig = crypto.createHmac('sha256', SESSION_HMAC_KEY).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
function parseSessionToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [companyId, expiry, sig] = parts;
  const payload = `${companyId}.${expiry}`;
  const expected = crypto.createHmac('sha256', SESSION_HMAC_KEY).update(payload).digest('hex');
  if (sig !== expected) return null;
  if (Date.now() > parseInt(expiry, 10)) return null;
  return companyId;
}
function sessionCookieHeader(companyId) {
  const token = createSessionToken(companyId);
  return `BW_SID=${token}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
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
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDIVSI_GRYG0hCPvc9h80QXZMxwZoejctQ',
  authDomain: 'bookawaka2026-564e1.firebaseapp.com',
  databaseURL: 'https://bookawaka2026-564e1-default-rtdb.firebaseio.com',
  projectId: 'bookawaka2026-564e1',
  storageBucket: 'bookawaka2026-564e1.firebasestorage.app',
  messagingSenderId: '909621127467',
  appId: '1:909621127467:web:504f502a533ca0a216fd6e',
};
const FB_API_KEY  = FIREBASE_CONFIG.apiKey;
const FB_DB_URL   = FIREBASE_CONFIG.databaseURL;

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

function fbRequest(url, method, payload, extraHeaders) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const parsed = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (extraHeaders && typeof extraHeaders === 'object') {
      Object.keys(extraHeaders).forEach(k => { headers[k] = extraHeaders[k]; });
    }
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers,
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const out = { status: res.statusCode, headers: res.headers || {} };
        try { out.body = JSON.parse(data); }
        catch(e) { out.body = data; }
        resolve(out);
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
async function readCompanySettingsNode(companyId) {
  if (!companyId) return null;
  try {
    const tok = await getFirebaseServerToken();
    return await firebaseDbGet(`companySettings/${companyId}`, tok);
  } catch (e) {
    console.warn(`[billing] read companySettings/${companyId} failed:`, e.message);
    return null;
  }
}

/** Parse billing nextDueDate (ISO string or epoch ms). */
function parseBillingDueMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/** Merge registration record with Firebase companySettings for login access. */
function resolveCompanyAccess(reg, settings) {
  const now = Date.now();
  const plan = (settings && settings.plan) || {};
  const billing = (settings && settings.billing) || {};
  const graceDays = Math.max(0, Number(billing.gracePeriodDays ?? billing.graceDays ?? DEFAULT_GRACE_PERIOD_DAYS) || DEFAULT_GRACE_PERIOD_DAYS);
  const extensionDays = Math.max(0, Number(billing.extensionDays ?? 0) || 0);
  const trialEnd = Number(plan.trialEnd || reg.trialEnd || 0) || null;
  const billingStatus = String(billing.status || plan.status || '').toLowerCase();
  const planStatus = billingStatus || String(reg.status || 'active').toLowerCase();

  const hasFirebaseBilling = !!(settings && (
    settings.active !== undefined ||
    billing.status ||
    billing.nextDueDate
  ));

  let subscriptionOk;
  let accessUntil = null;

  if (hasFirebaseBilling) {
    const companyActive = settings.active === true;
    const dueMs = parseBillingDueMs(billing.nextDueDate);
    const dueFuture = dueMs != null && dueMs > now;
    const duePast = dueMs != null && dueMs <= now;
    // Allow login if active OR next due date is in the future.
    // Block only when BOTH active=false AND nextDueDate is past.
    subscriptionOk = companyActive || dueFuture || !(settings.active === false && duePast);
    if (dueMs != null) {
      accessUntil = dueMs;
    } else if (billingStatus === 'trial' && trialEnd) {
      accessUntil = trialEnd + (graceDays + extensionDays) * 86400000;
    }
  } else {
    accessUntil = trialEnd ? trialEnd + (graceDays + extensionDays) * 86400000 : null;
    const pastGrace = !!(accessUntil && now > accessUntil);
    subscriptionOk = !pastGrace &&
      planStatus !== 'deactivated' &&
      planStatus !== 'suspended' &&
      planStatus !== 'deleted';
  }

  const loginBlocked = !subscriptionOk ||
    planStatus === 'deactivated' ||
    planStatus === 'suspended' ||
    planStatus === 'deleted';
  const showBanner = !loginBlocked && (
    planStatus === 'trial' || planStatus === 'overdue' || planStatus === 'grace' ||
    reg.status === 'trial' || reg.status === 'grace' ||
    (trialEnd && now >= trialEnd && accessUntil && now < accessUntil)
  );
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : null;
  const daysUntilBlock = accessUntil ? Math.max(0, Math.ceil((accessUntil - now) / 86400000)) : null;

  return {
    status: planStatus || reg.status,
    regStatus: reg.status,
    trialEnd,
    gracePeriodDays: graceDays,
    extensionDays,
    accessUntil,
    daysLeft,
    daysUntilBlock,
    showBanner,
    loginBlocked,
    blockMessage: SUBSCRIPTION_EXPIRED_MSG,
    canAccess: !loginBlocked,
    planName: plan.name || plan.planLabel || reg.planLabel || '',
    companyActive: settings?.active === true,
    billingStatus,
    nextDueDate: billing.nextDueDate || null,
  };
}

async function resolveCompanyAccessAsync(reg) {
  if (!reg || !reg.companyId) return { loginBlocked: true, blockMessage: SUBSCRIPTION_EXPIRED_MSG };
  const settings = await readCompanySettingsNode(reg.companyId);
  return resolveCompanyAccess(reg, settings);
}

async function syncCompanySettingsBilling(companyId, planPatch, billingPatch) {
  if (!companyId) return;
  try {
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const now = Date.now();
    if (planPatch) await firebaseDbPatch(`companySettings/${companyId}/plan`, Object.assign({}, planPatch, { updatedAt: now }), tok);
    if (billingPatch) await firebaseDbPatch(`companySettings/${companyId}/billing`, Object.assign({}, billingPatch, { updatedAt: now }), tok);
  } catch (e) {
    console.warn(`[billing] sync companySettings/${companyId} failed:`, e.message);
  }
}

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

// §FIX-Q helper — ETag-guarded conditional SET. Used by the unassign cancel
// notification path so we don't overwrite a NEW offer that arrived to the same
// driver between our GET and SET. If the node is empty or refs `expectBookingId`,
// we PUT `value` with `If-Match: <etag>`. Firebase returns 412 if the ETag has
// changed (race lost — a newer write happened) and we skip silently. Returns
// an action tag for logging: 'set', 'kept-different', 'kept-changed', 'empty-set'.
async function fbCompareAndSet(path, expectBookingId, value, idToken) {
  const url = `${FB_DB_URL}/${path}.json?auth=${fbAuthToken(idToken)}`;
  const g = await fbRequest(url, 'GET', null, { 'X-Firebase-ETag': 'true' });
  const n = g.body || {};
  const etag = g.headers && (g.headers['etag'] || g.headers['ETag']);
  const isEmpty = !n || (typeof n === 'object' && Object.keys(n).length === 0);
  const refBid = (!isEmpty) ? String(n.BookingId || n.bookingId || n.jobId || n._jobId || '') : '';
  if (!isEmpty && refBid && refBid !== String(expectBookingId)) {
    return { action: 'kept-different', refBid };
  }
  // Defensive: non-empty node but no recognised bookingId field — refuse blind
  // overwrite (schema may have drifted, or a foreign writer placed data here).
  if (!isEmpty && !refBid) {
    return { action: 'kept-unknown-schema', refBid: '' };
  }
  // Defensive: no ETag returned — we can't guarantee race safety, so skip the
  // PUT rather than fall back to unconditional write. The notification/ write
  // still goes through and surfaces "Job Cancel" to the driver app.
  if (!etag) {
    return { action: 'kept-no-etag', refBid };
  }
  const p = await fbRequest(url, 'PUT', value, { 'if-match': etag });
  if (p.status === 412) return { action: 'kept-changed', refBid };
  if (p.status !== 200) throw new Error(`fbCompareAndSet PUT failed: status=${p.status} body=${JSON.stringify(p.body)}`);
  return { action: isEmpty ? 'empty-set' : 'set', refBid };
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

/** Mirror zone queue to online/{cid}/{vid} when driver goes Available (incl. shift start). */
function syncZonequeueToFirebase(companyId, vehicleId, queueNo, zonename, source) {
  if (!companyId || !vehicleId || !queueNo) return;
  const _src = source || 'syncZonequeue';
  void (async () => {
    try {
      const tok = await getFirebaseServerToken();
      if (!tok) return;
      const topPatch = { zonequeue: queueNo, queueWaitSince: Date.now() };
      if (zonename) topPatch.zonename = zonename;
      await firebaseDbPatch(`online/${companyId}/${vehicleId}`, topPatch, tok);
      await firebaseDbPatch(`online/${companyId}/${vehicleId}/current`, { zonequeue: queueNo }, tok)
        .catch(() => undefined);
      console.log(`  [${_src}] Firebase zonequeue=${queueNo} → online/${companyId}/${vehicleId}`);
    } catch (e) {
      console.warn(`  [${_src}] Firebase zonequeue write failed:`, e && e.message);
    }
  })();
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
    let   _vId     = vehId ? String(vehId).trim() : '';
    let   _dId     = drvId ? String(drvId).trim() : '';
    // Defensive fallback: if vid/did are missing, look them up from the job
    // record or ZONE_DRIVERS so the jobs/{cid}/{vid}/{drv} DELETE still fires.
    // Previously the DELETE was silently skipped when either was empty, leaving
    // the Firebase node to linger until the frontend orphan-cleanup sweep.
    if (!_vId || !_dId) {
      try {
        const _allStores = (typeof jobStore !== 'undefined' ? jobStore : [])
          .concat(typeof closedJobStore !== 'undefined' ? closedJobStore : []);
        const _job = _allStores.find(j => String(j && j.Id) === _bId);
        if (_job) {
          if (!_vId) _vId = String(_job.VehicleNo || _job.VehicleId || _job.CallSign || '').trim();
          if (!_dId) _dId = String(_job.DriverId || _job.driverId || '').trim();
        }
        if ((!_vId || !_dId) && typeof ZONE_DRIVERS !== 'undefined') {
          // Scope to same companyId — global match risks pulling a driver from
          // another tenant and deleting their active Firebase node.
          const _zd = ZONE_DRIVERS.find(d =>
            d.companyId && String(d.companyId) === _cid &&
            ((_dId && (String(d.driverid) === _dId || String(d.VehicleId) === _dId)) ||
             (_vId && (String(d.VehicleId) === _vId || String(d.vehiclenumber) === _vId))));
          if (_zd) {
            if (!_vId) _vId = String(_zd.VehicleId || _zd.vehiclenumber || '').trim();
            if (!_dId) _dId = String(_zd.driverid || '').trim();
          }
        }
      } catch(eFb) { /* best-effort lookup */ }
    }
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

    // 1. /pendingjobs/{cid}/{bookingId} — PATCH to terminal status THEN DELETE.
    //    The PATCH stamps Status:Completed/Cancelled + completedAt/cancelledAt
    //    for any consumer racing the cleanup (SA portal, passenger-app trip
    //    history listeners) so they see the terminal state on the snapshot
    //    immediately preceding removal. The DELETE then removes the record so
    //    the driver app's pendingjobs listener clears its local card — without
    //    this, completed hail trips lingered as "ghost Active" entries on the
    //    driver phone because pendingjobs membership (not its Status field) is
    //    what the driver app uses to decide whether to show the card.
    //    Trip history is preserved in /allbookings/{cid}/{bookingId} and the
    //    server-side closedJobStore. IngestPassengerJob's resurrection guard
    //    is unaffected (it only re-creates from Scheduled/Waiting/Pending; a
    //    DELETED record cannot satisfy any of those statuses).
    tasks.push((async () => {
      try {
        const _pjUrl = `${FB_DB_URL}/pendingjobs/${_cid}/${_bId}.json?auth=${auth}`;
        const _p = await fbRequest(_pjUrl, 'PATCH',
          Object.assign({ Status: _final, BookingStatus: _final }, stamp));
        console.log(`${_tag} pendingjobs/${_cid}/${_bId} → ${_final} [${_p.status}]`);
        // Guarded DELETE — only remove the node if it STILL shows our terminal
        // stamp. Defends against the (very narrow) ID-recycle race where a fresh
        // booking with the same numeric bookingId could land between our PATCH
        // and our DELETE; if that happened, Status would no longer be _final
        // and we MUST NOT wipe the live record. bookingIds are timestamp-
        // monotonic so this is effectively impossible in practice, but the
        // GET-then-DELETE check is cheap insurance.
        const _g = await fbRequest(_pjUrl, 'GET', null);
        const _cur = _g.body || {};
        const _curStatus = String(_cur.Status || _cur.BookingStatus || '');
        if (_curStatus === _final) {
          const _d = await fbRequest(_pjUrl, 'DELETE', null);
          console.log(`${_tag} pendingjobs/${_cid}/${_bId} deleted [${_d.status}]`);
        } else if (_curStatus) {
          console.warn(`${_tag} pendingjobs/${_cid}/${_bId} DELETE skipped — status now "${_curStatus}" (expected "${_final}", ID-recycle race?)`);
        } else {
          // Record already gone (concurrent cleanup, or never existed).
          console.log(`${_tag} pendingjobs/${_cid}/${_bId} DELETE skipped — node already absent`);
        }
      } catch (e) {
        console.warn(`${_tag} pendingjobs PATCH/DELETE failed: ${e && e.message}`);
      }
    })());

    // 2. /jobs/{cid}/{vehId}/{drvId}/{bookingId} — write eventType then DELETE.
    //    §FIX-DA-G2 + C2: driver-app team needs the reason for the terminal
    //    transition. We PATCH eventType (= 'cancelled' or 'completed') first
    //    so Firebase's onChildRemoved snapshot carries it, then DELETE the
    //    child. No cross-listener coordination required. Other active
    //    bookings on this driver are untouched.
    if (_vId && _dId) {
      const _url    = `${FB_DB_URL}/jobs/${_cid}/${_vId}/${_dId}/${_bId}.json?auth=${auth}`;
      const _evType = (_final === 'Cancelled') ? 'cancelled' : 'completed';
      tasks.push(
        fbRequest(_url, 'PATCH', { eventType: _evType })
          .catch(e => console.warn(`${_tag} jobs child eventType PATCH failed: ${e && e.message}`))
          .then(() => fbRequest(_url, 'DELETE', null))
          .then(d => console.log(`${_tag} jobs/${_cid}/${_vId}/${_dId}/${_bId} → eventType=${_evType} then deleted [${d && d.status}]`))
          .catch(e => console.warn(`${_tag} jobs child DELETE failed: ${e && e.message}`))
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
            const _nType = String(n.type || n.eventType || n.content || '').toLowerCase();
            if (_final === 'Cancelled' && (_nType.includes('cancel') || _nType === 'job_cancelled')) {
              console.log(`${_tag} notification/${_dId} kept (cancel payload for #${_bId})`);
            } else {
              const d = await fbRequest(`${FB_DB_URL}/notification/${_dId}.json?auth=${auth}`, 'DELETE', null);
              console.log(`${_tag} notification/${_dId} deleted [${d.status}]`);
            }
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
          // §FIX-K — wait for the completion snapshot (if inflight) before
          // clearing the node, so we don't strip meterFare/distance/duration/
          // tariff before the snapshot read captures them.
          try {
            const _snap = _completionSnapshotInflight && _completionSnapshotInflight.get(_snapKey(_cid, _bId));
            if (_snap && typeof _snap.then === 'function') {
              await _snap;
            }
          } catch (_eSnap) { /* snapshot best-effort; never block cleanup */ }
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

// ─── §FIX-CB — Unified cancellation flow (per-booking, idempotent) ────────────
// Used by: dispatcher cancel, passenger cancel, website cancel, driver recall
// (post-accept), and any future caller. Front-door rules:
//   • Always per-booking — never blindly clears a driver's whole state.
//   • Idempotent — re-cancelling a cancelled job is a no-op.
//   • Driver state (queue / Available / Away / awayLock) is touched ONLY when
//     the driver has no remaining active assignments. Otherwise the driver
//     keeps their current state so Job A active is never disturbed by Job B
//     being cancelled.
//   • Firebase writes are booking-scoped (jobs/{cid}/{vid}/{drv} ETag-guarded,
//     online/{cid}/{vid}/current cleared only if currentJobId === bookingId).
// ──────────────────────────────────────────────────────────────────────────────

// Returns true if `driverId` has any other active-state job in jobStore besides
// the one being cancelled. Active = Offered/Assigned/Picking/OnTrip/Active.
function driverHasRemainingAssignments(driverId, excludeBookingId, companyId) {
  if (!driverId) return false;
  const _drvStr = String(driverId).trim();
  if (!_drvStr || _drvStr === '0' || _drvStr === '-1' || _drvStr === '-2') return false;
  const _excl = parseInt(excludeBookingId) || 0;
  const ACTIVE = new Set(['Offered', 'Assigned', 'Picking', 'OnTrip', 'Active', 'Queued']);
  return jobStore.some(j => {
    if (!j || j.Id === _excl) return false;
    if (companyId && j.companyId && String(j.companyId) !== String(companyId)) return false;
    if (String(j.DriverId).trim() !== _drvStr) return false;
    return ACTIVE.has(j.BookingStatus);
  });
}

// §FIX-Q-style booking-specific driver notify. Fires `notification/{drv}` Job
// Cancel payload + ETag-guarded `jobs/{cid}/{vid}/{drv}` → Cancelled.
async function _writeCancelNotify(cid, vehId, drvId, bookingId, cancelledBy, opts) {
  try {
    if (!cid || !drvId || !bookingId) return;
    const _tok = await getFirebaseServerToken();
    if (!_tok) { console.warn(`  [CancelNotify #${bookingId}] no firebase token — skipped`); return; }
    const _src = String(cancelledBy || 'dispatcher');
    const _srcPretty = _src.charAt(0).toUpperCase() + _src.slice(1);
    // §FIX-DA-G4/G5 — driver-app public contract on the cancel notification.
    const _pubType = (opts && opts.recalled) ? 'recalled' : 'cancelled';
    const _ver     = (opts && opts.version != null) ? opts.version : 0;
    await firebaseDbSet(`notification/${drvId}`, {
      bookingid: `${bookingId},Job Cancel,${drvId},Server,${_srcPretty}`,
      content: 'Job has been cancelled',
      type: 'job_cancelled',
      eventType: 'job_cancelled',
      version:   _ver,
      updatedAt: _FB_SERVER_TIMESTAMP,
      bookingId: bookingId
    }, _tok);
    console.log(`  [CancelNotify #${bookingId}] notification/${drvId} → Job Cancel (by ${_srcPretty})`);
    if (vehId) {
      // §FIX-DA-G2 + C2 — write eventType into the child first so the driver
      // app reads it off the onChildRemoved snapshot, then remove the node.
      // _pubType is 'cancelled' or 'recalled' depending on opts.recalled.
      const _delUrl = `${FB_DB_URL}/jobs/${cid}/${vehId}/${drvId}/${bookingId}.json?auth=${encodeURIComponent(_tok)}`;
      fbRequest(_delUrl, 'PATCH', { eventType: _pubType })
        .catch(e => console.warn(`  [CancelNotify #${bookingId}] jobs child eventType PATCH failed: ${e && e.message}`))
        .then(() => fbRequest(_delUrl, 'DELETE', null))
        .then(d => console.log(`  [CancelNotify #${bookingId}] jobs/${cid}/${vehId}/${drvId}/${bookingId} → eventType=${_pubType} then removed [${d && d.status}]`))
        .catch(e => console.warn(`  [CancelNotify #${bookingId}] jobs child remove failed: ${e && e.message}`));
    }
  } catch(e) { console.warn(`  [CancelNotify #${bookingId}] failed: ${e && e.message}`); }
}

// Statuses where a driver may be holding this booking in their app UI.
const _DRIVER_ATTACHED_STATUSES = new Set(['Offered', 'Assigned', 'Picking', 'OnTrip', 'Active', 'Busy', 'Queued']);

function _normJobDriverId(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s || s === '0' || s === '-1' || s === '-2') return '';
  return s;
}

// Match driver-app AuthContext.normalizeDriverId — notification/{id} must use the same key.
function _normalizeNotifyDriverId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^([dD])(\d+)$/i);
  if (m) return 'D' + String(parseInt(m[2], 10)).padStart(3, '0');
  return s;
}

// Parse DId from InsertBookingv4 / create-job form — preserves string IDs (e.g. "D002").
function _parseInsertDriverIdParam(raw) {
  const s = String(raw ?? '').trim();
  if (s === '-1') return { driverId: '-1', bookstatus: 'No One', hasDriver: false };
  if (!s || s === '0' || s === '-2') return { driverId: '0', bookstatus: 'Pending', hasDriver: false };
  const parsedNum = parseInt(s, 10);
  const driverId = (!Number.isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === s)
    ? String(parsedNum)
    : s;
  if (!_normJobDriverId(driverId)) {
    return { driverId: '0', bookstatus: 'Pending', hasDriver: false };
  }
  return { driverId, bookstatus: 'Offered', hasDriver: true };
}

// Withdraw a job from a driver — clear Firebase offer/active paths and notify job_removed.
// Used when dispatcher unassigns (Pending/No One) or reassigns to another driver.
async function _withdrawJobFromDriver(opts) {
  opts = opts || {};
  const cid = String(opts.cid || opts.companyId || '').trim();
  const bookingId = parseInt(opts.bookingId) || 0;
  const drvId = _attachedDriverIdFromJob({ DriverId: opts.driverId || opts.drvId });
  let vid = String(opts.vehicleId || opts.vid || '').trim();
  const source = opts.source || 'withdrawJobFromDriver';
  const version = opts.version != null ? opts.version : 0;
  const prevStatus = String(opts.prevStatus || '');
  if (!cid || !bookingId || !drvId) return;

  if (!vid || vid === '0' || vid === drvId) {
    const _resolved = _resolveDriverVehicleIds(drvId, vid);
    vid = _resolved.vehicleId || drvId;
  }

  try {
    const tok = await getFirebaseServerToken();
    if (!tok) {
      console.warn(`  [${source}] _withdrawJobFromDriver: no Firebase token — skipped notify`);
      return;
    }
    await firebaseDbSet(`notification/${drvId}`, {
      bookingid: `${bookingId},Job Removed,${drvId},Server,Dispatcher`,
      content:   'Job has been taken back by dispatcher',
      type:      'job_removed',
      eventType: 'job_removed',
      version,
      updatedAt: _FB_SERVER_TIMESTAMP,
      bookingId,
    }, tok);
    console.log(`  [${source}] _withdrawJobFromDriver notification/${drvId} → job_removed (#${bookingId})`);
  } catch (e) {
    console.warn(`  [${source}] _withdrawJobFromDriver notify failed: ${e && e.message}`);
  }

  clearOfferOnFirebase(cid, vid, drvId, bookingId, source, 'withdraw');

  const _restoreStates = new Set(['Assigned', 'Picking', 'OnTrip', 'Active', 'Busy']);
  if (_restoreStates.has(prevStatus)) {
    _maybeRestoreDriverState(drvId, vid, cid, bookingId, false, source);
  }
}

// Decide and apply driver state change after a booking is cancelled/recalled.
// Returns { driverFreed: bool, driverState: 'Available'|'Away'|'unchanged'|'unknown', queueNo: number|null }
function _maybeRestoreDriverState(driverId, vehId, companyId, excludeBookingId, driverFault, source) {
  const _src = source || 'cancelBooking';
  if (!driverId || String(driverId).trim() === '' || String(driverId) === '0') {
    return { driverFreed: false, driverState: 'unchanged', queueNo: null };
  }
  if (driverHasRemainingAssignments(driverId, excludeBookingId, companyId)) {
    console.log(`  [${_src}] §FIX-CB driver ${driverId} keeps state — has remaining active assignment(s)`);
    return { driverFreed: false, driverState: 'unchanged', queueNo: null };
  }
  const zd = ZONE_DRIVERS.find(d =>
    String(d.driverid).trim() === String(driverId).trim() ||
    String(d.VehicleId).trim() === String(driverId).trim());
  if (!zd) {
    console.log(`  [${_src}] §FIX-CB driver ${driverId} not in ZONE_DRIVERS — state-change skipped`);
    return { driverFreed: true, driverState: 'unknown', queueNo: null };
  }
  if (driverFault) {
    zd.vehiclestatus = 'Away';
    zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0;
    setAwayLock(driverId);
    console.log(`  [${_src}] §FIX-CB driver ${driverId} → Away + awayLock (driver-fault, no remaining assignments)`);
    return { driverFreed: true, driverState: 'Away', queueNo: null };
  }
  const _q = calcRestoredQueue(driverId, zd.zonename || '');
  zd.zonequeue      = _q;
  zd.queueWaitSince = Date.now();
  zd.vehiclestatus  = 'Available';
  zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0;
  clearAwayLock(driverId);
  clearDriverHomeState(driverId);
  if (companyId && vehId) {
    (async () => {
      try {
        const _tok = await getFirebaseServerToken();
        if (_tok) {
          await firebaseDbPatch(`online/${companyId}/${vehId}/current`,
            { vehiclestatus: 'Available', jobId: '', jobpickup: '', jobdropoff: '', JobphoneNo: '' }, _tok);
          console.log(`  [${_src}] §FIX-CB online/${companyId}/${vehId}/current → Available (mirrored)`);
        }
      } catch(e) { console.warn(`  [${_src}] online mirror failed: ${e && e.message}`); }
    })();
  }
  console.log(`  [${_src}] §FIX-CB driver ${driverId} → Available q=${_q} zone="${zd.zonename}" (no remaining assignments)`);
  return { driverFreed: true, driverState: 'Available', queueNo: _q };
}

// Block IngestPassengerJob from re-creating jobs mid-cancel or immediately after cancel.
const _CANCEL_IN_FLIGHT = new Set();
const _RECENTLY_CANCELLED = new Map();
const _RECENTLY_CANCELLED_TTL_MS = 10 * 60 * 1000;

function _markRecentlyCancelled(bookingId) {
  if (!bookingId) return;
  _RECENTLY_CANCELLED.set(String(bookingId), Date.now());
}

function _isBlockedFromReIngest(bookingId) {
  const key = String(bookingId || '');
  if (!key || key === '0') return false;
  if (_CANCEL_IN_FLIGHT.has(key)) return true;
  const t = _RECENTLY_CANCELLED.get(key);
  if (!t) return false;
  if (Date.now() - t > _RECENTLY_CANCELLED_TTL_MS) {
    _RECENTLY_CANCELLED.delete(key);
    return false;
  }
  return true;
}

// Unified cancel/recall front door. See big comment block above for rules.
async function cancelBooking(opts) {
  opts = opts || {};
  const bookingId       = parseInt(opts.bookingId) || 0;
  const cancelledBy     = String(opts.cancelledBy || 'dispatcher').toLowerCase();
  const reason          = String(opts.reason || '');
  const driverFault     = !!opts.driverFault;
  const recallToPending = !!opts.recallToPending;
  const companyId       = opts.companyId ? String(opts.companyId) : '';
  const source          = opts.source || 'cancelBooking';

  if (!bookingId) {
    console.warn(`  [${source}] §FIX-CB rejected — no bookingId`);
    return { ok: false, error_code: 'bad_request', error: 'bookingId required' };
  }

  // Idempotency — already in closedJobStore as Cancelled?
  const _closed = closedJobStore.find(j => j && j.Id === bookingId && j.BookingStatus === 'Cancelled');
  if (_closed) {
    console.log(`  [${source}] §FIX-CB idempotent: job #${bookingId} already Cancelled (by ${_closed.CancelledBy || '?'}) — no-op`);
    return { ok: true, idempotent: true, cancelStage: _closed.CancelStage || 'unknown',
             cancelledBy: _closed.CancelledBy || '', driverFreed: false, driverState: 'unchanged',
             version: parseInt(_closed.updateSeq) || 0, booking: _publicBooking(_closed) };
  }

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  // Recall idempotency — same booking already parked as Pending+'Recalled by Driver' (within window)?
  if (recallToPending && idx !== -1) {
    const _j = jobStore[idx];
    const _alreadyRecalled = (_j.BookingStatus === 'Pending') &&
                             (_j.returnReason === 'Recalled by Driver') &&
                             _j.releasedAt && (Date.now() - _j.releasedAt < 30000);
    if (_alreadyRecalled) {
      console.log(`  [${source}] §FIX-CB idempotent: job #${bookingId} already recalled (Pending+Recalled by Driver, ${Math.floor((Date.now()-_j.releasedAt)/1000)}s ago) — no-op`);
      return { ok: true, idempotent: true, cancelStage: _j.CancelStage || 'unknown',
               cancelledBy: _j.CancelledBy || '', driverFreed: false, driverState: 'unchanged',
               recalled: true,
               version: parseInt(_j.updateSeq) || 0, booking: _publicBooking(_j) };
    }
  }
  if (idx === -1) {
    console.warn(`  [${source}] §FIX-CB job #${bookingId} not found in jobStore`);
    return { ok: false, error_code: 'not_found', error: 'job not found' };
  }
  const job = jobStore[idx];
  // Optional ifVersion precondition (§FIX-CMD).
  const _cbVc = _checkIfVersion(job, opts.ifVersion);
  if (_cbVc) return _cbVc;
  const _cid    = companyId || String(job.companyId || '');
  const _drvId  = (job.DriverId === 0 || job.DriverId === '0' || job.DriverId === -1 || job.DriverId === -2)
                    ? '' : String(job.DriverId || '').trim();
  const _vehId  = String(job.VehicleNo || job.CallSign || job.VehicleId || '').trim();
  const _hasDriver = _drvId !== '';
  const _cancelStage = job.BookingStatus || 'unknown';
  const _cancelledByPretty = cancelledBy.charAt(0).toUpperCase() + cancelledBy.slice(1);
  const _nowIso = new Date().toISOString();
  const _cancelKey = String(bookingId);
  _CANCEL_IN_FLIGHT.add(_cancelKey);

  // Cancellation snapshot fields (for the payout pipeline downstream).
  job.CancelledBy        = _cancelledByPretty;
  job.CancelStage        = _cancelStage;
  job.CancelReason       = reason;
  job.CancelledAt        = _nowIso;
  job.PaymentMethod      = job.PaymentMethod || job.paymentMethod || '';
  job.AssignedDriverId   = _drvId;
  job.AssignedVehicleId  = _vehId;
  job.FareSnapshot       = job.EstimatedFare || job.RideCost || job.CustomeRate || '';
  job.DistanceSnapshot   = job.distance || job.Distance || '';

  // §FIX-UB interlock — bump updateSeq so any in-flight updateBooking() PATCH
  // with a stale ifSeq is rejected, and write a BookingCancelled / BookingRecalled
  // event so the driver app sees the lifecycle transition on the same per-booking
  // stream as edits.
  const _seqBefore = parseInt(job.updateSeq) || 0;
  job.updateSeq      = _seqBefore + 1;
  job.lastUpdatedAt  = new Date().toISOString();
  job.lastUpdatedBy  = cancelledBy;
  if (_cid && bookingId) {
    _writeBookingEvent(_cid, bookingId, 'StatusChanged',
      {
        from: recallToPending ? _cancelStage : _cancelStage,
        to: recallToPending ? 'Pending' : 'Cancelled',
        action: recallToPending ? 'recall' : 'cancel',
        CancelledBy: _cancelledByPretty,
        CancelReason: reason,
        CancelStage: _cancelStage
      },
      cancelledBy, job.updateSeq).catch(() => {});
  }

  if (recallToPending) {
    // Driver recalled an Assigned booking — restore pre-offer U-A pool status.
    const _restoredPool = _restorePoolStatusAfterOfferRelease(job);
    _applyPoolStatusFields(job, _restoredPool);
    job.returnReason = 'Recalled by Driver';
    delete job.JobCompleteTime;
    saveJobStore();
    console.log(`  [${source}] §FIX-CB job #${bookingId} (was ${_cancelStage}) → ${_restoredPool}+releasedAt (recall by ${_cancelledByPretty}, prevDriver=${_drvId || 'none'})`);
  } else {
    // Hard cancel — close the job.
    const _isNoShow = /no\s*show/i.test(reason);
    job.BookingStatus   = _isNoShow ? 'No Show' : 'Cancelled';
    job.JobCompleteTime = _nowIso;
    closedJobStore.push(job);
    jobStore.splice(idx, 1);
    saveJobStore();
    saveClosedJobStore();
    console.log(`  [${source}] §FIX-CB job #${bookingId} (was ${_cancelStage}) → ${job.BookingStatus} by ${_cancelledByPretty} (driver=${_drvId || 'none'}, payment=${job.PaymentMethod || '-'})`);
  }

  // §FIX-CMD/ver-fanout — mirror version into Firebase paths the driver app
  // reads. For recall, the booking stays alive (Pending) — patch both paths.
  // For hard cancel, _bwClearJobFromFirebase below will DELETE pendingjobs/
  // — skip pendingjobs patch (isTerminal=true), keep allbookings/ patch.
  _fanVersionToFirebase(_cid, bookingId, {
    updateSeq:     job.updateSeq,
    lastUpdatedAt: job.lastUpdatedAt,
    lastUpdatedBy: job.lastUpdatedBy,
    BookingStatus: job.BookingStatus
  }, !recallToPending);

  let driverFreed = false, driverState = 'unchanged', queueNo = null;
  try {
    const _resolvedCancel = _hasDriver ? _resolveDriverVehicleIds(_drvId, _vehId) : { driverId: '', vehicleId: '' };
    const _rDrv = _resolvedCancel.driverId;
    const _rVid = _resolvedCancel.vehicleId;
    try {
      if (_hasDriver && _cancelStage === 'Queued') {
        await _removeDriverQueueFirebase(_cid, _rDrv, bookingId);
      }
      if (_hasDriver && cancelledBy !== 'driver') {
        await _writeCancelNotify(_cid, _rVid, _rDrv, bookingId, _cancelledByPretty,
          { recalled: !!recallToPending, version: job.updateSeq });
      }
      if (!recallToPending) {
        _markRecentlyCancelled(bookingId);
        await _bwClearJobFromFirebase(_cid, bookingId, _rVid, _rDrv, 'Cancelled');
        await _signalDispatchConsoleRefresh(_cid, {
          bookingId, action: 'cancel', status: job.BookingStatus, driverId: _rDrv || _drvId,
        });
      } else if (_cid) {
        await _signalDispatchConsoleRefresh(_cid, {
          bookingId, action: 'recall', status: job.BookingStatus, driverId: _rDrv || _drvId,
        });
      }
    } catch (e) {
      console.warn(`  [${source}] cancel firebase fanout failed: ${e && e.message}`);
    }
    if (_hasDriver) {
      const _ds = _maybeRestoreDriverState(_rDrv, _rVid, _cid, bookingId, driverFault, source);
      driverFreed = _ds.driverFreed;
      driverState = _ds.driverState;
      queueNo     = _ds.queueNo;
    }

    return {
      ok: true, idempotent: false,
      cancelStage: _cancelStage,
      cancelledBy: _cancelledByPretty,
      driverId: _drvId,
      vehicleId: _vehId,
      driverFreed, driverState, queueNo,
      recalled: recallToPending,
      version: job.updateSeq,
      booking: _publicBooking(job)
    };
  } finally {
    _CANCEL_IN_FLIGHT.delete(_cancelKey);
  }
}

// ─── §FIX-CMD — State machine + assign/complete helpers + /api/job/command ───
// Backend tasks 1.1 (unified command endpoint), 1.2 (state machine validator),
// 1.7 (idempotency for assign+complete). Backward-safe — every existing
// endpoint and handler keeps working; the new endpoint is an additional front
// door that wraps the existing helpers (cancelBooking, updateBooking) and
// adds new minimal helpers (assignBooking, completeBooking) for the two
// remaining lifecycle verbs.
// ──────────────────────────────────────────────────────────────────────────────

// §FIX-CMD/1.2 — Booking state machine. Maps current status → allowed commands.
// `update` is allowed in every active state; terminal states only allow no-op
// idempotent re-runs of the command that produced them.
const _BOOKING_STATE_MACHINE = {
  'Pending':   { assign: 'Offered', cancel: 'Cancelled', update: 'Pending' },
  'Offered':   { assign: 'Offered', accept: 'Assigned', cancel: 'Cancelled', update: 'Offered', recall: 'Pending' },
  'Assigned':  { assign: 'Offered', accept: 'Assigned', cancel: 'Cancelled', recall: 'Pending', update: 'Assigned', complete: 'Completed' },
  'Picking':   { cancel: 'Cancelled', update: 'Picking', complete: 'Completed' },
  'Arrived':   { cancel: 'Cancelled', update: 'Arrived', complete: 'Completed' },
  'OnTrip':    { cancel: 'Cancelled', update: 'OnTrip', complete: 'Completed' },
  'Active':    { cancel: 'Cancelled', update: 'Active',  complete: 'Completed' },
  'Busy':      { cancel: 'Cancelled', update: 'Busy',    complete: 'Completed' },
  'Queued':    { cancel: 'Cancelled', update: 'Queued' },
  'Completed': { complete: 'Completed' },   // idempotent
  'Cancelled': { cancel: 'Cancelled' },     // idempotent
  'No One':    { assign: 'Offered', update: 'No One', cancel: 'Cancelled' },
  'Scheduled': { assign: 'Offered', cancel: 'Cancelled', update: 'Scheduled' },
  'Unreached': { assign: 'Offered', cancel: 'Cancelled', update: 'Unreached' },
  'Reject':    { assign: 'Offered', cancel: 'Cancelled', update: 'Reject' },
};

// §FIX-CMD/1.7 — clientRequestId idempotency cache. Drivers tap on flaky 4G;
// the same tap may POST twice. Cache the response keyed by clientRequestId
// (or Idempotency-Key header) for 10 minutes so the retry returns the same
// payload instead of re-running the command.
const _CMD_DEDUP = new Map(); // key → { at: ms, status: number, response: obj }
const _CMD_DEDUP_TTL_MS = 10 * 60 * 1000;
function _cmdDedupGet(key) {
  if (!key) return null;
  const _hit = _CMD_DEDUP.get(key);
  if (!_hit) return null;
  if (Date.now() - _hit.at > _CMD_DEDUP_TTL_MS) {
    _CMD_DEDUP.delete(key);
    return null;
  }
  return _hit;
}
function _cmdDedupSet(key, status, response) {
  if (!key) return;
  _CMD_DEDUP.set(key, { at: Date.now(), status, response });
  // Opportunistic cleanup if the cache grows past a soft ceiling.
  if (_CMD_DEDUP.size > 5000) {
    const _cutoff = Date.now() - _CMD_DEDUP_TTL_MS;
    for (const [k, v] of _CMD_DEDUP) {
      if (v.at < _cutoff) _CMD_DEDUP.delete(k);
    }
  }
}

// Build the public booking echo for command responses. Strips internal fields
// that the driver app should not depend on (auto-dispatch flags, etc.).
function _publicBooking(job) {
  if (!job) return null;
  return {
    bookingId:       job.Id,
    status:          job.BookingStatus || '',
    version:         parseInt(job.updateSeq) || 0,
    updatedAt:       job.lastUpdatedAt || null,
    driverId:        String(job.DriverId || '').trim(),
    vehicleId:       String(job.VehicleNo || job.CallSign || job.VehicleId || '').trim(),
    passengerName:   job.UserFName || job.Name || '',
    passengerPhone:  job.PhoneNo || job.UserPhone || '',
    pickupAddress:   job.PickAddress || job.PickupAddress || job.jobpickup || '',
    dropAddress:     job.DropAddress || job.DropLocation || job.jobdropoff || '',
    fare:            job.TotalFare || job.EstimatedFare || job.FareSnapshot || null,
    distance:        job.distance || job.DistanceSnapshot || null,
    paymentMethod:   job.PaymentMethod || job.paymentMethod || '',
    notes:           job.Notes || job.notes || '',
    bookingSource:   job.BookingSource || job.bookingSource || ''
  };
}

// Check optional ifVersion precondition. Returns null if OK, or a stale-response
// object if the booking's updateSeq doesn't match the caller's expectation.
function _checkIfVersion(job, ifVersion) {
  if (ifVersion === undefined || ifVersion === null) return null;
  const _cur = parseInt(job.updateSeq) || 0;
  const _exp = parseInt(ifVersion);
  if (_cur !== _exp) {
    return {
      ok: false, stale: true, error_code: 'version_conflict',
      error: `version mismatch (sent ${_exp}, current ${_cur})`,
      currentVersion: _cur,
      booking: _publicBooking(job)
    };
  }
  return null;
}

// Returns { ok:true, nextStatus } or { ok:false, error }
function _canTransition(currentStatus, command) {
  const _s = String(currentStatus || 'Pending');
  const _c = String(command || '').toLowerCase();
  const row = _BOOKING_STATE_MACHINE[_s];
  if (!row) return { ok: false, error: `unknown booking status "${_s}"` };
  if (!(_c in row)) return { ok: false, error: `command "${_c}" not allowed from status "${_s}"` };
  return { ok: true, nextStatus: row[_c] };
}

// Resolve vehicleId from ZONE_DRIVERS when the client sends driverId as both ids
// (common on string-ID tenants — e.g. jobs/{cid}/D002/D002 instead of TAXI02/D002).
function _resolveDriverVehicleIds(driverId, vehicleId) {
  const did = String(driverId || '').trim();
  let vid = String(vehicleId == null ? '' : vehicleId).trim();
  if (!did) return { driverId: '', vehicleId: '' };
  const _needsResolve = !vid || vid === '0' || vid === '-1' || vid === did ||
                        vid === 'null' || vid === 'undefined';
  if (_needsResolve) {
    const zd = ZONE_DRIVERS.find(d => d && String(d.driverid || '').trim() === did);
    if (zd) {
      vid = String(zd.VehicleId || zd.vehiclenumber || zd.CallSign || '').trim();
    }
  }
  return { driverId: did, vehicleId: vid || did };
}

function _attachedDriverIdFromJob(job, withdrawHint) {
  const hint = _normJobDriverId(withdrawHint);
  const drv = _normJobDriverId(job && job.DriverId)
           || _normJobDriverId(job && job.AssignedDriverId)
           || _normJobDriverId(job && job.AssignedDriver)
           || hint;
  if (!drv) return '';
  return _normalizeNotifyDriverId(drv) || drv;
}

function _driverFirebaseIdsFromJob(job) {
  const drv = _attachedDriverIdFromJob(job);
  if (!drv) return { driverId: '', vehicleId: '' };
  const rawVid = String((job && (job.VehicleNo || job.CallSign || job.VehicleId || job.AssignedVehicleId)) || '').trim();
  const resolved = _resolveDriverVehicleIds(drv, rawVid);
  return {
    driverId: _normalizeNotifyDriverId(resolved.driverId) || resolved.driverId,
    vehicleId: resolved.vehicleId,
  };
}

// Mirror canonical + alias fields so all job sources/types (taxi, food, freight, web, app)
// update the same Firebase paths the driver app reads.
function _mirrorFbJobFields(changed) {
  const out = Object.assign({}, changed);
  if (out.Name != null) {
    out.PassengerName = out.Name;
    out.passengername = out.Name;
  }
  if (out.PickAddress != null) out.pickAddress = out.PickAddress;
  if (out.DropAddress != null) out.dropAddress = out.DropAddress;
  if (out.PhoneNo != null) out.passengerPhone = out.PhoneNo;
  if (out.Pickingtime != null && out.BookingDateTime == null) out.BookingDateTime = out.Pickingtime;
  if (out.BookingDateTime != null && out.Pickingtime == null) out.Pickingtime = out.BookingDateTime;
  if (out.PaymentMethod != null && out.PaymentType == null) out.PaymentType = out.PaymentMethod;
  if (out.serviceType != null && out.ServiceType == null) out.ServiceType = out.serviceType;
  if (out.ServiceType != null && out.serviceType == null) out.serviceType = out.ServiceType;
  return out;
}

function _parseLatLngPair(raw) {
  const p = String(raw || '').split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function _offerPaymentTypeFromJob(job) {
  const pm = String(job.PaymentMethod || job.paymentMethod || job.PaymentType || job.paymentType || '').toLowerCase();
  if (pm.includes('card') || pm.includes('stripe')) return 'card';
  if (pm.includes('account')) return 'account';
  if (pm.includes('eftpos')) return 'eftpos';
  if (pm.includes('tm')) return 'tm';
  if (pm.includes('acc')) return 'acc';
  if (pm.includes('cash')) return 'cash';
  return pm || 'cash';
}

// Full manual-offer fanout — mirrors legacy writeJobDetailsToFirebase + pendingjobs patch.
// Works for any job source (dispatch, website, app) and service type (taxi, food, freight, …).
async function _writeManualDriverOffer(job, driverId, vehicleId, by, sourceTag) {
  if (!job || !job.Id || !driverId) return;
  const cid = String(job.companyId || '').trim();
  if (!cid) return;
  const _resolved = _resolveDriverVehicleIds(driverId, vehicleId);
  const did = _normalizeNotifyDriverId(_resolved.driverId) || _resolved.driverId;
  const vid = _resolved.vehicleId;
  if (!did) return;

  const tok = await getFirebaseServerToken();
  if (!tok) {
    console.warn(`  [${sourceTag}] _writeManualDriverOffer: no Firebase token — skipped`);
    return;
  }

  const bookingId = job.Id;
  const _src = String(job.BookingSource || job.bookingSource || job.source || 'Dispatch Console');
  const _svc = String(job.serviceType || job.ServiceType || 'taxi');
  const _stat = 'Offered';
  const _bookingidStr = `${bookingId},${_stat},${did},,${by || 'dispatcher'}`;
  const _payType = _offerPaymentTypeFromJob(job);
  const _pickLL = _parseLatLngPair(job.PickLatLng);
  const _dropLL = _parseLatLngPair(job.DropLatLng);
  const _now = Date.now();

  const notifPayload = {
    type:           'job_offer',
    eventType:      'new_offer',
    bookingid:      _bookingidStr,
    content:        'You have offered new Job please view details',
    joboffer:       String(bookingId),
    bookingId:      bookingId,
    jobpickup:      String(job.PickAddress || job.PickLocation || job.jobpickup || ''),
    jobdropoff:     String(job.DropAddress || job.DropLocation || job.jobdropoff || ''),
    JobphoneNo:     String(job.PhoneNo || job.PassengerPhone || ''),
    jobname:        String(job.Name || job.PassengerName || job.UserFName || ''),
    jobbags:        String(job.Bags ?? job.BagsNo ?? 0),
    jobpassengers:  String(job.Passengers ?? job.PassengersNo ?? 1),
    jobvehicletype: String(job.VehicleType || ''),
    jobinfo:        String(job.EntitiesDetails || job.Notes || job.notes || ''),
    jobFare:        String(job.EstimatedFare || job.RideCost || job.CustomeRate || job.Fare || ''),
    jobCount:       1,
    jobServiceType: _svc,
    jobBookingSrc:  _src,
    vehicleId:      vid,
    companyId:      cid,
    PaymentType:    _payType,
    paymentType:    _payType,
    PaymentMethod:  String(job.PaymentMethod || job.paymentMethod || ''),
    paymentMethod:  String(job.PaymentMethod || job.paymentMethod || ''),
    paymentStatus:  String(job.paymentStatus || job.PaymentStatus || ''),
    isPrePaid:      !!(job.isPrePaid || job.isPrepaid || job.IsPrePaid || job.prepaid),
    jobAccountId:   String(job.Account_id || job.AccountId || ''),
    jobAccountName: String(job.Account_Name || job.AccountName || ''),
    pickupTime:     String(job.BookingDateTime || job.Pickingtime || ''),
    Pickingtime:    String(job.BookingDateTime || job.Pickingtime || ''),
    scheduledFor:   String(job.BookingDateTime || job.Pickingtime || ''),
    tarriffType:    String(job.TarriffType || job.TarriffName || ''),
    TarriffType:    String(job.TarriffType || job.TarriffName || ''),
    customRate:     String(job.CustomeRate || ''),
    CustomeRate:    String(job.CustomeRate || ''),
    originalStatus: 'manual',
    expiresAt:      _now + 30000,
    version:        parseInt(job.updateSeq) || 0,
    updatedAt:      _FB_SERVER_TIMESTAMP,
    _ts:            _now,
  };

  await firebaseDbSet(`notification/${did}`, notifPayload, tok)
    .catch(e => console.warn(`  [${sourceTag}] notification/${did} write failed: ${e && e.message}`));

  if (vid) {
    await firebaseDbSet(`jobs/${cid}/${vid}/${did}/${bookingId}`, {
      BookingId:  String(bookingId),
      Status:       _stat,
      BookingStatus: _stat,
      VehicleId:    vid,
      DriverId:     did,
      offeredAt:    _now,
      eventType:    'new_offer',
      serviceType:  _svc,
      BookingSource: _src,
    }, tok).catch(e => console.warn(`  [${sourceTag}] jobs/${cid}/${vid}/${did}/${bookingId} write failed: ${e && e.message}`));

    await firebaseDbPatch(`online/${cid}/${vid}/current`, {
      joboffer:     String(bookingId),
      jobpickup:    notifPayload.jobpickup,
      jobdropoff:   notifPayload.jobdropoff,
      JobphoneNo:   notifPayload.JobphoneNo,
      jobname:      notifPayload.jobname,
      currentJobId: String(bookingId),
      jobId:        String(bookingId),
    }, tok).catch(e => console.warn(`  [${sourceTag}] online/${cid}/${vid}/current write failed: ${e && e.message}`));
  }

  const _pjPatch = {
    BookingId:       String(bookingId),
    Status:          _stat,
    BookingStatus:   _stat,
    DriverId:        did,
    AssignedDriver:  did,
    VehicleId:       vid,
    offeredAt:       _now,
    PickAddress:     notifPayload.jobpickup,
    DropAddress:     notifPayload.jobdropoff,
    PassengerName:   notifPayload.jobname,
    PhoneNo:         notifPayload.JobphoneNo,
    Fare:            notifPayload.jobFare,
    CompanyId:       cid,
    ServiceType:     _svc,
    serviceType:     _svc,
    BookingSource:   _src,
    paymentMethod:   notifPayload.paymentMethod,
    paymentStatus:   notifPayload.paymentStatus,
    PaymentType:     _payType,
    Pickingtime:     notifPayload.Pickingtime,
    TarriffType:     notifPayload.TarriffType,
    CustomeRate:     notifPayload.CustomeRate,
    Account_Name:    notifPayload.jobAccountName,
    manualOffer:     true,
    originalStatus:  'manual',
    version:         parseInt(job.updateSeq) || 0,
    updatedAt:       _FB_SERVER_TIMESTAMP,
    eventType:       'new_offer',
  };
  if (_pickLL) _pjPatch.pickupLocation = { address: notifPayload.jobpickup, lat: _pickLL.lat, lng: _pickLL.lng };
  if (_dropLL) _pjPatch.dropoffLocation = { address: notifPayload.jobdropoff, lat: _dropLL.lat, lng: _dropLL.lng };

  await firebaseDbPatch(`pendingjobs/${cid}/${bookingId}`, _pjPatch, tok)
    .catch(e => console.warn(`  [${sourceTag}] pendingjobs patch failed: ${e && e.message}`));
  await firebaseDbPatch(`allbookings/${cid}/${bookingId}`, _pjPatch, tok)
    .catch(e => console.warn(`  [${sourceTag}] allbookings patch failed: ${e && e.message}`));

  console.log(`  [${sourceTag}] _writeManualDriverOffer job #${bookingId} → driver ${did} veh ${vid} (${_svc}/${_src})`);
}

// §FIX-CMD/1.7 — Idempotent assign. Dispatcher manual assign → Offered + full
// driver-app fanout. Driver must accept via /api/job/accept.
async function assignBooking(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const driverId  = String(opts.driverId  || '').trim();
  const vehicleId = String(opts.vehicleId || '').trim();
  const by        = String(opts.by || 'dispatcher').toLowerCase();
  const source    = opts.source || 'assignBooking';
  if (!bookingId || !driverId) return { ok: false, error: 'bookingId and driverId required' };

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) {
    const _cl = closedJobStore.find(j => j && j.Id === bookingId);
    if (_cl) return { ok: false, closed: true, error_code: 'already_terminal', error: `job is ${_cl.BookingStatus}`, booking: _publicBooking(_cl) };
    return { ok: false, error_code: 'not_found', error: 'job not found' };
  }
  const job = jobStore[idx];
  const _curStatus = job.BookingStatus || 'Pending';
  const _curDrv    = String(job.DriverId || '').trim();
  const _curVid    = String(job.VehicleNo || job.CallSign || job.VehicleId || '').trim();
  const _resolved  = _resolveDriverVehicleIds(driverId, vehicleId);
  const _targetDrv = _resolved.driverId;
  const _targetVid = _resolved.vehicleId;

  const _vc = _checkIfVersion(job, opts.ifVersion);
  if (_vc) return _vc;

  // Idempotency — already offered/assigned to the same driver.
  if ((_curStatus === 'Offered' || _curStatus === 'Assigned') && _curDrv === _targetDrv) {
    if (opts.fanout === true) {
      try {
        await _writeManualDriverOffer(job, _targetDrv, _curVid || _targetVid, by, source);
      } catch (e) {
        console.warn(`  [${source}] _writeManualDriverOffer (idempotent refanout) failed: ${e && e.message}`);
      }
    }
    console.log(`  [${source}] §FIX-CMD idempotent: job #${bookingId} already ${_curStatus} to driver ${_targetDrv}`);
    return {
      ok: true, idempotent: true, status: _curStatus, driverId: _targetDrv,
      vehicleId: _curVid || _targetVid, version: parseInt(job.updateSeq) || 0,
      booking: _publicBooking(job)
    };
  }

  const _trans = _canTransition(_curStatus, 'assign');
  if (!_trans.ok) {
    console.warn(`  [${source}] §FIX-CMD assign rejected: ${_trans.error} (job #${bookingId})`);
    return { ok: false, error_code: 'invalid_transition', error: _trans.error, currentStatus: _curStatus, booking: _publicBooking(job) };
  }

  const _isManualAssign = (by === 'dispatcher' && opts.manualOffer !== false) || opts.manualOffer === true;
  if (_isManualAssign && _isBeforeDispatchWindow(job)) {
    const _msg = _preDispatchAssignBlockMessage(job);
    console.warn(`  [${source}] assign blocked — dispatch window not open (job #${bookingId})`);
    return { ok: false, error_code: 'dispatch_window_closed', error: _msg, booking: _publicBooking(job) };
  }

  const _nextStatus = _trans.nextStatus || 'Offered';
  const _cid = String(job.companyId || '');

  if (_nextStatus === 'Offered') {
    _stampPreOfferPoolStatus(job, _curStatus);
    _logJobPoolState(job, 'before-offer');
  }

  // Reassign — notify previous driver and clear their offer/active UI before new fanout.
  if (_curDrv && _curDrv !== _targetDrv && _cid && _DRIVER_ATTACHED_STATUSES.has(_curStatus)) {
    try {
      await _withdrawJobFromDriver({
        cid: _cid, bookingId, driverId: _curDrv,
        vehicleId: _curVid || _curDrv, prevStatus: _curStatus,
        version: parseInt(job.updateSeq) || 0, source: `${source}-reassign`,
      });
    } catch (e) {
      console.warn(`  [${source}] _withdrawJobFromDriver (reassign) failed: ${e && e.message}`);
    }
  }

  const _seqBefore = parseInt(job.updateSeq) || 0;
  job.BookingStatus = _nextStatus;
  job.DriverId      = _normalizeNotifyDriverId(_targetDrv) || _targetDrv;
  job.VehicleId     = _targetVid;
  job.VehicleNo     = _targetVid;
  job.CallSign      = _targetVid;
  job.updateSeq      = _seqBefore + 1;
  job.lastUpdatedAt  = new Date().toISOString();
  job.lastUpdatedBy  = by;
  job.offeredAt      = Date.now();
  job.AssignedDriverId  = job.DriverId;
  job.AssignedVehicleId = _targetVid;
  if (_nextStatus === 'Offered') {
    delete job.DriverAcceptedAt;
    delete job.AssignedAt;
  } else {
    job.AssignedAt = job.lastUpdatedAt;
  }

  const _isManualOffer = (by === 'dispatcher' && opts.manualOffer !== false) || opts.manualOffer === true;
  if (_isManualOffer) {
    job.manualOffer = true;
    job.originalStatus = 'manual';
  } else if (by === 'driver' || opts.fromPending) {
    job.manualOffer = false;
    job.originalStatus = job.originalStatus || 'pending';
  }

  saveJobStore();

  if (_cid) {
    _writeBookingEvent(_cid, bookingId, 'StatusChanged',
      { from: _curStatus, to: _nextStatus, driverId: _targetDrv, vehicleId: _targetVid, action: 'assign' },
      by, job.updateSeq).catch(() => {});
  }

  _fanVersionToFirebase(_cid, bookingId, {
    updateSeq:     job.updateSeq,
    lastUpdatedAt: job.lastUpdatedAt,
    lastUpdatedBy: job.lastUpdatedBy,
    BookingStatus: job.BookingStatus,
    Status:        job.BookingStatus,
    DriverId:      job.DriverId,
    VehicleId:     job.VehicleId,
    VehicleNo:     job.VehicleNo || '',
    offeredAt:     job.offeredAt,
    manualOffer:   !!job.manualOffer,
  }, false);

  const _shouldFanout = _isManualOffer || opts.fanout === true;
  if (_cid && _targetDrv && _shouldFanout) {
    try {
      await _writeManualDriverOffer(job, _targetDrv, _targetVid, by, source);
    } catch (e) {
      console.warn(`  [${source}] _writeManualDriverOffer failed: ${e && e.message}`);
    }
  }

  console.log(`  [${source}] §FIX-CMD assign job #${bookingId} (${_curStatus}→${_nextStatus}) → driver ${_targetDrv} veh ${_targetVid} seq=${job.updateSeq}`);
  if (_cid) {
    await _dispatchRefreshForJob(job, {
      cid: _cid,
      previousStatus: _curStatus,
      status: _nextStatus,
      action: _nextStatus === 'Offered' ? 'offer' : 'assign',
      driverId: _targetDrv,
    });
  }
  return {
    ok: true, idempotent: false, status: _nextStatus,
    driverId: _targetDrv, vehicleId: _targetVid, version: job.updateSeq,
    booking: _publicBooking(job)
  };
}

// §FIX-CMD/1.7 — Idempotent complete. Moves job to closedJobStore, restores
// driver state via _maybeRestoreDriverState (respects remaining-assignments
// rule), emits BookingCompleted event + 'completed' eventType to driver.
async function completeBooking(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const by        = String(opts.by || 'driver').toLowerCase();
  const source    = opts.source || 'completeBooking';
  const fare      = opts.fare;
  const distance  = opts.distance;
  if (!bookingId) return { ok: false, error_code: 'bad_request', error: 'bookingId required' };

  // Idempotency — already in closedJobStore as Completed?
  const _closed = closedJobStore.find(j => j && j.Id === bookingId && j.BookingStatus === 'Completed');
  if (_closed) {
    console.log(`  [${source}] §FIX-CMD idempotent: job #${bookingId} already Completed`);
    return { ok: true, idempotent: true, status: 'Completed',
             driverId: _closed.AssignedDriverId || String(_closed.DriverId || ''),
             vehicleId: _closed.AssignedVehicleId || '',
             version: parseInt(_closed.updateSeq) || 0,
             booking: _publicBooking(_closed) };
  }
  let idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) {
    const _hydrated = await _hydrateSingleJobFromFirebase(opts.companyId, bookingId);
    if (_hydrated) idx = jobStore.findIndex(j => j && j.Id === bookingId);
  }
  if (idx === -1) return { ok: false, error_code: 'not_found', error: 'job not found' };
  const job = jobStore[idx];
  const _curStatus = job.BookingStatus || '';
  // Optional ifVersion precondition.
  const _vc = _checkIfVersion(job, opts.ifVersion);
  if (_vc) return _vc;
  const _trans = _canTransition(_curStatus, 'complete');
  if (!_trans.ok) {
    console.warn(`  [${source}] §FIX-CMD complete rejected: ${_trans.error} (job #${bookingId})`);
    return { ok: false, error_code: 'invalid_transition', error: _trans.error, currentStatus: _curStatus, booking: _publicBooking(job) };
  }
  const _cid    = String(job.companyId || '');
  const _drvId  = String(job.DriverId || '').trim();
  const _vehId  = String(job.VehicleNo || job.CallSign || job.VehicleId || '').trim();
  const _nowIso = new Date().toISOString();

  const _seqBefore   = parseInt(job.updateSeq) || 0;
  job.updateSeq      = _seqBefore + 1;
  job.lastUpdatedAt  = _nowIso;
  job.lastUpdatedBy  = by;
  job.BookingStatus  = 'Completed';
  job.JobCompleteTime = _nowIso;
  if (fare !== undefined && fare !== null && fare !== '') {
    job.TotalFare    = fare;
    job.FareSnapshot = fare;
  }
  if (distance !== undefined && distance !== null && distance !== '') {
    job.distance         = distance;
    job.DistanceSnapshot = distance;
  }
  job.AssignedDriverId  = _drvId;
  job.AssignedVehicleId = _vehId;
  // §FIX-CMD/1.7 — full complete payload pass-through. Driver app sends
  // ~30 fare/tariff/extras fields on trip completion. Whitelisted to prevent
  // arbitrary writes; unknown fields are ignored (logged once).
  const _completeFields = [
    'tariffId', 'tariffName', 'tariffChangedAt',
    'waitingCost', 'waitingTimeMinutes',
    'extras', 'extrasTotal',                       // service-type chips
    'voucherCode', 'voucherDiscount', 'tmVoucher', // TM voucher payload
    'accClientId', 'accApprovalNo', 'accClaimNo',  // ACC workflow fields
    'paymentMethod', 'paymentSplit',               // split-payment rows
    'stripeChargeId', 'stripePaymentIntentId',
    'startTime', 'endTime', 'duration',
    'pickupLat', 'pickupLng', 'dropLat', 'dropLng',
    'finalDropAddress',                            // when driver deviates from booking
    'driverComments', 'meterReading',
    'fixedPrice', 'fixedPriceReason',
    'gst', 'tipAmount', 'tollFee', 'parkingFee'
  ];
  if (opts.payload && typeof opts.payload === 'object') {
    for (const _k of _completeFields) {
      if (opts.payload[_k] !== undefined && opts.payload[_k] !== null) {
        job[_k] = opts.payload[_k];
      }
    }
  }

  closedJobStore.push(job);
  jobStore.splice(idx, 1);
  saveJobStore();
  saveClosedJobStore();

  if (_cid) {
    _writeBookingEvent(_cid, bookingId, 'StatusChanged',
      { from: _curStatus, to: 'Completed', fare: job.TotalFare || '', distance: job.distance || '', action: 'complete' },
      by, job.updateSeq).catch(() => {});
  }
  // §FIX-CMD/ver-fanout — mirror version into allbookings/ before
  // _bwClearJobFromFirebase DELETEs pendingjobs/. isTerminal=true so we don't
  // resurrect the pendingjobs/ entry that's about to be removed.
  _fanVersionToFirebase(_cid, bookingId, {
    updateSeq:     job.updateSeq,
    lastUpdatedAt: job.lastUpdatedAt,
    lastUpdatedBy: job.lastUpdatedBy,
    BookingStatus: 'Completed',
    fare:          job.TotalFare || '',
    distance:      job.distance  || ''
  }, true);
  // Firebase cleanup — booking-scoped child remove with eventType:'completed'
  // (per §FIX-DA-G2/C2). _bwClearJobFromFirebase already handles this.
  if (_cid && _drvId) {
    _bwClearJobFromFirebase(_cid, bookingId, _vehId, _drvId, 'Completed');
  }
  // Driver state restore — respects remainingAssignments rule.
  const _ds = _maybeRestoreDriverState(_drvId, _vehId, _cid, bookingId, false, source);
  if (_cid) {
    await _dispatchRefreshForJob(job, {
      cid: _cid,
      previousStatus: _curStatus,
      status: 'Completed',
      action: 'complete',
      driverId: _drvId,
    });
  }
  console.log(`  [${source}] §FIX-CMD complete job #${bookingId} (${_curStatus}→Completed) driver=${_drvId} fare=${job.TotalFare || '-'} seq=${job.updateSeq}`);
  return {
    ok: true, idempotent: false, status: 'Completed',
    driverId: _drvId, vehicleId: _vehId,
    fare: job.TotalFare || null, distance: job.distance || null,
    driverFreed: _ds.driverFreed, driverState: _ds.driverState, queueNo: _ds.queueNo,
    version: job.updateSeq,
    booking: _publicBooking(job)
  };
}

// §FIX-CMD/1.7 — Driver-acceptance ack. When a driver taps Accept on an
// offered booking, this verb stamps DriverAcceptedAt + bumps updateSeq +
// emits an OfferAccepted bookingEvent. The booking must be 'Offered'
// (dispatcher manual assign) before accept transitions it to 'Assigned'.
function acceptBooking(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const driverId  = String(opts.driverId || '').trim();
  const by        = String(opts.by || 'driver').toLowerCase();
  const source    = opts.source || 'acceptBooking';
  if (!bookingId) return { ok: false, error_code: 'bad_request', error: 'bookingId required' };

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) {
    const _cl = closedJobStore.find(j => j && j.Id === bookingId);
    if (_cl) return { ok: false, closed: true, error_code: 'already_terminal', error: `job is ${_cl.BookingStatus}`, booking: _publicBooking(_cl) };
    return { ok: false, error_code: 'not_found', error: 'job not found' };
  }
  const job = jobStore[idx];
  const _cid = String(job.companyId || opts.companyId || '');
  const _curStatus = job.BookingStatus || '';
  const _jobDrv    = String(job.DriverId || '').trim();

  // Driver-attribution check — the accept must come from the driver the
  // booking was offered to. (When called via /api/job/command from the
  // driver app, driverId is derived from the X-User-Key auth context, so
  // this is a server-side identity check, not a client claim.)
  if (driverId && _jobDrv && driverId !== _jobDrv) {
    return { ok: false, error_code: 'forbidden', error: `booking offered to driver ${_jobDrv}, not ${driverId}`, booking: _publicBooking(job) };
  }
  const _vc = _checkIfVersion(job, opts.ifVersion);
  if (_vc) return _vc;
  const _trans = _canTransition(_curStatus, 'accept');
  if (!_trans.ok) {
    return { ok: false, error_code: 'invalid_transition', error: _trans.error, currentStatus: _curStatus, booking: _publicBooking(job) };
  }
  // Idempotency — already accepted (DriverAcceptedAt stamped and status Assigned).
  if (job.DriverAcceptedAt && _curStatus === 'Assigned') {
    return { ok: true, idempotent: true, status: 'Assigned',
             driverId: _jobDrv, vehicleId: String(job.VehicleNo || job.CallSign || ''),
             version: parseInt(job.updateSeq) || 0, booking: _publicBooking(job) };
  }
  const _seqBefore = parseInt(job.updateSeq) || 0;
  job.BookingStatus     = 'Assigned';
  job.DriverAcceptedAt  = new Date().toISOString();
  // Stamp driver attribution when accept arrives before assign fanout lands (direct-create race).
  if (driverId && !_normJobDriverId(_jobDrv)) {
    const _resolved = _resolveDriverVehicleIds(driverId, opts.vehicleId || job.VehicleId || job.VehicleNo);
    const _stampDrv = _normalizeNotifyDriverId(_resolved.driverId) || _resolved.driverId;
    job.DriverId         = _stampDrv;
    job.AssignedDriverId = _stampDrv;
    job.VehicleId        = _resolved.vehicleId;
    job.VehicleNo        = _resolved.vehicleId;
    job.CallSign         = _resolved.vehicleId;
  }
  job.updateSeq         = _seqBefore + 1;
  job.lastUpdatedAt     = job.DriverAcceptedAt;
  job.lastUpdatedBy     = by;
  saveJobStore();

  const _finalDrv = String(job.DriverId || '').trim() || _jobDrv;
  if (_cid) {
    _writeBookingEvent(_cid, bookingId, 'StatusChanged',
      { from: _curStatus, to: 'Assigned', driverId: _finalDrv, action: 'accept' },
      by, job.updateSeq).catch(() => {});
  }
  // §FIX-CMD/ver-fanout — mirror version into allbookings/ + pendingjobs/ so
  // the driver app can read updateSeq from Firebase on cold-start.
  const _fanPatch = {
    updateSeq:        job.updateSeq,
    lastUpdatedAt:    job.lastUpdatedAt,
    lastUpdatedBy:    job.lastUpdatedBy,
    BookingStatus:    job.BookingStatus,
    Status:           job.BookingStatus,
    DriverId:         job.DriverId || _finalDrv,
    VehicleId:        job.VehicleId || '',
    DriverAcceptedAt: job.DriverAcceptedAt,
    PickAddress:      job.PickAddress || '',
    DropAddress:      job.DropAddress || '',
    PickLatLng:       job.PickLatLng || '',
    DropLatLng:       job.DropLatLng || '',
    eventType:        'updated',
  };
  if (_cid) {
    (async () => {
      try {
        await _fanVersionToFirebaseAwait(_cid, bookingId, _fanPatch, false);
      } catch (e) {
        console.warn(`  [${source}] accept fanout failed: ${e && e.message}`);
      }
    })();
  }
  console.log(`  [${source}] §FIX-CMD accept job #${bookingId} (${_curStatus}→Assigned) by driver ${_finalDrv} seq=${job.updateSeq}`);
  if (_cid) {
    _dispatchRefreshForJob(job, {
      cid: _cid,
      previousStatus: _curStatus,
      status: 'Assigned',
      action: 'accept',
      driverId: _finalDrv,
    }).catch(() => {});
  }
  return {
    ok: true, idempotent: false, status: 'Assigned',
    driverId: _finalDrv, vehicleId: String(job.VehicleNo || job.CallSign || ''),
    version: job.updateSeq,
    booking: _publicBooking(job)
  };
}

// Write driverQueue/{cid}/{driverId}/queued/{bookingId} for driver-app Queue tab.
async function _writeDriverQueueFirebase(cid, driverId, bookingId, job, originalStatus) {
  try {
    if (!cid || !driverId || !bookingId) return;
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const payload = {
      jobId: String(bookingId),
      BookingId: bookingId,
      acceptedAt: Date.now(),
      queuedAt: Date.now(),
      originalStatus: originalStatus || 'pending',
      PickAddress: job.PickAddress || job.PickLocation || '',
      DropAddress: job.DropAddress || job.DropLocation || '',
      passengername: job.passengername || job.Name || '',
      PhoneNo: job.PhoneNo || '',
      PaymentType: job.PaymentType || job.paymentMethod || job.PaymentMethod || '',
      VehicleType: job.VehicleType || job.serviceType || '',
      serviceType: job.serviceType || job.ServiceType || 'taxi',
    };
    await firebaseDbSet(`driverQueue/${cid}/${driverId}/queued/${bookingId}`, payload, tok);
    console.log(`  [driverQueue] queued #${bookingId} for driver ${driverId} originalStatus=${payload.originalStatus}`);
  } catch (e) {
    console.warn(`  [driverQueue] write failed: ${e && e.message}`);
  }
}

async function _removeDriverQueueFirebase(cid, driverId, bookingId) {
  try {
    if (!cid || !driverId || !bookingId) return;
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    await fbRequest(`${FB_DB_URL}/driverQueue/${cid}/${driverId}/queued/${bookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE');
    await fbRequest(`${FB_DB_URL}/driverQueue/${cid}/${driverId}/current.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
  } catch (e) { /* non-fatal */ }
}

async function _writePendingJobFirebase(cid, bookingId, job) {
  try {
    if (!cid || !bookingId || !job) return;
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const normed = _normFbJob(job);
    const fbJob = {
      BookingId: bookingId,
      Status: 'Pending',
      BookingStatus: 'Pending',
      DriverId: '0',
      VehicleId: '0',
      AssignedDriver: '',
      PassengerName: normed.name,
      PhoneNo: normed.phone,
      PickAddress: normed.pickAddress,
      DropAddress: normed.dropAddress,
      PickLatLng: normed.pickLatLng,
      DropLatLng: normed.dropLatLng,
      VehicleType: normed.vehicleType || job.VehicleType || '',
      serviceType: job.serviceType || job.ServiceType || 'taxi',
      Fare: job.EstimatedFare || job.TotalFare || normed.estimatedFare || '',
      PaymentType: normed.paymentMethod,
    };
    await firebaseDbSet(`pendingjobs/${cid}/${bookingId}`, fbJob, tok);
  } catch (e) {
    console.warn(`  [pendingjobs] write failed: ${e && e.message}`);
  }
}

// Driver accepts a Pending job from Offers tab — assign if free, queue if busy.
async function acceptPendingJobByDriver(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const driverId  = String(opts.driverId || '').trim();
  const source    = opts.source || 'acceptPendingJobByDriver';
  if (!bookingId || !driverId) return { ok: false, error_code: 'bad_request', error: 'bookingId and driverId required' };

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) return { ok: false, error_code: 'not_found', error: 'job not found' };
  const job = jobStore[idx];
  const _cur = job.BookingStatus || '';
  if (_cur !== 'Pending' && _cur !== 'Offered' && _cur !== 'No One') {
    return { ok: false, error_code: 'invalid_transition', error: `cannot accept job in status ${_cur}`, currentStatus: _cur };
  }

  const drv = ZONE_DRIVERS.find(d => d && (String(d.driverid) === driverId || String(d.VehicleId) === driverId)) || null;
  const vehicleId = String((drv && (drv.VehicleId || drv.vehiclenumber)) || job.VehicleNo || '').trim();
  const _cid = String(job.companyId || opts.companyId || '');
  const _busySt = new Set(['Busy', 'Picking', 'Assigned', 'Active']);
  const isBusy = drv && _busySt.has(String(drv.vehiclestatus || ''));
  const originalStatus = String(job.originalStatus || opts.originalStatus || 'pending').toLowerCase();
  job.originalStatus = originalStatus === 'manual' ? 'manual' : 'pending';

  if (isBusy) {
    const _qSvc = (job.serviceType || job.ServiceType || 'taxi').toString().toLowerCase();
    const _qIsTaxi = (_qSvc === 'taxi' || _qSvc === 'tm' || _qSvc === '');
    const _qExisting = _qIsTaxi ? jobStore.find(j =>
      j.BookingStatus === 'Queued' &&
      String(j.DriverId) === String(driverId) &&
      String(j.Id) !== String(bookingId)
    ) : null;
    if (_qExisting) {
      return { ok: false, error_code: 'queue_full', error: 'driver already has a queued job', existingJobId: _qExisting.Id };
    }
    job._origStatus = _cur === 'No One' ? 'No One' : 'Pending';
    job.BookingStatus = 'Queued';
    job.DriverId = driverId;
    job.queuedAt = Date.now();
    saveJobStore();
    await _writeDriverQueueFirebase(_cid, driverId, bookingId, job, job.originalStatus);
    // Remove from pendingjobs so other drivers stop seeing it
    if (_cid) {
      getFirebaseServerToken().then(tok => {
        if (tok) fbRequest(`${FB_DB_URL}/pendingjobs/${_cid}/${bookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
      });
    }
    console.log(`  [${source}] job #${bookingId} → Queued for busy driver ${driverId}`);
    if (_cid) {
      await _dispatchRefreshForJob(job, {
        cid: _cid,
        previousStatus: _cur,
        status: 'Queued',
        action: 'queue',
        driverId,
      });
    }
    return { ok: true, status: 'Queued', queued: true, driverId, booking: _publicBooking(job) };
  }

  const assignRes = await assignBooking({
    bookingId, driverId, vehicleId, by: 'driver', manualOffer: false, source
  });
  if (!assignRes.ok) return assignRes;
  const acceptRes = acceptBooking({ bookingId, driverId, by: 'driver', source });
  if (!acceptRes.ok) return acceptRes;
  if (_cid && driverId) {
    try {
      const tok = await getFirebaseServerToken();
      if (tok) {
        await firebaseDbSet(`notification/${driverId}`, {
          bookingId,
          content: 'Assigned',
          eventType: 'assigned',
          updatedAt: _FB_SERVER_TIMESTAMP,
        }, tok).catch(() => {});
        await fbRequest(`${FB_DB_URL}/pendingjobs/${_cid}/${bookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
      }
    } catch (e) {
      console.warn(`  [${source}] accept notification/pendingjobs cleanup failed: ${e && e.message}`);
    }
  }
  return Object.assign({}, acceptRes, { queued: false });
}

// Driver recall — restore to Pending (broadcast) or No One (dispatcher-only) based on originalStatus.
async function driverRecallJob(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const driverId  = String(opts.driverId || '').trim();
  const source    = opts.source || 'driverRecallJob';
  if (!bookingId) return { ok: false, error_code: 'bad_request', error: 'bookingId required' };

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) return { ok: false, error_code: 'not_found', error: 'job not found' };
  const job = jobStore[idx];
  const _cid = String(job.companyId || opts.companyId || '');
  const _prevSt = job.BookingStatus || '';
  const _drvId = String(job.DriverId || driverId || '').trim();
  const _restoredPool = _restorePoolStatusAfterOfferRelease(job);

  _applyPoolStatusFields(job, _restoredPool);
  job.returnReason = driverId ? `Recalled by ${driverId}` : 'Recalled by Driver';
  saveJobStore();
  if (_cid) {
    if (_restoredPool === 'No One') {
      getFirebaseServerToken().then(tok => {
        if (tok) fbRequest(`${FB_DB_URL}/pendingjobs/${_cid}/${bookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
      });
    } else {
      await _writePendingJobFirebase(_cid, bookingId, job);
    }
    await _dispatchRefreshForJob(job, {
      cid: _cid,
      previousStatus: _prevSt,
      status: job.BookingStatus,
      action: 'status',
      driverId: _drvId,
    });
  }

  if (_cid && _drvId) await _removeDriverQueueFirebase(_cid, _drvId, bookingId);
  if (_drvId) {
    const _ds = _maybeRestoreDriverState(_drvId, String(job.VehicleNo || ''), _cid, bookingId, false, source);
    return { ok: true, restoredStatus: job.BookingStatus, driverFreed: _ds.driverFreed, previousStatus: _prevSt, booking: _publicBooking(job) };
  }
  return { ok: true, restoredStatus: job.BookingStatus, previousStatus: _prevSt, booking: _publicBooking(job) };
}

// Driver declines or times out on a broadcast offer — restore job to U-A and set driver Away.
async function driverDeclineJob(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const driverId  = String(opts.driverId || '').trim();
  const timedOut  = !!opts.timedOut;
  const source    = opts.source || 'driverDeclineJob';
  if (!bookingId || !driverId) return { ok: false, error_code: 'bad_request', error: 'bookingId and driverId required' };

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) return { ok: false, error_code: 'not_found', error: 'job not found' };
  const job = jobStore[idx];
  const _cid = String(job.companyId || opts.companyId || '');
  const _cur = job.BookingStatus || '';
  if (_cur !== 'Offered' && _cur !== 'Pending' && _cur !== 'No One') {
    return { ok: false, error_code: 'invalid_transition', error: `cannot decline job in status ${_cur}`, currentStatus: _cur };
  }

  const _prevSt = _cur;
  const _restoredPool = _restorePoolStatusAfterOfferRelease(job);

  _applyPoolStatusFields(job, _restoredPool);
  job.returnReason = timedOut ? 'Offer timeout (no response)' : 'Declined by driver';
  _bumpJobUpdateSeq(job, 'driver');
  saveJobStore();
  _logJobPoolState(job, timedOut ? 'after-timeout' : 'after-decline');

  const _hasOther = driverHasRemainingAssignments(driverId, bookingId, _cid);
  if (!_hasOther && timedOut) {
    const zd = ZONE_DRIVERS.find(d => d && (String(d.driverid) === driverId || String(d.VehicleId) === driverId));
    if (zd) {
      zd.vehiclestatus = 'Away';
      zd.JobphoneNo = '';
      zd.jobpickup = '';
      zd.jobdropoff = '';
      zd.jobCount = 0;
      setAwayLock(driverId);
      const _fbVehId = zd.VehicleId || zd.vehiclenumber || '';
      if (_cid && _fbVehId) {
        void _mirrorDriverAwayOnUnreached(_cid, _fbVehId, driverId);
      }
      console.log(`  [${source}] driver ${driverId} → Away (timedOut=${timedOut})`);
    }
  }

  if (_cid) {
    await _releaseOfferToPoolFirebase(_cid, bookingId, job, _restoredPool);
    getFirebaseServerToken().then(async _tok => {
      if (!_tok) return;
      await fbRequest(`${FB_DB_URL}/notification/${driverId}.json?auth=${encodeURIComponent(_tok)}`, 'DELETE').catch(() => {});
    });
    await _dispatchRefreshForJob(job, {
      cid: _cid,
      previousStatus: _prevSt,
      status: job.BookingStatus,
      action: timedOut ? 'timeout' : 'decline',
      driverId: '0',
    });
  }

  console.log(`  [${source}] job #${bookingId} → ${job.BookingStatus} (pool=${_restoredPool}, timedOut=${timedOut})`);
  return { ok: true, status: job.BookingStatus, timedOut, driverSetAway: !_hasOther && timedOut, previousStatus: _prevSt, booking: _publicBooking(job) };
}

// ─── §FIX-UB — Unified booking update lifecycle ───────────────────────────────
// Counterpart to §FIX-CB. Single helper for every booking edit. Diff-based,
// per-booking, with explicit event classification so the driver app can react
// granularly to pickup-change / stop-add / fare-change / etc. without resetting
// driver state for other concurrent assignments.
// ──────────────────────────────────────────────────────────────────────────────

// Trim bookingEvents/{cid}/{bookingId} to keep only the most recent N entries.
async function _trimBookingEvents(cid, bookingId, keep) {
  try {
    if (!cid || !bookingId) return;
    const _tok = await getFirebaseServerToken();
    if (!_tok) return;
    const _url = `${FB_DB_URL}/bookingEvents/${cid}/${bookingId}.json?auth=${encodeURIComponent(_tok)}&shallow=false`;
    const _resp = await fbRequest(_url, 'GET');
    // fbRequest returns { status, headers, body } — payload is at .body.
    const _events = (_resp && _resp.status === 200 && _resp.body && typeof _resp.body === 'object') ? _resp.body : null;
    if (!_events) return;
    const _keys = Object.keys(_events);
    if (_keys.length <= keep) return;
    // Sort by event seq (newer events have higher seq); fall back to push-key order.
    _keys.sort((a, b) => {
      const _sa = (_events[a] && _events[a].seq) || 0;
      const _sb = (_events[b] && _events[b].seq) || 0;
      if (_sa !== _sb) return _sa - _sb;
      return a < b ? -1 : 1;
    });
    const _drop = _keys.slice(0, _keys.length - keep);
    for (const _k of _drop) {
      await fbRequest(`${FB_DB_URL}/bookingEvents/${cid}/${bookingId}/${_k}.json?auth=${encodeURIComponent(_tok)}`, 'DELETE').catch(() => {});
    }
  } catch (_e) { /* non-fatal */ }
}

// Write a single event record under bookingEvents/{cid}/{bookingId}/{push-id}.
// Public schema for driver-app listeners:
//   { type, seq, timestamp, data }
// type is one of: PickupChanged | FareChanged | StopAdded | StatusChanged
function _canonicalBookingEventType(eventType) {
  const t = String(eventType || '').trim();
  if (['PickupChanged', 'FareChanged', 'StopAdded', 'StatusChanged'].includes(t)) return t;
  if (t === 'DropoffChanged') return 'PickupChanged';
  // Lifecycle + metadata edits collapse to StatusChanged; original type preserved in data.eventSubtype.
  return 'StatusChanged';
}

async function _writeBookingEvent(cid, bookingId, eventType, data, by, seq) {
  try {
    if (!cid || !bookingId || !eventType) return;
    const _tok = await getFirebaseServerToken();
    if (!_tok) return;
    const _canonical = _canonicalBookingEventType(eventType);
    const _data = (data && typeof data === 'object') ? { ...data } : {};
    if (by && !_data.by) _data.by = by;
    if (eventType !== _canonical && !_data.eventSubtype) _data.eventSubtype = eventType;
    const _payload = {
      type:      _canonical,
      seq:       seq || 0,
      timestamp: Date.now(),
      data:      _data
    };
    const _url = `${FB_DB_URL}/bookingEvents/${cid}/${bookingId}.json?auth=${encodeURIComponent(_tok)}`;
    await fbRequest(_url, 'POST', _payload);
    _trimBookingEvents(cid, bookingId, 50).catch(() => {});
  } catch (_e) {
    console.warn(`  [bookingEvents] write failed: ${_e && _e.message}`);
  }
}

// Emit StatusChanged when a job's BookingStatus transitions.
function _emitStatusChanged(job, fromStatus, toStatus, by, seq, extra) {
  if (!job || !job.Id) return;
  const cid = String(job.companyId || '');
  if (!cid || fromStatus === toStatus) return;
  _writeBookingEvent(cid, job.Id, 'StatusChanged', {
    from: fromStatus,
    to:   toStatus,
    ...(extra || {})
  }, by || 'system', seq).catch(() => {});
}

// Bump updateSeq and write StatusChanged — use after mutating job.BookingStatus.
function _bumpSeqAndEmitStatus(job, previousStatus, by, source, extra) {
  if (!job || previousStatus === job.BookingStatus) return parseInt(job.updateSeq) || 0;
  const seq = (parseInt(job.updateSeq) || 0) + 1;
  job.updateSeq = seq;
  job.lastUpdatedAt = new Date().toISOString();
  job.lastUpdatedBy = by || 'system';
  _emitStatusChanged(job, previousStatus, job.BookingStatus, by, seq, { source, ...(extra || {}) });
  return seq;
}

function _stampPreOfferPoolStatus(job, fromStatus) {
  if (!job) return;
  const st = String(fromStatus || job.BookingStatus || 'Pending');
  if (st === 'No One') job._preOfferStatus = 'No One';
  else if (st === 'Pending' || st === 'Scheduled') job._preOfferStatus = 'Pending';
  else if (!job._preOfferStatus) {
    const orig = String(job.originalStatus || '').toLowerCase();
    job._preOfferStatus = orig === 'manual' ? 'No One' : 'Pending';
  }
}

function _restorePoolStatusAfterOfferRelease(job) {
  if (!job) return 'Pending';
  const stamped = String(job._preOfferStatus || job._origStatus || '').trim();
  if (stamped === 'No One') return 'No One';
  if (stamped === 'Pending') return 'Pending';
  const orig = String(job.originalStatus || '').toLowerCase();
  if (orig === 'manual') return 'No One';
  return 'Pending';
}

function _applyPoolStatusFields(job, poolStatus) {
  const restored = poolStatus === 'No One' ? 'No One' : 'Pending';
  job.BookingStatus = restored;
  job.DriverId = 0;
  job.VehicleId = 0;
  job.releasedAt = Date.now();
  if (restored === 'No One') {
    job.manualOffer = true;
    job.originalStatus = 'manual';
  } else {
    job.manualOffer = false;
    if (!job.originalStatus || String(job.originalStatus).toLowerCase() === 'manual') {
      job.originalStatus = 'pending';
    }
  }
  return restored;
}

function _logJobPoolState(job, tag) {
  if (!job) return;
  console.log(
    `  [pool-trace/${tag}] job #${job.Id} BookingStatus=${job.BookingStatus}` +
    ` _preOfferStatus=${job._preOfferStatus || '-'}` +
    ` originalStatus=${job.originalStatus || '-'}` +
    ` manualOffer=${!!job.manualOffer}` +
    ` DriverId=${job.DriverId}` +
    ` releasedAt=${job.releasedAt || '-'}` +
    ` updateSeq=${job.updateSeq || 0}`
  );
}

function _bumpJobUpdateSeq(job, by) {
  const seq = (parseInt(job.updateSeq) || 0) + 1;
  job.updateSeq = seq;
  job.lastUpdatedAt = new Date().toISOString();
  job.lastUpdatedBy = by || 'system';
  return seq;
}

async function _releaseOfferToPoolFirebase(cid, bookingId, job, poolStatus) {
  if (!cid || !bookingId || !job) return;
  try {
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const restored = poolStatus === 'No One' ? 'No One' : 'Pending';
    const seq = parseInt(job.updateSeq) || 0;
    const patch = {
      BookingId: String(bookingId),
      BookingStatus: restored,
      Status: restored,
      DriverId: restored === 'No One' ? '-1' : '0',
      VehicleId: '0',
      AssignedDriver: '',
      AssignedDriverId: '',
      manualOffer: restored === 'No One',
      releasedAt: job.releasedAt || Date.now(),
      updateSeq: seq,
      version: seq,
      _seq: seq,
      lastUpdatedAt: job.lastUpdatedAt || new Date().toISOString(),
    };
    await firebaseDbPatch(`allbookings/${cid}/${bookingId}`, patch, tok);
    if (restored === 'No One') {
      await fbRequest(`${FB_DB_URL}/pendingjobs/${cid}/${bookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
    } else {
      await fbRequest(`${FB_DB_URL}/pendingjobs/${cid}/${bookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
      await _writePendingJobFirebase(cid, bookingId, job);
    }
    console.log(`  [pool-restore] Firebase allbookings/${cid}/${bookingId} → ${restored} (seq=${seq})`);
  } catch (e) {
    console.warn(`  [pool-restore] Firebase fanout failed: ${e && e.message}`);
  }
}

async function _mirrorDriverAwayOnUnreached(cid, vehicleNo, driverId) {
  if (!cid || !vehicleNo) return;
  try {
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const topPatch = {
      vehiclestatus: 'Away',
      VehicleStatus: 'Away',
      jobpickup: '',
      jobdropoff: '',
      JobphoneNo: '',
      jobname: '',
      BookingId: '',
      jobCount: 0,
    };
    await firebaseDbPatch(`online/${cid}/${vehicleNo}`, topPatch, tok);
    await firebaseDbPatch(`online/${cid}/${vehicleNo}/current`, {
      vehiclestatus: 'Away',
      currentJobId: null,
      jobId: null,
      joboffer: 0,
      jobpickup: '',
      jobdropoff: '',
      JobphoneNo: '',
      jobname: '',
    }, tok);
    console.log(`  [pool-restore] online/${cid}/${vehicleNo} → Away (driver ${driverId || '-'})`);
  } catch (e) {
    console.warn(`  [pool-restore] online Away mirror failed: ${e && e.message}`);
  }
}

function _dispatchRefreshActionForStatus(status) {
  const st = String(status || '');
  if (st === 'Completed') return 'complete';
  if (st === 'Cancelled' || st === 'No Show') return 'cancel';
  if (st === 'Queued') return 'queue';
  if (st === 'Offered') return 'offer';
  if (st === 'Assigned') return 'assign';
  if (st === 'Pending' || st === 'No One' || st === 'Scheduled') return 'status';
  if (st === 'Picking' || st === 'Arrived') return 'assign';
  if (st === 'Active' || st === 'OnTrip') return 'active';
  return 'status';
}

function _dispatchRefreshForJob(job, opts) {
  opts = opts || {};
  if (!job || !job.Id) return Promise.resolve();
  const cid = String(opts.cid || job.companyId || '');
  if (!cid) return Promise.resolve();
  const status = opts.status || job.BookingStatus || '';
  const action = opts.action || _dispatchRefreshActionForStatus(status);
  const driverId = opts.driverId != null
    ? opts.driverId
    : (_normJobDriverId(job.DriverId) || '0');
  return _signalDispatchConsoleRefresh(cid, {
    bookingId: job.Id,
    action,
    status,
    previousStatus: opts.previousStatus,
    driverId,
    updateSeq: parseInt(job.updateSeq) || 0,
  });
}

function _jobDispatchTimeMs(job) {
  if (!job) return null;
  const notifyAt = job.NotifyDispatchAt || job.notifyDispatchAt;
  if (notifyAt) {
    const ms = Date.parse(String(notifyAt));
    if (!Number.isNaN(ms)) return ms;
  }
  const db = parseInt(job.DispatchTimebefore || '0', 10) || 0;
  const pickRef = job.Pickingtime || job.BookingDateTime;
  let pickupMs = job.ScheduledFor || 0;
  if (!pickupMs && pickRef) {
    pickupMs = _parseLocalDT(pickRef, job.companyId);
    if (!pickupMs) pickupMs = new Date(_toDateStr(pickRef)).getTime();
  }
  if (!pickupMs || isNaN(pickupMs)) return null;
  return pickupMs - db * 60000;
}

function _isBeforeDispatchWindow(job) {
  const dispatchMs = _jobDispatchTimeMs(job);
  if (!dispatchMs) return false;
  return Date.now() < dispatchMs;
}

function _preDispatchAssignBlockMessage(job) {
  const pickRef = job.Pickingtime || job.BookingDateTime || '';
  if (pickRef) {
    try {
      const d = new Date(_toDateStr(pickRef).replace(' ', 'T'));
      if (!Number.isNaN(d.getTime())) {
        const t = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `This job is pre-booked for ${t}. To send it now, change it to 'Now' first.`;
      }
    } catch (_e) { /* fall through */ }
  }
  return "This job is pre-booked for a later pickup. To send it now, change it to 'Now' first.";
}

function _afterJobStatusChange(job, previousStatus, by, source) {
  if (!job || previousStatus === job.BookingStatus) return;
  _bumpSeqAndEmitStatus(job, previousStatus, by, source);
  _dispatchRefreshForJob(job, { previousStatus, source }).catch(() => {});
}

// §FIX-CMD/ver-fanout — Mirror updateSeq + lastUpdatedAt + BookingStatus into
// the Firebase paths the driver app reads (allbookings/, pendingjobs/) so the
// phone can recover version on cold-start without replaying bookingEvents.
//   - allbookings/{cid}/{bid}: always patched (persists for history).
//   - pendingjobs/{cid}/{bid}: skipped on terminal (Cancelled/Completed) —
//     _bwClearJobFromFirebase DELETEs that node, so a PATCH would either race
//     or resurrect a ghost record.
// Fire-and-forget — never blocks the verb response. Failures logged at warn.
function _fanVersionToFirebase(cid, bookingId, patch, isTerminal) {
  if (!cid || !bookingId || !patch) return;
  (async () => {
    try {
      await _fanVersionToFirebaseAwait(cid, bookingId, patch, isTerminal);
    } catch (_e) {
      console.warn(`  [ver-fanout] cid=${cid} bid=${bookingId} failed: ${_e && _e.message}`);
    }
  })();
}

async function _fanVersionToFirebaseAwait(cid, bookingId, patch, isTerminal) {
  if (!cid || !bookingId || !patch) return;
  const _tok = await getFirebaseServerToken();
  if (!_tok) return;
  await firebaseDbPatch(`allbookings/${cid}/${bookingId}`, patch, _tok)
    .catch(_e => console.warn(`  [ver-fanout] allbookings/${cid}/${bookingId} patch failed: ${_e && _e.message}`));
  if (!isTerminal) {
    await firebaseDbPatch(`pendingjobs/${cid}/${bookingId}`, patch, _tok)
      .catch(_e => console.warn(`  [ver-fanout] pendingjobs/${cid}/${bookingId} patch failed: ${_e && _e.message}`));
  }
}

// Nudge dispatch console to refresh job tabs immediately (Offer/Assign/U-A).
async function _signalDispatchConsoleRefresh(cid, payload) {
  if (!cid) return;
  try {
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    await firebaseDbPatch(`dispatchConsole/${cid}/refresh`, Object.assign({ at: Date.now() }, payload || {}), tok);
  } catch (e) {
    console.warn(`  [dispatchRefresh] cid=${cid} failed: ${e && e.message}`);
  }
}

// Diff incoming changes against the live job. Returns {field: {from, to}} for
// fields that actually changed. Numeric values are string-normalized so
// "10" vs 10 doesn't count as a change.
function _diffJobChanges(job, changes) {
  const _diff = {};
  if (!job || !changes || typeof changes !== 'object') return _diff;
  const _norm = v => (v === null || v === undefined) ? '' : String(v).trim();
  for (const _k of Object.keys(changes)) {
    const _to   = changes[_k];
    const _from = job[_k];
    // Arrays/objects: shallow JSON compare.
    if ((typeof _to === 'object' && _to !== null) || (typeof _from === 'object' && _from !== null)) {
      if (JSON.stringify(_to || null) !== JSON.stringify(_from || null)) {
        _diff[_k] = { from: _from, to: _to };
      }
      continue;
    }
    if (_norm(_to) !== _norm(_from)) {
      _diff[_k] = { from: _from, to: _to };
    }
  }
  return _diff;
}

// Map a diff to one or more semantic event types so the driver app can react
// granularly. Generic JobUpdated covers anything not in the explicit set.
function _classifyDiff(diff) {
  const _events = new Set();
  if (!diff) return [];
  const _has = (...keys) => keys.some(k => Object.prototype.hasOwnProperty.call(diff, k));
  if (_has('PickAddress', 'PickLatLng', 'pickup', 'DropAddress', 'DropLatLng', 'dropoff'))
    _events.add('PickupChanged');
  if (_has('stops', 'Stops', 'extraStops', 'Nextstop', 'nextstopdata')) _events.add('StopAdded');
  if (_has('Notes', 'notes', 'comment', 'Comment', 'DriverNote')) _events.add('StatusChanged');
  if (_has('Name', 'PhoneNo', 'PassengerName', 'Email')) _events.add('StatusChanged');
  if (_has('EstimatedFare', 'RideCost', 'CustomeRate', 'TarriffType', 'TariffId', 'FixedPrice', 'Fare', 'fare'))
    _events.add('FareChanged');
  if (_has('BookingDateTime', 'Pickingtime', 'ScheduledFor', 'ScheduledForMs')) _events.add('StatusChanged');
  if (_has('BookingStatus', 'Status', 'status')) _events.add('StatusChanged');
  if (_events.size === 0) _events.add('StatusChanged');
  return Array.from(_events);
}

// §FIX-DA-G4 — map internal event types (rich) to the driver-app's 6-value
// public enum. Driver-app subscribes to `eventType` on notification/{drv} and
// allbookings/{cid}/{bookingId}; the richer `type` stream stays on
// bookingEvents/{cid}/{bookingId} for HQ/audit consumers.
function _ubMapEventType(internalType) {
  const _t = String(internalType || '').trim();
  if (_t === 'BookingCancelled')  return 'cancelled';
  if (_t === 'BookingRecalled')   return 'recalled';
  if (_t === 'BookingReassigned') return 'reassigned';
  if (_t === 'BookingCompleted')  return 'completed';
  if (_t === 'JobOffered' || _t === 'NewOffer') return 'new_offer';
  // All field-level changes (PickupChanged / DropoffChanged / FareChanged /
  // ScheduleChanged / StopAdded / PassengerNoteChanged / PassengerInfoChanged
  // / JobUpdated) collapse to a single public type.
  return 'updated';
}

// §FIX-DA-G5 — Firebase RTDB serverTimestamp sentinel. Resolves to the
// authoritative server clock at write time (defeats device clock skew).
const _FB_SERVER_TIMESTAMP = { '.sv': 'timestamp' };

// Statuses where the booking is currently visible inside the driver app.
const _UB_DRIVER_VISIBLE = new Set(['Offered', 'Assigned', 'Picking', 'OnTrip', 'Active', 'Queued']);

// Unified driver-app edit notification — used by updateBooking(), ProcUpdateJobv6, and any future edit path.
async function _writeDriverJobUpdatedNotification(opts) {
  opts = opts || {};
  const job = opts.job;
  const diff = opts.diff || {};
  const seq = parseInt(opts.seq) || 0;
  const by = String(opts.by || 'dispatcher').toLowerCase();
  const source = opts.source || '_writeDriverJobUpdatedNotification';
  if (!job || !job.Id) return false;

  const _fbIds = _driverFirebaseIdsFromJob(job);
  const _drv = _fbIds.driverId;
  const _visible = _UB_DRIVER_VISIBLE.has(job.BookingStatus || '');
  if (!_visible || !_drv) return false;

  const bookingId = job.Id;
  const _eventTypes = opts.eventTypes || _classifyDiff(diff);
  const _primaryType = _eventTypes[0] || 'JobUpdated';
  const _tok = await getFirebaseServerToken();
  if (!_tok) return false;

  const _payload = {
    bookingid: `${bookingId},${_primaryType},${_drv},${by},Dispatcher`,
    content:   'Job has been updated',
    type:      'job_updated',
    seq:       seq,
    bookingId: bookingId,
    eventType: 'job_updated',
    version:   seq,
    updatedAt: _FB_SERVER_TIMESTAMP,
    editNotice: 'Details changed',
  };
  if (diff.PickAddress) { _payload.pickup = diff.PickAddress.to; _payload.jobpickup = diff.PickAddress.to; }
  if (diff.DropAddress) { _payload.dropoff = diff.DropAddress.to; _payload.jobdropoff = diff.DropAddress.to; }
  if (diff.Pickingtime || diff.BookingDateTime) {
    _payload.Pickingtime = (diff.Pickingtime || diff.BookingDateTime).to;
    _payload.pickupTime = _payload.Pickingtime;
  }
  if (diff.Notes || diff.JobInfo || diff.Instructions) {
    _payload.notes = (diff.Notes || diff.JobInfo || diff.Instructions).to;
    _payload.jobinfo = _payload.notes;
  }
  if (diff.Name || diff.PassengerName) {
    _payload.jobname = (diff.Name || diff.PassengerName).to;
  }
  if (diff.PhoneNo) _payload.JobphoneNo = diff.PhoneNo.to;
  if (!_payload.jobpickup) _payload.jobpickup = String(job.PickAddress || job.PickLocation || '');
  if (!_payload.jobdropoff) _payload.jobdropoff = String(job.DropAddress || job.DropLocation || '');

  await firebaseDbSet(`notification/${_drv}`, _payload, _tok);
  console.log(`  [${source}] notification/${_drv} → job_updated seq=${seq}`);
  return true;
}

// updateBooking({bookingId, changes, by, ifSeq?, source})
//   - Diff-based, per-booking, race-safe via updateSeq.
//   - Refuses if job is already closed (Cancelled / Completed / etc.).
//   - Returns {ok, idempotent?, stale?, currentSeq?, eventTypes, diff, seq, driverNotified}.
async function updateBooking(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const changes   = (opts.changes && typeof opts.changes === 'object') ? opts.changes : {};
  const by        = String(opts.by || 'dispatcher').toLowerCase();
  const ifSeq     = (opts.ifSeq !== undefined && opts.ifSeq !== null) ? parseInt(opts.ifSeq) : null;
  const source    = opts.source || 'updateBooking';

  if (!bookingId) {
    return { ok: false, error: 'bookingId required' };
  }
  // Already closed → refuse. Caller should handle as conflict.
  const _closed = closedJobStore.find(j => j && j.Id === bookingId);
  if (_closed) {
    console.log(`  [${source}] §FIX-UB refused: job #${bookingId} already closed (${_closed.BookingStatus || '?'})`);
    return { ok: false, closed: true, error: 'job already closed' };
  }
  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) {
    return { ok: false, error: 'job not found' };
  }
  const job = jobStore[idx];

  const _withdrawHint = _normJobDriverId(changes._withdrawDriverId);
  if (_withdrawHint) delete changes._withdrawDriverId;

  const _prevStatus = job.BookingStatus || 'Pending';
  const _prevDrv    = _attachedDriverIdFromJob(job, _withdrawHint);
  const _prevVid    = String(job.VehicleNo || job.CallSign || job.VehicleId || job.AssignedVehicleId || '').trim();

  // Race-safety check.
  const _curSeq = parseInt(job.updateSeq) || 0;
  if (ifSeq !== null && ifSeq !== _curSeq) {
    console.log(`  [${source}] §FIX-UB stale: job #${bookingId} ifSeq=${ifSeq} but currentSeq=${_curSeq}`);
    return { ok: false, stale: true, currentSeq: _curSeq, error: 'sequence mismatch' };
  }

  // Diff.
  const _diff = _diffJobChanges(job, changes);
  if (Object.keys(_diff).length === 0) {
    console.log(`  [${source}] §FIX-UB idempotent: job #${bookingId} no field changes (seq=${_curSeq})`);
    return { ok: true, idempotent: true, eventTypes: [], diff: {}, seq: _curSeq, driverNotified: false };
  }

  // Apply diff to the in-memory job.
  for (const _k of Object.keys(_diff)) {
    job[_k] = _diff[_k].to;
  }
  const _newSeq = _curSeq + 1;
  job.updateSeq      = _newSeq;
  job.lastUpdatedAt  = new Date().toISOString();
  job.lastUpdatedBy  = by;
  saveJobStore();

  const _eventTypes = _classifyDiff(_diff);
  const _cid = String(job.companyId || '');
  const _fbIds = _driverFirebaseIdsFromJob(job);
  let _drv = _fbIds.driverId;
  const _vid = _fbIds.vehicleId;
  const _visible = _UB_DRIVER_VISIBLE.has(job.BookingStatus || '');

  // Dispatcher unassign — job returned to Pending/No One; notify the previous driver.
  const _newStatus = job.BookingStatus || 'Pending';
  const _unassignToPool = (_newStatus === 'Pending' || _newStatus === 'No One') && !_drv;
  const _notifyDrvOnEdit = _drv || (_visible ? _prevDrv : '');
  if (_prevDrv && (_DRIVER_ATTACHED_STATUSES.has(_prevStatus) || _withdrawHint) && _unassignToPool) {
    if (typeof markDispatcherRecalled === 'function') markDispatcherRecalled(bookingId);
    try {
      await _withdrawJobFromDriver({
        cid: _cid, bookingId, driverId: _prevDrv,
        vehicleId: _prevVid || _prevDrv, prevStatus: _prevStatus,
        version: _newSeq, source: `${source}/unassign`,
      });
    } catch (e) {
      console.warn(`  [${source}] _withdrawJobFromDriver (unassign) failed: ${e && e.message}`);
    }
  }

  // Field-level events — data carries { field: { from, to }, ... } per changed field.
  if (_cid && bookingId) {
    for (const _type of _eventTypes) {
      const _eventData = (_type === 'StatusChanged' && _diff.BookingStatus)
        ? { from: _diff.BookingStatus.from, to: _diff.BookingStatus.to, changes: _diff }
        : { changes: _diff };
      _writeBookingEvent(_cid, bookingId, _type, _eventData, by, _newSeq).catch(() => {});
    }
  }

  // Booking-scoped Firebase fanout — PATCH changed fields + _seq to
  // pendingjobs/allbookings so external consumers see the authoritative state.
  // jobs/{cid}/{vid}/{drv} is driver-keyed (not booking-keyed), so we gate on
  // a booking-identity check to prevent overwriting Job A's fields when an
  // edit lands on the same driver's Job B.
  if (_cid && bookingId) {
    const _fbChanged = _mirrorFbJobFields((() => {
      const raw = {};
      for (const _k of Object.keys(_diff)) raw[_k] = _diff[_k].to;
      return raw;
    })());
    _fbChanged._seq            = _newSeq;
    _fbChanged.version         = _newSeq;
    _fbChanged.updateSeq       = _newSeq;
    _fbChanged.jobUpdatedAt    = Date.now();
    _fbChanged.jobUpdatedAtIso = new Date().toISOString();
    // §FIX-DA-G5/G4 — driver-app public contract: version + serverTimestamp
    // + 6-value eventType on every booking write.
    _fbChanged.updatedAt       = _FB_SERVER_TIMESTAMP;
    _fbChanged.eventType       = _ubMapEventType(_eventTypes[0] || 'JobUpdated');
    (async () => {
      try {
        const _tok = await getFirebaseServerToken();
        if (!_tok) return;
        await firebaseDbPatch(`pendingjobs/${_cid}/${bookingId}`, _fbChanged, _tok).catch(_e => { console.warn(`  [${source}] §FIX-UB pendingjobs patch failed: ${_e.message}`); });
        await firebaseDbPatch(`allbookings/${_cid}/${bookingId}`, _fbChanged, _tok).catch(_e => { console.warn(`  [${source}] §FIX-UB allbookings patch failed: ${_e.message}`); });
        // §FIX-DA-G2 — booking-keyed child: patch jobs/{cid}/{vid}/{drv}/{bookingId}
        // directly. The pre-read + cross-booking guard from §FIX-UB is no longer
        // needed: an edit to booking B can never clobber booking A because they
        // live in separate children of the driver node.
        if (_visible && _vid && _vid !== '0' && _vid !== '-1' && _drv) {
          await firebaseDbPatch(`jobs/${_cid}/${_vid}/${_drv}/${bookingId}`, _fbChanged, _tok)
            .then(() => console.log(`  [${source}] §FIX-UB jobs/${_cid}/${_vid}/${_drv}/${bookingId} live-patched`))
            .catch(_e => { console.warn(`  [${source}] §FIX-UB jobs live-patch failed: ${_e.message}`); });
        }
      } catch (_e) {
        console.warn(`  [${source}] §FIX-UB Firebase fanout error: ${_e && _e.message}`);
      }
    })();
  }

  // Notify the driver app — use attached driver id even if status just left their UI.
  let _driverNotified = false;
  if (_cid && _notifyDrvOnEdit && !_unassignToPool) {
    try {
      const _notifyJob = Object.assign({}, job, { DriverId: _notifyDrvOnEdit, AssignedDriverId: _notifyDrvOnEdit });
      _driverNotified = await _writeDriverJobUpdatedNotification({
        job: _notifyJob, diff: _diff, seq: _newSeq, by, source: `${source}/notify`,
        eventTypes: _eventTypes,
      });
    } catch (_e) {
      console.warn(`  [${source}] §FIX-UB notification write failed: ${_e && _e.message}`);
    }
  }

  console.log(`  [${source}] §FIX-UB job #${bookingId} seq ${_curSeq}→${_newSeq} types=[${_eventTypes.join(',')}] by=${by} fields=[${Object.keys(_diff).join(',')}]`);
  if (_cid && _diff.BookingStatus) {
    await _dispatchRefreshForJob(job, {
      cid: _cid,
      previousStatus: _prevStatus,
      status: job.BookingStatus,
      action: _dispatchRefreshActionForStatus(job.BookingStatus),
      driverId: _drv || _prevDrv,
    });
  }
  return {
    ok: true, idempotent: false,
    eventTypes: _eventTypes,
    diff: _diff,
    seq: _newSeq,
    driverNotified: _driverNotified,
    visible: _visible,
    driverId: _drv,
    vehicleId: _vid
  };
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
// Load persisted counter from disk so daily sequence survives restarts.
// Without this the counter starts at 0 every restart and recycles IDs that
// were already issued today — producing duplicate booking IDs in the store.
try {
  if (fs.existsSync(COMPANY_JOB_SEQ_FILE)) {
    const _persisted = JSON.parse(fs.readFileSync(COMPANY_JOB_SEQ_FILE, 'utf8')) || {};
    Object.keys(_persisted).forEach(k => {
      const v = parseInt(_persisted[k], 10);
      if (!isNaN(v) && v > 0) _companyJobSeq[k] = v;
    });
  }
} catch(e) { console.warn('[companyJobSeq] load failed:', e && e.message); }
function _saveCompanyJobSeq() {
  // Async write — best-effort durability. Belt-and-braces alongside
  // syncCompanyJobSeq() which also seeds from jobStore + closedJobStore.
  fs.writeFile(COMPANY_JOB_SEQ_FILE, JSON.stringify(_companyJobSeq, null, 2), (err) => {
    if (err) console.warn('[companyJobSeq] save failed:', err.message);
  });
}
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
  _saveCompanyJobSeq(); // persist after each bump so restart cannot recycle
  return parseInt(`${prefix}${yy}${mm}${dd}${seq}`, 10); // always a number so j.Id === parseInt(...) comparisons work
}

// Valid booking sources accepted by POST /api/job/create
const BOOKING_SOURCES = new Set(['dispatch', 'hail', 'passenger', 'web', 'food', 'freight']);

// ─── Job validation (phantom/empty job guard) ────────────────────────────────
function _normalizeBookingSource(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return '';
  if (s === 'website') return 'web';
  if (s.includes('passenger')) return 'passenger';
  if (s.includes('hail')) return 'hail';
  if (s.includes('dispatch') || s === 'auto dispatch' || s === 'dispatch console') return 'dispatch';
  if (s.includes('food')) return 'food';
  if (s.includes('freight')) return 'freight';
  if (s === 'web') return 'web';
  return s;
}

function _parseJobLatLng(jobOrRec) {
  if (jobOrRec.pickupLat != null && jobOrRec.pickupLng != null) {
    const lat = parseFloat(jobOrRec.pickupLat);
    const lng = parseFloat(jobOrRec.pickupLng);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  const raw = jobOrRec.PickLatLng || jobOrRec.pickLatLng || jobOrRec.pickupLocation || '';
  const p = String(raw || '').split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  return (isNaN(lat) || isNaN(lng)) ? null : { lat, lng };
}

function _jobHasValidPickup(jobOrRec) {
  const addr = String(jobOrRec.PickAddress || jobOrRec.pickup || jobOrRec.pickupAddress || jobOrRec.PickLocation || '').trim();
  if (addr.length >= 3 && !/^0\s*,\s*0/.test(addr) && addr !== '0,0') return true;
  const ll = _parseJobLatLng(jobOrRec);
  if (ll && (Math.abs(ll.lat) > 0.0001 || Math.abs(ll.lng) > 0.0001) &&
      Math.abs(ll.lat) <= 90 && Math.abs(ll.lng) <= 180) return true;
  return false;
}

/** Normalize pickup/dropoff from POST /api/job/create body (multiple client field shapes). */
function _normalizeLocationFromCreateBody(data, kind) {
  const nested = data[kind];
  if (typeof nested === 'string' && nested.trim()) {
    return { address: nested.trim(), lat: 0, lng: 0 };
  }
  if (nested && typeof nested === 'object') {
    const addr = String(
      nested.address || nested.Address ||
      (kind === 'pickup'
        ? (nested.PickAddress || nested.PickLocation || nested.pickupAddress || nested.PickupAddress)
        : (nested.DropAddress || nested.DropLocation || nested.dropoffAddress || nested.DropoffAddress)) ||
      ''
    ).trim();
    const lat = parseFloat(nested.lat ?? nested.latitude ?? 0) || 0;
    const lng = parseFloat(nested.lng ?? nested.longitude ?? 0) || 0;
    if (addr || lat || lng) return { address: addr, lat, lng };
  }
  const isPick = kind === 'pickup';
  const flatAddr = String(
    isPick
      ? (data.pickupAddress || data.PickupAddress || data.PickAddress || data.PickLocation || data.pickup_address || '')
      : (data.dropoffAddress || data.DropoffAddress || data.DropAddress || data.DropLocation || data.dropoff_address || '')
  ).trim();
  const flatLL = _parseJobLatLng({
    PickLatLng: isPick ? (data.PickLatLng || data.pickLatLng) : undefined,
    DropLatLng: !isPick ? (data.DropLatLng || data.dropLatLng) : undefined,
    pickLatLng: isPick ? data.pickLatLng : undefined,
    dropLatLng: !isPick ? data.dropLatLng : undefined,
  });
  return {
    address: flatAddr,
    lat: flatLL ? flatLL.lat : 0,
    lng: flatLL ? flatLL.lng : 0,
  };
}

function _jobHasValidSource(jobOrRec) {
  const src = _normalizeBookingSource(jobOrRec.BookingSource || jobOrRec.source || jobOrRec.bookingSource || '');
  return !!src && BOOKING_SOURCES.has(src);
}

function _jobBookingId(jobOrRec, fallbackKey) {
  return parseInt(jobOrRec.Id || jobOrRec.BookingId || jobOrRec.bookingId || fallbackKey || 0) || 0;
}

function _jobExistsInStore(bid, cid) {
  if (!bid) return false;
  return jobStore.some(j => j && j.Id === bid && String(j.companyId || '') === String(cid || j.companyId || ''));
}

function _isValidJobRecord(rec, opts) {
  opts = opts || {};
  const bid = _jobBookingId(rec, opts.fallbackKey);
  if (!bid || bid <= 0) return false;
  const cid = String(rec.companyId || opts.companyId || '').trim();
  if (cid && !/^\d+$/.test(cid)) return false;
  if (!_jobHasValidPickup(rec)) return false;
  if (opts.requireSource && !_jobHasValidSource(rec)) return false;
  return true;
}

function _tryPushJobToStore(job, tag) {
  if (!job || !_isValidJobRecord(job, { requireSource: true })) return false;
  if (_jobExistsInStore(job.Id, job.companyId)) return false;
  jobStore.push(job);
  saveJobStore();
  if (tag) console.log(`[job-valid] ${tag} added job #${job.Id} cid=${job.companyId}`);
  return true;
}

function _purgeInvalidJobsFromStore(tag) {
  let removed = 0;
  for (let i = jobStore.length - 1; i >= 0; i--) {
    const j = jobStore[i];
    if (!j) { jobStore.splice(i, 1); removed++; continue; }
    const st = String(j.BookingStatus || '');
    const needsSource = ['Pending', 'Offered', 'Scheduled', 'No One'].includes(st);
    if (!_isValidJobRecord(j, { requireSource: needsSource })) {
      console.log(`[${tag}] removed invalid job #${j.Id} cid=${j.companyId} status=${st} pickup="${j.PickAddress || ''}"`);
      jobStore.splice(i, 1);
      removed++;
    }
  }
  if (removed) saveJobStore();
  return removed;
}

function _isDispatchableJob(job, cid) {
  if (!job || !job.Id) return false;
  const st = String(job.BookingStatus || '');
  if (st !== 'Pending' && st !== 'No One') return false;
  if (job.manualOffer === true) return false;
  if (!_isValidJobRecord(job, { requireSource: true, companyId: cid })) return false;
  const inStore = jobStore.find(j => j && j.Id === job.Id && String(j.companyId || '') === String(cid));
  if (!inStore) return false;
  if (String(inStore.BookingStatus || '') !== st) return false;
  return true;
}

// ─── In-memory message store ──────────────────────────────────────────────────
let nextMsgId = 100;
const messageStore = [];

function buildDriverChatList(cid) {
  const drivers = cid ? ZONE_DRIVERS.filter(d => d.companyId && String(d.companyId) === String(cid)) : ZONE_DRIVERS;
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
// Scans BOTH active jobStore AND closedJobStore (completed jobs leave the
// active store quickly so seeding from jobStore alone misses today's
// already-issued IDs — that was the duplicate-ID bug).
(function syncCompanyJobSeq() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`; // e.g. "260501"
  const _scan = (j) => {
    const idStr = String(j.Id || '');
    if (idStr.length >= 9 && idStr.slice(3, 9) === datePart) {
      const prefix = idStr.slice(0, 3);
      const seq = parseInt(idStr.slice(9), 10);
      const key = `${prefix}-${datePart}`;
      if (!isNaN(seq) && seq > (_companyJobSeq[key] || 0)) {
        _companyJobSeq[key] = seq;
      }
    }
  };
  jobStore.forEach(_scan);
  closedJobStore.forEach(_scan);
  // Persist the merged max so the saved file reflects reality on disk.
  _saveCompanyJobSeq();
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

// ─── §FIX-S — Defense-in-depth Firebase reconciler (post-22bi safety net) ────
//
// 22bi fixed the silent-catch on the driver-app side and 22bj will add an
// AsyncStorage retry queue. This reconciler is the dispatch-side belt-and-
// braces equivalent: it periodically walks Firebase `allbookings/{cid}` for
// every known tenant, finds Completed trips that never made it into our
// closedJobStore (regardless of cause — silent driver-app failure, network
// outage, server restart during a sync, future regression), and ingests them.
//
// Idempotent: only adds rows that aren't already in closedJobStore by
// (Id, companyId). Never overwrites populated fields on existing rows.
// Bounded look-back (default 7 days) so we don't re-scan ancient history.
//
// Triggers:
//   • 45s after boot (rehydrate anything missed while the server was down,
//     including the May-17 silent-window incident)
//   • Every 15 minutes thereafter
//   • Manual: POST /admin/reconcileClosedJobs (X-Admin-Key gated)
//
// This is the layer that ensures a silent-window incident can never recur —
// even if a future OTA re-introduces a silent-catch bug and Sentry is muted,
// dispatch backfills itself within 15 minutes.
const _FIXS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const _FIXS_INTERVAL_MS = 15 * 60 * 1000;
let   _FIXS_RUNNING     = false;
let   _FIXS_LAST_REPORT = null;

function _fixsCollectCompanyIds() {
  const set = new Set();
  try {
    // Include every operational status — trial/grace/deactivated tenants
    // can still have historical Firebase trips that need backfilling after
    // a server restart or local data loss. Any non-empty companyId qualifies.
    (registrationStore || []).forEach(r => {
      if (r && r.companyId &&
          ['approved','active','trial','grace','deactivated'].includes(r.status))
        set.add(String(r.companyId));
    });
  } catch (_) {}
  try {
    (closedJobStore || []).forEach(j => {
      if (j && (j.companyId || j.CompanyId)) set.add(String(j.companyId || j.CompanyId));
    });
  } catch (_) {}
  try {
    (jobStore || []).forEach(j => {
      if (j && (j.companyId || j.CompanyId)) set.add(String(j.companyId || j.CompanyId));
    });
  } catch (_) {}
  return Array.from(set).filter(Boolean);
}

function _fixsTripTimestampMs(b) {
  // Pick the best "trip closed at" timestamp from the Firebase record.
  const raw = b && (b.newcompelete || b.JobCompleteTime || b.MeterOffAt || b.DropoffTime
                  || b.completedAt || b.closeT || b.closedAt);
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw;
  const ms = Date.parse(String(raw));
  return isNaN(ms) ? 0 : ms;
}

// Normalise a /completedJobs/{cid}/{bid} record (lowercase SA-MasterReport
// schema) into the PascalCase shape dispatch's closedJobStore expects.
function _fixsNormalizeCompletedJob(c, cid, bid) {
  if (!c || typeof c !== 'object') return null;
  const numId = parseInt(c.bookingId != null ? c.bookingId
                       : (c.BookingId != null ? c.BookingId
                       : (c.Id != null ? c.Id : bid)));
  if (!numId) return null;
  const out = Object.assign({}, c);
  out.Id            = numId;
  // Path-authoritative tenant: trust the Firebase path /completedJobs/{cid}
  // over any companyId field inside the payload. Prevents a malformed or
  // cross-tagged record from being filed under the wrong tenant in-memory.
  out.companyId     = String(cid);
  out.BookingStatus = c.BookingStatus || c.status || 'Completed';
  // Field-name mapping (lowercase → PascalCase)
  if (c.completedAt && !out.JobCompleteTime) out.JobCompleteTime = c.completedAt;
  if (c.distanceKm  != null && out.JobDistance == null) out.JobDistance = c.distanceKm;
  if (c.fare        != null && out.TotalFare   == null) out.TotalFare   = c.fare;
  if (c.pickupAddress && !out.PickupAddress) out.PickupAddress = c.pickupAddress;
  if (c.dropAddress   && !out.DropAddress)   out.DropAddress   = c.dropAddress;
  if (c.paymentMethod && !out.PaymentMethod) out.PaymentMethod = c.paymentMethod;
  if (c.paymentType   && !out.PaymentType)   out.PaymentType   = c.paymentType;
  if (c.source        && !out.TripSource)    out.TripSource    = c.source;
  if (c.driverId      && !out.driverId)      out.driverId      = c.driverId;
  if (c.vehicleId     && !out.VehicleId)     out.VehicleId     = c.vehicleId;
  return out;
}

function _fixsNormalizeClosedLog(c, cid, bid) {
  if (!c || typeof c !== 'object') return null;
  const numId = parseInt(c.bookingId != null ? c.bookingId : (c.jobId != null ? c.jobId : bid));
  if (!numId) return null;
  const out = Object.assign({}, c);
  out.Id            = numId;
  out.companyId     = String(cid);
  out.BookingStatus = c.BookingStatus || c.status || 'Completed';
  if (c.completedAt && !out.JobCompleteTime) out.JobCompleteTime = typeof c.completedAt === 'number' ? new Date(c.completedAt).toISOString() : c.completedAt;
  if (c.closedAt && !out.JobCompleteTime) out.JobCompleteTime = typeof c.closedAt === 'number' ? new Date(c.closedAt).toISOString() : c.closedAt;
  if (c.distanceKm  != null && out.JobDistance == null) out.JobDistance = c.distanceKm;
  if (c.fare        != null && out.TotalFare   == null) out.TotalFare   = c.fare;
  if (c.totalFare   != null && out.TotalFare   == null) out.TotalFare   = c.totalFare;
  if (c.pickup      && !out.PickupAddress) out.PickupAddress = c.pickup;
  if (c.pickupAddress && !out.PickupAddress) out.PickupAddress = c.pickupAddress;
  if (c.dropoff     && !out.DropAddress)   out.DropAddress   = c.dropoff;
  if (c.dropAddress && !out.DropAddress)   out.DropAddress   = c.dropAddress;
  if (c.paymentType   && !out.PaymentType)   out.PaymentType   = c.paymentType;
  if (c.paymentMethod && !out.PaymentMethod) out.PaymentMethod = c.paymentMethod;
  if (c.source        && !out.BookingSource) out.BookingSource = c.source;
  if (c.driverId      && !out.driverId)      out.driverId      = c.driverId;
  if (c.driverName    && !out.drivername)    out.drivername    = c.driverName;
  if (c.vehicleId     && !out.VehicleId)     out.VehicleId     = c.vehicleId;
  if (c.routePolyline && !out.RoutePolyline) out.RoutePolyline = c.routePolyline;
  if (c.route_polyline && !out.RoutePolyline) out.RoutePolyline = c.route_polyline;
  if (c.fareBreakdown && !out.FareBreakdown) out.FareBreakdown = c.fareBreakdown;
  if (c.flagFall != null && out.FareBase == null) out.FareBase = c.flagFall;
  if (c.distanceCharge != null && out.RideCost == null) out.RideCost = c.distanceCharge;
  if (c.waitingCharge != null && out.WaitingCost == null) out.WaitingCost = c.waitingCharge;
  if (c.tariffName && !out.TarriffType) out.TarriffType = c.tariffName;
  if (c.tariffChanges && !out.tariffChanges) out.tariffChanges = c.tariffChanges;
  if (c.stepTimes && !out.stepTimes) out.stepTimes = c.stepTimes;
  if (c.gpsRoute && !out.gpsRoute) out.gpsRoute = c.gpsRoute;
  return out;
}

async function repairBookingFirebaseSync(opts) {
  opts = opts || {};
  const bookingId = parseInt(opts.bookingId) || 0;
  const action = String(opts.action || 'sync').toLowerCase();
  const source = opts.source || 'repairBookingFirebaseSync';
  if (!bookingId) return { ok: false, error: 'bookingId required' };

  const idx = jobStore.findIndex(j => j && j.Id === bookingId);
  if (idx === -1) {
    return { ok: false, error: 'job not found in jobStore' };
  }
  const job = jobStore[idx];
  const cid = String(job.companyId || opts.companyId || '').trim();
  if (!cid) return { ok: false, error: 'companyId missing on job' };

  if (action === 'no_one' || action === 'cancel') {
    const ub = await updateBooking({
      bookingId,
      changes: {
        BookingStatus: 'No One',
        Status: 'No One',
        DriverId: -1,
        VehicleId: 0,
        ...(job.DriverId ? { _withdrawDriverId: job.DriverId } : {}),
      },
      by: 'admin',
      source: `${source}/${action}`,
    });
    return { ok: !!ub.ok, action, booking: _publicBooking(jobStore.find(j => j && j.Id === bookingId) || job), ...ub };
  }

  const seq = parseInt(job.updateSeq) || 0;
  const patch = {
    BookingStatus: job.BookingStatus || 'Pending',
    Status:        job.BookingStatus || 'Pending',
    DriverId:      job.DriverId ?? -1,
    VehicleId:     job.VehicleId || 0,
    DriverAcceptedAt: job.DriverAcceptedAt || null,
    updateSeq:     seq,
    _seq:          seq,
    version:       seq,
    eventType:     'updated',
  };
  await _fanVersionToFirebaseAwait(cid, bookingId, patch, false);
  console.log(`  [${source}] synced Firebase #${bookingId} → ${patch.BookingStatus} seq=${seq}`);
  return { ok: true, action: 'sync', patch, booking: _publicBooking(job) };
}

async function reconcileClosedJobsFromFirebase(opts) {
  opts = opts || {};
  const verbose = opts.verbose !== false;
  if (_FIXS_RUNNING) {
    if (verbose) console.log('[§FIX-S/reconciler] previous run still in flight — skipping');
    return { skipped: true, reason: 'in_flight' };
  }
  if (!process.env.BW_FIREBASE_SECRET) {
    if (verbose) console.log('[§FIX-S/reconciler] BW_FIREBASE_SECRET not set — reconciler disabled');
    return { skipped: true, reason: 'no_secret' };
  }
  _FIXS_RUNNING = true;
  const startedAt = Date.now();
  const cutoffMs  = Date.now() - _FIXS_LOOKBACK_MS;
  const tok       = process.env.BW_FIREBASE_SECRET;
  const cids      = _fixsCollectCompanyIds();
  const report    = { startedAt: new Date(startedAt).toISOString(),
                      tenants: cids.length, scanned: 0, hydrated: 0,
                      perTenant: {}, perPath: { allbookings: 0, completedJobs: 0, closedLogs: 0 } };

  // Defines the two canonical write paths the driver app uses, so the
  // reconciler scans EVERY place a completed trip might land.
  //   • allbookings/{cid}/{bid}   — PascalCase, full audit payload
  //   • completedJobs/{cid}/{bid} — lowercase SA-MasterReport schema
  // Each path has its own normalizer so the merged record stamps in the
  // PascalCase shape closedJobStore + the closed-job detail panel expect.
  const _paths = [
    { name: 'allbookings',   normalize: (b, cid, bid) => {
        if (!b || typeof b !== 'object') return null;
        const numId = parseInt(b.Id != null ? b.Id : bid);
        if (!numId) return null;
        return Object.assign({}, b, { Id: numId, companyId: String(cid) });
    } },
    { name: 'completedJobs', normalize: _fixsNormalizeCompletedJob },
    { name: 'closedLogs', normalize: _fixsNormalizeClosedLog, firebasePath: 'closedJobs' },
  ];

  try {
    for (let i = 0; i < cids.length; i++) {
      const cid = cids[i];
      report.perTenant[cid] = { scanned: 0, hydrated: 0, ids: [] };
      for (let pi = 0; pi < _paths.length; pi++) {
        const pInfo = _paths[pi];
        let bookings = null;
        try {
          bookings = await firebaseDbGet((pInfo.firebasePath || pInfo.name) + '/' + cid, tok);
        } catch (e) {
          if (verbose) console.log(`[§FIX-S/reconciler] ${pInfo.name}/${cid} read failed: ${(e && e.message) || e}`);
          continue;
        }
        if (!bookings || typeof bookings !== 'object') continue;
        const ids = Object.keys(bookings);
        for (let k = 0; k < ids.length; k++) {
          const bid = ids[k];
          const raw = bookings[bid];
          if (!raw || typeof raw !== 'object') continue;
          report.scanned++;
          report.perTenant[cid].scanned++;
          const status = String(raw.BookingStatus || raw.bookingStatus || raw.status || '').toLowerCase();
          if (status !== 'completed' && status !== 'cancelled' && status !== 'closed' && status !== 'no show' && status !== 'noshow') continue;
          const tripMs = _fixsTripTimestampMs(raw);
          if (!tripMs || tripMs < cutoffMs) continue;
          const rec = pInfo.normalize(raw, cid, bid);
          if (!rec || !rec.Id) continue;
          // Tenant-isolated dedupe (mirrors §FIX-R/sec guard).
          const exists = closedJobStore.some(j =>
            j && j.Id === rec.Id &&
            String(j.companyId || j.CompanyId || '') === String(cid));
          if (exists) continue;
          // Stamp tenant/provenance so the row is traceable.
          rec.BookingStatus            = rec.BookingStatus || 'Completed';
          rec.OfflineSynced            = true;
          rec.CompletedBy              = rec.CompletedBy || 'Reconciler (Firebase)';
          rec._rehydratedFromFirebase  = true;
          rec._rehydratedAt            = new Date(startedAt).toISOString();
          rec._rehydrationSource       = pInfo.name + '/' + cid + '/' + bid;
          closedJobStore.push(rec);
          report.hydrated++;
          report.perPath[pInfo.name]++;
          report.perTenant[cid].hydrated++;
          report.perTenant[cid].ids.push(rec.Id);
          if (verbose) console.log(`[§FIX-S/reconciler] hydrated trip #${rec.Id} cid=${cid} path=${pInfo.name} (status=${rec.BookingStatus}, closedAt=${new Date(tripMs).toISOString()})`);
        }
      }
    }
    if (report.hydrated > 0) {
      saveClosedJobStore();
      if (verbose) console.log(`[§FIX-S/reconciler] ✔ ${report.hydrated} trip(s) rehydrated across ${cids.length} tenant(s) in ${Date.now() - startedAt}ms`);
    } else if (verbose) {
      console.log(`[§FIX-S/reconciler] no gaps — scanned ${report.scanned} bookings across ${cids.length} tenant(s) in ${Date.now() - startedAt}ms`);
    }
    report.durationMs = Date.now() - startedAt;
    _FIXS_LAST_REPORT = report;
    return report;
  } finally {
    _FIXS_RUNNING = false;
  }
}

// Boot run (45s delay so Firebase/network is warm) + periodic every 15 min.
setTimeout(() => {
  reconcileClosedJobsFromFirebase().catch(e =>
    console.warn('[§FIX-S/reconciler] boot run failed:', (e && e.message) || e));
}, 45000);
setInterval(() => {
  reconcileClosedJobsFromFirebase().catch(e =>
    console.warn('[§FIX-S/reconciler] periodic run failed:', (e && e.message) || e));
}, _FIXS_INTERVAL_MS);

// ─── §FIX-H — Enrich closed-job record from allbookings (driver-app truth) ────
// The driver app writes trip-completion data (fare breakdown, distance, addresses,
// payment, timeline, TM/card fields) to allbookings/{cid}/{bookingId} at the end
// of a trip. Our [DriverStatusChanged]→Completed path runs before/around the same
// time, but only knows what the dispatcher seeded into jobStore when the job was
// created — so the closed-job history shows empty fare/distance/payment columns
// (especially for Hail jobs created server-side).
//
// This helper does a fire-and-forget Firebase read of allbookings/{cid}/{jobId},
// then merges any NON-EMPTY values into the closed-job record. It NEVER overwrites
// a populated local value with an empty Firebase value (the HQ-doc warning about
// stray update({field:''}) calls wiping data — we are the reader, not the writer,
// but we apply the same defensive rule).
//
// Safe to call repeatedly; safe if Firebase is unreachable; safe if the node is
// missing. On a successful merge it calls saveClosedJobStore() so the disk file
// reflects the enriched record.
function _enrichClosedJobFromAllbookings(cid, job, attempt) {
  if (!cid || !job || !job.Id) return;
  attempt = attempt || 0;
  // Retry ladder: tries 0,1,2,3 → 5s, 15s, 30s gaps (max 4 attempts total).
  var RETRY_DELAYS_MS = [5000, 15000, 30000];
  function _scheduleRetry() {
    if (attempt >= RETRY_DELAYS_MS.length) return false;
    setTimeout(function() { _enrichClosedJobFromAllbookings(cid, job, attempt + 1); }, RETRY_DELAYS_MS[attempt]);
    return true;
  }
  // Helper: true if value is "useful" to copy in (non-empty, non-zero for numeric).
  function _hasVal(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return !isNaN(v) && v !== 0;
    if (typeof v === 'boolean') return true;
    return true;
  }
  // Recognise hail-time placeholder strings that should be treated as empty
  // so a real resolved address from allbookings can replace them. Examples:
  //   "Hail - -46.39618, 168.35128"
  //   "Hail Pickup (-46.39618, 168.35128)"
  //   "Hail / Street Pickup"
  //   "Street Pickup (no destination)"
  function _isHailPlaceholder(s) {
    if (typeof s !== 'string') return false;
    var t = s.trim();
    if (!t) return false;
    return /^Hail - /i.test(t) ||
           /^Hail Pickup \(/i.test(t) ||
           /^Hail \/ Street Pickup$/i.test(t) ||
           /^Street Pickup \(no destination\)$/i.test(t);
  }
  // Should we replace the existing job field with the new value?
  // YES if local field is empty/zero AND fb value is useful — never wipe local truth.
  // Also YES if local is a known hail placeholder and fb is a real resolved string.
  function _shouldCopy(local, fb, fieldName) {
    if (!_hasVal(fb)) return false;
    if (local == null) return true;
    if (typeof local === 'string' && local.trim() === '') return true;
    if (typeof local === 'number' && (isNaN(local) || local === 0)) return true;
    // Hail-placeholder override: only for the address fields, only when
    // fb has a real string and local is a recognised placeholder.
    if ((fieldName === 'PickAddress' || fieldName === 'DropAddress') &&
        typeof fb === 'string' && fb.trim() !== '' && !_isHailPlaceholder(fb) &&
        _isHailPlaceholder(local)) {
      return true;
    }
    return false;
  }
  // Apply a {jobField: fbValue} dict to `job` via _shouldCopy; returns array of merged field names.
  function _applyMerge(dict) {
    var merged = [];
    Object.keys(dict).forEach(function(jf) {
      if (_shouldCopy(job[jf], dict[jf], jf)) { job[jf] = dict[jf]; merged.push(jf); }
    });
    return merged;
  }
  // Done if the three "must-have" history fields are populated — stops retry early.
  function _isComplete() {
    return _hasVal(job.TotalFare) && _hasVal(job.JobDistance) &&
           (_hasVal(job.PaymentStatus) || _hasVal(job.cashPayment) ||
            _hasVal(job.cardPayment) || _hasVal(job.accountPayment));
  }

  var _tok = null;
  getFirebaseServerToken().then(function(tok) {
    if (!tok) throw new Error('no firebase token');
    _tok = tok;
    // ── Path 1 — allbookings/{cid}/{bookingId}  (driver-app PascalCase truth) ──
    return firebaseDbGet(`allbookings/${cid}/${job.Id}`, tok).catch(function() { return null; });
  }).then(function(fb1) {
    var changed = 0;
    var mergedNames = [];
    if (fb1 && typeof fb1 === 'object') {
      // Diagnostic: log exactly which keys the driver app wrote — gives a clear
      // evidence trail when fields are missing (e.g. for HQ pushback per the doc).
      if (attempt === 0) {
        console.log(`  [§FIX-H/diag] allbookings/${cid}/${job.Id} keys=`,
          Object.keys(fb1).sort().join(','));
      }
      var p1 = {};
      [
        // Addresses + geo
        'PickAddress', 'DropAddress', 'PickLatLng', 'DropLatLng',
        // Fare breakdown
        'TotalFare', 'FareBase', 'FareTime', 'FareDistance', 'FareExtras',
        'FareCurrency', 'DriverCost',
        // Distance / tariff
        'JobDistance', 'TarriffType', 'TarriffId',
        // Passenger
        'ppname', 'AccountId',
        // Payment
        'cashPayment', 'cardPayment', 'accountPayment',
        'Recieve_payment', 'PaymentStatus',
        // Payment method label (read by closed-job PDF/detail view as
        // j.Payment || j.paymentMethod || j.PaymentMethod). Driver app
        // writes these on completion; without them the Payment row is blank.
        'Payment', 'paymentMethod', 'PaymentMethod', 'PaymentType',
        // TM
        'TmSubsidy', 'TmPassengerPays', 'TmPassengerName',
        'TmTripCategory', 'TmVoucherNo',
        // Card
        'CardLastFour', 'CardHolder', 'CardExpiry', 'CardBrand', 'StripePaymentIntentId',
        // Timeline
        'CompletedAt', 'completedAt_ISO', 'ActiveAt', 'JobCompleteTime',
        'newcompelete', 'TotalTime',
      ].forEach(function(f) { if (f in fb1) p1[f] = fb1[f]; });
      var m1 = _applyMerge(p1);
      changed += m1.length;
      mergedNames = mergedNames.concat(m1);
    }
    // ── Path 2 — completedJobs/{cid}/{tripId}  (SA-MasterReport schema fallback)
    // Only fetch if Path 1 didn't fully populate the must-have history fields.
    if (_isComplete() || !_tok) return { changed: changed };
    return firebaseDbGet(`completedJobs/${cid}/${job.Id}`, _tok).catch(function() { return null; })
      .then(function(fb2) {
        if (!fb2 || typeof fb2 !== 'object') return { changed: changed };
        // Map lowercase SA-MasterReport fields → PascalCase history fields.
        var p2 = {
          PickAddress:     fb2.pickupAddress || fb2.pickup,
          DropAddress:     fb2.dropAddress   || fb2.dropoff,
          TotalFare:       fb2.fare,
          JobDistance:     fb2.distanceKm,
          PaymentStatus:   fb2.paymentStatus,
          completedAt_ISO: fb2.completedAt_ISO ||
                           (fb2.completedAt ? new Date(fb2.completedAt).toISOString() : undefined),
          TmSubsidy:       fb2.tmSubsidy,
          TmPassengerPays: fb2.tmPassengerPays,
        };
        // Payment-method → cash/card/account boolean (legacy fields).
        var pm = (fb2.paymentType || fb2.paymentMethod || '').toLowerCase();
        if (pm === 'cash')                 p2.cashPayment    = p2.cashPayment    || true;
        else if (pm === 'card')            p2.cardPayment    = p2.cardPayment    || true;
        else if (pm === 'account')         p2.accountPayment = p2.accountPayment || true;
        else if (pm === 'total_mobility')  p2.cardPayment    = p2.cardPayment    || true;
        var m2 = _applyMerge(p2);
        changed += m2.length;
        mergedNames = mergedNames.concat(m2);
        return { changed: changed, mergedNames: mergedNames };
      });
  }).then(function(res) {
    var changed = (res && res.changed) || 0;
    var names = (res && res.mergedNames) || mergedNames;
    if (changed > 0) {
      saveClosedJobStore();
      console.log(`  [§FIX-H] closedJob #${job.Id} enriched (${changed} field(s) [${names.join(',')}], attempt=${attempt})`);
    }
    if (_isComplete()) return; // success — stop retrying
    if (!_scheduleRetry() && attempt > 0) {
      console.warn(`  [§FIX-H] closedJob #${job.Id} still incomplete after ${attempt + 1} attempts`);
    }
  }).catch(function(e) {
    // Network / auth — silent, but keep retrying within ladder.
    if (!_scheduleRetry()) {
      console.warn(`  [§FIX-H] closedJob #${job.Id} enrichment failed:`, (e && e.message) || e);
    }
  });
}

// ─── §FIX-M — server-side reverse geocoder (Google Maps Geocoding API) ───────
// Fallback used by §FIX-J when neither allbookings nor online/current have a
// resolved hail PickAddress. The driver app sometimes never writes a street
// address (the hail flow only writes the lat/lng placeholder), leaving the
// dispatch console showing "Hail - -46.39, 168.35" forever. We resolve the
// coordinates ourselves here. Results cached by rounded lat/lng (4 dp ≈ 11 m).
const _geocodeCache = new Map(); // "lat,lng" -> address string
const _geocodeInflight = new Map(); // "lat,lng" -> Promise
const GOOGLE_MAPS_GEOCODE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_API_KEY = GOOGLE_MAPS_GEOCODE_KEY;
function _reverseGeocode(lat, lng) {
  const _lat = Number(lat), _lng = Number(lng);
  if (!isFinite(_lat) || !isFinite(_lng)) return Promise.resolve(null);
  const key = _lat.toFixed(4) + ',' + _lng.toFixed(4);
  if (_geocodeCache.has(key)) return Promise.resolve(_geocodeCache.get(key));
  if (_geocodeInflight.has(key)) return _geocodeInflight.get(key);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${_lat},${_lng}&key=${GOOGLE_MAPS_GEOCODE_KEY}`;
  const p = new Promise(function(resolve) {
    const req = https.get(url, function(resp) {
      let buf = '';
      resp.on('data', function(c) { buf += c; });
      resp.on('end', function() {
        try {
          const json = JSON.parse(buf);
          if (json && json.status === 'OK' && Array.isArray(json.results) && json.results.length) {
            const addr = String(json.results[0].formatted_address || '').trim();
            if (addr) {
              if (_geocodeCache.size > 1000) {
                const oldest = _geocodeCache.keys().next().value;
                if (oldest) _geocodeCache.delete(oldest);
              }
              _geocodeCache.set(key, addr);
              console.log(`  [§FIX-M] geocoded ${key} → "${addr}"`);
              return resolve(addr);
            }
          }
          console.warn(`  [§FIX-M] geocode ${key} status=${json && json.status} no results`);
          resolve(null);
        } catch (e) {
          console.warn(`  [§FIX-M] geocode ${key} parse failed:`, e.message);
          resolve(null);
        }
      });
    });
    req.on('error', function(e) {
      console.warn(`  [§FIX-M] geocode ${key} request failed:`, e.message);
      resolve(null);
    });
    req.setTimeout(5000, function() { req.destroy(); resolve(null); });
  }).then(function(v) { _geocodeInflight.delete(key); return v; });
  _geocodeInflight.set(key, p);
  return p;
}

// Forward geocode — resolve registration city/area + country to depot coordinates.
const _forwardGeocodeCache = new Map(); // normalized query -> {lat,lng}
const _forwardGeocodeInflight = new Map();
function _registrationGeoQuery(reg) {
  if (!reg) return '';
  const city = String(reg.area || reg.city || '').trim();
  const country = String(reg.country || 'New Zealand').trim();
  if (!city) return '';
  return country ? `${city}, ${country}` : city;
}
function _cityCenterFromArea(areaRaw) {
  const area = String(areaRaw || '').trim().toLowerCase();
  if (!area) return null;
  const table = [
    { keys: ['invercargill'], lat: -46.4127, lng: 168.3538 },
    { keys: ['auckland'], lat: -36.8485, lng: 174.7633 },
    { keys: ['wellington'], lat: -41.2865, lng: 174.7762 },
    { keys: ['christchurch'], lat: -43.5321, lng: 172.6362 },
    { keys: ['hamilton'], lat: -37.7870, lng: 175.2793 },
    { keys: ['tauranga'], lat: -37.6878, lng: 176.1651 },
    { keys: ['dunedin'], lat: -45.8788, lng: 170.5028 },
    { keys: ['queenstown'], lat: -45.0312, lng: 168.6626 },
  ];
  for (const row of table) {
    if (row.keys.some(k => area.includes(k))) return { lat: row.lat, lng: row.lng };
  }
  return null;
}
function _forwardGeocode(query) {
  const q = String(query || '').trim();
  if (!q || !GOOGLE_MAPS_GEOCODE_KEY) return Promise.resolve(null);
  const key = q.toLowerCase();
  if (_forwardGeocodeCache.has(key)) return Promise.resolve(_forwardGeocodeCache.get(key));
  if (_forwardGeocodeInflight.has(key)) return _forwardGeocodeInflight.get(key);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_GEOCODE_KEY}`;
  const p = new Promise(function(resolve) {
    const req = https.get(url, function(resp) {
      let buf = '';
      resp.on('data', function(c) { buf += c; });
      resp.on('end', function() {
        try {
          const json = JSON.parse(buf);
          if (json && json.status === 'OK' && Array.isArray(json.results) && json.results.length) {
            const loc = json.results[0].geometry && json.results[0].geometry.location;
            const lat = loc && Number(loc.lat);
            const lng = loc && Number(loc.lng);
            if (isFinite(lat) && isFinite(lng)) {
              const out = { lat, lng };
              if (_forwardGeocodeCache.size > 500) {
                const oldest = _forwardGeocodeCache.keys().next().value;
                if (oldest) _forwardGeocodeCache.delete(oldest);
              }
              _forwardGeocodeCache.set(key, out);
              console.log(`  [base-geo] forward geocode "${q}" → ${lat},${lng}`);
              return resolve(out);
            }
          }
          console.warn(`  [base-geo] forward geocode "${q}" status=${json && json.status} no results`);
          resolve(null);
        } catch (e) {
          console.warn(`  [base-geo] forward geocode "${q}" parse failed:`, e.message);
          resolve(null);
        }
      });
    });
    req.on('error', function(e) {
      console.warn(`  [base-geo] forward geocode "${q}" request failed:`, e.message);
      resolve(null);
    });
    req.setTimeout(5000, function() { req.destroy(); resolve(null); });
  }).then(function(v) { _forwardGeocodeInflight.delete(key); return v; });
  _forwardGeocodeInflight.set(key, p);
  return p;
}
async function _stampRegistrationBaseCoords(reg, source) {
  if (!reg || !reg.companyId || _skipBaseGeoForRegistration(reg)) return false;
  if (reg.baseLat != null && reg.baseLng != null && isFinite(Number(reg.baseLat)) && isFinite(Number(reg.baseLng))) {
    return false;
  }
  const query = _registrationGeoQuery(reg);
  if (!query) return false;
  let coords = await _forwardGeocode(query);
  let geoSource = 'geocode';
  if (!coords) {
    coords = _cityCenterFromArea(reg.area || reg.city || '');
    geoSource = coords ? 'city_lookup' : null;
  }
  if (!coords) {
    console.warn(`  [base-geo] ${source} cid=${reg.companyId} could not resolve "${query}"`);
    return false;
  }
  reg.baseLat = coords.lat;
  reg.baseLng = coords.lng;
  reg.baseGeoSource = geoSource;
  saveRegistrations();
  console.log(`  [base-geo] ${source} cid=${reg.companyId} "${query}" → ${coords.lat},${coords.lng} (${geoSource})`);
  return true;
}
async function _healMissingRegistrationBaseCoords(source) {
  const needs = registrationStore.filter(r =>
    r && r.companyId && !_skipBaseGeoForRegistration(r) && _registrationGeoQuery(r) &&
    (r.baseLat == null || r.baseLng == null || !isFinite(Number(r.baseLat)) || !isFinite(Number(r.baseLng)))
  );
  if (!needs.length) return;
  console.log(`[base-geo] ${source} healing ${needs.length} registration(s) missing baseLat/baseLng`);
  for (const reg of needs) {
    try { await _stampRegistrationBaseCoords(reg, source); } catch (e) {
      console.warn(`[base-geo] heal failed cid=${reg.companyId}:`, e && e.message);
    }
  }
}

// ─── §FIX-J — lazy-resolve hail addresses on the active in-memory jobStore ────
// When [ActiveJobsv3] / [JobDetails] sees a hail job whose local PickAddress
// is still "Hail - <lat,lng>" (the placeholder we set at hail-start), kick off
// a fire-and-forget Firebase read of allbookings/{cid}/{bookingId} and copy
// the resolved PickAddress / DropAddress / passenger name into the in-memory
// job. Throttled per-job so polling does not hammer Firebase.
const _hailResolveLast = new Map();   // jobId -> ts of last fetch
const _hailResolveInflight = new Set(); // jobIds currently being fetched
const HAIL_RESOLVE_MIN_INTERVAL_MS = 8000;
function _resolveHailAddressFromFirebase(cid, job) {
  if (!cid || !job || !job.Id) return;
  const jid = String(job.Id);
  if (_hailResolveInflight.has(jid)) return;
  const last = _hailResolveLast.get(jid) || 0;
  if (Date.now() - last < HAIL_RESOLVE_MIN_INTERVAL_MS) return;
  _hailResolveInflight.add(jid);
  _hailResolveLast.set(jid, Date.now());
  // Bound the throttle cache so it can't grow unbounded across long uptimes.
  if (_hailResolveLast.size > 500) {
    const oldestKey = _hailResolveLast.keys().next().value;
    if (oldestKey) _hailResolveLast.delete(oldestKey);
  }
  function _isPlaceholder(s) {
    if (typeof s !== 'string') return true;
    var t = s.trim();
    if (!t) return true;
    return /^Hail - /i.test(t) || /^Hail Pickup \(/i.test(t) ||
           /^Hail \/ Street Pickup$/i.test(t) ||
           /^Street Pickup \(no destination\)$/i.test(t);
  }
  var _tok = null;
  getFirebaseServerToken().then(function(tok) {
    if (!tok) { _hailResolveInflight.delete(jid); return null; }
    _tok = tok;
    // Path 1: allbookings/{cid}/{id}  (truth at completion)
    return firebaseDbGet(`allbookings/${cid}/${job.Id}`, tok).catch(function() { return null; });
  }).then(function(fb1) {
    var resolvedPick = (fb1 && typeof fb1 === 'object' &&
                       typeof fb1.PickAddress === 'string' && !_isPlaceholder(fb1.PickAddress))
                       ? fb1.PickAddress : null;
    var resolvedDrop = (fb1 && typeof fb1 === 'object' &&
                       typeof fb1.DropAddress === 'string' && !_isPlaceholder(fb1.DropAddress))
                       ? fb1.DropAddress : null;
    var resolvedName = (fb1 && typeof fb1 === 'object')
                       ? (fb1.PassengerName || fb1.ppname || fb1.Name || null) : null;
    // Path 2 (fallback for live trips): online/{cid}/{vid}/current  — driver
    // app writes jobpickup/jobdropoff there throughout the trip.
    if (!resolvedPick && _tok && (job.VehicleNo || job.VehicleId)) {
      var vid = String(job.VehicleNo || job.VehicleId);
      return firebaseDbGet(`online/${cid}/${vid}/current`, _tok).catch(function() { return null; })
        .then(function(fb2) {
          if (fb2 && typeof fb2 === 'object') {
            // Guard: only accept jobpickup/jobdropoff if online/current still
            // points to THIS booking. Otherwise the driver may have switched
            // jobs between our poll and the Firebase read.
            var onlineJid = String(fb2.currentJobId || fb2.jobId || fb2.joboffer || '');
            var sameJob = onlineJid && onlineJid === String(job.Id);
            if (sameJob) {
              if (typeof fb2.jobpickup === 'string' && !_isPlaceholder(fb2.jobpickup)) resolvedPick = fb2.jobpickup;
              if (typeof fb2.jobdropoff === 'string' && fb2.jobdropoff.trim() && !_isPlaceholder(fb2.jobdropoff)) resolvedDrop = fb2.jobdropoff;
            } else if (onlineJid) {
              console.log(`  [§FIX-J/diag] job #${job.Id} skip online — currentJobId=${onlineJid} != ${job.Id}`);
            }
          }
          return { resolvedPick: resolvedPick, resolvedDrop: resolvedDrop, resolvedName: resolvedName, source: resolvedPick ? 'online' : 'none' };
        });
    }
    return { resolvedPick: resolvedPick, resolvedDrop: resolvedDrop, resolvedName: resolvedName, source: resolvedPick ? 'allbookings' : 'none' };
  }).then(function(out) {
    // §FIX-M — Path 3: if Firebase yielded nothing, parse the local
    // "Hail - <lat>, <lng>" placeholder and reverse-geocode it ourselves.
    if (out && !out.resolvedPick) {
      var _local = String(job.PickAddress || '').trim();
      var _m = _local.match(/^Hail\s*-\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
      if (!_m && job.PickLatLng) {
        var _p = String(job.PickLatLng).split(',');
        if (_p.length === 2) _m = [null, _p[0].trim(), _p[1].trim()];
      }
      if (_m) {
        return _reverseGeocode(_m[1], _m[2]).then(function(addr) {
          if (addr) { out.resolvedPick = addr; out.source = 'geocode'; }
          return out;
        });
      }
    }
    return out;
  }).then(function(out) {
    _hailResolveInflight.delete(jid);
    if (!out) return;
    var changed = false;
    if (out.resolvedPick && _isPlaceholder(job.PickAddress)) {
      job.PickAddress = out.resolvedPick; changed = true;
    }
    if (out.resolvedDrop && (_isPlaceholder(job.DropAddress) || !job.DropAddress)) {
      job.DropAddress = out.resolvedDrop; changed = true;
    }
    if (out.resolvedName && typeof out.resolvedName === 'string' && out.resolvedName.trim() &&
        !(job.Name && String(job.Name).trim())) {
      job.Name = out.resolvedName; changed = true;
    }
    if (changed) {
      console.log(`  [§FIX-J] job #${job.Id} resolved (src=${out.source}): PickAddress="${job.PickAddress}" DropAddress="${job.DropAddress || ''}" Name="${job.Name || ''}"`);
      // §FIX-M — when we resolved by reverse-geocoding (or pulled from Firebase
      // when allbookings was previously blank), persist the resolved address
      // back to allbookings/{cid}/{id} so the closed-job detail page and SA
      // portal can see it on their next read. Also save closedJobStore if
      // this job has already been moved there.
      if (out.source === 'geocode' || out.source === 'allbookings' || out.source === 'online') {
        if (_tok) {
          var _abP = {};
          if (out.resolvedPick) _abP.PickAddress = job.PickAddress;
          if (out.resolvedDrop) _abP.DropAddress = job.DropAddress;
          if (out.resolvedName) _abP.PassengerName = job.Name;
          firebaseDbPatch(`allbookings/${cid}/${job.Id}`, _abP, _tok).catch(function(e) {
            console.warn(`  [§FIX-J] allbookings patch failed for #${job.Id}:`, (e && e.message) || e);
          });
        }
        // If the job is already in closedJobStore, persist on disk too.
        try {
          if (typeof closedJobStore !== 'undefined' && Array.isArray(closedJobStore)) {
            var _cj = closedJobStore.find(function(j) { return j && j.Id === job.Id; });
            if (_cj) {
              if (out.resolvedPick && _isPlaceholder(_cj.PickAddress)) _cj.PickAddress = job.PickAddress;
              if (out.resolvedDrop && (_isPlaceholder(_cj.DropAddress) || !_cj.DropAddress)) _cj.DropAddress = job.DropAddress;
              if (out.resolvedName && !(_cj.Name && String(_cj.Name).trim())) _cj.Name = job.Name;
              if (typeof saveClosedJobStore === 'function') saveClosedJobStore();
            }
          }
        } catch (_eCj) { /* persist best-effort */ }
      }
    } else {
      console.log(`  [§FIX-J/diag] job #${job.Id} no resolution: src=${out.source} fbPick="${out.resolvedPick || ''}" localPick="${job.PickAddress}"`);
    }
  }).catch(function(e) {
    _hailResolveInflight.delete(jid);
    console.warn(`  [§FIX-J] job #${job.Id} fetch failed:`, (e && e.message) || e);
  });
}

// ─── §FIX-K — completion snapshot from online/{cid}/{vid}/current ─────────────
// At job completion, take a one-shot snapshot of the driver app's heartbeat
// node. The driver app writes the live meter (fare, distance, duration,
// tariff) plus AppVersion/Platform there throughout the trip. For hail trips
// the driver app only writes ~5 keys to allbookings at completion, leaving
// the dispatch history blank — but online/current still has the full data,
// briefly, before _bwClearJobFromFirebase wipes it.
//
// Promise is stashed in _completionSnapshotInflight keyed by jobId so
// _bwClearJobFromFirebase can await it before its PATCH-clear step. This
// closes the race window where the clear strips the node before our read
// arrives.
const _completionSnapshotInflight = new Map(); // `cid:jobId` -> Promise (tenant-safe)
function _snapKey(cid, jobId) { return String(cid) + ':' + String(jobId); }

// Great-circle distance in km between two lat/lng pairs. Straight-line only —
// road distance would need a Directions API call; we accept the under-estimate
// in exchange for zero extra latency / cost. Used by §FIX-N below.
function _haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  function _r(d) { return d * Math.PI / 180; }
  var dLat = _r(lat2 - lat1), dLng = _r(lng2 - lng1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(_r(lat1)) * Math.cos(_r(lat2)) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── §FIX-Q — GPS trail recorder for the closed-job route map ────────────────
// Driver app continuously writes its Lat/Lng to online/{cid}/{vid}/current
// every few seconds. While a job is Active we poll that node every 10 s and
// append samples to an in-memory trail. At completion the trail is encoded as
// a Google polyline and stamped onto the job as RoutePolyline — which the
// existing jdpDrawPolyline frontend helper already renders on the closed-job
// route map. This enables dispute resolution ("what route did the driver
// take, did they stop, did they detour?") without any driver-app change.
//
// Sample dedup rules:
//   - Push only if moved > 8 m from last sample, OR > 60 s elapsed
//   - Cap at 600 samples per job (then decimate every-other)
//   - Auto-stop after 4 hours to prevent leaks if completion is missed
//   - Skip samples where cur.currentJobId no longer matches our jobId
//     (driver app already moved on to the next job)
const _ACTIVE_TRAIL_RECORDERS = new Map(); // jobId -> { cid, vid, started, samples, timer }
const _TRAIL_POLL_MS  = 10000;
const _TRAIL_MAX_AGE  = 4 * 60 * 60 * 1000;
const _TRAIL_MIN_MOVE_M = 8;
const _TRAIL_MIN_TIME_MS = 60000;
const _TRAIL_MAX_SAMPLES = 600;

// Google-encoded polyline (algorithm at developers.google.com/maps/documentation/utilities/polylinealgorithm).
function _encodePolyline(samples) {
  if (!samples || !samples.length) return '';
  function _encVal(v) {
    v = v < 0 ? ~(v << 1) : (v << 1);
    var out = '';
    while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    out += String.fromCharCode(v + 63);
    return out;
  }
  var prevLat = 0, prevLng = 0, result = '';
  for (var i = 0; i < samples.length; i++) {
    var lat = Math.round(samples[i].lat * 1e5);
    var lng = Math.round(samples[i].lng * 1e5);
    result += _encVal(lat - prevLat) + _encVal(lng - prevLng);
    prevLat = lat; prevLng = lng;
  }
  return result;
}

// Polyline length in km — sum of haversine distances between consecutive samples.
function _polylineKm(samples) {
  if (!samples || samples.length < 2) return 0;
  var km = 0;
  for (var i = 1; i < samples.length; i++) {
    km += _haversineKm(samples[i-1].lat, samples[i-1].lng, samples[i].lat, samples[i].lng);
  }
  return Math.round(km * 100) / 100;
}

function _trailPollOnce(rec) {
  if (!rec || rec._stopped) return;
  // Auto-stop after max age.
  if (Date.now() - rec.started > _TRAIL_MAX_AGE) {
    console.warn(`  [§FIX-Q] trail recorder for job #${rec.jobId} exceeded max age — auto-stop`);
    _stopTrailRecorder(rec.cid, rec.jobId);
    return;
  }
  getFirebaseServerToken().then(function(tok) {
    if (!tok || rec._stopped) return;
    return firebaseDbGet(`online/${rec.cid}/${rec.vid}/current`, tok).then(function(cur) {
      if (!cur || rec._stopped) return;
      // Only sample while the driver is still on this exact job.
      if (cur.currentJobId && String(cur.currentJobId) !== String(rec.jobId)) return;
      var lat = Number(cur.Lat || cur.lat || cur.Latitude);
      var lng = Number(cur.Lng || cur.lng || cur.Longitude);
      if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) return;
      var now  = Date.now();
      var last = rec.samples.length ? rec.samples[rec.samples.length - 1] : null;
      if (last) {
        var mMoved = _haversineKm(last.lat, last.lng, lat, lng) * 1000;
        if (mMoved < _TRAIL_MIN_MOVE_M && (now - last.t) < _TRAIL_MIN_TIME_MS) return;
      }
      rec.samples.push({ lat: lat, lng: lng, t: now, s: Number(cur.Speed || cur.VehicleSpeed) || 0 });
      // Decimate if we're approaching the cap — keep every other sample, preserving
      // first/last. Maintains shape while halving memory.
      if (rec.samples.length > _TRAIL_MAX_SAMPLES) {
        var first = rec.samples[0];
        var lastN = rec.samples[rec.samples.length - 1];
        var middle = rec.samples.slice(1, -1).filter(function(_, i) { return i % 2 === 0; });
        rec.samples = [first].concat(middle, [lastN]);
      }
    });
  }).catch(function(e) { /* swallow — next poll will retry */ });
}

// Recorder Map keys are `cid:jobId` so two tenants with colliding job IDs
// cannot stomp each other's trails (architect §FIX-Q review item #2).
function _trailKey(cid, jobId) { return String(cid) + ':' + String(jobId); }

function _startTrailRecorder(cid, vid, jobId) {
  if (!cid || !vid || !jobId) return;
  var key = _trailKey(cid, jobId);
  if (_ACTIVE_TRAIL_RECORDERS.has(key)) return; // already recording
  var rec = {
    cid: String(cid), vid: String(vid), jobId: String(jobId), key: key,
    started: Date.now(), samples: [], _stopped: false,
    timer: null
  };
  rec.timer = setInterval(function() { _trailPollOnce(rec); }, _TRAIL_POLL_MS);
  _ACTIVE_TRAIL_RECORDERS.set(key, rec);
  // First poll immediately so we capture pickup-area location, not just dropoff.
  _trailPollOnce(rec);
  console.log(`  [§FIX-Q] trail recorder started for job #${jobId} (cid=${cid} vid=${vid})`);
}

function _stopTrailRecorder(cid, jobId) {
  if (!cid || !jobId) return null;
  var key = _trailKey(cid, jobId);
  var rec = _ACTIVE_TRAIL_RECORDERS.get(key);
  if (!rec) return null;
  rec._stopped = true;
  if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
  _ACTIVE_TRAIL_RECORDERS.delete(key);
  console.log(`  [§FIX-Q] trail recorder stopped for job #${jobId} (${rec.samples.length} sample(s))`);
  return rec.samples;
}

// Always-runs trail finalizer. Runs as its own promise INDEPENDENT of the
// Firebase snapshot capture, so a missing token or absent online/current
// node never strands an in-memory trail (architect §FIX-Q review item #1).
// Stamps RoutePolyline + trail-derived distance + trail timestamps, saves
// the closed-job store, and best-effort mirrors to allbookings.
function _finalizeTrailIntoJob(cid, jid, job) {
  if (!cid || !jid || !job) return Promise.resolve(null);
  var samples;
  try { samples = _stopTrailRecorder(cid, jid); }
  catch (e) { console.warn(`  [§FIX-Q] stop failed for job #${jid}:`, (e && e.message) || e); return Promise.resolve(null); }
  if (!samples || samples.length < 2) return Promise.resolve(null);
  var stamped = [];
  try {
    var poly = _encodePolyline(samples);
    if (poly) { job.RoutePolyline = poly; stamped.push('RoutePolyline'); }
    var km = _polylineKm(samples);
    if (km > 0) {
      var prev = Number(job.JobDistance) || 0;
      // Trail-derived km is real road-following haversine sum — override the
      // §FIX-N straight-line estimate unless trail is degenerate (< 80%).
      if (km > prev * 0.8) {
        job.JobDistance = km; stamped.push('JobDistance');
        var tar = TARIFF_STORE[0];
        if (tar && Number(tar.DistanceRate) > 0) {
          job.FareDistance = Math.round(km * Number(tar.DistanceRate) * 100) / 100;
          stamped.push('FareDistance');
        }
      }
    }
    job.GpsTrailStart   = new Date(samples[0].t).toISOString();
    job.GpsTrailEnd     = new Date(samples[samples.length - 1].t).toISOString();
    job.GpsTrailSamples = samples.length;
    stamped.push('GpsTrailStart', 'GpsTrailEnd', 'GpsTrailSamples');
    saveClosedJobStore();
    console.log(`  [§FIX-Q] job #${jid} trail finalized: ${samples.length} samples, ${km} km`);
  } catch (e) {
    console.warn(`  [§FIX-Q] stamp failed for job #${jid}:`, (e && e.message) || e);
    return Promise.resolve(null);
  }
  // Best-effort mirror to allbookings so SA portal & re-queries see the route.
  return getFirebaseServerToken().then(function(tok) {
    if (!tok) return null;
    var patch = {};
    stamped.forEach(function(f) { if (job[f] !== undefined) patch[f] = job[f]; });
    return firebaseDbPatch(`allbookings/${cid}/${jid}`, patch, tok)
      .then(function() { console.log(`  [§FIX-Q] job #${jid} trail mirrored to allbookings (${stamped.length} field(s))`); })
      .catch(function(e) { console.warn(`  [§FIX-Q] allbookings patch failed for job #${jid}:`, (e && e.message) || e); });
  }).catch(function() { /* swallow — non-fatal */ });
}
// ─── end §FIX-Q ───────────────────────────────────────────────────────────────

function _captureDriverAppVersion(cid, vid, job) {
  if (!cid || !vid || !job || !job.Id) return Promise.resolve();
  const jid = String(job.Id);
  // Fields driver app writes to online/{cid}/{vid}/current. We probe multiple
  // casings because the contract has drifted over OTA versions.
  function _pickStr() { for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i]; if (typeof v === 'string' && v.trim() !== '') return v; } return ''; }
  function _pickNum() { for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i]; var n = (v == null || v === '') ? NaN : Number(v);
    if (!isNaN(n) && n !== 0) return n; } return null; }
  function _hasLocal(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return !isNaN(v) && v !== 0;
    return true;
  }
  // §FIX-Q review item #3 — real inflight dedup at entry. If a completion
  // capture is already running for this jobId, return the same promise so
  // a second caller sees the same result and we don't double-stamp.
  const _sKey = _snapKey(cid, jid);
  if (_completionSnapshotInflight.has(_sKey)) {
    return _completionSnapshotInflight.get(_sKey);
  }

  // §FIX-Q — kick off trail finalize IN PARALLEL. Independent of the
  // online/current snapshot below, so a missing token / missing node
  // never strands the in-memory trail samples.
  const _trailP = _finalizeTrailIntoJob(cid, jid, job);

  const _snapP = getFirebaseServerToken().then(function(tok) {
    if (!tok) return null;
    return firebaseDbGet(`online/${cid}/${vid}/current`, tok).then(function(cur) {
      if (!cur || typeof cur !== 'object') {
        console.log(`  [§FIX-K/diag] job #${jid} no online/${cid}/${vid}/current node`);
        return null;
      }
      // Diagnostic: log which keys are available so future gaps are visible.
      console.log(`  [§FIX-K/diag] job #${jid} online/current keys=`,
        Object.keys(cur).sort().join(','));
      // App version / platform
      var ver = _pickStr(cur.AppVersion, cur.appVersion, cur.appversion);
      var bld = _pickStr(cur.AppBuild,   cur.appBuild,   cur.appbuild);
      var plt = _pickStr(cur.Platform,   cur.platform);
      // Fare breakdown
      var totalFare = _pickNum(cur.TotalFare, cur.totalFare, cur.meterFare, cur.fare, cur.Fare, cur.FinalFare, cur.finalFare);
      var fareBase  = _pickNum(cur.FareBase, cur.fareBase, cur.baseFare,    cur.BaseFare);
      var fareDist  = _pickNum(cur.FareDistance, cur.fareDistance);
      var fareTime  = _pickNum(cur.FareTime, cur.fareTime);
      var fareExtra = _pickNum(cur.FareExtras, cur.fareExtras);
      var driverCst = _pickNum(cur.DriverCost, cur.driverCost);
      // Distance / duration
      var distKm    = _pickNum(cur.JobDistance, cur.jobDistance, cur.distanceKm, cur.distance, cur.Distance);
      var totalMins = _pickNum(cur.TotalTime, cur.totalTime, cur.JobMins, cur.jobMins, cur.duration, cur.Duration);
      var waitMins  = _pickNum(cur.WaitingTime, cur.waitingTime);
      var waitCost  = _pickNum(cur.WaitingCost, cur.waitingCost);
      // Tariff
      var tariffNm  = _pickStr(cur.TarriffType, cur.tarriffname, cur.TariffName, cur.tariffName);
      // Payment
      var payMethod = _pickStr(cur.paymentMethod, cur.PaymentMethod, cur.paymentType, cur.PaymentType);

      var stamped = [];
      function _stamp(field, val) {
        if (val == null) return;
        if (typeof val === 'string' && !val.trim()) return;
        if (typeof val === 'number' && (isNaN(val) || val === 0)) return;
        if (_hasLocal(job[field])) return; // never overwrite local truth
        job[field] = val; stamped.push(field);
      }
      if (ver) { _stamp('DriverAppVersion', String(ver)); }
      if (bld) { _stamp('DriverAppBuild', String(bld)); }
      if (plt) { _stamp('DriverAppPlatform', String(plt)); }
      _stamp('TotalFare', totalFare);
      _stamp('FareBase', fareBase);
      _stamp('FareDistance', fareDist);
      _stamp('FareTime', fareTime);
      _stamp('FareExtras', fareExtra);
      _stamp('DriverCost', driverCst);
      _stamp('JobDistance', distKm);
      _stamp('TotalTime', totalMins);
      if (totalMins != null && !_hasLocal(job.JobMins)) { job.JobMins = totalMins; stamped.push('JobMins'); }
      _stamp('WaitingTime', waitMins);
      _stamp('WaitingCost', waitCost);
      _stamp('TarriffType', tariffNm);
      // Payment label — only fill if local empty (cash default from §108d still wins until driver app says otherwise).
      if (payMethod && !_hasLocal(job.Payment) && !_hasLocal(job.PaymentType)) {
        var _pmLow = String(payMethod).toLowerCase();
        if (!_hasLocal(job.paymentMethod) || job.paymentMethod === 'cash') {
          job.paymentMethod = _pmLow; stamped.push('paymentMethod');
          job.PaymentMethod = _pmLow; stamped.push('PaymentMethod');
          // Legacy boolean flags
          if (_pmLow === 'cash')           { job.cashPayment    = true; stamped.push('cashPayment'); }
          else if (_pmLow === 'card')      { job.cardPayment    = true; stamped.push('cardPayment'); }
          else if (_pmLow === 'account')   { job.accountPayment = true; stamped.push('accountPayment'); }
        }
      }
      // ─── §FIX-N — compute hail-trip estimates from what we DO have ──────
      // The driver app's hail flow transmits no fare/distance/duration/tariff
      // anywhere (verified empirically — online/current keys are GPS+presence
      // only and syncOfflineTrip is never called for hail). Without this the
      // closed-job detail page is blank. We derive what we can:
      //   - JobMins/TotalTime: AcceptedAt → JobCompleteTime delta (accurate)
      //   - TarriffType: from BookingSource for hail (accurate)
      //   - DropLatLng: driver's final GPS already in `cur` (accurate)
      //   - DropAddress: reverse-geocode of drop coords (accurate)
      //   - JobDistance: haversine pickup→dropoff (straight-line, NOT road)
      //   - TotalFare/FareBase/FareDistance: default tariff × distance (est.)
      // _stamp() above already refuses to overwrite local truth, so if a
      // later syncOfflineTrip ever arrives with real meter values they win.
      // FareEstimated:true marks records that contain derived fare.
      var _isHail = job.BookingSource === 'Hail' || job.booking_type === 'Hail';
      if (_isHail) {
        // 1. Duration from timestamps. Derive JobMins, TotalTime AND JobDuration
        // independently — any one of them missing triggers a compute, so a
        // record that already has JobMins+TotalTime but no JobDuration still
        // gets backfilled correctly.
        if (!_hasLocal(job.JobMins) || !_hasLocal(job.TotalTime) || !_hasLocal(job.JobDuration)) {
          var _start = new Date(job.ActiveAt || job.PickingAt || job.AcceptedAt || job.OfferedAt || 0).getTime();
          var _end   = new Date(job.JobCompleteTime || job.completedAtMs || Date.now()).getTime();
          if (_start > 0 && _end > _start) {
            var _durMs = _end - _start;
            var _mins  = Math.round(_durMs / 60000 * 100) / 100;
            if (!_hasLocal(job.JobMins))     { job.JobMins     = _mins; stamped.push('JobMins'); }
            if (!_hasLocal(job.JobDuration)) { job.JobDuration = _mins; stamped.push('JobDuration'); }
            if (!_hasLocal(job.TotalTime))   {
              var _mm = Math.floor(_durMs / 60000);
              var _ss = Math.floor((_durMs % 60000) / 1000);
              job.TotalTime = String(_mm).padStart(2, '0') + ':' + String(_ss).padStart(2, '0');
              stamped.push('TotalTime');
            }
          }
        }
        // 2. TarriffType default for hail
        if (!_hasLocal(job.TarriffType)) { job.TarriffType = 'Hail'; stamped.push('TarriffType'); }
        // 3. DropLatLng from driver's final GPS captured in `cur`
        if (!_hasLocal(job.DropLatLng) || job.DropLatLng === '0,0') {
          var _dLat = Number(cur.Lat || cur.lat || cur.Latitude);
          var _dLng = Number(cur.Lng || cur.lng || cur.Longitude);
          if (isFinite(_dLat) && isFinite(_dLng) && _dLat !== 0 && _dLng !== 0) {
            job.DropLatLng = _dLat + ',' + _dLng; stamped.push('DropLatLng');
          }
        }
        // 4. JobDistance via haversine pickup→dropoff
        if (!_hasLocal(job.JobDistance) && job.PickLatLng && job.DropLatLng) {
          var _pp = String(job.PickLatLng).split(',').map(Number);
          var _dp = String(job.DropLatLng).split(',').map(Number);
          if (_pp.length === 2 && _dp.length === 2 &&
              _pp.every(isFinite) && _dp.every(isFinite) &&
              !(_pp[0] === 0 && _pp[1] === 0) &&
              !(_dp[0] === 0 && _dp[1] === 0)) {
            var _km = _haversineKm(_pp[0], _pp[1], _dp[0], _dp[1]);
            job.JobDistance = Math.round(_km * 100) / 100;
            stamped.push('JobDistance');
          }
        }
        // 5. Fare from default tariff
        if (!_hasLocal(job.TotalFare)) {
          var _tar = (typeof TARIFF_STORE !== 'undefined' && TARIFF_STORE && TARIFF_STORE[0]) || null;
          if (_tar && _hasLocal(_tar.StartPrice)) {
            var _sp   = Number(_tar.StartPrice) || 0;
            var _dr   = Number(_tar.DistanceRate) || 0;
            var _dist = Number(job.JobDistance) || 0;
            var _fb   = _sp;
            var _fd   = _dr * _dist;
            var _tot  = _fb + _fd;
            var _min  = Number(_tar.MinimumFare) || 0;
            if (_min && _tot < _min) _tot = _min;
            _tot = Math.round(_tot * 100) / 100;
            if (!_hasLocal(job.FareBase))     { job.FareBase     = Math.round(_fb * 100) / 100; stamped.push('FareBase'); }
            // Always stamp FareDistance + FareTime + WaitingCost (including 0) so the
            // closed-job UI can render the complete breakdown grid. Driver app's hail
            // flow doesn't track waiting time, so 0 is the honest value.
            if (job.FareDistance == null) { job.FareDistance = Math.round(_fd * 100) / 100; stamped.push('FareDistance'); }
            if (job.FareTime    == null)  { job.FareTime     = 0; stamped.push('FareTime'); }
            if (job.WaitingCost == null)  { job.WaitingCost  = 0; stamped.push('WaitingCost'); }
            if (job.WaitingTime == null)  { job.WaitingTime  = 0; stamped.push('WaitingTime'); }
            job.TotalFare     = _tot; stamped.push('TotalFare');
            if (!_hasLocal(job.Fare))         { job.Fare         = _tot; stamped.push('Fare'); }
            if (!_hasLocal(job.FareCurrency)) { job.FareCurrency = _tar.CurrencyName || 'NZD'; stamped.push('FareCurrency'); }
            if (!_hasLocal(job.DriverCost))   { job.DriverCost   = _tot; stamped.push('DriverCost'); }
            job.FareEstimated = true; stamped.push('FareEstimated');
          }
        }
      }
      // ─── end §FIX-N ──────────────────────────────────────────────────────
      // (GPS trail finalization moved out to _finalizeTrailIntoJob — it now
      //  runs in parallel with this snapshot capture so a missing online/
      //  current node never strands an in-memory trail.)

      if (!stamped.length) {
        console.log(`  [§FIX-K/diag] job #${jid} snapshot found no useful new fields`);
        return null;
      }
      saveClosedJobStore();

      // §FIX-N — reverse-geocode the drop coords if no human-readable
      // DropAddress yet. Runs after the inline stamping so it can see the
      // freshly-set DropLatLng. Returns a promise chained before the patch.
      var _geoP = Promise.resolve();
      if (job.DropLatLng &&
          (!_hasLocal(job.DropAddress) || /no destination/i.test(String(job.DropAddress)))) {
        var _dpg = String(job.DropLatLng).split(',').map(Number);
        if (_dpg.length === 2 && _dpg.every(isFinite) &&
            !(_dpg[0] === 0 && _dpg[1] === 0) &&
            typeof _reverseGeocode === 'function') {
          _geoP = _reverseGeocode(_dpg[0], _dpg[1]).then(function(addr) {
            if (addr) {
              job.DropAddress = addr;
              stamped.push('DropAddress');
              saveClosedJobStore();
            }
          }).catch(function() { /* non-fatal */ });
        }
      }

      return _geoP.then(function() {
        // Mirror every stamped field into allbookings so SA portal & re-queries see the data.
        var _abPatch = {};
        stamped.forEach(function(f) {
          if (job[f] !== undefined) _abPatch[f] = job[f];
        });
        return firebaseDbPatch(`allbookings/${cid}/${jid}`, _abPatch, tok).then(function() {
          console.log(`  [§FIX-K+N] job #${jid} snapshot+estimates stamped (${stamped.length} field(s) [${stamped.join(',')}])`);
        }).catch(function(e) {
          console.warn(`  [§FIX-K+N] job #${jid} allbookings patch failed:`, (e && e.message) || e);
        });
      });
    });
  }).catch(function(e) {
    console.warn(`  [§FIX-K] job #${jid} capture failed:`, (e && e.message) || e);
  });
  // Cleanup waits on BOTH the snapshot capture AND the parallel trail
  // finalize, so callers awaiting _completionSnapshotInflight see the
  // route polyline fully stamped before they read the closed-job record.
  const p = Promise.all([_snapP, _trailP]).then(function() {
    _completionSnapshotInflight.delete(_sKey);
  });
  _completionSnapshotInflight.set(_sKey, p);
  return p;
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
// Primary source: registration record baseLat/baseLng (set at approval from area+city geocode).
// Fallback: city-name lookup from registration area, then Auckland.
function _companyBaseLocation(companyId) {
  const reg = registrationStore.find(r => String(r.companyId) === String(companyId));
  if (reg && reg.baseLat != null && reg.baseLng != null) {
    const lat = Number(reg.baseLat), lng = Number(reg.baseLng);
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }
  if (reg) {
    const fromArea = _cityCenterFromArea(reg.area || reg.city || '');
    if (fromArea) return fromArea;
  }
  return { lat: -36.8485, lng: 174.7633 }; // Auckland when no registration geo data
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
  // Skip empty-zone heartbeats — driver app sometimes omits zonename, and
  // saving "" would overwrite a previously-known-good home zone with garbage.
  // Without this guard the right-side zone queue collapses every Hail driver
  // into the no-zone bucket on every status change.
  if (!zd.zonename) return;
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

function _isCoordLikeAddress(s) {
  if (typeof s !== 'string') return true;
  const t = s.trim();
  if (!t) return true;
  return /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(t) ||
         /^Hail\s*-\s*-?\d/i.test(t) ||
         /^Hail Pickup\s*\(/i.test(t);
}

function _formatActivePickAddress(j) {
  const isHail = j.BookingSource === 'Hail' || j.booking_type === 'Hail';
  let pickAddr = j.PickAddress || '';
  if (isHail && pickAddr.startsWith('Hail - ')) {
    return 'Hail / Street Pickup';
  }
  if (_isCoordLikeAddress(pickAddr)) {
    return isHail ? 'Hail / Street Pickup' : (pickAddr || '—');
  }
  return pickAddr;
}

function _lookupZoneDriverForJob(j) {
  const _validId = v => v && String(v) !== '0' && parseInt(v) !== 0;
  return ZONE_DRIVERS.find(d =>
    (_validId(j.DriverId)  && (String(d.driverid) === String(j.DriverId)  || String(d.VehicleId) === String(j.DriverId)))  ||
    (_validId(j.VehicleId) && (String(d.driverid) === String(j.VehicleId) || String(d.VehicleId) === String(j.VehicleId))) ||
    (j.UserFName && d.drivername && d.drivername.toLowerCase() === (j.UserFName || '').toLowerCase())
  ) || null;
}

function _calcTripDurationMins(j) {
  const startMs = j.ActiveAt ? new Date(_toDateStr(j.ActiveAt)).getTime()
                : j.AcceptedAt ? new Date(_toDateStr(j.AcceptedAt)).getTime()
                : j.createdAt || 0;
  if (!startMs || isNaN(startMs)) return null;
  return Math.max(0, Math.round((Date.now() - startMs) / 60000));
}

function _driverJobsTodayCount(driverId, vehicleId, companyId) {
  if (!driverId && !vehicleId) return 0;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
  const TERMINAL = new Set(['Dispatched', 'Done', 'Cancel', 'Cancelled', 'Closed', 'Completed', 'No Show', 'NoShow', 'Reject']);
  const did = String(driverId || '');
  const vid = String(vehicleId || '');
  return [...companyJobs(closedJobStore), ...companyJobs(jobStore).filter(j => TERMINAL.has(j.BookingStatus))]
    .filter(j => {
      if (companyId && j.companyId && String(j.companyId) !== String(companyId)) return false;
      const ds = _toDateStr(j.JobCompleteTime || j.BookingDateTime || '').substring(0, 10);
      if (ds !== today) return false;
      return (did && (String(j.DriverId) === did || String(j.VehicleId) === did)) ||
             (vid && (String(j.DriverId) === vid || String(j.VehicleId) === vid));
    }).length;
}

// Enrich an Active/Picking job for the Active tab and zone-board job cards.
function _enrichActiveJob(j, companyId) {
  const isHail = j.BookingSource === 'Hail' || j.booking_type === 'Hail';
  if (isHail && companyId) _resolveHailAddressFromFirebase(companyId, j);
  const zdN = _lookupZoneDriverForJob(j);
  const drivername = (j.drivername || (zdN && zdN.drivername) ||
    ((j.UserFName || '') + ' ' + (j.UserLName || '')).trim() || '').trim();
  let passengername = j.passengername || j.PassengerName || j.Name || '';
  if (passengername === 'Street Pickup') passengername = '';
  const fare = j.TotalFare || j.totalFare || j.EstimatedFare || j.RideCost || j.Fare || j.CustomeRate || '';
  const tripMins = _calcTripDurationMins(j);
  let pickAddr = _formatActivePickAddress(j);
  if (isHail && j.PickAddress && !_isCoordLikeAddress(j.PickAddress)) {
    pickAddr = j.PickAddress;
  }
  let dropAddr = j.DropAddress || '';
  if (_isCoordLikeAddress(dropAddr)) dropAddr = '';
  return {
    ...j,
    BookingId: j.Id,
    PickAddress: pickAddr,
    DropAddress: dropAddr,
    passengername,
    PassengerName: passengername,
    drivername,
    VehicleNo: j.VehicleNo || j.CallSign || (zdN ? zdN.vehiclenumber : '') || String(j.VehicleId || ''),
    TotalFare: fare,
    fare,
    TripMins: tripMins,
    JobMins: calcJobMins(j),
  };
}

// Build full job-list DataSelector response
function buildJobListResponse(jobs, companyId) {
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
    dt6: activeJobs.map(j => _enrichActiveJob(j, companyId || '')),
    activeJobsList: activeJobs.map(j => _enrichActiveJob(j, companyId || '')),
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

function _normTaxiVehicleId(v) {
  return String(v || '').trim().toUpperCase();
}

/** Canonical vehicle list from driver profile — assignedVehicles first, legacy allocatedVehicles read-only. */
function _driverAssignedVehicleList(profile) {
  const out = [];
  if (!profile || typeof profile !== 'object') return out;
  const add = (v) => {
    const n = _normTaxiVehicleId(v);
    if (n && !out.includes(n)) out.push(n);
  };
  if (Array.isArray(profile.assignedVehicles)) {
    profile.assignedVehicles.forEach(add);
  }
  const legacy = profile.allocatedVehicles;
  if (!out.length && legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    Object.keys(legacy).forEach(k => { if (legacy[k]) add(k); });
  }
  if (!out.length && profile.allocatedTaxi) add(profile.allocatedTaxi);
  if (!out.length && profile.vehicleId) add(profile.vehicleId);
  return out;
}

function _respondDataManagerProxyError(res, action, reason, detail) {
  const status = reason === 'session_expired' ? 401 : 502;
  const message = reason === 'session_expired'
    ? 'Production dispatch session expired. Please log out and sign in again.'
    : 'Production dispatch backend unavailable. Please try again shortly.';
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    ok: false,
    error: reason,
    message,
    action: action || '',
    detail: detail || '',
  }));
  console.log(`${status}: PROXY FAIL [${action}] — ${reason}${detail ? ': ' + detail : ''}`);
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

function injectAspxEnv(html) {
  return html.replace(/__BW_GOOGLE_MAPS_API_KEY__/g, GOOGLE_MAPS_API_KEY);
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
  let urlPath = normalizeUrlPath(req.url.split('?')[0]);

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

  // Public client config for React dispatch UI
  if (urlPath === '/api/config/client' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      firebase: FIREBASE_CONFIG,
      mapsApiKey: GOOGLE_MAPS_API_KEY || '',
    }));
    return;
  }

  if (urlPath === '/') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const companyId = getSessionCompanyId(req);
      if (companyId && (await gateDispatchAccess(req, res))) {
        res.writeHead(302, { Location: '/dispatch' });
        res.end();
        return;
      }
      res.writeHead(302, { Location: '/login' });
      res.end();
      return;
    }
  }

  // Legacy ASPX — still available at /Default.aspx for transition
  if (urlPath === '/Default.aspx' && req.method === 'GET') {
    const companyId = getSessionCompanyId(req);
    if (!companyId) {
      res.writeHead(302, { Location: '/DispatcherLogin.aspx' });
      res.end();
      return;
    }
    // Also check the company's current status — deactivated/deleted companies must not load the console
    const _gateReg = registrationStore.find(r => r.companyId === companyId);
    const _gateAccess = _gateReg ? await resolveCompanyAccessAsync(_gateReg) : { loginBlocked: true };
    if (!_gateReg || _gateAccess.loginBlocked) {
      console.log(`[gate] Default.aspx blocked: companyId=${companyId} status=${_gateReg ? _gateReg.status : 'not found'}`);
      const reason = _gateAccess.blockMessage === SUBSCRIPTION_EXPIRED_MSG ? 'subscription_expired' : 'account_inactive';
      res.writeHead(302, {
        Location: `/DispatcherLogin.aspx?reason=${reason}`,
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
    const distIco = path.join(DIST_DIR, 'favicon.ico');
    if (fs.existsSync(distIco)) {
      serveDistAsset(res, '/favicon.ico');
      return;
    }
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
        void _stampRegistrationBaseCoords(reg, 'approve');
        void syncCompanySettingsBilling(companyId, {
          type: reg.plan || 'free_trial',
          name: reg.planLabel || 'Free Trial',
          status: 'trial',
          trialEnd: reg.trialEnd,
        }, {
          status: 'trial',
          gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
          extensionDays: 0,
        });
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
        reg.status      = 'active';
        reg.graceEnd    = null;
        reg.activatedAt = Date.now();
        saveRegistrations();
        void syncCompanySettingsBilling(reg.companyId, { status: 'active', trialEnd: null }, { status: 'active' });
        console.log(`[admin] activated account ${regId} (${reg.email})`);
        jsonReply(res, { ok: true, message: 'Account activated.' });
        return;
      }

      // POST /admin/registrations/:id/deactivate
      if (action === 'deactivate' && req.method === 'POST') {
        reg.status        = 'deactivated';
        reg.deactivatedAt = Date.now();
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

      // POST /admin/registrations/:id/set-plan  body: { plan, planLabel?, planPrice? }
      // Switches a tenant onto a paid plan and clears trial/grace state in one call.
      // The dispatch-console banner only checks `status`, so promoting plan alone is
      // not enough — this also flips status to 'active' and nulls trialEnd/graceEnd.
      if (action === 'set-plan' && req.method === 'POST') {
        let _spBody = '';
        req.on('data', c => _spBody += c);
        req.on('end', () => {
          let _spPayload = {};
          try { _spPayload = JSON.parse(_spBody || '{}'); } catch (_) {}
          const _newPlan = String(_spPayload.plan || '').trim();
          if (!_newPlan) {
            jsonReply(res, { error: 'plan is required (e.g. "pro", "starter", "premium")' });
            return;
          }
          // Pull defaults from PLAN_CONFIG if it knows this plan; otherwise use payload.
          const _cfg = (typeof PLAN_CONFIG !== 'undefined' && PLAN_CONFIG[_newPlan]) || null;
          reg.plan       = _newPlan;
          reg.planLabel  = _spPayload.planLabel || (_cfg && _cfg.label)        || _newPlan;
          reg.planPrice  = (_spPayload.planPrice != null) ? Number(_spPayload.planPrice)
                          : (_cfg ? _cfg.priceMonthly : reg.planPrice || 0);
          reg.status      = 'active';
          reg.trialEnd    = null;
          reg.graceEnd    = null;
          reg.trialDays   = 0;
          reg.activatedAt = Date.now();
          saveRegistrations();
          void syncCompanySettingsBilling(reg.companyId, {
            type: reg.plan,
            name: reg.planLabel,
            status: 'active',
            trialEnd: null,
            rate: reg.planPrice || 0,
          }, { status: 'active', extensionDays: 0 });
          console.log(`[admin] set-plan ${regId} (${reg.email}) → plan=${reg.plan} status=active`);
          jsonReply(res, { ok: true, message: `Plan set to ${reg.planLabel}, account active.`,
                            plan: reg.plan, planLabel: reg.planLabel, planPrice: reg.planPrice, status: reg.status });
        });
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
        // Remove the Firebase mirror so the Super Admin portal stops showing it
        deleteRegistrationFromFirebase(regId);
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

    // POST /admin/reconcileClosedJobs — manually trigger §FIX-S reconciler
    // Used by ops/HQ to force-rehydrate any trips missing from closedJobStore
    // (e.g. after a confirmed silent-window incident). Idempotent.
    // Sits under the /admin/ prefix gate above so X-Admin-Key is enforced.
    if (urlPath === '/admin/reconcileClosedJobs' && req.method === 'POST') {
      try {
        const _rcReport = await reconcileClosedJobsFromFirebase({ verbose: true });
        jsonReply(res, { ok: true, report: _rcReport, last: _FIXS_LAST_REPORT });
      } catch (e) {
        jsonReply(res, { ok: false, error: (e && e.message) || String(e) });
      }
      return;
    }

    // POST /admin/repairBooking — sync Firebase pending+allbookings from jobStore, or force No One
    // body: { bookingId, action?: 'sync'|'no_one' }
    if (urlPath === '/admin/repairBooking' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const parsed = body ? JSON.parse(body) : {};
        const report = await repairBookingFirebaseSync({
          bookingId: parsed.bookingId,
          companyId: parsed.companyId,
          action: parsed.action || 'sync',
          source: '/admin/repairBooking',
        });
        jsonReply(res, report);
      } catch (e) {
        jsonReply(res, { ok: false, error: (e && e.message) || String(e) });
      }
      return;
    }

    // GET  /admin/stuck-active?cid=620611&olderThanHours=4
    // POST /admin/stuck-active/clear  body: {bookingId, companyId, reason?}
    //
    // §STUCK-ACTIVE (May 2026, pre driver-app 22c cutover Mon 25 May)
    // Lists in-flight bookings (Active / Picking / OnTrip) that have been
    // sitting too long with no completion — the "ghost Active" trips that
    // the new driver app build will silently ignore if dispatch tries to
    // re-broadcast. Dispatch HQ should clear these manually before cutover
    // so the Active list is clean when the OTA ships.
    //
    // The 22c driver app marks completed trips locally and ignores re-offers
    // of the same bookingId — but pre-OTA stuck trips in HQ won't auto-clean.
    // This endpoint is the one-time sweeper.
    if (urlPath === '/admin/stuck-active' && req.method === 'GET') {
      try {
        const _saQs    = new URL('http://x' + req.url).searchParams;
        const _saCid   = (_saQs.get('cid') || '').trim();
        const _saHours = Math.max(0.5, parseFloat(_saQs.get('olderThanHours') || '4'));
        const _saCutoffMs = Date.now() - (_saHours * 3600 * 1000);
        const _saStuckStatuses = new Set(['Active','Picking','OnTrip']);
        const _saAgeMs = (j) => {
          const t1 = j.DriverAcceptedAt ? new Date(j.DriverAcceptedAt).getTime() : 0;
          const t2 = j.BookingDateTime  ? new Date(_toDateStr(j.BookingDateTime)).getTime() : 0;
          return t1 || t2 || 0;
        };
        const _saList = jobStore
          .filter(j => j && _saStuckStatuses.has(j.BookingStatus))
          .filter(j => !_saCid || String(j.companyId) === _saCid)
          .map(j => ({
            bookingId:    j.Id,
            status:       j.BookingStatus,
            companyId:    j.companyId || '',
            driverId:     j.DriverId  || 0,
            vehicleId:    j.VehicleId || 0,
            driverName:   j.DriverName || j.drivername || '',
            callSign:     j.CallSign  || j.VehicleNo || '',
            passenger:    j.JobName   || j.PassengerName || '',
            phone:        j.JobphoneNo || j.PassengerPhone || '',
            pickup:       j.jobpickup  || j.PickupAddress  || '',
            dropoff:      j.jobdropoff || j.DropAddress    || '',
            bookingTime:  j.BookingDateTime || '',
            acceptedAt:   j.DriverAcceptedAt || '',
            ageHours:     +(((Date.now() - _saAgeMs(j)) / 3600000) || 0).toFixed(2),
            ageMs:        Date.now() - _saAgeMs(j),
            stale:        _saAgeMs(j) > 0 && _saAgeMs(j) < _saCutoffMs,
          }))
          .filter(r => r.stale)
          .sort((a,b) => b.ageMs - a.ageMs);
        jsonReply(res, { ok: true, count: _saList.length, olderThanHours: _saHours, cid: _saCid || null, stuck: _saList });
      } catch(e) {
        jsonReply(res, { ok: false, error: (e && e.message) || String(e) });
      }
      return;
    }

    if (urlPath === '/admin/stuck-active/clear' && req.method === 'POST') {
      let _scBody = '';
      req.on('data', c => _scBody += c);
      req.on('end', async () => {
        try {
          const _scIn = JSON.parse(_scBody || '{}');
          const _scBid = parseInt(_scIn.bookingId) || 0;
          const _scCid = String(_scIn.companyId || '').trim();
          const _scReason = String(_scIn.reason || 'Pre-cutover cleanup (stuck Active)');
          if (!_scBid) { jsonReply(res, { ok:false, error:'bookingId required' }); return; }
          const _scJob = jobStore.find(j => j && j.Id === _scBid);
          if (!_scJob) { jsonReply(res, { ok:false, error:'booking not found in jobStore (may already be closed)' }); return; }
          if (_scCid && String(_scJob.companyId) !== _scCid) {
            jsonReply(res, { ok:false, error:'companyId mismatch — refusing to clear' }); return;
          }
          const _scResult = await cancelBooking({
            bookingId:    _scBid,
            cancelledBy:  'dispatcher',
            reason:       _scReason,
            driverFault:  false,
            recallToPending: false,
            companyId:    _scJob.companyId,
            source:       'admin/stuck-active/clear',
          });
          jsonReply(res, _scResult);
        } catch(e) {
          jsonReply(res, { ok:false, error: (e && e.message) || String(e) });
        }
      });
      return;
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
      // Take Payment for an existing job: link the charge back to the booking
      // so the dispatcher sees a "Paid" badge next time they open the popup,
      // and so reports (and Firebase) reflect the captured payment.
      const jobIdRaw = (body.JobId || body.Id || '').toString().trim();
      const jobIdNum = jobIdRaw ? parseInt(jobIdRaw) : 0;
      const payerEmail = (body.Email || '').toString().trim();
      const payerName  = (body.Name  || '').toString().trim();
      const payerPhone = (body.Phone || '').toString().trim();
      // Resolve company id for this charge so multi-tenant filtering / mirroring works.
      const _testCidHeader = process.env.NODE_ENV !== 'production' ? (req.headers['x-bw-test-company'] || '') : '';
      const sessionCompanyId = _testCidHeader || getSessionCompanyId(req) || null;
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
        description: jobIdNum
          ? ('BookaWaka taxi fare — Job #' + jobIdNum)
          : 'BookaWaka taxi fare',
        metadata: Object.assign(
          {},
          jobIdNum ? { jobId: String(jobIdNum) } : {},
          sessionCompanyId ? { companyId: String(sessionCompanyId) } : {}
        ),
      });
      console.log(`[Stripe] charge ${charge.id} ${charge.status} $${amountDollars} NZD${jobIdNum ? ' job#' + jobIdNum : ''}`);
      const status = charge.status === 'succeeded' ? 'succeeded' : charge.status;

      // On success, link the payment back to the job (jobStore + Firebase mirror)
      // and record it in stripePaymentStore for reports / audit.
      if (status === 'succeeded') {
        try {
          // 1) Update in-memory jobStore so the popup shows "Paid" next time.
          if (jobIdNum) {
            const jobIdx = jobStore.findIndex(j =>
              j.Id === jobIdNum && (!sessionCompanyId || j.companyId === sessionCompanyId)
            );
            if (jobIdx >= 0) {
              const _jt = new Date().toISOString();
              jobStore[jobIdx].paymentStatus    = 'paid';
              jobStore[jobIdx].PaymentStatus    = 'paid';
              jobStore[jobIdx].paymentMethod    = 'stripe-dispatcher-charge';
              jobStore[jobIdx].stripeChargeId   = charge.id;
              jobStore[jobIdx].Recieve_payment  = String(amountDollars);
              jobStore[jobIdx].paymentCapturedAt = _jt;
              if (payerEmail && !jobStore[jobIdx].Email) jobStore[jobIdx].Email = payerEmail;
              try { saveJsonStore(JOB_STORE_FILE, jobStore); } catch(e) {}

              // 2) Mirror to Firebase so any other connected console / driver app sees it live.
              try {
                if (typeof firebasePatch === 'function') {
                  const _cid = jobStore[jobIdx].companyId || sessionCompanyId;
                  const _vid = jobStore[jobIdx].VehicleId;
                  const _did = jobStore[jobIdx].DriverId;
                  if (_cid && _vid && _did) {
                    firebasePatch(`jobs/${_cid}/${_vid}/${_did}/${jobIdNum}`, {
                      paymentStatus:    'paid',
                      paymentMethod:    'stripe-dispatcher-charge',
                      stripeChargeId:   charge.id,
                      Recieve_payment:  String(amountDollars),
                      paymentCapturedAt: _jt,
                    });
                  }
                }
              } catch (fbErr) {
                console.log('[Stripe] Firebase mirror failed:', fbErr.message);
              }
            } else {
              console.log(`[Stripe] charge ok but job #${jobIdNum} not found in jobStore — payment recorded only`);
            }
          }

          // 3) Record the charge in stripePaymentStore for reporting / refunds.
          const _spRec = {
            id:           (typeof stripePayNextId !== 'undefined' ? stripePayNextId++ : Date.now()),
            companyId:    sessionCompanyId || null,
            jobId:        jobIdNum || null,
            chargeId:     charge.id,
            amount:       amountDollars,
            currency:     'nzd',
            status:       'succeeded',
            payerName:    payerName,
            payerEmail:   payerEmail,
            payerPhone:   payerPhone,
            source:       jobIdNum ? 'dispatch-take-payment' : 'dispatch-walk-up',
            createdAt:    new Date().toISOString(),
          };
          stripePaymentStore.push(_spRec);
          try { saveJsonStore(STRIPE_PAYMENTS_FILE, stripePaymentStore); } catch(e) {}
        } catch (linkErr) {
          console.log('[Stripe] post-charge link failed (charge still succeeded):', linkErr.message);
        }
      }

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
      void _stampRegistrationBaseCoords(newReg, 'register/auto-approve');
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

    // Block login for pending/rejected/deleted or subscription past grace+extension
    const access = await resolveCompanyAccessAsync(reg);
    if (access.loginBlocked) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      const msg = access.blockMessage || (
        reg.status === 'pending' ? 'This account is awaiting approval.' :
        reg.status === 'rejected' ? 'This account application was not approved.' :
        'Account access is not available.'
      );
      res.end(JSON.stringify({ error: msg, status: reg.status, reason: 'subscription_expired' }));
      console.log(`[session] login BLOCKED: companyId=${companyId} status=${reg.status} billing=${access.billingStatus} active=${access.companyActive}`);
      return;
    }
    if (['pending', 'rejected', 'deleted'].includes(reg.status)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      const msg = reg.status === 'pending'
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
      'Set-Cookie': sessionCookieHeader(companyId),
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
    const reg = registrationStore.find(r => r.companyId === cid);
    if (!reg) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Company not found' }));
      return;
    }
    const access = await resolveCompanyAccessAsync(reg);
    if (access.loginBlocked) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: access.blockMessage || 'Account is not active', status: reg.status }));
      console.log(`[session/me] blocked: companyId=${cid} status=${reg.status} billing=${access.billingStatus}`);
      return;
    }
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                  || req.socket?.remoteAddress
                  || 'unknown';
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(reg.companyId),
    });
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
    const settings = await readCompanySettingsNode(reg.companyId);
    const access = resolveCompanyAccess(reg, settings);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      found:      true,
      status:     access.status,
      regStatus:  reg.status,
      companyId:  reg.companyId,
      company:    reg.company,
      trialEnd:   access.trialEnd,
      graceEnd:   reg.graceEnd,
      daysLeft:   access.daysLeft,
      daysUntilBlock: access.daysUntilBlock,
      gracePeriodDays: access.gracePeriodDays,
      extensionDays: access.extensionDays,
      accessUntil: access.accessUntil,
      showBanner: access.showBanner,
      canAccess:  access.canAccess,
      loginBlocked: access.loginBlocked,
      blockMessage: access.blockMessage,
      planName: access.planName,
      upgradeUrl: `https://invt-admin-production.up.railway.app/taxitime.co.nz/owner/Billing.aspx?cid=${encodeURIComponent(reg.companyId)}`,
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
    const _stCid      = (_stQs.get('cid')      || '').trim();
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

  // ── §FIX-R — Extract the OTA-22be audit payload from a trip summary ─────────
  // HQ confirmed sync-offline-trip now carries: payment method (with TM
  // voucher / ACC claim / gift-card / Stripe intent / settled-in-car flag),
  // waiting minutes + intervals + dollars, tariff change log, pause log,
  // active tariff id/name, booking type, trip source, plus reserved-but-
  // safe-defaulted split-payment / fixed-fare-override / driver-note /
  // trip-issue fields. We pick each field defensively (multiple alias
  // casings) so HQ can tweak names without breaking us.
  function _sotExtractAuditFields(s) {
    const out = {};
    if (!s || typeof s !== 'object') return out;
    function _str(v) { return (v == null || v === '') ? null : String(v); }
    function _num(v) { var n = Number(v); return (isFinite(n) && n > 0) ? n : null; }
    function _arr(v) { return Array.isArray(v) ? v : null; }
    // Waiting (minutes / dollars / per-tap intervals)
    var wMin  = _num(s.waitingMinutes != null ? s.waitingMinutes
              : s.waitingMin   != null ? s.waitingMin
              : s.waitingTime  != null ? s.waitingTime : null);
    var wCost = _num(s.waitingDollars != null ? s.waitingDollars
              : s.waitingCost  != null ? s.waitingCost
              : s.waiting_cost != null ? s.waiting_cost : null);
    if (wMin  != null) out.WaitingTime = wMin;
    if (wCost != null) out.WaitingCost = wCost;
    var wIvs = _arr(s.waitingIntervals) || _arr(s.WaitingIntervals);
    if (wIvs) out.WaitingIntervals = wIvs;
    // Tariff log + live tariff
    var tLog = _arr(s.tariffChanges) || _arr(s.tariffLog) || _arr(s.TariffLog);
    if (tLog) out.TariffLog = tLog;
    if (_str(s.currentTariffId))   out.CurrentTariffId   = _str(s.currentTariffId);
    if (_str(s.currentTariffName)) out.CurrentTariffName = _str(s.currentTariffName);
    // Pause log (frontend already renders pauseLog / PauseLog in the timeline)
    var pLog = _arr(s.pauseLog) || _arr(s.PauseLog);
    if (pLog) out.pauseLog = pLog;
    // Booking-type / trip-source classification
    if (_str(s.bookingType)) out.BookingType = _str(s.bookingType);
    if (_str(s.tripSource))  out.TripSource  = _str(s.tripSource);
    // §FIX-METER — OTA-22bj: meter charging window distinct from
    // customer window (pickup→dropoff). Driver app now stamps meterOnAt
    // when startMeter fires and meterOffAt when stopMeter fires. Persist
    // both so the dispute panel can show pickup→dropoff vs meter→meter
    // side-by-side. Accept both camelCase (driver app) and PascalCase
    // (already-canonicalised payloads).
    if (_str(s.meterOnAt  || s.MeterOnAt))  out.MeterOnAt  = _str(s.meterOnAt  || s.MeterOnAt);
    if (_str(s.meterOffAt || s.MeterOffAt)) out.MeterOffAt = _str(s.meterOffAt || s.MeterOffAt);
    // §FIX-22bn — OTA-22bn/22bo: per-trip extras breakdown + trip-stage
    // timestamps. Driver app now stamps each lifecycle leg as it happens
    // (OnTheWay tap, Arrive at pickup tap, Customer On Board tap) so HQ
    // can KPI on response/arrival/board times distinct from the legacy
    // PickingAt/ActiveAt fields. Extras come as a structured array of
    // {label,amount} (Airport, Bike, Bag, EFTPOS surcharge, Cleaning, …)
    // with a precomputed ExtrasTotal — if only the total arrives we still
    // accept that (mirrors existing FareExtras path).
    var xItems = _arr(s.extrasItems) || _arr(s.extras_items) || _arr(s.ExtrasItems);
    if (xItems) out.ExtrasItems = xItems;
    var xTot = _num(s.extrasTotal != null ? s.extrasTotal
              : s.extras_total != null ? s.extras_total
              : s.ExtrasTotal  != null ? s.ExtrasTotal : null);
    if (xTot != null) out.ExtrasTotal = xTot;
    if (_str(s.onTheWayAt || s.OnTheWayAt)) out.OnTheWayAt = _str(s.onTheWayAt || s.OnTheWayAt);
    if (_str(s.arrivedAt  || s.ArrivedAt))  out.ArrivedAt  = _str(s.arrivedAt  || s.ArrivedAt);
    if (_str(s.onBoardAt  || s.OnBoardAt))  out.OnBoardAt  = _str(s.onBoardAt  || s.OnBoardAt);
    // Driver notes + trip-issue category
    if (_str(s.driverNote)) out.DriverNote = _str(s.driverNote);
    var tiFlag = _str(s.tripIssueFlag);
    if (tiFlag && tiFlag.toLowerCase() !== 'none') out.TripIssueFlag = tiFlag;
    if (_str(s.tripIssueNote)) out.TripIssueNote = _str(s.tripIssueNote);
    // Fixed-fare / custom-total override
    if (s.fixedPrice === true || s.fixedPrice === 'true') out.FixedPrice = true;
    if (_num(s.customTotal) != null) out.CustomTotal = _num(s.customTotal);
    if (_str(s.priceOverrideReason)) out.PriceOverrideReason = _str(s.priceOverrideReason);
    if (_str(s.priceOverrideNote))   out.PriceOverrideNote   = _str(s.priceOverrideNote);
    // Payment sub-fields (the "Paid By" detail row + Take-Payment-button gate)
    if (s.payment && typeof s.payment === 'object') {
      var p = s.payment;
      if (_str(p.tmVoucherNo))  out.TmVoucherNo  = _str(p.tmVoucherNo);
      if (_str(p.accClaimNo))   out.AccClaimNo   = _str(p.accClaimNo);
      if (_str(p.giftCardCode)) out.GiftCardCode = _str(p.giftCardCode);
      if (_str(p.stripeIntent)) out.StripeIntent = _str(p.stripeIntent);
      if (p.settledInCar === true  || p.settledInCar === 'true')  out.PaymentSettled = true;
      if (p.settledInCar === false || p.settledInCar === 'false') out.PaymentSettled = false;
      var pSplits = _arr(p.splits);
      if (pSplits) out.PaymentSplits = pSplits;
    }
    return out;
  }
  // ─── end §FIX-R helper ────────────────────────────────────────────────────────

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
    // §FIX-R/sec — Tenant-isolation guard. Without a companyId match, a
    // collision on Id (or a malformed driver-app POST) could merge one
    // tenant's offline sync into another tenant's closed record. Mirror
    // the same guard the live `jobStore.find` above uses.
    const _sotAlreadyClosed = !_sotJob &&
      closedJobStore.find(j =>
        j.Id === _sotJobId &&
        (String(j.companyId || j.CompanyId || '') === _sotCid || _sotCid === 'test'));

    if (_sotAlreadyClosed) {
      // ─── §FIX-L — merge late syncOfflineTrip into already-closed record ─────
      // For hail trips, DriverStatusChanged → Available almost always wins the
      // race against /api/syncOfflineTrip (Available fires the instant the
      // meter stops; syncOfflineTrip takes a round-trip to assemble & POST).
      // The DriverStatusChanged path moves the job to closedJobStore with no
      // fare/distance/duration/payment, then this endpoint used to bail —
      // dropping the actual trip-summary data on the floor.
      //
      // Instead, merge the trip summary into the closed record (never
      // overwriting populated fields), save, and mirror to allbookings so the
      // dispatch history view fills in.
      const _sotC = _sotAlreadyClosed;
      function _sotHas(v) {
        if (v == null) return false;
        if (typeof v === 'string') return v.trim() !== '';
        if (typeof v === 'number') return !isNaN(v) && v !== 0;
        return true;
      }
      const _sotApplied = [];
      function _sotFill(field, val) {
        if (val == null) return;
        if (typeof val === 'string' && !val.trim()) return;
        if (typeof val === 'number' && (isNaN(val) || val === 0)) return;
        if (_sotHas(_sotC[field])) return; // never clobber existing truth
        _sotC[field] = val; _sotApplied.push(field);
      }
      // Trip-summary scalars
      if (_sotSummary.pickupTime)     _sotFill('PickingAt',      _sotSummary.pickupTime);
      if (_sotSummary.dropoffTime)    _sotFill('JobCompleteTime', _sotSummary.dropoffTime + '.');
      if (_sotSummary.duration_mins)  _sotFill('JobDuration',    Number(_sotSummary.duration_mins));
      if (_sotSummary.duration_mins)  _sotFill('JobMins',        Number(_sotSummary.duration_mins));
      if (_sotSummary.distance_km)    _sotFill('JobDistance',    Number(_sotSummary.distance_km));
      if (_sotSummary.route_polyline) _sotFill('RoutePolyline',  _sotSummary.route_polyline);
      // Fare breakdown
      if (_sotSummary.fare && typeof _sotSummary.fare === 'object') {
        const _fL = _sotSummary.fare;
        _sotFill('FareBase',     Number(_fL.base) || 0);
        _sotFill('FareDistance', Number(_fL.distanceCharge) || 0);
        _sotFill('FareTime',     Number(_fL.timeCharge) || 0);
        _sotFill('FareExtras',   Number(_fL.extras) || 0);
        _sotFill('TotalFare',    Number(_fL.total) || 0);
        _sotFill('FareCurrency', _fL.currency || 'NZD');
        _sotFill('Fare',         Number(_fL.total) || 0);
      }
      // Payment
      if (_sotSummary.payment && typeof _sotSummary.payment === 'object') {
        const _pL = _sotSummary.payment;
        _sotFill('Recieve_payment', _pL.method || '');
        _sotFill('PaymentReceived', Number(_pL.received) || 0);
        _sotFill('PaymentChange',   Number(_pL.change) || 0);
        _sotFill('ReceiptNo',       _pL.receiptNo || '');
        if (_pL.cardLast4)  _sotFill('CardLast4', _pL.cardLast4);
        // Mirror method to paymentMethod boolean flags if not already set.
        const _pmL = String(_pL.method || '').toLowerCase();
        if (_pmL && !_sotHas(_sotC.paymentMethod)) _sotFill('paymentMethod', _pmL);
        if (_pmL && !_sotHas(_sotC.PaymentMethod)) _sotFill('PaymentMethod', _pmL);
        if (_pmL === 'card' && !_sotHas(_sotC.cardPayment))       _sotFill('cardPayment', true);
        if (_pmL === 'account' && !_sotHas(_sotC.accountPayment)) _sotFill('accountPayment', true);
        if (_pmL === 'cash' && !_sotHas(_sotC.cashPayment))       _sotFill('cashPayment', true);
      }
      // §FIX-R — OTA-22be audit fields (waiting, tariff log, pause log,
      // payment sub-fields, booking/trip-source classification, fixed-fare
      // overrides, driver note, trip-issue category). Fill-if-empty so an
      // earlier truth (e.g. dispatch-entered note) is never clobbered.
      var _sotAuditL = _sotExtractAuditFields(_sotSummary);
      var _sotAuditKeysL = Object.keys(_sotAuditL);
      _sotAuditKeysL.forEach(function(k) { _sotFill(k, _sotAuditL[k]); });
      if (_sotAuditKeysL.length) {
        console.log('  [§FIX-R/late] audit fields merged: ' + _sotAuditKeysL.join(','));
      }
      // §FIX-R — runtime fingerprint (fill-if-empty so we don't overwrite an
      // earlier stamp). Mirrors the live path so HQ's OTA-version question
      // is answerable for jobs that closed via DriverStatusChanged first.
      // OTA-22bg: appVersion (native) is distinct from runtimeVersion (Expo).
      if (_sotData.appVersion || _sotData.app_version) {
        _sotFill('AppVersion', String(_sotData.appVersion || _sotData.app_version));
      } else if (_sotData.runtimeVersion || _sotData.runtime_version) {
        _sotFill('AppVersion', String(_sotData.runtimeVersion || _sotData.runtime_version));
      }
      if (_sotData.runtimeVersion || _sotData.runtime_version) {
        _sotFill('RuntimeVersion', String(_sotData.runtimeVersion || _sotData.runtime_version));
      }
      if (_sotData.groupId || _sotData.group_id || _sotData.otaGroup) {
        _sotFill('AppBuild', String(_sotData.groupId || _sotData.group_id || _sotData.otaGroup));
      }
      // §FIX-22bn — native build id (distinct from Expo OTA group). HQ
      // needs both for incident triage when a native crash is suspected.
      if (_sotData.buildId || _sotData.build_id || _sotData.nativeBuildId) {
        _sotFill('BuildId', String(_sotData.buildId || _sotData.build_id || _sotData.nativeBuildId));
      }
      if (_sotData.channel) _sotFill('Channel', String(_sotData.channel));
      if (_sotData.platform) _sotFill('Platform', String(_sotData.platform));
      // Diagnostic — surface every tripSummary key so unknown HQ field names
      // appear in workflow logs whether we hit the live or late-merge path.
      try {
        var _sumKL = Object.keys(_sotSummary || {});
        var _payKL = (_sotSummary && _sotSummary.payment && typeof _sotSummary.payment === 'object')
                   ? Object.keys(_sotSummary.payment) : [];
        console.log('  [§FIX-R/diag/late] #' + _sotJobId + ' summary keys=[' + _sumKL.join(',') +
                    '] payment keys=[' + _payKL.join(',') + ']');
      } catch(_eL) {}
      // Stamp provenance + persist
      _sotC.OfflineSynced   = true;
      _sotC.OfflineSyncedAt = new Date().toISOString();
      saveClosedJobStore();
      console.log(`  [§FIX-L] late syncOfflineTrip merged into closed job #${_sotJobId} (${_sotApplied.length} field(s) [${_sotApplied.join(',')}])`);

      // Mirror to allbookings so SA portal + dispatch history see the truth.
      if (_sotApplied.length) {
        (async () => {
          try {
            const tok = await getFirebaseServerToken();
            if (!tok) return;
            const _abPatch = {};
            _sotApplied.forEach(function(f) { _abPatch[f] = _sotC[f]; });
            await firebaseDbPatch(`allbookings/${_sotCid}/${_sotJobId}`, _abPatch, tok);
            console.log(`  [§FIX-L] allbookings/${_sotCid}/${_sotJobId} patched (${_sotApplied.length} fields)`);
          } catch (e) {
            console.warn(`  [§FIX-L] allbookings patch failed for #${_sotJobId}:`, (e && e.message) || e);
          }
        })();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, jobId: _sotJobId, status: 'AlreadyClosed',
        message: 'Job was already completed — late trip-summary merged.',
        fieldsApplied: _sotApplied }));
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
      // §FIX-22bn — OTA-22bn lifecycle taps. EnRoute is the legacy event
      // type and OnTheWay is the new explicit one; either stamps OnTheWayAt
      // if not already set (event loop is chronological so first wins).
      if ((_evType === 'OnTheWay' || _evType === 'EnRoute') && !_sotJob.OnTheWayAt) _sotJob.OnTheWayAt = _evTs;
      if ((_evType === 'OnBoard'  || _evType === 'Boarded') && !_sotJob.OnBoardAt)  _sotJob.OnBoardAt  = _evTs;
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
    // §FIX-R — OTA-22be audit fields. Live path: assign every non-undefined
    // value (a fresh sync wins). Mirror the same diagnostic log as the late
    // path so HQ field-name discrepancies surface immediately in logs.
    var _sotAuditLive = _sotExtractAuditFields(_sotSummary);
    var _sotAuditKeys = Object.keys(_sotAuditLive);
    _sotAuditKeys.forEach(function(k) { _sotJob[k] = _sotAuditLive[k]; });
    if (_sotAuditKeys.length) {
      console.log('[§FIX-R] audit fields stamped on #' + _sotJobId + ': ' + _sotAuditKeys.join(','));
    }
    // §FIX-R / OTA-22bg — runtime fingerprint of the driver app that sent this
    // trip. Lets us answer "which OTA version was D002 on?" questions without
    // pinging the driver. Driver app posts these at the root of the payload:
    //   appVersion      → native APP_VERSION constant (e.g. "1.5.0")
    //   runtimeVersion  → Expo runtime version (separate from appVersion)
    //   groupId         → EAS update group / updateId
    //   channel         → release channel ("production" / "staging" / …)
    //   platform        → "android" | "ios"
    if (_sotData.appVersion || _sotData.app_version) {
      _sotJob.AppVersion = String(_sotData.appVersion || _sotData.app_version);
    } else if (_sotData.runtimeVersion || _sotData.runtime_version) {
      // Fallback for pre-22bg payloads that only sent runtimeVersion.
      _sotJob.AppVersion = String(_sotData.runtimeVersion || _sotData.runtime_version);
    }
    if (_sotData.runtimeVersion || _sotData.runtime_version) {
      _sotJob.RuntimeVersion = String(_sotData.runtimeVersion || _sotData.runtime_version);
    }
    if (_sotData.groupId || _sotData.group_id || _sotData.otaGroup) {
      _sotJob.AppBuild = String(_sotData.groupId || _sotData.group_id || _sotData.otaGroup);
    }
    // §FIX-22bn — native build id (distinct from Expo OTA group)
    if (_sotData.buildId || _sotData.build_id || _sotData.nativeBuildId) {
      _sotJob.BuildId = String(_sotData.buildId || _sotData.build_id || _sotData.nativeBuildId);
    }
    if (_sotData.channel) _sotJob.Channel  = String(_sotData.channel);
    if (_sotData.platform) _sotJob.Platform = String(_sotData.platform);
    // Diagnostic: surface every tripSummary key so we can spot unknown ones
    // the helper didn't pick up (HQ might rename fields without warning).
    try {
      var _sumKeys = Object.keys(_sotSummary || {});
      var _payKeys = (_sotSummary && _sotSummary.payment && typeof _sotSummary.payment === 'object')
                   ? Object.keys(_sotSummary.payment) : [];
      console.log('[§FIX-R/diag] #' + _sotJobId + ' summary keys=[' + _sumKeys.join(',') +
                  '] payment keys=[' + _payKeys.join(',') + ']');
    } catch(_e) {}
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

  // ── POST /api/booking/update — §FIX-UB unified update REST endpoint ─────────
  // Body: { bookingId, changes: {field:value,...}, ifSeq?, by: dispatcher|passenger|website }
  // Same auth model as /api/cancel: dispatcher uses BW_SID, others X-Admin-Key.
  // Idempotent (empty-diff returns idempotent:true); stale ifSeq returns 409.
  if (urlPath === '/api/booking/update' && req.method === 'POST') {
    const _ubBody = await readBody(req);
    let _ub = {};
    try { _ub = JSON.parse(_ubBody); } catch(e) {}
    const _ubBooking = parseInt(_ub.bookingId || _ub.BookingId || 0) || 0;
    const _ubBy      = String(_ub.by || _ub.updatedBy || '').toLowerCase().trim();
    const _ubChanges = (_ub.changes && typeof _ub.changes === 'object') ? _ub.changes : null;
    const _ubIfSeq   = (_ub.ifSeq !== undefined && _ub.ifSeq !== null) ? parseInt(_ub.ifSeq) : null;
    const _ubAllowed = new Set(['dispatcher', 'passenger', 'website']);
    if (!_ubBooking || !_ubAllowed.has(_ubBy) || !_ubChanges) {
      res.writeHead(400, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: 'bookingId, changes:{...} and by ∈ {dispatcher,passenger,website} required' }));
      return;
    }
    if (_ubBy === 'dispatcher') {
      const _ubCid = getSessionCompanyId(req) || '';
      if (!_ubCid) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: 'dispatcher session required' }));
        return;
      }
      // Tenant check across BOTH stores so closed-booking probes don't leak
      // existence via 410 vs 404 (a dispatcher from cidA cannot tell whether
      // bookingId exists in cidB at all — always 403 if it does and isn't theirs).
      const _ubJobT  = jobStore.find(j => j && j.Id === _ubBooking);
      const _ubClsT  = closedJobStore.find(j => j && j.Id === _ubBooking);
      const _ubAnyT  = _ubJobT || _ubClsT;
      if (_ubAnyT && _ubAnyT.companyId && String(_ubAnyT.companyId) !== String(_ubCid)) {
        res.writeHead(403, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: 'cross-tenant update forbidden' }));
        return;
      }
    } else {
      const _ubKey = req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '';
      if (!process.env.BW_ADMIN_KEY || _ubKey !== process.env.BW_ADMIN_KEY) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error: 'X-Admin-Key required for ' + _ubBy + ' source' }));
        return;
      }
    }
    const _ubResult = await updateBooking({
      bookingId: _ubBooking, changes: _ubChanges,
      by: _ubBy, ifSeq: _ubIfSeq, source: 'api/booking/update/' + _ubBy
    });
    console.log(`POST /api/booking/update -> ${JSON.stringify({ ok: _ubResult.ok, idempotent: _ubResult.idempotent, stale: _ubResult.stale, types: _ubResult.eventTypes })}`);
    let _status = 200;
    if (_ubResult.stale)  _status = 409;
    else if (_ubResult.closed) _status = 410;
    else if (!_ubResult.ok)    _status = 404;
    res.writeHead(_status, JSON_HEADERS);
    res.end(JSON.stringify(_ubResult));
    return;
  }

  // ── GET /api/driver/active-bookings — §FIX-DA-G6 reconnect rebuild ──────────
  // Driver-app calls this on every Firebase .info/connected → true transition
  // to reconcile its in-memory jobs[] against the dispatch source of truth.
  // Auth: X-User-Key header (driver's passforlink) OR X-Admin-Key for
  // server-to-server. cid+vid are derived from the driver record, never trusted
  // from query params (prevents a leaked key from cidA probing cidB).
  if (urlPath === '/api/driver/active-bookings' && req.method === 'GET') {
    const _g6Q = url.parse(req.url, true).query || {};
    const _g6DriverIdQ = String(_g6Q.driverId || _g6Q.driverid || '').trim();
    const _g6UserKey   = String(req.headers['x-user-key'] || req.headers['X-User-Key'] || '').trim();
    const _g6AdminKey  = String(req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '').trim();
    let _g6Driver = null;
    if (_g6UserKey) {
      // Look up by passforlink (the driver-app's UserKey). Match against any
      // plausible field name the driver record may carry.
      _g6Driver = ZONE_DRIVERS.find(d => d && (
        String(d.passforlink || '').trim() === _g6UserKey ||
        String(d.userKey      || '').trim() === _g6UserKey ||
        String(d.UserKey      || '').trim() === _g6UserKey
      )) || null;
    }
    if (!_g6Driver && _g6AdminKey && process.env.BW_ADMIN_KEY && _g6AdminKey === process.env.BW_ADMIN_KEY && _g6DriverIdQ) {
      _g6Driver = ZONE_DRIVERS.find(d => d &&
        (String(d.driverid).trim() === _g6DriverIdQ || String(d.VehicleId).trim() === _g6DriverIdQ)
      ) || null;
    }
    if (!_g6Driver) {
      res.writeHead(401, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: 'unknown driver (provide X-User-Key, or X-Admin-Key + ?driverId=)' }));
      return;
    }
    const _g6Cid  = String(_g6Driver.companyId || '').trim();
    const _g6Drv  = String(_g6Driver.driverid  || '').trim();
    const _g6Vid  = String(_g6Driver.VehicleId || '').trim();
    // Reject ambiguous-tenant matches — without a companyId we'd cross-leak.
    if (!_g6Cid) {
      res.writeHead(403, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: 'driver record missing companyId' }));
      return;
    }
    const _g6Active = new Set(['Offered', 'Assigned', 'Picking', 'OnTrip', 'Active', 'Queued']);
    const _g6StatusMap = (s) => {
      const _bs = String(s || '');
      if (_bs === 'Offered')  return 'offered';
      if (_bs === 'Queued')   return 'queued';
      if (_bs === 'Assigned' || _bs === 'Picking' || _bs === 'OnTrip' || _bs === 'Active') return 'current';
      return _bs.toLowerCase();
    };
    const _g6Rows = jobStore.filter(j => j &&
      _g6Active.has(j.BookingStatus) &&
      String(j.companyId || '') === _g6Cid &&
      (String(j.DriverId || '').trim() === _g6Drv ||
       String(j.AssignedDriverId || '').trim() === _g6Drv)
    ).map(j => ({
      bookingId:       j.Id,
      status:          _g6StatusMap(j.BookingStatus),
      version:         parseInt(j.updateSeq) || 0,
      updatedAt:       j.lastUpdatedAt || j.JobCreatedTime || null,
      jobBookingSrc:   j.jobBookingSrc || j.BookingSource || j.bookingSource || j.source || 'dispatch',
      passengerName:   j.UserFName || j.Name || '',
      passengerPhone:  j.PhoneNo || j.UserPhone || j.Phone || j.JobphoneNo || '',
      pickupAddress:   j.PickAddress || j.PickupAddress || j.PickLocation || j.jobpickup || '',
      dropAddress:     j.DropAddress  || j.DropLocation || j.jobdropoff || '',
      fare:            j.EstimatedFare || j.RideCost || j.CustomeRate || null,
      paymentType:     j.PaymentMethod || j.paymentMethod || '',
      wheelchair:      !!(j.Wheelchair || j.wheelchair),
      passengers:      parseInt(j.NoOfPassengers || j.Passengers || 1) || 1,
      notes:           j.Notes || j.notes || ''
    }));
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({
      ok: true,
      driverId:  _g6Drv,
      companyId: _g6Cid,
      vehicleId: _g6Vid,
      bookings:  _g6Rows,
      fetchedAt: Date.now()
    }));
    console.log(`200: GET /api/driver/active-bookings driver=${_g6Drv} cid=${_g6Cid} → ${_g6Rows.length} booking(s)`);
    return;
  }

  // ── POST /api/job/command — §FIX-CMD unified lifecycle front door ───────────
  // Body: { bookingId, command: assign|cancel|recall|update|complete,
  //         payload?: {...}, ifSeq?, by?: dispatcher|driver|passenger|website }
  // Dispatcher source uses BW_SID session cookie; others require X-Admin-Key.
  // Routes internally to assignBooking / cancelBooking / updateBooking /
  // completeBooking. All commands are idempotent — re-running with the same
  // terminal state returns { idempotent: true }.
  if (urlPath === '/api/job/command' && req.method === 'POST') {
    const _cmdBody = await readBody(req);
    let _cmd = {};
    try { _cmd = JSON.parse(_cmdBody); } catch(e) {}
    const _cmdBooking = parseInt(_cmd.bookingId || _cmd.BookingId || 0) || 0;
    const _cmdName    = String(_cmd.command || '').toLowerCase().trim();
    const _cmdBy      = String(_cmd.by || _cmd.cancelledBy || _cmd.updatedBy || 'dispatcher').toLowerCase().trim();
    const _cmdPayload = (_cmd.payload && typeof _cmd.payload === 'object') ? _cmd.payload : {};
    // ifSeq (legacy) and ifVersion (new) are interchangeable.
    const _cmdIfVerRaw = (_cmd.ifVersion !== undefined && _cmd.ifVersion !== null) ? _cmd.ifVersion
                       : (_cmd.ifSeq    !== undefined && _cmd.ifSeq    !== null) ? _cmd.ifSeq : null;
    const _cmdIfVer    = _cmdIfVerRaw === null ? null : parseInt(_cmdIfVerRaw);
    // clientRequestId (body) or Idempotency-Key (header) — same purpose.
    const _cmdReqId   = String(_cmd.clientRequestId || req.headers['idempotency-key'] || req.headers['Idempotency-Key'] || '').trim();
    const _cmdAllowed = new Set(['assign', 'accept', 'cancel', 'recall', 'update', 'complete']);
    const _cmdBySet   = new Set(['dispatcher', 'driver', 'passenger', 'website']);
    if (!_cmdBooking || !_cmdAllowed.has(_cmdName) || !_cmdBySet.has(_cmdBy)) {
      res.writeHead(400, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error_code: 'bad_request', error: 'bookingId, command ∈ {assign,accept,cancel,recall,update,complete}, by ∈ {dispatcher,driver,passenger,website} required' }));
      return;
    }
    // clientRequestId dedup — return cached response on retry.
    const _cmdDedupKey = _cmdReqId ? `${_cmdBy}:${_cmdBooking}:${_cmdName}:${_cmdReqId}` : '';
    if (_cmdDedupKey) {
      const _hit = _cmdDedupGet(_cmdDedupKey);
      if (_hit) {
        console.log(`[/api/job/command] dedup hit reqId=${_cmdReqId} → replaying cached response (status=${_hit.status})`);
        res.writeHead(_hit.status, JSON_HEADERS);
        res.end(JSON.stringify(Object.assign({}, _hit.response, { dedup: true })));
        return;
      }
    }
    // Auth — three identities:
    //   dispatcher → BW_SID session cookie
    //   driver     → X-User-Key (driver's passforlink) matched in ZONE_DRIVERS
    //                (server derives driverId + companyId; client cannot spoof)
    //   passenger/website → X-Admin-Key (server-to-server)
    let _cmdCid = '';
    let _cmdAuthDriverId = '';   // server-derived driverId when by==='driver'
    let _cmdAuthVehicleId = '';
    if (_cmdBy === 'dispatcher') {
      _cmdCid = getSessionCompanyId(req) || '';
      if (!_cmdCid) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'auth_failed', error: 'dispatcher session required' }));
        return;
      }
      const _cmdJobT = jobStore.find(j => j && j.Id === _cmdBooking) || closedJobStore.find(j => j && j.Id === _cmdBooking);
      if (_cmdJobT && _cmdJobT.companyId && String(_cmdJobT.companyId) !== String(_cmdCid)) {
        res.writeHead(403, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'forbidden', error: 'cross-tenant command forbidden' }));
        return;
      }
    } else if (_cmdBy === 'driver') {
      const _userKey = String(req.headers['x-user-key'] || req.headers['X-User-Key'] || '').trim();
      const _adminKey = String(req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '').trim();
      let _drvRec = null;
      if (_userKey) {
        _drvRec = ZONE_DRIVERS.find(d => d && (
          String(d.passforlink || '').trim() === _userKey ||
          String(d.userKey      || '').trim() === _userKey ||
          String(d.UserKey      || '').trim() === _userKey
        )) || null;
      }
      // Fallback: admin key + driverId in payload (server-to-server / testing).
      if (!_drvRec && _adminKey && process.env.BW_ADMIN_KEY && _adminKey === process.env.BW_ADMIN_KEY) {
        const _fbDrvId = String(_cmdPayload.driverId || _cmd.driverId || '').trim();
        if (_fbDrvId) _drvRec = ZONE_DRIVERS.find(d => d && (String(d.driverid).trim() === _fbDrvId || String(d.VehicleId).trim() === _fbDrvId)) || null;
      }
      if (!_drvRec) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'auth_failed', error: 'driver source requires X-User-Key (or X-Admin-Key + driverId)' }));
        return;
      }
      _cmdAuthDriverId  = String(_drvRec.driverid  || '').trim();
      _cmdAuthVehicleId = String(_drvRec.VehicleId || '').trim();
      _cmdCid           = String(_drvRec.companyId || '').trim();
      // Cross-tenant check: driver can only command bookings in their own company.
      const _cmdJobT = jobStore.find(j => j && j.Id === _cmdBooking) || closedJobStore.find(j => j && j.Id === _cmdBooking);
      if (_cmdJobT && _cmdJobT.companyId && _cmdCid && String(_cmdJobT.companyId) !== _cmdCid) {
        res.writeHead(403, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'forbidden', error: 'cross-tenant command forbidden' }));
        return;
      }
    } else {
      const _cmdKey = req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '';
      if (!process.env.BW_ADMIN_KEY || _cmdKey !== process.env.BW_ADMIN_KEY) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'auth_failed', error: 'X-Admin-Key required for ' + _cmdBy + ' source' }));
        return;
      }
      const _cmdJob = jobStore.find(j => j && j.Id === _cmdBooking) || closedJobStore.find(j => j && j.Id === _cmdBooking);
      _cmdCid = _cmdJob ? String(_cmdJob.companyId || '') : '';
    }

    // Dispatch by command verb.
    let _result, _status = 200;
    const _logSrc = 'api/job/command/' + _cmdName + '/' + _cmdBy;
    try {
      if (_cmdName === 'cancel') {
        _result = await cancelBooking({
          bookingId: _cmdBooking, cancelledBy: _cmdBy, reason: _cmdPayload.reason || '',
          driverFault: !!_cmdPayload.driverFault, recallToPending: false,
          ifVersion: _cmdIfVer,
          companyId: _cmdCid, source: _logSrc
        });
      } else if (_cmdName === 'recall') {
        if (_cmdBy === 'driver' && (_cmdPayload.originalStatus || _cmdPayload.restoreMode)) {
          _result = await driverRecallJob({
            bookingId: _cmdBooking,
            driverId: _cmdAuthDriverId || _cmdPayload.driverId,
            originalStatus: _cmdPayload.originalStatus,
            companyId: _cmdCid,
            source: _logSrc
          });
        } else {
          _result = await cancelBooking({
            bookingId: _cmdBooking, cancelledBy: _cmdBy, reason: _cmdPayload.reason || '',
            driverFault: !!_cmdPayload.driverFault, recallToPending: true,
            ifVersion: _cmdIfVer,
            companyId: _cmdCid, source: _logSrc
          });
        }
      } else if (_cmdName === 'update') {
        const _changes = (_cmdPayload.changes && typeof _cmdPayload.changes === 'object') ? _cmdPayload.changes : _cmdPayload;
        _result = await updateBooking({
          bookingId: _cmdBooking, changes: _changes,
          by: _cmdBy, ifSeq: _cmdIfVer, source: _logSrc
        });
      } else if (_cmdName === 'assign') {
        _result = await assignBooking({
          bookingId: _cmdBooking,
          driverId:  _cmdPayload.driverId  || _cmdPayload.DriverId,
          vehicleId: _cmdPayload.vehicleId || _cmdPayload.VehicleId,
          ifVersion: _cmdIfVer,
          fanout:    !!(_cmdPayload.fanout),
          by: _cmdBy, source: _logSrc
        });
      } else if (_cmdName === 'accept') {
        _result = acceptBooking({
          bookingId: _cmdBooking,
          driverId:  _cmdAuthDriverId || _cmdPayload.driverId || _cmdPayload.DriverId,
          ifVersion: _cmdIfVer,
          by: _cmdBy, source: _logSrc
        });
      } else if (_cmdName === 'complete') {
        _result = await completeBooking({
          bookingId: _cmdBooking,
          fare:     _cmdPayload.fare ?? _cmdPayload.totalFare,
          distance: _cmdPayload.distance ?? _cmdPayload.distanceKm,
          payload:  _cmdPayload,
          ifVersion: _cmdIfVer,
          companyId: _cmdCid,
          by: _cmdBy, source: _logSrc
        });
      }
    } catch (e) {
      console.warn(`[/api/job/command] ${_cmdName} failed: ${e && e.message}`);
      _result = { ok: false, error_code: 'server_error', error: e && e.message };
      _status = 500;
    }
    // HTTP status mapping based on error_code (uniform across verbs).
    if (_result && _result.ok === false) {
      const _ec = _result.error_code || '';
      if      (_ec === 'version_conflict')   _status = 409;
      else if (_ec === 'invalid_transition') _status = 409;
      else if (_ec === 'already_terminal')   _status = 410;
      else if (_ec === 'not_found')          _status = 404;
      else if (_ec === 'forbidden')          _status = 403;
      else if (_ec === 'auth_failed')        _status = 401;
      else if (_ec === 'bad_request')        _status = 400;
      else if (_result.stale)                _status = 409;
      else if (_result.closed)               _status = 410;
      else                                   _status = 500;
    }
    // Cache successful + idempotent-conflict responses for retry safety.
    // (4xx auth/forbidden/bad_request are NOT cached — those should re-evaluate.)
    if (_cmdDedupKey && (_status === 200 || _status === 409 || _status === 410)) {
      _cmdDedupSet(_cmdDedupKey, _status, _result);
    }
    console.log(`${_status}: POST /api/job/command [${_cmdName}] #${_cmdBooking} by=${_cmdBy} -> ${JSON.stringify({ ok: _result.ok, idempotent: _result.idempotent, error_code: _result.error_code, status: _result.status || _result.cancelStage, version: _result.version })}`);
    res.writeHead(_status, JSON_HEADERS);
    res.end(JSON.stringify(_result));
    return;
  }

  // ── POST /api/job/accept — driver accepts Pending job from Offers tab ───────
  if (urlPath === '/api/job/accept' && req.method === 'POST') {
    const _ab = await readBody(req);
    let _a = {};
    try { _a = JSON.parse(_ab); } catch (e) {}
    const _aJob = parseInt(_a.jobId || _a.bookingId || _a.BookingId || 0) || 0;
    let _aDrv = String(_a.driverId || _a.DriverId || '').trim();
    const _userKey = String(req.headers['x-user-key'] || req.headers['X-User-Key'] || '').trim();
    if (!_aDrv && _userKey) {
      const _dr = ZONE_DRIVERS.find(d => d && (
        String(d.passforlink || '').trim() === _userKey ||
        String(d.userKey || '').trim() === _userKey
      ));
      if (_dr) _aDrv = String(_dr.driverid || '').trim();
    }
    if (!_aJob || !_aDrv) {
      res.writeHead(400, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: 'jobId and driverId required' }));
      return;
    }
    const _result = await acceptPendingJobByDriver({ bookingId: _aJob, driverId: _aDrv, source: '/api/job/accept' });
    const _status = _result.ok ? 200 : (_result.error_code === 'not_found' ? 404 : 409);
    res.writeHead(_status, JSON_HEADERS);
    res.end(JSON.stringify(_result));
    console.log(`${_status}: POST /api/job/accept #${_aJob} driver=${_aDrv} → ${JSON.stringify({ ok: _result.ok, status: _result.status, queued: _result.queued })}`);
    return;
  }

  // ── POST /api/job/decline — driver declines offer or times out ───────────────
  if (urlPath === '/api/job/decline' && req.method === 'POST') {
    const _db = await readBody(req);
    let _d = {};
    try { _d = JSON.parse(_db); } catch (e) {}
    const _dJob = parseInt(_d.jobId || _d.bookingId || 0) || 0;
    let _dDrv = String(_d.driverId || '').trim();
    const _userKeyD = String(req.headers['x-user-key'] || req.headers['X-User-Key'] || '').trim();
    if (!_dDrv && _userKeyD) {
      const _drd = ZONE_DRIVERS.find(d => d && String(d.passforlink || '').trim() === _userKeyD);
      if (_drd) _dDrv = String(_drd.driverid || '').trim();
    }
    const _result = await driverDeclineJob({
      bookingId: _dJob,
      driverId: _dDrv,
      originalStatus: _d.originalStatus,
      timedOut: !!_d.timedOut,
      source: '/api/job/decline',
    });
    const _status = _result.ok ? 200 : (_result.error_code === 'not_found' ? 404 : 409);
    res.writeHead(_status, JSON_HEADERS);
    res.end(JSON.stringify(_result));
    console.log(`${_status}: POST /api/job/decline #${_dJob} driver=${_dDrv} timedOut=${!!_d.timedOut} → ${JSON.stringify({ ok: _result.ok, status: _result.status })}`);
    return;
  }

  // ── POST /api/job/recall — driver recall with originalStatus routing ─────────
  if (urlPath === '/api/job/recall' && req.method === 'POST') {
    const _rb = await readBody(req);
    let _r = {};
    try { _r = JSON.parse(_rb); } catch (e) {}
    const _rJob = parseInt(_r.jobId || _r.bookingId || 0) || 0;
    let _rDrv = String(_r.driverId || '').trim();
    const _userKeyR = String(req.headers['x-user-key'] || req.headers['X-User-Key'] || '').trim();
    if (!_rDrv && _userKeyR) {
      const _drr = ZONE_DRIVERS.find(d => d && String(d.passforlink || '').trim() === _userKeyR);
      if (_drr) _rDrv = String(_drr.driverid || '').trim();
    }
    const _result = await driverRecallJob({
      bookingId: _rJob,
      driverId: _rDrv,
      originalStatus: _r.originalStatus,
      source: '/api/job/recall'
    });
    res.writeHead(_result.ok ? 200 : 404, JSON_HEADERS);
    res.end(JSON.stringify(_result));
    return;
  }

  // ── POST /api/job/complete — driver trip/payment complete (no dispatcher session) ─
  if (urlPath === '/api/job/complete' && req.method === 'POST') {
    const _cb = await readBody(req);
    let _c = {};
    try { _c = JSON.parse(_cb); } catch (e) {}
    const _cJob = parseInt(_c.jobId || _c.bookingId || 0) || 0;
    let _cDrv = String(_c.driverId || '').trim();
    const _userKeyC = String(req.headers['x-user-key'] || req.headers['X-User-Key'] || '').trim();
    if (!_cDrv && _userKeyC) {
      const _drc = ZONE_DRIVERS.find(d => d && String(d.passforlink || '').trim() === _userKeyC);
      if (_drc) _cDrv = String(_drc.driverid || '').trim();
    }
    const _payload = (_c.payload && typeof _c.payload === 'object') ? _c.payload : _c;
    const _result = await completeBooking({
      bookingId: _cJob,
      companyId: _c.companyId || _payload.companyId,
      fare: _c.fare ?? _payload.fare ?? _payload.totalFare,
      distance: _c.distance ?? _payload.distance ?? _payload.distanceKm,
      payload: _payload,
      by: 'driver',
      source: '/api/job/complete',
    });
    const _status = _result.ok ? 200 : (_result.error_code === 'not_found' ? 404 : 409);
    res.writeHead(_status, JSON_HEADERS);
    res.end(JSON.stringify(_result));
    console.log(`${_status}: POST /api/job/complete #${_cJob} driver=${_cDrv} → ${JSON.stringify({ ok: _result.ok, status: _result.status })}`);
    return;
  }

  // ── POST /api/cancel — §FIX-CB unified cancel REST endpoint ─────────────────
  // Body: { bookingId, companyId, reason?, cancelledBy: passenger|driver|dispatcher|website }
  // Customer Web / server-to-server: X-Admin-Key header (BW_ADMIN_KEY env var).
  // Dispatcher console: BW_SID session cookie (cancelledBy must be "dispatcher").
  // Idempotent — re-cancelling returns { idempotent: true }.
  if (urlPath === '/api/cancel' && req.method === 'POST') {
    const _ccBody = await readBody(req);
    let _cc = {};
    try { _cc = JSON.parse(_ccBody); } catch(e) {}
    const _ccBooking = parseInt(_cc.bookingId || _cc.BookingId || 0) || 0;
    const _ccBy = String(_cc.cancelledBy || _cc.by || '').toLowerCase().trim();
    const _ccReason = String(_cc.reason || '');
    const _ccCidBody = String(_cc.companyId || _cc.cid || '').trim();
    const _ccAllowed = new Set(['passenger', 'driver', 'dispatcher', 'website']);
    if (!_ccBooking || !_ccAllowed.has(_ccBy)) {
      res.writeHead(400, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error_code: 'bad_request', error: 'bookingId and cancelledBy ∈ {passenger,driver,dispatcher,website} required' }));
      return;
    }
    const _ccJob = jobStore.find(j => j && j.Id === _ccBooking) || closedJobStore.find(j => j && j.Id === _ccBooking) || null;
    // Auth — dispatcher uses session cookie; Customer Web / other callers require X-Admin-Key.
    let _ccCid = '';
    if (_ccBy === 'dispatcher') {
      _ccCid = getSessionCompanyId(req) || _ccCidBody;
      if (!_ccCid) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'auth_failed', error: 'dispatcher session required' }));
        return;
      }
      if (_ccJob && _ccJob.companyId && String(_ccJob.companyId) !== String(_ccCid)) {
        res.writeHead(403, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'forbidden', error: 'cross-tenant cancel forbidden' }));
        return;
      }
    } else {
      const _ccKey = String(req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '').trim();
      const _adminSecret = process.env.BW_ADMIN_KEY || ADMIN_KEY;
      if (!_ccKey || _ccKey !== _adminSecret) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'auth_failed', error: 'X-Admin-Key header required (BW_ADMIN_KEY)' }));
        return;
      }
      _ccCid = _ccCidBody || (_ccJob ? String(_ccJob.companyId || '') : '');
      if (!_ccCid) {
        res.writeHead(400, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'bad_request', error: 'companyId required' }));
        return;
      }
      if (_ccJob && _ccJob.companyId && String(_ccJob.companyId) !== String(_ccCid)) {
        res.writeHead(403, JSON_HEADERS);
        res.end(JSON.stringify({ ok: false, error_code: 'forbidden', error: 'companyId does not match booking tenant' }));
        return;
      }
    }
    const _ccDriverFault = (_ccBy === 'driver');
    const _ccRecall      = (_ccBy === 'driver');
    const _ccResult = await cancelBooking({
      bookingId: _ccBooking, cancelledBy: _ccBy, reason: _ccReason,
      driverFault: _ccDriverFault, recallToPending: _ccRecall,
      companyId: _ccCid, source: 'api/cancel/' + _ccBy
    });
    const _ccStatus = _ccResult.ok ? 200 : (_ccResult.error_code === 'not_found' ? 404 : 400);
    console.log(`${_ccStatus}: POST /api/cancel bookingId=${_ccBooking} cid=${_ccCid} by=${_ccBy} -> ${JSON.stringify({ ok: _ccResult.ok, idempotent: _ccResult.idempotent, error_code: _ccResult.error_code })}`);
    res.writeHead(_ccStatus, JSON_HEADERS);
    res.end(JSON.stringify(_ccResult));
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
    console.log('[job/create] received:', JSON.stringify(_cjData));

    const _cjCid     = ((_cjData.companyId) || '').toString().trim();
    const _cjSource  = ((_cjData.source)    || 'dispatch').toString().toLowerCase().trim();
    const _cjPax     = _cjData.passenger || {};
    const _cjPick    = _normalizeLocationFromCreateBody(_cjData, 'pickup');
    const _cjDrop    = _normalizeLocationFromCreateBody(_cjData, 'dropoff');
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
    if (!_jobHasValidPickup({ PickAddress: _cjPick.address, PickLatLng: `${_cjPick.lat || 0},${_cjPick.lng || 0}` })) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'pickup address or coordinates are required' }));
      return;
    }

    // Always allocate a brand-new booking ID — never match or reuse by pickup address.
    let _cjIdNum = newCompanyJobId(_cjCid);
    while (_jobExistsInStore(_cjIdNum, _cjCid)) {
      console.log(`[/api/job/create] ID ${_cjIdNum} already in store — allocating next (never dedupe by address)`);
      _cjIdNum = newCompanyJobId(_cjCid);
    }
    const _cjIdStr = String(_cjIdNum);
    const _cjCreated = Date.now();
    const _cjNow     = new Date().toISOString();

    // §FIX-HAIL — hail trips arrive driver-attached AND mid-trip (meter already
    // running, passenger already in car — the driver is the creator). When
    // driverId+vehicleId are supplied on a hail create, start the booking in
    // 'Active' (in-trip) with the driver already attached, so completion via
    // /api/job/command runs the standard Active → Completed transition
    // without any intermediate assign/accept/start-meter round-trips.
    //
    // Driver-app contract: hail complete MUST use POST /api/job/command with
    // {command:'complete', by:'driver', bookingId, ifVersion:1, payload:{...}}.
    // The legacy /api/job/sync-offline-trip path will NOT find this booking in
    // the expected 'Pending' shape and will silently fail. Driver-app teams:
    // migrate your hail complete handler before next test run.
    const _cjDriverId  = ((_cjData.driverId)  || '').toString().trim();
    const _cjVehicleId = ((_cjData.vehicleId) || '').toString().trim();
    const _cjPreAssigned = _cjSource === 'hail' && _cjDriverId && _cjVehicleId;
    const _cjInitialStatus = _cjPreAssigned ? 'Active' : 'Pending';

    const _cjJob = {
      Id:                 _cjIdNum,
      companyId:          _cjCid,
      BookingStatus:      _cjInitialStatus,
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
      DriverId:           _cjPreAssigned ? _cjDriverId  : 0,
      VehicleId:          _cjPreAssigned ? _cjVehicleId : 0,
      AssignedDriverId:   _cjPreAssigned ? _cjDriverId  : undefined,
      AssignedVehicleId:  _cjPreAssigned ? _cjVehicleId : undefined,
      DriverAcceptedAt:   _cjPreAssigned ? _cjNow : undefined,
      updateSeq:          _cjPreAssigned ? 1 : 0,
      lastUpdatedAt:      _cjCreated,
      lastUpdatedBy:      _cjPreAssigned ? 'driver' : 'system',
      Passengers:         parseInt(_cjData.passengers || '1') || 1,
      Bags:               parseInt(_cjData.bags       || '0') || 0,
      WheelChairs:        parseInt(_cjData.wheelchairs || '0') || 0,
      DispatchTimebefore: '0',
      VehiclesReguired:   1,
      EstimatedDistance:  ((_cjData.distance) || '0').toString(),
      EstimatedTime:      ((_cjData.duration) || '0').toString(),
      AccountId:          '',
      VehicleNo:          _cjPreAssigned ? _cjVehicleId : null,
      CallSign:           _cjPreAssigned ? _cjVehicleId : null,
      webstatus:          '0',
      createdAt:          _cjCreated,
      createdVia:         '/api/job/create',
    };

    // For "dispatch" source, InsertBookingv4 follows with full form data.
    // Push a Pending stub to jobStore + Firebase so the job appears in U-A immediately
    // and is not lost if InsertBookingv4 is delayed.
    if (_cjSource === 'dispatch') {
      _cjJob.BookingSource = 'Dispatch Console';
      _cjJob.createdVia = '/api/job/create';
      if (!_tryPushJobToStore(_cjJob, '/api/job/create')) {
        console.warn(`[/api/job/create] dispatch stub push failed for #${_cjIdNum} — InsertBookingv4 will create fresh row`);
      }
      (async () => {
        try {
          const _tokD = await getFirebaseServerToken();
          if (!_tokD || !_cjCid) return;
          const _fbStub = {
            BookingId: String(_cjIdNum),
            CompanyId: _cjCid,
            Status: 'Pending',
            BookingStatus: 'Pending',
            Name: _cjJob.Name || '',
            PassengerName: _cjJob.Name || '',
            PhoneNo: _cjJob.PhoneNo || '',
            PickAddress: _cjJob.PickAddress || '',
            DropAddress: _cjJob.DropAddress || '',
            PickLatLng: _cjJob.PickLatLng || '',
            DropLatLng: _cjJob.DropLatLng || '',
            serviceType: 'taxi',
            BookingSource: 'Dispatch Console',
            createdAt: _cjCreated,
          };
          await firebaseDbSet(`pendingjobs/${_cjCid}/${_cjIdNum}`, _fbStub, _tokD);
        } catch (_e) {
          console.warn(`  [/api/job/create] dispatch pendingjobs stub failed: ${_e && _e.message}`);
        }
      })();
    } else {
      if (_jobExistsInStore(_cjIdNum, _cjCid)) {
        res.writeHead(409, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: 'job already exists', bookingId: _cjIdNum }));
        return;
      }
      if (!_tryPushJobToStore(_cjJob, '/api/job/create')) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: 'invalid job data' }));
        return;
      }
    }

    // §FIX-HAIL/2 — when a hail booking arrives driver-attached + Active, fan out
    // to the same Firebase paths a normal Assigned booking would touch, plus the
    // in-memory ZONE_DRIVERS record, so the dispatch console's driver popover
    // and pendingjobs board immediately reflect the in-progress trip. Without
    // this, the zone summary counts the job but the popover Vehicle / BookingId
    // / Location fields stay blank.
    if (_cjPreAssigned) {
      const _hCid = _cjCid;
      const _hVid = _cjVehicleId;
      const _hDrv = _cjDriverId;
      const _hBid = _cjIdNum;

      // 1) ZONE_DRIVERS in-memory — popover reads BookingId/jobpickup/jobdropoff/jobCount/JobphoneNo from here.
      try {
        const _zdH = ZONE_DRIVERS.find(d =>
          (String(d.driverid).trim() === String(_hDrv).trim() ||
           String(d.VehicleId).trim() === String(_hVid).trim()) &&
          d.companyId && String(d.companyId) === String(_hCid));
        if (_zdH) {
          // Idempotency guard — only increment jobCount if this BookingId wasn't
          // already attached to the driver (retry-safe; create endpoint has no
          // clientRequestId dedup yet).
          const _alreadyAttached = String(_zdH.BookingId || '') === String(_hBid);
          _zdH.BookingId    = String(_hBid);
          _zdH.jobpickup    = _cjJob.PickAddress || '';
          _zdH.jobdropoff   = _cjJob.DropAddress || '';
          _zdH.JobphoneNo   = _cjJob.PhoneNo     || '';
          _zdH.jobname      = _cjJob.Name        || '';
          if (!_alreadyAttached) {
            _zdH.jobCount   = (parseInt(_zdH.jobCount) || 0) + 1;
          }
          _zdH.vehiclestatus = 'Busy';
          console.log(`  [/api/job/create] §FIX-HAIL/2 ZONE_DRIVERS ${_hDrv} → BookingId=${_hBid} status=Busy jobCount=${_zdH.jobCount}${_alreadyAttached ? ' (idempotent)' : ''}`);
        } else {
          console.log(`  [/api/job/create] §FIX-HAIL/2 driver ${_hDrv} not in ZONE_DRIVERS — popover sync skipped`);
        }
      } catch (_e) {
        console.warn(`  [/api/job/create] §FIX-HAIL/2 ZONE_DRIVERS update failed: ${_e && _e.message}`);
      }

      // 2) Firebase fanout — fire-and-forget so we don't block the response.
      (async () => {
        try {
          const _tokH = await getFirebaseServerToken();
          if (!_tokH) {
            console.warn(`  [/api/job/create] §FIX-HAIL/2 no Firebase token — fanout skipped for #${_hBid}`);
            return;
          }
          const _fbBooking = {
            bookingId:       String(_hBid),
            status:          'Active',
            BookingStatus:   'Active',
            companyId:       _hCid,
            driverId:        _hDrv,
            vehicleId:       _hVid,
            DriverId:        _hDrv,
            VehicleNo:       _hVid,
            CallSign:        _hVid,
            name:            _cjJob.Name        || '',
            PassengerName:   _cjJob.Name        || '',
            phoneNo:         _cjJob.PhoneNo     || '',
            PhoneNo:         _cjJob.PhoneNo     || '',
            pickAddress:     _cjJob.PickAddress || '',
            PickAddress:     _cjJob.PickAddress || '',
            pickLatLng:      _cjJob.PickLatLng  || '',
            dropAddress:     _cjJob.DropAddress || '',
            DropAddress:     _cjJob.DropAddress || '',
            dropLatLng:      _cjJob.DropLatLng  || '',
            paymentMethod:   (_cjData && _cjData.paymentMethod) || '',
            bookingSource:   _cjSource,
            createdAt:       _cjCreated,
            DriverAcceptedAt: _cjNow,
            updateSeq:       1
          };
          await Promise.all([
            firebaseDbSet(`pendingjobs/${_hCid}/${_hBid}`, _fbBooking, _tokH)
              .catch(e => console.warn(`  [/api/job/create] §FIX-HAIL/2 pendingjobs write failed: ${e && e.message}`)),
            firebaseDbSet(`allbookings/${_hCid}/${_hBid}`, _fbBooking, _tokH)
              .catch(e => console.warn(`  [/api/job/create] §FIX-HAIL/2 allbookings write failed: ${e && e.message}`)),
            firebaseDbPatch(`online/${_hCid}/${_hVid}/current`, {
              currentJobId: String(_hBid),
              jobId:        String(_hBid),
              joboffer:     0,
              jobpickup:    _cjJob.PickAddress || '',
              jobdropoff:   _cjJob.DropAddress || '',
              JobphoneNo:   _cjJob.PhoneNo     || '',
              jobname:      _cjJob.Name        || '',
              vehiclestatus: 'Busy'
            }, _tokH).catch(e => console.warn(`  [/api/job/create] §FIX-HAIL/2 online/current patch failed: ${e && e.message}`))
          ]);
          console.log(`  [/api/job/create] §FIX-HAIL/2 Firebase fanout complete for #${_hBid} (pendingjobs+allbookings+online/${_hVid}/current)`);
          // Booking lifecycle event so any listeners see the Active create.
          _writeBookingEvent(_hCid, _hBid, 'StatusChanged',
            { from: null, to: 'Active', driverId: _hDrv, vehicleId: _hVid, action: 'created', source: 'hail' },
            'driver', 1).catch(() => {});
        } catch (_e) {
          console.warn(`  [/api/job/create] §FIX-HAIL/2 fanout failed: ${_e && _e.message}`);
        }
      })();
    }

    const _cjResult = { ok: true, jobId: _cjIdStr, bookingId: _cjIdNum, createdAt: _cjCreated };
    console.log('[job/create] result:', JSON.stringify(_cjResult));
    try { console.time(`booking-gap-${_cjIdStr}`); } catch(e) {}
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(_cjResult));
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
      const _cid = String(sessionCompanyId);
      // Strict tenant isolation — jobs with missing/empty companyId are never visible.
      return store.filter(j => j && j.companyId && String(j.companyId) === _cid);
    }
    // Helper: return only drivers belonging to this company.
    function companyDrivers(store) {
      if (!sessionCompanyId) return [];
      const _cid = String(sessionCompanyId);
      return store.filter(d => d && d.companyId && String(d.companyId) === _cid);
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
      // Messaging — local handlers; never proxy (avoids 401 when production session expires)
      'RetrieveAlarms', 'AllAlarms', 'RetrieveAlarts', 'RetrieveAlerts', 'GetAlarms', 'GetAlerts',
      '[RetrieveMessages]',
      '[MessageInsert]', '[DriverMessageInsert]', '[BroadcastMessage]',
      '[GroupMessage]', '[DeleteMessage]',
      // Admin
      '[KickDriver]', '[DispatcherKickUsers]', '[GetSuspendedDrivers]', '[UnsuspendDriver]', '[UpdateSuspensionTime]', '[UpdateQueueNo]',
      '[ZonesListUpdate]', '[payment_percentage]', '[storeemergency]',
      '[CancelJobStatusFromJobList]', '[QuickSetNoOne]', '[QuickSetPending]',
      '[TariffSync]',
      '[QueueJob]', '[RecallQueuedJob]', '[GetQueuedJobs]', '[PromoteQueuedToAssigned]',
      // Payments
      '[InsertPassengerBalance]', '[GetPassengerBalance]',
      // Web / Passenger bookings — all handled locally
      '[IngestPassengerJob]', '[UpdateScheduledLeadTime]',
      // Booking writes — real backend has no session, proxy attempt just adds 8s of dead wait
      'InsertBookingv4', '[ProcUpdateJobv6]',
      // Vehicle lookup for the dispatch form — local handler returns the live driver's
      // vehicle from ZONE_DRIVERS so the dropdown can't show a stranger's vehicle/callsign
      '[RetrieveVehicle]',
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
          _respondDataManagerProxyError(res, action, 'session_expired', bodyText.slice(0, 200));
          return;
        }
        _respondDataManagerProxyError(res, action, 'backend_unavailable', `status=${proxied.statusCode}`);
        return;
      } catch (proxyErr) {
        _respondDataManagerProxyError(res, action, 'backend_unavailable', proxyErr.message);
        return;
      }
    }

    // ── /DataSelectorRide — booking write operations ────────────────────────
    if (urlPath.includes('/DataSelectorRide')) {
      if (action === 'InsertBookingv4') {
        (async () => {
        try {
        let newId = parseInt(param('ExternalJobId') || '', 10) || newCompanyJobId(sessionCompanyId || '000');
        try { console.timeEnd(`booking-gap-${newId}`); } catch(e) {}
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
        const _dIdParsed = _parseInsertDriverIdParam(param('DId'));
        const driverIdStr = _dIdParsed.driverId;
        const hasAssignedDriver = _dIdParsed.hasDriver;
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

        const bookstatus = _dIdParsed.bookstatus;
        const _resolvedAtCreate = hasAssignedDriver
          ? _resolveDriverVehicleIds(driverIdStr, vehicleId)
          : null;
        const _createDrvId = _resolvedAtCreate
          ? (_normalizeNotifyDriverId(_resolvedAtCreate.driverId) || _resolvedAtCreate.driverId)
          : driverIdStr;
        let newJob = {
          Id: newId, AccountId: '', VehicleNo: null, CallSign: null,
          useremail: null, usertype: null, webstatus: '0',
          Name: name, PhoneNo: phone,
          BookingDateTime: bookingDT,
          Pickingtime: pickingDT,
          Recieve_payment: param('Recieve_payment') || '',
          DispatchTimebefore: String(dispatchBefore),
          VehicleId: _resolvedAtCreate ? _resolvedAtCreate.vehicleId : vehicleId,
          DriverId: _createDrvId,
          AssignedDriverId: hasAssignedDriver ? _createDrvId : undefined,
          DispatcherName: dispatcherName,
          Nextstop: String(param('nextstop') || '0'), nextstopdata: param('nextstopdata') || '',
          Passengers: passengers, passengername: name || '', PassengerName: name || '',
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
          updateSeq: 1,
          // §99 — createdAt (Unix ms) so wait-timer formula works: Math.floor((Date.now()-createdAt)/60000)
          createdAt: Date.now(),
          // ScheduledFor (UTC ms) for pre-booked jobs — used by calcJobMins so the
          // displayed countdown is correct regardless of server/client timezone.
          ...(_scheduledMs1 && dispatchBefore > 0 ? { ScheduledFor: _scheduledMs1 } : {}),
          ...(hasAssignedDriver ? {
            manualOffer: true,
            originalStatus: 'manual',
            offeredAt: Date.now(),
            VehicleNo: _resolvedAtCreate.vehicleId,
            CallSign: _resolvedAtCreate.vehicleId,
          } : {}),
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
        const _insertExistIdx = jobStore.findIndex(j => j && j.Id === newId);
        if (_insertExistIdx >= 0 && jobStore[_insertExistIdx].createdVia === '/api/job/create') {
          Object.assign(jobStore[_insertExistIdx], newJob);
          newJob = jobStore[_insertExistIdx];
        } else if (_insertExistIdx >= 0) {
          const _freshId = newCompanyJobId(sessionCompanyId || '000');
          newJob.Id = _freshId;
          jobStore.push(newJob);
          newId = _freshId;
        } else {
          jobStore.push(newJob);
        }
        saveJobStore();
        if (sessionCompanyId) {
          _writeBookingEvent(sessionCompanyId, newId, 'StatusChanged',
            { from: null, to: bookstatus, action: 'created', source: 'InsertBookingv4' },
            'dispatcher', 1).catch(() => {});
        }
        // §97 — Write to Firebase pendingjobs so the auto-assign engine can find console jobs.
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
            createdAt:        newJob.createdAt,
            CreatedAt:        new Date(newJob.createdAt).toISOString(),
            WebBooking:       false,
            Pickingtime:      String(newJob.BookingDateTime || ''),
            TarriffType:      String(newJob.TarriffType || ''),
            CustomeRate:      String(newJob.CustomeRate || ''),
            Account_Name:     String(newJob.Account_Name || ''),
            ...(hasAssignedDriver && _resolvedAtCreate ? {
              DriverId:       _createDrvId,
              AssignedDriver: _createDrvId,
              VehicleId:      _resolvedAtCreate.vehicleId,
              BookingStatus:  bookstatus,
              manualOffer:    true,
              originalStatus: 'manual',
            } : {}),
          };
          try {
            const _fbTok = await getFirebaseServerToken();
            if (_fbTok) {
              await Promise.all([
                firebaseDbSet(`pendingjobs/${sessionCompanyId}/${newId}`, _fbPendingJob1, _fbTok),
                firebaseDbSet(`allbookings/${sessionCompanyId}/${newId}`, _fbPendingJob1, _fbTok),
              ]);
              console.log(`  [InsertBookingv4] Firebase pendingjobs+allbookings/${sessionCompanyId}/${newId} written`);
            }
          } catch (e) {
            console.warn(`  [InsertBookingv4] Firebase pendingjobs/allbookings write failed (non-fatal): ${e && e.message}`);
          }
        }

        // Await driver offer fanout before responding — same path as U-A assign.
        if (hasAssignedDriver) {
          const _drv = _resolvedAtCreate || _resolveDriverVehicleIds(driverIdStr, vehicleId);
          try {
            await _writeManualDriverOffer(newJob, _drv.driverId, _drv.vehicleId, 'dispatcher', 'InsertBookingv4');
          } catch (e) {
            console.warn(`  [InsertBookingv4] driver offer fanout failed (non-fatal): ${e && e.message}`);
          }
        }

        console.log(`200: POST ${urlPath} [action=InsertBookingv4] -> created job #${newId} (${bookingDT} → sched ${_scheduledMs1 ? new Date(_scheduledMs1).toISOString() : 'ASAP'}) companyId=${sessionCompanyId}`);
        arrayD(res, [{ Result: 'Booking Information Successfully Submitted', BookingStatus: bookstatus, BookingId: newId }]);
        } catch (err) {
          console.error('[InsertBookingv4] error:', err);
          arrayD(res, [{ Result: 'Error: ' + (err && err.message ? err.message : 'InsertBookingv4 failed'), Error: true }]);
        }
        })();
        return;
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
          const _closePrevStatus = job.BookingStatus;
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
          _bumpSeqAndEmitStatus(job, _closePrevStatus, 'dispatcher', 'UpdateBooking', { action: 'complete' });
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
        try { console.timeEnd(`booking-gap-${newId}`); } catch(e) {}
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
          Passengers: passengers, passengername: name || '', PassengerName: name || '',
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
          updateSeq: 1,
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
        if (sessionCompanyId) {
          _writeBookingEvent(sessionCompanyId, newId, 'StatusChanged',
            { from: null, to: bookstatus, action: 'created', source: action },
            'dispatcher', 1).catch(() => {});
        }
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
            // §FIXED-PRICE / pickup-time / account name — driver app reads these
            // to suppress the meter on fixed-price jobs and display scheduled pickup.
            Pickingtime:      String(newJob.BookingDateTime || ''),
            TarriffType:      String(newJob.TarriffType || ''),
            CustomeRate:      String(newJob.CustomeRate || ''),
            Account_Name:     String(newJob.Account_Name || ''),
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
          // §FIX-UB — shallow snapshot of job BEFORE any mutation so we can
          // compute a real field-level diff once the handler has applied the
          // edit + §FIX-A/A2/D/O status guards.
          const _ubPreSnapshot = Object.assign({}, job);
          const _rawDId3  = parseInt(param('DId') || '0') || 0;
          const driverId  = (_rawDId3 === -1) ? -1 : Math.max(0, _rawDId3);
          const vehicleId = parseInt(param('VId') || '0') || 0;
          if (param('PickLocation'))    job.PickAddress    = param('PickLocation');
          if (param('DropLocation'))    job.DropAddress    = param('DropLocation');
          if (param('PickLatLng'))      job.PickLatLng     = param('PickLatLng');
          if (param('DropLatLng'))      job.DropLatLng     = param('DropLatLng');
          if (param('Name')) {
            job.Name           = param('Name');
            // List rows render {{value.passengername}}, the driver app reads PassengerName.
            // Mirror Name into both aliases so all booking types (taxi/food/freight/rentals/towing/ACC/account/web)
            // show the updated passenger name everywhere after an edit.
            job.passengername  = param('Name');
            job.PassengerName  = param('Name');
          }
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
          // Never overwrite DriverId/VehicleId/BookingStatus for Assigned/Active/Picking jobs UNLESS
          // the dispatcher explicitly selected "No One" (DId=-1 + bookstatus="No One") in the edit
          // form, which is an intentional unassign action — the job should leave the live state and
          // return to Unassigned tagged as 'No One' so dispatchers can see it was manually released.
          const editableStatuses = new Set(['Pending','Offered','Unreached','No One','']);
          const _clientBookstatus = String(param('bookstatus') || '').trim();
          const _explicitNoOne   = (driverId === -1) && (_clientBookstatus === 'No One');
          // §FIX-A2 — dispatcher explicitly chose "Pending" in the Edit form's driver dropdown
          // (frontend sets DriveId='0' + bookstatus='Pending' when $scope.selecteddriver === -2).
          // This is an intentional "send back to Pending" action and must bypass the §FIX-A
          // No-One guard below. We require driverId <= 0 to avoid accidentally honouring
          // 'Pending' alongside a real driver pick.
          const _explicitPending = (driverId <= 0) && (_clientBookstatus === 'Pending');
          const _prevBStatus_diag = job.BookingStatus || '';
          console.log(`[§FIX-NoOneTrace/ProcUpdateJobv6] job#${jobId} prevStatus='${_prevBStatus_diag}' incomingDId=${_rawDId3} parsedDriverId=${driverId} clientBookstatus='${_clientBookstatus}' editable=${editableStatuses.has(_prevBStatus_diag)} explicitNoOne=${_explicitNoOne} bookingSource='${job.BookingSource || ''}' referer='${(req.headers && req.headers.referer) || ''}'`);
          if (editableStatuses.has(job.BookingStatus || '')) {
            // §FIX-A — Bug A guard. Two observed malformed reassign POSTs from the dispatch
            // console Edit form (incomingDId=-2 with bookstatus='Pending'; incomingDId=undefined
            // with bookstatus='Offered') were silently demoting "No One" → "Pending". A No-One
            // job must only leave "No One" when (a) the dispatcher explicitly picked a real
            // driver (driverId > 0) or (b) explicitly re-confirmed "No One" via the unassign
            // action (handled in the _explicitNoOne branch below). Any other ambiguous payload
            // is treated as a malformed UI submit — keep the prior status, log, and respond OK
            // so the UI doesn't spin.
            if (_prevBStatus_diag === 'No One' && driverId <= 0 && !_explicitNoOne && !_explicitPending) {
              console.log(`[§FIX-A/ProcUpdateJobv6] *** BLOCKED No One → Pending demote *** job#${jobId} incomingDId=${_rawDId3} parsedDriverId=${driverId} clientBookstatus='${_clientBookstatus}' — keeping No One, ignoring driver/vehicle/status assignment from this POST.`);
              // Leave job.BookingStatus / DriverId / VehicleId unchanged.
            } else if (_explicitPending) {
              // §FIX-A2 — honour explicit Pending choice. Clear driver/vehicle and set Pending.
              // §FIX-O — also clear releasedAt + manualOffer. The dispatcher's explicit "back to
              // Pending" is a deliberate decision; the §FIX-G 10s releasedAt cooldown (stamped by
              // a prior UnAssignJobStatusFromJobList) would otherwise hide this job from
              // auto-dispatch for up to 10 s after the Edit save, even though the dispatcher
              // wants it dispatched immediately. manualOffer is cleared so any future Unreached
              // timeout (§FIX-M) is treated as a normal auto-dispatch failure, not a manual-pick.
              console.log(`[§FIX-A2/ProcUpdateJobv6] §FIX-O explicit Pending: job#${jobId} prevStatus='${_prevBStatus_diag}' incomingDId=${_rawDId3} clientBookstatus='Pending' — setting BookingStatus='Pending', clearing driver/vehicle/releasedAt/manualOffer.`);
              job.VehicleId     = 0;
              job.DriverId      = 0;
              job.BookingStatus = 'Pending';
              job.releasedAt    = null;
              job.manualOffer   = false;
            } else {
              // §FIX-EDIT-PRESERVE — Metadata-only edit guard.
              //
              // The dispatch console's Edit dialog re-uses one POST for two very
              // different intents:
              //   (a) Reassignment — dispatcher explicitly picks a different
              //       driver (or "No One" / "Pending"); the form posts a real
              //       DId/VId/bookstatus.
              //   (b) Metadata edit — dispatcher only changes passenger name,
              //       phone, pickup, dropoff, time, passenger count, etc. The
              //       Edit dialog's driver dropdown is NOT re-populated with
              //       the current assignment, so the form posts DId='0'/VId='0'
              //       with no bookstatus override.
              //
              // Without this guard, (b) was misread as "send job back to
              // Pending with no driver". For a job currently Offered/Assigned/
              // Picking/Active that flip:
              //   1. Wiped DriverId/VehicleId on the server (closedJobStore for
              //      job #6112605206 shows AssignedDriverId="" after a name+
              //      phone edit while D002 had already accepted).
              //   2. Browser AngularJS saw the assignment vanish and wrote
              //      rideStatus/Recalled — driver app started re-offer loop.
              //   3. smartAutoDispatch re-offered to the same driver as if it
              //      were a fresh job; driver phone dismissed it; 27s no-
              //      response timeout fired; eventually marked Cancelled.
              //
              // The correct behaviour for (b) is: keep DriverId / VehicleId /
              // BookingStatus untouched. Only the metadata fields above
              // (Name, PhoneNo, addresses, time, passenger count) are applied,
              // and the §FIX-UB Firebase fan-out at ~7460 + the JobUpdated
              // notification at ~7508 deliver those changes to the driver app
              // without disturbing the assignment.
              //
              // Detection: treat the POST as metadata-only when the client
              // sent no DId (or DId=0), no VId (or VId=0), AND no explicit
              // bookstatus override, AND the job currently has a live driver
              // attached (DriverId > 0). Any one of those three not being
              // blank indicates a real reassign intent and we fall through to
              // the legacy behaviour.
              const _editRawDId      = param('DId');
              const _editRawVId      = param('VId');
              const _editDIdMissing  = (_editRawDId === undefined || _editRawDId === '' || _rawDId3 === 0);
              const _editVIdMissing  = (_editRawVId === undefined || _editRawVId === '' || vehicleId === 0);
              // §FIX-EDIT-PRESERVE/2 (May 2026) — Edit dialog launched from
              // the Assign-tab card pre-populates the driver dropdown with
              // the current driver, so DId/VId arrive populated (not blank).
              // The original blank-only guard fell through to the legacy
              // reassign branch and flipped BookingStatus to 'Offered',
              // making the driver app show Cancel→re-Offer when the
              // dispatcher only added a dropoff address. Treat "same driver
              // / same vehicle as currently assigned" as equivalent to
              // blank — a true reassign comes in with a different driver.
              const _curDrvStr  = String(job.DriverId  || '').trim();
              const _curVehStr  = String(job.VehicleId || '').trim();
              const _postDIdStr = String(_editRawDId   || '').trim();
              const _postVIdStr = String(_editRawVId   || '').trim();
              const _editDIdSameOrMissing = _editDIdMissing || (_curDrvStr !== '' && _postDIdStr === _curDrvStr);
              const _editVIdSameOrMissing = _editVIdMissing || (_curVehStr !== '' && _postVIdStr === _curVehStr);
              const _editStatusBlank = (_clientBookstatus === '');
              const _editHasLiveDrv  = (parseInt(job.DriverId) || 0) > 0;
              const _editIsMetaOnly  = _editDIdSameOrMissing && _editVIdSameOrMissing && _editStatusBlank && _editHasLiveDrv;
              if (_editIsMetaOnly) {
                console.log(`[§FIX-EDIT-PRESERVE/ProcUpdateJobv6] job#${jobId} prevStatus='${_prevBStatus_diag}' metadata-only edit (DId/VId/bookstatus all blank, current driver=${job.DriverId} vehicle=${job.VehicleId}) — preserving assignment + status, applying only metadata changes.`);
                // Do NOT touch job.DriverId, job.VehicleId, or job.BookingStatus.
                // The metadata fields (Name/Phone/addresses/time/etc.) were
                // already applied at ~7143-7173 above.
              } else {
                job.VehicleId = vehicleId;
                job.DriverId  = driverId;
                if (driverId > 0)       job.BookingStatus = 'Offered';
                else if (driverId === -1) job.BookingStatus = 'No One';
                else                     job.BookingStatus = 'Pending';
                if (_prevBStatus_diag === 'No One' && job.BookingStatus === 'Pending') {
                  // Defence-in-depth: this branch should now be unreachable for No-One jobs.
                  console.log(`[§FIX-NoOneTrace/ProcUpdateJobv6] *** SMOKING GUN *** job#${jobId} FLIPPED No One → Pending (driverId=${driverId}). Stack:\n${new Error().stack}`);
                }
              }
            }
          } else if (_explicitNoOne) {
            // §FIX-D — dispatcher explicitly chose "No One" while editing a live (Assigned/Picking/
            // Active) job. Honor the manual unassign so the job moves to Unassigned as 'No One'
            // (not 'Pending'). FnCancelRide on the client clears the driver's screen.
            const _prevDrvD = job.DriverId;
            console.log(`  [ProcUpdateJobv6] §FIX-D: explicit "No One" on live job #${job.Id} ` +
                        `(was ${job.BookingStatus}, driver ${_prevDrvD}) — unassigning to No One`);
            job.VehicleId      = 0;
            job.DriverId       = -1;
            job.BookingStatus  = 'No One';
            // §FIX-P — same symmetry as [UnAssignJobStatusFromJobList]: restore the previous
            // driver to Available in ZONE_DRIVERS and mirror to Firebase so smartAutoDispatch
            // sees them as Available again. Without this the driver stays Picking/Assigned in
            // online/{cid}/{vid}/current and is filtered out of auto-dispatch.
            if (_prevDrvD && String(_prevDrvD) !== '0' && String(_prevDrvD) !== '-1') {
              const _zdD = ZONE_DRIVERS.find(d => d.driverid === _prevDrvD || d.VehicleId === _prevDrvD);
              if (_zdD) {
                const _rqD = (typeof calcRestoredQueue === 'function')
                  ? calcRestoredQueue(_prevDrvD, _zdD.zonename) : (_zdD.zonequeue || 1);
                _zdD.zonequeue      = _rqD;
                _zdD.queueWaitSince = Date.now();
                _zdD.vehiclestatus  = 'Available';
                _zdD.JobphoneNo     = '';
                _zdD.jobpickup      = '';
                _zdD.jobdropoff     = '';
                _zdD.jobCount       = 0;
                console.log(`  [ProcUpdateJobv6] §FIX-D/P driver ${_prevDrvD} → Available q=${_rqD} zone="${_zdD.zonename}"`);
                const _fbVehD = _zdD.VehicleId || _zdD.vehiclenumber || '';
                if (sessionCompanyId && _fbVehD) {
                  getFirebaseServerToken().then(_tok => {
                    if (!_tok) return;
                    firebaseDbPatch(`online/${sessionCompanyId}/${_fbVehD}/current`, {
                      vehiclestatus: 'Available',
                      jobId:         '',
                      jobpickup:     '',
                      jobdropoff:    '',
                      JobphoneNo:    ''
                    }, _tok).then(() => {
                      console.log(`  [ProcUpdateJobv6] §FIX-D/P Firebase online/${sessionCompanyId}/${_fbVehD}/current → Available (mirrored)`);
                    }).catch(e => {
                      console.log(`  [ProcUpdateJobv6] §FIX-D/P Firebase patch failed: ${e.message}`);
                    });
                    // §FIX-Q — symmetric with the [UnAssignJobStatusFromJobList] site:
                    // notify the driver app that the job has been pulled so it clears
                    // the screen and stops heart-beating Assigned. See block in
                    // [UnAssignJobStatusFromJobList] for the full rationale.
                    const _drvForFbD = String(_prevDrvD || '').trim();
                    if (_drvForFbD && _drvForFbD !== '0' && _drvForFbD !== '-1') {
                      // §FIX-DA-G2 + C2 — write eventType then remove child.
                      const _delUrl = `${FB_DB_URL}/jobs/${sessionCompanyId}/${_fbVehD}/${_drvForFbD}/${job.Id}.json?auth=${encodeURIComponent(_tok)}`;
                      fbRequest(_delUrl, 'PATCH', { eventType: 'cancelled' })
                        .catch(e => console.log(`  [ProcUpdateJobv6] §FIX-D/Q jobs child eventType PATCH failed: ${e.message}`))
                        .then(() => fbRequest(_delUrl, 'DELETE', null))
                        .then(_r => console.log(`  [ProcUpdateJobv6] §FIX-D/Q jobs/${sessionCompanyId}/${_fbVehD}/${_drvForFbD}/${job.Id} → eventType=cancelled then removed [${_r && _r.status}]`))
                        .catch(e => console.log(`  [ProcUpdateJobv6] §FIX-D/Q jobs child remove failed: ${e.message}`));
                      firebaseDbSet(`notification/${_drvForFbD}`, {
                        bookingid: `${job.Id},Job Cancel,${_drvForFbD},Server,Dispatcher`,
                        content:   'Passenger Cancel',
                        // §FIX-DA-G4/G5 — driver-app public contract.
                        eventType: 'cancelled',
                        version:   parseInt(job.updateSeq) || 0,
                        updatedAt: _FB_SERVER_TIMESTAMP,
                        bookingId: job.Id
                      }, _tok)
                        .then(() => console.log(`  [ProcUpdateJobv6] §FIX-D/Q notification/${_drvForFbD} → Job Cancel written`))
                        .catch(e => console.log(`  [ProcUpdateJobv6] §FIX-D/Q notification write failed: ${e.message}`));
                    }
                  });
                }
              }
              if (typeof clearAwayLock === 'function')        clearAwayLock(_prevDrvD);
              if (typeof clearDriverHomeState === 'function') clearDriverHomeState(_prevDrvD);
            }
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

          // ── Fields previously dropped by this handler — now persisted so every
          // ── booking source (dispatcher console, passenger app, website,
          // ── taxi/food/freight/rentals/towing) gets the same treatment on edit.
          if (param('Email') !== undefined)           job.Email           = String(param('Email') || '');
          if (param('Urgent') !== undefined)          job.Urgent          = String(param('Urgent') || 'No');
          if (param('CornerAddress') !== undefined)   job.CornerAddress   = String(param('CornerAddress') || '');
          if (param('Notes') !== undefined)           job.Notes           = String(param('Notes') || '');
          if (param('VRequired') !== undefined)       job.VehiclesReguired= parseInt(param('VRequired')) || 1;
          if (param('ZoneId') !== undefined) {
            const _zid = parseInt(param('ZoneId'));
            if (!isNaN(_zid)) job.ZoneId = _zid;
          }
          if (param('Nextstop') !== undefined)        job.Nextstop        = String(parseInt(param('Nextstop')) || 0);
          if (param('nextstopdata') !== undefined)    job.nextstopdata    = String(param('nextstopdata') || '');
          if (param('Distance') !== undefined)        job.EstimatedDistance = String(param('Distance') || '0');
          if (param('Time') !== undefined)            job.EstimatedTime     = String(param('Time') || '0');
          if (param('EstimatedCost') !== undefined) {
            const _ec = String(param('EstimatedCost') || '');
            job.EstimatedCost = _ec;
            // Auto-tariff jobs use the estimate as the fare; fixed/custom jobs already
            // had RideCost/EstimatedFare set above and must not be clobbered.
            if (!_uCRate && _uTId !== '-1' && (job.TarriffType === 'Automatic' || !job.TarriffType)) {
              job.EstimatedFare = _ec;
            }
          }
          // Business account link + display name resolution
          if (param('Account_id') !== undefined) {
            const _aid = String(param('Account_id') || '').trim();
            job.Account_id = _aid;
            job.AccountId  = _aid; // legacy alias
            if (_aid) {
              const _ba = businessAccStore.find(b => String(b.id) === _aid && b.companyId === (job.companyId || sessionCompanyId));
              job.Account_Name = _ba ? (_ba.name || '') : (job.Account_Name || '');
            } else {
              job.Account_Name = '';
            }
          }
          // ACC ride fields — all sent by the form, none were being persisted before.
          if (param('Acc_job_id') !== undefined)       job.Acc_job_id       = String(param('Acc_job_id') || '');
          if (param('po_id') !== undefined)            job.po_id            = String(param('po_id') || '');
          if (param('Acc_claim_id') !== undefined)     job.Acc_claim_id     = String(param('Acc_claim_id') || '');
          if (param('Acc_manager_id') !== undefined)   job.Acc_manager_id   = String(param('Acc_manager_id') || '');
          if (param('Acc_client_id') !== undefined)    job.Acc_client_id    = String(param('Acc_client_id') || '');
          if (param('Acc_trip_status') !== undefined)  job.Acc_trip_status  = String(param('Acc_trip_status') || '');
          // Booking type can flip Normal ↔ Account ↔ ACC when the dispatcher
          // adds/removes an account or ACC claim — keep it in sync.
          // Persist BOTH casings: downstream hail/service logic still reads
          // the snake_case alias `booking_type` in several places.
          if (param('booking_type') !== undefined) {
            const _bt = String(param('booking_type') || '');
            job.bookingType  = _bt;
            job.booking_type = _bt;
          }

          // Dispatcher explicitly edited this job — always clear any previous offer-attempt reason
          // (e.g. 'No Response', 'Recalled by Driver') so the badge doesn't linger after a re-edit.
          job.returnReason = '';
          job.updatedAt    = new Date().toISOString();
          job.updatedBy    = 'dispatcher';
          saveJobStore();

          // ── Firebase mirror: passenger app, driver app, website and any other
          // ── client that reads from Firebase must see the dispatcher's edit
          // ── immediately. Covers every service type (taxi / food / freight /
          // ── rentals / towing) because we patch by job.Id without any
          // ── serviceType branching.
          const _euCid = job.companyId || sessionCompanyId || '';
          const _euFbIds = _driverFirebaseIdsFromJob(job);
          const _euDid = _euFbIds.driverId;
          const _euVid = job.VehicleNo || job.CallSign || job.VehicleId || _euFbIds.vehicleId || '';
          if (_euCid) {
            // Build the patch from the live job object so every field we just
            // updated above is mirrored. Only include keys that exist to avoid
            // overwriting Firebase-only enrichments with `undefined`.
            const _euPatch = {};
            const _euMaybe = (k, v) => { if (v !== undefined && v !== null) _euPatch[k] = v; };
            _euMaybe('PickAddress',        job.PickAddress);
            _euMaybe('DropAddress',        job.DropAddress);
            _euMaybe('PickLatLng',         job.PickLatLng);
            _euMaybe('DropLatLng',         job.DropLatLng);
            _euMaybe('Name',               job.Name);
            _euMaybe('PassengerName',      job.Name);
            _euMaybe('passengername',      job.Name);
            _euMaybe('PhoneNo',            job.PhoneNo);
            _euMaybe('Email',              job.Email);
            _euMaybe('Passengers',         job.Passengers);
            _euMaybe('Bags',               job.Bags);
            _euMaybe('WheelChairs',        job.WheelChairs);
            _euMaybe('VehiclesReguired',   job.VehiclesReguired);
            _euMaybe('VehicleType',        job.VehicleType);
            _euMaybe('EntitiesDetails',    job.EntitiesDetails);
            _euMaybe('Notes',              job.Notes);
            _euMaybe('Urgent',             job.Urgent);
            _euMaybe('CornerAddress',      job.CornerAddress);
            _euMaybe('Nextstop',           job.Nextstop);
            _euMaybe('nextstopdata',       job.nextstopdata);
            _euMaybe('EstimatedDistance',  job.EstimatedDistance);
            _euMaybe('EstimatedTime',      job.EstimatedTime);
            _euMaybe('EstimatedCost',      job.EstimatedCost);
            _euMaybe('EstimatedFare',      job.EstimatedFare);
            _euMaybe('RideCost',           job.RideCost);
            _euMaybe('CustomeRate',        job.CustomeRate);
            _euMaybe('TarriffType',        job.TarriffType);
            _euMaybe('TariffId',           job.TariffId);
            _euMaybe('Recieve_payment',    job.Recieve_payment);
            _euMaybe('BookingDateTime',    job.BookingDateTime);
            _euMaybe('Pickingtime',        job.Pickingtime);
            _euMaybe('ScheduledFor',       job.ScheduledFor);
            _euMaybe('ScheduledForMs',     job.ScheduledFor);
            _euMaybe('DispatchTimebefore', job.DispatchTimebefore);
            _euMaybe('ZoneId',             job.ZoneId);
            _euMaybe('Account_id',         job.Account_id);
            _euMaybe('AccountId',          job.AccountId);
            _euMaybe('Account_Name',       job.Account_Name);
            _euMaybe('Acc_job_id',         job.Acc_job_id);
            _euMaybe('Acc_claim_id',       job.Acc_claim_id);
            _euMaybe('Acc_manager_id',     job.Acc_manager_id);
            _euMaybe('Acc_client_id',      job.Acc_client_id);
            _euMaybe('Acc_trip_status',    job.Acc_trip_status);
            _euMaybe('po_id',              job.po_id);
            _euMaybe('BookingStatus',      job.BookingStatus);
            _euMaybe('VehicleId',          job.VehicleId);
            _euMaybe('DriverId',           job.DriverId);
            _euMaybe('serviceType',        job.serviceType);
            _euMaybe('ServiceType',        job.serviceType);
            _euMaybe('bookingType',        job.bookingType);
            _euMaybe('booking_type',       job.booking_type);
            // Notification signal: clients listen for jobUpdatedAt change and
            // can show a "Job updated by dispatcher" toast / refresh local cache.
            _euPatch.jobUpdatedAt    = Date.now();
            _euPatch.jobUpdatedAtIso = new Date().toISOString();
            _euPatch.jobUpdateReason = 'dispatcher_edit';

            const _euLiveStatuses = new Set(['Offered','Assigned','Picking','Active']);
            const _euJobIsLive    = _euLiveStatuses.has(job.BookingStatus || '');
            // Live mirror requires a REAL vehicle id (non-empty, not '0', not '-1').
            // Without this, edits to jobs with placeholder vehicle markers would
            // create orphan nodes like /jobs/{cid}/0/{did} that the cleanup
            // logic ignores.
            const _euVidStr = String(_euVid || '').trim();
            const _euVidOk  = _euVidStr !== '' && _euVidStr !== '0' && _euVidStr !== '-1';

            getFirebaseServerToken().then(tok => {
              if (!tok) return Promise.resolve();
              const _writes = [
                firebaseDbPatch(`pendingjobs/${_euCid}/${job.Id}`, _euPatch, tok).catch(e => { console.warn(`  [ProcUpdateJobv6] pendingjobs/${_euCid}/${job.Id} patch failed: ${e.message}`); }),
                firebaseDbPatch(`allbookings/${_euCid}/${job.Id}`, _euPatch, tok).catch(e => { console.warn(`  [ProcUpdateJobv6] allbookings/${_euCid}/${job.Id} patch failed: ${e.message}`); }),
              ];
              // Live driver-facing node — only patched when a driver is actually
              // currently assigned. Patching when no driver is on it would create
              // orphan nodes the cleanup logic might leave behind.
              if (_euJobIsLive && _euVidOk && _euDid && _euDid !== '0' && _euDid !== '-1') {
                // §FIX-DA-G2 — booking-keyed child PATCH.
                _writes.push(
                  firebaseDbPatch(`jobs/${_euCid}/${_euVid}/${_euDid}/${job.Id}`, _euPatch, tok)
                    .then(() => { console.log(`  [ProcUpdateJobv6] jobs/${_euCid}/${_euVid}/${_euDid}/${job.Id} live-update sent (status=${job.BookingStatus})`); })
                    .catch(e => { console.warn(`  [ProcUpdateJobv6] jobs/${_euCid}/${_euVid}/${_euDid}/${job.Id} patch failed: ${e.message}`); })
                );
              }
              return Promise.all(_writes);
            }).then(() => {
              console.log(`  [ProcUpdateJobv6] Firebase mirror complete for job #${job.Id} (cid=${_euCid}, status=${job.BookingStatus}, service=${job.serviceType || 'taxi'})`);
            }).catch(e => {
              console.warn(`  [ProcUpdateJobv6] Firebase mirror error (non-fatal): ${e.message}`);
            });

            // §FIX-UB — classify the edit by REAL diff against the pre-edit
            // snapshot (not synthetic undefined-from). Fire booking-scoped
            // event stream + targeted driver notification when the booking is
            // currently in the driver app's UI. The blanket PATCH above stays
            // as a compatibility shim for legacy listeners.
            const _puStatusChanged = _ubPreSnapshot.BookingStatus !== job.BookingStatus;
            let _puEventSeq = parseInt(job.updateSeq) || 0;
            if (_puStatusChanged && _euCid && job.Id) {
              _puEventSeq = _bumpSeqAndEmitStatus(job, _ubPreSnapshot.BookingStatus, 'dispatcher', 'ProcUpdateJobv6');
              saveJobStore();
            }
            const _ubCandidate = {};
            for (const _ubK of Object.keys(_euPatch)) {
              if (_ubK.startsWith('jobUpdate')) continue;          // skip mirror metadata
              if (_ubK === 'BookingStatus' || _ubK === 'DriverId' || _ubK === 'VehicleId') continue; // status moves are handled by §FIX-A/A2/D/O and §FIX-CB events
              _ubCandidate[_ubK] = _euPatch[_ubK];
            }
            const _ubDiff = _diffJobChanges(_ubPreSnapshot, _ubCandidate);
            if (Object.keys(_ubDiff).length > 0) {
              const _ubTypes = _classifyDiff(_ubDiff);
              let _ubNewSeq;
              if (_puStatusChanged) {
                _ubNewSeq = _puEventSeq;
              } else {
                _ubNewSeq = (parseInt(job.updateSeq) || 0) + 1;
                job.updateSeq     = _ubNewSeq;
                job.lastUpdatedAt = new Date().toISOString();
                job.lastUpdatedBy = 'dispatcher';
                saveJobStore();
              }
              // Also stamp _seq onto the booking-scoped Firebase mirror so the
              // driver app can use it for race detection (matches updateBooking()).
              if (_euCid && job.Id) {
                // §FIX-DA-G4/G5 — public contract: version + serverTimestamp + 6-value eventType.
                const _ubMirrorPatch = {
                  _seq:      _ubNewSeq,
                  version:   _ubNewSeq,
                  updatedAt: _FB_SERVER_TIMESTAMP,
                  eventType: _ubMapEventType(_ubTypes[0] || 'JobUpdated')
                };
                getFirebaseServerToken().then(_tok => {
                  if (!_tok) return;
                  return Promise.all([
                    firebaseDbPatch(`pendingjobs/${_euCid}/${job.Id}`, _ubMirrorPatch, _tok).catch(() => {}),
                    firebaseDbPatch(`allbookings/${_euCid}/${job.Id}`, _ubMirrorPatch, _tok).catch(() => {}),
                  ]);
                }).catch(() => {});
                for (const _t of _ubTypes) {
                  const _eventData = (_t === 'StatusChanged' && _ubDiff.BookingStatus)
                    ? { from: _ubDiff.BookingStatus.from, to: _ubDiff.BookingStatus.to, changes: _ubDiff }
                    : { changes: _ubDiff };
                  _writeBookingEvent(_euCid, job.Id, _t, _eventData, 'dispatcher', _ubNewSeq).catch(() => {});
                }
              }
              if (_UB_DRIVER_VISIBLE.has(job.BookingStatus || '') && _euDid) {
              (async () => {
                try {
                  await _writeDriverJobUpdatedNotification({
                    job, diff: _ubDiff, seq: _ubNewSeq, by: 'dispatcher',
                    source: 'ProcUpdateJobv6/notify', eventTypes: _ubTypes,
                  });
                } catch (_e) { console.warn(`  [ProcUpdateJobv6] §FIX-UB notify failed: ${_e && _e.message}`); }
              })();
              }
              console.log(`  [ProcUpdateJobv6] §FIX-UB job #${job.Id} seq→${_ubNewSeq} types=[${_ubTypes.join(',')}] fields=[${Object.keys(_ubDiff).join(',')}]`);
            }
          }
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
        // §FIX-CB — unified cancel flow
        const bookingId = parseInt(param('BookingId')) || 0;
        const _rentalKey = (jobStore.find(j => j.Id === bookingId) || {}).rentalRequestId || null;
        const _r = await cancelBooking({
          bookingId, cancelledBy: 'dispatcher', driverFault: false,
          companyId: sessionCompanyId, source: 'CancelUnAssignedJobStatusFromJobList',
          reason: param('reason') || ''
        });
        if (_rentalKey && _r.ok && !_r.idempotent) {
          getFirebaseServerToken().then(token => {
            if (token) firebaseDbPatch(`rentalTaxiRequests/${_rentalKey}`,
              { status: 'cancelled', cancelledAt: new Date().toISOString(), jobId: bookingId }, token
            ).catch(() => {});
          });
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> cancel result: ${JSON.stringify(_r)}`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]' || action === '[UnAssignJobStatusFromJobList]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const job = jobStore.find(j => j.Id === bookingId);
        const driverId = parseInt(param('reternVehicleid') || param('VehicleId') || '0') || 0;
        if (job) {
          const _assignPrevStatus = job.BookingStatus;
          if (action === '[AssignJobStatusFromJobList]' || action === '[AssignJobStatusFromJobListv2]') {
            job.BookingStatus = 'Assigned';
            job.assignedAt = Date.now();
            job.DriverId = driverId;
            if (driverId > 0) job.VehicleId = driverId;
            // §FIX-M — flag this as a dispatcher-driven manual offer so that if the driver
            // does not accept within 27 s and the Unreached timeout fires, §FIX-U2 lands the
            // job as 'No One' (dispatcher decides next) instead of 'Pending' (auto-dispatch
            // retries). Auto-dispatch offers do NOT set this flag, so their timeout path is
            // unchanged. The flag is cleared on first use in §FIX-U2 below.
            job.manualOffer = true;
            job.manualOfferAt = Date.now();
            console.log(`  [§FIX-M/${action}] manualOffer=true stamped for job#${bookingId} driver=${driverId}`);
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
            // Unassign — restore driver to Available at their original queue position.
            // §FIX-F — When the job actually had a driver (Offered/Assigned/Picking), mark it
            // 'No One' instead of 'Pending' so AutoDispatchVehiclesallride (which only picks
            // 'Pending' — see ~line 6637) does NOT immediately re-offer the same job to the
            // same driver on the next tick. The job stays visible in the Unassigned tab
            // (UnAssigned filter includes 'No One' — see ~line 1588). Jobs that never had a
            // driver fall back to 'Pending' so normal dispatch can still pick them up.
            const prevDriverId = job.DriverId || 0;
            // §FIX-F2 — DriverId is a string for many tenants (e.g. "D002"), so a numeric
            // `prevDriverId > 0` check coerces "D002" to NaN and silently falls through to
            // 'Pending' — letting auto-dispatch immediately re-offer the same job to the
            // same driver. Treat any non-empty, non-'0', non-'-1' DriverId as "had a driver".
            const _prevDrvStr = String(prevDriverId).trim();
            const _hadDriver = _prevDrvStr !== '' && _prevDrvStr !== '0' && _prevDrvStr !== '-1';
            job.BookingStatus = _hadDriver ? 'No One' : 'Pending';
            job.DriverId = 0;
            job.VehicleId = 0;
            // §FIX-G — release cooldown (only when a driver was actually released).
            // AutoDispatchVehiclesallride skips Pending jobs whose releasedAt is within 30s,
            // so even if another handler accidentally flips status back to Pending, the
            // auto-loop won't immediately re-offer. Skipped when prevDriverId=0 so brand-new
            // never-assigned jobs aren't delayed by 30s on first dispatch.
            if (_hadDriver) job.releasedAt = Date.now();
            // §FIX-M — clear any stale manualOffer flag so a future auto-dispatch retry on
            // this job isn't wrongly demoted to 'No One' on its Unreached timeout.
            job.manualOffer = false;
            console.log(`  [UnAssignJobStatusFromJobList] §FIX-F2 job#${bookingId} prevDriverId='${_prevDrvStr}' hadDriver=${_hadDriver} → BookingStatus='${job.BookingStatus}' (manualOffer cleared)`);
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
              // §FIX-P — mirror the driver's Available status back to Firebase.
              // The dispatch console's client-side `driverdatarealx` (used by smartAutoDispatch
              // to find Available drivers) is sourced from `online/{cid}/{vid}/current`. Updating
              // ZONE_DRIVERS in memory is NOT enough — the client reads from Firebase, not the
              // server's in-memory store. Without this Firebase patch, after an Assigned → No One
              // unassign the driver still appears as 'Assigned' to smartAutoDispatch and the
              // freshly-Pending job never gets re-offered. Drivers worked around this by logging
              // out and back in, which rewrote the presence record.
              // Fire-and-forget — never block the response.
              const _fbVehId = zd.VehicleId || zd.vehiclenumber || '';
              if (sessionCompanyId && _fbVehId) {
                getFirebaseServerToken().then(_tok => {
                  if (!_tok) return;
                  firebaseDbPatch(`online/${sessionCompanyId}/${_fbVehId}/current`, {
                    vehiclestatus: 'Available',
                    jobId:         '',
                    jobpickup:     '',
                    jobdropoff:    '',
                    JobphoneNo:    ''
                  }, _tok).then(() => {
                    console.log(`  [UnAssignJobStatusFromJobList] §FIX-P Firebase online/${sessionCompanyId}/${_fbVehId}/current → Available (mirrored)`);
                  }).catch(e => {
                    console.log(`  [UnAssignJobStatusFromJobList] §FIX-P Firebase patch failed: ${e.message}`);
                  });
                  // §FIX-Q — replicate FnCancelRide server-side so the driver app
                  // gets the "Job Cancel" message and clears its screen. Without
                  // this the driver app keeps showing the job and keeps heart-
                  // beating vehiclestatus='Assigned' to online/{cid}/{vid}/current,
                  // stomping the §FIX-P Available write within ~1-2 s.
                  // (a) jobs/{cid}/{vid}/{drv}: SET to {Status:'Cancelled', BookingId:<id>}
                  //     — mirrors Default.aspx FnCancelRide line 8493-8499. The driver
                  //     app's jobs/ listener treats this as a cancellation.
                  // (b) notification/{drv}: write the cancel payload — mirrors
                  //     FnCancelRide line 8479-8488. Driver app shows toast/sound.
                  // Conditional jobs/ write — only overwrite the node when it
                  // actually references THIS booking; refuse if it has a different
                  // BookingId (a new job arrived between unassign and this write).
                  const _drvForFb = String(_prevDrvStr || '').trim();
                  if (_drvForFb) {
                    // §FIX-DA-G2 + C2 — write eventType then remove child.
                    const _delUrl = `${FB_DB_URL}/jobs/${sessionCompanyId}/${_fbVehId}/${_drvForFb}/${bookingId}.json?auth=${encodeURIComponent(_tok)}`;
                    fbRequest(_delUrl, 'PATCH', { eventType: 'cancelled' })
                      .catch(e => console.log(`  [UnAssignJobStatusFromJobList] §FIX-Q jobs child eventType PATCH failed: ${e.message}`))
                      .then(() => fbRequest(_delUrl, 'DELETE', null))
                      .then(_r => console.log(`  [UnAssignJobStatusFromJobList] §FIX-Q jobs/${sessionCompanyId}/${_fbVehId}/${_drvForFb}/${bookingId} → eventType=cancelled then removed [${_r && _r.status}]`))
                      .catch(e => console.log(`  [UnAssignJobStatusFromJobList] §FIX-Q jobs child remove failed: ${e.message}`));
                    firebaseDbSet(`notification/${_drvForFb}`, {
                      bookingid: `${bookingId},Job Removed,${_drvForFb},Server,Dispatcher`,
                      content:   'Job has been taken back by dispatcher',
                      type:      'job_removed',
                      eventType: 'job_removed',
                      version:   (function(){ const _j = jobStore.find(j => j && j.Id === bookingId); return _j ? (parseInt(_j.updateSeq) || 0) : 0; })(),
                      updatedAt: _FB_SERVER_TIMESTAMP,
                      bookingId: bookingId
                    }, _tok)
                      .then(() => console.log(`  [UnAssignJobStatusFromJobList] §FIX-Q notification/${_drvForFb} → job_removed written`))
                      .catch(e => console.log(`  [UnAssignJobStatusFromJobList] §FIX-Q notification write failed: ${e.message}`));
                  }
                });
              }
            }
            clearAwayLock(prevDriverId);
            clearDriverHomeState(prevDriverId);
          }
          if (_assignPrevStatus !== job.BookingStatus) {
            _bumpSeqAndEmitStatus(job, _assignPrevStatus, 'dispatcher', action);
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
          if (sessionCompanyId && _kd.companyId && String(_kd.companyId) === String(sessionCompanyId)) {
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
          if (sessionCompanyId && d.companyId && String(d.companyId) === String(sessionCompanyId)) {
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
          // §FIX-N — protect 'No One' jobs from being silently flipped to Pending/Unreached/etc.
          // by the driver app's follow-up Unreached/Cancel ack that arrives AFTER the dispatcher
          // has unassigned the job via [UnAssignJobStatusFromJobList]. Without this guard, the
          // Unreached branch below (~line 6580) would set effectiveStatus='Pending' because the
          // §FIX-M manualOffer flag was already cleared in UnAssignJobStatusFromJobList, and
          // auto-dispatch would immediately re-offer the same job to the same driver.
          if (currentStatus === 'No One' && isDowngrade) {
            console.log(`  [§FIX-N/changeriddestatusforoffer/DP] BLOCKED: job #${bookingId} is No One, refusing to set ${newStatus} (reason: "${returnReason}") — dispatcher must re-pick a driver`);
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
          // §FALSE-RECALL-GUARD: the dispatch UI runs two listeners on the same offer
          // (new path jobs/{cid}/{vid}/{drvId} + legacy path joback/{id}/{drvId}).
          // After the driver accepts, the new listener wins and the job becomes
          // Assigned. The legacy listener can then fire a few hundred ms later on
          // a stale snapshot and call convertstatus(Pending, 'Driver Rejected'),
          // which would otherwise pass isDriverPostAcceptCancel and cause a false
          // "Job Recalled by Driver" notification + rideStatus/Recalled write.
          // If the job was Assigned within the last 8s, treat any 'Driver Rejected'
          // downgrade as the spurious legacy race and block it.
          if (isDriverPostAcceptCancel && currentStatus === 'Assigned' && job.AcceptedAt) {
            const _ageMs = Date.now() - new Date(job.AcceptedAt).getTime();
            if (_ageMs >= 0 && _ageMs < 8000) {
              console.log(`  [changeriddestatusforoffer/DP] BLOCKED false recall: job #${bookingId} accepted ${_ageMs}ms ago — ignoring stale 'Driver Rejected' (driver=${job.DriverId})`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true, falseRecallSuppressed: true });
              return;
            }
          }
          if (isDriverPostAcceptCancel) {
            // §FIX-CB — driver-initiated cancel/recall after acceptance. Picking → close;
            // Assigned → recall to Pending. Driver state restore is gated by
            // driverHasRemainingAssignments — Job A active stays untouched.
            const _dcDriverId = job.DriverId;
            const _dcIsPicking = currentStatus === 'Picking';
            const _r = await cancelBooking({
              bookingId: job.Id,
              cancelledBy: 'driver',
              driverFault: true,                   // post-accept driver cancel/recall = driver fault
              recallToPending: !_dcIsPicking,      // Picking → close; Assigned → recall
              companyId: sessionCompanyId,
              source: 'changeriddestatusforoffer/DP',
              reason: returnReason || (_dcIsPicking ? 'Driver Cancelled at Pickup' : 'Driver Recalled')
            });
            if (_dcIsPicking) {
              console.log(`  [changeriddestatusforoffer/DP] §FIX-CB Job #${bookingId} → Cancelled (driver ${_dcDriverId} cancelled at pickup)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverCancelled: { jobId: bookingId, driverId: _dcDriverId }, newQueueNo: _r.queueNo });
            } else {
              console.log(`  [changeriddestatusforoffer/DP] §FIX-CB Job #${bookingId} → Pending (driver ${_dcDriverId} recalled after accepting)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverRecalled: { jobId: bookingId, driverId: _dcDriverId }, newQueueNo: _r.queueNo });
            }
            return;
          }
          // If the dispatcher manually unassigned this job, flag it so [DriverStatusChanged]
          // won't misread the driver's resulting Available heartbeat as a driver-initiated cancel.
          if (rr.includes('manually unassigned') && bookingId > 0) markDispatcherRecalled(bookingId);
          // §FIX-U2 — Unreached (no-response timeout) restores the job's pre-offer U-A pool
          // status (_preOfferStatus): Pending for auto-dispatch jobs, No One for manual-only.
          const effectiveStatus = newStatus === 'Unreached'
            ? _restorePoolStatusAfterOfferRelease(job)
            : newStatus;
          const _refreshPrevDP = currentStatus;
          job.BookingStatus = effectiveStatus;
          if (newStatus === 'Unreached') {
            job.releasedAt = Date.now();
            if (effectiveStatus === 'No One') {
              job.manualOffer = true;
              job.originalStatus = 'manual';
              job.DriverId = 0;
              job.VehicleId = 0;
              console.log(`  [changeriddestatusforoffer/DP] job #${bookingId} Unreached → No One (pre-offer pool restored)`);
            } else {
              job.manualOffer = false;
              console.log(`  [changeriddestatusforoffer/DP] job #${bookingId} Unreached → Pending + releasedAt stamped (30 s same-driver cooldown)`);
            }
          }
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
            // §FIX-M — driver accepted, clear manualOffer so any later unrelated retry on
            // this job isn't wrongly demoted to 'No One' on its Unreached timeout.
            job.manualOffer = false;
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
            // §FIX-CB — gate driver-side state changes on remaining assignments. If this
            // driver has another active job (Job A) and we just released Job B, leave the
            // driver's vehiclestatus / awayLock / jobpickup/jobdropoff untouched so Job A
            // continues normally. The job-side reset below (_clearDrv) still happens.
            const _hasOtherDP = driverHasRemainingAssignments(_releaseDriverId, bookingId, sessionCompanyId);
            if (_hasOtherDP) {
              console.log(`  [changeriddestatusforoffer/DP] §FIX-CB driver ${_releaseDriverId} keeps state (has remaining active assignment) — release-fanout skipped for newStatus=${newStatus}`);
            } else {
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
              if (newDriverStatus === 'Away') {
                setAwayLock(_releaseDriverId);
                const _unrVeh = (job.VehicleNo || job.CallSign || (zd && (zd.vehiclenumber || zd.VehicleId)) || '').toString().trim();
                if (sessionCompanyId && _unrVeh) {
                  void _mirrorDriverAwayOnUnreached(sessionCompanyId, _unrVeh, _releaseDriverId);
                }
              } else {
                clearAwayLock(_releaseDriverId);
                clearDriverHomeState(_releaseDriverId); // home state consumed
              }
              console.log(`  [changeriddestatusforoffer/DP] driver ${_releaseDriverId} → ${newDriverStatus} q=${_newQueueNo || '-'} zone="${zd && zd.zonename}" (newStatus=${newStatus} driverFault=${_driverFault})`);
            }
            // Clear job's DriverId when:
            //   (a) client explicitly sends driverid=0 (manual unassign / timeout), OR
            //   (b) newStatus is Unreached (auto-dispatch timeout — job must be re-offerable)
            const _rawDrv = param('driverid');
            const _clearDrv = (newStatus === 'Unreached') ||
                              (_rawDrv !== undefined && _rawDrv !== null && parseInt(_rawDrv) === 0);
            if (_clearDrv) { job.DriverId = 0; job.VehicleId = 0; }
          }
          if (newStatus === 'Unreached') {
            _bumpJobUpdateSeq(job, 'driver');
            _logJobPoolState(job, 'after-unreached-dp');
          }
          saveJobStore();
          if (sessionCompanyId && job.BookingStatus !== _refreshPrevDP) {
            _dispatchRefreshForJob(job, {
              cid: sessionCompanyId,
              previousStatus: _refreshPrevDP,
              status: job.BookingStatus,
              action: newStatus === 'Unreached' ? 'timeout' : undefined,
              driverId: '0',
            }).catch(() => {});
          }
          if (newStatus === 'Unreached' && sessionCompanyId) {
            _releaseOfferToPoolFirebase(sessionCompanyId, bookingId, job, effectiveStatus).catch(() => {});
          }
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
                    WebBooking:     false,
                    // Payment visibility for driver app — covers website Stripe pre-pays,
                    // passenger-app card/cash, dispatcher card/cash, and account jobs.
                    paymentMethod:  String(job.paymentMethod || job.PaymentMethod || ''),
                    paymentStatus:  String(job.paymentStatus || job.PaymentStatus || ''),
                    PaidAmount:     String(job.PaidAmount || job.Recieve_payment || ''),
                    AccountId:      String(job.Account_id || job.AccountId || ''),
                    AccountName:    String(job.Account_Name || job.AccountName || ''),
                    // §FIXED-PRICE / pickup-time — driver app reads these to suppress the
                    // meter on fixed-price jobs and display the scheduled pickup time.
                    Pickingtime:    String(job.BookingDateTime || job.Pickingtime || ''),
                    TarriffType:    String(job.TarriffType || ''),
                    CustomeRate:    String(job.CustomeRate || ''),
                    Account_Name:   String(job.Account_Name || job.AccountName || '')
                  };
                  if (_pjPickLL) _pjPatch.pickupLocation  = { address: job.PickAddress || '', lat: _pjPickLL.lat, lng: _pjPickLL.lng };
                  if (_pjDropLL) _pjPatch.dropoffLocation = { address: job.DropAddress || '', lat: _pjDropLL.lat, lng: _pjDropLL.lng };
                  await fbRequest(_pjUrl, 'PATCH', _pjPatch);
                  console.log(`  [changeriddestatusforoffer/DP] pendingjobs/${sessionCompanyId}/${bookingId} patched → Offered (full payload)`);
                  // §SINGLE-OFFER-CHANNEL: do NOT write jobpickup/jobdropoff/joboffer/etc.
                  // to online/{cid}/{vid}/current at offer time. The driver app's offer
                  // popup is driven exclusively by notification/{driverId}. Writing the
                  // same fields to online/.../current causes the driver app to spawn a
                  // SECOND popup behind the timer one. Those fields are written only
                  // once the driver accepts (newStatus === 'Assigned' below).
                }
              } catch(_e) { console.warn('  [changeriddestatusforoffer/DP] pendingjobs patch failed:', _e && _e.message); }
            })();
          }
          // When the driver accepts, write the in-trip fields to online/.../current so
          // the driver app's "current trip" panel (and any restore-on-reload paths)
          // can display passenger/pickup/dropoff. Also delete any stale joback/{id}
          // entries so the legacy joback listener on the dispatch UI cannot fire a
          // spurious "Driver Rejected" race after the new-path Accept.
          if (newStatus === 'Assigned' && sessionCompanyId) {
            (async () => {
              try {
                const _tokA = await getFirebaseServerToken();
                if (_tokA) {
                  const _aVeh = (job.VehicleNo || job.CallSign || '').toString().trim();
                  if (_aVeh) {
                    const _ocUrlA = `${FB_DB_URL}/online/${sessionCompanyId}/${_aVeh}/current.json?auth=${encodeURIComponent(_tokA)}`;
                    await fbRequest(_ocUrlA, 'PATCH', {
                      jobpickup:    job.PickAddress  || '',
                      jobdropoff:   job.DropAddress  || '',
                      JobphoneNo:   job.PhoneNo      || '',
                      jobname:      job.Name         || job.UserFName || '',
                      currentJobId: String(bookingId),
                      jobId:        String(bookingId),
                      // joboffer is a "pending offer" signal — clear it on acceptance
                      // so the driver app stops treating this as an offer screen.
                      joboffer:     0
                    });
                    console.log(`  [changeriddestatusforoffer/DP] online/${sessionCompanyId}/${_aVeh}/current → trip details written (Assigned)`);
                  }
                  // Fire-and-forget delete of joback/{bookingId} so the legacy joback
                  // listener cannot read a stale snapshot and fire 'Driver Rejected'.
                  fbRequest(`${FB_DB_URL}/joback/${bookingId}.json?auth=${encodeURIComponent(_tokA)}`, 'DELETE', null)
                    .then(() => console.log(`  [changeriddestatusforoffer/DP] joback/${bookingId} cleared (Assigned)`))
                    .catch(_je => console.warn(`  [changeriddestatusforoffer/DP] joback clear failed: ${_je && _je.message}`));
                }
              } catch(_eA) { console.warn('  [changeriddestatusforoffer/DP] Assigned post-write failed:', _eA && _eA.message); }
            })();
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
              const sameCompany = sessionCompanyId && d.companyId && String(d.companyId) === String(sessionCompanyId);
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
            // §FIX-G — hail-active visibility. Previously this excluded creation of a
            // Hail job when ANY Pending job was associated with the driver. But Pending
            // means uncommitted (in the unassigned queue), so a driver picking up a
            // hail passenger while a Pending job is in the system should still produce
            // a visible Active row. Only block hail-create on truly-committed states.
            const hasLive = driverJobs.some(j =>
              ['Offered','Assigned','Picking','Active'].includes(j.BookingStatus)
            );
            // Hail-create debounce (mirror of the Available→Completed 3 s debounce):
            // when the driver app rapid-toggles Busy↔Available it spawns a new hail
            // every cycle.  If the same driver completed a Hail in the last 3 s,
            // skip creating a new one — the toggles are heartbeat noise, not a
            // genuine new pickup.
            const _recentHailDoneDP = closedJobStore.find(function(cj) {
              return String(cj.DriverId || cj.driverId || '') === String(driverId) &&
                (cj.BookingSource === 'Hail' || cj.booking_type === 'Hail') &&
                cj.completedAtMs && (Date.now() - cj.completedAtMs) < 3000;
            });
            if (!hasLive && _recentHailDoneDP) {
              console.log(`  [DriverStatusChanged] Hail-create SKIPPED for driver ${driverId} — debounce (last hail #${_recentHailDoneDP.Id} completed ${Date.now() - _recentHailDoneDP.completedAtMs}ms ago)`);
            } else if (!hasLive) {
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
                updateSeq: 1,
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
              const _hailJob = jobStore.find(j => j && j.Id === hailId);
              if (_hailJob && sessionCompanyId) {
                _dispatchRefreshForJob(_hailJob, {
                  cid: sessionCompanyId,
                  action: 'active',
                  status: 'Active',
                  driverId,
                }).catch(() => {});
              }
              if (sessionCompanyId) {
                _writeBookingEvent(sessionCompanyId, hailId, 'StatusChanged',
                  { from: null, to: 'Active', driverId, vehicleId: vehiclenumber || driverId, action: 'created', source: 'hail' },
                  'driver', 1).catch(() => {});
              }
              console.log(`  [DriverStatusChanged] Hail job #${hailId} created for driver ${driverId} (${vehiclenumber}) companyId=${sessionCompanyId} at ${pickAddr}`);
              // Bootstrap zone for Hail drivers with no zone info — without this
              // the right-side zone queue groups them under the no-zone bucket,
              // and the status-bar zone column stays blank.  Use placeholder
              // "Hail" so the driver is visible until a real zone arrives.
              if (_hailZd) {
                if (!_hailZd.zonename) {
                  _hailZd.zonename = 'Hail';
                  _hailZd.zoneid   = _hailZd.zoneid || 'hail';
                  saveZoneAssignment(driverId, 'Hail', _hailZd.zoneid);
                  console.log(`  [DriverStatusChanged] driver ${driverId} bootstrapped to placeholder zone "Hail"`);
                }
              } else {
                // Driver isn't in ZONE_DRIVERS yet (first-sighting was Busy, no
                // Available ever processed). Insert a placeholder entry so the
                // right-side zone queue + status-bar zone column show the car
                // under "Hail" until a real zone arrives.
                const _maxQH = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
                ZONE_DRIVERS.push({
                  driverid: driverId, VehicleId: vehiclenumber || driverId,
                  drivername: _hailFullName, vehiclenumber: vehiclenumber || '',
                  vehicletype: '', zonename: 'Hail', zoneid: 'hail',
                  vehiclestatus: 'Busy', zonequeue: _maxQH + 1,
                  queueWaitSince: Date.now(),
                  companyId: sessionCompanyId || '',
                });
                saveZoneAssignment(driverId, 'Hail', 'hail');
                console.log(`  [DriverStatusChanged] driver ${driverId} inserted into ZONE_DRIVERS at placeholder zone "Hail"`);
              }
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
            } else if (newStatus === 'Arrived' &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered')) {
              job.BookingStatus = 'Arrived';
              if (!job.ArrivedAt) job.ArrivedAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Arrived`);
            } else if (newStatus === 'Active' && !activatedOne &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Arrived')) {
              job.BookingStatus = 'Active';
              activatedOne = true;
              if (!job.ActiveAt) job.ActiveAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Active (on board)`);
            } else if (newStatus === 'Busy' && !activatedOne &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Arrived' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphaned))) {
              // Pending + Busy: driver skipped the Accept step (e.g. Away→Busy after dispatch timeout)
              // but the job's DriverId still matches — activate it so dispatch shows Active.
              job.BookingStatus = 'Active';
              activatedOne = true;
              if (!job.ActiveAt) job.ActiveAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Picking';
              job.assignedAt = Date.now();
              if (!job.PickingAt) job.PickingAt = new Date().toISOString();
              _stampDriverName(job);
              console.log(`  [DriverStatusChanged] Job #${job.Id} (was ${prev}) -> Picking`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Hail-flicker debounce: driver app sometimes rapid-toggles
                // Busy → Available within a second or two of creating a Hail
                // job, which churns Active → Completed → new Hail every cycle
                // and makes the car-map marker flicker.  If this Active job is
                // a Hail less than 3 s old, treat the Available as a phantom
                // heartbeat and leave the job Active.  A real completion will
                // arrive on the next Available after the 3 s window.
                const _isHailDb = job.BookingSource === 'Hail' || job.booking_type === 'Hail';
                const _activeAtMsDb = job.ActiveAt ? new Date(job.ActiveAt).getTime() : 0;
                const _ageMsDb = _activeAtMsDb ? (Date.now() - _activeAtMsDb) : Infinity;
                if (_isHailDb && _ageMsDb < 3000) {
                  console.log(`  [DriverStatusChanged] Job #${job.Id} Available IGNORED — Hail debounce (age=${_ageMsDb}ms)`);
                  return;
                }
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
                // §FIX-H — pull driver-app completion truth (fare, distance, payment,
                // addresses, timeline) from Firebase allbookings into the closed record
                // so the dispatch history isn't blank. Fire-and-forget with internal retry.
                _enrichClosedJobFromAllbookings(sessionCompanyId, job);
                // §FIX-K — capture driver AppVersion at completion (fire-and-forget).
                _captureDriverAppVersion(sessionCompanyId,
                  vehiclenumber || job.VehicleNo || job.VehicleId, job);
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
            if (job.BookingStatus !== prev) {
              _afterJobStatusChange(job, prev, 'driver', 'DriverStatusChanged');
              saveJobStore();
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
        if (_dscQueueNo && newStatus === 'Available' && sessionCompanyId) {
          syncZonequeueToFirebase(
            sessionCompanyId,
            vehiclenumber || driverId,
            _dscQueueNo,
            zonename,
            'DriverStatusChanged/DP',
          );
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
            _qsnJob.releasedAt = Date.now(); // §FIX-G — release cooldown (see AutoDispatch filter)
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

      } else if (action === '[QuickSetPending]') {
        const _qspBookingId = parseInt(param('BookingId')) || 0;
        const _qspJob = jobStore.find(j => j.Id === _qspBookingId);
        if (_qspJob) {
          const _qspActiveSt = new Set(['Pending','Offered','Assigned','Unreached','No One','Reject','']);
          if (_qspActiveSt.has(_qspJob.BookingStatus || '')) {
            const _qspPrevDrv = _qspJob.DriverId || 0;
            _qspJob.BookingStatus = 'Pending';
            _qspJob.DriverId = 0;
            _qspJob.VehicleId = 0;
            _qspJob.manualOffer = false;
            _qspJob.originalStatus = 'pending';
            _qspJob.releasedAt = Date.now();
            if (_qspPrevDrv > 0) {
              const _qspZd = ZONE_DRIVERS.find(d => d.driverid === _qspPrevDrv || d.VehicleId === _qspPrevDrv);
              if (_qspZd) {
                _qspZd.vehiclestatus = 'Available';
                _qspZd.JobphoneNo = '';
                _qspZd.jobpickup = '';
                _qspZd.jobdropoff = '';
              }
            }
            saveJobStore();
            const _qspCid = String(_qspJob.companyId || sessionCompanyId || '');
            if (_qspCid) _writePendingJobFirebase(_qspCid, _qspBookingId, _qspJob);
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${_qspBookingId} set to Pending`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[CancelJobStatusFromJobList]') {
        // §FIX-CB — unified cancel flow (DP variant)
        const _cjBookingId = parseInt(param('BookingId')) || 0;
        const _cjPrev = jobStore.find(j => j.Id === _cjBookingId) || closedJobStore.find(j => j.Id === _cjBookingId) || {};
        const _cjPrevDrv = String(_cjPrev.DriverId || _cjPrev.AssignedDriverId || '0');
        const _r = await cancelBooking({
          bookingId: _cjBookingId, cancelledBy: 'dispatcher', driverFault: false,
          companyId: sessionCompanyId, source: 'CancelJobStatusFromJobList/DP',
          reason: param('reason') || ''
        });
        const _cjRespDrv = _r.driverId || _cjPrevDrv;
        console.log(`200: POST ${urlPath} [action=${action}] -> cancel result: ${JSON.stringify(_r)}`);
        arrayD(res, [{ Result: 'Job Cancelled Successfully', DriverId: _cjRespDrv }]);

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
        // Fallback for the dispatcher's right-side zone table when its Firebase
        // listener hasn't populated $scope.driverdatarealx yet (fresh page load,
        // listener-restart, or zero live drivers in Firebase). Returns the same
        // shape the client expects: a flat array of driver records that the
        // client groups by zonename.
        const _zlu = companyDrivers(ZONE_DRIVERS).map(d => ({
          driverid:      d.driverid      || '',
          VehicleId:     d.VehicleId     || '',
          drivername:    d.drivername    || '',
          vehiclenumber: d.vehiclenumber || '',
          vehicletype:   d.vehicletype   || '',
          vehiclestatus: d.vehiclestatus || '',
          zonename:      d.zonename      || (getSavedZone(d.driverid) && getSavedZone(d.driverid).zonename) || '',
          zoneid:        d.zoneid        || (getSavedZone(d.driverid) && getSavedZone(d.driverid).zoneid)   || '',
          zonequeue:     parseInt(d.zonequeue) || 0,
          lat:           d.lat || '',
          lng:           d.lng || '',
        })).filter(d => d.driverid || d.vehiclenumber || d.drivername);
        console.log(`200: POST ${urlPath} [action=${action}] -> ${_zlu.length} driver(s) from ZONE_DRIVERS`);
        arrayD(res, _zlu);

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
        // §FIX-Q — lazily start a GPS trail recorder for any Active/Picking job
        // that doesn't already have one. Idempotent (no-op if already running),
        // and works regardless of which DriverStatusChanged path activated the
        // job (DP, DS, hail auto-activate). Runs once per ActiveJobsv3 poll.
        active.forEach(function(_aj) {
          var _vid = String(_aj.VehicleId || '').trim();
          if (_aj.Id && _vid && _vid !== '0' && sessionCompanyId) {
            _startTrailRecorder(sessionCompanyId, _vid, _aj.Id);
          }
        });
        const activeWithId = active.map(j => _enrichActiveJob(j, sessionCompanyId || ''));
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
              // §FIX-J — same lazy-resolve as ActiveJobsv3
              _resolveHailAddressFromFirebase(sessionCompanyId, job);
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

      // ── Vehicle lookup for the dispatch booking form ────────────────────────
      // Returns the live vehicle record for the selected driver (from ZONE_DRIVERS).
      // Without this, the action proxies to the real backend and returns a stranger's
      // vehicle (e.g. "203 ,IT" instead of the live driver's "TAXI02").
      } else if (action === '[RetrieveVehicle]') {
        const _rvDid = (param('DriverId') || '').toString().trim();
        const _rvDrv = ZONE_DRIVERS.find(d =>
          sessionCompanyId && d.companyId && String(d.companyId) === String(sessionCompanyId) &&
          String(d.driverid) === _rvDid
        );
        const _rvOut = _rvDrv ? [{
          Id:           _rvDrv.VehicleId   || _rvDrv.vehiclenumber || _rvDid,
          VehicleNo:    _rvDrv.vehiclenumber || _rvDrv.VehicleId   || _rvDid,
          CallSign:     _rvDrv.vehiclenumber || _rvDrv.VehicleId   || _rvDid,
          AutoDispatch: '1',
        }] : [];
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${_rvDid} ${_rvOut.length ? ('vehicle=' + _rvOut[0].VehicleNo) : 'no live driver'}`);
        arrayD(res, _rvOut);

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
            job.releasedAt = Date.now(); // §FIX-G — release cooldown (see AutoDispatch filter)
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

      } else if (action === '[QuickSetPending]') {
        const bookingId = parseInt(param('BookingId')) || 0;
        const job = jobStore.find(j => j.Id === bookingId);
        if (job) {
          const preActiveSt = new Set(['Pending','Offered','Assigned','Unreached','No One','Reject','']);
          if (preActiveSt.has(job.BookingStatus || '')) {
            const prevDriverId = job.DriverId || 0;
            job.BookingStatus = 'Pending';
            job.DriverId = 0;
            job.VehicleId = 0;
            job.manualOffer = false;
            job.originalStatus = 'pending';
            job.releasedAt = Date.now();
            if (prevDriverId > 0) {
              const zd = ZONE_DRIVERS.find(d => d.driverid === prevDriverId || d.VehicleId === prevDriverId);
              if (zd) {
                zd.vehiclestatus = 'Available';
                zd.JobphoneNo = '';
                zd.jobpickup = '';
                zd.jobdropoff = '';
              }
              clearAwayLock(prevDriverId);
              clearDriverHomeState(prevDriverId);
            }
            saveJobStore();
            const _qspCid = String(job.companyId || sessionCompanyId || '');
            if (_qspCid) _writePendingJobFirebase(_qspCid, bookingId, job);
          }
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> job #${bookingId} set to Pending`);
        successD(res, 'Operation Successfully Performed');

      } else if (action === '[CancelJobStatusFromJobList]') {
        // §FIX-CB — unified cancel flow (DS variant)
        const bookingId = parseInt(param('BookingId')) || 0;
        const _csPrev = jobStore.find(j => j.Id === bookingId) || closedJobStore.find(j => j.Id === bookingId) || {};
        const _csPrevDrv = String(_csPrev.DriverId || _csPrev.AssignedDriverId || '0');
        const _r = await cancelBooking({
          bookingId, cancelledBy: 'dispatcher', driverFault: false,
          companyId: sessionCompanyId, source: 'CancelJobStatusFromJobList/DS',
          reason: param('reason') || ''
        });
        const _csRespDrv = _r.driverId || _csPrevDrv;
        console.log(`200: POST ${urlPath} [action=${action}] -> cancel result: ${JSON.stringify(_r)}`);
        arrayD(res, [{ Result: 'Job Cancelled Successfully', DriverId: _csRespDrv }]);

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
        // Alias-normalise the edit-load payload so the AngularJS edit form
        // restores every field correctly regardless of which booking source
        // (dispatcher, passenger app, website, taxi/food/freight/rentals/towing)
        // originally created the job. The dispatcher form reads $res.dt1[0].X for:
        //   TarriffId (double-r) — stored as TariffId / TarriffId / TariffID
        //   CustomeRate          — must be present (empty string is fine; 0 is also fine)
        //   PassengerId          — alias for PhoneNo
        //   AccountId / accountiDa — id of business account on file
        //   Email / Notes / booking_type — were silently dropped before
        //   booking_type radio — restored from booking_type | bookingType | BookingType
        const jobWithMins = job ? (function() {
          const _aliased = { ...job, JobMins: calcJobMins(job) };
          _aliased.TarriffId    = job.TarriffId || job.TariffId || job.TariffID || '0';
          _aliased.CustomeRate  = (job.CustomeRate !== undefined && job.CustomeRate !== null) ? String(job.CustomeRate) : '';
          _aliased.PassengerId  = job.PhoneNo || job.PassengerId || '';
          _aliased.AccountId    = job.Account_id || job.AccountId || '';
          _aliased.accountiDa   = job.Account_id || job.AccountId || job.accountiDa || '';
          _aliased.Email        = job.Email || '';
          _aliased.Notes        = job.Notes || '';
          _aliased.booking_type = job.booking_type || job.bookingType || job.BookingType || '';
          _aliased.bookingType  = _aliased.booking_type;
          // Name aliases for any consumer that reads passengername instead of Name
          _aliased.passengername= job.passengername || job.PassengerName || job.Name || '';
          _aliased.PassengerName= _aliased.passengername;
          return _aliased;
        })() : null;
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
              console.log(`[§FIX-OfferClear/staleOfferWatchdog-AD] *** SERVER WATCHDOG FIRED *** job#${j.Id} prevDriverId=${j.DriverId} prevVehicleId=${j.VehicleId} offeredAt=${j.offeredAt} ageMs=${age} — pushing clear-offer to driver-app Firebase nodes.`);
              // §FIX-OfferClear — push clear-offer to driver-app Firebase nodes so a recovered
              // (post-crash) driver app drops the stale Accept popup instead of acting on it.
              // Use j.companyId (not sessionCompanyId) — jobStore is global across tenants
              // and the AD watchdog iterates all jobs, so cross-tenant clears must be avoided.
              clearOfferOnFirebase(j.companyId, j.VehicleId, j.DriverId, j.Id, 'staleOfferWatchdog-AD');
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
          // §FIX-G — release cooldown (shortened to 10 s per user request 2026-05-18).
          // If this job was just released (auto-dispatch timeout / dispatcher UnAssign /
          // QuickSetNoOne), skip it for 10 s so the auto-loop can't immediately re-offer
          // the same job to the same driver who just failed to respond. Short enough that
          // other drivers (or the same driver, if he's the only one available) get the job
          // back quickly. Belt-and-braces on top of §FIX-F (No One) and §FIX-U2 (Pending).
          if (j.releasedAt && (Date.now() - j.releasedAt) < 10000) {
            return false;
          }
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
        // §QueueCap — taxi/TM drivers: max 1 queued job (one passenger at a
        // time). Food / freight / rental / towing drivers can hold multiple
        // queued jobs because the driver manages multi-drop load themselves.
        // Service-type read from the job being offered (defaults to 'taxi'
        // when missing so legacy hail records keep the strict cap).
        const _qSvc    = (_qJob && (_qJob.serviceType || _qJob.ServiceType) || 'taxi').toString().toLowerCase();
        const _qIsTaxi = (_qSvc === 'taxi' || _qSvc === 'tm' || _qSvc === '');
        const _qExisting = _qIsTaxi
          ? jobStore.find(j =>
              j.BookingStatus === 'Queued' &&
              String(j.DriverId) === String(_qDriverId) &&
              String(j.Id) !== String(_qBookingId)
            )
          : null;
        if (!_qIsTaxi) {
          console.log(`[QueueJob] multi-queue allowed for ${_qSvc} job #${_qBookingId} → driver ${_qDriverId}`);
        }
        if (!_qJob) { objectD(res, { ok: false, msg: 'job not found' }); }
        else if (_qExisting) {
          console.log(`[QueueJob] BLOCKED job #${_qBookingId} → driver ${_qDriverId} already has queued job #${_qExisting.Id}`);
          objectD(res, { ok: false, msg: 'queue full', existingJobId: _qExisting.Id });
        }
        else if (_qJob.BookingStatus !== 'Offered' && _qJob.BookingStatus !== 'Pending' && _qJob.BookingStatus !== 'No One') {
          objectD(res, { ok: false, msg: `cannot queue job with status ${_qJob.BookingStatus}` });
        } else {
          // Remember the pre-queue status so [RecallQueuedJob] can restore to the right state.
          const _origSt = _qJob._origStatus || _qJob.BookingStatus || 'Pending';
          _qJob._origStatus  = _origSt;
          _qJob.originalStatus = (_origSt === 'No One' || _qJob.manualOffer) ? 'manual' : 'pending';
          _qJob.BookingStatus = 'Queued';
          _qJob.DriverId     = _qDriverId;
          _qJob.queuedAt     = Date.now();
          saveJobStore();
          const _qCid = String(_qJob.companyId || sessionCompanyId || '');
          if (_qCid) {
            _writeDriverQueueFirebase(_qCid, _qDriverId, _qBookingId, _qJob, _qJob.originalStatus);
            getFirebaseServerToken().then(tok => {
              if (tok) fbRequest(`${FB_DB_URL}/pendingjobs/${_qCid}/${_qBookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
            });
          }
          console.log(`[QueueJob] job #${_qBookingId} (was ${_origSt}) → Queued for driver ${_qDriverId} originalStatus=${_qJob.originalStatus}`);
          objectD(res, { ok: true, origStatus: _origSt, originalStatus: _qJob.originalStatus });
        }

      } else if (action === '[RecallQueuedJob]') {
        const _rqBookingId = param('bookingid');
        const _rqDriverId  = (param('driverid') || '').toString().trim(); // driver who recalled
        const _rqJob = jobStore.find(j => String(j.Id) === String(_rqBookingId));
        if (!_rqJob) { objectD(res, { ok: false, msg: 'job not found' }); }
        else {
          const _prevSt = _rqJob.BookingStatus;
          const _orig = _rqJob.originalStatus || ((_rqJob._origStatus === 'No One') ? 'manual' : 'pending');
          const _restoreSt = _orig === 'manual' ? 'No One' : 'Pending';
          _rqJob.BookingStatus = _restoreSt;
          _rqJob.DriverId      = _orig === 'manual' ? 0 : -2;
          _rqJob.VehicleId     = 0;
          _rqJob.queuedAt      = null;
          _rqJob.returnReason  = _rqDriverId ? `Recalled by ${_rqDriverId}` : 'Recalled by Driver';
          delete _rqJob._origStatus;
          saveJobStore();
          const _rqCid = String(_rqJob.companyId || sessionCompanyId || '');
          if (_rqCid) {
            if (_restoreSt === 'Pending') _writePendingJobFirebase(_rqCid, _rqBookingId, _rqJob);
            else getFirebaseServerToken().then(tok => {
              if (tok) fbRequest(`${FB_DB_URL}/pendingjobs/${_rqCid}/${_rqBookingId}.json?auth=${encodeURIComponent(tok)}`, 'DELETE').catch(() => {});
            });
            if (_rqDriverId) _removeDriverQueueFirebase(_rqCid, _rqDriverId, _rqBookingId);
          }
          console.log(`[RecallQueuedJob] job #${_rqBookingId} (was ${_prevSt}) → ${_restoreSt} originalStatus=${_orig}`);
          objectD(res, { ok: true, restoredStatus: _restoreSt, originalStatus: _orig });
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
          const _pqaPrev = _pqaJob.BookingStatus;
          _pqaJob.BookingStatus = 'Assigned';
          _pqaJob.assignedAt = Date.now();
          _pqaJob.queuedAt = null;
          saveJobStore();
          _afterJobStatusChange(_pqaJob, _pqaPrev, 'driver', 'PromoteQueuedToAssigned');
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
        // Quiet log spam: only emit when count > 0 OR when count changed from
        // last poll for this session. The 3 s polling cadence floods the log
        // with "0 queued job(s)" lines that hide real signal.
        if (!global._gqLastCountByCid) global._gqLastCountByCid = {};
        const _gqCidKey = sessionCompanyId || '_';
        if (_gqDt1.length > 0 || global._gqLastCountByCid[_gqCidKey] !== _gqDt1.length) {
          console.log(`[GetQueuedJobs] → ${_gqDt1.length} queued job(s)`);
          global._gqLastCountByCid[_gqCidKey] = _gqDt1.length;
        }
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
                  drivername: d.drivername || '',
                  jobsToday: _driverJobsTodayCount(d.driverid, d.VehicleId || d.vehiclenumber, sessionCompanyId),
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
          onlineDrivers: _onlineIds,
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
          // §FIX-N — see DP variant. Protect 'No One' from a driver-app late ack flipping it
          // to Pending and triggering an immediate auto-dispatch re-offer to the same driver.
          if (currentStatus2 === 'No One' && isDowngrade2) {
            console.log(`  [§FIX-N/changeriddestatusforoffer/DS] BLOCKED: job #${bookingId} is No One, refusing to set ${newStatus} (reason: "${returnReason}") — dispatcher must re-pick a driver`);
            objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true });
            return;
          }
          // Special case: driver explicitly rejected/cancelled an ACCEPTED (Assigned/Picking) job.
          // Not a timeout fire — a genuine driver-side cancel after accepting (Fix #108).
          const isDriverPostAcceptCancel2 = isExplicitReject2 && !isTimeoutReason2 && !hasNoDriver2 &&
            !rr2.includes('manually unassigned') &&
            (currentStatus2 === 'Assigned' || currentStatus2 === 'Picking') &&
            (newStatus === 'Pending' || newStatus === 'Cancelled' || newStatus === 'Unreached');
          // §FALSE-RECALL-GUARD (DS): see DP variant above for rationale.
          if (isDriverPostAcceptCancel2 && currentStatus2 === 'Assigned' && job.AcceptedAt) {
            const _ageMs2 = Date.now() - new Date(job.AcceptedAt).getTime();
            if (_ageMs2 >= 0 && _ageMs2 < 8000) {
              console.log(`  [changeriddestatusforoffer/DS] BLOCKED false recall: job #${bookingId} accepted ${_ageMs2}ms ago — ignoring stale 'Driver Rejected' (driver=${job.DriverId})`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], blocked: true, falseRecallSuppressed: true });
              return;
            }
          }
          if (isDriverPostAcceptCancel2) {
            // §FIX-CB — DS twin: see DP variant. Picking → close; Assigned → recall.
            const _dcDriverId2 = job.DriverId;
            const _dcIsPicking2 = currentStatus2 === 'Picking';
            const _r2 = await cancelBooking({
              bookingId: job.Id,
              cancelledBy: 'driver',
              driverFault: true,
              recallToPending: !_dcIsPicking2,
              companyId: sessionCompanyId,
              source: 'changeriddestatusforoffer/DS',
              reason: returnReason || (_dcIsPicking2 ? 'Driver Cancelled at Pickup' : 'Driver Recalled')
            });
            if (_dcIsPicking2) {
              console.log(`  [changeriddestatusforoffer/DS] §FIX-CB Job #${bookingId} → Cancelled (driver ${_dcDriverId2} cancelled at pickup)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverCancelled: { jobId: bookingId, driverId: _dcDriverId2 }, newQueueNo: _r2.queueNo });
            } else {
              console.log(`  [changeriddestatusforoffer/DS] §FIX-CB Job #${bookingId} → Pending (driver ${_dcDriverId2} recalled after accepting)`);
              objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], driverRecalled: { jobId: bookingId, driverId: _dcDriverId2 }, newQueueNo: _r2.queueNo });
            }
            return;
          }
          // If the dispatcher manually unassigned this job, flag it so [DriverStatusChanged]
          // won't misread the driver's resulting Available heartbeat as a driver-initiated cancel.
          if (rr2.includes('manually unassigned') && bookingId > 0) markDispatcherRecalled(bookingId);
          // §FIX-U2 — Unreached restores pre-offer U-A pool status (see DP path).
          const effectiveStatus2 = newStatus === 'Unreached'
            ? _restorePoolStatusAfterOfferRelease(job)
            : newStatus;
          const _refreshPrevDS = currentStatus2;
          job.BookingStatus = effectiveStatus2;
          if (newStatus === 'Unreached') {
            job.releasedAt = Date.now();
            if (effectiveStatus2 === 'No One') {
              job.manualOffer = true;
              job.originalStatus = 'manual';
              job.DriverId = 0;
              job.VehicleId = 0;
              console.log(`  [changeriddestatusforoffer/DS] job #${bookingId} Unreached → No One (pre-offer pool restored)`);
            } else {
              job.manualOffer = false;
              console.log(`  [changeriddestatusforoffer/DS] job #${bookingId} Unreached → Pending + releasedAt stamped (30 s same-driver cooldown)`);
            }
          }
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
            // §FIX-M — driver accepted, clear manualOffer (see DP-site comment).
            job.manualOffer = false;
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
            // §FIX-CB — gate driver-side state changes on remaining assignments (see DP).
            const _hasOtherDS = driverHasRemainingAssignments(_releaseDriverId2, bookingId, sessionCompanyId);
            if (_hasOtherDS) {
              console.log(`  [changeriddestatusforoffer/DS] §FIX-CB driver ${_releaseDriverId2} keeps state (has remaining active assignment) — release-fanout skipped for newStatus=${newStatus}`);
            } else {
              if (zd) {
                if (newDriverStatus2 === 'Available') {
                  _newQueueNo2 = calcRestoredQueue(_releaseDriverId2, zd.zonename);
                  zd.zonequeue = _newQueueNo2;
                  zd.queueWaitSince = Date.now();
                }
                zd.vehiclestatus = newDriverStatus2;
                zd.JobphoneNo = ''; zd.jobpickup = ''; zd.jobdropoff = ''; zd.jobCount = 0;
              }
              if (newDriverStatus2 === 'Away') {
                setAwayLock(_releaseDriverId2);
                const _unrVeh2 = (job.VehicleNo || job.CallSign || (zd && (zd.vehiclenumber || zd.VehicleId)) || '').toString().trim();
                if (sessionCompanyId && _unrVeh2) {
                  void _mirrorDriverAwayOnUnreached(sessionCompanyId, _unrVeh2, _releaseDriverId2);
                }
              } else {
                clearAwayLock(_releaseDriverId2);
                clearDriverHomeState(_releaseDriverId2);
              }
              console.log(`  [changeriddestatusforoffer/DS] driver ${_releaseDriverId2} → ${newDriverStatus2} q=${_newQueueNo2 || '-'} zone="${zd && zd.zonename}" (newStatus=${newStatus} driverFault=${_driverFault2})`);
            }
            // Clear job's DriverId when:
            //   (a) client explicitly sends driverid=0 (manual unassign / timeout), OR
            //   (b) newStatus is Unreached (auto-dispatch timeout — job must be re-offerable)
            const _rawDrv2 = param('driverid');
            const _clearDrv2 = (newStatus === 'Unreached') ||
                               (_rawDrv2 !== undefined && _rawDrv2 !== null && parseInt(_rawDrv2) === 0);
            if (_clearDrv2) { job.DriverId = 0; job.VehicleId = 0; }
          }
          if (newStatus === 'Unreached') {
            _bumpJobUpdateSeq(job, 'driver');
            _logJobPoolState(job, 'after-unreached-ds');
          }
          saveJobStore();
          if (sessionCompanyId && job.BookingStatus !== _refreshPrevDS) {
            _dispatchRefreshForJob(job, {
              cid: sessionCompanyId,
              previousStatus: _refreshPrevDS,
              status: job.BookingStatus,
              action: newStatus === 'Unreached' ? 'timeout' : undefined,
              driverId: '0',
            }).catch(() => {});
          }
          if (newStatus === 'Unreached' && sessionCompanyId) {
            _releaseOfferToPoolFirebase(sessionCompanyId, bookingId, job, effectiveStatus2).catch(() => {});
          }
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
                    WebBooking:     false,
                    // §FIXED-PRICE / pickup-time / account name — driver app reads these
                    // to suppress the meter on fixed-price jobs and display scheduled pickup.
                    Pickingtime:    String(job.BookingDateTime || job.Pickingtime || ''),
                    TarriffType:    String(job.TarriffType || ''),
                    CustomeRate:    String(job.CustomeRate || ''),
                    Account_Name:   String(job.Account_Name || job.AccountName || ''),
                    AccountName:    String(job.Account_Name || job.AccountName || '')
                  };
                  if (_pjPickLL2) _pjPatch2.pickupLocation  = { address: job.PickAddress || '', lat: _pjPickLL2.lat, lng: _pjPickLL2.lng };
                  if (_pjDropLL2) _pjPatch2.dropoffLocation = { address: job.DropAddress || '', lat: _pjDropLL2.lat, lng: _pjDropLL2.lng };
                  await fbRequest(_pjUrl, 'PATCH', _pjPatch2);
                  console.log(`  [changeriddestatusforoffer/DS] pendingjobs/${sessionCompanyId}/${bookingId} patched → Offered (full payload)`);
                  // §SINGLE-OFFER-CHANNEL: see DP variant — offer popup is driven only
                  // by notification/{driverId}; do NOT also write to online/.../current
                  // at offer time. In-trip fields are written on Assigned below.
                }
              } catch(_e) { console.warn('  [changeriddestatusforoffer/DS] pendingjobs patch failed:', _e && _e.message); }
            })();
          }
          // §FALSE-RECALL-GUARD support + §SINGLE-OFFER-CHANNEL: on Assigned, write
          // in-trip fields to online/.../current AND clear joback/{id} so the legacy
          // joback listener can't fire a spurious 'Driver Rejected' race.
          if (newStatus === 'Assigned' && sessionCompanyId) {
            (async () => {
              try {
                const _tokA2 = await getFirebaseServerToken();
                if (_tokA2) {
                  const _aVeh2 = (job.VehicleNo || job.CallSign || '').toString().trim();
                  if (_aVeh2) {
                    const _ocUrlA2 = `${FB_DB_URL}/online/${sessionCompanyId}/${_aVeh2}/current.json?auth=${encodeURIComponent(_tokA2)}`;
                    await fbRequest(_ocUrlA2, 'PATCH', {
                      jobpickup:    job.PickAddress  || '',
                      jobdropoff:   job.DropAddress  || '',
                      JobphoneNo:   job.PhoneNo      || '',
                      jobname:      job.Name         || job.UserFName || '',
                      currentJobId: String(bookingId),
                      jobId:        String(bookingId),
                      joboffer:     0
                    });
                    console.log(`  [changeriddestatusforoffer/DS] online/${sessionCompanyId}/${_aVeh2}/current → trip details written (Assigned)`);
                  }
                  fbRequest(`${FB_DB_URL}/joback/${bookingId}.json?auth=${encodeURIComponent(_tokA2)}`, 'DELETE', null)
                    .then(() => console.log(`  [changeriddestatusforoffer/DS] joback/${bookingId} cleared (Assigned)`))
                    .catch(_je2 => console.warn(`  [changeriddestatusforoffer/DS] joback clear failed: ${_je2 && _je2.message}`));
                }
              } catch(_eA2) { console.warn('  [changeriddestatusforoffer/DS] Assigned post-write failed:', _eA2 && _eA2.message); }
            })();
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
              const sameCompany = sessionCompanyId && d.companyId && String(d.companyId) === String(sessionCompanyId);
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
            // §FIX-G — see DP block: only block hail-create on truly-committed states.
            // Pending = uncommitted (in unassigned queue), should NOT block hail-active.
            const hasLive = driverJobs.some(j =>
              ['Offered','Assigned','Picking','Active'].includes(j.BookingStatus)
            );
            // Hail-create debounce — see DP block for rationale
            const _recentHailDoneDS = closedJobStore.find(function(cj) {
              return String(cj.DriverId || cj.driverId || '') === String(driverId) &&
                (cj.BookingSource === 'Hail' || cj.booking_type === 'Hail') &&
                cj.completedAtMs && (Date.now() - cj.completedAtMs) < 3000;
            });
            if (!hasLive && _recentHailDoneDS) {
              console.log(`  [DriverStatusChanged/DS] Hail-create SKIPPED for driver ${driverId} — debounce (last hail #${_recentHailDoneDS.Id} completed ${Date.now() - _recentHailDoneDS.completedAtMs}ms ago)`);
            } else if (!hasLive) {
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
                updateSeq: 1,
                DriverId: driverId,
                VehicleId: vehiclenumber || driverId,
                VehicleNo: vehiclenumber || driverId,
                Name: 'Street Pickup', PhoneNo: '',
                PickAddress: pickAddr, DropAddress: '',
                PickLatLng: (lat && lng) ? `${lat},${lng}` : '',
                DropLatLng: '',
                BookingDateTime: now, JobCompleteTime: '',
                BookingSource: 'Hail', booking_type: 'Hail',
                AcceptedAt: now, ActiveAt: now,
                JobMins: 0, UserFName: _hailPartsDS[0] || '', UserLName: _hailPartsDS.slice(1).join(' ') || '',
                Route: '', bookingidx: hailId,
              });
              saveJobStore();
              const _hailJobDS = jobStore.find(j => j && j.Id === hailId);
              if (_hailJobDS && sessionCompanyId) {
                _dispatchRefreshForJob(_hailJobDS, {
                  cid: sessionCompanyId,
                  action: 'active',
                  status: 'Active',
                  driverId,
                }).catch(() => {});
              }
              if (sessionCompanyId) {
                _writeBookingEvent(sessionCompanyId, hailId, 'StatusChanged',
                  { from: null, to: 'Active', driverId, vehicleId: vehiclenumber || driverId, action: 'created', source: 'hail' },
                  'driver', 1).catch(() => {});
              }
              console.log(`  [DriverStatusChanged/DS] Hail job #${hailId} for driver ${driverId} (${vehiclenumber}) companyId=${sessionCompanyId} at ${pickAddr}`);
              // Bootstrap zone for Hail drivers (mirrors DP path) so the
              // right-side zone queue + status-bar zone column don't go blank.
              if (_hailZdDS) {
                if (!_hailZdDS.zonename) {
                  _hailZdDS.zonename = 'Hail';
                  _hailZdDS.zoneid   = _hailZdDS.zoneid || 'hail';
                  saveZoneAssignment(driverId, 'Hail', _hailZdDS.zoneid);
                  console.log(`  [DriverStatusChanged/DS] driver ${driverId} bootstrapped to placeholder zone "Hail"`);
                }
              } else {
                const _maxQHds = ZONE_DRIVERS.reduce((m, d) => Math.max(m, d.zonequeue || 0), 0);
                ZONE_DRIVERS.push({
                  driverid: driverId, VehicleId: vehiclenumber || driverId,
                  drivername: _hailFullNameDS, vehiclenumber: vehiclenumber || '',
                  vehicletype: '', zonename: 'Hail', zoneid: 'hail',
                  vehiclestatus: 'Busy', zonequeue: _maxQHds + 1,
                  queueWaitSince: Date.now(),
                  companyId: sessionCompanyId || '',
                });
                saveZoneAssignment(driverId, 'Hail', 'hail');
                console.log(`  [DriverStatusChanged/DS] driver ${driverId} inserted into ZONE_DRIVERS at placeholder zone "Hail"`);
              }
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
            } else if (newStatus === 'Arrived' &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Offered')) {
              job.BookingStatus = 'Arrived';
              if (!job.ArrivedAt) job.ArrivedAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Arrived`);
            } else if (newStatus === 'Active' && !activatedOneDS &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Arrived')) {
              job.BookingStatus = 'Active';
              activatedOneDS = true;
              if (!job.ActiveAt) job.ActiveAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Active (on board)`);
            } else if (newStatus === 'Busy' && !activatedOneDS &&
                       (job.BookingStatus === 'Assigned' || job.BookingStatus === 'Picking' || job.BookingStatus === 'Arrived' || job.BookingStatus === 'Offered' ||
                        (job.BookingStatus === 'Pending' && !orphanedDS))) {
              job.BookingStatus = 'Active';
              activatedOneDS = true;
              if (!job.ActiveAt) job.ActiveAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Active`);
            } else if (newStatus === 'Picking' && (job.BookingStatus === 'Offered' || job.BookingStatus === 'Pending' || job.BookingStatus === 'Assigned')) {
              job.BookingStatus = 'Picking';
              job.assignedAt = Date.now();
              if (!job.PickingAt) job.PickingAt = new Date().toISOString();
              _stampDriverNameDS(job);
              console.log(`  [DriverStatusChanged/DS] Job #${job.Id} (was ${prev}) -> Picking`);
            } else if (newStatus === 'Available') {
              if (job.BookingStatus === 'Active') {
                // Hail-flicker debounce: driver app sometimes rapid-toggles
                // Busy → Available within a second or two of creating a Hail
                // job, which churns Active → Completed → new Hail every cycle
                // and makes the car-map marker flicker.  If this Active job is
                // a Hail less than 3 s old, treat the Available as a phantom
                // heartbeat and leave the job Active.  A real completion will
                // arrive on the next Available after the 3 s window.
                const _isHailDb = job.BookingSource === 'Hail' || job.booking_type === 'Hail';
                const _activeAtMsDb = job.ActiveAt ? new Date(job.ActiveAt).getTime() : 0;
                const _ageMsDb = _activeAtMsDb ? (Date.now() - _activeAtMsDb) : Infinity;
                if (_isHailDb && _ageMsDb < 3000) {
                  console.log(`  [DriverStatusChanged] Job #${job.Id} Available IGNORED — Hail debounce (age=${_ageMsDb}ms)`);
                  return;
                }
                // Trip genuinely finished — mark Completed, move to closedJobStore
                job.BookingStatus = 'Completed';
                job.JobCompleteTime = new Date().toISOString();
                job.completedAtMs   = Date.now();
                _stampDriverNameDS(job);
                const _cIdxDS = jobStore.indexOf(job);
                if (_cIdxDS !== -1) jobStore.splice(_cIdxDS, 1);
                closedJobStore.push(job);
                saveJobStore();
                saveClosedJobStore();
                // §FIX-H — see DP path: enrich closed-job record from allbookings.
                _enrichClosedJobFromAllbookings(sessionCompanyId, job);
                // §FIX-K — capture driver AppVersion at completion (fire-and-forget).
                _captureDriverAppVersion(sessionCompanyId,
                  vehiclenumber || job.VehicleNo || job.VehicleId, job);
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
            if (job.BookingStatus !== prev) {
              _afterJobStatusChange(job, prev, 'driver', 'DriverStatusChanged');
              saveJobStore();
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
              // Driver app sometimes omits zonename on heartbeats — restore from
              // the disk-saved assignment so the zone column doesn't go blank.
              if (!zdAvailDS.zonename) {
                const _savedZnAvDS = getSavedZone(driverId);
                if (_savedZnAvDS && _savedZnAvDS.zonename) {
                  zdAvailDS.zonename = _savedZnAvDS.zonename;
                  zdAvailDS.zoneid   = zdAvailDS.zoneid || _savedZnAvDS.zoneid || '';
                  console.log(`  [DriverStatusChanged/DS] driver ${driverId} zone restored from disk: "${zdAvailDS.zonename}"`);
                }
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
        if (_dssQueueNo && newStatus === 'Available' && sessionCompanyId) {
          syncZonequeueToFirebase(
            sessionCompanyId,
            vehiclenumber || driverId,
            _dssQueueNo,
            zonenameDS,
            'DriverStatusChanged/DS',
          );
        }
        console.log(`200: POST ${urlPath} [action=${action}] -> driverId=${driverId} newStatus=${newStatus}`);
        objectD(res, { dt1: [], dt2: [], dt3: [], dt4: [], dt5: [], newQueueNo: _dssQueueNo, queueWaitSince: _dssQueueNo ? Date.now() : null, driverCancelled: _dssDriverCancelled || null, driverRecalled: _dssDriverRecalled || null, zoneOnly: zoneOnlyDS || false, completedJob: _dscCompletedJobDS || null });

      } else if (action === '[UnAssignedJobsv3]') {
        const _cJobs = companyJobs(jobStore);
        const resp = buildJobListResponse(_cJobs, sessionCompanyId);
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

        // §ID-reuse guard — passenger-app bookingIds wrap (~10 digits) and get
        // recycled. A closed entry with the same numeric Id but an OLDER completion
        // time than the incoming CreatedAt is a reused ID, NOT a duplicate — must
        // ingest. Only an exact _fbKey match, OR a closed entry NEWER than the
        // incoming booking, counts as a true duplicate. Mirrors pendingjobs-normalizer.
        const _ipjIncomingMs = (function() {
          const cand = [
            _ipjJob.CreatedAt, _ipjJob.createdAt,
            _ipjJob.BookingDateTime, _ipjJob.bookingDateTime,
            _ipjJob.ScheduledForMs, _ipjJob.scheduledForMs,
            _ipjJob.ScheduledFor,   _ipjJob.scheduledFor,
          ];
          for (const v of cand) {
            if (v == null || v === '' || v === 0) continue;
            const n = (typeof v === 'number') ? v : (Number.isFinite(+v) && String(v).length >= 10 ? +v : Date.parse(v));
            if (n && isFinite(n)) return n;
          }
          return 0;
        })();
        // Tenant-scoped + aligned with pendingjobs-normalizer (server.js ~7785-7810):
        //   - Exact _fbKey match → duplicate (drop). Strongest signal.
        //   - Otherwise scan closedJobStore restricted to THIS tenant for matching
        //     numeric Id, take the NEWEST closure timestamp.
        //   - If incoming timestamp > newest closedAt → ID reuse, ingest.
        //   - If timestamps are unknown/incomparable → KEEP (ingest). Losing a real
        //     booking is worse than letting an edge-case duplicate slip through.
        const _ipjSCid = String(sessionCompanyId || '');
        const _ipjFindClosed = (numId) => {
          const exactKey = closedJobStore.find(j => j._fbKey && j._fbKey === _ipjFbKey);
          if (exactKey) return exactKey;
          if (!(numId > 0)) return null;
          const newestForId = closedJobStore
            .filter(j => j.Id === numId && String(j.companyId || '') === _ipjSCid)
            .reduce((best, j) => {
              const t = Number(j.completedAtMs) ||
                (j.JobCompleteTime ? Date.parse(j.JobCompleteTime) : 0) || 0;
              return (!best || t > best._t) ? Object.assign({_t:t}, j) : best;
            }, null);
          if (!newestForId) return null;
          // Both timestamps known + incoming is NEWER → ID reuse, ingest.
          if (_ipjIncomingMs > 0 && newestForId._t > 0 && _ipjIncomingMs > newestForId._t) {
            console.log(`[IngestPassengerJob] ID reuse detected for ${numId} (cid=${_ipjSCid}) — incoming=${_ipjIncomingMs} > newestClosed=${newestForId._t}, ingesting`);
            return null;
          }
          // Both known + incoming is OLDER/EQUAL → true duplicate, drop.
          if (_ipjIncomingMs > 0 && newestForId._t > 0) return newestForId;
          // Either timestamp unknown → cannot prove duplicate. KEEP (ingest).
          // Mirrors normalizer's "safer fallback" policy.
          console.log(`[IngestPassengerJob] Kept ${numId} (cid=${_ipjSCid}) — incoming=${_ipjIncomingMs} vs newestClosed=${newestForId._t} (unknown timestamps, ingesting)`);
          return null;
        };
        // §FIX-UA-DIAG — always log the decision branch so silent drops are visible.
        console.log(`[IngestPassengerJob/diag] status='${_ipjStatus}' fbKey='${_ipjFbKey}' jobId='${_ipjJobId}' incomingMs=${_ipjIncomingMs} cid=${_ipjSCid}`);

        if (_ipjStatus === 'Scheduled') {
          // Scheduled bookings land directly in the Unassigned queue as Pending.
          // ScheduledFor is preserved so the 📅 Sched badge shows on the job card.
          const _ipjNumIdSch = parseInt(_ipjJobId, 10) || 0;
          const already = jobStore.find(j => j._fbKey === _ipjFbKey || (_ipjNumIdSch > 0 && j.Id === _ipjNumIdSch));
          const alreadyClosed = _ipjFindClosed(_ipjNumIdSch);
          console.log(`[IngestPassengerJob/diag] Scheduled branch — already=${already ? 'job#'+already.Id+'/'+already.BookingStatus : 'no'} alreadyClosed=${alreadyClosed ? 'closed#'+alreadyClosed.Id : 'no'}`);
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
              updateSeq: 1,
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
            _writeBookingEvent(_sCid, _sId, 'StatusChanged',
              { from: null, to: 'Scheduled', action: 'created', source: 'IngestPassengerJob' },
              'passenger', 1).catch(() => {});
            console.log(`[passenger] Scheduled job ${_ipjFbKey} stored as Scheduled (svc=${_sn.serviceType}) — ${_sn.name} from ${_sn.pickAddress}`);
          }
          objectD(res, { ok: true, action: 'pending' });

        } else if (_ipjStatus === 'Waiting' || _ipjStatus === 'Pending') {
          // 'Pending' written by some external dispatch apps — treated same as 'Waiting' (book-now).
          // Also fired by the client-side NotifyDispatchAt timer to promote a Scheduled job.
          // FIX — also match by numeric Id so dispatch-console jobs (no _fbKey yet) are recognised.
          const _ipjNumId = parseInt(_ipjJobId, 10) || 0;
          if (_isBlockedFromReIngest(_ipjNumId)) {
            console.log(`[IngestPassengerJob] blocked re-ingest for cancelled/in-flight job #${_ipjNumId} (status='${_ipjStatus}')`);
            objectD(res, { ok: true, action: 'blocked_cancelled' });
            return;
          }
          const already = jobStore.find(j => j._fbKey === _ipjFbKey || (_ipjNumId > 0 && j.Id === _ipjNumId));
          const alreadyClosed = _ipjFindClosed(_ipjNumId);
          console.log(`[IngestPassengerJob/diag] Waiting/Pending branch — already=${already ? 'job#'+already.Id+'/'+already.BookingStatus : 'no'} alreadyClosed=${alreadyClosed ? 'closed#'+alreadyClosed.Id+'/completedAtMs='+(alreadyClosed.completedAtMs||0) : 'no'}`);
          // Stamp _fbKey onto an existing dispatch-console job so future lookups hit by key too.
          if (already && !already._fbKey) { already._fbKey = _ipjFbKey; saveJobStore(); }
          if (already && already.BookingStatus === 'No One') {
            console.log(`[§FIX-NoOneTrace/IngestPassengerJob] *** RE-INGEST ON NO ONE *** job#${already.Id} fbKey='${_ipjFbKey}' incomingStatus='${_ipjStatus}' incomingMs=${_ipjIncomingMs} — passenger app/poller is re-publishing a job that dispatcher set to No One. Status NOT changed by this branch, but check ProcUpdateJobv6 trace for follow-on flips.`);
          }
          // §103 Bug 2 — promote an existing Scheduled job to Pending (NotifyDispatchAt fired).
          // Only if not already manually assigned/offered by a dispatcher.
          if (already && already.BookingStatus === 'Scheduled') {
            const _promotePrev = already.BookingStatus;
            already.BookingStatus = 'Pending';
            _bumpSeqAndEmitStatus(already, _promotePrev, 'passenger', 'IngestPassengerJob', { action: 'promote' });
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
            const _wStatus = _wTreatSched ? 'Scheduled' : 'Pending';
            jobStore.push({
              _fbKey: _ipjFbKey, Id: _wId, companyId: _wCid,
              BookingStatus: _wStatus,
              BookingSource: _isWebBkW ? 'Website' : 'passenger',
              updateSeq: 1,
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
            _writeBookingEvent(_wCid, _wId, 'StatusChanged',
              { from: null, to: _wStatus, action: 'created', source: 'IngestPassengerJob' },
              'passenger', 1).catch(() => {});
            console.log(`[passenger] ${_wTreatSched ? 'Scheduled' : 'Waiting'} job ${_ipjFbKey} ingested (svc=${_wn.serviceType}) — ${_wn.name} from ${_wn.pickAddress}${_wTreatSched ? ' [auto-promoted to Scheduled, notifyAt=' + _wNotifyAt + ']' : ''}`);
          }
          objectD(res, { ok: true, action: 'pending' });

        } else if (_ipjStatus === 'Cancelled') {
          // §FIX-CB — passenger/website cancel now routes through unified flow so that
          // already-Assigned/Picking trips are properly closed, driver state restored
          // (gated by remaining assignments), Firebase booking-scope cleaned, and the
          // driver app is notified via notification/{drv}.
          const _ipjNumIdC = parseInt(_ipjJobId, 10) || 0;
          const _cIdx = jobStore.findIndex(j => j._fbKey === _ipjFbKey || (_ipjNumIdC > 0 && j.Id === _ipjNumIdC));
          if (_cIdx !== -1) {
            const _cJob = jobStore[_cIdx];
            const _bs  = _cJob.BookingStatus || '';
            const _src = (_cJob.BookingSource || '').toLowerCase();
            const _cancelledBy = (_src === 'website' || _src === 'website booking') ? 'website' : 'passenger';
            // For Scheduled/Pending/No One/Unreached/'' jobs that never had a driver: still
            // funnel through cancelBooking — it idempotently closes them and snapshots fields.
            const _r = await cancelBooking({
              bookingId: _cJob.Id, cancelledBy: _cancelledBy, driverFault: false,
              companyId: sessionCompanyId, source: 'IngestPassengerJob/Cancelled',
              reason: _ipjJob.cancelReason || _ipjJob.CancelReason || ''
            });
            console.log(`[passenger] Cancelled job ${_ipjFbKey} (was ${_bs}, by ${_cancelledBy}) → ${JSON.stringify(_r)}`);
          } else {
            console.log(`[passenger] Cancelled job ${_ipjFbKey} not found in jobStore — ignoring`);
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
        const allJobs = buildJobListResponse(companyJobs(jobStore), sessionCompanyId);
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

  // ── React SPA (dist/) — before legacy ASPX static files ─────────────────
  if (await tryServeReactSpa(req, res, urlPath)) return;

  // ── Static file serving (legacy ASPX / assets under taxitime.co.nz) ───────
  // Skip /assets/ — owned by Vite dist/ only (see tryServeReactSpa above).
  if (urlPath.startsWith('/assets/')) {
    console.log(`404: ${req.method} ${urlPath} (dist asset missing)`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${urlPath}`);
    return;
  }

  const filePath = resolveFilePath(urlPath);
  if (filePath) {
    console.log(`200: ${req.method} ${urlPath} -> ${filePath.replace(ROOT, '')}`);
    const ext = path.extname(filePath).toLowerCase();
    const _cc = ext === '.aspx' ? 'no-store, must-revalidate' : 'no-cache';
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': _cc,
      'Access-Control-Allow-Origin': '*',
    });
    if (ext === '.aspx') {
      if (!GOOGLE_MAPS_API_KEY && urlPath.includes('Default.aspx')) {
        console.warn('[maps] GOOGLE_MAPS_API_KEY is not set — map may fail to load');
      }
      const html = injectAspxEnv(fs.readFileSync(filePath, 'utf8'));
      res.end(html);
      return;
    }
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  console.log(`404: ${req.method} ${urlPath}`);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(`404 Not Found: ${urlPath}`);
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

// §FIX-OfferClear — server-side fail-safe for "driver app crashed mid-offer".
// When a stale-offer watchdog fires, the dispatch console's 27-s frontend timer
// may not have run (e.g. console closed, page refreshed). Push the same clear-
// offer writes the frontend would have made, so a recovered driver app drops
// the stale Accept popup and doesn't act on a job dispatch already abandoned.
//   - PATCH online/{cid}/{vid}/current  → nulls jobId/joboffer/pickup/dropoff/etc + Away
//   - DELETE jobs/{cid}/{vid}/{driverId}      (offer envelope)
//   - DELETE joback/{bookingId}                (legacy ack path)
//   - DELETE notification/{driverId}           (push payload)
// All writes are fire-and-forget; failures log but never throw.
function clearOfferOnFirebase(cid, vid, did, bookingId, sourceTag, reason) {
  const _reason = reason === 'withdraw' ? 'withdraw' : 'stale';
  const _jobsEventType = _reason === 'withdraw' ? 'removed' : 'cancelled';
  if (!process.env.BW_FIREBASE_SECRET) {
    console.log(`[§FIX-OfferClear/${sourceTag}] BW_FIREBASE_SECRET not set — skipping driver-app clear`);
    return;
  }
  if (!cid || !vid || (!did && did !== 0)) {
    console.log(`[§FIX-OfferClear/${sourceTag}] missing cid=${cid} vid=${vid} did=${did} — skipping`);
    return;
  }
  (async () => {
    try {
      const tok = await getFirebaseServerToken();
      if (!tok) {
        console.warn(`[§FIX-OfferClear/${sourceTag}] no Firebase token — skipping`);
        return;
      }
      const auth = encodeURIComponent(tok);
      const bookingIdStr = String(bookingId);
      // §FIX-OfferClear/race-guard — verify-before-clear. Between the watchdog firing
      // and these async writes, smartAutoDispatch may have written a FRESH offer to the
      // same paths. Read each node first; if it no longer references THIS bookingId,
      // skip the clear — the new offer must survive.
      // NOTE: fbRequest returns { status, headers, body } — payload is at .body.
      // A failed GET (non-200) is treated as "unknown state, do not destroy" — safer to
      // leave the node alone than to risk wiping a fresh offer.
      // 1. jobs/{cid}/{vid}/{driverId}/{bookingId} — the Offered envelope.
      // §FIX-DA-G2 — booking-keyed children: direct child DELETE. The
      // sibling-booking guard that used to live here is no longer needed —
      // a different booking's offer would live under a different child key.
      try {
        // §FIX-DA-G2 + C2 — write eventType into the child as the last update
        // so the driver app reads it off the onChildRemoved snapshot, then
        // delete the node. Stale watchdog → 'cancelled'; dispatcher withdraw → 'removed'.
        const _ocUrl = `${FB_DB_URL}/jobs/${cid}/${vid}/${did}/${bookingIdStr}.json?auth=${auth}`;
        try {
          await fbRequest(_ocUrl, 'PATCH', { eventType: _jobsEventType });
        } catch (ePatch) {
          console.warn(`[§FIX-OfferClear/${sourceTag}] jobs/ child eventType PATCH failed:`, ePatch && ePatch.message);
        }
        const _delResp = await fbRequest(_ocUrl, 'DELETE', null);
        console.log(`[§FIX-OfferClear/${sourceTag}] jobs/${cid}/${vid}/${did}/${bookingIdStr} → eventType=${_jobsEventType} then deleted [${_delResp && _delResp.status}]`);
      } catch (e2) { console.warn(`[§FIX-OfferClear/${sourceTag}] jobs/ child DELETE failed:`, e2 && e2.message); }
      // 2. online/{cid}/{vid}/current — only clear if it still references THIS booking.
      try {
        const resp = await fbRequest(`${FB_DB_URL}/online/${cid}/${vid}/current.json?auth=${auth}`, 'GET', null);
        if (!resp || resp.status !== 200) {
          console.warn(`[§FIX-OfferClear/${sourceTag}] online/${cid}/${vid}/current GET status=${resp && resp.status} — skip (safe)`);
        } else {
          const oc = resp.body;
          const ocBid = oc ? String(oc.currentJobId || oc.jobId || '') : '';
          if (oc === null || oc === undefined) {
            console.log(`[§FIX-OfferClear/${sourceTag}] online/${cid}/${vid}/current empty — skip`);
          } else if (ocBid && ocBid !== bookingIdStr) {
            console.log(`[§FIX-OfferClear/${sourceTag}] online/${cid}/${vid}/current now holds jobId=${ocBid} (fresh offer) — skip clear of stale ${bookingIdStr}`);
          } else {
            await fbRequest(`${FB_DB_URL}/online/${cid}/${vid}/current.json?auth=${auth}`, 'PATCH', {
              currentJobId: null, jobId: null, joboffer: 0,
              jobpickup: '', jobdropoff: '', JobphoneNo: '', jobname: '',
              vehiclestatus: 'Away'
            });
            console.log(`[§FIX-OfferClear/${sourceTag}] online/${cid}/${vid}/current cleared (job#${bookingId})`);
          }
        }
      } catch (e1) { console.warn(`[§FIX-OfferClear/${sourceTag}] online/current guarded-PATCH failed:`, e1 && e1.message); }
      // 3. joback/{bookingId} — keyed by bookingId so no race risk; safe to delete.
      try {
        await fbRequest(`${FB_DB_URL}/joback/${bookingId}.json?auth=${auth}`, 'DELETE', null);
      } catch (e3) { console.warn(`[§FIX-OfferClear/${sourceTag}] joback/ DELETE failed:`, e3 && e3.message); }
      // 4. notification/{driverId} — guarded: only delete if it still references THIS booking.
      // Skip on dispatcher withdraw — _withdrawJobFromDriver already wrote job_removed.
      if (_reason !== 'withdraw') {
      try {
        const resp = await fbRequest(`${FB_DB_URL}/notification/${did}.json?auth=${auth}`, 'GET', null);
        if (!resp || resp.status !== 200) {
          console.warn(`[§FIX-OfferClear/${sourceTag}] notification/${did} GET status=${resp && resp.status} — skip (safe)`);
        } else {
          const nb = resp.body;
          const nbBid = nb ? String(nb.bookingId || nb.BookingId || nb.jobId || nb.JobId || '') : '';
          if (nb === null || nb === undefined) {
            // empty — nothing to do
          } else if (nbBid && nbBid !== bookingIdStr) {
            console.log(`[§FIX-OfferClear/${sourceTag}] notification/${did} now holds bookingId=${nbBid} (fresh offer) — skip clear of stale ${bookingIdStr}`);
          } else {
            await fbRequest(`${FB_DB_URL}/notification/${did}.json?auth=${auth}`, 'DELETE', null);
          }
        }
      } catch (e4) { console.warn(`[§FIX-OfferClear/${sourceTag}] notification/ guarded-DELETE failed:`, e4 && e4.message); }
      }
    } catch (eOuter) {
      console.warn(`[§FIX-OfferClear/${sourceTag}] outer failure:`, eOuter && eOuter.message);
    }
  })();
}

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
    const st = String(j.BookingStatus || '');
    const needsSource = ['Pending', 'Offered', 'Scheduled', 'No One'].includes(st);
    if (!_isValidJobRecord(j, { requireSource: needsSource })) {
      console.log(`[stale-offer watchdog] removing invalid phantom job #${j.Id} (was Offered)`);
      const idx = jobStore.indexOf(j);
      if (idx >= 0) jobStore.splice(idx, 1);
      changed = true;
      return;
    }
    const age = j.offeredAt ? (now - j.offeredAt) : STALE_MS + 1;
    if (age > STALE_MS) {
      console.log(`[stale-offer watchdog] job #${j.Id} stuck as Offered for ${Math.round(age/1000)}s (driver ${j.DriverId}) — resetting to Pending`);
      console.log(`[§FIX-OfferClear/staleOfferWatchdog-90s] *** SERVER 90s WATCHDOG FIRED *** job#${j.Id} prevDriverId=${j.DriverId} prevVehicleId=${j.VehicleId} offeredAt=${j.offeredAt} ageMs=${age} — pushing clear-offer to driver-app Firebase nodes.`);
      // §FIX-OfferClear — push clear-offer so a recovered driver app drops the stale Accept popup.
      // j.companyId is stamped at intake by IngestPassengerJob / ProcUpdateJobv6.
      clearOfferOnFirebase(j.companyId, j.VehicleId, j.DriverId, j.Id, 'staleOfferWatchdog-90s');
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
        // permanently block that slot.  Two safety checks before deleting:
        //   (a) jobStore check — same numeric ID can appear in closedJobStore
        //       from a prior session while a brand-new job with that ID is
        //       actively running; never delete a live Firebase entry.
        //   (b) timestamp check — a Website/Console booking can REUSE a
        //       recycled ID after the previous job with that ID was closed.
        //       The pending record is fresh (CreatedAt newer than the closed
        //       job's completion time) — leaving it must NOT be treated as
        //       stale or the booking silently disappears (operator sees the
        //       toast but no row in the Unassigned tab).
        if (_normIdNum) {
          const _normLive = jobStore.find(j =>
            j.Id === _normIdNum && String(j.companyId || '') === cid
          );
          if (!_normLive) {
            // Compare against the NEWEST closure for this (Id, companyId).
            // closedJobStore can contain multiple historical entries with the
            // same numeric Id (ID-recycling across days); using .find() would
            // return the oldest and misclassify recycle scenarios.
            const _allClosedMatches = closedJobStore.filter(j =>
              j.Id === _normIdNum && String(j.companyId || '') === cid
            );
            if (_allClosedMatches.length) {
              const _closedAtMs = _allClosedMatches.reduce((max, j) => {
                const t = Number(j.completedAtMs) ||
                  (j.JobCompleteTime ? Date.parse(j.JobCompleteTime) : 0) || 0;
                return t > max ? t : max;
              }, 0);
              // Robust pending-creation timestamp: try every known field
              // before giving up. Some booking sources omit createdAt entirely.
              const _pendCreatedMs =
                Number(rec.createdAt) ||
                (rec.CreatedAt ? Date.parse(rec.CreatedAt) : 0) ||
                (rec.BookingDateTime ? Date.parse(rec.BookingDateTime) : 0) ||
                Number(rec.ScheduledForMs) ||
                (rec.ScheduledFor ? Date.parse(rec.ScheduledFor) : 0) ||
                0;
              if (_pendCreatedMs && _closedAtMs && _pendCreatedMs <= _closedAtMs) {
                firebaseDbDelete(`pendingjobs/${cid}/${key}`, token).catch(() => {});
                console.log(`[pendingjobs-normalizer] Deleted stale pendingjobs/${cid}/${key} (job closed in store, pendingCreated=${_pendCreatedMs} closedAt=${_closedAtMs})`);
                continue;
              }
              // Fresh booking that reused a recycled ID, OR we cannot compare
              // timestamps. Safer fallback: KEEP it. Losing a real booking
              // (the symptom we just fixed) is much worse than letting an
              // edge-case stale record linger one extra cycle.
              console.log(`[pendingjobs-normalizer] Kept pendingjobs/${cid}/${key} — pendingCreated=${_pendCreatedMs} vs newest closedAt=${_closedAtMs} (ID reuse or unknown timestamps)`);
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
    let seeded = 0, recovered = 0, skippedOrphan = 0, skippedStub = 0, deletedStale = 0;
    const _toDeleteAtBoot = []; // {cid, vid, reason}

    // Build a per-company {vehicleId → identity} index from the most-recent
    // closed job for that vehicle. closedJobStore is our persistent source of
    // truth for driver/vehicle identity — every completed job carries full
    // DriverId/DriverName/VehicleNo. We use this to recover identity for
    // Firebase nodes whose `current/` lost identity fields (e.g. driver app
    // went offline mid-trip and only job/GPS state survived).
    const _idIndex = {};  // { cid: { vehicleId: { driverid, drivername, vehiclenumber, vehicletype } } }
    for (let i = closedJobStore.length - 1; i >= 0; i--) {
      const cj = closedJobStore[i];
      const _cid = String(cj.companyId || cj.CompanyId || '');
      // Index by BOTH VehicleNo and VehicleId (legacy jobs sometimes store
      // the driver-id in VehicleId and the real plate number in VehicleNo;
      // Firebase online/{cid} keys are the plate number). Indexing both
      // keys means lookup by either succeeds.
      const _vno = String(cj.VehicleNo || cj.vehiclenumber || '').trim();
      const _vid = String(cj.VehicleId || '').trim();
      const _did = String(cj.DriverId || cj.driverId || '').trim();
      // Skip jobs with no real driver (placeholder ids -1/-2/0 mean "unassigned")
      const _BAD_DRV = new Set(['', '0', '-1', '-2', 'undefined', 'null']);
      if (!_cid || _BAD_DRV.has(_did) || (!_vno && !_vid)) continue;
      if (!_idIndex[_cid]) _idIndex[_cid] = {};
      const _entry = {
        driverid:      _did,
        // NOTE: do NOT fall back to cj.Name — that is the passenger's name.
        drivername:    cj.DriverName || cj.drivername || '',
        vehiclenumber: _vno || _vid,
        vehicletype:   cj.VehicleType|| cj.vehicletype || '',
      };
      // Newest hit wins per key (we iterate newest-first)
      if (_vno && !_idIndex[_cid][_vno]) _idIndex[_cid][_vno] = _entry;
      if (_vid && _vid !== _vno && !_idIndex[_cid][_vid]) _idIndex[_cid][_vid] = _entry;
    }

    for (const [cid, vehicles] of Object.entries(r.body)) {
      if (!vehicles || typeof vehicles !== 'object') continue;
      for (const [vehicleId, node] of Object.entries(vehicles)) {
        if (!node || typeof node !== 'object') continue;

        // Driver fields may be flat on the node or nested under current/
        const cur = (node.current && typeof node.current === 'object') ? node.current : {};

        // Skip orphan keys: stray writes that used a driverId or "0" as the
        // key instead of the vehicleId (we've seen `online/{cid}/0` and
        // `online/{cid}/D002` polluting the tree). To avoid dropping any
        // tenant that legitimately uses D### as its vehicle key, only treat
        // the key as orphan when it matches the suspicious pattern AND the
        // node has no identity AND no top-level vehiclestatus — i.e. it's
        // a partial stub that couldn't possibly be a real vehicle.
        const _looksOrphanKey = (vehicleId === '0' || /^D\d+$/i.test(vehicleId));
        const _hasAnyIdentity = !!(cur.driverid || cur.driverId || cur.drivername || cur.driverName ||
                                   cur.vehiclenumber || cur.vehicleNumber ||
                                   node.driverid || node.drivername || node.vehiclenumber);
        if (_looksOrphanKey && !_hasAnyIdentity && !node.vehiclestatus) {
          // Stray PATCH-write garbage. Schedule for deletion so it can never be
          // re-seeded and so dispatch UI's child_added can't pick it up either.
          _toDeleteAtBoot.push({ cid, vid: vehicleId, reason: 'orphan-no-identity' });
          skippedOrphan++;
          continue;
        }

        const status = node.vehiclestatus || cur.vehiclestatus || cur.currentstatus || '';
        // Skip offline / logged-out drivers — they are genuinely not available
        if (!status || _OFFLINE.has(status)) continue;

        // Stale-presence guard (ghost driver, see [ghost-presence-sweeper]):
        // The driver app is supposed to delete its `online/{cid}/{vid}` node on
        // sign-out, but in practice a stray background heartbeat can resurrect
        // the node AFTER the deletion fires (with `vehiclestatus=Available` and
        // a frozen `lastSeen`). The dispatch console then re-shows the driver
        // forever. If the most-recent `lastSeen` is older than STALE_PRESENCE_MS,
        // treat the node as a corpse — DON'T seed it, and DELETE it from
        // Firebase so dispatch UI's child_removed clears the row immediately.
        const _lastSeen = _normalizeLastSeenMs(node.lastSeen || cur.lastSeen);
        if (_lastSeen && (Date.now() - _lastSeen) > STALE_PRESENCE_MS) {
          _toDeleteAtBoot.push({ cid, vid: vehicleId, reason: `lastSeen ${Math.round((Date.now()-_lastSeen)/1000)}s ago` });
          continue;
        }

        let _driverId    = cur.driverid      || cur.driverId      || node.driverid      || '';
        let _drivername  = cur.drivername    || cur.driverName    || node.drivername    || '';
        let _vehnum      = cur.vehiclenumber || cur.vehicleNumber || node.vehiclenumber || '';
        let _vehtype     = cur.vehicletype   || cur.vehicleType   || node.vehicletype   || '';

        // Identity fallback: if Firebase has no identity for this vehicle,
        // recover it from the most-recent closed job (built above). This
        // covers the common case where the driver app went offline mid-trip
        // and only wrote partial state back — closedJobStore still knows who
        // was driving this vehicle.
        if (!_driverId && !_drivername && !_vehnum) {
          const rec = _idIndex[cid] && _idIndex[cid][vehicleId];
          if (rec && (rec.driverid || rec.drivername)) {
            _driverId   = rec.driverid;
            _drivername = rec.drivername;
            _vehnum     = rec.vehiclenumber;
            _vehtype    = _vehtype || rec.vehicletype;
            recovered++;
            console.log(`[seed-drivers] RECOVERED cid=${cid} vehId=${vehicleId} from closedJobStore — driver=${_driverId} (${_drivername})`);
          } else {
            // Genuinely unrecoverable — node has status but no identity
            // anywhere. Distinguish a real-looking node (has job/GPS state)
            // from a trivial stale stub.
            const _looksReal = !!(cur.currentJobId || cur.jobId || cur.lat || cur.lng);
            if (_looksReal) {
              console.warn(`[seed-drivers] SKIP cid=${cid} vehId=${vehicleId} — node looks active (status=${status}, has job/GPS) but no identity in Firebase or closedJobStore`);
            } else {
              skippedStub++;
            }
            continue;
          }
        }

        const driverId     = String(_driverId || vehicleId);
        const drivername   = _drivername || '';
        const vehiclenumber= _vehnum     || vehicleId;
        const vehicletype  = _vehtype    || '';
        // Zone fallback: prefer Firebase value, then fall back to the driver's
        // last persisted zone from .data/zone_assignments.json so a returning
        // driver lands in their previous zone instead of "" until the next
        // GPS-driven re-detection runs.
        const _savedZone   = getSavedZone(driverId);
        const zonename     = cur.zonename     || cur.zoneName     || node.zonename     || (_savedZone && _savedZone.zonename) || '';
        const zoneid       = cur.zoneid       || cur.zoneId       || node.zoneid       || (_savedZone && _savedZone.zoneid)   || '';
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
          zoneid,
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
    // Fire-and-forget: delete the stale/orphan presence nodes we identified
    // above. This makes the cleanup permanent (next boot won't re-find them)
    // and triggers child_removed on every connected dispatch console so any
    // ghost rows disappear within seconds.
    if (_toDeleteAtBoot.length) {
      const _delAuth = encodeURIComponent(token);
      for (const { cid, vid, reason } of _toDeleteAtBoot) {
        fbRequest(`${FB_DB_URL}/online/${cid}/${vid}.json?auth=${_delAuth}`, 'DELETE', null)
          .then(() => { deletedStale++; console.log(`[seed-drivers] deleted stale online/${cid}/${vid} (${reason})`); })
          .catch(e => console.warn(`[seed-drivers] DELETE online/${cid}/${vid} failed: ${e && e.message}`));
      }
    }
    console.log(`[seed-drivers] seeded ${seeded} driver(s) from Firebase online/ into ZONE_DRIVERS (recovered=${recovered} skippedOrphan=${skippedOrphan} skippedStub=${skippedStub} scheduledForDelete=${_toDeleteAtBoot.length})`);
  } catch (e) {
    console.warn('[seed-drivers] startup seed failed (non-fatal):', e.message);
  }
}

// ─── Ghost-presence sweeper ─────────────────────────────────────────────────
// Permanent fix for "signed-out driver still on dispatch HQ".
//
// Root cause: the driver app, on Sign Out, is meant to delete
// `online/{cid}/{vid}` then stop writing. In practice a stray background
// task (final GPS, last heartbeat) sometimes re-creates the parent node AFTER
// the delete, leaving a corpse with `vehiclestatus=Available` and a frozen
// `lastSeen`. The dispatch console reads that node via cars_Ref and shows
// the driver. "Sometimes works, sometimes doesn't" = race condition.
//
// This sweeper runs every 30s, scans every `online/{cid}/{vid}` node, and
// DELETES any whose lastSeen is older than STALE_PRESENCE_MS, plus any
// orphan-pattern keys (`0`, `D###`) with no identity. It also removes the
// matching ZONE_DRIVERS entry so VehiclesStatus drops them on the next poll.
//
// Safe by design: only ever deletes presence/heartbeat data. Never touches
// jobs, notifications, or driver identity records.
const STALE_PRESENCE_MS = 15 * 60 * 1000; // 15 minutes — driver app heartbeats can gap during GPS/background

// Driver app writes Date.now() (ms). Legacy nodes may store Unix seconds.
function _normalizeLastSeenMs(raw) {
  const n = Number(raw || 0);
  if (!n || !Number.isFinite(n)) return 0;
  return n < 1e12 ? n * 1000 : n;
}

setInterval(async () => {
  let token;
  try { token = await getFirebaseServerToken(); } catch(e) { return; }
  if (!token) return;
  let r;
  try {
    r = await fbRequest(`${FB_DB_URL}/online.json?auth=${encodeURIComponent(token)}`, 'GET', null);
  } catch(e) { return; }
  if (!r || r.status !== 200 || !r.body || typeof r.body !== 'object') return;

  const _OFFLINE_S = new Set(['Offline','offline','LoggedOut','loggedout','logoff','inactive']);
  const _toKill = []; // {cid, vid, reason}

  for (const [cid, vehicles] of Object.entries(r.body)) {
    if (!vehicles || typeof vehicles !== 'object') continue;
    for (const [vid, node] of Object.entries(vehicles)) {
      if (!node || typeof node !== 'object') continue;
      const cur = (node.current && typeof node.current === 'object') ? node.current : {};
      const status = node.vehiclestatus || cur.vehiclestatus || cur.currentstatus || '';

      // 1) Explicit offline corpse — driver app left the status on the node.
      if (status && _OFFLINE_S.has(status)) {
        _toKill.push({ cid, vid, reason: `status=${status}` });
        continue;
      }

      // 2) Orphan key (`0` or `D###`) with no identity field anywhere.
      const _looksOrphanKey = (vid === '0' || /^D\d+$/i.test(vid));
      const _hasIdentity = !!(cur.driverid || cur.driverId || cur.drivername || cur.driverName ||
                              cur.vehiclenumber || cur.vehicleNumber ||
                              node.driverid || node.drivername || node.vehiclenumber);
      if (_looksOrphanKey && !_hasIdentity) {
        _toKill.push({ cid, vid, reason: 'orphan-no-identity' });
        continue;
      }

      // 3) Ghost: heartbeat exists but is older than threshold. Driver app
      // crashed/quit without clean sign-out, OR a stray write resurrected
      // a deleted node. Either way the driver is not actually online.
      const lastSeen = _normalizeLastSeenMs(node.lastSeen || cur.lastSeen);
      if (lastSeen && (Date.now() - lastSeen) > STALE_PRESENCE_MS) {
        _toKill.push({ cid, vid, reason: `lastSeen ${Math.round((Date.now()-lastSeen)/1000)}s ago` });
      }
      // Nodes with no lastSeen at all but with identity present are LEFT
      // ALONE — they are likely a brand-new driver app that hasn't sent its
      // first heartbeat yet. The next sweep will catch them if they truly
      // never write a heartbeat.
    }
  }

  if (!_toKill.length) return;
  const _killAuth = encodeURIComponent(token);
  for (const { cid, vid, reason } of _toKill) {
    fbRequest(`${FB_DB_URL}/online/${cid}/${vid}.json?auth=${_killAuth}`, 'DELETE', null)
      .then(() => console.log(`[ghost-presence-sweeper] deleted online/${cid}/${vid} (${reason})`))
      .catch(e => console.warn(`[ghost-presence-sweeper] DELETE online/${cid}/${vid} failed: ${e && e.message}`));
    // Also drop from ZONE_DRIVERS so VehiclesStatus.dt6 stops listing them.
    // CORRECTNESS: match ONLY by VehicleId (the Firebase key in online/{cid}/{vid}
    // is, by contract, the vehicle id). Matching by `driverid===vid` would
    // wrongly evict an active driver whose driverid happens to equal an orphan
    // key — e.g., active driver driverid='D002' on VehicleId='TAXI02' must not
    // be removed when we delete the stray online/{cid}/D002 orphan node.
    for (let i = ZONE_DRIVERS.length - 1; i >= 0; i--) {
      const d = ZONE_DRIVERS[i];
      if (cid && d.companyId && String(d.companyId) === String(cid) &&
          String(d.VehicleId) === String(vid)) {
        ZONE_DRIVERS.splice(i, 1);
      }
    }
  }
  console.log(`[ghost-presence-sweeper] swept ${_toKill.length} stale presence node(s)`);
}, 30 * 1000);

async function _syncBizAccountsFromFirebase() {
  try {
    const tok = await getFirebaseServerToken();
    if (!tok) return;
    const cids = [...new Set(registrationStore.map(r => r.companyId).filter(Boolean))];
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
  console.log(`[tz] process.env.TZ=${process.env.TZ} | server local time=${new Date().toString()}`);
  _seedZoneDriversFromFirebase();
  _syncBizAccountsFromFirebase();
  setTimeout(() => { hydrateJobStoreFromFirebase().catch(e => console.warn('[hydrate] boot failed:', e && e.message)); }, 8000);
  setInterval(() => { _releaseScheduledJobs().catch(() => {}); }, 60000);
  setInterval(() => { _serverAutoDispatchTick().catch(e => console.warn('[server-auto-dispatch]', e && e.message)); }, 30000);
});

// ─── Firebase → jobStore hydration (survives Railway ephemeral disk) ─────────
const _HYDRATE_ACTIVE = new Set(['Pending','Offered','Assigned','Picking','Active','OnTrip','Queued','Scheduled','No One','Busy']);

function _mergeFbIntoJob(job, fb) {
  if (!fb || typeof fb !== 'object') return job;
  if (fb.PickAddress || fb.pickup || fb.pickupAddress) job.PickAddress = fb.PickAddress || fb.pickup || fb.pickupAddress || job.PickAddress;
  if (fb.DropAddress || fb.dropoff || fb.dropAddress) job.DropAddress = fb.DropAddress || fb.dropoff || fb.dropAddress || job.DropAddress;
  if (fb.PhoneNo || fb.passengerPhone) job.PhoneNo = fb.PhoneNo || fb.passengerPhone || job.PhoneNo;
  if (fb.Name || fb.passengerName) job.Name = fb.Name || fb.passengerName || job.Name;
  if (fb.DriverId || fb.driverId) job.DriverId = fb.DriverId || fb.driverId;
  if (fb.VehicleNo || fb.vehicleId) job.VehicleNo = fb.VehicleNo || fb.vehicleId;
  const st = fb.BookingStatus || fb.Status || fb.status;
  if (st && _HYDRATE_ACTIVE.has(String(st))) job.BookingStatus = String(st);
  if (fb.TotalFare != null || fb.fare != null) job.TotalFare = fb.TotalFare ?? fb.fare;
  if (fb.distanceKm != null) job.distance = fb.distanceKm;
  return job;
}

function _fbRecToJob(bid, cid, fb, fallbackStatus) {
  const st = String(fb.BookingStatus || fb.Status || fb.status || fallbackStatus || '');
  if (!st) return null;
  const rec = {
    Id: bid,
    companyId: cid,
    BookingStatus: st,
    PickAddress: fb.PickAddress || fb.pickup || fb.pickupAddress || '',
    DropAddress: fb.DropAddress || fb.dropoff || fb.dropAddress || '',
    PickLatLng: fb.PickLatLng || (fb.pickupLat != null ? `${fb.pickupLat},${fb.pickupLng}` : ''),
    DropLatLng: fb.DropLatLng || (fb.dropLat != null ? `${fb.dropLat},${fb.dropLng}` : ''),
    PhoneNo: fb.PhoneNo || fb.passengerPhone || '',
    Name: fb.Name || fb.passengerName || fb.UserFName || '',
    DriverId: fb.DriverId || fb.driverId || fb.AssignedDriver || 0,
    VehicleNo: fb.VehicleNo || fb.vehicleId || fb.CallSign || '',
    VehicleId: fb.VehicleId || fb.vehicleId || 0,
    EstimatedFare: fb.EstimatedFare || fb.Fare || fb.fare || '',
    TotalFare: fb.TotalFare || fb.fare || '',
    serviceType: fb.serviceType || fb.ServiceType || 'taxi',
    BookingSource: fb.BookingSource || fb.source || fb.bookingSource || '',
    updateSeq: parseInt(fb.updateSeq || fb.version || 0) || 0,
    _hydratedFromFirebase: true,
  };
  const needsSource = ['Pending', 'Offered', 'Scheduled', 'No One'].includes(st);
  if (!_isValidJobRecord(rec, { requireSource: needsSource, companyId: cid, fallbackKey: bid })) return null;
  return rec;
}

async function _hydrateSingleJobFromFirebase(companyId, bookingId) {
  const cid = String(companyId || '').trim();
  const bid = parseInt(bookingId) || 0;
  if (!bid) return false;
  const tok = await getFirebaseServerToken().catch(() => null);
  if (!tok) return false;
  const auth = encodeURIComponent(tok);
  const paths = [
    cid ? `allbookings/${cid}/${bid}` : null,
    cid ? `pendingjobs/${cid}/${bid}` : null,
  ].filter(Boolean);
  for (const p of paths) {
    try {
      const r = await fbRequest(`${FB_DB_URL}/${p}.json?auth=${auth}`, 'GET');
      if (r.status !== 200 || !r.body || typeof r.body !== 'object') continue;
      const st = String(r.body.BookingStatus || r.body.Status || r.body.status || '');
      if (!st || !_HYDRATE_ACTIVE.has(st)) continue;
      const existing = jobStore.find(j => j && j.Id === bid);
      if (existing) {
        _mergeFbIntoJob(existing, r.body);
        if (cid) existing.companyId = cid;
      } else {
        const job = _fbRecToJob(bid, cid || String(r.body.companyId || ''), r.body, st);
        if (!job || _jobExistsInStore(bid, cid)) continue;
        jobStore.push(job);
      }
      saveJobStore();
      console.log(`[hydrate] single job #${bid} restored from Firebase ${p} (${st})`);
      return true;
    } catch (e) { /* try next path */ }
  }
  return false;
}

async function hydrateJobStoreFromFirebase() {
  const tok = await getFirebaseServerToken().catch(() => null);
  if (!tok) { console.warn('[hydrate] no Firebase token'); return { ok: false }; }
  const auth = encodeURIComponent(tok);
  const cids = _fixsCollectCompanyIds();
  let added = 0, updated = 0;
  for (const cid of cids) {
    for (const root of [`pendingjobs/${cid}`, `allbookings/${cid}`]) {
      try {
        const r = await fbRequest(`${FB_DB_URL}/${root}.json?auth=${auth}`, 'GET');
        if (r.status !== 200 || !r.body || typeof r.body !== 'object') continue;
        for (const [key, rec] of Object.entries(r.body)) {
          if (!rec || typeof rec !== 'object') continue;
          const bid = parseInt(rec.BookingId || rec.bookingId || key) || 0;
          if (!bid) continue;
          const st = String(rec.BookingStatus || rec.Status || rec.status || '');
          if (!st || !_HYDRATE_ACTIVE.has(st)) continue;
          const idx = jobStore.findIndex(j => j && j.Id === bid && String(j.companyId || '') === String(cid));
          if (idx >= 0) {
            _mergeFbIntoJob(jobStore[idx], rec);
            updated++;
          } else {
            const job = _fbRecToJob(bid, cid, rec, st);
            if (!job || _jobExistsInStore(bid, cid)) continue;
            jobStore.push(job);
            added++;
          }
        }
      } catch (e) {
        console.warn(`[hydrate] ${root} failed:`, e && e.message);
      }
    }
  }
  if (added || updated) saveJobStore();
  const purged = _purgeInvalidJobsFromStore('hydrate');
  console.log(`[hydrate] jobStore: +${added} updated=${updated} purged=${purged} total=${jobStore.length}`);
  return { ok: true, added, updated, purged };
}

// ─── Server-side auto-dispatch (runs without dispatcher console) ─────────────
function _parseLatLng(s) {
  const p = String(s || '').split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]), lng = parseFloat(p[1]);
  return (isNaN(lat) || isNaN(lng)) ? null : { lat, lng };
}

function _haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function _writeDriverOfferNotification(cid, driver, job) {
  if (!job || !job.Id || !cid || !driver) return;
  const inStore = jobStore.find(j => j && j.Id === job.Id && String(j.companyId || '') === String(cid));
  if (!inStore) return;
  const st = String(inStore.BookingStatus || '');
  if (!['Pending', 'Offered', 'No One'].includes(st)) return;
  if (!_isValidJobRecord(inStore, { requireSource: true, companyId: cid })) return;
  const did = String(driver.driverid || '').trim();
  if (!did) return;
  if (st === 'Offered' && String(inStore.DriverId || '') !== did) return;
  if (inStore._offerNotifiedAt && (Date.now() - inStore._offerNotifiedAt) < 15000 &&
      String(inStore.DriverId || '') === did) return;
  const tok = await getFirebaseServerToken();
  if (!tok) return;
  const bid = job.Id;
  const vid = String(driver.VehicleId || driver.vehiclenumber || '').trim();
  const payload = {
    type: 'job_offer',
    bookingid: `${bid},Offered,${did},Server,AutoDispatch`,
    content: 'You have offered new Job please view details',
    joboffer: String(bid),
    jobpickup: job.PickAddress || '',
    jobdropoff: job.DropAddress || '',
    JobphoneNo: job.PhoneNo || '',
    jobname: job.Name || job.UserFName || '',
    jobFare: String(job.EstimatedFare || job.TotalFare || ''),
    jobServiceType: job.serviceType || 'taxi',
    jobBookingSrc: job.BookingSource || 'Auto Dispatch',
    vehicleId: vid,
    companyId: String(cid),
    bookingId: bid,
    originalStatus: 'pending',
    expiresAt: Date.now() + 30000,
    updatedAt: _FB_SERVER_TIMESTAMP,
  };
  await firebaseDbSet(`notification/${did}`, payload, tok).catch(() => {});
  const _pjUrl = `${FB_DB_URL}/pendingjobs/${cid}/${bid}.json?auth=${encodeURIComponent(tok)}`;
  await fbRequest(_pjUrl, 'PATCH', {
    BookingId: String(bid), Status: 'Offered', BookingStatus: 'Offered',
    DriverId: did, offeredAt: Date.now(),
    PickAddress: job.PickAddress || '', DropAddress: job.DropAddress || '',
  }).catch(() => {});
  inStore._offerNotifiedAt = Date.now();
}

async function _serverAutoDispatchTick() {
  const now = Date.now();
  _purgeInvalidJobsFromStore('server-auto-dispatch');
  const cids = _fixsCollectCompanyIds();
  for (const cid of cids) {
    if (jobStore.some(j => String(j.companyId) === String(cid) && j.BookingStatus === 'Offered')) continue;
    const pending = jobStore.filter(j => {
      if (String(j.companyId) !== String(cid)) return false;
      if (j.BookingStatus !== 'Pending' && j.BookingStatus !== 'No One') return false;
      if (j.manualOffer === true) return false;
      if (j.releasedAt && (now - j.releasedAt) < 10000) return false;
      return _isDispatchableJob(j, cid);
    });
    if (!pending.length) continue;
    pending.sort((a, b) => (a.Pickingtime || a.BookingDateTime || '').localeCompare(b.Pickingtime || b.BookingDateTime || ''));
    const job = pending[0];
    if (!_isDispatchableJob(job, cid)) continue;
    const pick = _parseLatLng(job.PickLatLng);
    const drivers = ZONE_DRIVERS.filter(d =>
      String(d.companyId || '') === String(cid) &&
      String(d.vehiclestatus || '') === 'Available' &&
      !isAwayLocked(d.driverid) &&
      d.lat && d.lng
    );
    if (!drivers.length) continue;
    let best = drivers[0];
    if (pick) {
      let bestDist = Infinity;
      for (const d of drivers) {
        const dist = _haversineKm(pick, { lat: parseFloat(d.lat), lng: parseFloat(d.lng) });
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
    }
    const fresh = jobStore.find(j => j && j.Id === job.Id && String(j.companyId || '') === String(cid));
    if (!fresh || !_isDispatchableJob(fresh, cid)) continue;
    const _autoPrev = fresh.BookingStatus;
    _stampPreOfferPoolStatus(fresh, _autoPrev);
    fresh.BookingStatus = 'Offered';
    fresh.DriverId = best.driverid;
    fresh.VehicleId = best.VehicleId || best.vehiclenumber;
    fresh.VehicleNo = best.vehiclenumber || best.VehicleId;
    fresh.offeredAt = now;
    fresh.originalStatus = 'pending';
    saveJobStore();
    await _writeDriverOfferNotification(cid, best, fresh);
    await _dispatchRefreshForJob(fresh, {
      cid,
      previousStatus: _autoPrev,
      status: 'Offered',
      action: 'offer',
      driverId: best.driverid,
    });
    console.log(`[server-auto-dispatch] offered job #${fresh.Id} → driver ${best.driverid} (cid=${cid})`);
  }
}

async function _releaseScheduledJobs() {
  if (!process.env.BW_FIREBASE_SECRET) return;
  const now = Date.now();
  let tok;
  try { tok = await getFirebaseServerToken(); } catch (e) { return; }
  if (!tok) return;

  const promoted = [];
  for (const j of jobStore) {
    if (j.BookingStatus !== 'Scheduled') continue;
    let shouldRelease = false;
    const notifyAt = j.NotifyDispatchAt || j.notifyDispatchAt;
    if (notifyAt) {
      const ms = Date.parse(String(notifyAt));
      if (!Number.isNaN(ms) && now >= ms) shouldRelease = true;
    }
    if (!shouldRelease) {
      const db = parseInt(j.DispatchTimebefore || '0', 10) || 0;
      const sched = j.ScheduledFor || 0;
      const pickRef = j.Pickingtime || j.BookingDateTime;
      let pickupMs = sched || (pickRef ? _parseLocalDT(pickRef, j.companyId) : NaN);
      if (db > 0 && !isNaN(pickupMs) && now >= pickupMs - db * 60000) {
        shouldRelease = true;
      }
    }
    if (!shouldRelease) continue;
    if (!_isValidJobRecord(j, { requireSource: true, companyId: j.companyId })) continue;

    const prev = j.BookingStatus;
    j.BookingStatus = 'Pending';
    if (typeof _bumpSeqAndEmitStatus === 'function') {
      _bumpSeqAndEmitStatus(j, prev, 'system', 'scheduledRelease', { action: 'promote' });
    }
    promoted.push(j);

    if (j._fbKey && j.companyId) {
      const fbKeyPart = String(j._fbKey).includes(':') ? String(j._fbKey).split(':').pop() : String(j._fbKey);
      try {
        await firebaseDbPatch(`pendingjobs/${j.companyId}/${fbKeyPart}`, { Status: 'Pending', status: 'Pending' }, tok);
      } catch (e) {
        console.warn(`[sched-release] Firebase patch failed job#${j.Id}:`, e.message);
      }
    }
  }
  if (promoted.length) {
    saveJobStore();
    console.log(`[sched-release] promoted ${promoted.length} scheduled job(s) → Pending`);
    for (const j of promoted) {
      await _dispatchRefreshForJob(j, {
        cid: j.companyId,
        previousStatus: 'Scheduled',
        status: 'Pending',
        action: 'scheduled_release',
      });
    }
  }
}
