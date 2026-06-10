import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';

interface Alarm {
  id: string;
  text: string;
  at: string;
  active: boolean;
}

export function AlarmsModal() {
  const open = useUiStore((s) => s.openModal === 'alarms');
  const closeModal = useUiStore((s) => s.closeModal);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [text, setText] = useState('');

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
    </Modal>
  );
}
