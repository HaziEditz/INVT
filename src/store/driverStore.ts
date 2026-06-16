import { create } from 'zustand';
import type { Driver, DriverStatus } from '@/types/driver';

interface DriverStore {
  drivers: Driver[];
  serviceFilter: string;
  statusFilter: DriverStatus | 'All' | 'Suspended';
  selectedDriverId: string | null;
  setDrivers: (drivers: Driver[]) => void;
  setServiceFilter: (f: string) => void;
  setStatusFilter: (f: DriverStatus | 'All' | 'Suspended') => void;
  setSelectedDriverId: (id: string | null) => void;
  filteredDrivers: () => Driver[];
  counts: () => { all: number; free: number; picking: number; busy: number; away: number };
}

export function filterDrivers(
  drivers: Driver[],
  serviceFilter: string,
  statusFilter: DriverStatus | 'All' | 'Suspended',
): Driver[] {
  return drivers.filter((d) => {
    if (statusFilter !== 'All' && statusFilter !== 'Suspended') {
      const st = d.status === 'OnTrip' ? 'Active' : d.status;
      const filter = statusFilter === 'Active' ? ['Active', 'OnTrip', 'Busy'] : [statusFilter];
      if (!filter.includes(st)) return false;
    }
    if (statusFilter === 'Suspended' && d.status !== 'Suspended') return false;
    if (serviceFilter !== 'All') {
      const svcs = d.services || ['Taxi'];
      if (!svcs.some((s) => s.toLowerCase() === serviceFilter.toLowerCase())) return false;
    }
    return true;
  });
}

/** Zustand selector — must read `drivers` from state so the list re-renders on Firebase updates. */
export function selectFilteredDrivers(state: DriverStore): Driver[] {
  return filterDrivers(state.drivers, state.serviceFilter, state.statusFilter);
}

export function selectDriverCounts(state: DriverStore) {
  const ds = state.drivers;
  return {
    all: ds.length,
    free: ds.filter((d) => d.status === 'Available').length,
    picking: ds.filter((d) => d.status === 'Picking').length,
    busy: ds.filter((d) => ['Busy', 'Active', 'OnTrip', 'Assigned', 'Arrived'].includes(d.status)).length,
    away: ds.filter((d) => d.status === 'Away').length,
  };
}

export const useDriverStore = create<DriverStore>((set, get) => ({
  drivers: [],
  serviceFilter: 'All',
  statusFilter: 'All',
  selectedDriverId: null,
  setDrivers: (drivers) => set({ drivers }),
  setServiceFilter: (f) => set({ serviceFilter: f }),
  setStatusFilter: (f) => set({ statusFilter: f }),
  setSelectedDriverId: (id) => set({ selectedDriverId: id }),
  filteredDrivers: () => filterDrivers(get().drivers, get().serviceFilter, get().statusFilter),
  counts: () => selectDriverCounts(get()),
}));
