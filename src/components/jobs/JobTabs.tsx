import { useRef, useEffect, useState, useMemo } from 'react';
import { useJobStore, filterJobsForTab } from '@/store/jobStore';
import type { JobTab } from '@/types/job';
import { jobTabForStatus } from '@/lib/jobStatusAuthority';
import { JobCard } from './JobCard';
import { cn } from '@/lib/utils';

const TABS: { id: JobTab; label: string }[] = [
  { id: 'ua', label: 'U-A' },
  { id: 'offer', label: 'Offer' },
  { id: 'assign', label: 'Assign' },
  { id: 'queue', label: 'Queue' },
  { id: 'active', label: 'Active' },
  { id: 'dy', label: 'DY' },
];

export function JobTabs() {
  const activeTab = useJobStore((s) => s.activeTab);
  const setActiveTab = useJobStore((s) => s.setActiveTab);
  const jobs = useJobStore((s) => s.jobs);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const tabJobs = useMemo(() => filterJobsForTab(jobs, activeTab), [jobs, activeTab]);

  const countForTab = (tab: JobTab) => jobs.filter((j) => jobTabForStatus(j) === tab).length;

  useEffect(() => {
    const queueTabJobs = jobs.filter((j) => jobTabForStatus(j) === 'queue');
    const queueLike = jobs.filter((j) => {
      const raw = String(j.status ?? '').toLowerCase();
      return raw.includes('queue') || raw === 'busy';
    });
    if (queueTabJobs.length > 0 || queueLike.length > 0 || activeTab === 'queue') {
      console.log('[dispatch-queue-debug] JobTabs store', {
        totalJobs: jobs.length,
        activeTab,
        queueTabCount: queueTabJobs.length,
        queueTabIds: queueTabJobs.map((j) => j.id),
        queueLike: queueLike.map((j) => ({
          id: j.id,
          status: j.status,
          tab: jobTabForStatus(j),
          driverId: j.driverId,
        })),
        allJobs: jobs.map((j) => ({ id: j.id, status: j.status, tab: jobTabForStatus(j) })),
      });
      console.log('[dispatch-queue-debug] JobTabs filter', {
        activeTab,
        tabJobsCount: tabJobs.length,
        tabJobIds: tabJobs.map((j) => j.id),
      });
    }
  }, [jobs, activeTab, tabJobs]);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el?.parentElement) {
      const parent = el.parentElement.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setIndicator({ left: rect.left - parent.left, width: rect.width });
    }
  }, [activeTab, jobs.length]);

  return (
    <div className="flex flex-col h-full bw-surface">
      <div className="relative flex border-b bw-border bw-surface shrink-0">
        {TABS.map((t) => {
          const count = countForTab(t.id);
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              className={cn(
                'flex-1 text-center py-2.5 text-xs font-bold uppercase tracking-wide transition-colors relative',
                active ? 'bw-accent' : 'bw-muted bw-hover-text'
              )}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              <span
                className={cn(
                  'ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                  active ? 'bw-accent-solid' : 'bw-card-static bw-muted border'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
        <span
          className="absolute bottom-0 h-0.5 bg-[var(--bw-accent)] transition-all duration-200 ease-out rounded-full"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {tabJobs.length === 0 ? (
          <div className="text-center bw-muted text-sm py-12">No jobs in this tab</div>
        ) : (
          tabJobs.map((job) => <JobCard key={job.id} job={job} tab={activeTab} />)
        )}
      </div>
    </div>
  );
}
