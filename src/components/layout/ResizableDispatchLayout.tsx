import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { useUiStore } from '@/store/uiStore';

interface ResizableDispatchLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

const DEFAULT_LEFT = 380;
const DEFAULT_RIGHT = 460;
const MIN_LEFT = 280;
const MIN_RIGHT = 320;
const MIN_MAP = 200;

const panelClass = 'shrink-0 min-h-0 overflow-hidden bw-surface border-[var(--bw-border)]';

function clampPanelSizes(left: number, right: number, containerWidth: number) {
  if (!containerWidth || containerWidth < MIN_LEFT + MIN_RIGHT + MIN_MAP) {
    return { left, right };
  }
  const maxLeft = Math.max(MIN_LEFT, containerWidth - right - MIN_MAP);
  const maxRight = Math.max(MIN_RIGHT, containerWidth - left - MIN_MAP);
  return {
    left: Math.min(Math.max(MIN_LEFT, left), maxLeft),
    right: Math.min(Math.max(MIN_RIGHT, right), maxRight),
  };
}

export function ResizableDispatchLayout({ left, center, right }: ResizableDispatchLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapVisible = useUiStore((s) => s.mapVisible);
  const mapPoppedOut = useUiStore((s) => s.mapPoppedOut);
  const setMapVisible = useUiStore((s) => s.setMapVisible);

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [containerWidth, setContainerWidth] = useState(0);

  const effective = useMemo(
    () => clampPanelSizes(leftWidth, rightWidth, containerWidth),
    [leftWidth, rightWidth, containerWidth]
  );

  const showMap = mapVisible && !mapPoppedOut;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resizeLeft = useCallback(
    (delta: number) => {
      setLeftWidth((prev) => clampPanelSizes(prev + delta, rightWidth, containerWidth).left);
    },
    [rightWidth, containerWidth]
  );

  const resizeRight = useCallback(
    (delta: number) => {
      setRightWidth((prev) => clampPanelSizes(leftWidth, prev - delta, containerWidth).right);
    },
    [leftWidth, containerWidth]
  );

  const panelTransition = { width: effective.left, transition: 'width 0.2s ease' };
  const rightTransition = { width: effective.right, transition: 'width 0.2s ease' };

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 relative bw-shell">
      {showMap ? (
        <>
          <aside style={panelTransition} className={`${panelClass} border-r`}>
            {left}
          </aside>
          <ResizeHandle onDrag={resizeLeft} />
          <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden p-1.5">
            {center}
          </main>
          <ResizeHandle onDrag={resizeRight} />
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
