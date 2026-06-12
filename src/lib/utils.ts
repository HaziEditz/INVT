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
  const s = src.toLowerCase().replace(/_/g, ' ');
  if (s.includes('dispatch') || s === 'phone' || s.includes('console')) return 'DESK';
  if (s.includes('hail')) return 'HAIL';
  if (s.includes('passenger') || s === 'app') return 'APP';
  if (s.includes('web') || s.includes('website')) return 'WEB';
  return s.slice(0, 8).toUpperCase();
}

/** Full booking source name for job cards. */
export function sourceDisplayName(src: string): string {
  const label = sourceLabel(src);
  if (label === 'DESK') return 'Dispatcher';
  if (label === 'WEB') return 'Website';
  if (label === 'APP') return 'Passenger App';
  if (label === 'HAIL') return 'Hail';
  return label;
}

/** Source badge text — DESK shows dispatcher initials/name when available. */
export function sourceBadgeLabel(src: string, dispatcherName?: string): string {
  const label = sourceLabel(src);
  if (label === 'DESK' && dispatcherName?.trim()) {
    return `${label} · ${dispatcherName.trim()}`;
  }
  return label;
}

export function isExternalJobSource(src: string): boolean {
  const label = sourceLabel(src);
  return label === 'APP' || label === 'WEB' || label === 'HAIL';
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
