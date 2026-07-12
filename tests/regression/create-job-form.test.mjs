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
  else if (!tariffName) tariffName = 'Automatic';
  return { tariffId, tariffName };
}

function resolveTariffFormSelection(fields, catalog) {
  if (fields.tariffId !== '0' && fields.tariffId !== '') return fields;
  const name = fields.tariffName.trim();
  if (!name || name.toLowerCase() === 'automatic' || name.toLowerCase() === 'fixed') return fields;
  const match = catalog.find(
    (t) => String(t.TariffName).trim().toLowerCase() === name.toLowerCase(),
  );
  if (!match) return fields;
  return { tariffId: String(match.Id), tariffName: String(match.TariffName) };
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

test('resolveTariffFormSelection maps name-only legacy rows to catalog id', () => {
  const catalog = [
    { Id: 3, TariffName: 'Night Rate' },
    { Id: 8, TariffName: 'Airport' },
  ];
  assert.deepEqual(
    resolveTariffFormSelection({ tariffId: '0', tariffName: 'Night Rate' }, catalog),
    { tariffId: '3', tariffName: 'Night Rate' },
  );
});
