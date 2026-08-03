/**
 * Live reproduction: mid-offer bounce while Firebase lastSeen is fresh.
 *
 * Models production race:
 * - Driver stamps Firebase every 5s (phone offer-pending heartbeat)
 * - ZONE_DRIVERS.lastSeen is NOT updated by those stamps until sync
 * - heal-no-sync mimics AutoDispatchVehiclesallride (heal WITHOUT Firebase sync)
 *
 * Expected: bounce when ZONE age > 10s even though fbAge stays ~0–5s.
 *
 * Run (from INVT, with regression server / env already used by prepush):
 *   node --test tests/reproduce-mid-offer-zone-stale.mjs
 */
import './lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_KEY, requireFirebaseSecret } from './lib/config.mjs';
import { post } from './lib/http.mjs';
import { getHarness, prepareCleanDispatch } from './lib/harness.mjs';

async function midOfferProbe(body) {
  const r = await post('/dev/loadtest/mid-offer-probe', body, { 'X-Admin-Key': ADMIN_KEY });
  if (r.status !== 200 || !r.body?.ok) {
    throw new Error(`mid-offer-probe failed: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return r.body;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

test('REPRO: heal-no-sync bounces while Firebase is stamped every 5s', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);

  const driverId = String(h.driverIds[0]);
  for (const did of h.driverIds) {
    if (did === driverId) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });

  const jobId = await h.createAsapJob('repro-mid-offer-zone-stale');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, `assign failed: ${JSON.stringify(assignRes.body)}`);

  await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === driverId,
    { timeoutMs: 30000 },
  );

  const t0 = Date.now();
  const log = (label, extra = {}) => {
    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log(`[REPRO t+${elapsed}s] ${label}`, JSON.stringify(extra));
  };

  log('offer live — starting 5s Firebase stamps; ZONE left frozen at offer stamp');

  // Immediate Firebase stamp (simulates setPresenceOfferPending ON).
  let stamp = await midOfferProbe({ action: 'stamp-firebase', driverId });
  log('firebase stamp', {
    fbLastSeen: stamp.firebaseLastSeen,
    zoneAgeMs: stamp.zoneAgeMs,
  });

  const timeline = [];
  let bounced = false;
  let bounceProbe = null;

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const elapsed = Date.now() - t0;

    // Every 5s wall clock: stamp Firebase only (do NOT configureDriver / touch ZONE).
    if (i % 3 === 0) {
      stamp = await midOfferProbe({ action: 'stamp-firebase', driverId });
      log('firebase stamp', {
        fbLastSeen: stamp.firebaseLastSeen,
        zoneAgeMs: stamp.zoneAgeMs,
      });
      timeline.push({
        t: elapsed,
        event: 'stamp-firebase',
        zoneAgeMs: stamp.zoneAgeMs,
        firebaseLastSeen: stamp.firebaseLastSeen,
      });
    }

    // Every 2s: heal WITHOUT sync (AutoDispatchVehiclesallride path).
    const heal = await midOfferProbe({
      action: 'heal-no-sync',
      sourceTag: 'repro/heal-no-sync',
    });
    const probe = (heal.probes || [])[0] || null;
    const trace = await h.jobTrace(jobId);
    const status = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    const row = {
      t: elapsed,
      event: 'heal-no-sync',
      healed: heal.healed,
      status,
      zoneAgeMs: probe?.zoneAgeMs ?? null,
      fbAgeMs: probe?.fbAgeMs ?? null,
      midOfferStale: probe?.midOfferStale ?? null,
    };
    timeline.push(row);
    log('heal-no-sync', row);

    if (status !== 'Offered' || heal.healed > 0) {
      bounced = true;
      bounceProbe = row;
      log('BOUNCE DETECTED', row);
      break;
    }
  }

  console.log('\n===== REPRO TIMELINE =====');
  for (const row of timeline) {
    console.log(JSON.stringify(row));
  }
  console.log('===== END TIMELINE =====\n');

  assert.equal(bounced, true, 'expected mid-offer bounce while Firebase was being stamped');
  assert.ok(bounceProbe, 'missing bounce probe');
  assert.ok(
    bounceProbe.zoneAgeMs == null || bounceProbe.zoneAgeMs > 10_000,
    `expected ZONE age >10s at bounce, got zoneAgeMs=${bounceProbe.zoneAgeMs}`,
  );
  // Firebase should still look fresh if stamps worked (allow up to ~8s for loop jitter).
  if (bounceProbe.fbAgeMs != null) {
    assert.ok(
      bounceProbe.fbAgeMs < 10_000,
      `expected Firebase age <10s at bounce (proves ZONE/Firebase split), got fbAgeMs=${bounceProbe.fbAgeMs}`,
    );
  }

  console.log(
    `\nROOT CAUSE EVIDENCE: bounce at t+${Math.round((bounceProbe.t || 0) / 1000)}s ` +
      `with zoneAgeMs=${bounceProbe.zoneAgeMs} fbAgeMs=${bounceProbe.fbAgeMs}. ` +
      `Heal used ZONE_DRIVERS.lastSeen without syncing Firebase stamps.\n`,
  );
});

test('CONTROL: sync-then-heal does NOT bounce while Firebase is stamped every 5s', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);

  const driverId = String(h.driverIds[0]);
  for (const did of h.driverIds) {
    if (String(did) === driverId) continue;
    await h.configureDriver(did, { vehiclestatus: 'Away', lastSeen: Date.now() });
    await h.driverStatusChanged(did, 'Away').catch(() => undefined);
  }
  await h.ensureDriverReady(driverId);
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now(),
    lat: -46.412,
    lng: 168.353,
  });
  // Keep ZONE row alive — sweeper deletes identity-thin Available online nodes.
  await h.driverStatusChanged(driverId, 'Available', {
    lat: -46.412,
    lng: 168.353,
  });

  const jobId = await h.createAsapJob('repro-mid-offer-sync-control');
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, `assign failed: ${JSON.stringify(assignRes.body)}`);
  await h.poll(
    jobId,
    (t) => String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered',
    { timeoutMs: 30000 },
  );

  const t0 = Date.now();
  for (let i = 0; i < 12; i++) {
    await sleep(2000);
    // Re-seed ZONE in case sweeper raced; then stamp Firebase only for the heal path under test.
    await h.configureDriver(driverId, {
      vehiclestatus: 'Available',
      lastSeen: Date.now() - 30_000, // deliberately stale ZONE; sync must refresh from Firebase
      lat: -46.412,
      lng: 168.353,
    });
    await midOfferProbe({ action: 'stamp-firebase', driverId });
    const heal = await midOfferProbe({
      action: 'sync-then-heal',
      sourceTag: 'repro/sync-then-heal',
    });
    const trace = await h.jobTrace(jobId);
    const status = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    const probe = (heal.probes || [])[0];
    console.log(
      `[CONTROL t+${Math.round((Date.now() - t0) / 1000)}s] status=${status} healed=${heal.healed} ` +
        `zoneAge=${probe ? Math.round((probe.zoneAgeMs || 0) / 1000) + 's' : 'n/a'} ` +
        `fbAge=${probe ? Math.round((probe.fbAgeMs || 0) / 1000) + 's' : 'n/a'}`,
    );
    assert.equal(status, 'Offered', 'sync-then-heal should keep offer while Firebase stamps are fresh');
    assert.equal(heal.healed, 0, 'sync-then-heal should not network-bounce a fresh Firebase driver');
  }
});
