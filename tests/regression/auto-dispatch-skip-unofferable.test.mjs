/**
 * Queue starvation: unofferable top Pending (VehicleType mismatch) must not
 * freeze the company — auto-dispatch should offer the next eligible Pending.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireFirebaseSecret } from '../lib/config.mjs';
import { getHarness, prepareCleanDispatch } from '../lib/harness.mjs';
import { get } from '../lib/http.mjs';

test.before(async () => {
  await getHarness({ fresh: true });
});

test.afterEach(async () => {
  const h = await getHarness();
  await prepareCleanDispatch(h);
});

async function onlySedanAvailable(h, sedanDriver) {
  for (const did of h.driverIds) {
    if (String(did) === String(sedanDriver)) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
  await h.ensureDriverReady(sedanDriver);
  await h.configureDriver(sedanDriver, {
    vehiclestatus: 'Available',
    vehicletype: 'Sedan',
    seatCapacity: 4,
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });
  await h.driverStatusChanged(sedanDriver, 'Available', {
    lat: -46.412,
    lng: 168.353,
  });
}

async function forceClearOffered(h) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const r = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(h.companyId)}&status=Offered`,
      h.adminHeaders,
    );
    const jobs = r.status === 200 && Array.isArray(r.body?.jobs) ? r.body.jobs : [];
    if (!jobs.length) return;
    for (const j of jobs) {
      await h.cancelAssigned(j.id).catch(() => undefined);
      await h.mutateJobStore(j.id, {
        BookingStatus: 'Cancelled',
        Status: 'Cancelled',
        DriverId: 0,
        VehicleId: 0,
        offeredAt: null,
        manualOffer: false,
      }).catch(() => undefined);
    }
    await new Promise((res) => setTimeout(res, 300));
  }
}

async function cancelForeignPending(h, keepIds) {
  const keep = new Set(keepIds.map(Number));
  for (const status of ['Pending', 'No One', 'Queued', 'Assigned', 'Active']) {
    const r = await get(
      `/admin/jobTrace?cid=${encodeURIComponent(h.companyId)}&status=${encodeURIComponent(status)}`,
      h.adminHeaders,
    );
    if (r.status !== 200 || !Array.isArray(r.body?.jobs)) continue;
    for (const j of r.body.jobs) {
      if (keep.has(Number(j.id))) continue;
      if (['Pending', 'No One'].includes(status)) {
        await h.cancelUnassigned(j.id).catch(() => undefined);
      } else {
        await h.cancelAssigned(j.id).catch(() => undefined);
      }
      await h.mutateJobStore(j.id, {
        BookingStatus: 'Cancelled',
        Status: 'Cancelled',
        DriverId: 0,
        VehicleId: 0,
        offeredAt: null,
        manualOffer: false,
      }).catch(() => undefined);
    }
  }
  await forceClearOffered(h);
}

test('auto-dispatch: Van-only top Pending does not starve Any job behind it', async () => {
  requireFirebaseSecret();
  const h = await getHarness();
  await prepareCleanDispatch(h);

  const sedanDriver = String(h.driverIds[0]);
  await onlySedanAvailable(h, sedanDriver);

  // Create both as Pending with manualOffer so the 6s auto-dispatch tick cannot
  // snatch the Any job before we pin VehicleType + sort order.
  const vanJobId = await h.createJobViaInsert({
    vehicleType: 'Van',
    passengers: 2,
    notesSuffix: 'starve-van-top',
    bookstatus: 'Pending',
  });
  const anyJobId = await h.createJobViaInsert({
    vehicleType: 'Any',
    passengers: 1,
    notesSuffix: 'starve-any-second',
    bookstatus: 'Pending',
  });

  await h.mutateJobStore(vanJobId, {
    BookingStatus: 'Pending',
    BookingSource: 'dispatch',
    VehicleType: 'Van',
    vehicleType: 'Van',
    Passengers: 2,
    PassengersNo: 2,
    Pickingtime: '2020-01-01 10:00:00',
    BookingDateTime: '2020-01-01 10:00:00',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: true,
    releasedAt: null,
  });
  await h.mutateJobStore(anyJobId, {
    BookingStatus: 'Pending',
    BookingSource: 'dispatch',
    VehicleType: 'Not Specified',
    vehicleType: 'Not Specified',
    Passengers: 1,
    PassengersNo: 1,
    Pickingtime: '2020-01-01 11:00:00',
    BookingDateTime: '2020-01-01 11:00:00',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: true,
    releasedAt: null,
  });

  for (const id of [vanJobId, anyJobId]) {
    const t = await h.poll(
      id,
      (tr) => String(tr.jobStore?.lifecycle?.BookingStatus || '') === 'Pending',
      { timeoutMs: 15000 },
    );
    assert.equal(String(t.jobStore.lifecycle.BookingStatus), 'Pending', `job #${id} not Pending`);
  }

  // Drop foreign Pending/Offered so this company has only our two jobs.
  await cancelForeignPending(h, [vanJobId, anyJobId]);
  await onlySedanAvailable(h, sedanDriver);

  // Unlock both for auto-dispatch (Van still first by Pickingtime).
  await h.mutateJobStore(vanJobId, {
    manualOffer: false,
    BookingStatus: 'Pending',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    VehicleType: 'Van',
    vehicleType: 'Van',
  });
  await h.mutateJobStore(anyJobId, {
    manualOffer: false,
    BookingStatus: 'Pending',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    VehicleType: 'Not Specified',
    vehicleType: 'Not Specified',
  });

  let offeredAny = false;
  let lastTick = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    await cancelForeignPending(h, [vanJobId, anyJobId]);
    await onlySedanAvailable(h, sedanDriver);
    await h.mutateJobStore(vanJobId, {
      manualOffer: false,
      BookingStatus: 'Pending',
      DriverId: 0,
      VehicleId: 0,
      offeredAt: null,
      VehicleType: 'Van',
      vehicleType: 'Van',
      Pickingtime: '2020-01-01 10:00:00',
    }).catch(() => undefined);
    await h.mutateJobStore(anyJobId, {
      manualOffer: false,
      BookingStatus: 'Pending',
      DriverId: 0,
      VehicleId: 0,
      offeredAt: null,
      VehicleType: 'Not Specified',
      vehicleType: 'Not Specified',
      Pickingtime: '2020-01-01 11:00:00',
    }).catch(() => undefined);

    lastTick = await h.triggerAutoDispatch();
    const companyTick =
      lastTick?.lastAutoDispatchTick?.perCompany?.[h.companyId] ||
      lastTick?.lastAutoDispatchTick?.perCompany?.bwtest ||
      null;

    if (
      companyTick?.action === 'offered' &&
      Number(companyTick.targetJobId) === Number(anyJobId)
    ) {
      offeredAny = true;
      break;
    }

    if (
      companyTick?.action === 'offered' &&
      Number(companyTick.targetJobId) === Number(vanJobId)
    ) {
      // Sedan must never be eligible for a Van job — hard fail.
      assert.notEqual(
        String(companyTick.targetDriverId),
        String(sedanDriver),
        `Sedan driver offered Van job (eligibility broken): ${JSON.stringify(companyTick)}`,
      );
      // Some other Available driver snuck in — scrub and retry.
      await forceClearOffered(h);
      await new Promise((r) => setTimeout(r, 350));
      continue;
    }

    if (
      companyTick?.blockingOfferCount > 0 ||
      String(companyTick?.skipReason || '').includes('in-flight Offered')
    ) {
      await forceClearOffered(h);
      await new Promise((r) => setTimeout(r, 350));
      continue;
    }

    // Prove skip path when tick reports it.
    const skipped = companyTick?.skippedUnofferable || [];
    const vanSkipped = skipped.some((s) => Number(s.id) === Number(vanJobId));
    if (vanSkipped && companyTick?.action === 'offered' && Number(companyTick.targetJobId) === Number(anyJobId)) {
      offeredAny = true;
      break;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  assert.ok(
    offeredAny,
    `expected Any job #${anyJobId} offered past Van #${vanJobId}; last=${JSON.stringify(lastTick?.lastAutoDispatchTick)}`,
  );

  await h.poll(
    anyJobId,
    (t) => ['Offered', 'Assigned'].includes(String(t.jobStore?.lifecycle?.BookingStatus || '')),
    { timeoutMs: 20000 },
  );

  await h.cancelAssigned(anyJobId).catch(() => undefined);
  await h.mutateJobStore(anyJobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
  await h.mutateJobStore(vanJobId, {
    BookingStatus: 'Cancelled',
    DriverId: 0,
    VehicleId: 0,
    offeredAt: null,
    manualOffer: false,
  }).catch(() => undefined);
});
