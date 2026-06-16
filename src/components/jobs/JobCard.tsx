import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { differenceInMinutes, formatDistanceToNow, parseISO } from 'date-fns';
import { Edit, X, CheckCircle, User, AlertTriangle } from 'lucide-react';
import type { Job, JobTab } from '@/types/job';
import {
  formatJobDateTimeShort,
  getJobCardAppearance,
  isPreDispatchWindow,
  jobBookingTime,
  jobCreatedAtTime,
  jobFareDisplay,
  jobOverdueLabel,
  jobPickupTypeLabel,
  jobReturnReasonAlert,
  jobScheduledTime,
  jobTariffLabel,
  jobVehicleTypeLabel,
  preDispatchAssignBlockMessage,
  uaStatusBadge,
} from '@/types/job';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Tooltip } from '@/components/shared/Tooltip';
import { sourceDisplayName, paymentLabel, paymentBadgeColor } from '@/lib/utils';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import {
  applyJobAssignment,
  cancelJob,
  forceCompleteJob,
  setPending,
} from '@/lib/jobFlow';
import { isAssignedDriverSelection } from '@/lib/createJobForm';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  tab: JobTab;
}

const BADGE_BG = '#2C2C2A';
const BADGE_TEXT = '#F1EFE8';

function waitBadgeClass(minutes: number): string {
  const base =
    'text-[9px] font-bold px-1 py-0 rounded uppercase tracking-wide shrink-0 border border-black/20';
  if (minutes >= 10) return `${base} bw-wait-flash`;
  return base;
}

function tagChip(label: string) {
  return (
    <span
      className="text-[9px] font-bold px-1 py-0 rounded uppercase tracking-wide shrink-0 border border-black/20"
      style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
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
  const [assignSelection, setAssignSelection] = useState('');
  const [now, setNow] = useState(() => new Date());
  const cancelTarget = useMemo(
    () => (cancelTargetJobId != null ? jobs.find((j) => j.id === cancelTargetJobId) ?? null : null),
    [cancelTargetJobId, jobs]
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cardLook = useMemo(() => getJobCardAppearance(job, tab, now), [job, tab, now]);
  const statusBadge = tab === 'ua' ? uaStatusBadge(job) : null;
  const highlighted = hoveredJobId === job.id;
  const toned = !!cardLook.tone;
  const onThemedBg = !!cardLook.foregroundColor;
  const themeStyle = cardLook.foregroundColor ? { color: cardLook.foregroundColor } : undefined;
  const themeMutedStyle = cardLook.foregroundMuted
    ? { color: cardLook.foregroundMuted }
    : themeStyle;

  const uaMeta = useMemo(() => {
    if (tab !== 'ua') return null;
    const created = jobCreatedAtTime(job);
    const booked = jobBookingTime(job);
    const pickup = jobScheduledTime(job);
    const fare = jobFareDisplay(job);
    return {
      sourceName: sourceDisplayName(job.source),
      createdLabel: created ? formatJobDateTimeShort(created) : null,
      bookedLabel: booked ? formatJobDateTimeShort(booked) : '—',
      pickupLabel: jobPickupTypeLabel(job),
      pickupTime: pickup ? formatJobDateTimeShort(pickup) : null,
      overdue: jobOverdueLabel(job, now),
      returnAlert: jobReturnReasonAlert(job),
      createdBy: job.dispatcherName?.trim() || null,
      passengerEmail: job.passengerEmail?.trim() || null,
      tariffLabel: jobTariffLabel(job),
      vehicleType: jobVehicleTypeLabel(job),
      fare,
    };
  }, [job, tab, now]);

  const opsMeta = useMemo(() => {
    if (tab === 'ua' || tab === 'dy') return null;
    const created = jobCreatedAtTime(job);
    const booked = jobBookingTime(job);
    const assignedDriver = allDrivers.find((d) => d.driverId === job.driverId);
    return {
      createdLabel: created ? formatJobDateTimeShort(created) : null,
      bookedLabel: booked ? formatJobDateTimeShort(booked) : null,
      driverLabel: assignedDriver
        ? `${assignedDriver.vehicleNo} ${assignedDriver.driverName}`.trim()
        : job.driverId && job.driverId !== '-1' && job.driverId !== '0'
          ? job.vehicleNo || `Driver ${job.driverId}`
          : null,
    };
  }, [job, tab, now, allDrivers]);

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

  const handleApplyAssign = async () => {
    if (!assignSelection) return;
    if (
      assignSelection !== '__pending__' &&
      assignSelection !== '__noone__' &&
      isPreDispatchWindow(job, now)
    ) {
      addToast({
        type: 'error',
        title: 'Cannot assign yet',
        message: preDispatchAssignBlockMessage(job),
      });
      return;
    }
    const selection = assignSelection;
    try {
      const result = await applyJobAssignment(job, selection, onlineDrivers);
      const hadDriver = !!(job.driverId && isAssignedDriverSelection(job.driverId));
      addToast({
        type: 'success',
        title:
          result === 'pending'
            ? hadDriver
              ? 'Job unassigned (Pending)'
              : 'Set Pending'
            : result === 'noone'
              ? hadDriver
                ? 'Job unassigned (No One)'
                : 'Set No One'
              : result === 'reassign'
                ? 'Driver reassigned'
                : 'Driver assigned',
      });
      setAssignSelection('');
    } catch (e) {
      addToast({
        type: 'error',
        title:
          selection === '__pending__' || selection === '__noone__'
            ? 'Unassign failed'
            : 'Assign failed',
        message: e instanceof Error ? e.message : '',
      });
    }
  };

  const showAssignControls = tab === 'ua' || tab === 'assign' || tab === 'queue' || tab === 'offer';
  const assignBlockedBySchedule = isPreDispatchWindow(job, now);

  const assignControls = showAssignControls ? (
    <>
      <select
        className="bw-card-static rounded text-[9px] px-1 py-0 h-6 bw-text max-w-[100px] border"
        value={assignSelection}
        disabled={assignBlockedBySchedule}
        title={assignBlockedBySchedule ? preDispatchAssignBlockMessage(job) : undefined}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          setAssignSelection(e.target.value);
        }}
      >
        <option value="">Assign ▼</option>
        <option value="__pending__">Pending</option>
        <option value="__noone__">No One</option>
        {onlineDrivers.length > 0 && <option disabled>— online —</option>}
        {onlineDrivers.map((d) => (
          <option key={d.driverId} value={d.driverId}>
            {d.vehicleNo} {d.driverName}
          </option>
        ))}
      </select>
      <Button
        variant="primary"
        className="!h-6 !px-1.5 !py-0 !text-[9px] shrink-0"
        disabled={!assignSelection || assignBlockedBySchedule}
        title={assignBlockedBySchedule ? preDispatchAssignBlockMessage(job) : undefined}
        onClick={(e) => {
          e.stopPropagation();
          void handleApplyAssign();
        }}
      >
        Apply
      </Button>
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
  ) : null;

  const toneText = onThemedBg ? '' : 'bw-text';
  const metaText = onThemedBg ? '' : 'text-[var(--bw-muted)]';

  return (
    <div
      className={cn(
        'rounded px-1.5 py-1 mb-0.5 border border-[var(--bw-border)] border-l-[3px] transition-all duration-150',
        toned && 'bw-job-card-toned',
        highlighted && 'ring-1 ring-[var(--bw-accent)]/60',
        cardLook.flash && 'bw-dispatch-flash'
      )}
      style={{
        ...(cardLook.flash
          ? ({
              ['--bw-card-bg' as string]: cardLook.backgroundColor,
              ['--bw-card-bg-pulse' as string]: '#F0A0A0',
            } as CSSProperties)
          : { backgroundColor: cardLook.backgroundColor }),
        ...(cardLook.borderColor ? { borderColor: cardLook.borderColor } : {}),
        borderLeftColor: cardLook.borderLeftColor,
        color: cardLook.foregroundColor,
      }}
    >
      <div className="flex flex-wrap items-center gap-0.5 mb-0.5">
        <span className={cn('font-mono text-[9px] font-bold', toneText)} style={themeStyle}>#{job.id}</span>
        {tagChip(tab === 'ua' && uaMeta ? uaMeta.sourceName : sourceDisplayName(job.source))}
        {statusBadge && tagChip(statusBadge.label)}
        {pickupTag && tagChip(pickupTag)}
        {cardLook.label === 'DISPATCH NOW' && tagChip('DISPATCH NOW')}
        {tab === 'ua' && uaMeta?.overdue && tagChip(uaMeta.overdue)}
        {job.urgent && tagChip('URGENT')}
        <span
          className={cn('ml-auto', waitBadgeClass(waitMinutes))}
          style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
        >
          {waitLabel}
        </span>
      </div>

      {tab === 'ua' && uaMeta && (
        <div
          className={cn('flex flex-wrap gap-x-2 gap-y-0 text-[9px] mb-0.5 leading-tight', metaText)}
          style={themeMutedStyle}
        >
          {uaMeta.createdLabel && (
            <span>
              <span className="opacity-70">Created:</span> {uaMeta.createdLabel}
            </span>
          )}
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

      {opsMeta && (opsMeta.createdLabel || opsMeta.bookedLabel || opsMeta.driverLabel) && (
        <div
          className={cn('flex flex-wrap gap-x-2 gap-y-0 text-[9px] mb-0.5 leading-tight', metaText)}
          style={themeMutedStyle}
        >
          {opsMeta.createdLabel && (
            <span>
              <span className="opacity-70">Created:</span> {opsMeta.createdLabel}
            </span>
          )}
          {opsMeta.bookedLabel && (
            <span>
              <span className="opacity-70">Booked:</span> {opsMeta.bookedLabel}
            </span>
          )}
          {opsMeta.driverLabel && (
            <span>
              <span className="opacity-70">Driver:</span> {opsMeta.driverLabel}
            </span>
          )}
        </div>
      )}

      <div className="text-[10px] leading-tight mb-0.5 space-y-0">
        <div className="flex gap-1 items-center min-h-[14px]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 cursor-pointer"
            onMouseEnter={showRoutePreview}
            onMouseLeave={clearRoutePreview}
          />
          <span className={cn('truncate font-medium', onThemedBg ? '' : 'text-[var(--bw-text)]')} style={themeStyle}>
            {job.pickAddress || 'No pickup'}
          </span>
        </div>
        <div className="flex gap-1 items-center min-h-[14px]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 cursor-pointer"
            onMouseEnter={showRoutePreview}
            onMouseLeave={clearRoutePreview}
          />
          <span className={cn('truncate', onThemedBg ? '' : 'text-[var(--bw-muted)]')} style={themeMutedStyle}>
            {job.dropAddress || 'No dropoff'}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[9px] mb-0.5 min-h-[14px]',
          metaText
        )}
        style={themeMutedStyle}
      >
        <span className="inline-flex items-center gap-0.5 truncate max-w-[45%]">
          <User size={9} />
          {job.passengerName || '—'}
        </span>
        {job.passengerPhone && <span className="truncate">{job.passengerPhone}</span>}
        <Badge color={paymentBadgeColor(job.paymentType)} className="!text-[9px] !px-1 !py-0 shrink-0">
          {paymentLabel(job.paymentType)}
        </Badge>
        {tab !== 'ua' && job.estimatedFare && job.estimatedFare !== '0' && (
          <span className="shrink-0 font-medium text-emerald-400">${job.estimatedFare}</span>
        )}
      </div>

      {tab === 'ua' && uaMeta && (
        <div
          className={cn('flex flex-wrap gap-x-2 gap-y-0 text-[9px] mb-0.5 leading-tight', metaText)}
          style={themeMutedStyle}
        >
          {uaMeta.fare && (
            <span className={cn('font-medium', onThemedBg ? '' : 'text-emerald-400')} style={themeStyle}>
              {uaMeta.fare.label}: {uaMeta.fare.amount}
            </span>
          )}
          {uaMeta.tariffLabel && (
            <span>
              <span className="opacity-70">Tariff:</span> {uaMeta.tariffLabel}
            </span>
          )}
          {uaMeta.vehicleType && (
            <span>
              <span className="opacity-70">Vehicle:</span> {uaMeta.vehicleType}
            </span>
          )}
          {uaMeta.createdBy && (
            <span className="truncate max-w-full">
              <span className="opacity-70">Created by:</span> {uaMeta.createdBy}
            </span>
          )}
          {uaMeta.passengerEmail && (
            <span className="truncate max-w-full">
              <span className="opacity-70">Email:</span> {uaMeta.passengerEmail}
            </span>
          )}
        </div>
      )}

      {tab === 'ua' && uaMeta?.returnAlert && (
        <div
          className="text-[9px] mb-0.5 px-1 py-0.5 rounded leading-snug border border-black/20"
          style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
        >
          {uaMeta.returnAlert.text}
        </div>
      )}

      {job.notes && (
        <div
          className={cn('text-[9px] mb-0.5 line-clamp-1 italic', metaText)}
          style={themeMutedStyle}
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
        {assignControls}
        {tab === 'offer' && (
          <Button
            variant="danger"
            className="!h-6 !px-1.5 !py-0 !text-[9px]"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelClick(job.id);
            }}
          >
            Cancel Offer
          </Button>
        )}
        {tab === 'active' && (
          <>
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
                  handleCancelClick(job.id);
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
