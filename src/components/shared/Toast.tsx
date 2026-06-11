import { useUiStore } from '@/store/uiStore';

export function ToastStack() {
  const toasts = useUiStore((s) => s.toasts);

  return (
    <div className="fixed top-14 right-3 z-[2000] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`bw-card px-3 py-2 shadow-lg border-l-4 animate-in fade-in duration-200 pointer-events-auto ${
            t.type === 'error'
              ? 'border-l-bw-danger'
              : t.type === 'success'
                ? 'border-l-bw-success'
                : t.type === 'warning'
                  ? 'border-l-bw-warning'
                  : 'border-l-bw-primary'
          }`}
          style={{ animation: 'toastFade 3s ease forwards' }}
        >
          <div className="text-xs font-bold text-bw-text">{t.title}</div>
          {t.message && <div className="text-[11px] text-bw-muted mt-0.5">{t.message}</div>}
        </div>
      ))}
      <style>{`
        @keyframes toastFade {
          0%, 75% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
