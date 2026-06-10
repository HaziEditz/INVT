export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function serviceBorderColor(service: string): string {
  const map: Record<string, string> = {
    taxi: '#3b82f6',
    food: '#f97316',
    freight: '#8b5cf6',
    tm: '#06b6d4',
    acc: '#ec4899',
    rental: '#64748b',
  };
  return map[service] || map.taxi;
}

export function sourceLabel(src: string): string {
  const m: Record<string, string> = {
    hail: 'Hail',
    web: 'Web',
    website: 'Web',
    passenger: 'App',
    dispatch: 'Phone',
    phone: 'Phone',
  };
  return m[src.toLowerCase()] || src;
}
