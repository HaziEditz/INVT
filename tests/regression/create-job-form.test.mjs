/**
 * createJobForm + mergeJob field round-trip helpers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function isOpenVehicleType(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return !s || s === 'not specified' || s === 'any';
}

function isConcreteVehicleType(value) {
  return !isOpenVehicleType(value);
}

function isLaterJobState(job) {
  if ((job.dispatchBeforeMinutes ?? 0) > 0) return true;
  if (job.notifyDispatchAt) return true;
  if (job.scheduledFor != null && job.scheduledFor > 0) return true;
  if (String(job.status || '') === 'Scheduled') return true;
  return false;
}

function isExplicitLaterToNow(existing, incoming) {
  if (!isLaterJobState(existing)) return false;
  if (isLaterJobState(incoming)) return false;
  const prevDb = existing.dispatchBeforeMinutes ?? 0;
  const nextDb = incoming.dispatchBeforeMinutes ?? prevDb;
  if (prevDb > 0 && nextDb === 0) return true;
  const prevSched = existing.scheduledFor ?? 0;
  if (prevSched > 0 && incoming.scheduledFor === 0) return true;
  if (
    prevSched > 0 &&
    incoming.notifyDispatchAt === '' &&
    nextDb === 0 &&
    (incoming.scheduledFor == null || incoming.scheduledFor === 0)
  ) {
    return true;
  }
  if (
    existing.status === 'Scheduled' &&
    incoming.status != null &&
    incoming.status === 'Pending' &&
    nextDb === 0 &&
    !(incoming.scheduledFor != null && incoming.scheduledFor > 0)
  ) {
    return true;
  }
  return false;
}

function mergeLaterTiming(existing, incoming, existingSeq, incomingSeq) {
  const merged = { ...existing, ...incoming };
  if (incomingSeq < existingSeq) return merged;
  const prevLater = isLaterJobState(existing);
  const laterToNow = isExplicitLaterToNow(existing, incoming);
  if (laterToNow) {
    merged.dispatchBeforeMinutes = 0;
    merged.scheduledFor =
      incoming.scheduledFor != null && incoming.scheduledFor > 0 ? incoming.scheduledFor : undefined;
    merged.notifyDispatchAt = incoming.notifyDispatchAt?.trim() ? incoming.notifyDispatchAt : undefined;
  } else if (prevLater) {
    if ((existing.scheduledFor ?? 0) > 0 && !(incoming.scheduledFor != null && incoming.scheduledFor > 0)) {
      merged.scheduledFor = existing.scheduledFor;
    }
    if (existing.notifyDispatchAt && !incoming.notifyDispatchAt) {
      merged.notifyDispatchAt = existing.notifyDispatchAt;
    }
    if ((existing.dispatchBeforeMinutes ?? 0) > 0 && (incoming.dispatchBeforeMinutes ?? 0) === 0) {
      merged.dispatchBeforeMinutes = existing.dispatchBeforeMinutes;
    }
  }
  return merged;
}

function mergeVehicleType(existing, incoming, existingSeq, incomingSeq) {
  const staleMirror =
    incomingSeq < existingSeq &&
    isOpenVehicleType(incoming.vehicleType) &&
    isConcreteVehicleType(existing.vehicleType);
  if (staleMirror) return existing.vehicleType;
  return incoming.vehicleType ?? existing.vehicleType;
}

function tariffFieldsFromJob(job) {
  const rawId = job.tariffId ?? job.TarriffId ?? job.TariffId;
  const rawName =
    job.tariffName ?? job.TarriffName ?? job.TariffName ?? job.TarriffType ?? job.tarriffType;
  const tariffId = rawId != null && String(rawId).trim() !== '' ? String(rawId) : '0';
  let tariffName = String(rawName ?? '').trim();
  if (tariffId === '-1') tariffName = tariffName || 'Fixed';
  else if (tariffId === '0') tariffName = tariffName || 'Automatic';
  // Named ids keep empty name — do not coerce to Automatic (blocks synthetic dropdown row).
  return { tariffId, tariffName };
}

function mergeTariffCatalogSources(...sources) {
  const byId = new Map();
  for (const list of sources) {
    for (const row of list) {
      const id = String(row.Id ?? '').trim();
      const name = String(row.TariffName ?? '').trim();
      if (!id && !name) continue;
      const key = id || `name:${name.toLowerCase()}`;
      const prev = byId.get(key);
      byId.set(key, { Id: id || prev?.Id || key, TariffName: name || prev?.TariffName || '' });
    }
  }
  return Array.from(byId.values()).filter((t) => String(t.TariffName).trim());
}

function resolveTariffFormSelection(fields, catalog) {
  const id = String(fields.tariffId ?? '').trim();
  const name = String(fields.tariffName ?? '').trim();
  if (id && id !== '0') {
    const byId = catalog.find((t) => String(t.Id) === id);
    if (byId) return { tariffId: String(byId.Id), tariffName: String(byId.TariffName) };
    if (name) {
      const byName = catalog.find(
        (t) => String(t.TariffName).trim().toLowerCase() === name.toLowerCase(),
      );
      if (byName) return { tariffId: String(byName.Id), tariffName: String(byName.TariffName) };
    }
    return fields;
  }
  if (!name || name.toLowerCase() === 'automatic' || name.toLowerCase() === 'fixed') return fields;
  const match = catalog.find(
    (t) => String(t.TariffName).trim().toLowerCase() === name.toLowerCase(),
  );
  if (!match) return fields;
  return { tariffId: String(match.Id), tariffName: String(match.TariffName) };
}

function buildEditTariffDropdown(catalog, fields) {
  const resolved = resolveTariffFormSelection(fields, catalog);
  const id = String(resolved.tariffId).trim();
  const name = String(resolved.tariffName).trim();
  if (!id || id === '0' || id === '-1') return catalog;
  if (catalog.some((t) => String(t.Id) === id)) return catalog;
  const displayName =
    name && name.toLowerCase() !== 'automatic' && name.toLowerCase() !== 'fixed'
      ? name
      : `Tariff #${id}`;
  return [...catalog, { Id: id, TariffName: displayName }];
}

function jobBookingDateTimeForForm(job) {
  const bookingRaw = String(job.bookingDateTime ?? '').trim();
  const scheduledMs = job.scheduledFor;
  if (scheduledMs != null && scheduledMs > 0) {
    const fromSched = new Date(scheduledMs).toISOString().replace('T', ' ').slice(0, 16);
    if (!bookingRaw) return fromSched;
    const bookingMs = Date.parse(bookingRaw.replace(' ', 'T'));
    if (Number.isNaN(bookingMs) || Math.abs(bookingMs - scheduledMs) > 60_000) return fromSched;
  }
  if (bookingRaw) return bookingRaw;
  if (scheduledMs != null && scheduledMs > 0) {
    return new Date(scheduledMs).toISOString().replace('T', ' ').slice(0, 16);
  }
  return '';
}

test('merge vehicle type: intentional Any at same/higher seq wins over concrete', () => {
  assert.equal(
    mergeVehicleType({ vehicleType: 'Van', updateSeq: 4 }, { vehicleType: 'Not Specified', updateSeq: 5 }, 4, 5),
    'Not Specified',
  );
  assert.equal(
    mergeVehicleType({ vehicleType: 'Van', updateSeq: 5 }, { vehicleType: 'Not Specified', updateSeq: 5 }, 5, 5),
    'Not Specified',
  );
});

test('merge vehicle type: stale open mirror at lower seq preserves concrete', () => {
  assert.equal(
    mergeVehicleType({ vehicleType: 'Van', updateSeq: 6 }, { vehicleType: 'Not Specified', updateSeq: 5 }, 6, 5),
    'Van',
  );
});

test('merge Later timing: partial metadata patch preserves scheduledFor', () => {
  const future = Date.now() + 3_600_000;
  const merged = mergeLaterTiming(
    {
      scheduledFor: future,
      dispatchBeforeMinutes: 0,
      status: 'Scheduled',
      vehicleType: 'Car',
      updateSeq: 4,
    },
    {
      vehicleType: 'Van',
      dispatchBeforeMinutes: 0,
      scheduledFor: undefined,
      updateSeq: 5,
    },
    4,
    5,
  );
  assert.equal(merged.scheduledFor, future);
  assert.equal(merged.vehicleType, 'Van');
});

test('merge Later timing: explicit Later→Now clears scheduled pickup', () => {
  const future = Date.now() + 3_600_000;
  const merged = mergeLaterTiming(
    {
      scheduledFor: future,
      dispatchBeforeMinutes: 30,
      notifyDispatchAt: new Date(future - 1_800_000).toISOString(),
      status: 'Scheduled',
      updateSeq: 4,
    },
    {
      dispatchBeforeMinutes: 0,
      scheduledFor: undefined,
      notifyDispatchAt: '',
      status: 'Pending',
      updateSeq: 5,
    },
    4,
    5,
  );
  assert.equal(merged.scheduledFor, undefined);
  assert.equal(merged.dispatchBeforeMinutes, 0);
});

test('jobBookingDateTimeForForm prefers scheduledFor over stale ASAP bookingDateTime', () => {
  const future = Date.now() + 86_400_000;
  const dt = jobBookingDateTimeForForm({
    bookingDateTime: '2026-07-13 09:15',
    scheduledFor: future,
  });
  assert.ok(dt.includes(new Date(future).toISOString().slice(0, 10)));
});

test('tariffFieldsFromJob reads legacy PascalCase id/name fields', () => {
  assert.deepEqual(
    tariffFieldsFromJob({ TariffId: '7', TarriffType: 'Night Rate' }),
    { tariffId: '7', tariffName: 'Night Rate' },
  );
  assert.deepEqual(
    tariffFieldsFromJob({ TarriffType: 'Daytime' }),
    { tariffId: '0', tariffName: 'Daytime' },
  );
});

test('mergeTariffCatalogSources unions Firebase and dispatcher-settings rows', () => {
  const merged = mergeTariffCatalogSources(
    [{ Id: '1', TariffName: 'Day' }],
    [{ Id: '2', TariffName: 'Night' }],
  );
  assert.equal(merged.length, 2);
});

test('resolveTariffFormSelection matches by id or name', () => {
  const catalog = [
    { Id: '3', TariffName: 'Night Rate' },
    { Id: '8', TariffName: 'Airport' },
  ];
  assert.deepEqual(
    resolveTariffFormSelection({ tariffId: '8', tariffName: 'Airport' }, catalog),
    { tariffId: '8', tariffName: 'Airport' },
  );
  assert.deepEqual(
    resolveTariffFormSelection({ tariffId: '0', tariffName: 'Night Rate' }, catalog),
    { tariffId: '3', tariffName: 'Night Rate' },
  );
  assert.deepEqual(
    resolveTariffFormSelection({ tariffId: '99', tariffName: 'Night Rate' }, catalog),
    { tariffId: '3', tariffName: 'Night Rate' },
  );
});

test('buildEditTariffDropdown adds synthetic row when saved id missing from catalog', () => {
  const catalog = [{ Id: '1', TariffName: 'Day' }];
  const out = buildEditTariffDropdown(catalog, { tariffId: '2', tariffName: 'Tarrif 1' });
  assert.equal(out.length, 2);
  assert.ok(out.some((t) => String(t.Id) === '2' && t.TariffName === 'Tarrif 1'));
});

test('buildEditTariffDropdown synthesizes row for named id with empty/Automatic name', () => {
  const catalog = [{ Id: '1', TariffName: 'Day' }];
  const emptyName = buildEditTariffDropdown(catalog, { tariffId: '2', tariffName: '' });
  assert.ok(emptyName.some((t) => String(t.Id) === '2' && t.TariffName === 'Tariff #2'));
  const autoName = buildEditTariffDropdown(catalog, { tariffId: '9', tariffName: 'Automatic' });
  assert.ok(autoName.some((t) => String(t.Id) === '9' && t.TariffName === 'Tariff #9'));
  assert.deepEqual(tariffFieldsFromJob({ TarriffId: '5' }), { tariffId: '5', tariffName: '' });
});

function jobToFormMinimal(job) {
  const [pickLat, pickLng] = String(job.pickLatLng || '0,0').split(',').map(Number);
  const [dropLat, dropLng] = String(job.dropLatLng || '0,0').split(',').map(Number);
  const tariff = tariffFieldsFromJob(job);
  return {
    pick: { address: job.pickAddress || '', lat: pickLat || 0, lng: pickLng || 0 },
    drop: { address: job.dropAddress || '', lat: dropLat || 0, lng: dropLng || 0 },
    timing: 'now',
    laterDate: '',
    laterHour: '',
    laterMin: '',
    tariffId: tariff.tariffId,
    tariffName: tariff.tariffName,
    vehicleType: job.vehicleType || job.VehicleType || 'Not Specified',
    notes: job.notes || '',
  };
}

/** Mirrors CreateJobModal edit reload — tariff merge must not replace the full form. */
function loadEditFormForModal(job, catalog) {
  const baseForm = jobToFormMinimal(job);
  const tariff = resolveTariffFormSelection(baseForm, catalog);
  return { ...baseForm, ...tariff };
}

test('edit form reload preserves pick/drop coords when resolving tariff (crash guard)', () => {
  const catalog = [{ Id: '2', TariffName: 'Regression Tariff B' }];
  const job = {
    pickAddress: '1 Dee St, Invercargill',
    pickLatLng: '-46.4131,168.3538',
    dropAddress: 'Invercargill Airport',
    dropLatLng: '-46.3167,168.3167',
    vehicleType: 'Car',
    TarriffId: '1',
    TarriffName: 'Day',
    notes: 'Original notes',
    updateSeq: 1,
  };
  const loaded = loadEditFormForModal(job, catalog);
  assert.ok(loaded.pick, 'pick must exist after edit reload');
  assert.ok(loaded.pick.lat, 'pick.lat must be readable (production crash guard)');
  assert.ok(loaded.drop?.lat, 'drop.lat must survive');
  assert.equal(loaded.notes, 'Original notes');
  assert.equal(loaded.vehicleType, 'Car');
  // Simulate post-save seq bump + tariff change reload
  const afterSave = loadEditFormForModal(
    {
      ...job,
      updateSeq: 2,
      vehicleType: 'Van',
      TarriffId: '2',
      TarriffName: 'Regression Tariff B',
    },
    catalog,
  );
  assert.ok(afterSave.pick?.lat, 'pick.lat must survive post-save reload');
  assert.equal(afterSave.vehicleType, 'Van');
  assert.equal(afterSave.tariffId, '2');
});

test('laterDispatchMinOptions hides 0 min when pickup is future', () => {
  const future = new Date(Date.now() + 86_400_000);
  const all = [0, 5, 10, 15];
  function laterDispatchMinOptions(form, options, nowMs = Date.now()) {
    if (form.timing !== 'later') return [...options];
    const pickup = new Date(`${form.laterDate}T${form.laterHour}:${form.laterMin}:00`);
    if (!Number.isNaN(pickup.getTime()) && pickup.getTime() > nowMs + 60_000) {
      return options.filter((m) => m > 0);
    }
    return [...options];
  }
  const out = laterDispatchMinOptions(
    {
      timing: 'later',
      laterDate: future.toISOString().slice(0, 10),
      laterHour: '16',
      laterMin: '37',
    },
    all,
  );
  assert.deepEqual(out, [5, 10, 15]);
});
