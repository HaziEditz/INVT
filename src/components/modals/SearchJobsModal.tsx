import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { useJobStore } from '@/store/jobStore';
import { useUiStore } from '@/store/uiStore';
import { searchLiveJobs } from '@/lib/searchLiveJobs';

interface SearchJobsModalProps {
  companyId: string | null;
}

export function SearchJobsModal({ companyId: _companyId }: SearchJobsModalProps) {
  const open = useUiStore((s) => s.openModal === 'searchJobs');
  const closeModal = useUiStore((s) => s.closeModal);
  const openModalWith = useUiStore((s) => s.openModalWith);
  const jobs = useJobStore((s) => s.jobs);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      return;
    }
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const results = useMemo(() => searchLiveJobs(jobs, debounced), [jobs, debounced]);

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Filter Jobs"
      wide
      footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-bw-bg border border-bw-border text-sm mb-3"
        placeholder="Booking ID, passenger, phone, driver, address…"
        autoFocus
      />

      <div className="space-y-2 max-h-[50vh] overflow-y-auto min-h-[120px]">
        {!debounced.trim() ? (
          <p className="text-bw-muted text-sm text-center py-10">Type to search across all live job boards</p>
        ) : results.length === 0 ? (
          <p className="text-bw-muted text-sm text-center py-10">No matching live jobs</p>
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
    </Modal>
  );
}
