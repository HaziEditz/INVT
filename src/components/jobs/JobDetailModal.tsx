import { format, parseISO } from 'date-fns';
import { FileDown, Mail } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { generateJobPdf } from '@/lib/pdf';
import { serviceBorderColor, sourceLabel } from '@/lib/utils';

export function JobDetailModal() {
  const open = useUiStore((s) => s.openModal === 'jobDetail');
  const jobId = useUiStore((s) => s.modalJobId);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useUiStore((s) => s.settings);
  const jobs = useJobStore((s) => s.jobs);
  const job = jobs.find((j) => j.id === jobId) || (jobId ? { id: jobId } as typeof jobs[0] : null);

  if (!job || !job.pickAddress) {
    return (
      <Modal open={open && !!jobId} onClose={closeModal} title={`Job #${jobId}`} wide>
        <p className="text-bw-muted text-sm">Loading job details…</p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={`Job #${job.id}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={closeModal}>Close</Button>
          <Button variant="gold" onClick={() => generateJobPdf(job, settings?.companyName || 'BookaWaka')}>
            <FileDown size={14} /> PDF
          </Button>
          <Button variant="ghost" disabled>
            <Mail size={14} /> Email
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge color={serviceBorderColor(job.serviceType)}>{job.serviceType.toUpperCase()}</Badge>
          <Badge>{sourceLabel(job.source)}</Badge>
          <span className="text-bw-muted">{job.status}</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bw-card p-3 space-y-2">
            <div><span className="text-bw-muted text-xs">Pickup</span><p>{job.pickAddress}</p></div>
            <div><span className="text-bw-muted text-xs">Dropoff</span><p>{job.dropAddress || '—'}</p></div>
            <div><span className="text-bw-muted text-xs">Passenger</span><p>{job.passengerName} · {job.passengerPhone}</p></div>
          </div>
          <div className="bw-card p-3 space-y-2">
            <div><span className="text-bw-muted text-xs">Driver</span><p>{job.driverName || job.driverId || '—'}</p></div>
            <div><span className="text-bw-muted text-xs">Vehicle</span><p>{job.vehicleNo || job.vehicleId || '—'}</p></div>
            <div><span className="text-bw-muted text-xs">Payment</span><p>{job.paymentType} · ${job.totalFare || job.estimatedFare || '0'}</p></div>
            <div><span className="text-bw-muted text-xs">Booked</span><p>{job.bookingDateTime}</p></div>
          </div>
        </div>
        {job.tm && (
          <div className="bw-card p-3">
            <h4 className="font-bold text-cyan-400 mb-2">Total Mobility</h4>
            <p className="text-xs text-bw-muted">Card: {job.tm.cardNumber} · Council pays: ${job.tm.councilPays} · Passenger: ${job.tm.passengerPays}</p>
          </div>
        )}
        {job.acc && (
          <div className="bw-card p-3">
            <h4 className="font-bold text-pink-400 mb-2">ACC</h4>
            <p className="text-xs">Claim: {job.acc.claimNumber} · PO: {job.acc.poNumber} · {job.acc.clientName}</p>
          </div>
        )}
        {job.notes && (
          <div className="text-xs text-bw-muted border-t border-bw-border pt-2">Notes: {job.notes}</div>
        )}
        <div className="text-[10px] text-bw-muted">
          Timeline: Booked {(() => { try { return format(parseISO(job.bookingDateTime), 'PPpp'); } catch { return job.bookingDateTime; } })()}
        </div>
      </div>
    </Modal>
  );
}
