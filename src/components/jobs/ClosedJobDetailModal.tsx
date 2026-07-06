import { FileDown } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Spinner } from '@/components/shared/Spinner';
import { useUiStore } from '@/store/uiStore';
import { useClosedJobDetail } from '@/hooks/useClosedJobDetail';
import { ClosedJobRouteMap } from '@/components/jobs/ClosedJobRouteMap';
import { generateJobPdf } from '@/lib/pdf';
import { serviceBorderColor, sourceDisplayName } from '@/lib/utils';
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

function dash(value?: string | null): string {
  const v = String(value ?? '').trim();
  return v || '—';
}

function money(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function FareBreakdownCard({ fb }: { fb: ClosedFareBreakdown | null }) {
  if (!fb) {
    return (
      <div className="bw-card p-3 text-xs text-bw-muted">
        Fare breakdown not recorded for this trip.
      </div>
    );
  }
  return (
    <div className="bw-card p-3 space-y-1 text-xs">
      <div className="flex justify-between gap-4">
        <span className="text-bw-muted">Flag fall</span>
        <span>{money(fb.flagFall)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-bw-muted">Distance</span>
        <span>
          {fb.distanceKm != null ? `${fb.distanceKm.toFixed(2)} km` : '—'}
          {fb.distanceCharge != null ? ` · ${money(fb.distanceCharge)}` : ''}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-bw-muted">Waiting</span>
        <span>
          {fb.waitingMinutes != null ? `${fb.waitingMinutes.toFixed(1)} min` : '—'}
          {fb.waitingCharge != null ? ` · ${money(fb.waitingCharge)}` : ''}
        </span>
      </div>
      <div className="flex justify-between gap-4 font-semibold border-t border-bw-border pt-2 mt-2">
        <span>Total</span>
        <span>{money(fb.total)}</span>
      </div>
    </div>
  );
}

export function ClosedJobDetailModal({ companyId, mapsKey }: ClosedJobDetailModalProps) {
  const open = useUiStore((s) => s.openModal === 'closedJobDetail');
  const jobId = useUiStore((s) => s.modalJobId);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useUiStore((s) => s.settings);

  const { detail, loading, error } = useClosedJobDetail(companyId, jobId, open && !!jobId);

  const title = jobId ? `Closed Job #${jobId}` : 'Closed Job';

  if (!open) return null;

  if (loading) {
    return (
      <Modal open={open} onClose={closeModal} title={title} wide>
        <div className="flex items-center justify-center py-16 gap-3 text-bw-muted text-sm">
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
        wide
        footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
      >
        <p className="text-bw-muted text-sm">{error || 'Job not found.'}</p>
      </Modal>
    );
  }

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

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={title}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>Close</Button>
          <Button variant="gold" onClick={() => generateJobPdf(job, settings?.companyName || 'BookaWaka')}>
            <FileDown size={14} /> PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge color={serviceBorderColor(job.serviceType)}>{serviceTypeDisplay(job.serviceType)}</Badge>
          <Badge>{sourceDisplayName(job.source)}</Badge>
          <Badge
            color={
              st === 'No Show' ? '#f97316' : st === 'Cancelled' ? '#ef4444' : '#22c55e'
            }
          >
            {st.toUpperCase()}
          </Badge>
          <span className="text-bw-muted">{closedJobTypeDisplay(job)}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bw-card p-3 space-y-2">
            <div>
              <span className="text-bw-muted text-xs">Pickup</span>
              <p>{dash(job.pickAddress)}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Dropoff</span>
              <p>{dash(job.dropAddress)}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Passenger</span>
              <p>
                {dash(job.passengerName)}
                {job.passengerPhone ? ` · ${job.passengerPhone}` : ''}
              </p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Email</span>
              <p>{dash(job.passengerEmail)}</p>
            </div>
          </div>

          <div className="bw-card p-3 space-y-2">
            <div>
              <span className="text-bw-muted text-xs">Driver</span>
              <p>{closedJobDriverDisplay(job)}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Vehicle</span>
              <p>{closedJobVehicleDisplay(job)}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Vehicle type</span>
              <p>{dash(jobVehicleTypeLabel(job))}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Payment</span>
              <p>
                {closedJobPaymentDisplay(job, raw)} · {closedJobFareDisplay(job)}
              </p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Tariff</span>
              <p>{dash(job.tariffName || job.tariffId)}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Created by</span>
              <p>{createdBy}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Created at</span>
              <p>{created ? formatJobDateTimeShort(created) : '—'}</p>
            </div>
            <div>
              <span className="text-bw-muted text-xs">Pickup ({jobPickupTypeLabel(job)})</span>
              <p>{pickup ? formatJobDateTimeShort(pickup) : dash(job.bookingDateTime)}</p>
            </div>
          </div>
        </div>

        {cancelReason && (
          <div className="bw-card p-3">
            <h4 className="font-bold text-bw-muted text-xs mb-1 uppercase tracking-wide">
              {st === 'No Show' ? 'No Show reason' : 'Cancel reason'}
            </h4>
            <p>{cancelReason}</p>
            {job.cancelSource || job.cancelledBy ? (
              <p className="text-xs text-bw-muted mt-1">
                {dash(job.cancelSource || job.cancelledBy)}
              </p>
            ) : null}
          </div>
        )}

        <div className="bw-card p-3">
          <h4 className="font-bold text-bw-muted text-xs mb-2 uppercase tracking-wide">Timeline</h4>
          {timeline.length === 0 ? (
            <p className="text-xs text-bw-muted">—</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {timeline.map((ev) => (
                <li key={ev.key} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-bw-border/40 pb-2 last:border-0">
                  <span className="text-bw-muted min-w-[140px]">{ev.label}</span>
                  <span className="font-medium">{formatTimelineWhen(ev.at)}</span>
                  {ev.detail ? <span className="text-bw-muted w-full">{ev.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="font-bold text-bw-muted text-xs mb-2 uppercase tracking-wide">Fare breakdown</h4>
          <FareBreakdownCard fb={fareBreakdown} />
        </div>

        {tariffLog.length > 0 && (
          <div className="bw-card p-3">
            <h4 className="font-bold text-bw-muted text-xs mb-2 uppercase tracking-wide">Tariff changes</h4>
            <ul className="space-y-1 text-xs">
              {tariffLog.map((entry, i) => (
                <li key={i}>{summarizeTariffLogEntry(entry)}</li>
              ))}
            </ul>
          </div>
        )}

        {history.length > 0 && (
          <div className="bw-card p-3">
            <h4 className="font-bold text-bw-muted text-xs mb-2 uppercase tracking-wide">Edit history</h4>
            <ul className="space-y-2 text-xs max-h-48 overflow-y-auto">
              {history.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="border-b border-bw-border/50 pb-2 last:border-0">
                  <div className="text-bw-muted text-[10px]">
                    {formatJobEditHistoryWhen(entry)}
                    {entry.byName ? ` · ${entry.byName}` : entry.by ? ` · ${entry.by}` : ''}
                  </div>
                  <div>{entry.summary}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {job.notes && (
          <div className="text-xs text-bw-muted border-t border-bw-border pt-2">
            Notes: {job.notes}
          </div>
        )}

        <div>
          <h4 className="font-bold text-bw-muted text-xs mb-2 uppercase tracking-wide">Route</h4>
          {hasMap ? (
            <ClosedJobRouteMap
              mapsKey={mapsKey}
              route={gpsRoute}
              pick={endpoints.pick}
              drop={endpoints.drop}
            />
          ) : (
            <div className="bw-card p-4 text-xs text-bw-muted text-center">
              GPS route not recorded for this trip.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
