import { Loader2 } from 'lucide-react';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`animate-spin text-bw-primary ${className || 'w-5 h-5'}`} />;
}
