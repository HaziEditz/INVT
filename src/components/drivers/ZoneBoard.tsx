import { useDriverStore } from '@/store/driverStore';
import { DriverRow } from './DriverRow';
import { cn } from '@/lib/utils';
import type { DriverStatus } from '@/types/driver';

const STATUS_TABS: { id: DriverStatus | 'All' | 'Suspended'; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Picking', label: 'Picking' },
  { id: 'Active', label: 'Active' },
  { id: 'Away', label: 'Away' },
  { id: 'Suspended', label: 'Suspended' },
];

const SVC_FILTERS = ['All', 'Taxi', 'Food', 'Freight', 'TM'];

export function ZoneBoard() {
  const statusFilter = useDriverStore((s) => s.statusFilter);
  const serviceFilter = useDriverStore((s) => s.serviceFilter);
  const setStatusFilter = useDriverStore((s) => s.setStatusFilter);
  const setServiceFilter = useDriverStore((s) => s.setServiceFilter);
  const filteredDrivers = useDriverStore((s) => s.filteredDrivers);
  const drivers = filteredDrivers();

  return (
    <div className="flex flex-col h-full bw-panel overflow-hidden border-0">
      <div className="flex border-b border-bw-border text-[10px] shrink-0 bg-bw-surface">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            className={cn(
              'flex-1 py-2 uppercase font-bold tracking-wide transition-colors',
              statusFilter === t.id ? 'text-bw-primary border-b-2 border-bw-primary bg-bw-primary/5' : 'text-bw-muted hover:text-bw-text'
            )}
            onClick={() => setStatusFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 p-1.5 shrink-0 flex-wrap border-b border-bw-border/50">
        {SVC_FILTERS.map((f) => (
          <button
            key={f}
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold transition',
              serviceFilter === f ? 'bg-bw-primary text-white shadow-sm' : 'bg-bw-card text-bw-muted hover:text-bw-text border border-bw-border'
            )}
            onClick={() => setServiceFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed text-[9px] leading-tight">
          <thead className="sticky top-0 bg-bw-surface/95 backdrop-blur-sm text-[8px] text-bw-muted uppercase border-b border-bw-border z-10">
            <tr>
              <th className="text-left p-1 w-[11%] font-bold">Zone</th>
              <th className="text-left p-1 w-[14%] font-bold">Driver</th>
              <th className="text-left p-1 w-[8%] font-bold">Svc</th>
              <th className="text-left p-1 w-[10%] font-bold">Status</th>
              <th className="p-1 w-[6%] font-bold">Jobs</th>
              <th className="text-left p-1 w-[10%] font-bold">Pax</th>
              <th className="text-left p-1 w-[11%] font-bold">Phone</th>
              <th className="text-left p-1 w-[15%] font-bold">Pickup</th>
              <th className="text-left p-1 w-[15%] font-bold">Drop</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <DriverRow key={d.vehicleId} driver={d} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
