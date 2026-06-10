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

  return (
    <div className="flex flex-col h-full bw-panel overflow-hidden">
      <div className="flex border-b border-bw-border text-[10px] shrink-0">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            className={cn('flex-1 py-1.5 uppercase font-bold', statusFilter === t.id ? 'text-bw-primary border-b-2 border-bw-primary' : 'text-bw-muted')}
            onClick={() => setStatusFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 p-1 shrink-0 flex-wrap">
        {SVC_FILTERS.map((f) => (
          <button
            key={f}
            className={cn('px-2 py-0.5 rounded text-[10px] font-bold', serviceFilter === f ? 'bg-bw-primary text-white' : 'bg-bw-card text-bw-muted')}
            onClick={() => setServiceFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed text-[9px] leading-tight">
          <thead className="sticky top-0 bg-bw-surface text-[8px] text-bw-muted uppercase">
            <tr>
              <th className="text-left p-0.5 w-[11%]">Zone</th>
              <th className="text-left p-0.5 w-[14%]">Driver</th>
              <th className="text-left p-0.5 w-[8%]">Svc</th>
              <th className="text-left p-0.5 w-[10%]">Status</th>
              <th className="p-0.5 w-[6%]">Jobs</th>
              <th className="text-left p-0.5 w-[10%]">Pax</th>
              <th className="text-left p-0.5 w-[11%]">Phone</th>
              <th className="text-left p-0.5 w-[15%]">Pickup</th>
              <th className="text-left p-0.5 w-[15%]">Drop</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers().map((d) => (
              <DriverRow key={d.vehicleId} driver={d} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
