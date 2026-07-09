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
  sumUnreadMessages,

  fetchUnreadFromDriver,

  isOutboundMessage,
  sendBroadcastMessage,

  sendDirectMessage,

} from '@/lib/messagesApi';



type Props = {

  companyId: string | null;

};



export function MessagesModal({ companyId }: Props) {

  const open = useUiStore((s) => s.openModal === 'messages');
  const modalDriverId = useUiStore((s) => s.modalDriverId);
  const messagesFocusNonce = useUiStore((s) => s.messagesFocusNonce);

  const closeModal = useUiStore((s) => s.closeModal);

  const addToast = useUiStore((s) => s.addToast);
  const setMessageUnreadCount = useUiStore((s) => s.setMessageUnreadCount);

  const [tab, setTab] = useState<'direct' | 'broadcast' | 'group' | 'd2d' | 'inbox' | 'voice'>('direct');

  const [drivers, setDrivers] = useState<DriverChatListItem[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessageRow[]>([]);

  const [text, setText] = useState('');
  const [broadcastText, setBroadcastText] = useState('');

  const [loading, setLoading] = useState(false);

  const [sending, setSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const selectedIdRef = useRef<string | null>(null);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const run = () => {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      chatEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    };
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, []);



  useEffect(() => {

    selectedIdRef.current = selectedId;

  }, [selectedId]);



  const refreshDriverList = useCallback(async () => {

    try {

      const list = await fetchDriverChatList();

      setDrivers(list);
      setMessageUnreadCount(sumUnreadMessages(list));

    } catch (e) {

      console.error('[Messages] driver list failed', e);

    }

  }, [setMessageUnreadCount]);



  const loadConversation = useCallback(async (driverId: string) => {

    setLoading(true);

    try {

      const rows = await fetchDispatcherConversation(driverId);

      setMessages(rows);

      await fetchUnreadFromDriver(driverId).catch(() => undefined);

      setDrivers((prev) =>
        prev.map((d) => (String(d.Id) === String(driverId) ? { ...d, Count: 0 } : d)),
      );

      await refreshDriverList();

    } catch (e) {

      console.error('[Messages] conversation failed', e);

      addToast({ type: 'error', title: 'Messages', message: 'Could not load conversation' });

    } finally {

      setLoading(false);

    }

  }, [addToast, refreshDriverList]);



  const selectDriverThread = useCallback(
    async (driverId: string, scrollBehavior: ScrollBehavior = 'smooth') => {
      setSelectedId(driverId);
      setTab('direct');
      await loadConversation(driverId);
      window.setTimeout(() => scrollChatToBottom(scrollBehavior), 100);
      window.setTimeout(() => scrollChatToBottom('auto'), 350);
    },
    [loadConversation, scrollChatToBottom],
  );



  useEffect(() => {

    if (!open) {
      setSelectedId(null);
      setMessages([]);
      return;
    }

    setBroadcastText('');
    void refreshDriverList();
    const iv = setInterval(() => void refreshDriverList(), 8000);
    return () => clearInterval(iv);

  }, [open, refreshDriverList]);



  useEffect(() => {

    if (!open || !modalDriverId || !messagesFocusNonce) return;

    const driverId = modalDriverId;
    const timer = window.setTimeout(() => {
      void selectDriverThread(driverId, 'auto');
    }, 120);

    return () => clearTimeout(timer);

  }, [open, modalDriverId, messagesFocusNonce, selectDriverThread]);



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

    if (!loading && messages.length > 0 && open) {
      scrollChatToBottom('smooth');
    }

  }, [loading, messages, open, scrollChatToBottom]);



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

  const sendBroadcast = async () => {
    if (!broadcastText.trim() || sending) return;
    setSending(true);
    const outgoing = broadcastText.trim();
    setBroadcastText('');
    try {
      await sendBroadcastMessage(outgoing);
      addToast({ type: 'success', title: 'Broadcast sent', message: `Delivered to ${drivers.length} online driver(s)` });
      await refreshDriverList();
      if (selectedIdRef.current) {
        await loadConversation(selectedIdRef.current);
      }
    } catch (e) {
      setBroadcastText(outgoing);
      addToast({
        type: 'error',
        title: 'Broadcast failed',
        message: e instanceof Error ? e.message : 'Could not send broadcast',
      });
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

    { id: 'voice' as const, label: 'Voice' },

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
                  void selectDriverThread(id);
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

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 max-h-56">

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

    <Modal open={open} onClose={closeModal} title="Messages" wide light footer={<Button variant="ghost" onClick={closeModal}>Close</Button>}>

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
        <div className="space-y-3">
          <div className="rounded border border-bw-border bg-bw-surface p-3">
            <p className="text-sm font-semibold text-bw-text">Broadcast to all online drivers</p>
            <p className="text-xs text-bw-muted mt-1">
              This sends one dispatcher message to every online driver and writes it into each driver thread.
            </p>
            <p className="text-xs text-bw-muted mt-1">Online now: {drivers.length}</p>
          </div>
          <div className="border border-bw-border rounded p-2 bg-bw-card">
            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void sendBroadcast();
                }
              }}
              placeholder="Type broadcast message to all online drivers..."
              className="w-full h-28 px-3 py-2 rounded bg-bw-bg border border-bw-border text-sm text-bw-text resize-none"
            />
            <div className="mt-2 flex justify-end">
              <Button variant="primary" disabled={sending || !broadcastText.trim() || drivers.length === 0} onClick={() => void sendBroadcast()}>
                Send broadcast
              </Button>
            </div>
          </div>
        </div>

      )}

      {tab === 'group' && <p className="text-sm text-bw-muted">Group / zone-filtered messaging — Phase 2.</p>}

      {tab === 'd2d' && <p className="text-sm text-bw-muted">Driver-to-driver relay — Phase 2.</p>}

      {tab === 'voice' && (
        /*
         * FUTURE FEATURE — VOIP voice calling between dispatcher and driver.
         * Planned approach: WebRTC peer connection with Firebase RTDB used for
         * signalling (offer/answer/ICE candidates under `voiceCall/{cid}/{driverId}`),
         * TURN/STUN for NAT traversal, and a call state machine (ringing → active →
         * ended). Driver app would surface an incoming-call screen + accept/decline.
         * Not implemented in this phase — placeholder note only.
         */
        <div className="space-y-2">
          <p className="text-sm font-semibold text-bw-text">Voice calling — coming soon</p>
          <p className="text-sm text-bw-muted">
            Direct VOIP calling between dispatcher and driver is a planned future feature. It will use
            WebRTC with Firebase for call signalling, letting dispatch place and receive in-app calls
            without leaving the console. Not available yet.
          </p>
        </div>
      )}

    </Modal>

  );

}

