import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  onDrag: (delta: number) => void;
  onDoubleClick?: () => void;
  className?: string;
}

export function ResizeHandle({ onDrag, onDoubleClick, className }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(delta);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onDrag]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        'w-1 shrink-0 cursor-col-resize bw-resize-handle transition-colors z-20',
        className
      )}
      title="Drag to resize · double-click to reset"
    />
  );
}
