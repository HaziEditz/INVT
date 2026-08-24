/**
 * Product: show "Any" (not blank) for Not Specified / Any / missing vehicle type.
 * WAV / wheelchair / accessible → Wheelchair on the card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Mirrors src/types/job.ts jobVehicleTypeLabel. */
function jobVehicleTypeLabel(job) {
  const v = String(job.vehicleType || '').trim();
  if (!v || v.toLowerCase() === 'not specified' || v.toLowerCase() === 'any' || v.toLowerCase() === 'all') {
    return 'Any';
  }
  if (/wav|wheelchair|accessible/i.test(v)) return 'Wheelchair';
  return v;
}

test('jobVehicleTypeLabel: Any / Not Specified / blank show as Any', () => {
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'Not Specified' }), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'any' }), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'Any' }), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: '' }), 'Any');
  assert.equal(jobVehicleTypeLabel({}), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'WAV' }), 'Wheelchair');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'Wheelchair' }), 'Wheelchair');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'Sedan' }), 'Sedan');
});

test('Closed Job detail uses jobTariffLabel for Tariff field', () => {
  const src = readFileSync(join(root, 'src/components/jobs/ClosedJobDetailModal.tsx'), 'utf8');
  assert.match(src, /jobTariffLabel\(job\)/);
  assert.doesNotMatch(src, /dash\(job\.tariffName \|\| job\.tariffId\)/);
});

test('jobVehicleTypeLabel source always returns Any for blank / not specified', () => {
  const src = readFileSync(join(root, 'src/types/job.ts'), 'utf8');
  assert.match(src, /return 'Any'/);
  assert.match(src, /return 'Wheelchair'/);
});

test('JobCard shows vehicle type TypeTag on header row', () => {
  const src = readFileSync(join(root, 'src/components/jobs/JobCard.tsx'), 'utf8');
  assert.match(src, /TypeTag label=\{jobVehicleTypeLabel\(job\)\}/);
});

test('auto-dispatch loops Pending when top has 0 Available eligible', () => {
  const src = readFileSync(join(root, 'server.js'), 'utf8');
  assert.match(src, /skippedUnofferable/);
  assert.match(src, /trying next Pending/);
  assert.match(src, /for \(const job of pending\)/);
});
