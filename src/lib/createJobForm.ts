import type { DataParam } from '@/lib/dispatchApi';

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
  notes: string;
  serviceType: string;
  timing: 'now' | 'later';
  laterDate: string;
  laterHour: string;
  laterMin: string;
  dispatchBeforeMin: number;
  corner: boolean;
  cornerDetail: string;
  urgent: boolean;
  passengers: number;
  bags: number;
  wheelchairs: number;
  carsRequired: number;
  vehicleType: string;
  tariffId: string;
  tariffName: string;
  customRate: string;
  driverId: number;
  vehicleId: string;
  queueNumber: number;
  accountId: string;
  claimNumber: string;
  poNumber: string;
  accJobId: string;
  accClientId: string;
  accManagerId: string;
  repeatEnabled: boolean;
  repeatUntil: string;
  repeatWeeks: 0 | 1 | 2;
  repeatDays: boolean[];
  tmCardNumber: string;
  tmCardExpiry: string;
  tmCouncilPercent: string;
  cardAmount: string;
  cardPaid: boolean;
}

const VEHICLE_TYPES = ['Automatic', 'Sedan', 'SUV', 'Van', 'Wheelchair', 'WAV', 'Car'];

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
    notes: '',
    serviceType: 'taxi',
    timing: 'now',
    laterDate: date,
    laterHour: '12',
    laterMin: '00',
    dispatchBeforeMin: 10,
    corner: false,
    cornerDetail: '',
    urgent: false,
    passengers: 1,
    bags: 0,
    wheelchairs: 0,
    carsRequired: 1,
    vehicleType: 'Automatic',
    tariffId: '0',
    tariffName: 'Automatic',
    customRate: '',
    driverId: 0,
    vehicleId: '0',
    queueNumber: 0,
    accountId: '',
    claimNumber: '',
    poNumber: '',
    accJobId: '',
    accClientId: '',
    accManagerId: '',
    repeatEnabled: false,
    repeatUntil: '',
    repeatWeeks: 0,
    repeatDays: [false, false, false, false, false, false, false],
    tmCardNumber: '',
    tmCardExpiry: '',
    tmCouncilPercent: '',
    cardAmount: '',
    cardPaid: false,
  };
}

export function nzNowParts(): { date: string; h: string; m: string } {
  const sv = new Date().toLocaleString('sv', { timeZone: 'Pacific/Auckland' });
  return { date: sv.slice(0, 10), h: sv.slice(11, 13), m: sv.slice(14, 16) };
}

export { VEHICLE_TYPES };

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
  if (form.accJobId || form.accClientId) return 'ACC Ride';
  if (form.accountId) return 'Account Ride';
  return 'Normal Ride';
}

function urgentValue(form: CreateJobFormState): string {
  return form.urgent ? 'Yes' : 'No';
}

function tmExtras(form: CreateJobFormState): string {
  if (form.serviceType !== 'tm') return form.notes;
  const bits = [
    form.notes,
    form.tmCardNumber ? `TM Card: ${form.tmCardNumber}` : '',
    form.tmCardExpiry ? `Expiry: ${form.tmCardExpiry}` : '',
    form.tmCouncilPercent ? `Council %: ${form.tmCouncilPercent}` : '',
  ].filter(Boolean);
  return bits.join(' | ');
}

export function buildInsertParams(
  form: CreateJobFormState,
  dispatcherName: string
): DataParam[] {
  const { bookingDateTime, dispatchBefore } = buildBookingDateTime(form);
  const pickLatLng = form.pick.lat ? `${form.pick.lat},${form.pick.lng}` : '0,0';
  const dropLatLng = form.drop.lat ? `${form.drop.lat},${form.drop.lng}` : '0,0';

  return [
    { name: 'Name', Value: form.name },
    { name: 'PassengerId', Value: form.phone },
    { name: 'Email', Value: form.email },
    { name: 'Account_id', Value: form.accountId },
    { name: 'VId', Value: form.vehicleId || '0' },
    { name: 'DId', Value: String(form.driverId) },
    { name: 'PickLatLng', Value: pickLatLng },
    { name: 'DropLatLng', Value: dropLatLng },
    { name: 'PickLocation', Value: form.pick.address || form.pickInput },
    { name: 'DropLocation', Value: form.drop.address || form.dropInput },
    { name: 'VehicleType', Value: form.vehicleType },
    { name: 'PassengersNo', Value: String(form.passengers) },
    { name: 'BagsNo', Value: String(form.bags) },
    { name: 'WheelChairsNo', Value: String(form.wheelchairs) },
    { name: 'VRequired', Value: String(form.carsRequired) },
    { name: 'TarriffId', Value: form.tariffId },
    { name: 'TarriffName', Value: form.tariffName },
    { name: 'CustomeRate', Value: form.customRate },
    { name: 'Urgent', Value: urgentValue(form) },
    { name: 'FlightNo', Value: '' },
    { name: 'RoomNo', Value: '' },
    { name: 'EntitiesDetails', Value: tmExtras(form) },
    { name: 'DateTime', Value: bookingDateTime },
    { name: 'DispatchMinutes', Value: '' },
    { name: 'Dispatchbefore', Value: String(dispatchBefore) },
    { name: 'Source', Value: 'Dispatch Console' },
    { name: 'serviceType', Value: form.serviceType },
    { name: 'Distance', Value: '0' },
    { name: 'Time', Value: '0' },
    { name: 'EstimatedCost', Value: form.customRate || '0' },
    { name: 'CornerAddress', Value: form.corner ? form.cornerDetail : '' },
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
    { name: 'Recieve_payment', Value: form.cardPaid ? form.cardAmount : '' },
    { name: 'PromoId', Value: '' },
  ];
}

/** Dates for repeat bookings (selected weekdays until repeatUntil) */
export function repeatBookingDates(form: CreateJobFormState): string[] {
  if (!form.repeatEnabled || !form.repeatUntil) return [];
  const startDate = form.timing === 'later' ? form.laterDate : nzNowParts().date;
  const start = new Date(startDate);
  const end = new Date(form.repeatUntil);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = (cur.getDay() + 6) % 7; // Mon=0
    const weekNum = Math.ceil(cur.getDate() / 7);
    const weekOk =
      form.repeatWeeks === 0 ||
      (form.repeatWeeks === 1 && weekNum % 2 === 1) ||
      (form.repeatWeeks === 2 && weekNum % 2 === 0);
    if (form.repeatDays[dow] && weekOk) {
      out.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
