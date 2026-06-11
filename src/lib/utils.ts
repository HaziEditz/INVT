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
    hail: 'HAIL',
    web: 'WEB',
    website: 'WEB',
    passenger: 'APP',
    dispatch: 'DISPATCH',
    phone: 'DISPATCH',
  };
  return m[src.toLowerCase()] || src.toUpperCase();
}

export function paymentLabel(type: string): string {
  const t = (type || 'cash').toUpperCase();
  if (t.includes('STRIPE')) return 'CARD';
  return t.split(/[\s/]/)[0].slice(0, 12);
}

export function paymentBadgeColor(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('cash')) return '#22c55e';
  if (t.includes('card') || t.includes('stripe')) return '#3b82f6';
  if (t.includes('account') || t.includes('invoice')) return '#8b5cf6';
  if (t.includes('acc')) return '#ec4899';
  return '#64748b';
}

export function dispatcherInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'D';
}
