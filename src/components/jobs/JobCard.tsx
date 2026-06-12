import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Edit, X, CheckCircle, RotateCcw, User, AlertTriangle } from 'lucide-react';
import type { Job, JobTab } from '@/types/job';
import {
  getJobCardAppearance,
  uaStatusBadge,
} from '@/types/job';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Tooltip } from '@/components/shared/Tooltip';
import { sourceBadgeLabel, paymentLabel, paymentBadgeColor } from '@/lib/utils';
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
  if (minutes >= 10) return 'bg-red-500/20 text-red-400 border-red-500/40 bw-wait-flash';
  if (minutes >= 5) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
  return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
}

export function JobCard({ job, tab }: JobCardProps) {
  const allDrivers = useDriverStore((s) => s.drivers);
  const onlineDrivers = useMemo(
    () => allDrivers.filter((d) => d.status === 'Available' && d.driverId),
    [allDrivers]
  );
  const addToast = useUiStore((s) => s.addToast);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const hoveredJobId = useJobStore((s) => s.hoveredJobId);
  const setHoveredJobId = useJobStore((s) => s.setHoveredJobId);
  const jobs = useJobStore((s) => s.jobs);
  const dispatcherName = useMemo(
    () => localStorage.getItem('bw_dispatcher_name') || 'Dispatcher',
    []
  );
  const [cancelTargetJobId, setCancelTargetJobId] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const cancelTarget = useMemo(
    () => (cancelTargetJobId != null ? jobs.find((j) => j.id === cancelTargetJobId) ?? null : null),
    [cancelTargetJobId, jobs]
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const cardLook = useMemo(() => getJobCardAppearance(job, tab, now), [job, tab, now]);
  const statusBadge = tab === 'ua' ? uaStatusBadge(job) : null;
  const highlighted = hoveredJobId === job.id;
  const onColoredBg = !!cardLook.foregroundColor;

  const { waitLabel, waitMinutes } = useMemo(() => {
    const base = job.createdAt ? new Date(job.createdAt) : null;
    try {
      const d = base && !Number.isNaN(base.getTime()) ? base : parseISO(job.bookingDateTime.replace(' ', 'T'));
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

  const handleCancelClick = (jobId: number) => {
    setCancelTargetJobId(jobId);
  };

  const handleCancelConfirmed = async () => {
    if (cancelTargetJobId == null) return;
    const target = useJobStore.getState().jobs.find((j) => j.id === cancelTargetJobId);
    if (!target) {
      addToast({ type: 'error', title: 'Cancel failed', message: 'Job not found' });
      setCancelTargetJobId(null);
      return;
    }
    const jobId = cancelTargetJobId;
    setCancelTargetJobId(null);
    try {
      await cancelJob(jobId, target.companyId, dispatcherName);
      addToast({
        type: 'success',
        title: `Job #${jobId} cancelled`,
        category: 'job_cancelled',
      });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Cancel failed',
        message: e instanceof Error ? e.message : '',
      });
    }
  };

  const iconBtn =
    'p-0.5 rounded border border-transparent hover:border-[var(--bw-border)] bw-hover-surface transition h-6 w-6 inline-flex items-center justify-center';

  const showRoutePreview = (e: MouseEvent) => {
    e.stopPropagation();
    setHoveredJobId(job.id);
  };

  const clearRoutePreview = (e: MouseEvent) => {
    e.stopPropagation();
    setHoveredJobId(null);
  };

  const handleAssign = (value: string) => {
    if (value === '__pending__') run(() => setPending(job), 'Set Pending');
    else if (value === '__noone__') run(() => setNoOne(job), 'Set No One');
    else {
      const d = onlineDrivers.find((x) => x.driverId === value);
      if (d) run(() => assignJob(job.id, d.driverId, d.vehicleId, job.updateSeq), 'Assigned');
    }
  };

  const dispatchLabelClass = onColoredBg ? 'text-white font-bold bw-job-card-solid-text' : 'text-amber-400 font-medium';

  return (
    <div
      className={cn(
        'rounded mb-1 border border-[var(--bw-border)] border-l-[3px] transition-all duration-150',
        onColoredBg ? 'px-2 py-2' : 'px-1.5 py-1.5',
        highlighted && 'ring-1 ring-[var(--bw-accent)]/60',
        cardLook.flash && 'bw-dispatch-flash'
      )}
      style={{
        ...(cardLook.flash
          ? ({
              ['--bw-card-bg' as string]: cardLook.backgroundColor,
              ['--bw-card-bg-pulse' as string]: '#991b1b',
            } as CSSProperties)
          : { backgroundColor: cardLook.backgroundColor }),
        borderLeftColor: cardLook.borderLeftColor,
        color: cardLook.foregroundColor,
      }}
    >
      <div className={cn('flex flex-wrap items-center gap-1', onColoredBg ? 'mb-1' : 'mb-0.5')}>
        <span
          className={cn(
            'font-mono text-[9px] font-bold',
            onColoredBg ? 'text-white bw-job-card-solid-text' : 'bw-text'
          )}
        >
          #{job.id}
        </span>
        <Badge color="#64748b" className="!text-[9px] !px-1 !py-0">
          {sourceBadgeLabel(job.source, job.dispatcherName)}
        </Badge>
        {statusBadge && (
          <span
            className="text-[9px] font-bold px-1 py-0 rounded uppercase tracking-wide"
            style={{ color: statusBadge.color, backgroundColor: statusBadge.bg }}
          >
            {statusBadge.label}
          </span>
        )}
        {cardLook.label && (
          <span className={cn('text-[9px] uppercase tracking-wide', dispatchLabelClass)}>
            {cardLook.label}
          </span>
        )}
        {job.urgent && (
          <Badge color="#ef4444" className="!text-[9px] !px-1 !py-0">
            URGENT
          </Badge>
        )}
        <span
          className={cn(
            'ml-auto text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
            onColoredBg
              ? 'bg-black/20 border-white/30 text-white bw-job-card-solid-text'
              : waitBadgeClass(waitMinutes)
          )}
        >
          {waitLabel}
        </span>
      </div>

      <div className={cn('mb-1', onColoredBg ? 'text-[11px] leading-snug space-y-1' : 'text-[10px] leading-tight mb-0.5 space-y-0')}>
        <div className="flex gap-1.5 items-start min-h-[16px]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 cursor-pointer mt-1"
            onMouseEnter={showRoutePreview}
            onMouseLeave={clearRoutePreview}
          />
          <span
            className={cn(
              'truncate font-medium',
              onColoredBg ? 'text-white bw-job-card-solid-text' : 'bw-text'
            )}
          >
            {job.pickAddress || 'No pickup'}
          </span>
        </div>
        <div className="flex gap-1.5 items-start min-h-[16px]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 cursor-pointer mt-1"
            onMouseEnter={showRoutePreview}
            onMouseLeave={clearRoutePreview}
          />
          <span
            className={cn(
              'truncate',
              onColoredBg ? 'text-white/95 bw-job-card-solid-text' : 'text-[var(--bw-muted)]'
            )}
          >
            {job.dropAddress || 'No dropoff'}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1 min-h-[14px]',
          onColoredBg ? 'text-[10px] text-white/95 bw-job-card-solid-text' : 'text-[9px] mb-0.5 text-[var(--bw-muted)]'
        )}
      >
        <span className="inline-flex items-center gap-0.5 truncate max-w-[45%]">
          <User size={9} />
          {job.passengerName || '—'}
        </span>
        {job.passengerPhone && <span className="truncate">{job.passengerPhone}</span>}
        <Badge color={paymentBadgeColor(job.paymentType)} className="!text-[9px] !px-1 !py-0 shrink-0">
          {paymentLabel(job.paymentType)}
        </Badge>
        {job.estimatedFare && job.estimatedFare !== '0' && (
          <span className={cn('shrink-0 font-medium', onColoredBg ? 'text-emerald-200' : 'text-emerald-400')}>
            ${job.estimatedFare}
          </span>
        )}
      </div>

      {job.notes && (
        <div
          className={cn(
            'text-[9px] mb-1 line-clamp-1 italic',
            onColoredBg ? 'text-white/85 bw-job-card-solid-text' : 'text-[var(--bw-muted)] mb-0.5'
          )}
        >
          {job.notes}
        </div>
      )}

      {tab === 'offer' && job.offeredAt && (
        <div className="text-[9px] text-amber-400 mb-0.5">
          Offer expires {formatDistanceToNow(job.offeredAt + 30000, { addSuffix: true })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-0.5">
        {tab === 'ua' && (
          <>
            <select
              className="bw-card-static rounded text-[9px] px-1 py-0 h-6 bw-text max-w-[100px] border"
              defaultValue=""
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                handleAssign(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Assign ▼</option>
              <option value="__pending__">Set Pending</option>
              <option value="__noone__">Set No One</option>
              {onlineDrivers.length > 0 && <option disabled>— online —</option>}
              {onlineDrivers.map((d) => (
                <option key={d.driverId} value={d.driverId}>
                  {d.vehicleNo} {d.driverName}
                </option>
              ))}
            </select>
            <Tooltip label="Edit job">
              <button
                type="button"
                className={iconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  openModalWith('createJob', { jobId: job.id });
                }}
              >
                <Edit size={11} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button
                type="button"
                className={cn(iconBtn, 'text-red-400')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelClick(job.id);
                }}
              >
                <X size={11} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'offer' && (
          <Button
            variant="danger"
            className="!h-6 !px-1.5 !py-0 !text-[9px]"
            onClick={(e) => {
              e.stopPropagation();
              void run(() => cancelJob(job.id, job.companyId, dispatcherName), 'Offer cancelled');
            }}
          >
            Cancel Offer
          </Button>
        )}
        {(tab === 'assign' || tab === 'active') && (
          <>
            <Tooltip label="Complete job">
              <button
                type="button"
                className={cn(iconBtn, 'text-emerald-400')}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => forceCompleteJob(job.id), 'Completed');
                }}
              >
                <CheckCircle size={11} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button
                type="button"
                className={cn(iconBtn, 'text-red-400')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelClick(job.id);
                }}
              >
                <X size={11} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'queue' && (
          <>
            <Tooltip label="Recall to U-A">
              <button
                type="button"
                className={iconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => recallJob(job.id, job.originalStatus || 'Pending'), 'Recalled to U-A');
                }}
              >
                <RotateCcw size={11} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel job">
              <button
                type="button"
                className={cn(iconBtn, 'text-red-400')}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => cancelJob(job.id, job.companyId, dispatcherName), 'Cancelled');
                }}
              >
                <X size={11} />
              </button>
            </Tooltip>
          </>
        )}
        {tab === 'dy' && (
          <>
            <Button
              variant="primary"
              className="!h-6 !px-1.5 !py-0 !text-[9px]"
              onClick={(e) => {
                e.stopPropagation();
                void run(() => setPending(job), 'Pending');
              }}
            >
              Pending
            </Button>
            <Tooltip label="Cancel job">
              <button
                type="button"
                className={cn(iconBtn, 'text-red-400')}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => cancelJob(job.id, job.companyId, dispatcherName), 'Cancelled');
                }}
              >
                <X size={11} />
              </button>
            </Tooltip>
          </>
        )}
        <Button
          variant="ghost"
          className="!h-6 !px-1.5 !py-0 !text-[9px]"
          onClick={(e) => {
            e.stopPropagation();
            openModalWith('jobDetail', { jobId: job.id });
          }}
        >
          Details
        </Button>
      </div>

      {cancelTargetJobId != null && cancelTarget && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCancelTargetJobId(null)}
        >
          <div
            className="rounded-xl border border-[#3d4260] bg-[#12151f] shadow-2xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#e8eaf0]">
                  Cancel Job #{cancelTargetJobId}?
                </h3>
                <p className="text-sm text-[#8892a4] mt-2 leading-relaxed">
                  This will cancel the job for{' '}
                  <span className="text-[#e8eaf0]">{cancelTarget.passengerName || 'the passenger'}</span>
                  {' '}from{' '}
                  <span className="text-[#e8eaf0]">{cancelTarget.pickAddress || 'pickup address'}</span>.
                  {' '}This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setCancelTargetJobId(null);
                }}
              >
                Keep Job
              </Button>
              <Button
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCancelConfirmed();
                }}
              >
                Cancel Job
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
