import { getDb, ref, set, update } from '@/lib/firebase';
import type { Job } from '@/types/job';
import type { Driver } from '@/types/driver';

export type NotificationType =
  | 'job_offer'
  | 'job_removed'
  | 'job_cancelled'
  | 'job_updated';

export interface JobOfferPayload {
  type: NotificationType;
  bookingid: string;
  content: string;
  joboffer: string;
  jobpickup: string;
  jobdropoff: string;
  JobphoneNo: string;
  jobname: string;
  jobFare: string;
  jobServiceType: string;
  jobBookingSrc: string;
  vehicleId: string;
  companyId: string;
  bookingId: number;
  originalStatus: string;
  expiresAt: number;
  updatedAt: number;
}

export async function writeJobOffer(driver: Driver, job: Job, companyId: string) {
  const db = getDb();
  const did = driver.driverId;
  const bid = job.id;
  const payload: JobOfferPayload = {
    type: 'job_offer',
    bookingid: `${bid},Offered,${did},Dispatch,AutoDispatch`,
    content: 'You have offered new Job please view details',
    joboffer: String(bid),
    jobpickup: job.pickAddress,
    jobdropoff: job.dropAddress,
    JobphoneNo: job.passengerPhone,
    jobname: job.passengerName,
    jobFare: job.estimatedFare,
    jobServiceType: job.serviceType,
    jobBookingSrc: job.source,
    vehicleId: driver.vehicleId,
    companyId,
    bookingId: bid,
    originalStatus: 'pending',
    expiresAt: Date.now() + 30000,
    updatedAt: Date.now(),
  };
  await set(ref(db, `notification/${did}`), payload);
  await update(ref(db, `pendingjobs/${companyId}/${bid}`), {
    BookingId: String(bid),
    Status: 'Offered',
    BookingStatus: 'Offered',
    DriverId: did,
    offeredAt: Date.now(),
    PickAddress: job.pickAddress,
    DropAddress: job.dropAddress,
  });
}

export async function clearDriverOffer(driverId: string, type: NotificationType = 'job_removed') {
  const db = getDb();
  await set(ref(db, `notification/${driverId}`), {
    type,
    content: 'Offer cleared',
    updatedAt: Date.now(),
  });
}

export async function updateDriverStatus(
  companyId: string,
  vehicleId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  const db = getDb();
  await update(ref(db, `online/${companyId}/${vehicleId}`), {
    vehiclestatus: status,
    ...extra,
  });
}

export async function writeActiveDispatcher(
  companyId: string,
  sessionId: string,
  data: Record<string, unknown>
) {
  const db = getDb();
  await set(ref(db, `activeDispatchers/${companyId}/${sessionId}`), {
    ...data,
    lastSeen: Date.now(),
  });
}
