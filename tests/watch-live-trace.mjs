#!/usr/bin/env node
/**
 * Live capture for synchronized mid-offer reproduction.
 *
 * Polls Firebase ops/liveTrace (written by production server on bounce/heal)
 * and optionally GET /admin/liveLogs when BW_ADMIN_KEY matches production.
 *
 * Usage (from INVT):
 *   node tests/watch-live-trace.mjs
 *   node tests/watch-live-trace.mjs --out tmp/captures/prod-live-mid-offer.txt
 *   node tests/watch-live-trace.mjs --out … --max-mb 32
 *
 * Safeguards (prevents unbounded disk growth):
 *   - Default max capture size 32 MiB (override with --max-mb or BW_CAPTURE_MAX_MB)
 *   - Rotates to `<out>.1` when the cap is reached, then continues on a fresh file
 *   - Hard-stops if size still exceeds 2× max after rotation (corrupt / race)
 *   - Caps in-memory dedupe set growth
 */
import './lib/loadEnv.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const OUT = argValue('--out')
  ? path.resolve(process.cwd(), argValue('--out'))
  : path.resolve(REPO, 'tmp/captures/prod-live-mid-offer-capture.txt');

const MAX_MB = Math.max(
  1,
  Number(argValue('--max-mb') || process.env.BW_CAPTURE_MAX_MB || 32) || 32,
);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const HARD_MAX_BYTES = MAX_BYTES * 2;
const SEEN_CAP = 20_000;

const PROD = process.env.REGRESSION_BASE_URL || 'https://invt-production.up.railway.app';
const ADMIN_KEY = process.env.BW_ADMIN_KEY || '';
const FB_SECRET = process.env.BW_FIREBASE_SECRET || '';
const FB_DB = process.env.BW_FIREBASE_DB_URL
  || process.env.FIREBASE_DB_URL
  || 'https://bookawaka2026-564e1-default-rtdb.firebaseio.com';

const seen = new Set();
let sinceMs = Date.now() - 60_000;
const LIVE_CID = String(process.env.BW_LIVE_CID || '').trim();
const LIVE_VID = String(process.env.BW_LIVE_VID || '').trim();
const LIVE_JOB = String(process.env.BW_LIVE_JOB || '').trim();
let lastPresenceSig = '';
let lastJobSig = '';
let stopped = false;

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function remember(key) {
  if (seen.has(key)) return false;
  if (seen.size >= SEEN_CAP) {
    // Drop oldest half of insertion-order keys (Set iterates insertion order).
    const drop = Math.floor(SEEN_CAP / 2);
    let n = 0;
    for (const k of seen) {
      seen.delete(k);
      if (++n >= drop) break;
    }
  }
  seen.add(key);
  return true;
}

function rotateCapture(reason) {
  const size = fileSize(OUT);
  const bak = `${OUT}.1`;
  try {
    if (fs.existsSync(bak)) fs.unlinkSync(bak);
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(OUT)) fs.renameSync(OUT, bak);
  } catch {
    try {
      fs.writeFileSync(OUT, '', 'utf8');
    } catch {
      /* ignore */
    }
  }
  const note = `[${new Date().toISOString()}] === CAPTURE ROTATED sizeWas=${size} maxBytes=${MAX_BYTES} reason=${reason} prev=${bak} ===\n`;
  console.warn(note.trim());
  try {
    fs.appendFileSync(OUT, note, 'utf8');
  } catch (e) {
    console.error('[watch-live-trace] rotate write failed', e);
  }
}

function ensureWithinCap(nextBytes) {
  let size = fileSize(OUT);
  if (size + nextBytes >= MAX_BYTES) {
    rotateCapture('max-bytes');
    size = fileSize(OUT);
  }
  if (size + nextBytes >= HARD_MAX_BYTES) {
    const msg = `[watch-live-trace] HARD STOP: capture would exceed ${HARD_MAX_BYTES} bytes (2× max). Refusing to write.`;
    console.error(msg);
    stopped = true;
    throw new Error(msg);
  }
}

function append(line) {
  if (stopped) return;
  const row = `[${new Date().toISOString()}] ${line}`;
  console.log(row);
  const payload = `${row}\n`;
  ensureWithinCap(Buffer.byteLength(payload, 'utf8'));
  fs.appendFileSync(OUT, payload, 'utf8');
}

async function fetchJson(url, headers = {}) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, body };
}

async function pollAdmin() {
  if (!ADMIN_KEY) return;
  const url = `${PROD}/admin/liveLogs?sinceMs=${sinceMs}&limit=200`;
  const { status, body } = await fetchJson(url, { 'X-Admin-Key': ADMIN_KEY });
  if (status === 401 || status === 403) {
    append(`ADMIN liveLogs HTTP ${status} (key rejected — using Firebase path only)`);
    return 'auth-fail';
  }
  if (status !== 200 || !body?.ok) {
    append(`ADMIN liveLogs HTTP ${status} ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
    return;
  }
  append(`ADMIN version build=${body.serverBuildId} ring=${body.ringSize} returned=${body.count}`);
  for (const ev of body.events || []) {
    const key = `admin:${ev.at}:${ev.event}:${ev.jobId || ''}:${ev.sourceTag || ''}`;
    if (!remember(key)) continue;
    append(`ADMIN-EVENT ${JSON.stringify(ev)}`);
    if (ev.at > sinceMs) sinceMs = ev.at;
  }
}

async function pollFirebase() {
  if (!FB_SECRET) {
    append('BW_FIREBASE_SECRET missing — cannot poll ops/liveTrace');
    return 'no-secret';
  }
  // Prefer key-ordered recent tails (no custom index). Fall back to full node.
  const urls = [
    `${FB_DB}/ops/liveTrace.json?auth=${encodeURIComponent(FB_SECRET)}&orderBy=%22%24key%22&limitToLast=100`,
    `${FB_DB}/ops/liveTrace.json?auth=${encodeURIComponent(FB_SECRET)}`,
  ];
  let status = 0;
  let body = null;
  for (const url of urls) {
    ({ status, body } = await fetchJson(url));
    if (status === 200) break;
  }
  if (status !== 200) {
    append(`FIREBASE ops/liveTrace HTTP ${status} ${JSON.stringify(body).slice(0, 240)}`);
    return;
  }
  if (!body || typeof body !== 'object') {
    // Node absent until first production bounce/clear after deploy — not an error.
    return;
  }
  const rows = Object.entries(body).map(([id, v]) => ({ id, ...(v || {}) }));
  rows.sort((a, b) => (a.at || 0) - (b.at || 0));
  for (const ev of rows) {
    if ((ev.at || 0) && (ev.at || 0) < sinceMs - 5_000) continue;
    const key = `fb:${ev.id}`;
    if (!remember(key)) continue;
    append(`FB-EVENT ${JSON.stringify(ev)}`);
    if ((ev.at || 0) > sinceMs) sinceMs = ev.at;
  }
}

async function pollVersion() {
  if (!ADMIN_KEY) return;
  const { status, body } = await fetchJson(`${PROD}/admin/version`, { 'X-Admin-Key': ADMIN_KEY });
  append(`ADMIN /version HTTP ${status} ${JSON.stringify(body).slice(0, 300)}`);
  return status;
}

async function pollPresenceAndJob() {
  if (!FB_SECRET || !LIVE_CID) return;
  if (LIVE_VID) {
    const { status, body } = await fetchJson(
      `${FB_DB}/online/${encodeURIComponent(LIVE_CID)}/${encodeURIComponent(LIVE_VID)}.json?auth=${encodeURIComponent(FB_SECRET)}`,
    );
    if (status === 200 && body && typeof body === 'object') {
      const cur = body.current && typeof body.current === 'object' ? body.current : {};
      const lastSeen = Number(body.lastSeen || cur.lastSeen || 0) || 0;
      const lastSeenMs = lastSeen && lastSeen < 1e12 ? lastSeen * 1000 : lastSeen;
      const ageMs = lastSeenMs ? Date.now() - lastSeenMs : null;
      const sig = JSON.stringify({
        lastSeen: lastSeenMs,
        ageMs,
        status: body.vehiclestatus || cur.vehiclestatus || null,
        jobId: cur.jobId || cur.JobId || body.jobId || null,
        driverid: body.driverid || cur.driverid || null,
      });
      if (sig !== lastPresenceSig) {
        lastPresenceSig = sig;
        append(`PRESENCE online/${LIVE_CID}/${LIVE_VID} ${sig}`);
      }
    } else if (status !== 200) {
      append(`PRESENCE HTTP ${status}`);
    }
  }
  if (LIVE_JOB) {
    const { status, body } = await fetchJson(
      `${FB_DB}/allbookings/${encodeURIComponent(LIVE_CID)}/${encodeURIComponent(LIVE_JOB)}.json?auth=${encodeURIComponent(FB_SECRET)}`,
    );
    if (status === 200 && body && typeof body === 'object') {
      const sig = JSON.stringify({
        BookingStatus: body.BookingStatus || body.Status || null,
        DriverId: body.DriverId || body.driverId || null,
        returnReason: body.returnReason || body.ReturnReason || null,
        offeredAt: body.offeredAt || null,
      });
      if (sig !== lastJobSig) {
        lastJobSig = sig;
        append(`JOB allbookings/${LIVE_CID}/${LIVE_JOB} ${sig}`);
      }
    }
  }
}

function shutdown(signal) {
  if (stopped) return;
  try {
    append(`=== LIVE TRACE CAPTURE STOP (${signal}) ===`);
  } catch {
    /* ignore */
  }
  stopped = true;
  process.exit(0);
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Soft-rotate if a leftover capture already exceeds the cap (e.g. after a crash).
  if (fileSize(OUT) >= MAX_BYTES) {
    rotateCapture('startup-oversize');
  }
  append(`=== LIVE TRACE CAPTURE START prod=${PROD} maxMb=${MAX_MB} ===`);
  append(`out=${OUT}`);
  append(`firebaseDb=${FB_DB}`);
  append(`adminKeyLen=${ADMIN_KEY.length} firebaseSecretLen=${FB_SECRET.length}`);
  await pollVersion().catch((e) => append(`version probe error ${(e && e.message) || e}`));
  let adminAuthFail = false;
  let ticks = 0;
  append(`presenceWatch cid=${LIVE_CID || '(set BW_LIVE_CID)'} vid=${LIVE_VID || '(set BW_LIVE_VID)'} job=${LIVE_JOB || '(optional BW_LIVE_JOB)'}`);
  append('Ready — create the job and trigger the bounce on device now.');
  append('Waiting for ops/liveTrace events (needs production deploy of LIVE-TRACE build 37bd216+).');
  for (;;) {
    if (stopped) break;
    try {
      if (!adminAuthFail) {
        const r = await pollAdmin();
        if (r === 'auth-fail') adminAuthFail = true;
      }
      await pollFirebase();
      await pollPresenceAndJob();
      ticks += 1;
      if (ticks % 15 === 0) append(`heartbeat still watching (ticks=${ticks} sinceMs=${sinceMs})`);
    } catch (e) {
      if (stopped) break;
      append(`POLL ERROR ${(e && e.message) || e}`);
      if (String((e && e.message) || e).includes('HARD STOP')) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (e) => {
  try { append(`uncaughtException ${(e && e.stack) || e}`); } catch { /* ignore */ }
});
process.on('unhandledRejection', (e) => {
  try { append(`unhandledRejection ${(e && e.stack) || e}`); } catch { /* ignore */ }
});

main().catch((e) => {
  console.error(e);
  try { append(`fatal ${(e && e.stack) || e}`); } catch { /* ignore */ }
  process.exit(1);
});
