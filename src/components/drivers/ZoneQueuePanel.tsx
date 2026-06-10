import { useDriverQueue } from '@/hooks/useDrivers';
import { statusColor } from '@/types/driver';
import { cn } from '@/lib/utils';

interface ZoneQueuePanelProps {
  companyId: string;
}

export function ZoneQueuePanel({ companyId }: ZoneQueuePanelProps) {
  const queueByZone = useDriverQueue(companyId);

  return (
    <div className="bw-panel border-t border-bw-border h-[180px] shrink-0 overflow-y-auto p-2.5 bg-bw-surface/50">
      <div className="text-[10px] font-bold text-bw-muted uppercase mb-2 tracking-wider">Zone Queue</div>
      {Object.keys(queueByZone).length === 0 ? (
        <p className="text-xs text-bw-muted">No zone data</p>
      ) : (
        Object.entries(queueByZone).map(([zone, drivers]) => (
          <div key={zone} className="mb-3">
            <div className="text-xs font-bold text-bw-primary mb-1.5 uppercase tracking-wide border-b border-bw-border/50 pb-0.5">
              {zone}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {drivers.map((d, i) => (
                <span
                  key={d.driverId}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium',
                    'bg-bw-card/80 shadow-sm'
                  )}
                  style={{ borderColor: statusColor(d.status as never), color: statusColor(d.status as never) }}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
                      i === 0 ? 'bg-bw-gold text-[#1a1a2e]' : 'bg-bw-surface border border-bw-border text-bw-muted'
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
