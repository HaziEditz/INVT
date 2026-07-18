import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { type Driver } from '@/types/driver';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import {
  DRIVER_CONNECTIVITY_STALE_HEX,
  driverPresenceColorHex,
  isDriverConnectivityStale,
  outOfCoverageLabel,
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
  const coverageLabel = outOfCoverageLabel(driver.lastSeen, now);

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
        title={coverageLabel ? `${driver.status} · ${coverageLabel}` : driver.status}
      >
        <span className="inline-flex items-center gap-1 min-w-0">
          {isAvailable && !stale && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="bw-status-pulse absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
            </span>
          )}
          {(!isAvailable || stale) && !coverageLabel && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: color }}
            />
          )}
          {coverageLabel && (
            <WifiOff size={10} className="shrink-0" style={{ color: DRIVER_CONNECTIVITY_STALE_HEX }} aria-hidden />
          )}
          <span className="truncate">{driver.status}</span>
          {coverageLabel && (
            <span
              className="font-medium truncate max-w-[110px]"
              style={{ color: DRIVER_CONNECTIVITY_STALE_HEX }}
            >
              {coverageLabel}
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
