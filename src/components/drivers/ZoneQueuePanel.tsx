import { useMemo, useState } from 'react';
import { useDriverQueue, type ZoneQueueDriver } from '@/hooks/useDrivers';
import { zoneQueueVehicleColorClass } from '@/types/driver';
import { cn } from '@/lib/utils';

interface ZoneQueuePanelProps {
  companyId: string;
}

function sortZoneDrivers(drivers: ZoneQueueDriver[]): ZoneQueueDriver[] {
  return [...drivers].sort((a, b) => {
    const aAvail = a.status === 'Available' ? 0 : 1;
    const bAvail = b.status === 'Available' ? 0 : 1;
    if (aAvail !== bAvail) return aAvail - bAvail;
    return a.vehicleNo.localeCompare(b.vehicleNo, undefined, { numeric: true });
  });
}

export function ZoneQueuePanel({ companyId }: ZoneQueuePanelProps) {
  const { queueByZone, configuredZones } = useDriverQueue(companyId);
  const [vehicleQuery, setVehicleQuery] = useState('');

  const zoneNames = configuredZones.length
    ? configuredZones.map((z) => z.name)
    : Object.keys(queueByZone);

  const q = vehicleQuery.trim().toLowerCase();

  const rows = useMemo(() => {
    return zoneNames.map((zone) => {
      const { ranked, inactive } = queueByZone[zone] ?? { ranked: [], inactive: [] };
      const drivers = sortZoneDrivers([...ranked, ...inactive]);
      const visible =
        !q || drivers.some((d) => d.vehicleNo.toLowerCase().includes(q));
      return { zone, drivers, visible };
    });
  }, [zoneNames, queueByZone, q]);

  const visibleRows = q ? rows.filter((r) => r.visible) : rows;

  return (
    <div className="border-t bw-border shrink-0 bw-surface flex flex-col max-h-[240px]">
      <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-2 shrink-0">
        <div className="text-[10px] font-bold bw-muted uppercase tracking-wider shrink-0">Zone Queue</div>
        <input
          value={vehicleQuery}
          onChange={(e) => setVehicleQuery(e.target.value)}
          placeholder="Cab / vehicle #"
          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded bg-bw-bg border border-bw-border"
        />
        {vehicleQuery ? (
          <button
            type="button"
            className="text-[10px] text-[var(--bw-accent)] font-semibold shrink-0 hover:underline"
            onClick={() => setVehicleQuery('')}
          >
            All zones
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-1">
        {zoneNames.length === 0 ? (
          <p className="text-xs bw-muted py-2">
            No zones configured — add zones in the Owner Panel for this company.
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="text-xs bw-muted py-4 text-center italic">No zones match that vehicle</p>
        ) : (
          <div className="space-y-0.5">
            {visibleRows.map(({ zone, drivers }) => (
              <div
                key={zone}
                className="flex items-center gap-2 py-1 border-b border-bw-border/40 last:border-0 min-h-[26px]"
              >
                <div
                  className="w-[28%] min-w-[72px] max-w-[120px] text-[11px] font-bold bw-accent truncate shrink-0"
                  title={zone}
                >
                  {zone}
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                  {drivers.length === 0 ? (
                    <span className="text-[11px] bw-muted">—</span>
                  ) : (
                    drivers.map((d) => {
                      const match = q && d.vehicleNo.toLowerCase().includes(q);
                      return (
                        <span
                          key={`${d.driverId}-${d.vehicleNo}`}
                          className={cn(
                            'font-mono text-[11px] font-semibold tabular-nums',
                            zoneQueueVehicleColorClass(d.status),
                            match && 'underline decoration-2 underline-offset-2',
                          )}
                          title={d.status}
                        >
                          {d.vehicleNo}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-2.5 py-1.5 border-t bw-border/60 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] bw-muted shrink-0">
        <span>
          <span className="text-emerald-400 font-mono font-bold">■</span> Available
        </span>
        <span>
          <span className="text-red-400 font-mono font-bold">■</span> Busy
        </span>
        <span>
          <span className="text-amber-400 font-mono font-bold">■</span> Away
        </span>
      </div>
    </div>
  );
}
