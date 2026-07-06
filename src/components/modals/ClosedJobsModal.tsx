import { useEffect, useMemo, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { useUiStore } from '@/store/uiStore';
import { useClosedJobs } from '@/hooks/useJobs';
import { normalizeJobStatus } from '@/lib/jobStatusAuthority';
import {
  closedJobDriverDisplay,
  closedJobFareDisplay,
  closedJobPaymentDisplay,
  closedJobSourceDisplay,
  closedJobTypeDisplay,
  closedJobVehicleDisplay,
  filterClosedJobs,
  serviceTypeDisplay,
  uniqueClosedJobDrivers,
  uniqueClosedJobVehicleTypes,
  type ClosedJobFilters,
} from '@/lib/closedJobs';
import { formatJobDateTimeShort, jobCreatedAtTime } from '@/types/job';
import type { BookingSource, Job, ServiceType } from '@/types/job';

interface ClosedJobsModalProps {
  companyId: string;
}

const STATUS_OPTIONS = ['all', 'Completed', 'Cancelled', 'No Show'] as const;
const SOURCE_OPTIONS: { value: BookingSource | ''; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'web', label: 'Website' },
  { value: 'passenger', label: 'Passenger App' },
  { value: 'hail', label: 'Hail' },
];

const FILTER_SELECT =
  'px-2 py-1.5 rounded-md bg-bw-surface border border-bw-border text-xs text-bw-text min-w-[100px] focus:border-bw-primary focus:outline-none';

const FILTER_INPUT =
  'px-2 py-1.5 rounded-md bg-bw-surface border border-bw-border text-xs text-bw-text focus:border-bw-primary focus:outline-none';

const TH =
  'text-left p-1.5 text-[10px] font-semibold text-bw-text uppercase tracking-wide border-r border-b border-bw-border bg-bw-surface whitespace-nowrap';

const TD = 'p-1.5 text-bw-text border-r border-b border-bw-border align-middle';

function formatTerminalAt(ms?: number, fallback?: string): string {
  if (ms && ms > 0) {
    try {
      return format(new Date(ms), 'dd/MM/yy HH:mm');
    } catch {
      /* fall through */
    }
  }
  if (fallback) {
    try {
      const d = parseISO(fallback.includes('T') ? fallback : fallback.replace(' ', 'T'));
      if (!Number.isNaN(d.getTime())) return format(d, 'dd/MM/yy HH:mm');
    } catch {
      return fallback;
    }
  }
  return '—';
}

function formatCreatedAt(job: Job): string {
  const created = jobCreatedAtTime(job);
  if (created) return formatJobDateTimeShort(created);
  if (job.bookingDateTime?.trim()) return job.bookingDateTime.trim();
  return '—';
}

function defaultDateRange() {
  const t = new Date();
  return {
    from: format(subDays(t, 6), 'yyyy-MM-dd'),
    to: format(t, 'yyyy-MM-dd'),
  };
}

export function ClosedJobsModal({ companyId }: ClosedJobsModalProps) {
  const open = useUiStore((s) => s.openModal === 'closedJobs');
  const closeModal = useUiStore((s) => s.closeModal);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const closed = useClosedJobs(companyId, open);

  const initialRange = defaultDateRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ClosedJobFilters['status']>('all');
  const [driverId, setDriverId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [source, setSource] = useState('');
  const [vehicleType, setVehicleType] = useState('');

  useEffect(() => {
    if (!open) return;
    const range = defaultDateRange();
    setFrom(range.from);
    setTo(range.to);
    setQuery('');
    setStatus('all');
    setDriverId('');
    setServiceType('');
    setSource('');
    setVehicleType('');
  }, [open]);

  const filters: ClosedJobFilters = useMemo(
    () => ({ from, to, query, status, driverId, serviceType, source, vehicleType }),
    [from, to, query, status, driverId, serviceType, source, vehicleType],
  );

  const filtered = useMemo(() => filterClosedJobs(closed, filters), [closed, filters]);
  const drivers = useMemo(() => uniqueClosedJobDrivers(closed), [closed]);
  const vehicleTypes = useMemo(() => uniqueClosedJobVehicleTypes(closed), [closed]);

  const serviceTypes = useMemo(() => {
    const set = new Set<ServiceType>();
    for (const j of closed) set.add(j.serviceType);
    return Array.from(set).sort();
  }, [closed]);

  const totalFare = filtered.reduce((s, j) => {
    const raw = parseFloat((j.totalFare || j.estimatedFare || '0').replace(/^\$/, ''));
    return s + (Number.isNaN(raw) ? 0 : raw);
  }, 0);

  const preset = (daysBack: number) => {
    const t = new Date();
    setTo(format(t, 'yyyy-MM-dd'));
    setFrom(format(subDays(t, daysBack), 'yyyy-MM-dd'));
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Closed Jobs"
      extraWide
      footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-bw-border bg-bw-surface/60">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Booking ID, passenger, phone, driver, address…"
            className={`${FILTER_INPUT} flex-1 min-w-[200px]`}
          />
          <label className="text-xs text-bw-text">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${FILTER_INPUT} ml-1`}
            />
          </label>
          <label className="text-xs text-bw-text">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${FILTER_INPUT} ml-1`}
            />
          </label>
          <Button variant="muted" onClick={() => preset(0)}>Today</Button>
          <Button variant="muted" onClick={() => preset(6)}>7 Days</Button>
          <Button variant="muted" onClick={() => preset(29)}>30 Days</Button>
        </div>

        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-bw-border bg-bw-surface/60">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ClosedJobFilters['status'])}
            className={FILTER_SELECT}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={FILTER_SELECT}>
            <option value="">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className={FILTER_SELECT}
          >
            <option value="">All services</option>
            {serviceTypes.map((s) => (
              <option key={s} value={s}>{serviceTypeDisplay(s)}</option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={FILTER_SELECT}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className={FILTER_SELECT}
          >
            <option value="">All vehicle types</option>
            {vehicleTypes.map((vt) => (
              <option key={vt} value={vt}>{vt}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-bw-muted px-1">
          {filtered.length} of {closed.length} jobs · Total fare ${totalFare.toFixed(2)}
        </div>

        <div className="overflow-auto max-h-[58vh] rounded-lg border border-bw-border bg-bw-card">
          <table className="w-full text-[11px] border-collapse min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={TH}>ID</th>
                <th className={TH}>Created</th>
                <th className={TH}>Closed</th>
                <th className={TH}>Status</th>
                <th className={`${TH} max-w-[120px]`}>Pickup</th>
                <th className={`${TH} max-w-[120px]`}>Dropoff</th>
                <th className={TH}>Driver</th>
                <th className={TH}>Vehicle</th>
                <th className={TH}>Fare</th>
                <th className={TH}>Payment</th>
                <th className={TH}>Service</th>
                <th className={TH}>Source</th>
                <th className={TH}>Type</th>
                <th className={`${TH} border-r-0 sticky right-0 z-20 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.5)]`}>
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-bw-muted border-b border-bw-border">
                    No closed jobs for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((j) => {
                  const st = normalizeJobStatus(j.status);
                  const isCancelled = st === 'Cancelled';
                  const isNoShow = st === 'No Show';
                  return (
                    <tr key={j.id} className="group hover:bg-bw-surface/80">
                      <td className={`${TD} font-mono font-semibold text-[var(--bw-accent)]`}>#{j.id}</td>
                      <td className={`${TD} whitespace-nowrap`}>{formatCreatedAt(j)}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {formatTerminalAt(j.completedAt, j.cancelledAt)}
                      </td>
                      <td className={TD}>
                        {isNoShow ? (
                          <Badge color="#f97316">NO SHOW</Badge>
                        ) : isCancelled ? (
                          <Badge color="#ef4444">CANCELLED</Badge>
                        ) : (
                          <Badge color="#22c55e">COMPLETED</Badge>
                        )}
                      </td>
                      <td className={`${TD} max-w-[120px] truncate`} title={j.pickAddress}>
                        {j.pickAddress?.trim() || '—'}
                      </td>
                      <td className={`${TD} max-w-[120px] truncate`} title={j.dropAddress}>
                        {j.dropAddress?.trim() || '—'}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{closedJobDriverDisplay(j)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{closedJobVehicleDisplay(j)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{closedJobFareDisplay(j)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{closedJobPaymentDisplay(j)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{serviceTypeDisplay(j.serviceType)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{closedJobSourceDisplay(j)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{closedJobTypeDisplay(j)}</td>
                      <td
                        className={`${TD} border-r-0 whitespace-nowrap sticky right-0 z-10 bg-bw-card group-hover:bg-bw-surface shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.5)]`}
                      >
                        <Button
                          variant="primary"
                          onClick={() => openModalWith('closedJobDetail', { jobId: j.id })}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
