import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Left slide-in panel — map stays visible to the right */
export function SlidePanel({
  open,
  onClose,
  title,
  width = 420,
  children,
  footer,
  className,
}: SlidePanelProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 top-11 bottom-8 z-[45] bg-black/20"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-11 bottom-8 z-[50] flex flex-col shadow-2xl border-r bw-border bw-surface transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
          className
        )}
        style={{ width }}
        aria-hidden={!open}
      >
        {title && (
          <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b bw-border bw-header-bar">
            <h2 className="text-sm font-semibold bw-text">{title}</h2>
            <button type="button" onClick={onClose} className="bw-icon-btn" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">{children}</div>
        {footer && (
          <div className="shrink-0 border-t bw-border p-2.5 flex flex-wrap gap-2 justify-end bw-surface">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
