import { statusColor, type Driver } from '@/types/driver';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface DriverRowProps {
  driver: Driver;
  index: number;
}

export function DriverRow({ driver, index }: DriverRowProps) {
  const openModalWith = useUiStore((s) => s.openModalWith);
  const color = statusColor(driver.status);
  const isAvailable = driver.status === 'Available';

  return (
    <tr
      className={cn(
        'border-b border-bw-border/40 hover:bg-bw-card/60 cursor-pointer text-[9px] leading-tight border-l-[3px]',
        index % 2 === 0 ? 'bg-bw-surface/30' : 'bg-transparent'
      )}
      style={{ borderLeftColor: color }}
      onClick={() => openModalWith('driverDetail', { driverId: driver.driverId })}
    >
      <td className="py-1 px-0.5 truncate" title={driver.zoneName || undefined}>{driver.zoneName || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.driverName}>
        <span className="font-bold text-bw-text">{driver.driverName}</span>
        <span className="text-bw-muted ml-1 font-mono">{driver.vehicleNo}</span>
      </td>
      <td className="py-1 px-0.5 truncate" title={(driver.services || ['Taxi']).join(', ')}>
        {(driver.services || ['Taxi']).map((s) => s.slice(0, 1)).join('')}
      </td>
      <td className="py-1 px-0.5 font-semibold truncate" style={{ color }} title={driver.status}>
        <span className="inline-flex items-center gap-1">
          {isAvailable && (
            <span className="relative flex h-2 w-2">
              <span className="bw-status-pulse absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
            </span>
          )}
          {!isAvailable && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
          {driver.status}
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
