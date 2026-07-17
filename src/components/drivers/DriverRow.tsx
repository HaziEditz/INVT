import { useEffect, useState } from 'react';
import { type Driver } from '@/types/driver';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import {
  DRIVER_CONNECTIVITY_STALE_HEX,
  driverPresenceColorHex,
  formatLastSeenAge,
  isDriverConnectivityStale,
  lastSeenAgeMs,
} from '@/lib/driverConnectivity';

interface DriverRowProps {
  driver: Driver;
  index: number;
}

export function DriverRow({ driver, index }: DriverRowProps) {
  const openModalWith = useUiStore((s) => s.openModalWith);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const stale = isDriverConnectivityStale(driver.lastSeen, now);
  const color = driverPresenceColorHex(driver.status, driver.lastSeen, now);
  const isAvailable = driver.status === 'Available';
  const age = lastSeenAgeMs(driver.lastSeen, now);
  const staleLabel = stale && age != null ? `Last seen ${formatLastSeenAge(age)} ago` : null;

  return (
    <tr
      className={cn(
        'border-b border-[color-mix(in_srgb,var(--bw-border)_50%,transparent)] hover:bg-[var(--bw-card-hover)] cursor-pointer text-[9px] leading-tight border-l-[3px] bw-text',
        index % 2 === 0 ? 'bg-[var(--bw-row-stripe)]' : 'bg-transparent',
        stale && 'bg-amber-500/5',
      )}
      style={{ borderLeftColor: color }}
      onClick={() => openModalWith('driverDetail', { driverId: driver.driverId })}
    >
      <td className="py-1 px-0.5 truncate" title={driver.zoneName || undefined}>{driver.zoneName || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.driverName}>
        <span className="font-bold bw-text">{driver.driverName}</span>
        <span className="bw-muted ml-1 font-mono">{driver.vehicleNo}</span>
      </td>
      <td className="py-1 px-0.5 truncate" title={(driver.services || ['Taxi']).join(', ')}>
        {(driver.services || ['Taxi']).map((s) => s.slice(0, 1)).join('')}
      </td>
      <td
        className="py-1 px-0.5 font-semibold truncate"
        style={{ color }}
        title={staleLabel ? `${driver.status} · ${staleLabel}` : driver.status}
      >
        <span className="inline-flex items-center gap-1">
          {isAvailable && !stale && (
            <span className="relative flex h-2 w-2">
              <span className="bw-status-pulse absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
            </span>
          )}
          {(!isAvailable || stale) && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
            />
          )}
          {driver.status}
          {staleLabel && age != null && (
            <span
              className="font-medium truncate max-w-[72px]"
              style={{ color: DRIVER_CONNECTIVITY_STALE_HEX }}
            >
              {formatLastSeenAge(age)}
            </span>
          )}
        </span>
      </td>
      <td className="py-1 px-0.5 text-center">{driver.jobCount ?? 0}</td>
      <td className="py-1 px-0.5 truncate" title={driver.passengerName || undefined}>{driver.passengerName || '—'}</td>
      <td className="py-1 px-0.5 truncate font-mono" title={driver.passengerPhone || undefined}>{driver.passengerPhone || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.jobPickup || undefined}>{driver.jobPickup || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.jobDropoff || undefined}>{driver.jobDropoff || '—'}</td>
    </tr>
  );
}
