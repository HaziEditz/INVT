import { useDriverQueue } from '@/hooks/useDrivers';
import { isZoneQueueInactive, statusColor } from '@/types/driver';
import { cn } from '@/lib/utils';

interface ZoneQueuePanelProps {
  companyId: string;
}

function InactiveChip({ vehicleNo, status }: { vehicleNo: string; status: string }) {
  const busy = isZoneQueueInactive(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium',
        'bg-[color-mix(in_srgb,var(--bw-card)_80%,transparent)] shadow-sm',
        busy && 'border-red-500/70 text-red-400',
      )}
      style={busy ? undefined : { borderColor: statusColor(status as never), color: statusColor(status as never) }}
    >
      <span className="text-[9px] bw-muted uppercase tracking-wide shrink-0">{status}</span>
      <span className="font-mono">{vehicleNo}</span>
    </span>
  );
}

export function ZoneQueuePanel({ companyId }: ZoneQueuePanelProps) {
  const { queueByZone, configuredZones } = useDriverQueue(companyId);
  const zoneNames = configuredZones.length
    ? configuredZones.map((z) => z.name)
    : Object.keys(queueByZone);

  return (
    <div className="border-t bw-border h-[180px] shrink-0 overflow-y-auto p-2.5 bw-surface">
      <div className="text-[10px] font-bold bw-muted uppercase mb-2 tracking-wider">Zone Queue</div>
      {zoneNames.length === 0 ? (
        <p className="text-xs bw-muted">
          No zones configured — add zones in the Owner Panel for this company.
        </p>
      ) : (
        zoneNames.map((zone) => {
          const { ranked, inactive } = queueByZone[zone] ?? { ranked: [], inactive: [] };
          const hasAnyone = ranked.length > 0 || inactive.length > 0;
          return (
            <div key={zone} className="mb-3">
              <div className="text-xs font-bold bw-accent mb-1.5 uppercase tracking-wide border-b border-[color-mix(in_srgb,var(--bw-border)_50%,transparent)] pb-0.5">
                {zone}
              </div>
              {!hasAnyone ? (
                <p className="text-[10px] bw-muted italic px-1">No drivers in queue</p>
              ) : (
                <>
                  {ranked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {ranked.map((d, i) => (
                        <span
                          key={`${d.driverId}-${d.vehicleNo}`}
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium',
                            'bg-[color-mix(in_srgb,var(--bw-card)_80%,transparent)] shadow-sm',
                          )}
                          style={{
                            borderColor: statusColor(d.status as never),
                            color: statusColor(d.status as never),
                          }}
                        >
                          <span
                            className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
                              i === 0 ? 'bg-[#f5c542] text-[#1a1a2e]' : 'bw-surface border bw-border bw-muted',
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="font-mono">{d.vehicleNo}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {inactive.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {inactive.map((d) => (
                        <InactiveChip
                          key={`${d.driverId}-${d.vehicleNo}-inactive`}
                          vehicleNo={d.vehicleNo}
                          status={d.status}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
