import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  onDrag: (delta: number) => void;
  onDoubleClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ResizeHandle({ onDrag, onDoubleClick, disabled = false, className }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [disabled]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || disabled) return;
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
  }, [onDrag, disabled]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-disabled={disabled}
      onMouseDown={onMouseDown}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      className={cn(
        'w-1 shrink-0 transition-colors z-20',
        disabled
          ? 'cursor-not-allowed opacity-40 bg-[var(--bw-border)]'
          : 'cursor-col-resize bw-resize-handle',
        className
      )}
      title={disabled ? 'Layout locked' : 'Drag to resize · double-click to reset'}
    />
  );
}
