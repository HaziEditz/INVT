import type { DataParam } from '@/lib/dispatchApi';
import type { Driver } from '@/types/driver';
import type { Job } from '@/types/job';
import { normalizeJobStatus, parseLatLng } from '@/types/job';

export type PaymentType = '' | 'cash' | 'card' | 'eftpos' | 'account' | 'tm' | 'acc';

export interface PlaceValue {
  address: string;
  lat: number;
  lng: number;
}

export interface StopPoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

export interface CreateJobFormState {
  pick: PlaceValue;
  pickInput: string;
  drop: PlaceValue;
  dropInput: string;
  stops: StopPoint[];
  name: string;
  phone: string;
  email: string;
  showEmail: boolean;
  notes: string;
  serviceType: string;
  timing: 'now' | 'later';
  laterDate: string;
  laterHour: string;
  laterMin: string;
  dispatchBeforeMin: number;
  corner: boolean;
  urgent: boolean;
  vehicleType: string;
  tariffId: string;
  tariffName: string;
  /** "0" = Auto, "-2" = Pending, "-1" = No One, else driver id string (may be non-numeric). */
  driverId: string;
  vehicleId: string;
  queueNumber: number;
  paymentType: PaymentType;
  cardNumber: string;
  cardCvc: string;
  cardExpMonth: string;
  cardExpYear: string;
  cardAmount: string;
  cardPaid: boolean;
  eftposRef: string;
  eftposSurcharge: boolean;
  accountSearch: string;
  accountId: string;
  accountName: string;
  accountCredit: string;
  tmCardNumber: string;
  tmCardExpiry: string;
  tmCouncilPercent: string;
  tmPassengerPercent: string;
  claimNumber: string;
  poNumber: string;
  accSearchQuery: string;
  accClientId: string;
  accJobId: string;
  accManagerId: string;
  repeatExpanded: boolean;
  repeatUntil: string;
  repeatDays: boolean[];
  fixedFareEnabled: boolean;
  fixedFareAmount: string;
}

export const CJ_VEHICLE_TYPES = ['Any', 'Car', 'Van', 'WAV', 'Minibus'] as const;
export const CJ_SERVICES = ['taxi', 'food', 'freight', 'tm', 'acc', 'rental'] as const;

export function defaultCreateJobForm(): CreateJobFormState {
  const { date } = nzNowParts();
  return {
    pick: { address: '', lat: 0, lng: 0 },
    pickInput: '',
    drop: { address: '', lat: 0, lng: 0 },
    dropInput: '',
    stops: [],
    name: '',
    phone: '',
    email: '',
    showEmail: false,
    notes: '',
    serviceType: 'taxi',
    timing: 'now',
    laterDate: date,
    laterHour: '12',
    laterMin: '00',
    dispatchBeforeMin: 10,
    corner: false,
    urgent: false,
    vehicleType: 'Any',
    tariffId: '0',
    tariffName: 'Automatic',
    driverId: '0',
    vehicleId: '0',
    queueNumber: 0,
    paymentType: '',
    cardNumber: '',
    cardCvc: '',
    cardExpMonth: '',
    cardExpYear: '',
    cardAmount: '',
    cardPaid: false,
    eftposRef: '',
    eftposSurcharge: false,
    accountSearch: '',
    accountId: '',
    accountName: '',
    accountCredit: '',
    tmCardNumber: '',
    tmCardExpiry: '',
    tmCouncilPercent: '',
    tmPassengerPercent: '',
    claimNumber: '',
    poNumber: '',
    accSearchQuery: '',
    accClientId: '',
    accJobId: '',
    accManagerId: '',
    repeatExpanded: false,
    repeatUntil: '',
    repeatDays: [false, false, false, false, false, false, false],
    fixedFareEnabled: false,
    fixedFareAmount: '',
  };
}

export function nzNowParts(): { date: string; h: string; m: string } {
  const sv = new Date().toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
  return { date: sv.slice(0, 10), h: sv.slice(11, 13), m: sv.slice(14, 16) };
}

export function parseBookingDateTime(dt: string): { date: string; hour: string; min: string } {
  if (!dt.trim()) {
    const now = nzNowParts();
    return { date: now.date, hour: now.h, min: now.m };
  }
  const normalized = dt.includes('T') ? dt : dt.trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) {
    const sv = d.toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
    return { date: sv.slice(0, 10), hour: sv.slice(11, 13), min: sv.slice(14, 16) };
  }
  const now = nzNowParts();
  return {
    date: dt.slice(0, 10) || now.date,
    hour: dt.slice(11, 13) || now.h,
    min: dt.slice(14, 16) || now.m,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function buildBookingDateTime(form: CreateJobFormState): { bookingDateTime: string; dispatchBefore: number } {
  if (form.timing === 'later') {
    const bookingDateTime = `${form.laterDate} ${pad2(parseInt(form.laterHour, 10))}:${pad2(parseInt(form.laterMin, 10))}:00`;
    return { bookingDateTime, dispatchBefore: form.dispatchBeforeMin };
  }
  const now = nzNowParts();
  return {
    bookingDateTime: `${now.date} ${now.h}:${now.m}`,
    dispatchBefore: 0,
  };
}

function stopsPayload(stops: StopPoint[]): string {
  return stops
    .filter((s) => s.address)
    .map((s) => `${s.lat}@${s.lng}@${s.address}=`)
    .join('');
}

function bookingType(form: CreateJobFormState): string {
  if (form.paymentType === 'acc' || form.accClientId || form.serviceType === 'acc') return 'ACC Ride';
  if (form.paymentType === 'account' || form.accountId) return 'Account Ride';
  return 'Normal Ride';
}

function paymentExtras(form: CreateJobFormState): string {
  const bits: string[] = [];
  if (form.paymentType === 'cash') bits.push('Payment: Cash');
  if (form.paymentType === 'eftpos') {
    bits.push('Payment: EFTPOS');
    if (form.eftposRef) bits.push(`Ref: ${form.eftposRef}`);
    if (form.eftposSurcharge) bits.push('EFTPOS surcharge applied');
  }
  if (form.paymentType === 'card') bits.push('Payment: Card (Stripe)');
  if (form.notes) bits.push(form.notes);
  if (form.tmCardNumber) bits.push(`TM Card: ${form.tmCardNumber}`);
  if (form.tmCardExpiry) bits.push(`TM Expiry: ${form.tmCardExpiry}`);
  if (form.tmCouncilPercent) bits.push(`Council %: ${form.tmCouncilPercent}`);
  if (form.tmPassengerPercent) bits.push(`Passenger %: ${form.tmPassengerPercent}`);
  return bits.filter(Boolean).join(' | ');
}

export function buildInsertParams(form: CreateJobFormState, dispatcherName: string): DataParam[] {
  const { bookingDateTime, dispatchBefore } = buildBookingDateTime(form);
  const pickLatLng = form.pick.lat ? `${form.pick.lat},${form.pick.lng}` : '0,0';
  const dropLatLng = form.drop.lat ? `${form.drop.lat},${form.drop.lng}` : '0,0';

  const tariffId = form.fixedFareEnabled ? '-1' : form.tariffId;
  const tariffName = form.fixedFareEnabled ? 'Fixed' : form.tariffName;
  const customRate = form.fixedFareEnabled ? form.fixedFareAmount : '';

  let serviceType = form.serviceType;
  if (form.paymentType === 'tm') serviceType = 'tm';
  if (form.paymentType === 'acc') serviceType = 'acc';

  const receivePayment =
    form.paymentType === 'card' && form.cardPaid ? form.cardAmount : form.fixedFareEnabled ? form.fixedFareAmount : '';

  return [
    { name: 'Name', Value: form.name },
    { name: 'PassengerId', Value: form.phone },
    { name: 'Email', Value: form.showEmail ? form.email : '' },
    { name: 'Account_id', Value: form.accountId },
    { name: 'VId', Value: form.vehicleId || '0' },
    { name: 'DId', Value: String(form.driverId) },
    { name: 'PickLatLng', Value: pickLatLng },
    { name: 'DropLatLng', Value: dropLatLng },
    { name: 'PickLocation', Value: form.pick.address || form.pickInput },
    { name: 'DropLocation', Value: form.drop.address || form.dropInput },
    { name: 'VehicleType', Value: form.vehicleType === 'Any' ? 'Not Specified' : form.vehicleType },
    { name: 'PassengersNo', Value: '1' },
    { name: 'BagsNo', Value: '0' },
    { name: 'WheelChairsNo', Value: '0' },
    { name: 'VRequired', Value: '1' },
    { name: 'TarriffId', Value: tariffId },
    { name: 'TarriffName', Value: tariffName },
    { name: 'CustomeRate', Value: customRate },
    { name: 'Urgent', Value: form.urgent ? 'Yes' : 'No' },
    { name: 'FlightNo', Value: '' },
    { name: 'RoomNo', Value: '' },
    { name: 'EntitiesDetails', Value: paymentExtras(form) },
    { name: 'DateTime', Value: bookingDateTime },
    { name: 'DispatchMinutes', Value: '' },
    { name: 'Dispatchbefore', Value: String(dispatchBefore) },
    { name: 'Source', Value: 'Dispatch Console' },
    { name: 'serviceType', Value: serviceType },
    { name: 'Distance', Value: '0' },
    { name: 'Time', Value: '0' },
    { name: 'EstimatedCost', Value: customRate || form.cardAmount || '0' },
    { name: 'CornerAddress', Value: form.corner ? 'Corner pickup' : '' },
    { name: 'DispatcherName', value: dispatcherName },
    { name: 'nextstop', Value: String(form.stops.length) },
    { name: 'nextstopdata', Value: stopsPayload(form.stops) },
    { name: 'ZoneId', Value: '0' },
    { name: 'Acc_job_id', Value: form.accJobId },
    { name: 'po_id', Value: form.poNumber || form.accJobId },
    { name: 'Acc_claim_id', Value: form.claimNumber },
    { name: 'Acc_client_id', Value: form.accClientId },
    { name: 'Acc_manager_id', Value: form.accManagerId },
    { name: 'Acc_trip_status', Value: '' },
    { name: 'Bookingtype', Value: bookingType(form) },
    { name: 'quenumber', Value: String(form.queueNumber) },
    { name: 'Recieve_payment', Value: receivePayment },
    { name: 'PromoId', Value: '' },
  ];
}

export const DRIVER_AUTO = '0';
export const DRIVER_PENDING = '-2';
export const DRIVER_NOONE = '-1';

export function isAssignedDriverSelection(driverId: string): boolean {
  return (
    driverId !== DRIVER_AUTO &&
    driverId !== DRIVER_PENDING &&
    driverId !== DRIVER_NOONE &&
    driverId.trim() !== ''
  );
}

export function driverBookstatus(form: CreateJobFormState): { dId: string; bookstatus: string } {
  if (form.driverId === DRIVER_NOONE) return { dId: '-1', bookstatus: 'No One' };
  if (form.driverId === DRIVER_PENDING) return { dId: '0', bookstatus: 'Pending' };
  if (isAssignedDriverSelection(form.driverId)) return { dId: form.driverId, bookstatus: 'Offered' };
  return { dId: '0', bookstatus: 'Pending' };
}

/** Map a live job to the create/edit form driver dropdown value. */
export function formDriverIdFromJob(job: Job): string {
  if (job.status === 'No One' || job.driverId === '-1') return DRIVER_NOONE;
  const drv = String(job.driverId ?? '').trim();
  if (drv && isAssignedDriverSelection(drv)) return drv;
  if (job.status === 'Pending') return DRIVER_PENDING;
  const st = normalizeJobStatus(job.status);
  if (
    (st === 'Offered' ||
      st === 'Assigned' ||
      st === 'Picking' ||
      st === 'Arrived' ||
      st === 'Active' ||
      st === 'OnTrip' ||
      st === 'Queued') &&
    drv
  ) {
    return drv;
  }
  return DRIVER_AUTO;
}

/** Resolve assigned driver for edit dropdown — includes busy/non-available drivers. */
export function driverOptionFromJob(job: Job, drivers: Driver[]): Driver | null {
  const driverId = String(job.driverId ?? '').trim();
  if (!driverId || !isAssignedDriverSelection(driverId)) return null;
  return (
    drivers.find((d) => d.driverId === driverId) ?? {
      driverId,
      vehicleId: String(job.vehicleId || '0'),
      vehicleNo: String(job.vehicleNo || job.vehicleId || driverId),
      driverName: String(job.driverName || driverId),
      status: 'Busy',
    }
  );
}

/** Online drivers plus the job's current assignee (so edit `<select>` value matches an option). */
export function driversForAssignDropdown(
  availableDrivers: Driver[],
  allDrivers: Driver[],
  editingJob: Job | null,
): Driver[] {
  const byId = new Map<string, Driver>();
  if (editingJob) {
    const assigned = driverOptionFromJob(editingJob, allDrivers);
    if (assigned) byId.set(assigned.driverId, assigned);
  }
  for (const d of availableDrivers) byId.set(d.driverId, d);
  return Array.from(byId.values());
}

/** Assignment-only payload — same fields as card Assign / setPending / setNoOne. */
export function buildAssignmentChanges(form: CreateJobFormState): Record<string, unknown> {
  if (form.driverId === DRIVER_NOONE) {
    return {
      BookingStatus: 'No One',
      Status: 'No One',
      DriverId: -1,
      VehicleId: 0,
    };
  }
  if (form.driverId === DRIVER_PENDING || form.driverId === DRIVER_AUTO) {
    return {
      BookingStatus: 'Pending',
      Status: 'Pending',
      DriverId: 0,
      VehicleId: 0,
      releasedAt: null,
      manualOffer: false,
    };
  }
  return {
    BookingStatus: 'Offered',
    Status: 'Offered',
    DriverId: form.driverId,
    VehicleId: form.vehicleId || '0',
    manualOffer: true,
  };
}

export function driverAssignmentChanged(job: Job, form: CreateJobFormState): boolean {
  const orig = formDriverIdFromJob(job);
  if (form.driverId !== orig) return true;
  if (isAssignedDriverSelection(form.driverId)) {
    return String(form.vehicleId || '0') !== String(job.vehicleId || '0');
  }
  return false;
}

export function statusFromDriverId(driverId: string): 'Pending' | 'No One' | 'Offered' {
  if (driverId === DRIVER_NOONE) return 'No One';
  if (isAssignedDriverSelection(driverId)) return 'Offered';
  return 'Pending';
}

function parseNotesFromEntitiesDetails(raw?: string): string {
  if (!raw?.trim()) return '';
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(
      (s) =>
        s &&
        !/^Payment:/i.test(s) &&
        !/^Ref:/i.test(s) &&
        !/^TM Card:/i.test(s) &&
        !/^TM Expiry:/i.test(s) &&
        !/^Council %:/i.test(s) &&
        !/^Passenger %:/i.test(s) &&
        !/^EFTPOS surcharge/i.test(s)
    )
    .join(' | ')
    .trim();
}

function paymentLabelFromType(paymentType: PaymentType): string {
  if (paymentType === 'cash') return 'Cash';
  if (paymentType === 'card') return 'Card';
  if (paymentType === 'eftpos') return 'EFTPOS';
  if (paymentType === 'account') return 'Account';
  if (paymentType === 'tm') return 'TM';
  if (paymentType === 'acc') return 'ACC';
  return '';
}

export function buildJobChangesFromForm(
  form: CreateJobFormState,
  dispatcherName: string,
  opts?: { includeAssignment?: boolean; preserveAsapBookingTime?: string }
): Record<string, unknown> {
  const includeAssignment = opts?.includeAssignment !== false;
  let bookingDateTime: string;
  let dispatchBefore: number;
  if (form.timing === 'later') {
    ({ bookingDateTime, dispatchBefore } = buildBookingDateTime(form));
  } else if (opts?.preserveAsapBookingTime) {
    bookingDateTime = opts.preserveAsapBookingTime;
    dispatchBefore = 0;
  } else {
    ({ bookingDateTime, dispatchBefore } = buildBookingDateTime(form));
  }
  const pickLatLng = form.pick.lat ? `${form.pick.lat},${form.pick.lng}` : '0,0';
  const dropLatLng = form.drop.lat ? `${form.drop.lat},${form.drop.lng}` : '0,0';
  const pickAddr = form.pick.address || form.pickInput;
  const dropAddr = form.drop.address || form.dropInput;
  const tariffId = form.fixedFareEnabled ? '-1' : form.tariffId;
  const tariffName = form.fixedFareEnabled ? 'Fixed' : form.tariffName;
  const customRate = form.fixedFareEnabled ? form.fixedFareAmount : '';

  let serviceType = form.serviceType;
  if (form.paymentType === 'tm') serviceType = 'tm';
  if (form.paymentType === 'acc') serviceType = 'acc';

  const paymentMethod = paymentLabelFromType(form.paymentType);

  const changes: Record<string, unknown> = {
    PickAddress: pickAddr,
    PickLocation: pickAddr,
    DropAddress: dropAddr,
    DropLocation: dropAddr,
    PickLatLng: pickLatLng,
    DropLatLng: dropLatLng,
    Name: form.name,
    PhoneNo: form.phone,
    Notes: form.notes,
    EntitiesDetails: paymentExtras(form),
    serviceType,
    ServiceType: serviceType,
    BookingDateTime: bookingDateTime,
    Pickingtime: bookingDateTime,
    DispatchTimebefore: dispatchBefore,
    Dispatchbefore: String(dispatchBefore),
    Urgent: form.urgent ? 'Yes' : 'No',
    VehicleType: form.vehicleType === 'Any' ? 'Not Specified' : form.vehicleType,
    PaymentMethod: paymentMethod,
    PaymentType: paymentMethod,
    TarriffId: tariffId,
    TarriffName: tariffName,
    CustomeRate: customRate,
    EstimatedFare: customRate || form.cardAmount || '',
    CornerAddress: form.corner ? 'Corner pickup' : '',
    DispatcherName: dispatcherName,
    Acc_job_id: form.accJobId,
    Acc_claim_id: form.claimNumber,
    Acc_client_id: form.accClientId,
    Acc_manager_id: form.accManagerId,
    Account_id: form.accountId,
  };

  if (includeAssignment) {
    Object.assign(changes, buildAssignmentChanges(form));
  }

  return changes;
}

function normEditChangeValue(key: string, value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (key === 'BookingDateTime' || key === 'Pickingtime') {
    return s.replace('T', ' ').replace(/:\d{2}$/, '').slice(0, 16);
  }
  return s;
}

/** Only fields that differ from the current job — avoids overwriting unrelated server fields. */
export function buildJobEditChangesDelta(
  job: Job,
  form: CreateJobFormState,
  dispatcherName: string
): Record<string, unknown> {
  const prevForm = jobToForm(job);
  const preserveAsap =
    prevForm.timing === 'now' && form.timing === 'now' ? job.bookingDateTime : undefined;
  const next = buildJobChangesFromForm(form, dispatcherName, {
    includeAssignment: false,
    preserveAsapBookingTime: preserveAsap,
  });
  const prev = buildJobChangesFromForm(prevForm, dispatcherName, {
    includeAssignment: false,
    preserveAsapBookingTime: job.bookingDateTime,
  });
  const delta: Record<string, unknown> = {};
  for (const key of Object.keys(next)) {
    if (normEditChangeValue(key, next[key]) !== normEditChangeValue(key, prev[key])) {
      delta[key] = next[key];
    }
  }
  return delta;
}

export function jobToForm(job: Job): CreateJobFormState {
  const form = defaultCreateJobForm();
  const pick = parseLatLng(job.pickLatLng);
  const drop = parseLatLng(job.dropLatLng);
  const bookingDt =
    job.bookingDateTime ||
    (job.scheduledFor ? new Date(job.scheduledFor).toISOString().replace('T', ' ').slice(0, 16) : '');
  const parsed = parseBookingDateTime(bookingDt);
  const isLater =
    (job.dispatchBeforeMinutes ?? 0) > 0 ||
    isFutureBooking(bookingDt) ||
    (job.scheduledFor != null && job.scheduledFor > Date.now() + 60000);

  const driverId = formDriverIdFromJob(job);

  const payment = (job.paymentType || '').toLowerCase();
  let paymentType: CreateJobFormState['paymentType'] = '';
  if (payment.includes('card') || payment.includes('stripe')) paymentType = 'card';
  else if (payment.includes('cash')) paymentType = 'cash';
  else if (payment.includes('eftpos')) paymentType = 'eftpos';
  else if (payment.includes('account')) paymentType = 'account';
  else if (payment.includes('tm')) paymentType = 'tm';
  else if (payment.includes('acc')) paymentType = 'acc';

  const entitiesRaw = String(
    (job as Job & { entitiesDetails?: string }).entitiesDetails ??
      (job as Job & { EntitiesDetails?: string }).EntitiesDetails ??
      ''
  );
  const notes = job.notes?.trim() || parseNotesFromEntitiesDetails(entitiesRaw);

  const svc = String(job.serviceType || 'taxi').toLowerCase();
  const serviceType = CJ_SERVICES.includes(svc as (typeof CJ_SERVICES)[number]) ? svc : 'taxi';

  return {
    ...form,
    pick: { address: job.pickAddress || '', lat: pick?.lat ?? 0, lng: pick?.lng ?? 0 },
    pickInput: job.pickAddress || '',
    drop: { address: job.dropAddress || '', lat: drop?.lat ?? 0, lng: drop?.lng ?? 0 },
    dropInput: job.dropAddress || '',
    name: job.passengerName || '',
    phone: job.passengerPhone || '',
    notes,
    serviceType,
    timing: isLater ? 'later' : 'now',
    laterDate: parsed.date,
    laterHour: parsed.hour,
    laterMin: parsed.min,
    dispatchBeforeMin: job.dispatchBeforeMinutes ?? form.dispatchBeforeMin,
    urgent: !!job.urgent,
    corner: !!job.corner,
    vehicleType: job.vehicleType || 'Any',
    tariffId: job.tariffId || '0',
    driverId,
    vehicleId: job.vehicleId || '0',
    paymentType,
    claimNumber: job.acc?.claimNumber || '',
    poNumber: job.acc?.poNumber || '',
    accClientId: job.acc?.clientId || '',
    fixedFareEnabled: !!job.estimatedFare && job.tariffId === '-1',
    fixedFareAmount: job.estimatedFare || '',
  };
}

function isFutureBooking(dt: string): boolean {
  try {
    const d = new Date(dt.replace(' ', 'T'));
    return !Number.isNaN(d.getTime()) && d.getTime() > Date.now() + 60000;
  } catch {
    return false;
  }
}

export function buildUpdateParams(
  form: CreateJobFormState,
  bookingId: number,
  dispatcherName: string
): DataParam[] {
  const { dId, bookstatus } = driverBookstatus(form);
  const base = buildInsertParams(form, dispatcherName)
    .filter((p) => p.name !== 'ExternalJobId')
    .map((p) => (p.name === 'DId' ? { ...p, Value: dId } : p));
  return [{ name: 'Id', Value: String(bookingId) }, ...base, { name: 'bookstatus', Value: bookstatus }];
}

export function repeatBookingDates(form: CreateJobFormState): string[] {
  if (!form.repeatExpanded || !form.repeatUntil) return [];
  const startDate = form.timing === 'later' ? form.laterDate : nzNowParts().date;
  const start = new Date(startDate);
  const end = new Date(form.repeatUntil);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = (cur.getDay() + 6) % 7;
    if (form.repeatDays[dow]) out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
