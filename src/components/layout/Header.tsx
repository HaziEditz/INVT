import { Plus, Bell, Moon, Sun, LogOut, Copy, Car } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';
import { logoutSession } from '@/lib/jobFlow';
import { dispatcherInitials } from '@/lib/utils';

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
  const initials = dispatcherInitials(dispatcherName);

  return (
    <>
      {billingBanner && (
        <div className="bg-amber-900/40 border-b border-amber-700 text-amber-200 text-xs px-3 py-1 text-center">
          {billingBanner}
        </div>
      )}
      <header className="h-11 shrink-0 flex items-center gap-3 px-3 bg-[#0f1420] border-b border-[#2d3148] shadow-sm text-sm text-[#e8eaf0]">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#5b7cfa]/20 border border-[#5b7cfa]/40 flex items-center justify-center">
            <Car size={16} className="text-[#5b7cfa]" />
          </div>
          <span className="text-xs font-bold tracking-wide text-[#8892a4] hidden sm:inline">BookaWaka</span>
        </div>

        <Button variant="gold" onClick={() => openModalWith('createJob')}>
          <Plus size={14} /> Create Job
        </Button>

        <button
          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e2235] border border-[#2d3148] text-[#8892a4] hover:text-[#e8eaf0] flex items-center gap-1"
          onClick={() => navigator.clipboard.writeText(companyId)}
          title="Copy Company ID"
        >
          {companyId} <Copy size={10} />
        </button>

        <span className="font-bold text-[#e8eaf0] truncate max-w-[160px] text-sm">{companyName}</span>

        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 rounded-full bg-[#5b7cfa]/30 border border-[#5b7cfa]/50 flex items-center justify-center text-[10px] font-bold text-[#5b7cfa]">
            {initials}
          </div>
          <input
            value={dispatcherName}
            onChange={(e) => onNameChange(e.target.value)}
            className="bg-transparent border-b border-[#2d3148] text-xs w-28 focus:outline-none focus:border-[#5b7cfa] text-[#e8eaf0]"
            aria-label="Dispatcher name"
          />
        </div>

        <nav className="flex items-center gap-1 ml-auto overflow-x-auto">
          {NAV.map((n, i) => (
            <button
              key={`${n.id}-${n.label}-${i}`}
              className="bw-nav-link px-2.5"
              onClick={() => openModalWith(n.id as never)}
            >
              {n.label}
            </button>
          ))}
          <button className="bw-nav-link text-red-400 px-2.5" onClick={logoutSession}>
            <LogOut size={12} className="inline mr-0.5" /> Log Out
          </button>
        </nav>

        <button className="text-[#8892a4] hover:text-[#e8eaf0] p-1.5 rounded-md hover:bg-[#1e2235]" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="relative text-[#8892a4] hover:text-[#e8eaf0] p-1.5 rounded-md hover:bg-[#1e2235]">
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
