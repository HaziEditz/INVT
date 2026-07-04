import { useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { useUiStore } from '@/store/uiStore';
import { useClosedJobs } from '@/hooks/useJobs';
import { normalizeJobStatus } from '@/lib/jobStatusAuthority';

interface ClosedJobsModalProps {
  companyId: string;
}

function formatCancelledAt(raw?: string): string {
  if (!raw) return '—';
  try {
    const d = parseISO(raw.includes('T') ? raw : raw.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return raw;
    return format(d, 'dd/MM/yyyy HH:mm');
  } catch {
    return raw;
  }
}

function formatClosedBy(job: { status?: string; cancelledBy?: string; cancelSource?: string; terminalKind?: string }): string {
  const st = normalizeJobStatus(job.status || '');
  if (st !== 'Cancelled' && st !== 'No Show') return '—';
  if (st === 'No Show') return 'Driver (No Show)';
  const src = job.cancelSource?.trim();
  if (src) return `Cancelled by ${src}`;
  return job.cancelledBy?.trim() || '—';
}

export function ClosedJobsModal({ companyId }: ClosedJobsModalProps) {
  const open = useUiStore((s) => s.openModal === 'closedJobs');
  const closeModal = useUiStore((s) => s.closeModal);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const closed = useClosedJobs(companyId, open);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const filtered = closed.filter((j) => {
    const d = j.completedAt || Date.parse(j.cancelledAt || j.bookingDateTime);
    if (!d) return true;
    const day = format(new Date(d), 'yyyy-MM-dd');
    return day >= from && day <= to;
  });

  const totalFare = filtered.reduce((s, j) => s + parseFloat(j.totalFare || j.estimatedFare || '0'), 0);

  const preset = (days: number) => {
    const t = new Date();
    setTo(format(t, 'yyyy-MM-dd'));
    setFrom(format(subDays(t, days), 'yyyy-MM-dd'));
  };

  return (
    <Modal open={open} onClose={closeModal} title="Closed Jobs" wide footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <label className="text-xs text-bw-muted">
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 px-2 py-1 rounded bg-bw-bg border border-bw-border" />
        </label>
        <label className="text-xs text-bw-muted">
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 px-2 py-1 rounded bg-bw-bg border border-bw-border" />
        </label>
        <Button variant="ghost" onClick={() => { setFrom(today); setTo(today); }}>Today</Button>
        <Button variant="ghost" onClick={() => preset(1)}>Yesterday</Button>
        <Button variant="ghost" onClick={() => preset(6)}>7 Days</Button>
        <Button variant="ghost" onClick={() => preset(29)}>30 Days</Button>
      </div>
      <div className="text-xs text-bw-muted mb-2">
        {filtered.length} jobs · Total fare ${totalFare.toFixed(2)}
      </div>
      <div className="overflow-x-auto max-h-[50vh]">
        <table className="w-full text-xs">
          <thead className="text-bw-muted uppercase sticky top-0 bg-bw-card">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Passenger</th>
              <th className="text-left p-2">Pickup</th>
              <th className="text-left p-2">Fare</th>
              <th className="text-left p-2">Payment</th>
              <th className="text-left p-2">Cancelled By</th>
              <th className="text-left p-2">Cancelled At</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => {
              const st = normalizeJobStatus(j.status);
              const isCancelled = st === 'Cancelled';
              const isNoShow = st === 'No Show';
              return (
                <tr key={j.id} className="border-t border-bw-border hover:bg-bw-surface">
                  <td className="p-2 font-mono">#{j.id}</td>
                  <td className="p-2">
                    {isNoShow ? (
                      <Badge color="#f97316">NO SHOW</Badge>
                    ) : isCancelled ? (
                      <Badge color="#ef4444">CANCELLED</Badge>
                    ) : (
                      <Badge color="#22c55e">COMPLETED</Badge>
                    )}
                  </td>
                  <td className="p-2">{j.passengerName}</td>
                  <td className="p-2 truncate max-w-[200px]">{j.pickAddress}</td>
                  <td className="p-2">${j.totalFare || j.estimatedFare || '0'}</td>
                  <td className="p-2">{j.paymentType}</td>
                  <td className="p-2">{isCancelled || isNoShow ? formatClosedBy(j) : '—'}</td>
                  <td className="p-2">{isCancelled || isNoShow ? formatCancelledAt(j.cancelledAt) : '—'}</td>
                  <td className="p-2">
                    <Button variant="ghost" onClick={() => { closeModal(); openModalWith('jobDetail', { jobId: j.id }); }}>View</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
