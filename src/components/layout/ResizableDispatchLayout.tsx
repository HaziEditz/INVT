import { useEffect, useRef, useState } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { usePanelSizes } from '@/hooks/usePanelSizes';
import { useUiStore } from '@/store/uiStore';

interface ResizableDispatchLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

const panelClass = 'shrink-0 min-h-0 overflow-hidden bw-surface border-[var(--bw-border)]';

export function ResizableDispatchLayout({ left, center, right }: ResizableDispatchLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const { sizes, resizeLeft, resizeRight, reset } = usePanelSizes(containerWidth);
  const mapVisible = useUiStore((s) => s.mapVisible);
  const mapPoppedOut = useUiStore((s) => s.mapPoppedOut);
  const setMapVisible = useUiStore((s) => s.setMapVisible);

  const showMap = mapVisible && !mapPoppedOut;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 relative bw-shell">
      {showMap ? (
        <>
          <aside style={{ width: sizes.left }} className={`${panelClass} border-r`}>
            {left}
          </aside>
          <ResizeHandle onDrag={resizeLeft} onDoubleClick={reset} />
          <main className="flex-1 flex flex-col min-w-0 min-h-0 bw-shell">{center}</main>
          <ResizeHandle onDrag={resizeRight} onDoubleClick={reset} />
          <aside
            style={{ width: sizes.right }}
            className={`${panelClass} flex flex-col border-l`}
          >
            {right}
          </aside>
        </>
      ) : (
        <>
          <aside className={`flex-1 ${panelClass} border-r`}>{left}</aside>
          <aside className={`flex-1 ${panelClass} flex flex-col`}>{right}</aside>
        </>
      )}

      <button
        type="button"
        onClick={() => setMapVisible(!showMap)}
        className="absolute bottom-2 right-2 z-30 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bw-surface border bw-border shadow-lg hover:border-[var(--bw-accent)] bw-muted hover:text-[var(--bw-text)] transition"
      >
        {showMap ? 'Hide Map' : 'Show Map'}
      </button>
    </div>
  );
}
