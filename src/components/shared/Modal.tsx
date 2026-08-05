import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  wide?: boolean;
  extraWide?: boolean;
  /** Always use white background + dark text (readable on dark dispatch themes). */
  light?: boolean;
  /** Stack above other open modals (e.g. closed-job detail over Closed Jobs). */
  elevated?: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  wide,
  extraWide,
  light,
  elevated,
  bodyClassName,
  children,
  footer,
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4 bg-black/60',
        elevated ? 'z-[1100]' : 'z-[1000]',
      )}
      onClick={(e) => {
        // Prefer click over mousedown so opening a stacked modal from a button
        // inside another modal cannot immediately dismiss via a leftover pointer event.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'flex flex-col max-h-[92vh] shadow-2xl',
          light ? 'bw-modal-light border border-bw-border rounded-lg' : 'bw-card',
          extraWide ? 'w-full max-w-[min(96vw,1400px)]' : wide ? 'w-full max-w-5xl' : 'w-full max-w-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-bw-border bg-bw-surface">
            <h2 className="text-sm font-semibold text-bw-text">{title}</h2>
            <button onClick={onClose} className="text-bw-muted hover:text-bw-text">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto p-4 bg-bw-surface', bodyClassName)}>{children}</div>
        {footer && (
          <div className="border-t border-bw-border p-3 flex gap-2 justify-end bg-bw-surface">{footer}</div>
        )}
      </div>
    </div>
  );
}
