import { Plus, Bell, Moon, Sun, LogOut, Copy } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';
import { logoutSession } from '@/lib/jobFlow';

interface HeaderProps {
  companyId: string;
  companyName: string;
  dispatcherName: string;
  onNameChange: (n: string) => void;
}

const NAV = [
  { id: 'searchJobs', label: 'Filter' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'searchJobs', label: 'Search' },
  { id: 'closedJobs', label: 'Closed Jobs' },
  { id: 'acc', label: 'ACC' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'messages', label: 'Message' },
] as const;

export function Header({ companyId, companyName, dispatcherName, onNameChange }: HeaderProps) {
  const openModalWith = useUiStore((s) => s.openModalWith);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const notificationCount = useUiStore((s) => s.notificationCount);
  const billingBanner = useUiStore((s) => s.billingBanner);

  return (
    <>
      {billingBanner && (
        <div className="bg-amber-900/40 border-b border-amber-700 text-amber-200 text-xs px-3 py-1 text-center">
          {billingBanner}
        </div>
      )}
      <header className="h-10 shrink-0 flex items-center gap-2 px-2 bg-bw-surface border-b border-bw-border text-sm">
        <Button variant="gold" onClick={() => openModalWith('createJob')}>
          <Plus size={14} /> Create Job
        </Button>
        <button
          className="text-[10px] font-mono px-2 py-0.5 rounded bg-bw-card border border-bw-border text-bw-muted hover:text-bw-text flex items-center gap-1"
          onClick={() => navigator.clipboard.writeText(companyId)}
          title="Copy Company ID"
        >
          {companyId} <Copy size={10} />
        </button>
        <span className="font-semibold text-bw-text truncate max-w-[120px]">{companyName}</span>
        <input
          value={dispatcherName}
          onChange={(e) => onNameChange(e.target.value)}
          className="bg-transparent border-b border-bw-border text-xs w-28 focus:outline-none focus:border-bw-primary"
        />
        <nav className="flex items-center gap-0.5 ml-2 flex-1 overflow-x-auto">
          {NAV.map((n) => (
            <button key={n.id} className="bw-nav-link" onClick={() => openModalWith(n.id as never)}>
              {n.label}
            </button>
          ))}
          <button className="bw-nav-link text-bw-danger" onClick={logoutSession}>
            <LogOut size={12} className="inline mr-0.5" /> Log Out
          </button>
        </nav>
        <button className="text-bw-muted hover:text-bw-text p-1" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="relative text-bw-muted hover:text-bw-text p-1">
          <Bell size={16} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-bw-danger text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>
      </header>
    </>
  );
}
