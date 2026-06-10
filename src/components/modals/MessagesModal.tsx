import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';

export function MessagesModal() {
  const open = useUiStore((s) => s.openModal === 'messages');
  const closeModal = useUiStore((s) => s.closeModal);
  const [tab, setTab] = useState<'direct' | 'broadcast' | 'group' | 'd2d' | 'inbox'>('direct');
  const [text, setText] = useState('');

  const tabs = [
    { id: 'direct' as const, label: 'Direct' },
    { id: 'broadcast' as const, label: 'Broadcast' },
    { id: 'group' as const, label: 'Group' },
    { id: 'd2d' as const, label: 'Driver' },
    { id: 'inbox' as const, label: 'Inbox' },
  ];

  return (
    <Modal open={open} onClose={closeModal} title="Messages" wide footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <div className="flex gap-1 mb-3 border-b border-bw-border pb-2">
        {tabs.map((t) => (
          <button key={t.id} className={`px-3 py-1 text-xs font-bold rounded ${tab === t.id ? 'bg-bw-primary text-white' : 'text-bw-muted'}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'broadcast' && (
        <div>
          <p className="text-xs text-bw-muted mb-2">Send to all online drivers</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-24 px-3 py-2 rounded bg-bw-bg border border-bw-border mb-2" />
          <Button variant="primary">Send Broadcast</Button>
        </div>
      )}
      {tab === 'direct' && <p className="text-sm text-bw-muted">Select a driver from the online list to start a direct chat.</p>}
      {tab === 'group' && <p className="text-sm text-bw-muted">Filter by zone and vehicle type — zones loaded from Firebase.</p>}
      {tab === 'd2d' && <p className="text-sm text-bw-muted">Relay a message between two drivers.</p>}
      {tab === 'inbox' && <p className="text-sm text-bw-muted">Firebase messages thread view.</p>}
    </Modal>
  );
}
