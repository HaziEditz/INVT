import { useEffect, useMemo, useState } from 'react';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';

function nzClockString(date: Date): string {
  return date.toLocaleTimeString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function StatusBar() {
  const drivers = useDriverStore((s) => s.drivers);
  const jobs = useJobStore((s) => s.jobs);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(
    () => ({
      all: drivers.length,
      free: drivers.filter((d) => d.status === 'Available').length,
      offered: drivers.filter((d) => d.status === 'Offered').length,
      picking: drivers.filter((d) => d.status === 'Picking').length,
      busy: drivers.filter((d) => ['Busy', 'Active', 'OnTrip', 'Assigned', 'Arrived'].includes(d.status)).length,
      away: drivers.filter((d) => d.status === 'Away').length,
    }),
    [drivers]
  );

  const pending = jobs.filter((j) => j.status === 'Pending' || j.status === 'No One').length;
  const active = jobs.filter((j) => ['Active', 'OnTrip', 'Picking'].includes(j.status)).length;
  const nzTime = nzClockString(now);

  const stat = (label: string, value: number | string, color?: string) => (
    <span className={color ? color : 'bw-muted'}>
      <span className="opacity-70">{label}:</span>{' '}
      <span className="font-bold bw-text">{value}</span>
    </span>
  );

  return (
    <footer className="h-[32px] shrink-0 flex items-center justify-between px-4 bw-surface border-t bw-border text-[10px] uppercase tracking-wide bw-text">
      <span className="font-bold bw-accent">BookaWaka Dispatch</span>
      <div className="flex gap-5 items-center">
        {stat('Drivers', counts.all)}
        {stat('Free', counts.free, 'text-status-available')}
        {stat('Offered', counts.offered, 'text-status-offered')}
        {stat('Picking', counts.picking, 'text-status-picking')}
        {stat('Busy', counts.busy, 'text-status-busy')}
        {stat('Pending', pending, 'text-amber-400')}
        {stat('Active', active, 'bw-accent')}
      </div>
      <span className="font-mono bw-text tabular-nums">
        NZ {nzTime}
      </span>
    </footer>
  );
}
