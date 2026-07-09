import { useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';
import { getDb, onValue, ref } from '@/lib/firebase';

interface Alarm {
  id: string;
  text: string;
  at: string;
  active: boolean;
}

interface SosHistoryEntry {
  id: string;
  driverName: string;
  vehicle: string;
  locationAddress: string;
  status: string;
  resolvedAt: number;
}

export function AlarmsModal() {
  const open = useUiStore((s) => s.openModal === 'alarms');
  const closeModal = useUiStore((s) => s.closeModal);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [text, setText] = useState('');
  const [sosHistory, setSosHistory] = useState<SosHistoryEntry[]>([]);

  useEffect(() => {
    const companyId = localStorage.getItem('bw_company_id') || '';
    if (!companyId) return;
    const db = getDb();
    const h = onValue(ref(db, `sosHistory/${companyId}`), (snap) => {
      const val = snap.val();
      if (!val || typeof val !== 'object') {
        setSosHistory([]);
        return;
      }
      const rows = Object.entries(val as Record<string, Record<string, unknown>>)
        .map(([id, rec]) => ({
          id,
          driverName: String(rec.driverName ?? 'Driver'),
          vehicle: String(rec.vehiclenumber ?? rec.vehicle ?? ''),
          locationAddress: String(rec.locationAddress ?? ''),
          status: String(rec.status ?? ''),
          resolvedAt: Number(rec.resolvedAt ?? rec.updatedAt ?? 0) || 0,
        }))
        .sort((a, b) => b.resolvedAt - a.resolvedAt);
      setSosHistory(rows);
    });
    return () => h();
  }, []);

  const add = () => {
    if (!text || !date || !time) return;
    setAlarms((a) => [...a, { id: `${Date.now()}`, text, at: `${date}T${time}`, active: true }]);
    setText('');
  };

  return (
    <Modal open={open} onClose={closeModal} title="Alarms" footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1 rounded bg-bw-bg border border-bw-border" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="px-2 py-1 rounded bg-bw-bg border border-bw-border" />
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Alarm text" className="w-full px-3 py-2 rounded bg-bw-bg border border-bw-border mb-2" />
      <Button variant="primary" onClick={add} className="mb-4">Create Alarm</Button>
      <ul className="space-y-2">
        {alarms.map((a) => (
          <li key={a.id} className="bw-card p-2 flex justify-between items-center text-sm">
            <span>{a.at} — {a.text}</span>
            <Button variant="danger" onClick={() => setAlarms((x) => x.filter((i) => i.id !== a.id))}>Disable</Button>
          </li>
        ))}
        {alarms.length === 0 && <li className="text-bw-muted text-sm text-center py-4">No alarms</li>}
      </ul>
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-bw-text mb-2">SOS history</h3>
        <ul className="space-y-2 max-h-52 overflow-y-auto">
          {sosHistory.map((row) => (
            <li key={row.id} className="bw-card p-2 text-xs">
              <div className="font-medium">{row.driverName} {row.vehicle ? `· ${row.vehicle}` : ''}</div>
              <div className="text-bw-muted">{row.locationAddress || 'Location unavailable'}</div>
              <div className="text-bw-muted uppercase">{row.status} · {row.resolvedAt ? new Date(row.resolvedAt).toLocaleString() : '—'}</div>
            </li>
          ))}
          {sosHistory.length === 0 && <li className="text-bw-muted text-sm text-center py-3">No SOS history</li>}
        </ul>
      </div>
    </Modal>
  );
}
