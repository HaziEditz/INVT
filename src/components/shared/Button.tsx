import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'success' | 'danger' | 'ghost' | 'muted';
  size?: 'sm' | 'md';
}

const variants = {
  primary: 'bg-bw-primary hover:bg-blue-600 text-white',
  gold: 'bg-bw-gold hover:brightness-110 text-[#1a1a2e] font-bold',
  success: 'bg-bw-success hover:brightness-110 text-white',
  danger: 'bg-bw-danger hover:brightness-110 text-white',
  ghost: 'bg-bw-surface/80 border border-bw-border hover:bg-bw-cardHover hover:border-bw-primary/30 text-bw-text',
  muted: 'bg-bw-card border border-bw-border text-bw-muted hover:text-bw-text hover:bg-bw-cardHover',
};

export function Button({ variant = 'primary', size = 'sm', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-md font-semibold transition disabled:opacity-50',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
