import { useJobStore } from '@/store/jobStore';
import type { JobTab } from '@/types/job';
import { JobCard } from './JobCard';
import { cn } from '@/lib/utils';

const TABS: { id: JobTab; label: string }[] = [
  { id: 'ua', label: 'U-A' },
  { id: 'offer', label: 'Offer' },
  { id: 'assign', label: 'Assign' },
  { id: 'active', label: 'Active' },
  { id: 'queue', label: 'Queue' },
  { id: 'dy', label: 'DY' },
];

export function JobTabs() {
  const activeTab = useJobStore((s) => s.activeTab);
  const setActiveTab = useJobStore((s) => s.setActiveTab);
  const jobsForTab = useJobStore((s) => s.jobsForTab);
  const countForTab = useJobStore((s) => s.countForTab);

  return (
    <div className="flex flex-col h-full bw-panel">
      <div className="flex border-b border-bw-border bg-bw-surface shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={cn('bw-tab', activeTab === t.id && 'bw-tab-active')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            <span className="ml-1 opacity-70">({countForTab(t.id)})</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {jobsForTab(activeTab).length === 0 ? (
          <div className="text-center text-bw-muted text-sm py-12">No jobs in this tab</div>
        ) : (
          jobsForTab(activeTab).map((job) => <JobCard key={job.id} job={job} tab={activeTab} />)
        )}
      </div>
    </div>
  );
}
