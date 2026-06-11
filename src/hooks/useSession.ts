import { useEffect } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { parseCityFromFirebase } from '@/lib/mapCenter';
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

    const bookingsRef = ref(db, `bookings/${companyId}`);
    let init = true;
    const unsubBookings = onValue(bookingsRef, (snap) => {
      if (init) {
        init = false;
        return;
      }
      if (snap.exists()) {
        addToast({ type: 'info', title: 'New booking', message: 'A new passenger booking was received' });
      }
    });

    const emergRef = ref(db, `Emergency/${companyId}`);
    const unsubEmergency = onValue(emergRef, (snap) => {
      const val = snap.val();
      if (!val || typeof val !== 'object') return;
      for (const [, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
        setEmergency({
          driverName: String(rec.driverName ?? 'Driver'),
          vehicle: String(rec.vehiclenumber ?? ''),
          lat: Number(rec.lat ?? 0),
          lng: Number(rec.lng ?? 0),
          time: String(rec.time ?? new Date().toISOString()),
        });
        addToast({ type: 'error', title: 'Emergency alert', message: 'Driver emergency signal received' });
        break;
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
      unsubBookings();
      unsubEmergency();
      unsubReg();
    };
  }, [companyId, addToast, setEmergency]);
}

/** Client-side auto-dispatch disabled — server handles every 30s */
export function useAutoDispatch() {
  /* intentionally empty — server-side only per spec */
}
