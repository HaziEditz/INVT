import type { Job } from '@/types/job';

/** String fields that must not be overwritten by empty Firebase partial updates. */
const PRESERVE_IF_EMPTY: (keyof Job)[] = [
  'pickAddress',
  'dropAddress',
  'pickLatLng',
  'dropLatLng',
  'passengerName',
  'passengerPhone',
  'estimatedFare',
  'dispatcherName',
];

/** Merge an incoming job patch into an existing record without wiping known-good fields. */
export function mergeJobUpdate(existing: Job, incoming: Partial<Job>): Job {
  const merged: Job = { ...existing, ...incoming };
  for (const key of PRESERVE_IF_EMPTY) {
    const nextVal = incoming[key];
    const prevVal = existing[key];
    if (typeof nextVal === 'string' && !nextVal.trim() && typeof prevVal === 'string' && prevVal.trim()) {
      (merged as Record<string, unknown>)[key] = prevVal;
    }
  }
  if (incoming.createdAt == null && existing.createdAt != null) {
    merged.createdAt = existing.createdAt;
  }
  return merged;
}
