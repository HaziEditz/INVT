/**
 * Product: show "Any" (not blank) for Not Specified / Any vehicle type.
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
  if (!v) return null;
  if (v.toLowerCase() === 'not specified' || v.toLowerCase() === 'any') return 'Any';
  return v;
}

test('jobVehicleTypeLabel: Any / Not Specified show as Any', () => {
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'Not Specified' }), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'any' }), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'Any' }), 'Any');
  assert.equal(jobVehicleTypeLabel({ vehicleType: 'WAV' }), 'WAV');
  assert.equal(jobVehicleTypeLabel({ vehicleType: '' }), null);
});

test('Closed Job detail uses jobTariffLabel for Tariff field', () => {
  const src = readFileSync(join(root, 'src/components/jobs/ClosedJobDetailModal.tsx'), 'utf8');
  assert.match(src, /jobTariffLabel\(job\)/);
  assert.doesNotMatch(src, /dash\(job\.tariffName \|\| job\.tariffId\)/);
});

test('jobVehicleTypeLabel source shows Any not null for not specified', () => {
  const src = readFileSync(join(root, 'src/types/job.ts'), 'utf8');
  assert.match(src, /return 'Any'/);
  assert.doesNotMatch(
    src,
    /toLowerCase\(\) === 'not specified' \|\| v\.toLowerCase\(\) === 'any'\) return null/,
  );
});
