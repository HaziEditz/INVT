/**
 * Mirrors server.js _normalizePassengerEditChanges + online trip clear extras.
 * Keep in sync when passenger-edit / JOBS-badge cancel restore fields change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function normalizePassengerEditChanges(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const c = Object.assign({}, src);

  const dropAddr =
    c.DropAddress || c.dropoff || c.DropoffAddress || c.dropoffAddress || c.destination || '';
  if (dropAddr && !c.DropAddress) c.DropAddress = String(dropAddr);
  if (c.DropAddress && !c.dropoff) c.dropoff = c.DropAddress;

  const dropLat = c.DropoffLat ?? c.dropoffLat ?? c.DropLat ?? c.dropLat;
  const dropLng = c.DropoffLng ?? c.dropoffLng ?? c.DropLng ?? c.dropLng;
  if ((c.DropLatLng == null || String(c.DropLatLng).trim() === '') &&
      dropLat != null && dropLng != null &&
      String(dropLat) !== '' && String(dropLng) !== '') {
    c.DropLatLng = `${dropLat},${dropLng}`;
  }
  if (c.DropLatLng && !c.dropLatLng) c.dropLatLng = c.DropLatLng;

  if (c.EstimatedFare == null && c.estimatedFare != null) c.EstimatedFare = c.estimatedFare;
  if (c.EstimatedFare == null && c.fare != null) c.EstimatedFare = c.fare;
  if (c.EstimatedFare != null) {
    if (c.CustomeRate == null) c.CustomeRate = c.EstimatedFare;
    if (c.RideCost == null) c.RideCost = c.EstimatedFare;
  }

  if (Array.isArray(c.stops) && c.Nextstop == null) {
    c.Nextstop = String(c.stops.length);
  }
  if (Array.isArray(c.stops) && c.nextstopdata == null) {
    c.nextstopdata = JSON.stringify(c.stops.map((s) => {
      if (!s || typeof s !== 'object') return { address: String(s || '') };
      return {
        address: s.address || s.Address || '',
        lat: s.lat ?? s.Lat ?? null,
        lng: s.lng ?? s.Lng ?? null,
      };
    }));
  }
  if (Array.isArray(c.stops) && c.Stops == null) {
    c.Stops = c.stops.map((s) =>
      (s && typeof s === 'object') ? (s.address || s.Address || '') : String(s || '')
    );
  }
  if (Array.isArray(c.stops)) delete c.stops;

  for (const k of [
    'DropoffAddress', 'dropoffAddress', 'destination',
    'DropoffLat', 'DropoffLng', 'dropoffLat', 'dropoffLng', 'DropLat', 'DropLng', 'dropLat', 'dropLng',
    'estimatedFare', 'fare',
  ]) {
    delete c[k];
  }
  return c;
}

const JOB_EDIT_STOP_KEYS = ['stops', 'Stops', 'Nextstop', 'nextstopdata', 'extraStops'];

function stopAddressesFromEditValue(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw
      .map((s) => {
        if (s == null) return '';
        if (typeof s === 'string') return s.trim();
        if (typeof s === 'object') return String(s.address || s.Address || '').trim();
        return String(s).trim();
      })
      .filter(Boolean);
  }
  if (typeof raw === 'object') {
    const addr = String(raw.address || raw.Address || '').trim();
    return addr ? [addr] : [];
  }
  const s = String(raw).trim();
  if (!s || s === '[object Object]') return [];
  if (s.startsWith('[') || s.startsWith('{')) {
    try { return stopAddressesFromEditValue(JSON.parse(s)); } catch (_) { /* */ }
  }
  if (s.includes('@') && /address=/i.test(s)) {
    return s.split('|').map((part) => {
      const m = String(part).match(/address=([^|]*)/i);
      return m ? String(m[1] || '').trim() : '';
    }).filter(Boolean);
  }
  return [s];
}

function summarizeStopEditDiff(diff) {
  if (!diff || typeof diff !== 'object') return null;
  if (!JOB_EDIT_STOP_KEYS.some((k) => Object.prototype.hasOwnProperty.call(diff, k))) return null;
  const fromAddrs = [];
  const toAddrs = [];
  const seenFrom = new Set();
  const seenTo = new Set();
  for (const key of ['Stops', 'nextstopdata', 'stops', 'extraStops']) {
    const row = diff[key];
    if (!row) continue;
    for (const a of stopAddressesFromEditValue(row.from)) {
      if (!seenFrom.has(a)) { seenFrom.add(a); fromAddrs.push(a); }
    }
    for (const a of stopAddressesFromEditValue(row.to)) {
      if (!seenTo.has(a)) { seenTo.add(a); toAddrs.push(a); }
    }
  }
  if (!toAddrs.length && !fromAddrs.length) {
    const nTo = diff.Nextstop && diff.Nextstop.to != null ? String(diff.Nextstop.to) : '';
    const nFrom = diff.Nextstop && diff.Nextstop.from != null ? String(diff.Nextstop.from) : '';
    if (nTo && nTo !== nFrom) return `Stop count → ${nTo}`;
    return null;
  }
  const added = toAddrs.filter((a) => !seenFrom.has(a));
  const removed = fromAddrs.filter((a) => !seenTo.has(a));
  if (added.length && !removed.length && toAddrs.length >= fromAddrs.length) {
    return `Stop added → ${added.join('; ')}`;
  }
  if (removed.length && !added.length) {
    return `Stop removed → ${removed.join('; ')}`;
  }
  if (!toAddrs.length) return 'Stops → (cleared)';
  return `Stops → ${toAddrs.join('; ')}`;
}

function onlineTripClearPatch(vehiclestatus, extras) {
  const vs = vehiclestatus || 'Available';
  return Object.assign({
    currentJobId: null,
    jobId: null,
    BookingId: null,
    bookingId: null,
    joboffer: 0,
    jobpickup: '',
    jobdropoff: '',
    JobphoneNo: '',
    jobname: '',
    vehiclestatus: vs,
    VehicleStatus: vs,
  }, extras && typeof extras === 'object' ? extras : {});
}

function onlineBookingPointer(node) {
  if (!node || typeof node !== 'object') return '';
  const cur = String(node.currentJobId || node.jobId || node.BookingId || node.bookingId || '').trim();
  if (cur && cur !== '0' && cur !== '-1') return cur;
  const jo = String(node.joboffer || '').trim();
  if (!jo || jo === '0' || jo === '1') return '';
  if (/^\d{4,}$/.test(jo)) return jo;
  return '';
}

function onlineJobCountZeroStickyPatch() {
  return {
    jobCount: 0,
    currentJobId: null,
    jobId: null,
    BookingId: null,
    bookingId: null,
  };
}

function shouldClearOnlineForBooking(node, bookingId) {
  const cur = onlineBookingPointer(node);
  const bId = String(bookingId);
  if (cur && cur !== bId) return false;
  return true;
}

test('passenger aliases map to DropAddress + DropLatLng + fare', () => {
  const out = normalizePassengerEditChanges({
    DropoffAddress: '45 Dee Street, Invercargill',
    dropoffLat: -46.41,
    dropoffLng: 168.35,
    estimatedFare: 18.5,
  });
  assert.equal(out.DropAddress, '45 Dee Street, Invercargill');
  assert.equal(out.dropoff, '45 Dee Street, Invercargill');
  assert.equal(out.DropLatLng, '-46.41,168.35');
  assert.equal(out.EstimatedFare, 18.5);
  assert.equal(out.CustomeRate, 18.5);
  assert.equal(out.DropoffAddress, undefined);
  assert.equal(out.dropoffLat, undefined);
});

test('stops array fills Nextstop / nextstopdata / Stops and drops object stops', () => {
  const out = normalizePassengerEditChanges({
    DropAddress: 'Kew Road',
    stops: [{ address: 'Stop A', lat: 1, lng: 2 }],
    EstimatedFare: 22,
  });
  assert.equal(out.Nextstop, '1');
  assert.deepEqual(out.Stops, ['Stop A']);
  assert.match(out.nextstopdata, /Stop A/);
  assert.equal(out.stops, undefined);
});

test('stop edit summary uses address not raw Nextstop / [object Object]', () => {
  const line = summarizeStopEditDiff({
    Nextstop: { from: '0', to: '1' },
    nextstopdata: { from: '', to: JSON.stringify([{ address: '12 King St', lat: 1, lng: 2 }]) },
    Stops: { from: [], to: ['12 King St'] },
    EstimatedFare: { from: 18, to: 24 },
  });
  assert.equal(line, 'Stop added → 12 King St');
});

test('online clear patch zeros jobCount and booking pointers', () => {
  const p = onlineTripClearPatch('Available', { jobCount: 0 });
  assert.equal(p.jobCount, 0);
  assert.equal(p.currentJobId, null);
  assert.equal(p.BookingId, null);
  assert.equal(p.vehiclestatus, 'Available');
});

test('onlineBookingPointer ignores joboffer:1 flag but keeps real offer ids', () => {
  assert.equal(onlineBookingPointer({ joboffer: 1, currentJobId: null }), '');
  assert.equal(onlineBookingPointer({ joboffer: '1' }), '');
  assert.equal(onlineBookingPointer({ joboffer: '86926082811' }), '86926082811');
  assert.equal(onlineBookingPointer({ currentJobId: '86926082811', joboffer: 1 }), '86926082811');
  assert.equal(onlineBookingPointer({ BookingId: '99' }), '99');
});

test('cancel clear must not wipe a different live offer on the same vehicle', () => {
  // Regression: treating only currentJobId (ignoring joboffer=<bookingId>) let cancel A
  // wipe offer B and broke assignAccept Offered polls.
  assert.equal(
    shouldClearOnlineForBooking({ joboffer: '86926089999', currentJobId: null }, '86926082811'),
    false,
  );
  assert.equal(
    shouldClearOnlineForBooking({ currentJobId: '86926082811', joboffer: 1 }, '86926082811'),
    true,
  );
  assert.equal(
    shouldClearOnlineForBooking({ joboffer: 1, currentJobId: null }, '86926082811'),
    true,
  );
});

test('jobCount sync at 0 must not include joboffer:0 (Offered jobs have count 0)', () => {
  const p = onlineJobCountZeroStickyPatch();
  assert.equal(p.jobCount, 0);
  assert.equal(p.currentJobId, null);
  assert.equal(p.BookingId, null);
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'joboffer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(p, 'vehiclestatus'), false);
});
