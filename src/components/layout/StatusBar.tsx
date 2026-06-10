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
      picking: drivers.filter((d) => d.status === 'Picking').length,
      busy: drivers.filter((d) => ['Busy', 'Active', 'OnTrip', 'Assigned'].includes(d.status)).length,
      away: drivers.filter((d) => d.status === 'Away').length,
    }),
    [drivers]
  );

  const pending = jobs.filter((j) => j.status === 'Pending' || j.status === 'No One').length;
  const active = jobs.filter((j) => ['Active', 'OnTrip', 'Picking'].includes(j.status)).length;
  const nzTime = nzClockString(now);

  const stat = (label: string, value: number | string, color?: string) => (
    <span className={color ? color : 'text-[#8892a4]'}>
      <span className="opacity-70">{label}:</span>{' '}
      <span className="font-bold text-[#e8eaf0]">{value}</span>
    </span>
  );

  return (
    <footer className="h-[32px] shrink-0 flex items-center justify-between px-4 bg-[#1a1d2e] border-t border-[#2d3148] text-[10px] uppercase tracking-wide text-[#e8eaf0]">
      <span className="font-bold text-[#5b7cfa]">BookaWaka Dispatch</span>
      <div className="flex gap-5 items-center">
        {stat('Drivers', counts.all)}
        {stat('Free', counts.free, 'text-status-available')}
        {stat('Picking', counts.picking, 'text-status-picking')}
        {stat('Busy', counts.busy, 'text-status-busy')}
        {stat('Pending', pending, 'text-amber-400')}
        {stat('Active', active, 'text-[#5b7cfa]')}
      </div>
      <span className="font-mono text-[#e8eaf0] tabular-nums">
        NZ {nzTime}
      </span>
    </footer>
  );
}
