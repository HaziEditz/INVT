import { statusColor, type Driver } from '@/types/driver';
import { useUiStore } from '@/store/uiStore';

interface DriverRowProps {
  driver: Driver;
}

export function DriverRow({ driver }: DriverRowProps) {
  const openModalWith = useUiStore((s) => s.openModalWith);
  const color = statusColor(driver.status);

  return (
    <tr
      className="border-b border-bw-border/50 hover:bg-bw-card/50 cursor-pointer text-[9px] leading-tight"
      onClick={() => openModalWith('driverDetail', { driverId: driver.driverId })}
    >
      <td className="py-1 px-0.5 truncate" title={driver.zoneName || undefined}>{driver.zoneName || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.driverName}>
        <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5 align-middle" style={{ background: color }} />
        <span className="truncate">{driver.driverName}</span>
      </td>
      <td className="py-1 px-0.5 truncate" title={(driver.services || ['Taxi']).join(', ')}>
        {(driver.services || ['Taxi']).map((s) => s.slice(0, 1)).join('')}
      </td>
      <td className="py-1 px-0.5 font-semibold truncate" style={{ color }} title={driver.status}>
        {driver.status}
      </td>
      <td className="py-1 px-0.5 text-center">{driver.jobCount ?? 0}</td>
      <td className="py-1 px-0.5 truncate" title={driver.passengerName || undefined}>{driver.passengerName || '—'}</td>
      <td className="py-1 px-0.5 truncate font-mono" title={driver.passengerPhone || undefined}>{driver.passengerPhone || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.jobPickup || undefined}>{driver.jobPickup || '—'}</td>
      <td className="py-1 px-0.5 truncate" title={driver.jobDropoff || undefined}>{driver.jobDropoff || '—'}</td>
    </tr>
  );
}
