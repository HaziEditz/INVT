import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  wide?: boolean;
  extraWide?: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, wide, extraWide, bodyClassName, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bw-card flex flex-col max-h-[92vh] shadow-2xl',
          extraWide ? 'w-full max-w-[min(96vw,1400px)]' : wide ? 'w-full max-w-5xl' : 'w-full max-w-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-bw-border bg-bw-surface">
            <h2 className="text-sm font-semibold text-bw-text">{title}</h2>
            <button onClick={onClose} className="text-bw-muted hover:text-bw-text">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto p-4', bodyClassName)}>{children}</div>
        {footer && <div className="border-t border-bw-border p-3 flex gap-2 justify-end bg-bw-surface">{footer}</div>}
      </div>
    </div>
  );
}
