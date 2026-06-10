export type JobStatus =
  | 'No One'
  | 'Pending'
  | 'Offered'
  | 'Assigned'
  | 'Picking'
  | 'Arrived'
  | 'Active'
  | 'OnTrip'
  | 'Queued'
  | 'Scheduled'
  | 'Completed'
  | 'Cancelled'
  | 'No Show';

export type ServiceType = 'taxi' | 'food' | 'freight' | 'tm' | 'acc' | 'rental';

export type BookingSource =
  | 'dispatch'
  | 'hail'
  | 'passenger'
  | 'web'
  | 'phone'
  | 'website';

export interface JobStop {
  address: string;
  lat: number;
  lng: number;
}

export interface TmDetails {
  cardNumber?: string;
  cardExpiry?: string;
  councilPercent?: number;
  capAmount?: number;
  hoistQty?: number;
  hoistUnitCost?: number;
  councilPays?: number;
  passengerPays?: number;
}

export interface AccDetails {
  claimNumber?: string;
  poNumber?: string;
  clientId?: string;
  clientName?: string;
  approvalId?: string;
}

export interface Job {
  id: number;
  companyId: string;
  status: JobStatus;
  source: BookingSource;
  serviceType: ServiceType;
  pickAddress: string;
  pickLatLng: string;
  dropAddress: string;
  dropLatLng: string;
  stops?: JobStop[];
  passengerName: string;
  passengerPhone: string;
  paymentType: string;
  estimatedFare: string;
  totalFare?: string;
  driverId?: string;
  vehicleId?: string;
  driverName?: string;
  vehicleNo?: string;
  bookingDateTime: string;
  scheduledFor?: number;
  dispatchBeforeMinutes?: number;
  notifyDispatchAt?: string;
  offeredAt?: number;
  originalStatus?: JobStatus;
  urgent?: boolean;
  corner?: boolean;
  notes?: string;
  accountId?: string;
  accountName?: string;
  tm?: TmDetails;
  acc?: AccDetails;
  tariffId?: string;
  passengers?: number;
  bags?: number;
  wheelchairs?: number;
  vehiclesRequired?: number;
  vehicleType?: string;
  queuedForDriverId?: string;
  updateSeq?: number;
  createdAt?: number;
  completedAt?: number;
  timeline?: JobTimelineEvent[];
}

export interface JobTimelineEvent {
  at: string;
  label: string;
  actor?: string;
}

export type JobTab = 'ua' | 'offer' | 'assign' | 'active' | 'queue' | 'dy';

export function parseLatLng(raw?: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  const p = raw.split(',');
  if (p.length !== 2) return null;
  const lat = parseFloat(p[0]);
  const lng = parseFloat(p[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function jobFromFirebase(key: string, rec: Record<string, unknown>, companyId: string): Job | null {
  const id = parseInt(String(rec.BookingId ?? rec.bookingId ?? key), 10);
  if (!id) return null;
  const status = String(rec.BookingStatus ?? rec.Status ?? rec.status ?? 'No One') as JobStatus;
  const src = String(rec.BookingSource ?? rec.source ?? rec.bookingSource ?? 'dispatch').toLowerCase();
  const svc = String(rec.serviceType ?? rec.ServiceType ?? 'taxi').toLowerCase() as ServiceType;
  return {
    id,
    companyId,
    status,
    source: (src === 'website' ? 'web' : src) as BookingSource,
    serviceType: svc,
    pickAddress: String(rec.PickAddress ?? rec.pickup ?? rec.pickupAddress ?? ''),
    pickLatLng: String(rec.PickLatLng ?? (rec.pickupLat != null ? `${rec.pickupLat},${rec.pickupLng}` : '')),
    dropAddress: String(rec.DropAddress ?? rec.dropoff ?? rec.dropAddress ?? ''),
    dropLatLng: String(rec.DropLatLng ?? (rec.dropLat != null ? `${rec.dropLat},${rec.dropLng}` : '')),
    passengerName: String(rec.Name ?? rec.passengerName ?? ''),
    passengerPhone: String(rec.PhoneNo ?? rec.passengerPhone ?? ''),
    paymentType: String(rec.PaymentMethod ?? rec.paymentType ?? 'Cash'),
    estimatedFare: String(rec.EstimatedFare ?? rec.Fare ?? rec.fare ?? ''),
    totalFare: rec.TotalFare != null ? String(rec.TotalFare) : undefined,
    driverId: rec.DriverId != null ? String(rec.DriverId) : rec.driverId != null ? String(rec.driverId) : undefined,
    vehicleId: rec.VehicleId != null ? String(rec.VehicleId) : rec.vehicleId != null ? String(rec.vehicleId) : undefined,
    vehicleNo: String(rec.VehicleNo ?? rec.CallSign ?? rec.vehicleId ?? ''),
    bookingDateTime: String(rec.BookingDateTime ?? rec.createdAt ?? new Date().toISOString()),
    scheduledFor: rec.ScheduledFor ? Number(rec.ScheduledFor) : undefined,
    dispatchBeforeMinutes: parseInt(String(rec.DispatchTimebefore ?? '0'), 10) || 0,
    notifyDispatchAt: rec.NotifyDispatchAt ? String(rec.NotifyDispatchAt) : undefined,
    offeredAt: rec.offeredAt ? Number(rec.offeredAt) : undefined,
    originalStatus: rec.originalStatus ? String(rec.originalStatus) as JobStatus : undefined,
    urgent: rec.Urgent === 'Yes' || rec.urgent === true,
    notes: String(rec.Notes ?? rec.notes ?? ''),
    accountId: rec.Account_id ? String(rec.Account_id) : undefined,
    accountName: rec.Account_Name ? String(rec.Account_Name) : undefined,
    tariffId: rec.TariffId ? String(rec.TariffId) : undefined,
    passengers: parseInt(String(rec.Passengers ?? '1'), 10) || 1,
    updateSeq: parseInt(String(rec.updateSeq ?? '0'), 10) || 0,
    createdAt: rec.createdAt ? Number(rec.createdAt) : undefined,
  };
}

export function jobTabForStatus(job: Job): JobTab {
  if (job.serviceType === 'food' || job.serviceType === 'freight') return 'dy';
  if (job.status === 'Queued') return 'queue';
  if (job.status === 'Active' || job.status === 'OnTrip') return 'active';
  if (job.status === 'Assigned' || job.status === 'Picking' || job.status === 'Arrived') return 'assign';
  if (job.status === 'Offered') return 'offer';
  return 'ua';
}
