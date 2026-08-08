/**
 * parseLatLng must reject hail/unknown "0,0" sentinel (Null Island),
 * so Closed Job + DispatchMap never fitBounds across the world.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const jobSrc = readFileSync(join(root, 'src/types/job.ts'), 'utf8');
const autoSrc = readFileSync(join(root, 'src/lib/autoDispatch.ts'), 'utf8');
const closedSrc = readFileSync(join(root, 'src/lib/closedJobDetail.ts'), 'utf8');
const mapSrc = readFileSync(join(root, 'src/components/map/DispatchMap.tsx'), 'utf8');
const closedMapSrc = readFileSync(join(root, 'src/components/jobs/ClosedJobRouteMap.tsx'), 'utf8');

/** Mirror src/types/job.ts parseLatLng — keep in sync. */
function parseLatLng(raw) {
  if (!raw) return null;
  const p = String(raw).split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Mirror closedJobMapEndpoints coordinate selection. */
function closedJobMapEndpoints(job, raw, route) {
  const pick = parseLatLng(job.pickLatLng) ?? parseLatLng(String(raw.PickLatLng ?? ''));
  const drop = parseLatLng(job.dropLatLng) ?? parseLatLng(String(raw.DropLatLng ?? ''));
  const first = route[0];
  const last = route.length > 1 ? route[route.length - 1] : null;
  return {
    pick: pick ?? (first ? { lat: first.lat, lng: first.lng } : null),
    drop: drop ?? (last ? { lat: last.lat, lng: last.lng } : null),
  };
}

test('source: parseLatLng rejects 0,0 sentinel in job.ts + autoDispatch', () => {
  assert.match(jobSrc, /lat === 0 && lng === 0/);
  assert.match(autoSrc, /lat === 0 && lng === 0/);
  assert.match(mapSrc, /parseLatLng\(job\.pickLatLng\)/);
  assert.match(mapSrc, /parseLatLng\(job\.dropLatLng\)/);
  assert.match(closedSrc, /closedJobMapEndpoints/);
  assert.match(closedMapSrc, /fitBounds/);
});

test('parseLatLng rejects empty, NaN, and 0,0 sentinel', () => {
  assert.equal(parseLatLng(''), null);
  assert.equal(parseLatLng(undefined), null);
  assert.equal(parseLatLng('foo,bar'), null);
  assert.equal(parseLatLng('0,0'), null);
  assert.equal(parseLatLng('0, 0'), null);
  assert.equal(parseLatLng(' 0,0 '), null);
});

test('parseLatLng accepts real Invercargill coords', () => {
  const ll = parseLatLng('-46.3963046,168.3514419');
  assert.ok(ll);
  assert.equal(ll.lat, -46.3963046);
  assert.equal(ll.lng, 168.3514419);
});

test('closedJobMapEndpoints: live hail shape pick OK + drop 0,0 → pick only', () => {
  const endpoints = closedJobMapEndpoints(
    {
      pickLatLng: '-46.3963046,168.3514419',
      dropLatLng: '0,0',
    },
    { PickLatLng: '-46.3963046,168.3514419', DropLatLng: '0,0' },
    [],
  );
  assert.deepEqual(endpoints.pick, { lat: -46.3963046, lng: 168.3514419 });
  assert.equal(endpoints.drop, null);
});

test('closedJobMapEndpoints: drop 0,0 can fall back to GPS route last point', () => {
  const endpoints = closedJobMapEndpoints(
    { pickLatLng: '-46.3963046,168.3514419', dropLatLng: '0,0' },
    {},
    [
      { lat: -46.3963, lng: 168.3514 },
      { lat: -46.3961, lng: 168.3512 },
    ],
  );
  assert.deepEqual(endpoints.pick, { lat: -46.3963046, lng: 168.3514419 });
  assert.deepEqual(endpoints.drop, { lat: -46.3961, lng: 168.3512 });
});
