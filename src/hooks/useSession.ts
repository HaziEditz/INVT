import { useEffect } from 'react';

import { ensureFirebaseAuth, getDb, ref, onValue, onChildAdded, remove } from '@/lib/firebase';

import { parseCityFromFirebase } from '@/lib/mapCenter';

import { startEmergencyAlarm, stopEmergencyAlarm } from '@/lib/notifySound';

import { formatSosLocation, notifySosAlert } from '@/lib/dispatchNotifications';
import { fetchMessageUnreadTotal } from '@/lib/messagesApi';

import { useUiStore } from '@/store/uiStore';

import type { CompanySettings } from '@/types/booking';



const DEFAULT_FEATURES = {

  tmEnabled: true,

  autoDispatch: true,

  zoneQueue: true,

  directAssign: true,

  cardBooking: false,

  accEnabled: true,

  businessAccounts: true,

};



export function useSession(companyId: string | null, sessionId: string | null, dispatcherName: string) {

  useEffect(() => {

    if (!companyId || !sessionId) return;

    const iv = setInterval(() => {

      import('@/lib/notifications').then(({ writeActiveDispatcher }) =>

        writeActiveDispatcher(companyId, sessionId, { name: dispatcherName, active: true })

      );

    }, 60000);

    writeActiveDispatcherOnce(companyId, sessionId, dispatcherName);

    return () => clearInterval(iv);

  }, [companyId, sessionId, dispatcherName]);



  useEffect(() => {

    if (!companyId) return;

    const db = getDb();

    const r = ref(db, `superClients/${companyId}/sessionRevoke`);

    const h = onValue(r, (snap) => {

      const v = snap.val();

      if (v && typeof v === 'object' && v.force) {

        import('@/lib/jobFlow').then(({ logoutSession }) => logoutSession());

      }

    });

    return () => h();

  }, [companyId]);

}



async function writeActiveDispatcherOnce(cid: string, sid: string, name: string) {

  const { writeActiveDispatcher } = await import('@/lib/notifications');

  await writeActiveDispatcher(cid, sid, { name, active: true });

}



function settingsFingerprint(s: CompanySettings): string {

  return JSON.stringify({

    companyId: s.companyId,

    companyName: s.companyName,

    timezone: s.timezone,

    city: s.city,

    features: s.features,

    defaultDispatchWindow: s.defaultDispatchWindow,

    logoUrl: s.logoUrl,

  });

}



export function useCompanySettings(companyId: string | null) {

  const setSettings = useUiStore((s) => s.setSettings);



  useEffect(() => {

    if (!companyId) return;

    const db = getDb();

    const r = ref(db, `companySettings/${companyId}`);

    const h = onValue(r, (snap) => {

      const val = snap.val() || {};

      const settings: CompanySettings = {

        companyId,

        companyName: String(val.companyName ?? val.name ?? companyId),

        timezone: String(val.timezone ?? 'Pacific/Auckland'),

        city: parseCityFromFirebase(val.city),

        features: {

          ...DEFAULT_FEATURES,

          tmEnabled: val.tmEnabled !== false,

          autoDispatch: val.autoDispatch !== false,

          zoneQueue: val.zoneQueue !== false,

          directAssign: val.directAssign !== false,

          cardBooking: !!val.cardBooking,

          accEnabled: val.accEnabled !== false,

          businessAccounts: val.businessAccounts !== false,

        },

        tmConfig: val.tmConfig || {},

        defaultDispatchWindow: parseInt(String(val.defaultDispatchWindow ?? 10), 10) || 10,

        logoUrl: val.logoUrl,

      };

      const prev = useUiStore.getState().settings;

      if (prev && settingsFingerprint(prev) === settingsFingerprint(settings)) return;

      setSettings(settings);

    });

    return () => h();

  }, [companyId, setSettings]);

}



export function useRealtimeNotifications(companyId: string | null) {

  const addToast = useUiStore((s) => s.addToast);

  const openModalWith = useUiStore((s) => s.openModalWith);

  const setEmergency = useUiStore((s) => s.setEmergency);
  const setMessageUnreadCount = useUiStore((s) => s.setMessageUnreadCount);



  useEffect(() => {

    if (!companyId) {
      setMessageUnreadCount(0);
      return;
    }



    let cancelled = false;

    let hadActiveAlarm = false;

    let toastShownFor: string | null = null;

    let unsubEmergency = () => {};

    let unsubMsg = () => {};

    let unsubReg = () => {};

    const listenerStartedAt = Date.now();



    void (async () => {

      try {

        await ensureFirebaseAuth();

      } catch (e) {

        console.error('[RealtimeNotifications] Firebase auth bootstrap failed', e);

        return;

      }

      if (cancelled) return;



      const db = getDb();

      const refreshMessageUnread = async () => {
        try {
          const total = await fetchMessageUnreadTotal();
          setMessageUnreadCount(total);
        } catch {
          /* ignore unread refresh errors */
        }
      };
      void refreshMessageUnread();



      const emergRef = ref(db, `Emergency/${companyId}`);

      unsubEmergency = onValue(

        emergRef,

        (snap) => {

          const val = snap.val();

          if (!val || typeof val !== 'object') {

            setEmergency(null);

            if (hadActiveAlarm) {

              stopEmergencyAlarm();

              hadActiveAlarm = false;

            }

            return;

          }



          type EmergRec = Record<string, unknown>;

          let best: { key: string; rec: EmergRec; priority: number } | null = null;

          for (const [key, rec] of Object.entries(val as Record<string, EmergRec>)) {

            const status = String(rec.status ?? 'active').toLowerCase();

            if (status === 'resolved' || status === 'false_alarm') continue;

            const priority = status === 'active' ? 2 : status === 'acknowledged' ? 1 : 0;

            if (!best || priority > best.priority) best = { key, rec, priority };

          }



          if (!best) {

            setEmergency(null);

            if (hadActiveAlarm) {

              stopEmergencyAlarm();

              hadActiveAlarm = false;

            }

            toastShownFor = null;

            return;

          }



          const { key, rec } = best;

          const statusRaw = String(rec.status ?? 'active').toLowerCase();

          const status: 'active' | 'acknowledged' =

            statusRaw === 'acknowledged' ? 'acknowledged' : 'active';



          setEmergency({

            sosId: String(rec.sosId ?? rec.driverId ?? key),

            driverName: String(rec.driverName ?? 'Driver'),

            driverPhone: String(rec.driverPhone ?? rec.phone ?? ''),

            vehicle: String(rec.vehiclenumber ?? rec.vehicle ?? ''),

            lat: Number(rec.lat ?? 0),

            lng: Number(rec.lng ?? 0),

            time: String(rec.time ?? new Date().toISOString()),

            status,

          });



          if (status === 'active') {

            if (!hadActiveAlarm) startEmergencyAlarm();

            hadActiveAlarm = true;

            if (toastShownFor !== key) {

              toastShownFor = key;

              notifySosAlert(
                String(rec.driverName ?? 'Driver'),
                formatSosLocation(rec),
              );

            }

          } else {

            if (hadActiveAlarm) stopEmergencyAlarm();

            hadActiveAlarm = false;

          }

        },

        (err) => console.error('[Emergency] RTDB listener error', err),

      );



      const msgRef = ref(db, `driverMsg/${companyId}`);

      unsubMsg = onChildAdded(msgRef, (snap) => {

        const val = snap.val() as Record<string, unknown> | null;

        const key = snap.key;

        if (!val || !key) return;

        const ts = parseInt(String(val.timestamp ?? ''), 10);

        if (ts && ts < listenerStartedAt - 5000) return;

        const driverName = String(val.driverName ?? val.DriverName ?? 'Driver');

        const body = String(val.message ?? val.Message ?? '');

        addToast({

          type: 'info',

          title: `Message from ${driverName}`,

          message: body || 'New driver message',
          skipNotificationCount: true,
          durationMs: 10000,
          onClick: () => openModalWith('messages'),

        });
        void refreshMessageUnread();

        void remove(ref(db, `driverMsg/${companyId}/${key}`)).catch(() => undefined);

      });



      const regRef = ref(db, `driverRegistrations/${companyId}`);

      let regInit = true;

      unsubReg = onValue(regRef, (snap) => {

        if (regInit) {

          regInit = false;

          return;

        }

        if (snap.exists()) {

          addToast({ type: 'info', title: 'Driver registration', message: 'New driver registration pending' });

        }

      });
      const unreadIv = setInterval(() => void refreshMessageUnread(), 8000);
      const prevUnsubReg = unsubReg;
      unsubReg = () => {
        clearInterval(unreadIv);
        prevUnsubReg();
      };

    })();



    return () => {

      cancelled = true;

      unsubEmergency();

      unsubMsg();

      unsubReg();

      stopEmergencyAlarm();

    };

  }, [companyId, addToast, setEmergency, setMessageUnreadCount, openModalWith]);

}



/** Client-side auto-dispatch disabled — server handles every 30s */

export function useAutoDispatch() {

  /* intentionally empty — server-side only per spec */

}

