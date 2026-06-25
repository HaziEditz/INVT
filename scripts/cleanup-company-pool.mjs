#!/usr/bin/env node
/**
 * One-off / ops: cleanup stale pool rows in Firebase for a company.
 * Usage:
 *   node scripts/cleanup-company-pool.mjs --cid=860869 --max-age-ms=2592000000 [--dry-run]
 *   node scripts/cleanup-company-pool.mjs --cid=860869 --delete=8692606212,8692606224,8692606222 [--dry-run]
 */
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const dbUrl = (process.env.FIREBASE_DATABASE_URL || 'https://bookawaka2026-564e1-default-rtdb.firebaseio.com').replace(/\/$/, '');
const token = process.env.BW_FIREBASE_SECRET || '';
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const cid = args.cid || '860869';
const dryRun = args['dry-run'] === 'true' || args.dryRun === 'true';
const maxAgeMs = parseInt(args['max-age-ms'] || args.maxAgeMs || String(24 * 60 * 60 * 1000), 10);
const forceDeleteIds = (args.delete || '')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter(Boolean);

function httpRequest(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body != null ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            /* keep */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, raw });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function fbUrl(path) {
  return `${dbUrl}/${path}.json?auth=${encodeURIComponent(token)}`;
}

function normStatus(rec) {
  const st = String(rec.BookingStatus ?? rec.bookingStatus ?? rec.Status ?? rec.status ?? '').trim();
  return st === 'NoOne' ? 'No One' : st;
}

function isUnassignedDriverId(driverId) {
  const d = String(driverId ?? '').trim();
  return !d || d === '0' || d === '-1' || d === '-2';
}

function hasRealPassengerData(rec) {
  const name = String(rec.Name ?? rec.PassengerName ?? rec.passengerName ?? '').trim();
  const phone = String(rec.PhoneNo ?? rec.Phone ?? rec.passengerPhone ?? rec.phone ?? '').trim();
  const pick = String(rec.PickAddress ?? rec.PickupAddress ?? rec.pickAddress ?? '').trim();
  const drop = String(rec.DropAddress ?? rec.dropAddress ?? '').trim();
  return !!(name || phone || pick || drop);
}

function recordActivityMs(rec) {
  const fields = [
    rec.lastUpdatedAt, rec.LastUpdatedAt, rec.updatedAt, rec.UpdatedAt,
    rec.jobUpdatedAt, rec.JobUpdatedAt, rec.createdAt, rec.CreatedAt,
    rec.queuedAt, rec.QueuedAt, rec.assignedAt, rec.AssignedAt,
    rec.offeredAt, rec.OfferedAt, rec.BookingDateTime, rec.bookingDateTime,
  ];
  let best = 0;
  for (const raw of fields) {
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) {
      const ms = n < 1e12 ? n * 1000 : n;
      if (ms > best) best = ms;
      continue;
    }
    const p = Date.parse(String(raw));
    if (!Number.isNaN(p) && p > 0 && p > best) best = p;
  }
  return best;
}

function isOrphanEligiblePoolStatus(rec) {
  const st = normStatus(rec);
  if (st === 'Pending' || st === 'No One') return true;
  if (st === 'Queued') {
    const queuedAt = rec.queuedAt ?? rec.QueuedAt;
    return queuedAt == null || queuedAt === '';
  }
  return false;
}

function isStaleOrphan(rec, now) {
  const st = normStatus(rec);
  const live = new Set(['Active', 'Picking', 'Arrived', 'OnTrip', 'Assigned', 'Offered', 'Scheduled']);
  const terminal = new Set(['Completed', 'Cancelled', 'No Show']);
  if (live.has(st) || terminal.has(st)) return false;
  if (!isOrphanEligiblePoolStatus(rec)) return false;
  if (!isUnassignedDriverId(rec.DriverId ?? rec.driverId ?? rec.AssignedDriverId)) return false;
  if (hasRealPassengerData(rec)) return false;
  const activityMs = recordActivityMs(rec);
  if (activityMs === 0) return false;
  if (now - activityMs <= maxAgeMs) return false;
  return true;
}

async function fbGet(path) {
  return httpRequest(fbUrl(path), 'GET');
}

async function fbDelete(path) {
  return httpRequest(fbUrl(path), 'DELETE');
}

async function fbPatch(path, patch) {
  return httpRequest(fbUrl(path), 'PATCH', patch);
}

async function main() {
  if (!token) {
    console.error('BW_FIREBASE_SECRET required in .env');
    process.exit(1);
  }
  const now = Date.now();
  console.log({ cid, dryRun, maxAgeMs, forceDeleteIds });

  const ab = await fbGet(`allbookings/${cid}`);
  if (ab.status !== 200) {
    console.error('allbookings read failed', ab.status, ab.body);
    process.exit(1);
  }
  const data = ab.body && typeof ab.body === 'object' ? ab.body : {};
  const poolLeft = [];
  const cleaned = [];
  const deleted = [];

  for (const [key, rec] of Object.entries(data)) {
    if (!rec || typeof rec !== 'object') continue;
    const bookingId = parseInt(key, 10) || parseInt(rec.BookingId || rec.bookingId || '', 10) || 0;
    if (!bookingId) continue;
    const st = normStatus(rec);

    if (forceDeleteIds.includes(bookingId)) {
      if (!dryRun) {
        await fbDelete(`allbookings/${cid}/${bookingId}`);
        await fbDelete(`pendingjobs/${cid}/${bookingId}`);
      }
      deleted.push({ bookingId, st, reason: 'force_delete' });
      continue;
    }

    if (isStaleOrphan(rec, now)) {
      if (!dryRun) {
        const cancelledAt = new Date().toISOString();
        await fbPatch(`allbookings/${cid}/${bookingId}`, {
          BookingStatus: 'Cancelled',
          Status: 'Cancelled',
          cancelledAt,
          CancelledAt: cancelledAt,
          cancelledBy: 'System',
          CancelledBy: 'System',
          cancelReason: 'Stale orphan cleanup (ops script)',
          CancelReason: 'Stale orphan cleanup (ops script)',
        });
        await fbDelete(`pendingjobs/${cid}/${bookingId}`);
      }
      cleaned.push({ bookingId, st, activityMs: recordActivityMs(rec) });
      continue;
    }

    if (['Pending', 'No One', 'Queued', 'Scheduled'].includes(st)) {
      poolLeft.push({
        bookingId,
        st,
        driverId: rec.DriverId ?? rec.driverId ?? null,
        pick: rec.PickAddress ?? rec.PickupAddress ?? null,
        name: rec.Name ?? rec.PassengerName ?? null,
        queuedAt: rec.queuedAt ?? rec.QueuedAt ?? null,
        activityMs: recordActivityMs(rec) || null,
      });
    }
  }

  const pj = await fbGet(`pendingjobs/${cid}`);
  const pjData = pj.status === 200 && pj.body && typeof pj.body === 'object' ? pj.body : {};
  const pendingLeft = [];
  for (const [key, rec] of Object.entries(pjData)) {
    if (!rec || typeof rec !== 'object') continue;
    const bookingId = parseInt(key, 10) || 0;
    const st = normStatus(rec);
    if (['Pending', 'No One', 'Queued'].includes(st)) {
      pendingLeft.push({ bookingId, st, driverId: rec.DriverId ?? rec.driverId ?? null });
    }
  }

  console.log(JSON.stringify({ cleanedCount: cleaned.length, deletedCount: deleted.length, cleaned, deleted, poolLeft, pendingLeft }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
