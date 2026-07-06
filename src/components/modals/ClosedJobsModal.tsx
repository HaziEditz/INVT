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

function formatTerminalAt(ms?: number, fallback?: string): string {
  if (ms && ms > 0) {
    try {
      return format(new Date(ms), 'dd/MM/yyyy HH:mm');
    } catch {
      /* fall through */
    }
  }
  if (fallback) {
    try {
      const d = parseISO(fallback.includes('T') ? fallback : fallback.replace(' ', 'T'));
      if (!Number.isNaN(d.getTime())) return format(d, 'dd/MM/yyyy HH:mm');
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

function selectClassName() {
  return 'px-2 py-1 rounded bg-bw-bg border border-bw-border text-xs min-w-[100px]';
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
      wide
      footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
    >
      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Booking ID, passenger, phone, driver, address…"
          className="flex-1 min-w-[200px] px-2 py-1 rounded bg-bw-bg border border-bw-border text-xs"
        />
        <label className="text-xs text-bw-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-1 px-2 py-1 rounded bg-bw-bg border border-bw-border"
          />
        </label>
        <label className="text-xs text-bw-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-1 px-2 py-1 rounded bg-bw-bg border border-bw-border"
          />
        </label>
        <Button variant="ghost" onClick={() => preset(0)}>Today</Button>
        <Button variant="ghost" onClick={() => preset(6)}>7 Days</Button>
        <Button variant="ghost" onClick={() => preset(29)}>30 Days</Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ClosedJobFilters['status'])}
          className={selectClassName()}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={selectClassName()}>
          <option value="">All drivers</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className={selectClassName()}
        >
          <option value="">All services</option>
          {serviceTypes.map((s) => (
            <option key={s} value={s}>{serviceTypeDisplay(s)}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClassName()}>
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          className={selectClassName()}
        >
          <option value="">All vehicle types</option>
          {vehicleTypes.map((vt) => (
            <option key={vt} value={vt}>{vt}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-bw-muted mb-2">
        {filtered.length} of {closed.length} jobs · Total fare ${totalFare.toFixed(2)}
      </div>

      <div className="overflow-x-auto max-h-[55vh]">
        <table className="w-full text-xs">
          <thead className="text-bw-muted uppercase sticky top-0 bg-bw-card z-10">
            <tr>
              <th className="text-left p-2 whitespace-nowrap">ID</th>
              <th className="text-left p-2 whitespace-nowrap">Created</th>
              <th className="text-left p-2 whitespace-nowrap">Closed</th>
              <th className="text-left p-2 whitespace-nowrap">Status</th>
              <th className="text-left p-2 min-w-[120px]">Pickup</th>
              <th className="text-left p-2 min-w-[120px]">Dropoff</th>
              <th className="text-left p-2 whitespace-nowrap">Driver</th>
              <th className="text-left p-2 whitespace-nowrap">Vehicle</th>
              <th className="text-left p-2 whitespace-nowrap">Fare</th>
              <th className="text-left p-2 whitespace-nowrap">Payment</th>
              <th className="text-left p-2 whitespace-nowrap">Service</th>
              <th className="text-left p-2 whitespace-nowrap">Source</th>
              <th className="text-left p-2 whitespace-nowrap">Type</th>
              <th className="p-2 whitespace-nowrap">View</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} className="p-8 text-center text-bw-muted">
                  No closed jobs for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((j) => {
                const st = normalizeJobStatus(j.status);
                const isCancelled = st === 'Cancelled';
                const isNoShow = st === 'No Show';
                return (
                  <tr key={j.id} className="border-t border-bw-border hover:bg-bw-surface">
                    <td className="p-2 font-mono whitespace-nowrap">#{j.id}</td>
                    <td className="p-2 whitespace-nowrap">{formatCreatedAt(j)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {formatTerminalAt(j.completedAt, j.cancelledAt)}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {isNoShow ? (
                        <Badge color="#f97316">NO SHOW</Badge>
                      ) : isCancelled ? (
                        <Badge color="#ef4444">CANCELLED</Badge>
                      ) : (
                        <Badge color="#22c55e">COMPLETED</Badge>
                      )}
                    </td>
                    <td className="p-2 max-w-[160px] truncate" title={j.pickAddress}>
                      {j.pickAddress?.trim() || '—'}
                    </td>
                    <td className="p-2 max-w-[160px] truncate" title={j.dropAddress}>
                      {j.dropAddress?.trim() || '—'}
                    </td>
                    <td className="p-2 whitespace-nowrap">{closedJobDriverDisplay(j)}</td>
                    <td className="p-2 whitespace-nowrap">{closedJobVehicleDisplay(j)}</td>
                    <td className="p-2 whitespace-nowrap">{closedJobFareDisplay(j)}</td>
                    <td className="p-2 whitespace-nowrap">{j.paymentType?.trim() || '—'}</td>
                    <td className="p-2 whitespace-nowrap">{serviceTypeDisplay(j.serviceType)}</td>
                    <td className="p-2 whitespace-nowrap">{closedJobSourceDisplay(j)}</td>
                    <td className="p-2 whitespace-nowrap">{closedJobTypeDisplay(j)}</td>
                    <td className="p-2 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          closeModal();
                          openModalWith('closedJobDetail', { jobId: j.id });
                        }}
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
    </Modal>
  );
}
