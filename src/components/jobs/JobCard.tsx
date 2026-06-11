import { useMemo } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Edit, X, CheckCircle, RotateCcw, MapPin, User } from 'lucide-react';
import type { Job, JobTab } from '@/types/job';
import {
  jobCardBorderColor,
  normalizeJobStatus,
  statusBadgeStyle,
} from '@/types/job';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Tooltip } from '@/components/shared/Tooltip';
import { sourceLabel, paymentBadgeColor } from '@/lib/utils';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
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
  if (minutes >= 10) return 'bg-red-500/20 text-red-400 border-red-500/40';
  if (minutes >= 5) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
  return 'bg-[var(--bw-card)] text-[var(--bw-muted)] border-[var(--bw-border)]';
}

export function JobCard({ job, tab }: JobCardProps) {
  const allDrivers = useDriverStore((s) => s.drivers);
  const drivers = useMemo(
    () => allDrivers.filter((d) => d.status === 'Available'),
    [allDrivers]
  );
  const addToast = useUiStore((s) => s.addToast);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const setSelectedJobId = useJobStore((s) => s.setSelectedJobId);

  const border = jobCardBorderColor(job);
  const status = normalizeJobStatus(job.status);
  const badge = statusBadgeStyle(status);
  const selected = selectedJobId === job.id;

  const { waitLabel, waitMinutes } = useMemo(() => {
    const base = job.createdAt ? new Date(job.createdAt) : null;
    try {
      const d = base && !Number.isNaN(base.getTime()) ? base : parseISO(job.bookingDateTime);
      return {
        waitLabel: formatDistanceToNow(d, { addSuffix: false }),
        waitMinutes: differenceInMinutes(new Date(), d),
      };
    } catch {
      return { waitLabel: '—', waitMinutes: 0 };
    }
  }, [job.bookingDateTime, job.createdAt]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      addToast({ type: 'success', title: ok });
    } catch (e) {
      addToast({ type: 'error', title: 'Action failed', message: e instanceof Error ? e.message : '' });
    }
  };

  const iconBtn = 'p-1 rounded border border-transparent hover:border-[var(--bw-border)] bw-hover-surface transition';

  const selectJob = () => setSelectedJobId(selected ? null : job.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={selectJob}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectJob();
        }
      }}
      className={cn(
        'rounded-md px-2.5 py-2 mb-1.5 bw-card-static cursor-pointer transition-all duration-150 border-l-[3px]',
        selected && 'ring-1 ring-[var(--bw-accent)]/60 bg-[var(--bw-card-hover)]'
      )}
      style={{ borderLeftColor: border }}
    >
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        <span className="font-mono text-xs font-bold bw-text">#{job.id}</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ color: badge.color, backgroundColor: badge.bg }}
        >
          {badge.label}
        </span>
        <Badge color="#94a3b8">{sourceLabel(job.source)}</Badge>
        {job.urgent && <Badge color="#ef4444">URGENT</Badge>}
        <span className={cn('ml-auto text-[9px] px-1.5 py-0.5 rounded-full border font-medium', waitBadgeClass(waitMinutes))}>
          {waitLabel}
        </span>
      </div>

      <div className="space-y-1 text-[11px] mb-1.5 leading-snug">
        <div className="flex gap-1.5 items-start">
          <MapPin size={11} className="text-emerald-400 shrink-0 mt-0.5" />
          <span className="bw-text line-clamp-2">{job.pickAddress || 'No pickup'}</span>
        </div>
        <div className="flex gap-1.5 items-start">
          <MapPin size={11} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-[var(--bw-muted)] line-clamp-2">{job.dropAddress || 'No dropoff'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-[var(--bw-muted)] mb-1.5 items-center">
        <span className="inline-flex items-center gap-0.5 truncate max-w-full">
          <User size={10} />
          {job.passengerName || '—'}
          {job.passengerPhone ? ` · ${job.passengerPhone}` : ''}
        </span>
        <Badge color={paymentBadgeColor(job.paymentType)}>{job.paymentType || 'Cash'}</Badge>
        {job.estimatedFare && <span>${job.estimatedFare}</span>}
      </div>

      {tab === 'offer' && job.offeredAt && (
        <div className="text-[9px] text-amber-400 mb-1.5">
          Offer expires {formatDistanceToNow(job.offeredAt + 30000, { addSuffix: true })}
        </div>
      )}

      <div className="flex flex-wrap gap-1 items-center" onClick={(e) => e.stopPropagation()}>
        {tab === 'ua' && (
          <>
            <Button
              variant={status === 'Pending' ? 'primary' : 'ghost'}
              className={cn(status === 'Pending' && 'ring-1 ring-[#4f6ef7]')}
              onClick={() => run(() => setPending(job), 'Set Pending')}
            >
              Pending
            </Button>
            <Button
              variant={status === 'No One' ? 'muted' : 'ghost'}
              className={cn(status === 'No One' && 'ring-1 ring-[#64748b] bg-[#64748b]/20')}
              onClick={() => run(() => setNoOne(job), 'Set No One')}
            >
              No One
            </Button>
            <select
              className="bw-card-static rounded text-[10px] px-1 py-0.5 bw-text max-w-[90px] border"
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
                <Edit size={13} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-red-400')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={13} />
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
              <button type="button" className={cn(iconBtn, 'text-emerald-400')} onClick={() => run(() => forceCompleteJob(job.id), 'Completed')}>
                <CheckCircle size={13} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-red-400')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={13} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'queue' && (
          <>
            <Tooltip label="Recall to U-A">
              <button type="button" className={iconBtn} onClick={() => run(() => recallJob(job.id, job.originalStatus || 'Pending'), 'Recalled to U-A')}>
                <RotateCcw size={13} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-red-400')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={13} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'dy' && (
          <>
            <Button variant="primary" onClick={() => run(() => setPending(job), 'Pending')}>Pending</Button>
            <Tooltip label="Cancel job">
              <button type="button" className={cn(iconBtn, 'text-red-400')} onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
                <X size={13} />
              </button>
            </Tooltip>
          </>
        )}
        <Button variant="ghost" onClick={() => openModalWith('jobDetail', { jobId: job.id })}>Details</Button>
      </div>
    </div>
  );
}
