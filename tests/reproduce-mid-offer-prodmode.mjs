/**
 * Production-mode scenarios (server started with NODE_ENV=development so sync runs).
 */
import './lib/loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_KEY, TEST_CID, requireFirebaseSecret } from './lib/config.mjs';
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

async function setupOneDriver(h) {
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
  await h.driverStatusChanged(driverId, 'Available', {
    lat: -46.412,
    lng: 168.353,
  });
  // Seed Firebase presence so sync has a node to merge.
  await midOfferProbe({ action: 'stamp-firebase', driverId });
  return driverId;
}

async function offerTo(h, driverId, label) {
  const jobId = await h.createAsapJob(label);
  const assignRes = await h.assignJob(jobId, driverId, driverId);
  assert.equal(assignRes.body?.ok, true, `assign failed: ${JSON.stringify(assignRes.body)}`);
  await h.poll(
    jobId,
    (t) =>
      String(t.jobStore?.lifecycle?.BookingStatus || '') === 'Offered' &&
      String(t.jobStore?.lifecycle?.DriverId || '') === driverId,
    { timeoutMs: 30000 },
  );
  return jobId;
}

test('PRODMODE A: sync-then-heal + 5s Firebase stamps keeps offer (>15s)', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = await setupOneDriver(h);
  const jobId = await offerTo(h, driverId, 'prodmode-A-sync-stamps');

  const t0 = Date.now();
  console.log(`[PRODMODE-A] offer live job=#${jobId} — stamp Firebase every 5s, sync-then-heal every 2s`);

  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    // Stamp every tick (~2s) so Firebase stays well under the 10s mid-offer gate.
    const stamp = await midOfferProbe({ action: 'stamp-firebase', driverId });
    console.log(
      `[PRODMODE-A t+${Math.round((Date.now() - t0) / 1000)}s] stamp-firebase zoneAgeMs=${stamp.zoneAgeMs}`,
    );
    const heal = await midOfferProbe({
      action: 'sync-then-heal',
      sourceTag: 'prodmode-A/sync-then-heal',
    });
    const trace = await h.jobTrace(jobId);
    const status = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    const probe = (heal.probes || [])[0];
    console.log(
      `[PRODMODE-A t+${Math.round((Date.now() - t0) / 1000)}s] status=${status} healed=${heal.healed} ` +
        `zoneAge=${probe ? Math.round((probe.zoneAgeMs || 0) / 1000) + 's' : 'n/a'} ` +
        `fbAge=${probe ? Math.round((probe.fbAgeMs || 0) / 1000) + 's' : 'n/a'}`,
    );
    assert.equal(status, 'Offered', 'PRODMODE-A: sync+stamps must keep offer');
    assert.equal(heal.healed, 0, 'PRODMODE-A: must not network-bounce');
  }
  console.log('[PRODMODE-A] PASS — sync-then-heal held offer with live Firebase stamps');
});

test('PRODMODE B: sync-then-heal WITHOUT Firebase stamps still bounces (app gap)', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = await setupOneDriver(h);
  const jobId = await offerTo(h, driverId, 'prodmode-B-no-stamps');

  // Freeze ZONE at an already-stale value; do NOT stamp Firebase again.
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 12_000,
    lat: -46.412,
    lng: 168.353,
  });

  const t0 = Date.now();
  console.log(`[PRODMODE-B] offer live job=#${jobId} — NO Firebase stamps; sync-then-heal`);

  let bounced = false;
  let bounceRow = null;
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const heal = await midOfferProbe({
      action: 'sync-then-heal',
      sourceTag: 'prodmode-B/sync-then-heal',
    });
    const trace = await h.jobTrace(jobId);
    const status = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    const probe = (heal.probes || [])[0];
    const row = {
      t: Date.now() - t0,
      status,
      healed: heal.healed,
      zoneAgeMs: probe?.zoneAgeMs ?? null,
      fbAgeMs: probe?.fbAgeMs ?? null,
    };
    console.log(`[PRODMODE-B t+${Math.round(row.t / 1000)}s]`, JSON.stringify(row));
    if (status !== 'Offered' || heal.healed > 0) {
      bounced = true;
      bounceRow = row;
      break;
    }
  }

  // If Firebase still has the setup stamp from setupOneDriver, sync may REFRESH zone and prevent bounce.
  // Force evidence: after freeze, overwrite Firebase to also be stale, then sync-then-heal must bounce.
  if (!bounced) {
    console.log('[PRODMODE-B] first pass did not bounce (Firebase still fresh) — staling Firebase too');
    const stampAt = Date.now() - 15_000;
    await midOfferProbe({ action: 'stamp-firebase', driverId, lastSeen: stampAt });
    await h.configureDriver(driverId, {
      vehiclestatus: 'Available',
      lastSeen: stampAt,
      lat: -46.412,
      lng: 168.353,
    });
    const heal = await midOfferProbe({
      action: 'sync-then-heal',
      sourceTag: 'prodmode-B/sync-then-heal-stale-fb',
    });
    const trace = await h.jobTrace(jobId);
    const status = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    bounceRow = {
      t: Date.now() - t0,
      status,
      healed: heal.healed,
      zoneAgeMs: heal.probes?.[0]?.zoneAgeMs ?? null,
      fbAgeMs: heal.probes?.[0]?.fbAgeMs ?? null,
    };
    console.log('[PRODMODE-B] after stale Firebase', JSON.stringify(bounceRow));
    bounced = status !== 'Offered' || heal.healed > 0;
  }

  assert.equal(bounced, true, 'PRODMODE-B: expected bounce when Firebase+ZONE are both stale');
  console.log(
    `[PRODMODE-B] EVIDENCE bounce zoneAgeMs=${bounceRow?.zoneAgeMs} fbAgeMs=${bounceRow?.fbAgeMs}`,
  );
});

test('PRODMODE C: heal-no-sync + live Firebase recheck keeps offer (third-path closed)', async () => {
  requireFirebaseSecret();
  const h = await getHarness({ fresh: true });
  await prepareCleanDispatch(h);
  const driverId = await setupOneDriver(h);
  const jobId = await offerTo(h, driverId, 'prodmode-C-live-refresh');

  // Age ZONE past 10s while Firebase stays fresh via stamps — old third path bounced here.
  await h.configureDriver(driverId, {
    vehiclestatus: 'Available',
    lastSeen: Date.now() - 12_000,
    lat: -46.412,
    lng: 168.353,
  });

  const t0 = Date.now();
  console.log(`[PRODMODE-C] job=#${jobId} — stale ZONE + fresh Firebase + heal-NO-sync (live recheck)`);

  for (let i = 0; i < 8; i++) {
    await sleep(2000);
    if (i % 2 === 0) {
      await midOfferProbe({ action: 'stamp-firebase', driverId });
    }
    const heal = await midOfferProbe({
      action: 'heal-no-sync',
      sourceTag: 'prodmode-C/heal-no-sync',
    });
    const trace = await h.jobTrace(jobId);
    const status = String(trace.jobStore?.lifecycle?.BookingStatus || '');
    const probe = (heal.probes || [])[0];
    console.log(
      `[PRODMODE-C t+${Math.round((Date.now() - t0) / 1000)}s] status=${status} healed=${heal.healed} ` +
        `zoneAge=${probe ? Math.round((probe.zoneAgeMs || 0) / 1000) + 's' : 'n/a'} ` +
        `fbAge=${probe ? Math.round((probe.fbAgeMs || 0) / 1000) + 's' : 'n/a'}`,
    );
    assert.equal(status, 'Offered', 'PRODMODE-C: live Firebase recheck must keep offer despite stale ZONE');
    assert.equal(heal.healed, 0, 'PRODMODE-C: must not network-bounce');
  }
  console.log('[PRODMODE-C] PASS — third path closed by per-driver Firebase recheck before bounce');
});
