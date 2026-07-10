const API = '/api';

async function sosPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new Error(String(data.error || `SOS action failed (${res.status})`));
  }
  return data;
}

export function acknowledgeSos(sosId: string, dispatcherName?: string) {
  return sosPost('/sos/acknowledge', { sosId, dispatcherName });
}

export function resolveSos(sosId: string) {
  return sosPost('/sos/resolve', { sosId });
}

export function falseAlarmSos(sosId: string) {
  return sosPost('/sos/false-alarm', { sosId });
}

export function respondToSos(sosId: string, driverId?: string, companyId?: string) {
  return sosPost('/sos/respond', { sosId, driverId, companyId });
}

export interface SosHistoryRow {
  id: string;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  locationAddress: string;
  status: string;
  resolvedAt: number;
}

export async function fetchSosHistory(): Promise<SosHistoryRow[]> {
  const res = await fetch(`${API}/sos/history`, { credentials: 'include' });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    history?: SosHistoryRow[];
    error?: string;
  };
  if (!res.ok || data.ok === false) {
    throw new Error(String(data.error || `SOS history fetch failed (${res.status})`));
  }
  return Array.isArray(data.history) ? data.history : [];
}
