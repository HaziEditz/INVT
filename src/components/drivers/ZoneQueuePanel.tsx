import { useDriverQueue } from '@/hooks/useDrivers';
import { statusColor } from '@/types/driver';

interface ZoneQueuePanelProps {
  companyId: string;
}

export function ZoneQueuePanel({ companyId }: ZoneQueuePanelProps) {
  const queueByZone = useDriverQueue(companyId);

  return (
    <div className="bw-panel border-t border-bw-border h-[180px] shrink-0 overflow-y-auto p-2">
      <div className="text-[10px] font-bold text-bw-muted uppercase mb-2">Zone Queue</div>
      {Object.keys(queueByZone).length === 0 ? (
        <p className="text-xs text-bw-muted">No zone data</p>
      ) : (
        Object.entries(queueByZone).map(([zone, drivers]) => (
          <div key={zone} className="mb-2">
            <div className="text-xs font-semibold text-bw-text mb-1">{zone}</div>
            <div className="flex flex-wrap gap-1">
              {drivers.map((d, i) => (
                <span
                  key={d.driverId}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-bw-border font-mono"
                  style={{ borderColor: statusColor(d.status as never), color: statusColor(d.status as never) }}
                >
                  {i === 0 ? '★1' : `#${i + 1}`} {d.vehicleNo}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
