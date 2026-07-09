import { Plus, Moon, Sun, LogOut, Copy, Car, Palette } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { NotificationDropdown } from '@/components/layout/NotificationDropdown';
import { useUiStore } from '@/store/uiStore';
import { useJobStore } from '@/store/jobStore';
import { hasActiveLiveJobFilters } from '@/lib/liveJobFilters';
import { logoutSession } from '@/lib/jobFlow';
import { dispatcherInitials } from '@/lib/utils';
import { THEME_LABELS, type DispatchThemeId } from '@/lib/theme';

interface HeaderProps {
  companyId: string;
  companyName: string;
  dispatcherName: string;
  onNameChange: (n: string) => void;
}

const NAV = [
  { id: 'searchJobs', label: 'Filter' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'closedJobs', label: 'Closed Jobs' },
  { id: 'acc', label: 'ACC' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'messages', label: 'Message' },
] as const;

function ThemeIcon({ theme }: { theme: DispatchThemeId }) {
  if (theme === 'light') return <Sun size={16} />;
  if (theme === 'dark-blue') return <Palette size={16} />;
  return <Moon size={16} />;
}

export function Header({ companyId, companyName, dispatcherName, onNameChange }: HeaderProps) {
  const openModalWith = useUiStore((s) => s.openModalWith);
  const messageUnreadCount = useUiStore((s) => s.messageUnreadCount);
  const liveFiltersActive = useJobStore((s) => hasActiveLiveJobFilters(s.liveJobFilters));
  const theme = useUiStore((s) => s.theme);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const billingBanner = useUiStore((s) => s.billingBanner);
  const initials = dispatcherInitials(dispatcherName);

  return (
    <>
      {billingBanner && (
        <div className="bg-amber-900/40 border-b border-amber-700 text-amber-200 text-xs px-3 py-1 text-center">
          {billingBanner}
        </div>
      )}
      <header className="bw-header-bar h-11 shrink-0 flex items-center gap-3 px-3 border-b shadow-sm text-sm">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bw-accent-bg flex items-center justify-center">
            <Car size={16} className="bw-accent" />
          </div>
          <span className="text-xs font-bold tracking-wide bw-muted hidden sm:inline">BookaWaka</span>
        </div>

        <Button variant="gold" onClick={() => openModalWith('createJob')}>
          <Plus size={14} /> Create Job
        </Button>

        <button
          className="text-[10px] font-mono px-2 py-0.5 rounded bw-card-static bw-muted hover:text-[var(--bw-text)] flex items-center gap-1 border"
          onClick={() => navigator.clipboard.writeText(companyId)}
          title="Copy Company ID"
        >
          {companyId} <Copy size={10} />
        </button>

        <span className="font-bold bw-text truncate max-w-[160px] text-sm">{companyName}</span>

        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 rounded-full bw-accent-bg flex items-center justify-center text-[10px] font-bold bw-accent">
            {initials}
          </div>
          <input
            value={dispatcherName}
            onChange={(e) => onNameChange(e.target.value)}
            className="bg-transparent border-b bw-border text-xs w-28 focus:outline-none focus:border-[var(--bw-accent)] bw-text"
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
              <span className="inline-flex items-center gap-1">
                {n.label}
                {n.id === 'searchJobs' && liveFiltersActive ? (
                  <span className="bg-[var(--bw-accent)] text-white text-[9px] rounded-full min-w-[8px] h-2 px-1 inline-flex items-center justify-center font-bold" title="Filters active" />
                ) : null}
                {n.id === 'messages' && messageUnreadCount > 0 ? (
                  <span className="bg-red-500 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center font-bold">
                    {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          <button className="bw-nav-link text-red-400 px-2.5" onClick={logoutSession}>
            <LogOut size={12} className="inline mr-0.5" /> Log Out
          </button>
        </nav>

        <button
          className="bw-icon-btn"
          onClick={cycleTheme}
          title={`Theme: ${THEME_LABELS[theme]} — click for next`}
          aria-label={`Theme: ${THEME_LABELS[theme]}. Click to cycle themes.`}
        >
          <ThemeIcon theme={theme} />
        </button>
        <NotificationDropdown />
      </header>
    </>
  );
}
