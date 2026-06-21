/**
 * Inspect driverQueue nodes for a company / vehicle / driver.
 * Usage: node scripts/inspect-driver-queue.mjs [companyId] [vehicleId] [driverId]
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
const driverIdArg = process.argv[4] || '';
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
        let parsedBody;
        try {
          parsedBody = JSON.parse(data);
        } catch {
          parsedBody = data;
        }
        resolve({ status: res.statusCode, body: parsedBody });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const legacy = process.env.BW_FIREBASE_SECRET || '';
  if (legacy) return legacy;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope:
        'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    }),
  );
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
  return res.body;
}

async function fbDelete(path, token) {
  const url = `${dbUrl}/${path}.json?access_token=${encodeURIComponent(token)}`;
  const res = await httpRequest(url, 'DELETE');
  return res;
}

async function main() {
  const token = await getAccessToken();
  console.log(`Firebase: ${dbUrl}`);
  console.log(`Company: ${companyId}  Vehicle: ${vehicleId}\n`);

  const online = await fbGet(`online/${companyId}/${vehicleId}`, token);
  console.log(`--- online/${companyId}/${vehicleId} ---`);
  console.log(JSON.stringify(online, null, 2));

  const driverId = driverIdArg || String(online?.driverid ?? online?.driverId ?? online?.DriverId ?? '').trim();
  console.log(`\nResolved driverId: ${driverId || '(none)'}`);

  const allDq = await fbGet(`driverQueue/${companyId}`, token);
  console.log(`\n--- driverQueue/${companyId} (all drivers with queued nodes) ---`);
  if (allDq && typeof allDq === 'object') {
    for (const [did, node] of Object.entries(allDq)) {
      const queued = node?.queued;
      if (!queued || typeof queued !== 'object') continue;
      const keys = Object.keys(queued);
      if (!keys.length) continue;
      console.log(`\nDriver ${did}: ${keys.length} queued job(s)`);
      for (const [bid, rec] of Object.entries(queued)) {
        const queuedAt = rec?.queuedAt ?? rec?.acceptedAt;
        const ageMin = queuedAt ? Math.round((Date.now() - Number(queuedAt)) / 60000) : null;
        console.log(`  #${bid}`, {
          jobId: rec?.jobId,
          BookingId: rec?.BookingId,
          queuedAt: queuedAt ? new Date(Number(queuedAt)).toISOString() : null,
          ageMin,
          PickAddress: rec?.PickAddress,
          BookingDateTime: rec?.BookingDateTime,
        });
        const ab = await fbGet(`allbookings/${companyId}/${bid}`, token);
        const pj = await fbGet(`pendingjobs/${companyId}/${bid}`, token);
        console.log('    allbookings:', ab ? JSON.stringify(ab) : '(missing)');
        console.log('    pendingjobs:', pj ? JSON.stringify(pj) : '(missing)');
      }
    }
  } else {
    console.log(allDq);
  }

  if (driverId) {
    const dq = await fbGet(`driverQueue/${companyId}/${driverId}/queued`, token);
    console.log(`\n--- driverQueue/${companyId}/${driverId}/queued ---`);
    console.log(JSON.stringify(dq, null, 2));
  }

  if (process.argv.includes('--delete-stale')) {
    const maxAgeMs = parseInt(process.env.DRIVER_QUEUE_MAX_AGE_MS || String(24 * 60 * 60 * 1000), 10);
    const now = Date.now();
    let deleted = 0;
    if (allDq && typeof allDq === 'object') {
      for (const [did, node] of Object.entries(allDq)) {
        const queued = node?.queued;
        if (!queued || typeof queued !== 'object') continue;
        for (const [bid, rec] of Object.entries(queued)) {
          const queuedAt = Number(rec?.queuedAt ?? rec?.acceptedAt ?? 0);
          const ab = await fbGet(`allbookings/${companyId}/${bid}`, token);
          const abSt = String(ab?.BookingStatus ?? ab?.Status ?? '');
          const stale =
            (queuedAt > 0 && now - queuedAt > maxAgeMs) ||
            !ab ||
            ['Completed', 'Cancelled', 'No Show', 'Pending', 'No One'].includes(abSt);
          if (stale) {
            const path = `driverQueue/${companyId}/${did}/queued/${bid}`;
            console.log(`DELETE ${path} (queuedAt age=${queuedAt ? Math.round((now - queuedAt) / 60000) : '?'} min, allbookings=${abSt || 'missing'})`);
            await fbDelete(path, token);
            deleted++;
          }
        }
      }
    }
    console.log(`\nDeleted ${deleted} stale driverQueue entr(y/ies).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
