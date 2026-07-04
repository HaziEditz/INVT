/**
 * Phase 1 — jobStatusAuthority unit coverage.
 * Pins current status/tab routing behavior (no behavior changes).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_BOOKING_STATUSES,
  LIVE_DISPATCH_STATUSES,
  LIVE_DISPATCH_TABS,
  LIVE_LIFECYCLE_STATUSES,
  LIVE_OFFER_STATUSES,
  POOL_TAB_STATUSES,
  POOL_UA_STATUSES,
  TERMINAL_BOOKING_STATUSES,
  allbookingsRecordIsQueued,
  coerceAllbookingsLiveStatus,
  effectiveJobStatus,
  isGenuineQueuedJob,
  isLiveDispatchStatus,
  isPoolUaStatus,
  isTerminalStatus,
  isUaJob,
  isUnassignedDriverId,
  jobStatusAbbrev,
  jobStatusFromFirebaseRecord,
  jobTabForStatus,
  mergeJobStatus,
  normalizeJobStatus,
  pendingSnapshotWouldRegressConfirmedQueue,
  pinQueuedOptimisticJob,
  retainQueuedOptimisticAfterServerMerge,
  statusBadgeStyle,
  statusRank,
  uaStatusBadge,
} from '../lib/jobStatusAuthority.mjs';

function job(partial) {
  return {
    id: partial.id ?? 1,
    companyId: 'bwtest',
    status: partial.status ?? 'Pending',
    source: partial.source ?? 'dispatch',
    serviceType: partial.serviceType ?? 'taxi',
    pickAddress: partial.pickAddress ?? '1 Test St',
    pickLatLng: '',
    dropAddress: partial.dropAddress ?? '',
    dropLatLng: '',
    passengerName: partial.passengerName ?? 'Pat',
    passengerPhone: partial.passengerPhone ?? '',
    paymentType: partial.paymentType ?? 'Cash',
    estimatedFare: partial.estimatedFare ?? '',
    bookingDateTime: partial.bookingDateTime ?? new Date().toISOString(),
    driverId: partial.driverId,
    vehicleId: partial.vehicleId,
    tariffId: partial.tariffId,
    tariffName: partial.tariffName,
    isFixedPrice: partial.isFixedPrice,
    ...partial,
  };
}

// ─── Normalize ───────────────────────────────────────────────────────────────

test('authority: normalizeJobStatus aliases', () => {
  assert.equal(normalizeJobStatus('NoOne'), 'No One');
  assert.equal(normalizeJobStatus('no_one'), 'No One');
  assert.equal(normalizeJobStatus('NO ONE'), 'No One');
  assert.equal(normalizeJobStatus('pending'), 'Pending');
  assert.equal(normalizeJobStatus('PENDING'), 'Pending');
  assert.equal(normalizeJobStatus('queued'), 'Queued');
  assert.equal(normalizeJobStatus('QUEUED'), 'Queued');
  assert.equal(normalizeJobStatus('OnBoard'), 'Active');
  assert.equal(normalizeJobStatus('onboard'), 'Active');
  assert.equal(normalizeJobStatus('On Board'), 'Active');
  assert.equal(normalizeJobStatus('Assigned'), 'Assigned');
  assert.equal(normalizeJobStatus('No Show'), 'No Show');
});

// ─── Critical queue tab matrix ───────────────────────────────────────────────

test('authority: Queued job with valid driverId → Queue tab', () => {
  assert.equal(jobTabForStatus(job({ status: 'Queued', driverId: '9001' })), 'queue');
  assert.equal(jobTabForStatus(job({ status: 'queued', driverId: '42' })), 'queue');
  assert.equal(isGenuineQueuedJob({ status: 'Queued', driverId: '9001' }), true);
  assert.equal(isUaJob(job({ status: 'Queued', driverId: '9001' })), false);
});

test('authority: Queued job with missing/undefined/null driverId → U-A tab (NOT Queue)', () => {
  // Phase 1 pin of current behavior: empty driver is unassigned → U-A, not Queue.
  assert.equal(jobTabForStatus(job({ status: 'Queued' })), 'ua');
  assert.equal(jobTabForStatus(job({ status: 'Queued', driverId: undefined })), 'ua');
  assert.equal(jobTabForStatus(job({ status: 'Queued', driverId: null })), 'ua');
  assert.equal(jobTabForStatus(job({ status: 'Queued', driverId: '' })), 'ua');
  assert.notEqual(jobTabForStatus(job({ status: 'Queued' })), 'queue');
  assert.equal(isGenuineQueuedJob({ status: 'Queued' }), false);
  assert.equal(isGenuineQueuedJob({ status: 'Queued', driverId: undefined }), false);
  assert.equal(isGenuineQueuedJob({ status: 'Queued', driverId: null }), false);
});

test('authority: Queued job with pool driverId (0, -1, -2) → U-A tab', () => {
  for (const driverId of ['0', '-1', '-2', 0, -1, -2]) {
    assert.equal(
      jobTabForStatus(job({ status: 'Queued', driverId })),
      'ua',
      `driverId=${driverId}`,
    );
    assert.equal(isGenuineQueuedJob({ status: 'Queued', driverId }), false);
  }
});

// ─── Full status → tab matrix ────────────────────────────────────────────────

test('authority: all live status/tab combinations', () => {
  const cases = [
    [{ status: 'Pending' }, 'ua'],
    [{ status: 'No One', driverId: '-1' }, 'ua'],
    [{ status: 'Scheduled' }, 'ua'],
    [{ status: 'Offered', driverId: '9001' }, 'offer'],
    [{ status: 'Assigned', driverId: '9001' }, 'assign'],
    [{ status: 'Picking', driverId: '9001' }, 'assign'],
    [{ status: 'Arrived', driverId: '9001' }, 'assign'],
    [{ status: 'Active', driverId: '9001' }, 'active'],
    [{ status: 'OnTrip', driverId: '9001' }, 'active'],
    [{ status: 'OnBoard', driverId: '9001' }, 'active'],
    [{ status: 'Queued', driverId: '9001' }, 'queue'],
    [{ status: 'Busy' }, 'ua'],
    [{ status: 'Completed' }, 'ua'],
    [{ status: 'Cancelled' }, 'ua'],
    [{ status: 'No Show' }, 'ua'],
  ];
  for (const [partial, tab] of cases) {
    assert.equal(jobTabForStatus(job(partial)), tab, JSON.stringify(partial));
  }
});

test('authority: DY service types food/freight → dy tab; tm/acc/rental follow status', () => {
  assert.equal(jobTabForStatus(job({ status: 'Pending', serviceType: 'food' })), 'dy');
  assert.equal(jobTabForStatus(job({ status: 'Assigned', serviceType: 'freight', driverId: '1' })), 'dy');
  assert.equal(jobTabForStatus(job({ status: 'Active', serviceType: 'food', driverId: '1' })), 'dy');
  // Current behavior: tm/acc/rental are not DY-routed by serviceType alone.
  assert.equal(jobTabForStatus(job({ status: 'Pending', serviceType: 'tm' })), 'ua');
  assert.equal(jobTabForStatus(job({ status: 'Assigned', serviceType: 'acc', driverId: '1' })), 'assign');
  assert.equal(jobTabForStatus(job({ status: 'Active', serviceType: 'rental', driverId: '1' })), 'active');
});

test('authority: terminal status predicates', () => {
  for (const st of ['Completed', 'Cancelled', 'No Show']) {
    assert.equal(isTerminalStatus(st), true);
    assert.equal(TERMINAL_BOOKING_STATUSES.has(st), true);
    assert.equal(isLiveDispatchStatus(st), false);
  }
  assert.equal(isTerminalStatus('Active'), false);
  assert.equal(isLiveDispatchStatus('Active'), true);
  assert.equal(isLiveDispatchStatus('Queued'), true);
});

test('authority: pool / live / offer set membership', () => {
  for (const st of ['Pending', 'No One', 'Scheduled']) {
    assert.equal(isPoolUaStatus(st), true);
    assert.equal(POOL_UA_STATUSES.has(st), true);
    assert.equal(POOL_TAB_STATUSES.has(st), true);
  }
  for (const st of ['Offered', 'Assigned', 'Picking', 'Arrived', 'Active', 'OnTrip', 'Queued']) {
    assert.equal(ACTIVE_BOOKING_STATUSES.has(st), true);
  }
  assert.equal(LIVE_OFFER_STATUSES.has('Offered'), true);
  assert.equal(LIVE_OFFER_STATUSES.has('Assigned'), true);
  assert.equal(LIVE_LIFECYCLE_STATUSES.has('Active'), true);
  assert.equal(LIVE_DISPATCH_STATUSES.has('Pending'), true);
  for (const tab of ['offer', 'assign', 'active', 'queue']) {
    assert.equal(LIVE_DISPATCH_TABS.has(tab), true);
  }
  assert.equal(LIVE_DISPATCH_TABS.has('ua'), false);
});

// ─── Job sources (tab routing independent of source) ─────────────────────────

test('authority: all job sources route by status, not source', () => {
  const sources = ['dispatch', 'website', 'web', 'passenger', 'hail', 'phone'];
  for (const source of sources) {
    assert.equal(
      jobTabForStatus(job({ status: 'Pending', source })),
      'ua',
      `source=${source} Pending`,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Offered', source, driverId: '9' })),
      'offer',
      `source=${source} Offered`,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Assigned', source, driverId: '9' })),
      'assign',
      `source=${source} Assigned`,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Active', source, driverId: '9' })),
      'active',
      `source=${source} Active`,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Queued', source, driverId: '9' })),
      'queue',
      `source=${source} Queued`,
    );
  }
  // Hail active trip lands on Active tab.
  assert.equal(jobTabForStatus(job({ status: 'Active', source: 'hail', driverId: '202' })), 'active');
  assert.equal(jobTabForStatus(job({ status: 'OnTrip', source: 'hail', driverId: '202' })), 'active');
});

// ─── Payment types (tab routing independent of payment) ──────────────────────

test('authority: all payment types do not affect tab routing', () => {
  const payments = [
    'Cash',
    'Card',
    'Stripe',
    'Fixed price',
    'Fixed Price',
    'Pre-paid',
    'Prepaid',
    'Total Mobility',
    'TM',
    'ACC',
    'Account',
  ];
  for (const paymentType of payments) {
    assert.equal(
      jobTabForStatus(job({ status: 'Pending', paymentType })),
      'ua',
      paymentType,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Assigned', paymentType, driverId: '1' })),
      'assign',
      paymentType,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Active', paymentType, driverId: '1' })),
      'active',
      paymentType,
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Queued', paymentType, driverId: '1' })),
      'queue',
      paymentType,
    );
  }
});

// ─── Tariff scenarios (tab routing independent of tariff fields) ─────────────

test('authority: tariff scenarios do not affect tab routing', () => {
  const tariffs = [
    { tariffId: '1', tariffName: 'Standard' },
    { tariffId: '2', tariffName: 'Night' },
    { tariffId: '3', tariffName: 'Holiday' },
    { tariffId: '', tariffName: '' },
    { tariffId: '99', tariffName: 'Zone A', isFixedPrice: true },
    { tariffId: 'tm', tariffName: 'TM', paymentType: 'Total Mobility' },
    { tariffId: 'acc', tariffName: 'ACC', paymentType: 'ACC' },
    { estimatedFare: '25.00', isFixedPrice: true },
    { estimatedFare: '', isFixedPrice: false },
  ];
  for (const t of tariffs) {
    assert.equal(jobTabForStatus(job({ status: 'Pending', ...t })), 'ua', JSON.stringify(t));
    assert.equal(
      jobTabForStatus(job({ status: 'Active', driverId: '1', ...t })),
      'active',
      JSON.stringify(t),
    );
    assert.equal(
      jobTabForStatus(job({ status: 'Queued', driverId: '1', ...t })),
      'queue',
      JSON.stringify(t),
    );
  }
});

// ─── Multi-job: active + queued ──────────────────────────────────────────────

test('authority: multi-job active + queued route independently', () => {
  const active = job({ id: 100, status: 'Active', driverId: '9001', source: 'hail' });
  const queued = job({ id: 101, status: 'Queued', driverId: '9001', source: 'dispatch' });
  assert.equal(jobTabForStatus(active), 'active');
  assert.equal(jobTabForStatus(queued), 'queue');
  assert.equal(isGenuineQueuedJob(queued), true);
  assert.equal(isGenuineQueuedJob(active), false);

  // Stale pool snapshot must not demote Queued when seq is older.
  assert.equal(mergeJobStatus('Queued', 'Pending', 5, 4), 'Queued');
  assert.equal(mergeJobStatus('Queued', 'No One', 5, 4), 'Queued');
  // Newer live promote can leave Queued.
  assert.equal(mergeJobStatus('Queued', 'Assigned', 5, 6), 'Assigned');
  // Older promote is sticky Queued.
  assert.equal(mergeJobStatus('Queued', 'Assigned', 5, 5), 'Queued');
  assert.equal(mergeJobStatus('Queued', 'Assigned', 5, 4), 'Queued');
});

test('authority: pending snapshot does not regress confirmed queue', () => {
  assert.equal(
    pendingSnapshotWouldRegressConfirmedQueue(
      { BookingStatus: 'Pending' },
      { bookingsQueued: true, abQueued: false },
    ),
    true,
  );
  assert.equal(
    pendingSnapshotWouldRegressConfirmedQueue(
      { BookingStatus: 'Assigned' },
      { bookingsQueued: false, abQueued: true },
    ),
    true,
  );
  assert.equal(
    pendingSnapshotWouldRegressConfirmedQueue(
      { BookingStatus: 'Offered' },
      { bookingsQueued: true, abQueued: true },
    ),
    false,
  );
  assert.equal(
    pendingSnapshotWouldRegressConfirmedQueue(
      { BookingStatus: 'Queued' },
      { bookingsQueued: true, abQueued: true },
    ),
    false,
  );
  assert.equal(
    pendingSnapshotWouldRegressConfirmedQueue(
      { BookingStatus: 'Pending' },
      { bookingsQueued: false, abQueued: false },
    ),
    false,
  );
});

// ─── Firebase resolve / effective status ─────────────────────────────────────

test('authority: jobStatusFromFirebaseRecord resolution rules', () => {
  assert.equal(jobStatusFromFirebaseRecord({ DriverId: -1 }), 'No One');
  assert.equal(jobStatusFromFirebaseRecord({ driverId: '-1' }), 'No One');
  assert.equal(
    jobStatusFromFirebaseRecord({ BookingStatus: 'Assigned', Status: 'Pending', DriverId: '9' }),
    'Assigned',
  );
  assert.equal(
    jobStatusFromFirebaseRecord({ BookingStatus: 'Queued', Status: 'Pending', DriverId: '9' }),
    'Queued',
  );
  assert.equal(
    jobStatusFromFirebaseRecord({ BookingStatus: 'Active', Status: 'Offered', DriverId: '9' }),
    'Active',
  );
  assert.equal(
    jobStatusFromFirebaseRecord({ BookingStatus: 'Completed', Status: 'Active' }),
    'Completed',
  );
  assert.equal(
    jobStatusFromFirebaseRecord({ BookingStatus: 'Cancelled' }),
    'Cancelled',
  );
  assert.equal(
    jobStatusFromFirebaseRecord({ BookingStatus: 'No Show' }),
    'No Show',
  );
  assert.equal(jobStatusFromFirebaseRecord({ Status: 'Pending' }), 'Pending');
  assert.equal(jobStatusFromFirebaseRecord({}), 'Pending');
});

test('authority: effectiveJobStatus forces No One for driverId -1', () => {
  assert.equal(effectiveJobStatus({ status: 'Pending', driverId: '-1' }), 'No One');
  assert.equal(effectiveJobStatus({ status: 'Offered', driverId: '9' }), 'Offered');
});

test('authority: badges and abbrev', () => {
  assert.equal(uaStatusBadge(job({ status: 'Pending' }))?.label, 'PENDING');
  assert.equal(uaStatusBadge(job({ status: 'No One' }))?.label, 'NO ONE');
  assert.equal(uaStatusBadge(job({ status: 'Active' })), null);
  assert.equal(statusBadgeStyle('Scheduled')?.label, 'SCHEDULED');
  assert.equal(jobStatusAbbrev('Queued').abbrev, 'QUE');
  assert.equal(jobStatusAbbrev('Active').abbrev, 'ACT');
  assert.equal(jobStatusAbbrev('OnTrip').abbrev, 'ACT');
});

// ─── Merge status ────────────────────────────────────────────────────────────

test('authority: mergeJobStatus pool peers and terminal seq rules', () => {
  assert.equal(mergeJobStatus('Pending', 'No One', 1, 2), 'No One');
  assert.equal(mergeJobStatus('No One', 'Pending', 2, 1), 'No One');
  assert.equal(mergeJobStatus('Active', 'Completed', 5, 4), 'Active');
  assert.equal(mergeJobStatus('Active', 'Completed', 5, 6), 'Completed');
  assert.equal(mergeJobStatus('Scheduled', 'Pending', 1, 2), 'Pending');
  assert.equal(statusRank('Active') > statusRank('Offered'), true);
  assert.equal(statusRank('Completed'), 100);
});

// ─── Allbookings queue helpers ───────────────────────────────────────────────

test('authority: allbookingsRecordIsQueued and coerceAllbookingsLiveStatus', () => {
  assert.equal(
    allbookingsRecordIsQueued({ BookingStatus: 'Queued', DriverId: '9001' }),
    true,
  );
  assert.equal(
    allbookingsRecordIsQueued({ BookingStatus: 'Queued', DriverId: '0' }),
    false,
  );
  assert.equal(
    allbookingsRecordIsQueued({ BookingStatus: 'Pending', DriverId: '9001' }),
    false,
  );
  assert.equal(
    allbookingsRecordIsQueued({ eventType: 'queued', DriverId: '9001' }),
    true,
  );
  assert.equal(
    coerceAllbookingsLiveStatus({ BookingStatus: 'Completed' }, 'Active'),
    'Completed',
  );
  assert.equal(
    coerceAllbookingsLiveStatus({ BookingStatus: 'Queued', DriverId: '9001' }, 'Pending'),
    'Queued',
  );
  assert.equal(
    coerceAllbookingsLiveStatus({ BookingStatus: 'Queued', DriverId: '0' }, 'Pending'),
    'Pending',
  );
});

test('authority: isUnassignedDriverId pool ids', () => {
  assert.equal(isUnassignedDriverId(undefined), true);
  assert.equal(isUnassignedDriverId(null), true);
  assert.equal(isUnassignedDriverId(''), true);
  assert.equal(isUnassignedDriverId('0'), true);
  assert.equal(isUnassignedDriverId('-1'), true);
  assert.equal(isUnassignedDriverId('-2'), true);
  assert.equal(isUnassignedDriverId('9001'), false);
});

test('authority: pinQueuedOptimisticJob keeps Queue tab and rejects U-A flash', () => {
  const base = job({ status: 'Queued', driverId: '9001', vehicleId: '202', dropAddress: 'Old Drop' });
  const applied = job({
    status: 'Pending',
    driverId: '0',
    vehicleId: undefined,
    dropAddress: 'Edited Drop 99',
  });
  const pinned = pinQueuedOptimisticJob(base, applied);
  assert.ok(pinned);
  assert.equal(pinned.status, 'Queued');
  assert.equal(pinned.driverId, '9001');
  assert.equal(pinned.vehicleId, '202');
  assert.equal(pinned.dropAddress, 'Edited Drop 99');
  assert.equal(jobTabForStatus(pinned), 'queue');
  assert.notEqual(jobTabForStatus(pinned), 'ua');

  assert.equal(pinQueuedOptimisticJob(job({ status: 'Active', driverId: '9001' }), applied), null);
  assert.equal(pinQueuedOptimisticJob(job({ status: 'Queued', driverId: '0' }), applied), null);
});

test('authority: retainQueuedOptimisticAfterServerMerge blocks pool demotion flash', () => {
  const optimistic = job({ status: 'Queued', driverId: '9001', vehicleId: '202', dropAddress: 'Edited' });
  const demoted = job({ status: 'Pending', driverId: '0', dropAddress: 'Edited' });
  const retained = retainQueuedOptimisticAfterServerMerge(optimistic, demoted);
  assert.equal(retained.status, 'Queued');
  assert.equal(retained.driverId, '9001');
  assert.equal(jobTabForStatus(retained), 'queue');

  const activeFresh = job({ status: 'Active', driverId: '9001' });
  assert.equal(
    retainQueuedOptimisticAfterServerMerge(optimistic, activeFresh).status,
    'Active',
  );
});
