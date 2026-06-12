import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Edit, X, CheckCircle, RotateCcw, User, AlertTriangle } from 'lucide-react';
import type { Job, JobTab } from '@/types/job';
import {
  formatJobDateTimeShort,
  getJobCardAppearance,
  jobBookedAtTime,
  jobOverdueLabel,
  jobPickupTypeLabel,
  jobReturnReasonAlert,
  jobScheduledTime,
  uaStatusBadge,
} from '@/types/job';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Tooltip } from '@/components/shared/Tooltip';
import { sourceDisplayName, paymentLabel, paymentBadgeColor } from '@/lib/utils';
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
  const base = 'text-[9px] font-bold px-1 py-0 rounded uppercase tracking-wide shrink-0 bg-[#0f172a] text-white border border-black/50';
  if (minutes >= 10) return `${base} text-red-200 bw-wait-flash`;
  if (minutes >= 5) return `${base} text-amber-200`;
  return `${base} text-emerald-200`;
}

function tagChip(label: string, extra?: string) {
  return (
    <span
      className={cn(
        'text-[9px] font-bold px-1 py-0 rounded uppercase tracking-wide shrink-0',
        'bg-[#0f172a] text-white border border-black/50',
        extra
      )}
    >
      {label}
    </span>
  );
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
  const toned = !!cardLook.tone;
  const onColoredBg = toned;

  const uaMeta = useMemo(() => {
    if (tab !== 'ua') return null;
    const booked = jobBookedAtTime(job);
    const pickup = jobScheduledTime(job);
    return {
      sourceName: sourceDisplayName(job.source),
      bookedLabel: booked ? formatJobDateTimeShort(booked) : '—',
      pickupLabel: jobPickupTypeLabel(job),
      pickupTime: pickup ? formatJobDateTimeShort(pickup) : null,
      overdue: jobOverdueLabel(job, now),
      returnAlert: jobReturnReasonAlert(job),
      dispatcher: job.dispatcherName?.trim() || null,
    };
  }, [job, tab, now]);

  const pickupTag =
    tab === 'ua' && uaMeta
      ? uaMeta.pickupLabel
      : cardLook.label?.startsWith('Sched:')
        ? cardLook.label
        : null;

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

  const toneText = onColoredBg ? 'text-[#f1f5f9]' : 'bw-text';
  const toneMuted = onColoredBg ? 'text-[#cbd5e1]' : 'text-[var(--bw-muted)]';

  return (
    <div
      className={cn(
        'rounded px-1.5 py-1 mb-0.5 border border-[var(--bw-border)] border-l-[3px] transition-all duration-150',
        onColoredBg && 'bw-job-card-toned',
        highlighted && 'ring-1 ring-[var(--bw-accent)]/60',
        cardLook.flash && 'bw-dispatch-flash'
      )}
      style={{
        ...(cardLook.flash
          ? ({
              ['--bw-card-bg' as string]: cardLook.backgroundColor,
              ['--bw-card-bg-pulse' as string]: 'rgba(239, 68, 68, 0.48)',
            } as CSSProperties)
          : { backgroundColor: cardLook.backgroundColor }),
        borderLeftColor: cardLook.borderLeftColor,
        color: cardLook.foregroundColor,
      }}
    >
      <div className="flex flex-wrap items-center gap-0.5 mb-0.5">
        <span className={cn('font-mono text-[9px] font-bold', toneText)}>#{job.id}</span>
        {tagChip(tab === 'ua' && uaMeta ? uaMeta.sourceName : sourceDisplayName(job.source))}
        {statusBadge && tagChip(statusBadge.label)}
        {pickupTag && tagChip(pickupTag)}
        {cardLook.label === 'DISPATCH NOW' && tagChip('DISPATCH NOW', 'text-amber-100')}
        {tab === 'ua' && uaMeta?.overdue && tagChip(uaMeta.overdue, 'text-amber-100')}
        {job.urgent && tagChip('URGENT', 'text-red-200')}
        <span className={cn('ml-auto', waitBadgeClass(waitMinutes))}>{waitLabel}</span>
      </div>

      {tab === 'ua' && uaMeta && (
        <div className={cn('flex flex-wrap gap-x-2 gap-y-0 text-[9px] mb-0.5 leading-tight', toneMuted)}>
          <span>
            <span className="opacity-70">Booked:</span> {uaMeta.bookedLabel}
          </span>
          {uaMeta.pickupLabel !== 'ASAP' && uaMeta.pickupTime && (
            <span>
              <span className="opacity-70">Pickup:</span> {uaMeta.pickupTime}
            </span>
          )}
        </div>
      )}

      <div className={cn('text-[10px] leading-tight mb-0.5 space-y-0', toneText)}>
        <div className="flex gap-1 items-center min-h-[14px]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 cursor-pointer"
            onMouseEnter={showRoutePreview}
            onMouseLeave={clearRoutePreview}
          />
          <span className="truncate font-medium">{job.pickAddress || 'No pickup'}</span>
        </div>
        <div className={cn('flex gap-1 items-center min-h-[14px]', toneMuted)}>
          <span
            className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 cursor-pointer"
            onMouseEnter={showRoutePreview}
            onMouseLeave={clearRoutePreview}
          />
          <span className="truncate">{job.dropAddress || 'No dropoff'}</span>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[9px] mb-0.5 min-h-[14px]',
          toneMuted
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
          <span className="shrink-0 font-medium text-emerald-400">${job.estimatedFare}</span>
        )}
      </div>

      {tab === 'ua' && uaMeta?.dispatcher && (
        <div className={cn('text-[9px] mb-0.5 truncate', toneMuted)}>
          <span className="opacity-70">Dispatcher:</span> {uaMeta.dispatcher}
        </div>
      )}

      {tab === 'ua' && uaMeta?.returnAlert && (
        <div className="text-[9px] mb-0.5 px-1 py-0.5 rounded leading-snug bg-[#0f172a] text-white border border-black/50">
          {uaMeta.returnAlert.kind === 'not_reached' ? 'Not reached: ' : ''}
          {uaMeta.returnAlert.kind === 'reject' ? 'Rejected: ' : ''}
          {uaMeta.returnAlert.text}
        </div>
      )}

      {job.notes && (
        <div className={cn('text-[9px] mb-0.5 line-clamp-1 italic', toneMuted)}>{job.notes}</div>
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
