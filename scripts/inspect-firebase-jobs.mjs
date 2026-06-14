/**
 * Inspect pendingjobs vs allbookings for a company. Uses service-account JWT.
 * Usage: node scripts/inspect-firebase-jobs.mjs [companyId] [bookingId]
 */
import crypto from 'crypto';
import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const companyId = process.argv[2] || '860869';
const filterId = process.argv[3] ? String(process.argv[3]) : null;
const dbUrl = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    }),
  );
  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const sig = b64url(sign.sign(privateKey));
  const jwt = `${signInput}.${sig}`;

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await httpRequest('https://oauth2.googleapis.com/token', 'POST', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  });
  if (res.status !== 200 || !res.body?.access_token) {
    throw new Error(`OAuth failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.access_token;
}

function httpRequest(url, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fbGet(path, token) {
  const url = `${dbUrl}/${path}.json?access_token=${encodeURIComponent(token)}`;
  const res = await httpRequest(url, 'GET');
  if (res.status !== 200) throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

async function fbPatch(path, patch, token) {
  const url = `${dbUrl}/${path}.json?access_token=${encodeURIComponent(token)}`;
  const body = JSON.stringify(patch);
  const res = await httpRequest(url, 'PATCH', body, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  return res;
}

function pickFields(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const keys = [
    'BookingId', 'BookingStatus', 'Status', 'status', 'DriverId', 'driverId',
    'VehicleId', 'DriverAcceptedAt', 'updateSeq', '_seq', 'version', 'eventType',
  ];
  const out = {};
  for (const k of keys) if (rec[k] !== undefined) out[k] = rec[k];
  return out;
}

async function repairJob(token, bookingId, pending, all) {
  const patch = {
    BookingStatus: 'No One',
    Status: 'No One',
    DriverId: -1,
    VehicleId: 0,
    eventType: 'updated',
    updateSeq: Math.max(
      parseInt(pending?.updateSeq || pending?._seq || 0, 10) || 0,
      parseInt(all?.updateSeq || all?._seq || 0, 10) || 0,
    ) + 1,
  };
  patch._seq = patch.updateSeq;
  patch.version = patch.updateSeq;
  console.log(`\nRepairing #${bookingId} →`, patch);
  await fbPatch(`pendingjobs/${companyId}/${bookingId}`, patch, token);
  await fbPatch(`allbookings/${companyId}/${bookingId}`, patch, token);
  console.log('Repair complete.');
}

async function main() {
  if (!dbUrl || !clientEmail || !privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('Missing FIREBASE_DATABASE_URL, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const token = await getAccessToken();
  const [pendingAll, bookingsAll] = await Promise.all([
    fbGet(`pendingjobs/${companyId}`, token),
    fbGet(`allbookings/${companyId}`, token),
  ]);

  const pending = pendingAll && typeof pendingAll === 'object' ? pendingAll : {};
  const bookings = bookingsAll && typeof bookingsAll === 'object' ? bookingsAll : {};

  console.log(`Company ${companyId}: pendingjobs=${Object.keys(pending).length} allbookings=${Object.keys(bookings).length}`);

  const ids = new Set([...Object.keys(pending), ...Object.keys(bookings)]);
  const mismatches = [];

  for (const id of [...ids].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
    if (filterId && id !== filterId) continue;
    const p = pending[id];
    const b = bookings[id];
    const pStatus = String(p?.BookingStatus ?? p?.Status ?? p?.status ?? '—');
    const bStatus = String(b?.BookingStatus ?? b?.Status ?? b?.status ?? '—');
    const pDrv = p?.DriverId ?? p?.driverId ?? '—';
    const bDrv = b?.DriverId ?? b?.driverId ?? '—';
    const mismatch =
      pStatus !== bStatus ||
      String(pDrv) !== String(bDrv) ||
      (pStatus === 'Offered' && (bStatus === 'Assigned' || b?.DriverAcceptedAt));
    if (!p && !b) continue;
    console.log(`\n#${id}`);
    console.log('  pendingjobs:', pickFields(p));
    console.log('  allbookings:', pickFields(b));
    if (mismatch) mismatches.push({ id, p, b, pStatus, bStatus });
  }

  console.log(`\n--- Summary: ${mismatches.length} mismatched/stuck job(s) ---`);
  for (const m of mismatches) {
    console.log(`  #${m.id}: pending=${m.pStatus} allbookings=${m.bStatus}`);
  }

  if (process.argv.includes('--repair') && mismatches.length > 0) {
    for (const m of mismatches) {
      await repairJob(token, m.id, m.p, m.b);
    }
  } else if (mismatches.length > 0) {
    console.log('\nRun with --repair to set mismatched jobs to No One.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
