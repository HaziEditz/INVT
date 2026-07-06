import { FileDown } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Spinner } from '@/components/shared/Spinner';
import { useUiStore } from '@/store/uiStore';
import { useClosedJobDetail } from '@/hooks/useClosedJobDetail';
import { ClosedJobRouteMap } from '@/components/jobs/ClosedJobRouteMap';
import { generateJobPdf } from '@/lib/pdf';
import { cn, serviceBorderColor, sourceDisplayName } from '@/lib/utils';
import {
  closedJobDriverDisplay,
  closedJobFareDisplay,
  closedJobPaymentDisplay,
  closedJobSourceDisplay,
  closedJobTypeDisplay,
  closedJobVehicleDisplay,
  serviceTypeDisplay,
} from '@/lib/closedJobs';
import {
  closedJobMapEndpoints,
  summarizeTariffLogEntry,
  type ClosedFareBreakdown,
} from '@/lib/closedJobDetail';
import { formatTimelineWhen } from '@/lib/closedJobTimeline';
import {
  formatJobDateTimeShort,
  formatJobEditHistoryWhen,
  jobBookingTime,
  jobCreatedAtTime,
  jobPickupTypeLabel,
  jobVehicleTypeLabel,
} from '@/types/job';
import { normalizeJobStatus } from '@/lib/jobStatusAuthority';

interface ClosedJobDetailModalProps {
  companyId: string;
  mapsKey: string;
}

const PANEL = 'rounded-md border border-bw-border bg-bw-surface/50 p-2';
const HEADING = 'text-[10px] font-bold uppercase tracking-wide text-bw-muted mb-1';

function dash(value?: string | null): string {
  const v = String(value ?? '').trim();
  return v || '—';
}

function money(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[10px] text-bw-muted leading-tight">{label}</div>
      <div className="text-[11px] text-bw-text leading-snug truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(PANEL, className)}>
      <h4 className={HEADING}>{title}</h4>
      {children}
    </div>
  );
}

function FareBreakdownCompact({ fb }: { fb: ClosedFareBreakdown | null }) {
  if (!fb) {
    return <p className="text-[11px] text-bw-muted">Not recorded</p>;
  }
  const rows: { label: string; value: string }[] = [
    { label: 'Flag fall', value: money(fb.flagFall) },
    {
      label: 'Distance',
      value:
        fb.distanceKm != null
          ? `${fb.distanceKm.toFixed(2)} km${fb.distanceCharge != null ? ` · ${money(fb.distanceCharge)}` : ''}`
          : '—',
    },
    {
      label: 'Waiting',
      value:
        fb.waitingMinutes != null
          ? `${fb.waitingMinutes.toFixed(1)} min${fb.waitingCharge != null ? ` · ${money(fb.waitingCharge)}` : ''}`
          : '—',
    },
    { label: 'Total', value: money(fb.total) },
  ];
  return (
    <dl className="space-y-0.5">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={cn(
            'flex justify-between gap-2 text-[11px]',
            i === rows.length - 1 && 'font-semibold border-t border-bw-border pt-1 mt-1',
          )}
        >
          <dt className="text-bw-muted shrink-0">{row.label}</dt>
          <dd className="text-right truncate">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ClosedJobDetailBody({
  companyId: _companyId,
  mapsKey,
  detail,
  closeModal,
}: {
  companyId: string;
  mapsKey: string;
  detail: NonNullable<ReturnType<typeof useClosedJobDetail>['detail']>;
  closeModal: () => void;
}) {
  const settings = useUiStore((s) => s.settings);
  const { job, raw, timeline, fareBreakdown, gpsRoute, tariffLog } = detail;
  const st = normalizeJobStatus(job.status);
  const created = jobCreatedAtTime(job);
  const pickup = jobBookingTime(job);
  const history = [...(job.editHistory ?? [])].reverse();
  const endpoints = closedJobMapEndpoints(job, raw, gpsRoute);
  const hasMap = !!(gpsRoute.length || endpoints.pick || endpoints.drop);

  const cancelReason =
    st === 'Cancelled' || st === 'No Show'
      ? dash(job.cancelReason || String(raw.CancelReason ?? raw.cancelReason ?? ''))
      : null;

  const createdBy =
    job.dispatcherName?.trim()
      ? `${job.dispatcherName} (${closedJobSourceDisplay(job)})`
      : closedJobSourceDisplay(job);

  const passengerLine = [dash(job.passengerName), job.passengerPhone].filter((x) => x && x !== '—').join(' · ') || '—';

  return (
    <Modal
      open
      onClose={closeModal}
      title={`Closed Job #${job.id}`}
      extraWide
      bodyClassName="p-3 overflow-hidden"
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>Close</Button>
          <Button variant="gold" onClick={() => generateJobPdf(job, settings?.companyName || 'BookaWaka')}>
            <FileDown size={14} /> PDF
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 max-h-[calc(92vh-7.5rem)] text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Badge color={serviceBorderColor(job.serviceType)} className="!text-[9px] !py-0">
            {serviceTypeDisplay(job.serviceType)}
          </Badge>
          <Badge className="!text-[9px] !py-0">{sourceDisplayName(job.source)}</Badge>
          <Badge
            color={st === 'No Show' ? '#f97316' : st === 'Cancelled' ? '#ef4444' : '#22c55e'}
            className="!text-[9px] !py-0"
          >
            {st.toUpperCase()}
          </Badge>
          <span className="text-bw-muted text-[10px]">{closedJobTypeDisplay(job)}</span>
          {job.notes ? (
            <span className="text-bw-muted text-[10px] truncate max-w-[280px]" title={job.notes}>
              · {job.notes}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 min-h-0 flex-1">
          <Panel title="Trip">
            <div className="space-y-1.5">
              <Field label="Pickup" value={dash(job.pickAddress)} />
              <Field label="Dropoff" value={dash(job.dropAddress)} />
              <Field label="Passenger" value={passengerLine} />
              <Field label="Email" value={dash(job.passengerEmail)} />
              {cancelReason ? (
                <div className="pt-1 border-t border-bw-border/60">
                  <div className="text-[10px] text-bw-muted">
                    {st === 'No Show' ? 'No show reason' : 'Cancel reason'}
                  </div>
                  <div className="text-[11px] leading-snug">{cancelReason}</div>
                  {job.cancelSource || job.cancelledBy ? (
                    <div className="text-[10px] text-bw-muted">{dash(job.cancelSource || job.cancelledBy)}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel title="Assignment & billing">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              <Field label="Driver" value={closedJobDriverDisplay(job)} />
              <Field label="Vehicle" value={closedJobVehicleDisplay(job)} />
              <Field label="Vehicle type" value={dash(jobVehicleTypeLabel(job))} />
              <Field label="Tariff" value={dash(job.tariffName || job.tariffId)} />
              <Field
                label="Payment"
                value={`${closedJobPaymentDisplay(job, raw)} · ${closedJobFareDisplay(job)}`}
              />
              <Field label="Created by" value={createdBy} />
              <Field label="Created" value={created ? formatJobDateTimeShort(created) : '—'} />
              <Field
                label={`Pickup (${jobPickupTypeLabel(job)})`}
                value={pickup ? formatJobDateTimeShort(pickup) : dash(job.bookingDateTime)}
              />
            </div>
          </Panel>

          <Panel title="Fare breakdown">
            <FareBreakdownCompact fb={fareBreakdown} />
            {tariffLog.length > 0 ? (
              <div className="mt-2 pt-1.5 border-t border-bw-border/60">
                <div className="text-[10px] text-bw-muted mb-0.5">Tariff changes</div>
                <ul className="space-y-0.5 text-[10px] text-bw-text">
                  {tariffLog.slice(0, 3).map((entry, i) => (
                    <li key={i} className="truncate" title={summarizeTariffLogEntry(entry)}>
                      {summarizeTariffLogEntry(entry)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 min-h-0 shrink-0">
          <Panel title="Timeline" className="min-h-[120px] lg:min-h-0">
            {timeline.length === 0 ? (
              <p className="text-[11px] text-bw-muted">—</p>
            ) : (
              <ul className="space-y-0.5">
                {timeline.map((ev) => (
                  <li
                    key={ev.key}
                    className="grid grid-cols-[minmax(72px,88px)_minmax(88px,1fr)] gap-x-1.5 text-[10px] leading-tight"
                  >
                    <span className="text-bw-muted truncate">{ev.label}</span>
                    <span className="truncate" title={ev.detail ? `${formatTimelineWhen(ev.at)} — ${ev.detail}` : formatTimelineWhen(ev.at)}>
                      <span className="font-medium">{formatTimelineWhen(ev.at)}</span>
                      {ev.detail ? <span className="text-bw-muted"> · {ev.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Edit history" className="min-h-[120px] lg:min-h-0">
            {history.length === 0 ? (
              <p className="text-[11px] text-bw-muted">—</p>
            ) : (
              <ul className="space-y-0.5">
                {history.slice(0, 6).map((entry, i) => (
                  <li key={`${entry.at}-${i}`} className="text-[10px] leading-tight">
                    <div className="text-bw-muted truncate">
                      {formatJobEditHistoryWhen(entry)}
                      {entry.byName ? ` · ${entry.byName}` : entry.by ? ` · ${entry.by}` : ''}
                    </div>
                    <div className="truncate" title={entry.summary}>{entry.summary}</div>
                  </li>
                ))}
                {history.length > 6 ? (
                  <li className="text-[10px] text-bw-muted">+{history.length - 6} more</li>
                ) : null}
              </ul>
            )}
          </Panel>

          <Panel title="Route" className="flex flex-col min-h-[120px]">
            {hasMap ? (
              <ClosedJobRouteMap
                mapsKey={mapsKey}
                route={gpsRoute}
                pick={endpoints.pick}
                drop={endpoints.drop}
                height={130}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-[10px] text-bw-muted text-center px-2">
                GPS route not recorded
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Modal>
  );
}

export function ClosedJobDetailModal({ companyId, mapsKey }: ClosedJobDetailModalProps) {
  const open = useUiStore((s) => s.openModal === 'closedJobDetail');
  const jobId = useUiStore((s) => s.modalJobId);
  const closeModal = useUiStore((s) => s.closeModal);

  const { detail, loading, error } = useClosedJobDetail(companyId, jobId, open && !!jobId);

  const title = jobId ? `Closed Job #${jobId}` : 'Closed Job';

  if (!open) return null;

  if (loading) {
    return (
      <Modal open={open} onClose={closeModal} title={title} extraWide bodyClassName="p-3">
        <div className="flex items-center justify-center py-10 gap-2 text-bw-muted text-xs">
          <Spinner />
          Loading closed job…
        </div>
      </Modal>
    );
  }

  if (error || !detail) {
    return (
      <Modal
        open={open}
        onClose={closeModal}
        title={title}
        extraWide
        bodyClassName="p-3"
        footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
      >
        <p className="text-bw-muted text-xs">{error || 'Job not found.'}</p>
      </Modal>
    );
  }

  return (
    <ClosedJobDetailBody
      companyId={companyId}
      mapsKey={mapsKey}
      detail={detail}
      closeModal={closeModal}
    />
  );
}
