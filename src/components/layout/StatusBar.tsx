import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';

export function StatusBar() {
  const counts = useDriverStore((s) => s.counts());
  const jobs = useJobStore((s) => s.jobs);

  const pending = jobs.filter((j) => j.status === 'Pending' || j.status === 'No One').length;
  const active = jobs.filter((j) => ['Active', 'OnTrip', 'Picking'].includes(j.status)).length;

  return (
    <footer className="h-[30px] shrink-0 flex items-center justify-between px-3 bg-bw-surface border-t border-bw-border text-[10px] text-bw-muted uppercase tracking-wide">
      <span>BookaWaka Dispatch</span>
      <div className="flex gap-4">
        <span>Drivers: {counts.all}</span>
        <span className="text-status-available">Free: {counts.free}</span>
        <span className="text-status-picking">Picking: {counts.picking}</span>
        <span className="text-status-busy">Busy: {counts.busy}</span>
        <span>Pending jobs: {pending}</span>
        <span>Active trips: {active}</span>
      </div>
      <span>{new Date().toLocaleTimeString()}</span>
    </footer>
  );
}
