import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { useUiStore } from '@/store/uiStore';
import { getDb, ref, onChildAdded } from '@/lib/firebase';
import {
  type ChatMessageRow,
  type DriverChatListItem,
  driverDisplayName,
  fetchDispatcherConversation,
  fetchDriverChatList,
  fetchUnreadFromDriver,
  isOutboundMessage,
  sendDirectMessage,
} from '@/lib/messagesApi';

type Props = {
  companyId: string | null;
};

export function MessagesModal({ companyId }: Props) {
  const open = useUiStore((s) => s.openModal === 'messages');
  const closeModal = useUiStore((s) => s.closeModal);
  const addToast = useUiStore((s) => s.addToast);
  const [tab, setTab] = useState<'direct' | 'broadcast' | 'group' | 'd2d' | 'inbox'>('direct');
  const [drivers, setDrivers] = useState<DriverChatListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const refreshDriverList = useCallback(async () => {
    try {
      const list = await fetchDriverChatList();
      setDrivers(list);
    } catch (e) {
      console.error('[Messages] driver list failed', e);
    }
  }, []);

  const loadConversation = useCallback(async (driverId: string) => {
    setLoading(true);
    try {
      const rows = await fetchDispatcherConversation(driverId);
      setMessages(rows);
      await fetchUnreadFromDriver(driverId).catch(() => undefined);
      await refreshDriverList();
    } catch (e) {
      console.error('[Messages] conversation failed', e);
      addToast({ type: 'error', title: 'Messages', message: 'Could not load conversation' });
    } finally {
      setLoading(false);
    }
  }, [addToast, refreshDriverList]);

  useEffect(() => {
    if (!open) return;
    void refreshDriverList();
    const iv = setInterval(() => void refreshDriverList(), 8000);
    return () => clearInterval(iv);
  }, [open, refreshDriverList]);

  // Refresh open thread when a new driver message arrives (global toast handled in useRealtimeNotifications).
  useEffect(() => {
    if (!open || !companyId) return;
    const db = getDb();
    const msgRef = ref(db, `driverMsg/${companyId}`);
    const startedAt = Date.now();
    const unsub = onChildAdded(msgRef, (snap) => {
      const val = snap.val() as Record<string, unknown> | null;
      if (!val) return;
      const ts = parseInt(String(val.timestamp ?? ''), 10);
      if (ts && ts < startedAt - 5000) return;
      const driverId = String(val.driverId ?? val.DriverId ?? '');
      void refreshDriverList();
      const activeId = selectedIdRef.current;
      if (activeId && driverId && String(activeId) === driverId) {
        void loadConversation(driverId);
      }
    });
    return () => unsub();
  }, [open, companyId, refreshDriverList, loadConversation]);

  useEffect(() => {
    if (selectedId) void loadConversation(selectedId);
    else setMessages([]);
  }, [selectedId, loadConversation]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const inboxDrivers = useMemo(
    () => drivers.filter((d) => (d.Count || 0) > 0).sort((a, b) => (b.Count || 0) - (a.Count || 0)),
    [drivers],
  );

  const selectedName = useMemo(() => {
    if (!selectedId) return '';
    const hit = drivers.find((d) => String(d.Id) === String(selectedId));
    return hit ? driverDisplayName(hit) : `Driver ${selectedId}`;
  }, [drivers, selectedId]);

  const send = async () => {
    if (!selectedId || !text.trim() || sending) return;
    setSending(true);
    const outgoing = text.trim();
    setText('');
    try {
      await sendDirectMessage(selectedId, outgoing);
      const now = new Date();
      const date = now.toISOString().substring(0, 10);
      const time = now.toTimeString().substring(0, 5);
      setMessages((prev) => [
        ...prev,
        {
          Id: Date.now(),
          SenderID: 'Dispatcher',
          User: 'You',
          Message: outgoing,
          Date: date,
          Time: time,
        },
      ]);
      await refreshDriverList();
    } catch (e) {
      setText(outgoing);
      addToast({ type: 'error', title: 'Send failed', message: e instanceof Error ? e.message : 'Could not send' });
    } finally {
      setSending(false);
    }
  };

  const tabs = [
    { id: 'direct' as const, label: 'Direct' },
    { id: 'inbox' as const, label: inboxDrivers.length ? `Inbox (${inboxDrivers.reduce((n, d) => n + (d.Count || 0), 0)})` : 'Inbox' },
    { id: 'broadcast' as const, label: 'Broadcast' },
    { id: 'group' as const, label: 'Group' },
    { id: 'd2d' as const, label: 'Driver' },
  ];

  const driverSidebar = (list: DriverChatListItem[]) => (
    <ul className="overflow-y-auto max-h-72 border border-bw-border rounded divide-y divide-bw-border">
      {list.length === 0 ? (
        <li className="p-4 text-sm text-bw-muted text-center">No drivers online</li>
      ) : (
        list.map((d) => {
          const id = String(d.Id);
          const sel = selectedId === id;
          return (
            <li key={id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 flex justify-between items-center ${
                  sel ? 'bg-bw-primary text-white' : 'hover:bg-bw-bg text-bw-text'
                }`}
                onClick={() => {
                  setSelectedId(id);
                  if (tab === 'inbox') setTab('direct');
                }}
              >
                <span className={`text-sm font-medium ${sel ? 'text-white' : 'text-bw-text'}`}>
                  {driverDisplayName(d)}
                </span>
                {(d.Count || 0) > 0 ? (
                  <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5">{d.Count}</span>
                ) : null}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );

  const chatPanel = (
    <div className="flex flex-col min-h-[280px] border border-bw-border rounded">
      <div className="px-3 py-2 border-b border-bw-border bg-bw-bg/80">
        <p className="text-sm font-bold text-bw-text">
          {selectedId ? selectedName : 'Select a driver'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-56">
        {!selectedId ? (
          <p className="text-sm text-bw-muted text-center py-8">Choose a driver to view the thread.</p>
        ) : loading ? (
          <p className="text-sm text-bw-muted text-center py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-bw-muted text-center py-8">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const out = selectedId ? isOutboundMessage(m, selectedId) : true;
            return (
              <div key={m.Id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${out ? 'bg-bw-primary text-white' : 'bg-bw-surface border border-bw-border text-bw-text'}`}>
                  {!out ? <p className="text-xs text-bw-muted mb-1">{m.User}</p> : null}
                  <p>{m.Message}</p>
                  <p className="text-[10px] opacity-70 mt-1">{m.Date} {m.Time}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>
      {selectedId ? (
        <div className="p-2 border-t border-bw-border flex gap-2" onMouseDown={(e) => e.stopPropagation()}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 h-16 px-3 py-2 rounded bg-bw-bg border border-bw-border text-sm text-bw-text resize-none select-text"
            autoFocus
          />
          <Button variant="primary" disabled={sending || !text.trim()} onClick={() => void send()}>
            Send
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <Modal open={open} onClose={closeModal} title="Messages" wide footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>
      <div className="flex gap-1 mb-3 border-b border-bw-border pb-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-3 py-1 text-xs font-bold rounded ${tab === t.id ? 'bg-bw-primary text-white' : 'text-bw-muted'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'direct' || tab === 'inbox') && (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(160px,34%)_1fr] gap-3">
          <div>
            <p className="text-xs text-bw-muted mb-2">{tab === 'inbox' ? 'Unread threads' : 'Online drivers'}</p>
            {driverSidebar(tab === 'inbox' ? inboxDrivers : drivers)}
          </div>
          {chatPanel}
        </div>
      )}

      {tab === 'broadcast' && (
        <p className="text-sm text-bw-muted">Broadcast messaging — Phase 2 (server actions ready).</p>
      )}
      {tab === 'group' && <p className="text-sm text-bw-muted">Group / zone-filtered messaging — Phase 2.</p>}
      {tab === 'd2d' && <p className="text-sm text-bw-muted">Driver-to-driver relay — Phase 2.</p>}
    </Modal>
  );
}
