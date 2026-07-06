import { formatJobDateTimeShort, type Job } from '@/types/job';
import { normalizeJobStatus } from '@/lib/jobStatusAuthority';

export type ClosedTimelineEvent = {
  key: string;
  label: string;
  at: Date | null;
  detail?: string;
};

function parseTimestamp(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function pushEvent(
  events: ClosedTimelineEvent[],
  key: string,
  label: string,
  raw: unknown,
  detail?: string,
) {
  const at = parseTimestamp(raw);
  if (!at) return;
  events.push({ key, label, at, detail });
}

export function buildClosedJobTimeline(job: Job, raw: Record<string, unknown>): ClosedTimelineEvent[] {
  const events: ClosedTimelineEvent[] = [];
  const step =
    raw.stepTimes && typeof raw.stepTimes === 'object'
      ? (raw.stepTimes as Record<string, unknown>)
      : {};

  pushEvent(events, 'created', 'Created at', raw.createdAt ?? raw.CreatedAt ?? job.createdAt);
  pushEvent(events, 'offered', 'Dispatched / Offered at', raw.offeredAt ?? job.offeredAt);
  pushEvent(
    events,
    'accepted',
    'Driver accepted at',
    raw.DriverAcceptedAt ?? raw.driverAcceptedAt ?? step.acceptedAt,
  );
  pushEvent(events, 'onTheWay', 'On the way at', raw.OnTheWayAt ?? raw.onTheWayAt);
  pushEvent(events, 'arrived', 'Arrived at', raw.ArrivedAt ?? raw.arrivedAt ?? step.arrivedAt);
  pushEvent(
    events,
    'onboard',
    'On board at',
    raw.OnBoardAt ?? raw.onBoardAt ?? raw.ActiveAt ?? raw.activeAt ?? step.onboardAt,
  );

  const st = normalizeJobStatus(job.status);
  if (st === 'Cancelled' || st === 'No Show') {
    const reason = String(job.cancelReason || raw.CancelReason || raw.cancelReason || '').trim();
    pushEvent(
      events,
      'terminal',
      st === 'No Show' ? 'No Show at' : 'Cancelled at',
      raw.cancelledAt ?? raw.CancelledAt ?? job.cancelledAt ?? step.cancelledAt,
      reason || undefined,
    );
  } else {
    pushEvent(
      events,
      'completed',
      'Completed at',
      raw.completedAt ??
        raw.CompletedAt ??
        raw.JobCompleteTime ??
        raw.newcompelete ??
        step.completeAt ??
        job.completedAt,
    );
  }

  const driverNote = driverReassignmentNote(job, raw);
  if (driverNote) {
    events.push({
      key: 'driver-change',
      label: 'Driver change',
      at: parseTimestamp(raw.lastOfferAt ?? raw.offeredAt) ?? events[events.length - 1]?.at ?? null,
      detail: driverNote,
    });
  }

  return events
    .filter((e) => e.at != null)
    .sort((a, b) => (a.at!.getTime() - b.at!.getTime()));
}

export function driverReassignmentNote(job: Job, raw: Record<string, unknown>): string | null {
  const reason = String(job.returnReason ?? raw.returnReason ?? raw.ReturnReason ?? '').trim();
  const fromId = String(
    job.lastOfferDriverId ?? raw.lastOfferDriverId ?? raw.LastOfferDriverId ?? '',
  ).trim();
  const fromName = String(
    job.lastOfferDriverName ?? raw.lastOfferDriverName ?? raw.LastOfferDriverName ?? '',
  ).trim();
  if (!reason && !fromId) return null;
  const who = fromName && fromId ? `${fromName} (${fromId})` : fromName || fromId;
  if (who && reason) return `From ${who} — ${reason}`;
  return who || reason;
}

export function formatTimelineWhen(at: Date | null): string {
  if (!at) return '—';
  return formatJobDateTimeShort(at);
}
