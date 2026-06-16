import { useEffect, useState } from 'react';
import { getDb, ref, onValue } from '@/lib/firebase';
import { useDriverStore } from '@/store/driverStore';
import { driverFromFirebase, isGhostOnlineNode, isLoggedOutOnlineNode } from '@/types/driver';

export function useDrivers(companyId: string | null) {
  const setDrivers = useDriverStore((s) => s.setDrivers);

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const r = ref(db, `online/${companyId}`);

    const unsub = onValue(r, (snap) => {
      const list = [];
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [vehicleId, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          if (vehicleId === 'current') continue;
          const driver = driverFromFirebase(vehicleId, rec, companyId);
          if (driver) list.push(driver);
        }
      }
      setDrivers(list);
    });

    return () => unsub();
  }, [companyId, setDrivers]);
}

export function useDriverQueue(companyId: string | null) {
  const [queueByZone, setQueueByZone] = useState<Record<string, { vehicleNo: string; driverId: string; status: string; queue: number }[]>>({});

  useEffect(() => {
    if (!companyId) return;
    const db = getDb();
    const r = ref(db, `online/${companyId}`);
    const unsub = onValue(r, (snap) => {
      const zones: Record<string, { vehicleNo: string; driverId: string; status: string; queue: number }[]> = {};
      const val = snap.val();
      if (val && typeof val === 'object') {
        for (const [vid, rec] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          if (vid === 'current') continue;
          const current = (rec.current as Record<string, unknown>) || {};
          if (isLoggedOutOnlineNode(rec, current) || isGhostOnlineNode(rec, current)) continue;
          const zone = String(rec.zonename ?? rec.zoneName ?? 'Unknown');
          const status = String(rec.vehiclestatus ?? current.vehiclestatus ?? 'Away');
          const q = current.zonequeue != null ? Number(current.zonequeue) : 999;
          if (!zones[zone]) zones[zone] = [];
          zones[zone].push({
            vehicleNo: String(rec.vehiclenumber ?? vid),
            driverId: String(rec.driverid ?? ''),
            status,
            queue: q,
          });
        }
      }
      for (const z of Object.keys(zones)) {
        zones[z].sort((a, b) => a.queue - b.queue);
      }
      setQueueByZone(zones);
    });
    return () => unsub();
  }, [companyId]);

  return queueByZone;
}
