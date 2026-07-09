import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { ArrowRight, Ban, Car, CheckCircle, Edit, Lock, Luggage, MapPin, AlertTriangle, RotateCcw, StickyNote, Tag, Users, X } from 'lucide-react';
import type { Job, JobTab, JobTimerBadge } from '@/types/job';
import {
  formatJobDateTimeCompact,
  getJobCardAppearance,
  isPreBookedJob,
  isPreDispatchWindow,
  jobBookingMeta,
  jobBookingMetaVisible,
  jobCreatedAtTime,
  jobEditLockLabel,
  jobGoTimeLabel,
  jobPickupTime,
  jobPickupTypeLabel,
  jobReturnReasonAlert,
  jobTimerBadge,
  preDispatchAssignBlockMessage,
  resolveLastOfferDriverName,
  resolveLiveMeterDisplay,
} from '@/types/job';
import { effectiveJobStatus, jobStatusAbbrev } from '@/lib/jobStatusAuthority';
import {
  jobEditLockBlockedForSelf,
  tryAcquireJobEditLock,
} from '@/lib/jobEditLock';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Tooltip } from '@/components/shared/Tooltip';
import {
  cn,
  dispatcherInitials,
  paymentLabel,
  paymentBadgeColor,
  sourceLabel,
} from '@/lib/utils';
import { useDriverStore } from '@/store/driverStore';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import {
  applyJobAssignment,
  cancelJob,
  forceCompleteJob,
  recallJob,
  setPending,
} from '@/lib/jobFlow';
import { isAssignedDriverSelection } from '@/lib/createJobForm';
import { filterDriversForJob } from '@/lib/jobVehicleEligibility';
import {
  notifyJobCancelled,
  notifyJobRecalled,
} from '@/lib/dispatchNotifications';
import { useTariffs } from '@/hooks/useTariffs';
import { useLiveJobMeter } from '@/hooks/useLiveJobMeter';

interface JobCardProps {
  job: Job;
  tab: JobTab;
  compact?: boolean;
}

const TIMER_PILL: Record<JobTimerBadge['variant'], string> = {
  blue: 'bg-blue-500/20 text-blue-700 border-blue-400/50',
  red: 'bg-red-500/20 text-red-700 border-red-400/50',
  amber: 'bg-amber-500/20 text-amber-800 border-amber-400/50',
  green: 'bg-emerald-500/20 text-emerald-800 border-emerald-400/50',
  neutral: 'bg-black/10 text-inherit border-black/15 opacity-80',
};

function TimerPill({ badge, themed }: { badge: JobTimerBadge; themed?: boolean }) {
  const cls = themed
    ? badge.variant === 'blue'
      ? 'bg-white/30 text-inherit border-white/40'
      : badge.variant === 'red'
        ? 'bg-red-900/20 text-red-900 border-red-800/40'
        : TIMER_PILL[badge.variant]
    : TIMER_PILL[badge.variant];
  return (
    <span
      className={cn(
        'text-[9px] font-semibold px-1 py-0 rounded-full border shrink-0 leading-tight',
        cls,
      )}
    >
      {badge.text}
    </span>
  );
}

function TypeTag({ label }: { label: string }) {
  return (
    <span className="text-[8px] font-bold px-0.5 py-0 rounded border border-black/15 opacity-75 shrink-0">
      {label}
    </span>
  );
}

function JobBookingMetaRow({
  job,
  metaText,
  themeMutedStyle,
}: {
  job: Job;
  metaText: string;
  themeMutedStyle?: CSSProperties;
}) {
  const meta = jobBookingMeta(job);
  if (!jobBookingMetaVisible(meta)) return null;
  return (
    <div
      className={cn('flex items-center gap-1.5 min-h-[12px] mb-0.5 text-[8px] leading-tight', metaText)}
      style={themeMutedStyle}
    >
      {meta.vehicleType && (
        <span className="inline-flex items-center gap-0.5 shrink-0" title="Vehicle type">
          <Car size={8} className="opacity-70" />
          {meta.vehicleType}
        </span>
      )}
      {meta.tariff && (
        <span className="inline-flex items-center gap-0.5 shrink-0" title="Tariff">
          <Tag size={8} className="opacity-70" />
          {meta.tariff}
        </span>
      )}
      {meta.passengers != null && (
        <span className="inline-flex items-center gap-0.5 shrink-0" title="Passengers">
          <Users size={8} className="opacity-70" />
          {meta.passengers}
        </span>
      )}
      {meta.bags != null && (
        <span className="inline-flex items-center gap-0.5 shrink-0" title="Bags">
          <Luggage size={8} className="opacity-70" />
          {meta.bags}
        </span>
      )}
      {meta.notes && (
        <span className="inline-flex items-center gap-0.5 min-w-0 truncate" title={meta.notes}>
          <StickyNote size={8} className="opacity-70 shrink-0" />
          <span className="truncate italic">{meta.notes}</span>
        </span>
      )}
    </div>
  );
}

function LiveMeterDisplay({
  meter,
  themed,
}: {
  meter: NonNullable<ReturnType<typeof resolveLiveMeterDisplay>>;
  themed?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 shrink-0 font-mono text-[9px] font-bold tabular-nums',
        themed ? 'text-inherit' : 'text-emerald-500',
      )}
      title={meter.ticking ? 'Live meter' : 'Fare'}
    >
      <span className="font-sans font-semibold opacity-75 max-w-[56px] truncate">{meter.tariffLabel}</span>
      <span>${meter.fare.toFixed(2)}</span>
    </span>
  );
}

export function JobCard({ job, tab, compact = false }: JobCardProps) {
  const allDrivers = useDriverStore((s) => s.drivers);
  const onlineDrivers = useMemo(
    () => allDrivers.filter((d) => d.status === 'Available' && d.driverId),
    [allDrivers],
  );
  const assignDrivers = useMemo(() => {
    const byId = new Map<string, (typeof allDrivers)[0]>();
    if (job.driverId && isAssignedDriverSelection(job.driverId)) {
      const assigned =
        allDrivers.find(
          (d) =>
            d.driverId === job.driverId ||
            (!!job.vehicleId && d.vehicleId === job.vehicleId) ||
            (!!job.vehicleNo && d.vehicleNo === job.vehicleNo),
        ) ??
        ({
          driverId: job.driverId,
          vehicleId: String(job.vehicleId || '0'),
          vehicleNo: String(job.vehicleNo || job.vehicleId || job.driverId),
          driverName: String(job.driverName || job.driverId),
          status: 'Busy' as const,
        } as (typeof allDrivers)[0]);
      byId.set(assigned.driverId, assigned);
    }
    for (const d of filterDriversForJob(onlineDrivers, job)) byId.set(d.driverId, d);
    return Array.from(byId.values());
  }, [allDrivers, job, onlineDrivers]);
  const queueAssignDrivers = useMemo(
    () =>
      filterDriversForJob(onlineDrivers, job).filter(
        (d) => d.driverId !== String(job.driverId ?? '').trim(),
      ),
    [onlineDrivers, job],
  );
  const assignTabDrivers = useMemo(
    () =>
      filterDriversForJob(onlineDrivers, job).filter(
        (d) => d.driverId !== String(job.driverId ?? '').trim(),
      ),
    [onlineDrivers, job],
  );
  const assignDropdownDrivers =
    tab === 'queue' ? queueAssignDrivers : tab === 'assign' ? assignTabDrivers : assignDrivers;
  const showPendingAssignOption = tab !== 'queue' && tab !== 'assign';
  const showAssignControls =
    tab === 'ua' || tab === 'assign' || tab === 'offer' || tab === 'queue' || tab === 'active';
  const addToast = useUiStore((s) => s.addToast);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const hoveredJobId = useJobStore((s) => s.hoveredJobId);
  const setHoveredJobId = useJobStore((s) => s.setHoveredJobId);
  const jobs = useJobStore((s) => s.jobs);
  const dispatcherName = useMemo(
    () => localStorage.getItem('bw_dispatcher_name') || 'Dispatcher',
    [],
  );
  const [cancelTargetJobId, setCancelTargetJobId] = useState<number | null>(null);
  const [assignSelection, setAssignSelection] = useState('');
  const [now, setNow] = useState(() => new Date());
  const cancelTarget = useMemo(
    () => (cancelTargetJobId != null ? jobs.find((j) => j.id === cancelTargetJobId) ?? null : null),
    [cancelTargetJobId, jobs],
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cardLook = useMemo(() => getJobCardAppearance(job, tab, now), [job, tab, now]);
  const highlighted = hoveredJobId === job.id;
  const toned = !!cardLook.tone;
  const onThemedBg = !!cardLook.foregroundColor;
  const themeStyle = cardLook.foregroundColor ? { color: cardLook.foregroundColor } : undefined;
  const themeMutedStyle = cardLook.foregroundMuted
    ? { color: cardLook.foregroundMuted }
    : themeStyle;

  const status = jobStatusAbbrev(effectiveJobStatus(job));
  const pickupType = jobPickupTypeLabel(job);
  const pickup = jobPickupTime(job);
  const created = jobCreatedAtTime(job);
  const timerBadge = jobTimerBadge(job, tab, now);
  const goTime =
    tab === 'ua' && isPreBookedJob(job, now) && isPreDispatchWindow(job, now)
      ? jobGoTimeLabel(job)
      : null;
  const returnAlert = jobReturnReasonAlert(job, resolveLastOfferDriverName(job, allDrivers));
  const editLockLabel = jobEditLockLabel(job);
  const editBlockedByOther = jobEditLockBlockedForSelf(job);

  const handleEditClick = async (e: MouseEvent) => {
    e.stopPropagation();
    if (editBlockedByOther) {
      addToast({
        type: 'warning',
        title: 'Job locked for editing',
        message: editLockLabel
          ? `${editLockLabel} — wait until they save or cancel`
          : 'Another user is editing this job',
      });
      return;
    }
    const result = await tryAcquireJobEditLock(job.id, dispatcherName);
    if (!result.ok) {
      addToast({
        type: 'warning',
        title: result.conflict ? 'Job locked for editing' : 'Cannot edit job',
        message: result.message,
      });
      return;
    }
    openModalWith('createJob', { jobId: job.id });
  };

  const assignedDriver = useMemo(() => {
    if (!job.driverId || !isAssignedDriverSelection(job.driverId)) return undefined;
    return allDrivers.find(
      (d) =>
        d.driverId === job.driverId ||
        (!!job.vehicleId && d.vehicleId === job.vehicleId) ||
        (!!job.vehicleNo && d.vehicleNo === job.vehicleNo),
    );
  }, [allDrivers, job.driverId, job.vehicleId, job.vehicleNo]);

  const tariffs = useTariffs(job.companyId);
  const tariff = useMemo(() => {
    if (job.tariffId && job.tariffId !== '0' && job.tariffId !== '-1') {
      return tariffs.find((t) => t.id === job.tariffId) ?? tariffs[0];
    }
    return tariffs[0];
  }, [tariffs, job.tariffId]);

  const vehicleId = assignedDriver?.vehicleId || job.vehicleId;
  const liveSnap = useLiveJobMeter(job, tab, vehicleId);

  const meterDriver = useMemo(() => {
    if (!assignedDriver && !liveSnap.liveFare) return null;
    return {
      liveFare: liveSnap.liveFare ?? assignedDriver?.liveFare,
      liveTariffName: liveSnap.liveTariffName ?? assignedDriver?.liveTariffName,
      liveJobId: liveSnap.liveJobId ?? assignedDriver?.liveJobId,
      bookingId: assignedDriver?.bookingId,
      liveDistanceKm: liveSnap.liveDistanceKm ?? assignedDriver?.liveDistanceKm,
      liveWaitingMin: liveSnap.liveWaitingMin ?? assignedDriver?.liveWaitingMin,
      meterOnAt: liveSnap.meterOnAt ?? assignedDriver?.meterOnAt,
    };
  }, [assignedDriver, liveSnap]);

  const liveMeter = useMemo(
    () => resolveLiveMeterDisplay(job, tab, { driver: meterDriver, tariff, now }),
    [job, tab, meterDriver, tariff, now],
  );

  const rightContact = useMemo(() => {
    if (tab === 'active' || tab === 'assign' || tab === 'queue') {
      const name =
        assignedDriver?.driverName?.trim() ||
        job.driverName?.trim() ||
        (job.driverId && job.driverId !== '0' && job.driverId !== '-1'
          ? `D${job.driverId}`
          : null);
      const vehicle =
        assignedDriver?.vehicleNo?.trim() ||
        job.vehicleNo?.trim() ||
        (job.vehicleId && job.vehicleId !== '0' ? job.vehicleId : null);
      if (vehicle && name) return `${vehicle} ${name}`.trim();
      if (vehicle) return vehicle;
      if (name) return name;
    }
    const parts = [job.passengerName?.trim(), job.passengerPhone?.trim()].filter(Boolean);
    return parts.join(' · ') || '—';
  }, [tab, assignedDriver, job]);

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
      notifyJobCancelled(jobId, target);
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Cancel failed',
        message: e instanceof Error ? e.message : '',
      });
    }
  };

  const iconBtn = compact
    ? 'p-0.5 rounded border border-transparent hover:border-[var(--bw-border)] bw-hover-surface transition h-5 w-5 inline-flex items-center justify-center shrink-0'
    : 'p-0.5 rounded border border-transparent hover:border-[var(--bw-border)] bw-hover-surface transition h-6 w-6 inline-flex items-center justify-center shrink-0';

  const editButton = (tooltip = 'Edit job') => (
    <Tooltip
      label={
        editBlockedByOther && editLockLabel
          ? `Locked — ${editLockLabel}`
          : tooltip
      }
    >
      <button
        type="button"
        className={cn(iconBtn, editBlockedByOther && 'opacity-50 cursor-not-allowed')}
        onClick={(e) => {
          void handleEditClick(e);
        }}
      >
        {editBlockedByOther ? <Lock size={11} /> : <Edit size={11} />}
      </button>
    </Tooltip>
  );

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
      const result = await applyJobAssignment(job, selection, assignDropdownDrivers);
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

  const handleWithdrawOffer = async () => {
    try {
      await setPending(job);
      addToast({ type: 'success', title: 'Offer withdrawn' });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Withdraw failed',
        message: e instanceof Error ? e.message : '',
      });
    }
  };

  const assignBlockedBySchedule = isPreDispatchWindow(job, now);
  const toneText = onThemedBg ? '' : 'bw-text';
  const metaText = onThemedBg ? '' : 'text-[var(--bw-muted)]';

  const createdMeta = created
    ? formatJobDateTimeCompact(created, now)
    : tab === 'ua' && timerBadge?.text.startsWith('wait')
      ? timerBadge.text
      : null;
  const source = sourceLabel(job.source);
  const initials = dispatcherInitials(job.dispatcherName?.trim() || dispatcherName);

  return (
    <div
      className={cn(
        compact
          ? 'rounded px-1 py-0.5 mb-0.5 border border-[var(--bw-border)] border-l-[3px] transition-all duration-150'
          : 'rounded px-1.5 py-1 mb-0.5 border border-[var(--bw-border)] border-l-[3px] transition-all duration-150',
        toned && 'bw-job-card-toned',
        highlighted && 'ring-1 ring-[var(--bw-accent)]/60',
        cardLook.flash && 'bw-dispatch-flash',
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
      {/* Line 1 — ID, status, type, pickup, timer, contact */}
      <div className={cn('flex items-center gap-1 leading-none', compact ? 'min-h-[14px] mb-0' : 'min-h-[16px] mb-0.5')}>
        <span
          className={cn(compact ? 'font-mono text-[8px] font-bold shrink-0' : 'font-mono text-[9px] font-bold shrink-0', toneText)}
          style={themeStyle}
        >
          #{job.id}
        </span>
        <span className="inline-flex items-center gap-0.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.dotColor }} />
          <span className={compact ? 'text-[8px] font-bold' : 'text-[9px] font-bold'} style={themeStyle}>
            {status.abbrev}
          </span>
        </span>
        <TypeTag label={pickupType} />
        {pickup && (
          <span
            className={cn(compact ? 'inline-flex items-center gap-0.5 text-[8px] shrink-0' : 'inline-flex items-center gap-0.5 text-[9px] shrink-0', toneText)}
            style={themeStyle}
          >
            <MapPin size={9} className="shrink-0 opacity-70" />
            {formatJobDateTimeCompact(pickup, now)}
          </span>
        )}
        {goTime && (
          <span className="text-[9px] font-semibold opacity-80 shrink-0" style={themeMutedStyle}>
            {goTime}
          </span>
        )}
        {timerBadge && <TimerPill badge={timerBadge} themed={onThemedBg} />}
        {liveMeter && <LiveMeterDisplay meter={liveMeter} themed={onThemedBg} />}
        {job.urgent && (
          <span className={compact ? 'text-[7px] font-bold text-red-600 shrink-0' : 'text-[8px] font-bold text-red-600 shrink-0'}>URG</span>
        )}
        {editLockLabel && editBlockedByOther && (
          <span
            className="inline-flex items-center gap-0.5 text-[8px] font-semibold text-amber-700 bg-amber-500/15 px-1 rounded shrink-0 max-w-[38%] truncate"
            title={`Being edited — ${editLockLabel}`}
          >
            <Lock size={8} className="shrink-0" />
            {editLockLabel}
          </span>
        )}
        <span
          className={cn(
            compact ? 'ml-auto text-[8px] truncate max-w-[45%] text-right font-medium' : 'ml-auto text-[9px] truncate max-w-[42%] text-right font-medium',
            toneText,
          )}
          style={themeStyle}
          title={rightContact}
        >
          {rightContact}
        </span>
      </div>

      {/* Line 2 — route + payment */}
      <div className={cn('flex items-center gap-1 leading-tight', compact ? 'min-h-[12px] mb-0' : 'min-h-[14px] mb-0.5')}>
        <div
          className="flex items-center gap-0.5 min-w-0 flex-1"
          onMouseEnter={showRoutePreview}
          onMouseLeave={clearRoutePreview}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span
            className={cn(compact ? 'truncate text-[9px] font-medium' : 'truncate text-[10px] font-medium', onThemedBg ? '' : 'text-[var(--bw-text)]')}
            style={themeStyle}
          >
            {job.pickAddress || 'No pickup'}
          </span>
          <ArrowRight size={9} className="shrink-0 opacity-50" />
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span
            className={cn(compact ? 'truncate text-[9px]' : 'truncate text-[10px]', onThemedBg ? '' : 'text-[var(--bw-muted)]')}
            style={themeMutedStyle}
          >
            {job.dropAddress || 'No dropoff'}
          </span>
        </div>
        <Badge color={paymentBadgeColor(job.paymentType)} className="!text-[8px] !px-1 !py-0 shrink-0 ml-1">
          {job.accountId ? `#${job.accountId}` : paymentLabel(job.paymentType)}
        </Badge>
      </div>

      {!compact && <JobBookingMetaRow job={job} metaText={metaText} themeMutedStyle={themeMutedStyle} />}

      {/* Line 3 + action row — meta or return warning, plus controls */}
      <div className={cn('flex items-center gap-1 leading-none', compact ? 'min-h-[16px]' : 'min-h-[18px]')}>
        {tab === 'ua' && returnAlert ? (
          <span className="text-[9px] text-red-700 font-medium truncate flex-1 min-w-0">
            {returnAlert.text}
          </span>
        ) : (
          <span className={cn(compact ? 'text-[8px] truncate flex-1 min-w-0' : 'text-[9px] truncate flex-1 min-w-0', metaText)} style={themeMutedStyle}>
            {createdMeta && <span>{createdMeta}</span>}
            {createdMeta && source && <span className="opacity-50"> · </span>}
            {source && <span>{source}</span>}
            {initials && (
              <>
                <span className="opacity-50"> · </span>
                <span>{initials}</span>
              </>
            )}
          </span>
        )}

        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          {showAssignControls && (
            <>
              <select
                className={cn(
                  'bw-card-static rounded bw-text border',
                  compact ? 'text-[8px] px-1 py-0 h-5 max-w-[80px]' : 'text-[9px] px-1 py-0 h-6 max-w-[88px]',
                )}
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
                {showPendingAssignOption && <option value="__pending__">Pending</option>}
                <option value="__noone__">No One</option>
                {assignDropdownDrivers.length > 0 && <option disabled>— drivers —</option>}
                {assignDropdownDrivers.map((d) => (
                  <option key={d.driverId} value={d.driverId}>
                    {d.vehicleNo} {d.driverName}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                className={cn('shrink-0', compact ? '!h-5 !px-1 !py-0 !text-[8px]' : '!h-6 !px-1.5 !py-0 !text-[9px]')}
                disabled={!assignSelection || assignBlockedBySchedule}
                title={assignBlockedBySchedule ? preDispatchAssignBlockMessage(job) : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApplyAssign();
                }}
              >
                Apply
              </Button>
            </>
          )}

          {tab === 'ua' && (
            <>
              {editButton()}
              <Tooltip label="Cancel job">
                <button
                  type="button"
                  className={cn(iconBtn, 'text-red-400')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelClick(job.id);
                  }}
                >
                  <Ban size={11} />
                </button>
              </Tooltip>
            </>
          )}

          {tab === 'offer' && (
            <>
              <Tooltip label="Withdraw offer">
                <button
                  type="button"
                  className={cn(iconBtn, 'text-red-400')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleWithdrawOffer();
                  }}
                >
                  <X size={11} />
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
                  <Ban size={11} />
                </button>
              </Tooltip>
              {editButton()}
            </>
          )}

          {tab === 'assign' && (
            <>
              {editButton()}
              <Tooltip label="Recall job to U-A (withdraw from driver)">
                <button
                  type="button"
                  className={cn(iconBtn, 'text-amber-500')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      try {
                        await recallJob(job.id, effectiveJobStatus(job));
                        notifyJobRecalled(job.id, job, job.driverId);
                      } catch (err) {
                        addToast({
                          type: 'error',
                          title: 'Recall failed',
                          message: err instanceof Error ? err.message : '',
                        });
                      }
                    })();
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
                    handleCancelClick(job.id);
                  }}
                >
                  <Ban size={11} />
                </button>
              </Tooltip>
            </>
          )}

          {tab === 'queue' && (
            <>
              {editButton()}
              <Tooltip label="Cancel job">
                <button
                  type="button"
                  className={cn(iconBtn, 'text-red-400')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelClick(job.id);
                  }}
                >
                  <Ban size={11} />
                </button>
              </Tooltip>
            </>
          )}

          {tab === 'active' && (
            <>
              {editButton()}
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
                className={compact ? '!h-5 !px-1 !py-0 !text-[8px]' : '!h-6 !px-1.5 !py-0 !text-[9px]'}
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
            className={compact ? '!h-5 !px-1 !py-0 !text-[8px] shrink-0' : '!h-6 !px-1 !py-0 !text-[9px] shrink-0'}
            onClick={(e) => {
              e.stopPropagation();
              openModalWith('jobDetail', { jobId: job.id });
            }}
          >
            ···
          </Button>
        </div>
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
