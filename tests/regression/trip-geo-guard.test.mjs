/**
 * Mirrors tripGeoGuard — keep in sync with passenger-app/lib/tripGeoGuard.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const MAX_PLACE_FROM_BIAS_KM = 80;
const MAX_TRIP_DISTANCE_KM = 150;
const MAX_TRIP_FARE = 500;

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function checkPlaceGeography(opts) {
  const bias = opts.bias;
  if (bias) {
    const dBias = haversineKm(opts.location, { latitude: bias.lat, longitude: bias.lng });
    if (dBias > MAX_PLACE_FROM_BIAS_KM) {
      return { ok: false, distanceKm: dBias };
    }
  }
  return { ok: true };
}

function checkTripSanity(opts) {
  const km = opts.distanceMeters / 1000;
  if (km > MAX_TRIP_DISTANCE_KM) return { ok: false };
  if (opts.fareTotal > MAX_TRIP_FARE) return { ok: false };
  return { ok: true };
}

test('rejects Auckland-named street when bias is Invercargill', () => {
  // Rough Auckland CBD vs Invercargill centre
  const r = checkPlaceGeography({
    location: { latitude: -36.8485, longitude: 174.7633 },
    bias: { lat: -46.4132, lng: 168.3538, country: 'nz', radius: 50000, city: 'Invercargill' },
  });
  assert.equal(r.ok, false);
  assert.ok(r.distanceKm > 1000);
});

test('accepts local Invercargill coordinate', () => {
  const r = checkPlaceGeography({
    location: { latitude: -46.41, longitude: 168.35 },
    bias: { lat: -46.4132, lng: 168.3538, country: 'nz', radius: 50000 },
  });
  assert.equal(r.ok, true);
});

test('blocks 2652 km / $7460 style trip', () => {
  const r = checkTripSanity({ distanceMeters: 2652.87 * 1000, fareTotal: 7460.29 });
  assert.equal(r.ok, false);
});

test('allows normal local trip', () => {
  const r = checkTripSanity({ distanceMeters: 8_000, fareTotal: 28.5 });
  assert.equal(r.ok, true);
});
