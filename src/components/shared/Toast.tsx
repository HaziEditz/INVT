import { X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

export function ToastStack() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  return (
    <div className="fixed top-14 right-3 z-[2000] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`bw-card px-3 py-2 shadow-lg border-l-4 ${
            t.type === 'error'
              ? 'border-l-bw-danger'
              : t.type === 'success'
                ? 'border-l-bw-success'
                : t.type === 'warning'
                  ? 'border-l-bw-warning'
                  : 'border-l-bw-primary'
          }`}
        >
          <div className="flex justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-bw-text">{t.title}</div>
              {t.message && <div className="text-[11px] text-bw-muted mt-0.5">{t.message}</div>}
            </div>
            <button onClick={() => removeToast(t.id)} className="text-bw-muted shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
