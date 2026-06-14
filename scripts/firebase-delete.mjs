/**
 * Delete a Firebase RTDB path using service-account auth.
 * Usage: node scripts/firebase-delete.mjs <path>
 * Example: node scripts/firebase-delete.mjs jobs/860869/201/D001/8692606103
 */
import crypto from 'crypto';
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const targetPath = process.argv[2];
const dbUrl = (process.env.FIREBASE_DATABASE_URL || 'https://bookawaka2026-564e1-default-rtdb.firebaseio.com').replace(/\/$/, '');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!targetPath) {
  console.error('Usage: node scripts/firebase-delete.mjs <path>');
  process.exit(1);
}

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
        try { parsedBody = data ? JSON.parse(data) : null; } catch { parsedBody = data; }
        resolve({ status: res.statusCode, body: parsedBody });
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
  if (res.status !== 200 || !res.body?.access_token) {
    throw new Error(`OAuth failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.access_token;
}

async function main() {
  const token = await getAccessToken();
  const getUrl = `${dbUrl}/${targetPath}.json?access_token=${encodeURIComponent(token)}`;
  const before = await httpRequest(getUrl, 'GET');
  console.log(`Before DELETE ${targetPath}: status=${before.status}`, JSON.stringify(before.body));

  const delUrl = `${dbUrl}/${targetPath}.json?access_token=${encodeURIComponent(token)}`;
  const del = await httpRequest(delUrl, 'DELETE');
  console.log(`DELETE ${targetPath}: status=${del.status}`, del.body == null ? '(null — removed)' : JSON.stringify(del.body));

  const after = await httpRequest(getUrl, 'GET');
  console.log(`After DELETE ${targetPath}: status=${after.status}`, JSON.stringify(after.body));
}

main().catch((e) => { console.error(e); process.exit(1); });
