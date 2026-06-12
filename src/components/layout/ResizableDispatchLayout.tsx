import { useEffect, useRef, useState } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { useLayoutStore } from '@/store/layoutStore';
import { useUiStore } from '@/store/uiStore';

interface ResizableDispatchLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  dispatcherUid?: string;
}

const panelClass = 'shrink-0 min-h-0 overflow-hidden bw-surface border-[var(--bw-border)]';

export function ResizableDispatchLayout({
  left,
  center,
  right,
  dispatcherUid,
}: ResizableDispatchLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapVisible = useUiStore((s) => s.mapVisible);
  const mapPoppedOut = useUiStore((s) => s.mapPoppedOut);
  const setMapVisible = useUiStore((s) => s.setMapVisible);

  const leftWidth = useLayoutStore((s) => s.left);
  const rightWidth = useLayoutStore((s) => s.right);
  const locked = useLayoutStore((s) => s.locked);
  const setContainerWidth = useLayoutStore((s) => s.setContainerWidth);
  const setDispatcherUid = useLayoutStore((s) => s.setDispatcherUid);
  const resizeLeft = useLayoutStore((s) => s.resizeLeft);
  const resizeRight = useLayoutStore((s) => s.resizeRight);

  const showMap = mapVisible && !mapPoppedOut;

  useEffect(() => {
    if (dispatcherUid) setDispatcherUid(dispatcherUid);
  }, [dispatcherUid, setDispatcherUid]);

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
  }, [setContainerWidth]);

  const panelTransition = { width: leftWidth, transition: 'width 0.2s ease' };
  const rightTransition = { width: rightWidth, transition: 'width 0.2s ease' };

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 relative bw-shell">
      {showMap ? (
        <>
          <aside style={panelTransition} className={`${panelClass} border-r`}>
            {left}
          </aside>
          <ResizeHandle onDrag={resizeLeft} disabled={locked} />
          <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden p-1.5">
            {center}
          </main>
          <ResizeHandle onDrag={resizeRight} disabled={locked} />
          <aside style={rightTransition} className={`${panelClass} flex flex-col border-l`}>
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
