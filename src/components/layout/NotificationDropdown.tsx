import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useUiStore, type NotificationCategory, type NotificationItem } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<NotificationCategory, string> = {
  job_created: '✅',
  job_cancelled: '❌',
  job_updated: '✏️',
  job_accepted: '✓',
  job_recalled: '↩',
  no_show: '⚠',
  driver_online: '🚗',
  new_booking: '📋',
  sos_alert: '🚨',
  general: 'ℹ️',
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}

export function NotificationDropdown() {
  const notifications = useUiStore((s) => s.notifications);
  const unreadCount = useUiStore((s) => s.notificationCount);
  const dismissNotification = useUiStore((s) => s.dismissNotification);
  const clearAllNotifications = useUiStore((s) => s.clearAllNotifications);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative bw-icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[min(420px,70vh)] overflow-hidden rounded-lg border border-[#2d3148] bg-[#12151f] shadow-xl z-[3000] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d3148] shrink-0">
            <span className="text-xs font-semibold bw-text">Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                className="text-[10px] text-[#8892a4] hover:text-[#e8eaf0]"
                onClick={() => clearAllNotifications()}
              >
                Clear all
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {notifications.length === 0 ? (
              <p className="text-xs text-[#8892a4] px-3 py-6 text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} item={n} onDismiss={() => dismissNotification(n.id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 border-b border-[#2d3148]/60 last:border-b-0',
        !item.read && 'bg-[#1a1f2e]'
      )}
    >
      <span className="text-sm shrink-0 mt-0.5">{CATEGORY_ICON[item.category]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold bw-text">{item.title}</div>
        {item.message && (
          <div className="text-[11px] text-[#8892a4] mt-0.5 line-clamp-2">{item.message}</div>
        )}
        <div className="text-[10px] text-[#64748b] mt-1">{formatTime(item.createdAt)}</div>
      </div>
      <button type="button" className="text-[#8892a4] hover:text-[#e8eaf0] shrink-0" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
