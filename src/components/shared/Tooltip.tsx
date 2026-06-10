import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)} title={label}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded bg-bw-card border border-bw-border text-[10px] text-bw-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {label}
      </span>
    </span>
  );
}
