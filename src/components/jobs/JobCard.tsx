import { useMemo } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Edit, X, CheckCircle, RotateCcw } from 'lucide-react';
import type { Job, JobTab } from '@/types/job';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { serviceBorderColor, sourceLabel } from '@/lib/utils';
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

interface JobCardProps {
  job: Job;
  tab: JobTab;
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

  const waitLabel = (() => {
    try {
      const d = parseISO(job.bookingDateTime);
      return formatDistanceToNow(d, { addSuffix: false });
    } catch {
      return '—';
    }
  })();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      addToast({ type: 'success', title: ok });
    } catch (e) {
      addToast({ type: 'error', title: 'Action failed', message: e instanceof Error ? e.message : '' });
    }
  };

  return (
    <div
      className={`bw-card p-3 mb-2 border-l-4 ${job.urgent ? 'ring-1 ring-bw-warning/50' : ''}`}
      style={{ borderLeftColor: border }}
    >
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        <span className="font-mono text-sm font-bold text-bw-text">#{job.id}</span>
        <Badge color="#94a3b8">{sourceLabel(job.source)}</Badge>
        <Badge color={border}>{job.serviceType.toUpperCase()}</Badge>
        {job.accountId && <Badge color="#ec4899">ACC</Badge>}
        {job.urgent && <Badge color="#f59e0b">URGENT</Badge>}
        <span className="ml-auto text-[10px] text-bw-muted uppercase">{job.status}</span>
      </div>

      <div className="space-y-1 text-xs mb-2">
        <div className="flex gap-2">
          <span className="text-bw-success shrink-0">●</span>
          <span className="text-bw-text truncate">{job.pickAddress || 'No pickup'}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-bw-danger shrink-0">●</span>
          <span className="text-bw-muted truncate">{job.dropAddress || 'No dropoff'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 text-[11px] text-bw-muted mb-2">
        <span>{job.passengerName || '—'}</span>
        <span>{job.passengerPhone || '—'}</span>
        <span>{job.paymentType}</span>
        <span>${job.estimatedFare || '0'}</span>
        <span>{waitLabel} waiting</span>
      </div>

      {tab === 'offer' && job.offeredAt && (
        <div className="text-[10px] text-bw-warning mb-2">
          Offer expires {formatDistanceToNow(job.offeredAt + 30000, { addSuffix: true })}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {tab === 'ua' && (
          <>
            <Button variant="primary" onClick={() => run(() => setPending(job), 'Set Pending')}>
              Pending
            </Button>
            <Button variant="muted" onClick={() => run(() => setNoOne(job), 'Set No One')}>
              No One
            </Button>
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
                <option key={d.driverId} value={d.driverId}>
                  {d.vehicleNo} {d.driverName}
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => openModalWith('createJob', { jobId: job.id })}>
              <Edit size={12} />
            </Button>
            <Button variant="danger" onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
              <X size={12} />
            </Button>
          </>
        )}
        {tab === 'offer' && (
          <Button variant="danger" onClick={() => run(() => cancelJob(job.id), 'Offer cancelled')}>
            Cancel Offer
          </Button>
        )}
        {(tab === 'assign' || tab === 'active') && (
          <>
            <Button variant="success" onClick={() => run(() => forceCompleteJob(job.id), 'Completed')}>
              <CheckCircle size={12} /> Complete
            </Button>
            <Button variant="danger" onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
              <X size={12} />
            </Button>
          </>
        )}
        {tab === 'queue' && (
          <>
            <Button
              variant="primary"
              onClick={() =>
                run(
                  () => recallJob(job.id, job.originalStatus || 'Pending'),
                  'Recalled to U-A'
                )
              }
            >
              <RotateCcw size={12} /> Recall
            </Button>
            <Button variant="danger" onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
              <X size={12} />
            </Button>
          </>
        )}
        {tab === 'dy' && (
          <>
            <Button variant="primary" onClick={() => run(() => setPending(job), 'Pending')}>
              Pending
            </Button>
            <Button variant="danger" onClick={() => run(() => cancelJob(job.id), 'Cancelled')}>
              <X size={12} />
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => openModalWith('jobDetail', { jobId: job.id })}>
          Details
        </Button>
      </div>
    </div>
  );
}
