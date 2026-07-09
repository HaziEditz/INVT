import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { searchLiveJobs } from '@/lib/searchLiveJobs';
import {
  EMPTY_LIVE_JOB_FILTERS,
  LIVE_STATUS_FILTER_OPTIONS,
  filterLiveJobs,
  type LiveJobFilters,
  uniqueLiveJobDrivers,
} from '@/lib/liveJobFilters';
import { CJ_SERVICES } from '@/lib/createJobForm';
import { serviceTypeDisplay } from '@/lib/closedJobs';
import { useCompanyDriverRoster } from '@/hooks/useCompanyDriverRoster';
import { useCompanyZones } from '@/hooks/useCompanyZones';

interface SearchJobsModalProps {
  companyId: string | null;
}

const FILTER_SELECT =
  'px-2 py-1.5 rounded-md bg-bw-bg border border-bw-border text-xs text-bw-text min-w-[120px] focus:border-bw-primary focus:outline-none';

const FILTER_INPUT =
  'px-2 py-1.5 rounded-md bg-bw-bg border border-bw-border text-xs text-bw-text focus:border-bw-primary focus:outline-none';

export function SearchJobsModal({ companyId }: SearchJobsModalProps) {
  const open = useUiStore((s) => s.openModal === 'searchJobs');
  const closeModal = useUiStore((s) => s.closeModal);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const jobs = useJobStore((s) => s.jobs);
  const liveJobFilters = useJobStore((s) => s.liveJobFilters);
  const setLiveJobFilters = useJobStore((s) => s.setLiveJobFilters);
  const clearLiveJobFilters = useJobStore((s) => s.clearLiveJobFilters);
  const roster = useCompanyDriverRoster(companyId);
  const zones = useCompanyZones(companyId);

  const [draft, setDraft] = useState<LiveJobFilters>(EMPTY_LIVE_JOB_FILTERS);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      return;
    }
    setDraft({ ...liveJobFilters });
  }, [open, liveJobFilters]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const drivers = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of roster) map.set(d.driverId, d.driverName || d.driverId);
    for (const d of uniqueLiveJobDrivers(jobs)) map.set(d.id, d.label);
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [roster, jobs]);

  const previewCount = useMemo(
    () => filterLiveJobs(jobs, draft, zones).length,
    [jobs, draft, zones],
  );

  const results = useMemo(() => searchLiveJobs(jobs, debounced), [jobs, debounced]);

  const patchDraft = (partial: Partial<LiveJobFilters>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const applyFilters = () => {
    setLiveJobFilters(draft);
    closeModal();
  };

  const clearAll = () => {
    setDraft({ ...EMPTY_LIVE_JOB_FILTERS });
    clearLiveJobFilters();
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Filter Jobs"
      wide
      light
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="ghost" onClick={clearAll}>
            Clear all
          </Button>
          <Button variant="primary" onClick={applyFilters}>
            Apply filters
          </Button>
          <Button variant="ghost" onClick={closeModal}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg border border-bw-border bg-bw-surface/60">
          <label className="text-xs text-bw-text flex flex-col gap-1">
            Driver
            <select
              value={draft.driverId}
              onChange={(e) => patchDraft({ driverId: e.target.value })}
              className={FILTER_SELECT}
            >
              <option value="">All drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-bw-text flex flex-col gap-1">
            Service type
            <select
              value={draft.serviceType}
              onChange={(e) => patchDraft({ serviceType: e.target.value })}
              className={FILTER_SELECT}
            >
              <option value="">All services</option>
              {CJ_SERVICES.map((s) => (
                <option key={s} value={s}>
                  {serviceTypeDisplay(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-bw-text flex flex-col gap-1">
            Job type
            <select
              value={draft.jobType}
              onChange={(e) => patchDraft({ jobType: e.target.value as LiveJobFilters['jobType'] })}
              className={FILTER_SELECT}
            >
              <option value="">ASAP & Later</option>
              <option value="ASAP">ASAP</option>
              <option value="LATER">Later</option>
            </select>
          </label>

          <label className="text-xs text-bw-text flex flex-col gap-1">
            Zone
            <select
              value={draft.zoneId}
              onChange={(e) => patchDraft({ zoneId: e.target.value })}
              className={FILTER_SELECT}
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name || `Zone ${z.zoneNumber}`}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-bw-text flex flex-col gap-1">
            Status
            <select
              value={draft.status}
              onChange={(e) => patchDraft({ status: e.target.value })}
              className={FILTER_SELECT}
            >
              <option value="">All statuses</option>
              {LIVE_STATUS_FILTER_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-bw-muted">
          Filters apply across all live tabs (U-A, Offer, Assign, Queue, Active, DY). Preview:{' '}
          <span className="font-semibold text-bw-text">{previewCount}</span> matching job(s).
        </p>

        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${FILTER_INPUT} w-full`}
            placeholder="Quick find: booking ID, passenger, phone, driver, address…"
          />
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto min-h-[100px]">
          {!debounced.trim() ? (
            <p className="text-bw-muted text-sm text-center py-8">
              Use dropdowns above and Apply, or type to quick-find a job
            </p>
          ) : results.length === 0 ? (
            <p className="text-bw-muted text-sm text-center py-8">No matching live jobs</p>
          ) : (
            results.map(({ job, tabLabel }) => (
              <div
                key={job.id}
                className="bw-card p-3 hover:border-bw-primary cursor-pointer border-l-4 border-l-[var(--bw-accent)]"
                onClick={() => openModalWith('jobDetail', { jobId: job.id })}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-[var(--bw-accent)]">#{job.id}</span>
                  <Badge>{tabLabel}</Badge>
                  <span className="text-[10px] text-bw-muted uppercase">{job.status}</span>
                </div>
                <div className="text-xs text-bw-text">
                  {job.passengerName || '—'}
                  {job.passengerPhone ? ` · ${job.passengerPhone}` : ''}
                </div>
                <div className="text-xs text-bw-muted truncate mt-0.5">{job.pickAddress || '—'}</div>
                {(job.driverName || job.vehicleNo) && (
                  <div className="text-[10px] text-bw-muted mt-1">
                    {job.driverName || job.driverId || '—'}
                    {job.vehicleNo ? ` · ${job.vehicleNo}` : ''}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
