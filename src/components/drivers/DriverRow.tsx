import { statusColor, type Driver } from '@/types/driver';
import { Badge } from '@/components/shared/Badge';
import { useUiStore } from '@/store/uiStore';

interface DriverRowProps {
  driver: Driver;
}

export function DriverRow({ driver }: DriverRowProps) {
  const openModalWith = useUiStore((s) => s.openModalWith);
  const color = statusColor(driver.status);

  return (
    <tr
      className="border-b border-bw-border/50 hover:bg-bw-card/50 cursor-pointer text-[11px]"
      onClick={() => openModalWith('driverDetail', { driverId: driver.driverId })}
    >
      <td className="py-1.5 px-1 truncate max-w-[70px]">{driver.zoneName || '—'}</td>
      <td className="py-1.5 px-1">
        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: color }} />
        {driver.driverName}
      </td>
      <td className="py-1.5 px-1">
        {(driver.services || ['Taxi']).map((s) => (
          <Badge key={s} className="mr-0.5">{s}</Badge>
        ))}
      </td>
      <td className="py-1.5 px-1 font-semibold" style={{ color }}>{driver.status}</td>
      <td className="py-1.5 px-1 text-center">{driver.jobCount ?? 0}</td>
      <td className="py-1.5 px-1 truncate max-w-[80px]">{driver.passengerName || '—'}</td>
      <td className="py-1.5 px-1">{driver.passengerPhone || '—'}</td>
      <td className="py-1.5 px-1 truncate max-w-[90px]">{driver.jobPickup || '—'}</td>
      <td className="py-1.5 px-1 truncate max-w-[90px]">{driver.jobDropoff || '—'}</td>
    </tr>
  );
}
