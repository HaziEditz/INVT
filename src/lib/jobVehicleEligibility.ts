import type { Driver } from '@/types/driver';

import type { Job, ServiceType } from '@/types/job';



const OPEN_VEHICLE_TYPES = new Set(['', 'any', 'all', 'not specified']);



function normalizeCategory(raw?: string): string | null {

  const s = String(raw ?? '').trim().toLowerCase();

  if (!s || OPEN_VEHICLE_TYPES.has(s)) return null;

  if (s.includes('van') || s.includes('minibus')) return 'van';

  if (s.includes('wav') || s.includes('wheelchair')) return 'wav';

  if (s.includes('car') || s.includes('sedan') || s.includes('suv') || s.includes('saloon')) return 'car';

  return s;

}



function normalizeJobServiceType(raw?: string): 'taxi' | 'food' | 'freight' | 'tm' {

  const s = String(raw ?? 'taxi').toLowerCase();

  if (s.includes('food') || s === 'restaurant') return 'food';

  if (s.includes('freight') || s === 'delivery') return 'freight';

  if (s === 'tm') return 'tm';

  return 'taxi';

}



function serviceTypeToDriverLabel(svc: ReturnType<typeof normalizeJobServiceType>): string {

  const map: Record<string, string> = {

    taxi: 'Taxi',

    food: 'Food',

    freight: 'Freight',

    tm: 'TM',

  };

  return map[svc] || 'Taxi';

}



export function driverMeetsJobServiceType(

  job: Pick<Job, 'serviceType'>,

  driver: Pick<Driver, 'services'>,

): boolean {

  const svc = normalizeJobServiceType(job.serviceType);

  const allowed = driver.services?.length ? driver.services : ['Taxi'];

  const need = serviceTypeToDriverLabel(svc);

  return allowed.some((s) => s.toLowerCase() === need.toLowerCase());

}



export function jobVehicleRequirement(job: Pick<Job, 'vehicleType'>): string | null {

  return normalizeCategory(job.vehicleType);

}



export function driverMeetsJobVehicleType(

  job: Pick<Job, 'vehicleType'>,

  driver: Pick<Driver, 'vehicleType'>,

): boolean {

  const req = normalizeCategory(job.vehicleType);

  if (!req) return true;

  const drv = normalizeCategory(driver.vehicleType);

  if (!drv) return false;

  if (req === drv) return true;

  const reqExact = String(job.vehicleType ?? '').trim().toLowerCase();

  const drvExact = String(driver.vehicleType ?? '').trim().toLowerCase();

  return !!reqExact && reqExact === drvExact;

}



export function driverMeetsJobPassengers(

  job: Pick<Job, 'passengers'>,

  driver: Pick<Driver, 'seatCapacity'>,

): boolean {

  const req = Math.max(1, job.passengers ?? 1);

  const cap = driver.seatCapacity ?? 4;

  return cap >= req;

}



export function driverEligibleForJob(

  job: Pick<Job, 'vehicleType' | 'passengers' | 'serviceType'>,

  driver: Driver,

): boolean {

  return (

    driverMeetsJobServiceType(job, driver) &&

    driverMeetsJobVehicleType(job, driver) &&

    driverMeetsJobPassengers(job, driver)

  );

}



/** Filter drivers for manual assign dropdowns (card + create/edit job). */

export function filterDriversForJob(

  drivers: Driver[],

  job: Pick<Job, 'vehicleType' | 'passengers' | 'serviceType'>,

): Driver[] {

  return drivers.filter((d) => driverEligibleForJob(job, d));

}



/** Requirements from create-job form before a Job record exists. */

export function filterDriversForRequirements(

  drivers: Driver[],

  req: { vehicleType?: string; passengers?: number; serviceType?: ServiceType | string },

): Driver[] {

  const job = {

    vehicleType: req.vehicleType === 'Any' ? undefined : req.vehicleType,

    passengers: req.passengers ?? 1,

    serviceType: (req.serviceType ?? 'taxi') as ServiceType,

  };

  return filterDriversForJob(drivers, job);

}


