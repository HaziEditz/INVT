import { useSpaVersionCheck } from '@/hooks/useSpaVersionCheck';

/** Non-blocking banner when the loaded JS bundle is behind the server's current build. */
export function SpaUpdateBanner() {
  const { updateAvailable, reload } = useSpaVersionCheck();
  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="bg-sky-900/50 border-b border-sky-700 text-sky-100 text-xs px-3 py-1.5 flex items-center justify-center gap-3 shrink-0"
    >
      <span>New version available — reload to update Dispatch.</span>
      <button
        type="button"
        onClick={reload}
        className="font-semibold underline underline-offset-2 hover:text-white"
      >
        Reload
      </button>
    </div>
  );
}
