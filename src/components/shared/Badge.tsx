import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide', className)}
      style={color ? { backgroundColor: `${color}22`, color, border: `1px solid ${color}55` } : undefined}
    >
      {children}
    </span>
  );
}
