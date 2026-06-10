import { useEffect, useRef, useState } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { usePanelSizes } from '@/hooks/usePanelSizes';
import { useUiStore } from '@/store/uiStore';

interface ResizableDispatchLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

const panelClass = 'shrink-0 min-h-0 overflow-hidden bg-[#1a1d2e] text-[#e8eaf0] border-[#2d3148]';

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
    <div ref={containerRef} className="flex flex-1 min-h-0 relative bg-[#13151f]">
      {showMap ? (
        <>
          <aside style={{ width: sizes.left }} className={`${panelClass} border-r`}>
            {left}
          </aside>
          <ResizeHandle onDrag={resizeLeft} onDoubleClick={reset} />
          <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#13151f]">{center}</main>
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
        className="absolute bottom-2 right-2 z-30 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#1a1d2e] border border-[#2d3148] shadow-lg hover:border-[#5b7cfa] text-[#8892a4] hover:text-[#e8eaf0] transition"
      >
        {showMap ? 'Hide Map' : 'Show Map'}
      </button>
    </div>
  );
}
