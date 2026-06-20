import { useEffect } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { parseCityFromFirebase } from '@/lib/mapCenter';
import { startEmergencyAlarm, stopEmergencyAlarm } from '@/lib/notifySound';
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
  const setEmergency = useUiStore((s) => s.setEmergency);

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    let hadActiveAlarm = false;
    let toastShownFor: string | null = null;

    const emergRef = ref(db, `Emergency/${companyId}`);
    const unsubEmergency = onValue(emergRef, (snap) => {
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
          addToast({
            type: 'error',
            title: 'EMERGENCY SOS',
            message: `${rec.driverName ?? 'Driver'} — audible alert until acknowledged`,
          });
        }
      } else {
        if (hadActiveAlarm) stopEmergencyAlarm();
        hadActiveAlarm = false;
      }
    });

    const regRef = ref(db, `driverRegistrations/${companyId}`);
    let regInit = true;
    const unsubReg = onValue(regRef, (snap) => {
      if (regInit) {
        regInit = false;
        return;
      }
      if (snap.exists()) {
        addToast({ type: 'info', title: 'Driver registration', message: 'New driver registration pending' });
      }
    });

    return () => {
      unsubEmergency();
      unsubReg();
      stopEmergencyAlarm();
    };
  }, [companyId, addToast, setEmergency]);
}

/** Client-side auto-dispatch disabled — server handles every 30s */
export function useAutoDispatch() {
  /* intentionally empty — server-side only per spec */
}
