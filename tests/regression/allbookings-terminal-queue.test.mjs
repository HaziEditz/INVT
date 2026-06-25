import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceAllbookingsLiveStatus,
  reinjectQueueAwaitingJobs,
  markQueueAwaitingAllbookings,
  clearQueueAwaitingAllbookings,
} from '../lib/jobPoolSync.mjs';

test('coerceAllbookingsLiveStatus: Cancelled wins over stale queuedAt', () => {
  const rec = {
    BookingId: 8692606252,
    BookingStatus: 'Cancelled',
    Status: 'Cancelled',
    queuedAt: 1782094512209,
    eventType: 'queued',
  };
  const effective = coerceAllbookingsLiveStatus(rec, 'Cancelled');
  assert.equal(effective, 'Cancelled');
});

test('coerceAllbookingsLiveStatus: Completed wins over stale queuedAt', () => {
  const rec = {
    BookingStatus: 'Completed',
    queuedAt: Date.now(),
  };
  assert.equal(coerceAllbookingsLiveStatus(rec, 'Completed'), 'Completed');
});

test('coerceAllbookingsLiveStatus: still coerces live queue rows', () => {
  const rec = {
    BookingStatus: 'Queued',
    DriverId: 'D001',
    queuedAt: Date.now(),
  };
  assert.equal(coerceAllbookingsLiveStatus(rec, 'Queued'), 'Queued');
});

test('reinjectQueueAwaitingJobs: skips terminal store rows and clears await flag', () => {
  const jobId = 8692606252;
  markQueueAwaitingAllbookings(jobId);
  const bookingsRef = new Map();
  const storeJobs = [
    {
      id: jobId,
      companyId: '860869',
      status: 'Cancelled',
      source: 'dispatch',
      serviceType: 'taxi',
      pickAddress: '',
      pickLatLng: '',
      dropAddress: '',
      dropLatLng: '',
      passengerName: '',
      passengerPhone: '',
      paymentType: 'Cash',
      estimatedFare: '',
      bookingDateTime: new Date().toISOString(),
      driverId: 'D001',
    },
  ];
  reinjectQueueAwaitingJobs(bookingsRef, storeJobs);
  assert.equal(bookingsRef.size, 0);
  clearQueueAwaitingAllbookings(jobId);
});
