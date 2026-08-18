/**
 * active-bookings auth — Firebase Bearer + ?driverId= fallback (same as /api/cancel).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('active-bookings source includes Firebase Bearer fallback', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  const start = src.indexOf("urlPath === '/api/driver/active-bookings'");
  assert.ok(start >= 0, 'active-bookings route present');
  const block = src.slice(start, start + 4500);
  assert.match(block, /_extractBearerToken/);
  assert.match(block, /_verifyFirebaseIdToken/);
  assert.match(block, /_resolveZoneDriverForFirebaseBearer/);
  assert.match(block, /\[active-bookings\/bearer\]/);
  assert.match(block, /Firebase Bearer \+ \?driverId=/);
  assert.match(
    block,
    /provide X-User-Key, Firebase Bearer \+ \?driverId=, or X-Admin-Key \+ \?driverId=/,
  );
});

test('active-bookings still prefers X-User-Key and admin paths before Bearer', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  const start = src.indexOf("urlPath === '/api/driver/active-bookings'");
  const block = src.slice(start, start + 4500);
  const userKeyIdx = block.indexOf("if (_g6UserKey)");
  const adminIdx = block.indexOf('_g6AdminKey && process.env.BW_ADMIN_KEY');
  const bearerIdx = block.indexOf('_g6BearerTok && _g6DriverIdQ');
  assert.ok(userKeyIdx >= 0 && adminIdx > userKeyIdx && bearerIdx > adminIdx);
});
