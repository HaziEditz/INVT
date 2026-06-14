/**
 * Deep Firebase inspection for a company + driver nodes.
 * Usage: node scripts/inspect-company-firebase.mjs <companyId> [vehicleId] [driverId]
 */
import crypto from 'crypto';
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const companyId = process.argv[2] || '860869';
const vehicleId = process.argv[3] || '201';
const driverId = process.argv[4] || 'D001';
const dbUrl = (process.env.FIREBASE_DATABASE_URL || 'https://bookawaka2026-564e1-default-rtdb.firebaseio.com').replace(/\/$/, '');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function httpRequest(url, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method, headers };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: clientEmail, sub: clientEmail, aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
  }));
  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const jwt = `${signInput}.${b64url(sign.sign(privateKey))}`;
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await httpRequest('https://oauth2.googleapis.com/token', 'POST', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  });
  if (res.status !== 200 || !res.body?.access_token) throw new Error(`OAuth failed: ${res.status}`);
  return res.body.access_token;
}

async function fbGet(path, token) {
  const url = `${dbUrl}/${path}.json?access_token=${encodeURIComponent(token)}`;
  const res = await httpRequest(url, 'GET');
  if (res.status !== 200) return { error: res.body, status: res.status };
  return res.body;
}

function pick(rec, keys) {
  if (!rec || typeof rec !== 'object') return rec;
  const out = {};
  for (const k of keys) if (rec[k] !== undefined) out[k] = rec[k];
  return out;
}

function summarizeJob(id, p, b) {
  const pStatus = String(p?.BookingStatus ?? p?.Status ?? p?.status ?? '—');
  const bStatus = String(b?.BookingStatus ?? b?.Status ?? b?.status ?? '—');
  return {
    id,
    pending: pick(p, ['BookingStatus', 'Status', 'DriverId', 'DriverAcceptedAt', 'updateSeq', 'eventType']),
    allbookings: pick(b, ['BookingStatus', 'Status', 'DriverId', 'DriverAcceptedAt', 'updateSeq', 'eventType']),
    mismatch: pStatus !== bStatus || String(p?.DriverId ?? '') !== String(b?.DriverId ?? ''),
    stuckOffer: pStatus === 'Offered' && (bStatus === 'Assigned' || !!b?.DriverAcceptedAt),
  };
}

async function main() {
  const token = await getAccessToken();
  console.log(`Firebase project: ${dbUrl}`);
  console.log(`Company: ${companyId}  Vehicle: ${vehicleId}  Driver: ${driverId}\n`);

  const [pendingAll, bookingsAll, onlineVeh, onlineCurrent, notify, jobsTree] = await Promise.all([
    fbGet(`pendingjobs/${companyId}`, token),
    fbGet(`allbookings/${companyId}`, token),
    fbGet(`online/${companyId}/${vehicleId}`, token),
    fbGet(`online/${companyId}/${vehicleId}/current`, token),
    fbGet(`notification/${driverId}`, token),
    fbGet(`jobs/${companyId}/${vehicleId}/${driverId}`, token),
  ]);

  const pending = pendingAll && typeof pendingAll === 'object' && !pendingAll.error ? pendingAll : {};
  const bookings = bookingsAll && typeof bookingsAll === 'object' && !bookingsAll.error ? bookingsAll : {};
  const pendingKeys = Object.keys(pending);
  const bookingKeys = Object.keys(bookings);
  const ids = [...new Set([...pendingKeys, ...bookingKeys])].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  console.log(`pendingjobs/${companyId}: ${pendingKeys.length} record(s)`);
  console.log(`allbookings/${companyId}: ${bookingKeys.length} record(s)`);

  const activeStatuses = new Set(['Offered', 'Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip', 'Pending', 'No One', 'Queued']);
  const activePending = pendingKeys.filter((id) => {
    const r = pending[id];
    const st = String(r?.BookingStatus ?? r?.Status ?? '');
    return activeStatuses.has(st);
  });
  const activeBookings = bookingKeys.filter((id) => {
    const r = bookings[id];
    const st = String(r?.BookingStatus ?? r?.Status ?? '');
    return activeStatuses.has(st);
  });
  if (activePending.length) {
    console.log('\nActive in pendingjobs:', activePending.join(', '));
    for (const id of activePending) {
      console.log(' ', id, JSON.stringify(pick(pending[id], ['BookingStatus', 'Status', 'DriverId', 'DriverAcceptedAt', 'updateSeq'])));
    }
  }
  if (activeBookings.length) {
    console.log('\nActive in allbookings:', activeBookings.join(', '));
    for (const id of activeBookings) {
      console.log(' ', id, JSON.stringify(pick(bookings[id], ['BookingStatus', 'Status', 'DriverId', 'DriverAcceptedAt', 'updateSeq'])));
    }
  }

  const summaries = ids.map((id) => summarizeJob(id, pending[id], bookings[id]));
  const interesting = summaries.filter((s) => s.stuckOffer || s.mismatch || s.pending?.BookingStatus || s.pending?.Status);
  for (const s of interesting) {
    console.log('\n--- Job #' + s.id + (s.mismatch || s.stuckOffer ? ' ⚠' : '') + ' ---');
    console.log('  pendingjobs:  ', JSON.stringify(s.pending));
    console.log('  allbookings:  ', JSON.stringify(s.allbookings));
    if (s.stuckOffer) console.log('  >> STUCK: pending Offered but allbookings Assigned/accepted');
    if (s.mismatch && !s.stuckOffer) console.log('  >> MISMATCH between paths');
  }

  console.log('\n--- online/' + companyId + '/' + vehicleId + ' ---');
  console.log(JSON.stringify(onlineVeh, null, 2));

  console.log('\n--- online/' + companyId + '/' + vehicleId + '/current ---');
  console.log(JSON.stringify(onlineCurrent, null, 2));

  console.log('\n--- notification/' + driverId + ' ---');
  console.log(JSON.stringify(notify, null, 2));

  console.log('\n--- jobs/' + companyId + '/' + vehicleId + '/' + driverId + ' ---');
  if (jobsTree && typeof jobsTree === 'object') {
    for (const [bid, rec] of Object.entries(jobsTree)) {
      console.log(`  [${bid}]`, JSON.stringify(pick(rec, ['BookingId', 'Status', 'BookingStatus', 'eventType', 'DriverId', 'offeredAt'])));
    }
    if (!Object.keys(jobsTree).length) console.log('  (empty)');
  } else {
    console.log(JSON.stringify(jobsTree, null, 2));
  }

  const stuck = summaries.filter((s) => s.stuckOffer || (s.mismatch && (s.pending?.BookingStatus === 'Offered' || s.allbookings?.BookingStatus === 'Assigned')));
  console.log(`\nSummary: ${pendingKeys.length} pending, ${bookingKeys.length} allbookings, ${activePending.length} active pending, ${activeBookings.length} active allbookings, ${stuck.length} stuck Offer/Assign`);
}

main().catch((e) => { console.error(e); process.exit(1); });
