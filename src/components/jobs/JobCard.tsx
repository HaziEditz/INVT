import { useMemo } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Edit, X, CheckCircle, RotateCcw, MapPin, User, Phone } from 'lucide-react';
import type { Job, JobTab } from '@/types/job';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Tooltip } from '@/components/shared/Tooltip';
import { serviceBorderColor, sourceLabel, paymentBadgeColor } from '@/lib/utils';
import { useDriverStore } from '@/store/driverStore';
import {
  assignJob,
  cancelJob,
  forceCompleteJob,
  recallJob,
  setNoOne,
  setPending,
} from '@/lib/jobFlow';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  tab: JobTab;
}

function waitBadgeClass(minutes: number): string {
  if (minutes >= 10) return 'bg-bw-danger/20 text-bw-danger border-bw-danger/40';
  if (minutes >= 5) return 'bg-bw-warning/20 text-bw-warning border-bw-warning/40';
  return 'bg-bw-card text-bw-muted border-bw-border';
}

export function JobCard({ job, tab }: JobCardProps) {
  const allDrivers = useDriverStore((s) => s.drivers);
  const drivers = useMemo(
    () => allDrivers.filter((d) => d.status === 'Available'),
    [allDrivers]
  );
  const addToast = useUiStore((s) => s.addToast);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const border = serviceBorderColor(job.serviceType);

  const { waitLabel, waitMinutes } = useMemo(() => {
    try {
      const d = parseISO(job.bookingDateTime);
      return {
        waitLabel: formatDistanceToNow(d, { addSuffix: false }),
        waitMinutes: differenceInMinutes(new Date(), d),
      };
    } catch {
      return { waitLabel: '—', waitMinutes: 0 };
    }
  }, [job.bookingDateTime]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      addToast({ type: 'success', title: ok });
    } catch (e) {
      addToast({ type: 'error', title: 'Action failed', message: e instanceof Error ? e.message : '' });
    }
  };

  const iconBtn = 'p-1.5 rounded-md hover:bg-bw-surface border border-transparent hover:border-bw-border transition';

  return (
    <div
      className={cn(
        'rounded-lg p-3 mb-2.5 bg-bw-card border border-bw-border shadow-sm',
        'hover:shadow-md hover:-translate-y-0.5 hover:bg-bw-cardHover transition-all duration-150 border-l-[4px]',
        job.urgent && 'ring-1 ring-bw-warning/50'
      )}
      style={{ borderLeftColor: border }}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="font-mono text-sm font-bold text-bw-text">#{job.id}</span>
        <Badge color="#94a3b8">{sourceLabel(job.source)}</Badge>
        <Badge color={border}>{job.serviceType.toUpperCase()}</Badge>
        {job.accountId && <Badge color="#ec4899">ACC</Badge>}
        {job.urgent && <Badge color="#f59e0b">URGENT</Badge>}
        <span className="ml-auto text-[10px] text-bw-muted uppercase">{job.status}</span>
      </div>

      <div className="space-y-1.5 text-xs mb-2">
        <div className="flex gap-2 items-start">
          <MapPin size={13} className="text-bw-success shrink-0 mt-0.5" />
          <span className="text-bw-text truncate">{job.pickAddress || 'No pickup'}</span>
        </div>
        <div className="flex gap-2 items-start">
          <MapPin size={13} className="text-bw-danger shrink-0 mt-0.5" />
          <span className="text-bw-muted truncate">{job.dropAddress || 'No dropoff'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-bw-muted mb-2 items-center">
        <span className="inline-flex items-center gap-1"><User size={11} />{job.passengerName || '—'}</span>
        <span className="inline-flex items-center gap-1"><Phone size={11} />{job.passengerPhone || '—'}</span>
        <Badge color={paymentBadgeColor(job.paymentType)}>{job.paymentType || 'Cash'}</Badge>
        <span>${job.estimatedFare || '0'}</span>
        <span className={cn('px-1.5 py-0.5 rounded-full border text-[10px] font-medium', waitBadgeClass(waitMinutes))}>
          {waitLabel} waiting
        </span>
      </div>

      {tab === 'offer' && job.offeredAt && (
        <div className="text-[10px] text-bw-warning mb-2">
          Offer expires {formatDistanceToNow(job.offeredAt + 30000, { addSuffix: true })}
        </div>
      )}

      <div className="flex flex-wrap gap-1 items-center">
        {tab === 'ua' && (
          <>
            <Button variant="primary" onClick={() => run(() => setPending(job), 'Set Pending')}>Pending</Button>
            <Button variant="muted" onClick={() => run(() => setNoOne(job), 'Set No One')}>No One</Button>
            <select
              className="bg-bw-card border border-bw-border rounded text-xs px-1 py-1 text-bw-text max-w-[100px]"
              defaultValue=""
              onChange={(e) => {
                const d = drivers.find((x) => x.driverId === e.target.value);
                if (d) run(() => assignJob(job.id, d.driverId, d.vehicleId, job.updateSeq), 'Assigned');
                e.target.value = '';
              }}
            >
              <option value="">Assign…</option>
              {drivers.map((d) => (
                <option key={d.driverId} value={d.driverId}>{d.vehicleNo} {d.driverName}</option>
              ))}
            </select>
            <Tooltip label="Edit job">
              <button type="button" className={iconBtn} onClick={() => openModalWith('createJob', { jobId: job.id })}>
                <Edit size={14} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-bw-danger')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={14} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'offer' && (
          <Button variant="danger" onClick={() => run(() => cancelJob(job.id), 'Offer cancelled')}>Cancel Offer</Button>
        )}
        {(tab === 'assign' || tab === 'active') && (
          <>
            <Tooltip label="Complete job">
              <button type="button" className={cn(iconBtn, 'text-bw-success')} onClick={() => run(() => forceCompleteJob(job.id), 'Completed')}>
                <CheckCircle size={14} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-bw-danger')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={14} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'queue' && (
          <>
            <Tooltip label="Recall to U-A">
              <button type="button" className={iconBtn} onClick={() => run(() => recallJob(job.id, job.originalStatus || 'Pending'), 'Recalled to U-A')}>
                <RotateCcw size={14} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-bw-danger')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={14} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'dy' && (
          <>
            <Button variant="primary" onClick={() => run(() => setPending(job), 'Pending')}>Pending</Button>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-bw-danger')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={14} />
              </button>
            </Tooltip>
          </>
        )}
        <Button variant="ghost" onClick={() => openModalWith('jobDetail', { jobId: job.id })}>Details</Button>
      </div>
    </div>
  );
}
