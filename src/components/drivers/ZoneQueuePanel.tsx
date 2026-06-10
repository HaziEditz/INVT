import { useDriverQueue } from '@/hooks/useDrivers';
import { statusColor } from '@/types/driver';
import { cn } from '@/lib/utils';

interface ZoneQueuePanelProps {
  companyId: string;
}

export function ZoneQueuePanel({ companyId }: ZoneQueuePanelProps) {
  const queueByZone = useDriverQueue(companyId);

  return (
    <div className="border-t border-[#2d3148] h-[180px] shrink-0 overflow-y-auto p-2.5 bg-[#1a1d2e] text-[#e8eaf0]">
      <div className="text-[10px] font-bold text-[#8892a4] uppercase mb-2 tracking-wider">Zone Queue</div>
      {Object.keys(queueByZone).length === 0 ? (
        <p className="text-xs text-[#8892a4]">No zone data</p>
      ) : (
        Object.entries(queueByZone).map(([zone, drivers]) => (
          <div key={zone} className="mb-3">
            <div className="text-xs font-bold text-[#5b7cfa] mb-1.5 uppercase tracking-wide border-b border-[#2d3148]/50 pb-0.5">
              {zone}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {drivers.map((d, i) => (
                <span
                  key={d.driverId}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium',
                    'bg-[#1e2235]/80 shadow-sm'
                  )}
                  style={{ borderColor: statusColor(d.status as never), color: statusColor(d.status as never) }}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
                      i === 0 ? 'bg-[#f5c542] text-[#1a1a2e]' : 'bg-[#1a1d2e] border border-[#2d3148] text-[#8892a4]'
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="font-mono">{d.vehicleNo}</span>
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
